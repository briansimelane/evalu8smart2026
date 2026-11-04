import { useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Team, TeamActionDoc, TeamPlanDoc } from '@/types/game';
import { GameThemeId } from '@/lib/gameTheme';
import { applyRefereeActionTransaction } from '@/lib/referee/refereeEngine';
import { mutateControl } from '@/lib/v2State';

export interface UseRefereeOptions {
  classId: string | null;
  enabled: boolean;
  teams: Team[];
  themeId?: GameThemeId;
}

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Facilitator-mounted referee hook (`useReferee`).
 * Watches `classes/{classId}/actions` and resolves each unresolved action
 * via an idempotent Firestore transaction (`applyRefereeActionTransaction`).
 * Also writes a heartbeat to `state/control.refereeHeartbeatAt` so students
 * know a facilitator tab is actively refereeing the class.
 */
export function useReferee({ classId, enabled, teams, themeId }: UseRefereeOptions) {
  const inFlightRef = useRef<Set<string>>(new Set());
  const lastResolvedAtRef = useRef<number>(0);
  const teamsRef = useRef<Team[]>(teams);
  const themeRef = useRef<GameThemeId | undefined>(themeId);

  useEffect(() => {
    teamsRef.current = teams;
    themeRef.current = themeId;
  }, [teams, themeId]);

  // Periodic heartbeat on `state/control` (skips when an action is in-flight or was just resolved)
  useEffect(() => {
    if (!enabled || !classId) return;

    const controlRef = doc(db, 'classes', classId, 'state', 'control');
    const writeHeartbeat = (force = false) => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!force) {
        if (inFlightRef.current.size > 0) return;
        if (Date.now() - lastResolvedAtRef.current < 15_000) return;
      }
      updateDoc(controlRef, {
        refereeHeartbeatAt: new Date().toISOString(),
      }).catch(() => {});
    };

    writeHeartbeat(true);
    const intervalId = setInterval(() => writeHeartbeat(false), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [classId, enabled]);

  // Watch `actions` subcollection and resolve unresolved actions
  useEffect(() => {
    if (!enabled || !classId) return;

    const runActionResolution = async (actionId: string) => {
      await applyRefereeActionTransaction(
        classId,
        actionId,
        teamsRef.current,
        themeRef.current
      );
      lastResolvedAtRef.current = Date.now();
    };

    const unsub = onSnapshot(
      collection(db, 'classes', classId, 'actions'),
      (snap) => {
        snap.forEach((docSnap) => {
          const actionId = docSnap.id;
          const data = docSnap.data() as TeamActionDoc;
          if (data.status === 'applied' || data.status === 'rejected') {
            return;
          }
          // Make key depend on submittedAt so updated wildcard actions also re-resolve
          const flightKey = `${actionId}:${data.submittedAt || ''}`;
          if (inFlightRef.current.has(flightKey)) {
            return;
          }

          inFlightRef.current.add(flightKey);
          const lockName = `evalu8_referee_${classId}_${flightKey}`;

          const startResolution = async () => {
            // Give visible foreground tabs (e.g. Fullscreen Viewer) a 80ms head start
            // over hidden background tabs so background-tab throttling never holds the lock.
            if (typeof document !== 'undefined' && document.hidden) {
              await new Promise((r) => setTimeout(r, 80));
            }
            if (typeof navigator !== 'undefined' && navigator.locks?.request) {
              await navigator.locks.request(lockName, { ifAvailable: true }, async (lock) => {
                if (!lock) return;
                await runActionResolution(actionId);
              });
            } else {
              await runActionResolution(actionId);
            }
          };

          startResolution()
            .catch((err) => {
              console.warn(`Referee resolution warning for ${classId}/${actionId}:`, err);
            })
            .finally(() => {
              inFlightRef.current.delete(flightKey);
            });
        });
      },
      (err) => {
        console.warn(`useReferee listener warning for ${classId}:`, err);
      }
    );

    return () => unsub();
  }, [classId, enabled]);

  // Watch `plans` subcollection and sync `planSubmittedByRound` boolean flags to `state/control`
  // so students and the projector viewer can see which teams have submitted without seeing secret plans
  useEffect(() => {
    if (!enabled || !classId) return;

    const unsubPlans = onSnapshot(
      collection(db, 'classes', classId, 'plans'),
      (snap) => {
        if (typeof document !== 'undefined' && document.hidden) return;
        const planMap: Record<number, Record<string, boolean>> = {};
        snap.forEach((docSnap) => {
          const plan = docSnap.data() as TeamPlanDoc;
          if (plan?.round && plan?.teamId) {
            if (!planMap[plan.round]) planMap[plan.round] = {};
            planMap[plan.round][plan.teamId] = true;
          }
        });

        mutateControl(classId, (ctl) => {
          const current = ctl.planSubmittedByRound || {};
          let changed = false;
          const merged: Record<number, Record<string, boolean>> = { ...current };

          for (const [rStr, teamsObj] of Object.entries(planMap)) {
            const rNum = Number(rStr);
            const existingRound = { ...(merged[rNum] || {}) };
            for (const [tId, val] of Object.entries(teamsObj)) {
              if (existingRound[tId] !== val) {
                existingRound[tId] = val;
                changed = true;
              }
            }
            merged[rNum] = existingRound;
          }

          if (!changed) return null;
          return {
            ...ctl,
            planSubmittedByRound: merged,
          };
        }).catch(() => {});
      },
      (err) => {
        console.warn(`useReferee plans listener warning for ${classId}:`, err);
      }
    );

    return () => unsubPlans();
  }, [classId, enabled]);
}
