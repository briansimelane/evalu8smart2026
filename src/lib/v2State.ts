import { doc, runTransaction, Transaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  GameState,
  Team,
  RoundData,
  TeamRoundData,
  ClassControlState,
  ClassWorldState,
  TeamPlanDoc,
} from '@/types/game';
import { REGIONS } from '@/data/combinations';
import { DEFAULT_GAME_THEME_ID, GameThemeId } from '@/lib/gameTheme';
import { removeUndefined, safeIsoString, toValidDate } from '@/lib/utils';
import { computeTurnOrder, normalizePhaseName } from '@/lib/turnOrder';

export const MAX_BOT_ACTIONS_LOG = 100;

/**
 * Splits a full `GameState` into the v2 documents: `control`, `world`, and `rounds`.
 */
export function splitGameState(state: GameState): {
  control: ClassControlState;
  world: ClassWorldState;
  rounds: Record<number, RoundData>;
} {
  const normPhase = normalizePhaseName(state.currentPhase);
  const turn = state.turn && state.turn.round === state.currentRound && state.turn.phase === normPhase
    ? state.turn
    : computeTurnOrder(state, normPhase);

  const createdIso = safeIsoString(state.createdAt);
  const updatedIso = safeIsoString(state.updatedAt || new Date());

  const control: ClassControlState = removeUndefined({
    gameId: state.gameId,
    themeId: state.themeId,
    currentRound: state.currentRound || 1,
    currentPhase: normPhase,
    gameEnded: Boolean(state.gameEnded),
    stateVersion: state.stateVersion ?? 1,
    turn,
    ruleAdjustments: state.ruleAdjustments,
    combinationsData: state.combinationsData,
    botConfig: state.botConfig,
    botThinking: state.botThinking || {},
    teamLabelMode: state.teamLabelMode,
    refereeHeartbeatAt: state.refereeHeartbeatAt,
    planSubmittedByRound: state.planSubmittedByRound,
    createdAt: createdIso,
    updatedAt: updatedIso,
  });

  const cappedBotLog = (state.botActionsLog || []).slice(-MAX_BOT_ACTIONS_LOG);

  const world: ClassWorldState = removeUndefined({
    technologies: state.technologies || {},
    regions:
      state.regions ||
      REGIONS.map((r) => ({
        name: r,
        sales: {},
        controlPoints: {},
      })),
    patents: state.patents || {},
    regionLogistics: state.regionLogistics || {},
    teamResearchProgress: state.teamResearchProgress || {},
    teamLogisticsProgress: state.teamLogisticsProgress || {},
    improvementCards: state.improvementCards || [],
    improvementPoolByRound: state.improvementPoolByRound || {},
    researchAllocatedByRound: state.researchAllocatedByRound || {},
    logisticsAllocatedByRound: state.logisticsAllocatedByRound || {},
    advancedState: state.advancedState,
    marksSnapshots: state.marksSnapshots,
    botActionsLog: cappedBotLog,
    stateVersion: state.stateVersion ?? 1,
    updatedAt: updatedIso,
  });

  const rounds: Record<number, RoundData> = {};
  (state.rounds || []).forEach((r) => {
    const cleanRound: RoundData = {
      roundNumber: r.roundNumber,
      teamData: { ...(r.teamData || {}) },
    };
    rounds[r.roundNumber] = removeUndefined(cleanRound);
  });

  return { control, world, rounds };
}

/**
 * Reconstructs the `GameState` shape expected by dashboard & viewer components
 * from `state/control`, `state/world`, `rounds/*`, and any visible `plans/*`.
 */
export function assembleGameState(params: {
  classId: string;
  teams: Team[];
  themeId?: GameThemeId;
  control: ClassControlState | null;
  world: ClassWorldState | null;
  rounds: Record<number, RoundData>;
  visiblePlans?: Record<string, TeamPlanDoc>;
}): GameState | null {
  const { classId, teams, themeId, control, world, rounds, visiblePlans } = params;
  if (!control || !world) return null;

  const roundMap: Record<number, RoundData> = {};
  Object.entries(rounds || {}).forEach(([rKey, rVal]) => {
    const rNum = Number(rKey) || rVal.roundNumber;
    roundMap[rNum] = {
      roundNumber: rNum,
      teamData: { ...(rVal.teamData || {}) },
    };
  });

  // Overlay visible plans (e.g. during planning phase before reveal)
  if (visiblePlans) {
    Object.values(visiblePlans).forEach((plan) => {
      if (!plan || !plan.round || !plan.teamId) return;
      const rNum = plan.round;
      if (!roundMap[rNum]) {
        roundMap[rNum] = { roundNumber: rNum, teamData: {} };
      }
      const existing = roundMap[rNum].teamData[plan.teamId];
      // Only overlay if round doc doesn't already have revealed data for this team
      if (!existing || normalizePhaseName(control.currentPhase) === 'planning') {
        const planAsTeamData: TeamRoundData = {
          teamId: plan.teamId,
          combination: plan.combination,
          position: plan.position,
          price: plan.price,
          productsProduced: plan.productsProduced,
          improvementCards: plan.improvementCards,
          researchIcons: plan.researchIcons,
          logisticsIcons: plan.logisticsIcons,
          cardUsages: plan.cardUsages,
          improvementCardUsage: plan.improvementCardUsage,
          improvementCardId: plan.improvementCardId,
          revenue: existing?.revenue ?? 0,
          technologiesResearched: existing?.technologiesResearched ?? [],
          expansionLocations: existing?.expansionLocations ?? [],
          salesByRegion: existing?.salesByRegion ?? {},
          regionControlPoints: existing?.regionControlPoints ?? {},
          controlValue: existing?.controlValue ?? 0,
          totalMoney: existing?.totalMoney ?? 0,
          customersSold: existing?.customersSold,
          nfcSalesUnits: existing?.nfcSalesUnits,
        };
        roundMap[rNum].teamData[plan.teamId] = planAsTeamData;
      }
    });
  }

  const sortedRounds = Object.values(roundMap).sort((a, b) => a.roundNumber - b.roundNumber);

  return {
    gameId: control.gameId || classId,
    themeId: control.themeId ?? themeId ?? DEFAULT_GAME_THEME_ID,
    teams,
    currentRound: control.currentRound || 1,
    currentPhase: normalizePhaseName(control.currentPhase),
    rounds: sortedRounds,
    technologies: world.technologies || {},
    regions:
      world.regions ||
      REGIONS.map((r) => ({
        name: r,
        sales: {},
        controlPoints: {},
      })),
    patents: world.patents || {},
    improvementCards: world.improvementCards || [],
    improvementPoolByRound: world.improvementPoolByRound || {},
    teamResearchProgress: world.teamResearchProgress || {},
    researchAllocatedByRound: world.researchAllocatedByRound || {},
    regionLogistics: world.regionLogistics || {},
    teamLogisticsProgress: world.teamLogisticsProgress || {},
    logisticsAllocatedByRound: world.logisticsAllocatedByRound || {},
    combinationsData: control.combinationsData,
    ruleAdjustments: control.ruleAdjustments,
    advancedState: world.advancedState,
    teamLabelMode: control.teamLabelMode,
    createdAt: toValidDate(control.createdAt),
    updatedAt: toValidDate(control.updatedAt || world.updatedAt),
    botConfig: control.botConfig,
    botThinking: control.botThinking || {},
    botActionsLog: world.botActionsLog || [],
    gameEnded: Boolean(control.gameEnded),
    stateVersion: control.stateVersion ?? 1,
    schemaVersion: 2,
    turn: control.turn,
    refereeHeartbeatAt: control.refereeHeartbeatAt,
    planSubmittedByRound: control.planSubmittedByRound,
    marksSnapshots: world.marksSnapshots,
  };
}

/**
 * Transactional mutator for `classes/{classId}/state/control`.
 * Reads fresh state inside transaction, bumps `stateVersion`, never writes a React snapshot.
 */
export async function mutateControl(
  classId: string,
  updater: (fresh: ClassControlState) => ClassControlState | null
): Promise<ClassControlState | null> {
  const ref = doc(db, 'classes', classId, 'state', 'control');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const fresh = snap.data() as ClassControlState;
    const next = updater(fresh);
    if (!next) return null;

    const updated: ClassControlState = removeUndefined({
      ...next,
      currentPhase: normalizePhaseName(next.currentPhase),
      stateVersion: (fresh.stateVersion ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    });
    tx.set(ref, updated);
    return updated;
  });
}

/**
 * Transactional mutator for `classes/{classId}/state/world`.
 * Reads fresh state inside transaction, bumps `stateVersion`, never writes a React snapshot.
 */
export async function mutateWorld(
  classId: string,
  updater: (fresh: ClassWorldState) => ClassWorldState | null
): Promise<ClassWorldState | null> {
  const ref = doc(db, 'classes', classId, 'state', 'world');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const fresh = snap.data() as ClassWorldState;
    const next = updater(fresh);
    if (!next) return null;

    const updated: ClassWorldState = removeUndefined({
      ...next,
      botActionsLog: (next.botActionsLog || []).slice(-MAX_BOT_ACTIONS_LOG),
      stateVersion: (fresh.stateVersion ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    });
    tx.set(ref, updated);
    return updated;
  });
}

/**
 * Transactional mutator for `classes/{classId}/rounds/{roundNumber}`.
 */
export async function mutateRound(
  classId: string,
  roundNumber: number,
  updater: (fresh: RoundData) => RoundData | null
): Promise<RoundData | null> {
  const ref = doc(db, 'classes', classId, 'rounds', String(roundNumber));
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const fresh: RoundData = snap.exists()
      ? (snap.data() as RoundData)
      : { roundNumber, teamData: {} };
    const next = updater(fresh);
    if (!next) return null;

    const clean: RoundData = removeUndefined({
      roundNumber,
      teamData: next.teamData || {},
    });
    tx.set(ref, clean);
    return clean;
  });
}

interface V2LiveCacheEntry {
  control?: ClassControlState | null;
  world?: ClassWorldState | null;
  rounds?: Record<number, RoundData>;
}

const v2LiveStateCache = new Map<string, V2LiveCacheEntry>();

/**
 * Updates the in-memory live snapshot cache for a v2 class so transactions can
 * skip reading historical/non-existent round documents over the network.
 */
export function updateV2LiveStateCache(
  classId: string,
  partial: Partial<V2LiveCacheEntry>
): void {
  if (!classId) return;
  const existing = v2LiveStateCache.get(classId) || {};
  v2LiveStateCache.set(classId, { ...existing, ...partial });
}

/**
 * Helper to read v2 game state documents inside an active Firestore `Transaction`.
 * When the live `onSnapshot` cache is warm for `classId`, reads only `control`, `world`,
 * and the active round document (`rounds/{currentRound}`) — 3 `tx.get` calls instead of 7 —
 * while merging completed historical rounds from cache.
 */
export async function readV2StateInTransaction(
  tx: Transaction,
  classId: string,
  teams: Team[],
  themeId?: GameThemeId
): Promise<GameState | null> {
  const controlRef = doc(db, 'classes', classId, 'state', 'control');
  const worldRef = doc(db, 'classes', classId, 'state', 'world');

  const cached = v2LiveStateCache.get(classId);
  const cachedCurrentRound = cached?.control?.currentRound;

  if (cachedCurrentRound && cachedCurrentRound >= 1 && cachedCurrentRound <= 5 && cached?.rounds) {
    const activeRoundRef = doc(db, 'classes', classId, 'rounds', String(cachedCurrentRound));
    const [controlSnap, worldSnap, activeRoundSnap] = await Promise.all([
      tx.get(controlRef),
      tx.get(worldRef),
      tx.get(activeRoundRef),
    ]);

    if (!controlSnap.exists() || !worldSnap.exists()) return null;

    const controlData = controlSnap.data() as ClassControlState;
    const worldData = worldSnap.data() as ClassWorldState;
    const serverRound = controlData.currentRound || 1;
    const rounds: Record<number, RoundData> = {};

    // Copy completed historical rounds (< serverRound) from live cache
    Object.entries(cached.rounds).forEach(([rKey, rVal]) => {
      const rNum = Number(rKey);
      if (rNum >= 1 && rNum < serverRound && rVal) {
        rounds[rNum] = rVal;
      }
    });

    if (activeRoundSnap.exists() && cachedCurrentRound <= serverRound) {
      rounds[cachedCurrentRound] = activeRoundSnap.data() as RoundData;
    }

    // If the server's currentRound differs from cachedCurrentRound, read the server's active round doc
    if (serverRound !== cachedCurrentRound && serverRound >= 1 && serverRound <= 5) {
      const serverRoundSnap = await tx.get(
        doc(db, 'classes', classId, 'rounds', String(serverRound))
      );
      if (serverRoundSnap.exists()) {
        rounds[serverRound] = serverRoundSnap.data() as RoundData;
      }
    }

    return assembleGameState({
      classId,
      teams,
      themeId,
      control: controlData,
      world: worldData,
      rounds,
    });
  }

  const roundRefs = [1, 2, 3, 4, 5].map((r) => doc(db, 'classes', classId, 'rounds', String(r)));

  const [controlSnap, worldSnap, ...roundSnaps] = await Promise.all([
    tx.get(controlRef),
    tx.get(worldRef),
    ...roundRefs.map((r) => tx.get(r)),
  ]);

  if (!controlSnap.exists() || !worldSnap.exists()) return null;

  const rounds: Record<number, RoundData> = {};
  roundSnaps.forEach((rSnap, idx) => {
    if (rSnap.exists()) {
      const rNum = idx + 1;
      rounds[rNum] = rSnap.data() as RoundData;
    }
  });

  return assembleGameState({
    classId,
    teams,
    themeId,
    control: controlSnap.data() as ClassControlState,
    world: worldSnap.data() as ClassWorldState,
    rounds,
  });
}

/**
 * Helper to write a modified `GameState` back to `control`, `world`, and changed `rounds/*`
 * inside an active Firestore `Transaction`.
 */
export function writeV2StateInTransaction(
  tx: Transaction,
  classId: string,
  nextState: GameState,
  prevVersion = 1,
  prevState?: GameState | null
): number {
  const nextVersion = prevVersion + 1;
  const stamped: GameState = {
    ...nextState,
    stateVersion: nextVersion,
    updatedAt: new Date(),
  };

  const { control, world, rounds } = splitGameState(stamped);
  const prevSplit = prevState ? splitGameState(prevState) : null;

  tx.set(doc(db, 'classes', classId, 'state', 'control'), control);

  const worldChanged =
    !prevSplit ||
    JSON.stringify({ ...prevSplit.world, stateVersion: 0, updatedAt: '' }) !==
      JSON.stringify({ ...world, stateVersion: 0, updatedAt: '' });

  if (worldChanged) {
    tx.set(doc(db, 'classes', classId, 'state', 'world'), world);
  }

  Object.entries(rounds).forEach(([rKey, roundDoc]) => {
    const rNum = Number(rKey);
    const prevRoundDoc = prevSplit?.rounds?.[rNum];
    if (!prevRoundDoc || JSON.stringify(prevRoundDoc) !== JSON.stringify(roundDoc)) {
      tx.set(doc(db, 'classes', classId, 'rounds', String(rKey)), roundDoc);
    }
  });

  if (prevSplit?.rounds) {
    Object.keys(prevSplit.rounds).forEach((prevRKey) => {
      if (!rounds[Number(prevRKey)]) {
        tx.delete(doc(db, 'classes', classId, 'rounds', String(prevRKey)));
      }
    });
  }

  updateV2LiveStateCache(classId, { control, world, rounds });

  return nextVersion;
}

/**
 * Full transactional read-modify-write across `control`, `world`, and `rounds/*` for v2 classes.
 * Never writes a React snapshot.
 */
export async function mutateV2GameState(
  classId: string,
  teams: Team[],
  themeId: GameThemeId | undefined,
  updater: (fresh: GameState) => GameState | null
): Promise<GameState | null> {
  return runTransaction(db, async (tx) => {
    const fresh = await readV2StateInTransaction(tx, classId, teams, themeId);
    if (!fresh) return null;

    const next = updater(fresh);
    if (!next) return null;

    writeV2StateInTransaction(tx, classId, next, fresh.stateVersion ?? 1, fresh);
    return next;
  });
}
