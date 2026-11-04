import {
  doc,
  setDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  GameState,
  Team,
  TeamPlanDoc,
  TeamActionDoc,
  TeamRoundData,
  GamePhase,
} from '@/types/game';
import { GameThemeId } from '@/lib/gameTheme';
import { removeUndefined } from '@/lib/utils';
import { advanceOnePhase } from '@/lib/phaseEngine';
import { computeTurnOrder, normalizePhaseName } from '@/lib/turnOrder';
import {
  readV2StateInTransaction,
  writeV2StateInTransaction,
  mutateControl,
} from '@/lib/v2State';
import { resolvePlan, resolveTeamAction } from './resolvers';

/**
 * Student CEO writes a sealed plan document to `classes/{classId}/plans/{round}_{teamId}`.
 */
export async function submitStudentPlanV2(
  classId: string,
  round: number,
  teamId: string,
  data: TeamRoundData
): Promise<void> {
  const planId = `${round}_${teamId}`;
  const planDoc: TeamPlanDoc = removeUndefined({
    round,
    teamId,
    combination: data.combination,
    position: data.position,
    price: data.price,
    productsProduced: data.productsProduced,
    improvementCards: data.improvementCards,
    researchIcons: data.researchIcons,
    logisticsIcons: data.logisticsIcons,
    cardUsages: data.cardUsages,
    improvementCardUsage: data.improvementCardUsage,
    improvementCardId: data.improvementCardId,
    submittedAt: new Date().toISOString(),
  });

  await setDoc(doc(db, 'classes', classId, 'plans', planId), planDoc);
}

/**
 * Student CEO creates an action document at `classes/{classId}/actions/{round}_{phase}_{teamId}`.
 */
export async function submitStudentActionV2(
  classId: string,
  round: number,
  phase: string,
  teamId: string,
  payload: TeamActionDoc['payload'],
  total: number
): Promise<string> {
  const normPhase = normalizePhaseName(phase);
  const actionId = `${round}_${normPhase}_${teamId}`;
  const actionDoc: TeamActionDoc = removeUndefined({
    round,
    phase: normPhase,
    teamId,
    payload: payload || {},
    total: Math.max(0, Math.floor(total)),
    submittedAt: new Date().toISOString(),
  });

  await setDoc(doc(db, 'classes', classId, 'actions', actionId), actionDoc);
  return actionId;
}

/**
 * Idempotent referee transaction that resolves a single `actions/{actionId}` document.
 * Safe to run concurrently from multiple tabs: if the actionalready has a `status`,
 * the transaction exits as a no-op (`{ skipped: 'already-resolved' }`).
 */
export async function applyRefereeActionTransaction(
  classId: string,
  actionId: string,
  teams: Team[],
  themeId?: GameThemeId
): Promise<{
  status: 'applied' | 'rejected' | 'already-resolved' | 'missing';
  error?: string;
}> {
  const actionRef = doc(db, 'classes', classId, 'actions', actionId);

  return runTransaction(db, async (tx) => {
    const actionSnap = await tx.get(actionRef);
    if (!actionSnap.exists()) {
      return { status: 'missing' as const };
    }

    const action = actionSnap.data() as TeamActionDoc;
    if (action.status === 'applied' || action.status === 'rejected') {
      return { status: 'already-resolved' as const };
    }

    const freshState = await readV2StateInTransaction(tx, classId, teams, themeId);
    if (!freshState) {
      return { status: 'missing' as const };
    }

    const resolution = resolveTeamAction(freshState, action);
    const nowIso = new Date().toISOString();

    if (!resolution.valid) {
      tx.update(actionRef, {
        status: 'rejected',
        error: resolution.error || 'Action rejected by referee',
        resolvedAt: nowIso,
      });
      return { status: 'rejected' as const, error: resolution.error };
    }

    const nextState: GameState = {
      ...resolution.nextState,
      refereeHeartbeatAt: nowIso,
    };

    writeV2StateInTransaction(tx, classId, nextState, freshState.stateVersion ?? 1, freshState);
    tx.update(actionRef, {
      status: 'applied',
      resolvedAt: nowIso,
    });

    return { status: 'applied' as const };
  });
}

/**
 * Facilitator closes planning (or changes phase) on a v2 class:
 * - If leaving `planning`, copies all `plans/{round}_*` into `rounds/{round}.teamData`
 *   in one transaction (the "reveal"), applying `resolvePlan` to each.
 * - Advances the phase (or sets `targetPhase`) and computes `control.turn` via `computeTurnOrder`.
 */
export async function revealPlanningAndAdvanceV2(
  classId: string,
  teams: Team[],
  themeId?: GameThemeId,
  options?: {
    force?: boolean;
    targetPhase?: GamePhase;
  }
): Promise<GameState | null> {
  return runTransaction(db, async (tx) => {
    const freshState = await readV2StateInTransaction(tx, classId, teams, themeId);
    if (!freshState) return null;

    const currentRound = freshState.currentRound || 1;
    const currentPhase = normalizePhaseName(freshState.currentPhase);
    let workingState = freshState;

    // Only read & reveal plans if leaving planning phase
    if (currentPhase === 'planning') {
      const currentRoundPlanRefs = teams.map((t) =>
        doc(db, 'classes', classId, 'plans', `${currentRound}_${t.id}`)
      );
      const planSnaps = await Promise.all(currentRoundPlanRefs.map((ref) => tx.get(ref)));

      // Copy and validate all submitted plans for currentRound into rounds/{currentRound}
      for (const pSnap of planSnaps) {
        if (pSnap.exists()) {
          const plan = pSnap.data() as TeamPlanDoc;
          if (plan.round === currentRound && plan.teamId) {
            const existing = workingState.rounds.find((r) => r.roundNumber === currentRound)
              ?.teamData?.[plan.teamId];
            if (!existing || currentPhase === 'planning') {
              const res = resolvePlan(workingState, currentRound, plan.teamId, plan);
              if (res.valid) {
                workingState = res.nextState;
              }
            }
          }
        }
      }
    }

    // Advance phase or jump to targetPhase
    let nextState: GameState;
    if (options?.targetPhase) {
      let target = normalizePhaseName(options.targetPhase) as GamePhase;
      if (workingState.currentRound >= 5 && target === 'improvement') {
        target = 'innovation';
      }
      if (currentPhase === 'planning' && target !== 'planning') {
        // Run advanceOnePhase from planning if force is requested so defaults are filled
        if (options.force) {
          const forced = advanceOnePhase(workingState, new Date(), { force: true });
          workingState = {
            ...workingState,
            rounds: forced.rounds,
          };
        }
      }
      nextState = {
        ...workingState,
        currentPhase: target,
        updatedAt: new Date(),
      };
      // If entering improvement, ensure 0-improvement teams get default product cards
      if (target === 'improvement') {
        const stepped = advanceOnePhase(
          { ...workingState, currentPhase: 'production' },
          new Date()
        );
        nextState.improvementCards = stepped.improvementCards;
      }
    } else {
      nextState = advanceOnePhase(workingState, new Date(), { force: options?.force });
    }

    const normNextPhase = normalizePhaseName(nextState.currentPhase);
    nextState.currentPhase = normNextPhase;
    nextState.turn = computeTurnOrder(nextState, normNextPhase);
    nextState.refereeHeartbeatAt = new Date().toISOString();

    writeV2StateInTransaction(tx, classId, nextState, freshState.stateVersion ?? 1, freshState);
    return nextState;
  });
}

/**
 * Facilitator control: Skip the currently active team's turn in a turn-based phase.
 */
export async function skipTurnV2(
  classId: string,
  teams: Team[],
  themeId?: GameThemeId
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const fresh = await readV2StateInTransaction(tx, classId, teams, themeId);
    if (!fresh) return;

    const round = fresh.currentRound;
    const phase = normalizePhaseName(fresh.currentPhase);
    const turn = fresh.turn || computeTurnOrder(fresh, phase);
    const skippedTeamId = turn.order[turn.index];

    const nextState: GameState = { ...fresh };
    const roundData = nextState.rounds.find((r) => r.roundNumber === round);
    const teamData = skippedTeamId ? roundData?.teamData[skippedTeamId] : undefined;

    if (skippedTeamId && teamData) {
      if (phase === 'innovation') {
        const roundAlloc = { ...(nextState.researchAllocatedByRound?.[round] || {}) };
        roundAlloc[skippedTeamId] = teamData.researchIcons || 0;
        nextState.researchAllocatedByRound = {
          ...nextState.researchAllocatedByRound,
          [round]: roundAlloc,
        };
      } else if (phase === 'expansion') {
        const roundAlloc = { ...(nextState.logisticsAllocatedByRound?.[round] || {}) };
        roundAlloc[skippedTeamId] = teamData.logisticsIcons || 0;
        nextState.logisticsAllocatedByRound = {
          ...nextState.logisticsAllocatedByRound,
          [round]: roundAlloc,
        };
      } else if (phase === 'sales' && !teamData.customersSold) {
        const rIdx = nextState.rounds.findIndex((r) => r.roundNumber === round);
        if (rIdx !== -1) {
          const rClone = { ...nextState.rounds[rIdx] };
          rClone.teamData = {
            ...rClone.teamData,
            [skippedTeamId]: {
              ...teamData,
              customersSold: [],
              nfcSalesUnits: 0,
              salesByRegion: {},
              revenue: 0,
            },
          };
          nextState.rounds = [...nextState.rounds];
          nextState.rounds[rIdx] = rClone;
        }
      }
    }

    nextState.turn = {
      ...turn,
      index: Math.min(turn.order.length, turn.index + 1),
    };
    nextState.refereeHeartbeatAt = new Date().toISOString();

    writeV2StateInTransaction(tx, classId, nextState, fresh.stateVersion ?? 1, fresh);
  });
}

/**
 * Facilitator control: Reopen/amend a team's action by deleting the action doc
 * and stepping `control.turn.index` back to that team.
 */
export async function reopenTeamActionV2(
  classId: string,
  round: number,
  phase: string,
  teamId: string
): Promise<void> {
  const normPhase = normalizePhaseName(phase);
  const actionId = `${round}_${normPhase}_${teamId}`;
  await deleteDoc(doc(db, 'classes', classId, 'actions', actionId)).catch(() => {});

  await mutateControl(classId, (ctl) => {
    if (!ctl.turn || ctl.turn.round !== round || ctl.turn.phase !== normPhase) {
      return ctl;
    }
    const teamIdx = ctl.turn.order.indexOf(teamId);
    if (teamIdx === -1) return ctl;
    return {
      ...ctl,
      turn: {
        ...ctl.turn,
        index: teamIdx,
      },
    };
  });
}

/**
 * Facilitator control: Manually reject a submitted action with a reason.
 */
export async function rejectTeamActionV2(
  classId: string,
  actionId: string,
  reason: string
): Promise<void> {
  const actionRef = doc(db, 'classes', classId, 'actions', actionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(actionRef);
    if (!snap.exists()) return;
    tx.update(actionRef, {
      status: 'rejected',
      error: reason || 'Rejected by facilitator',
      resolvedAt: new Date().toISOString(),
    });
  });
}
