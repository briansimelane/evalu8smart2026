import { runTransaction, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GameState } from '@/types/game';
import { removeUndefined, safeIsoString } from '@/lib/utils';

export type WorldMutator = (fresh: GameState) => GameState | null; // return null = no-op

export interface MutateWorldOptions {
  expectPhase?: string;
  expectRound?: number;
}

export type MutateWorldResult = 
  | { skipped: null; version: number }
  | { skipped: 'phase-moved' | 'round-moved' | 'noop' };

/** Reads the live document inside transaction, applies `mutate` to FRESH state,
 *  bumps stateVersion, writes. Never writes a React snapshot. */
export async function mutateWorldState(
  classId: string,
  mutate: WorldMutator,
  opts?: MutateWorldOptions
): Promise<MutateWorldResult> {
  const ref = doc(db, 'classes', classId, 'state', 'game');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
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
    tx.set(ref, { gameState: safeState }, { merge: true });

    return { skipped: null, version: next.stateVersion };
  });
}
