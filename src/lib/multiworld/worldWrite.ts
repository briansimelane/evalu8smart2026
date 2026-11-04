import { runTransaction, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GameState, SimulationClass, Team, TeamPlanDoc } from '@/types/game';
import { removeUndefined, safeIsoString } from '@/lib/utils';
import {
  readV2StateInTransaction,
  writeV2StateInTransaction,
} from '@/lib/v2State';
import { computeTurnOrder, normalizePhaseName } from '@/lib/turnOrder';
import { resolvePlan } from '@/lib/referee/resolvers';

export type WorldMutator = (fresh: GameState) => GameState | null; // return null = no-op

export interface MutateWorldOptions {
  expectPhase?: string;
  expectRound?: number;
}

export type MutateWorldResult =
  | { skipped: null; version: number }
  | { skipped: 'phase-moved' | 'round-moved' | 'noop' };

/**
 * Reads the live document(s) inside a transaction, applies `mutate` to FRESH state,
 * bumps `stateVersion`, and writes. Supports both Legacy (`schemaVersion: 1` -> `state/game`)
 * and V2 (`schemaVersion: 2` -> `state/control` + `state/world` + `rounds/*`).
 * Never writes a React snapshot.
 */
export async function mutateWorldState(
  classId: string,
  mutate: WorldMutator,
  opts?: MutateWorldOptions
): Promise<MutateWorldResult> {
  const classRef = doc(db, 'classes', classId);
  const legacyRef = doc(db, 'classes', classId, 'state', 'game');
  const controlRef = doc(db, 'classes', classId, 'state', 'control');

  return runTransaction(db, async (tx) => {
    const [classSnap, controlSnap] = await Promise.all([
      tx.get(classRef),
      tx.get(controlRef),
    ]);

    const classData = classSnap.exists() ? (classSnap.data() as SimulationClass) : null;
    const isV2 = classData?.schemaVersion === 2 || controlSnap.exists();

    if (isV2) {
      const rawTeams = classData?.teams || classData?.teamRegistry || [];
      const teams: Team[] = rawTeams.map((t, idx) => ({
        id: t.id || `team_${idx + 1}`,
        name: t.name,
        color: t.color,
        isBot: !!t.isBot,
        botProfile: t.botProfile,
        botDifficulty: t.botDifficulty,
        teamNumber: t.teamNumber ?? idx + 1,
      }));

      let fresh = await readV2StateInTransaction(tx, classId, teams, classData?.themeId);
      if (!fresh) throw new Error(`V2 World ${classId} has no game state`);

      if (opts?.expectPhase) {
        const freshPhase = normalizePhaseName(fresh.currentPhase);
        const expPhase = normalizePhaseName(opts.expectPhase);
        if (freshPhase !== expPhase) {
          return { skipped: 'phase-moved' as const };
        }
      }

      if (opts?.expectRound !== undefined && fresh.currentRound !== opts.expectRound) {
        return { skipped: 'round-moved' as const };
      }

      // If in planning phase, also read sealed plans for currentRound so reveal/advance includes them
      if (normalizePhaseName(fresh.currentPhase) === 'planning') {
        const rNum = fresh.currentRound || 1;
        const planRefs = teams.map((t) =>
          doc(db, 'classes', classId, 'plans', `${rNum}_${t.id}`)
        );
        const planSnaps = await Promise.all(planRefs.map((r) => tx.get(r)));
        for (const pSnap of planSnaps) {
          if (pSnap.exists()) {
            const plan = pSnap.data() as TeamPlanDoc;
            const res = resolvePlan(fresh, rNum, plan.teamId, plan);
            if (res.valid) {
              fresh = res.nextState;
            }
          }
        }
      }

      const next = mutate(fresh);
      if (!next) return { skipped: 'noop' as const };

      const prevPhase = normalizePhaseName(fresh.currentPhase);
      const nextPhase = normalizePhaseName(next.currentPhase);
      if (prevPhase !== nextPhase || fresh.currentRound !== next.currentRound || !next.turn) {
        next.turn = computeTurnOrder(next, nextPhase);
      }

      const version = writeV2StateInTransaction(tx, classId, next, fresh.stateVersion ?? 1, fresh);
      return { skipped: null, version };
    }

    // Legacy v1 path (`state/game`)
    const snap = await tx.get(legacyRef);
    const fresh = snap.data()?.gameState as GameState | undefined;
    if (!fresh) throw new Error(`World ${classId} has no game state`);

    if (opts?.expectPhase) {
      const freshPhase = (fresh.currentPhase || 'planning').toLowerCase();
      const expPhase = opts.expectPhase.toLowerCase();
      if (freshPhase !== expPhase) {
        return { skipped: 'phase-moved' as const };
      }
    }

    if (opts?.expectRound !== undefined && fresh.currentRound !== opts.expectRound) {
      return { skipped: 'round-moved' as const };
    }

    const next = mutate(fresh);
    if (!next) return { skipped: 'noop' as const };

    next.stateVersion = (fresh.stateVersion ?? 0) + 1;
    next.createdAt = safeIsoString(fresh.createdAt) as any;
    next.updatedAt = safeIsoString(new Date()) as any;

    const safeState = removeUndefined(next);
    tx.set(legacyRef, { gameState: safeState }, { merge: true });

    return { skipped: null, version: next.stateVersion };
  });
}
