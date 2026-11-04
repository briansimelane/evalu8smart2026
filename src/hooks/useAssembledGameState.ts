import { useState, useEffect, useMemo } from 'react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  GameState,
  Team,
  ClassControlState,
  ClassWorldState,
  RoundData,
  TeamPlanDoc,
  TeamActionDoc,
  UserRole,
} from '@/types/game';
import { GameThemeId } from '@/lib/gameTheme';
import { assembleGameState, updateV2LiveStateCache } from '@/lib/v2State';
import { normalizePhaseName } from '@/lib/turnOrder';

export interface UseAssembledGameStateOptions {
  classId: string | null;
  enabled: boolean;
  teams: Team[];
  themeId?: GameThemeId;
  role?: UserRole | null;
  teamId?: string | null;
  authUid?: string | null;
  viewerOnly?: boolean;
}

export function useAssembledGameState({
  classId,
  enabled,
  teams,
  themeId,
  role,
  teamId,
  authUid,
  viewerOnly = false,
}: UseAssembledGameStateOptions): {
  gameState: GameState | null;
  isLoaded: boolean;
  actionsMap: Record<string, TeamActionDoc>;
} {
  const [control, setControl] = useState<ClassControlState | null>(null);
  const [world, setWorld] = useState<ClassWorldState | null>(null);
  const [rounds, setRounds] = useState<Record<number, RoundData>>({});
  const [visiblePlans, setVisiblePlans] = useState<Record<string, TeamPlanDoc>>({});
  const [actionsMap, setActionsMap] = useState<Record<string, TeamActionDoc>>({});
  const [controlLoaded, setControlLoaded] = useState(false);
  const [worldLoaded, setWorldLoaded] = useState(false);

  const isFacilitator = role === 'FACILITATOR' || role === 'ADMIN';

  // Subscribe to control, world, and rounds
  useEffect(() => {
    if (!enabled || !classId) {
      setControl(null);
      setWorld(null);
      setRounds({});
      setVisiblePlans({});
      setActionsMap({});
      setControlLoaded(false);
      setWorldLoaded(false);
      return;
    }

    setControlLoaded(false);
    setWorldLoaded(false);

    const unsubControl = onSnapshot(
      doc(db, 'classes', classId, 'state', 'control'),
      (snap) => {
        const ctl = snap.exists() ? (snap.data() as ClassControlState) : null;
        setControl(ctl);
        updateV2LiveStateCache(classId, { control: ctl });
        setControlLoaded(true);
      },
      (err) => {
        console.warn('v2 control listener error:', err);
        setControlLoaded(true);
      }
    );

    const unsubWorld = onSnapshot(
      doc(db, 'classes', classId, 'state', 'world'),
      (snap) => {
        const wrld = snap.exists() ? (snap.data() as ClassWorldState) : null;
        setWorld(wrld);
        updateV2LiveStateCache(classId, { world: wrld });
        setWorldLoaded(true);
      },
      (err) => {
        console.warn('v2 world listener error:', err);
        setWorldLoaded(true);
      }
    );

    const unsubRounds = onSnapshot(
      collection(db, 'classes', classId, 'rounds'),
      (snap) => {
        const nextRounds: Record<number, RoundData> = {};
        snap.forEach((d) => {
          const data = d.data() as RoundData;
          const rNum = Number(d.id) || data.roundNumber;
          nextRounds[rNum] = data;
        });
        setRounds(nextRounds);
        updateV2LiveStateCache(classId, { rounds: nextRounds });
      },
      (err) => {
        console.warn('v2 rounds listener error:', err);
      }
    );

    return () => {
      unsubControl();
      unsubWorld();
      unsubRounds();
    };
  }, [classId, enabled, authUid]);

  // Subscribe to visible plans (owner sees all plans; student sees own team's plan; viewer reads none)
  const currentRound = control?.currentRound || 1;
  const currentPhase = normalizePhaseName(control?.currentPhase);

  useEffect(() => {
    if (!enabled || !classId || viewerOnly) {
      setVisiblePlans({});
      return;
    }

    if (isFacilitator) {
      const unsubPlans = onSnapshot(
        collection(db, 'classes', classId, 'plans'),
        (snap) => {
          const map: Record<string, TeamPlanDoc> = {};
          snap.forEach((d) => {
            map[d.id] = d.data() as TeamPlanDoc;
          });
          setVisiblePlans(map);
        },
        (err) => {
          console.warn('v2 facilitator plans listener error:', err);
        }
      );
      return () => unsubPlans();
    }

    if (role === 'STUDENT' && teamId) {
      const planId = `${currentRound}_${teamId}`;
      const unsubMyPlan = onSnapshot(
        doc(db, 'classes', classId, 'plans', planId),
        (snap) => {
          setVisiblePlans((prev) => {
            const next = { ...prev };
            if (snap.exists()) {
              next[planId] = snap.data() as TeamPlanDoc;
            } else {
              delete next[planId];
            }
            return next;
          });
        },
        (err) => {
          console.warn('v2 student plan listener error:', err);
        }
      );
      return () => unsubMyPlan();
    }
  }, [classId, enabled, viewerOnly, isFacilitator, role, teamId, currentRound, authUid]);

  // Subscribe to actions (facilitator sees all; student sees own action for active round/phase)
  useEffect(() => {
    if (!enabled || !classId || viewerOnly) {
      setActionsMap({});
      return;
    }

    if (isFacilitator) {
      const unsubActions = onSnapshot(
        collection(db, 'classes', classId, 'actions'),
        (snap) => {
          const map: Record<string, TeamActionDoc> = {};
          snap.forEach((d) => {
            map[d.id] = d.data() as TeamActionDoc;
          });
          setActionsMap(map);
        },
        (err) => {
          console.warn('v2 facilitator actions listener error:', err);
        }
      );
      return () => unsubActions();
    }

    if (role === 'STUDENT' && teamId && currentPhase !== 'planning') {
      const actionId = `${currentRound}_${currentPhase}_${teamId}`;
      const unsubMyAction = onSnapshot(
        doc(db, 'classes', classId, 'actions', actionId),
        (snap) => {
          setActionsMap((prev) => {
            const next = { ...prev };
            if (snap.exists()) {
              next[actionId] = snap.data() as TeamActionDoc;
            } else {
              delete next[actionId];
            }
            return next;
          });
        },
        (err) => {
          console.warn('v2 student action listener error:', err);
        }
      );
      return () => unsubMyAction();
    }
  }, [classId, enabled, viewerOnly, isFacilitator, role, teamId, currentRound, currentPhase, authUid]);

  const gameState = useMemo(() => {
    if (!enabled || !classId) return null;

    let effectiveRounds = rounds;
    let effectiveControl = control;

    // During the planning phase, mask any opponent team entries that may exist in rounds/{currentRound}
    // for non-facilitator views, while preserving their submission status in planSubmittedByRound.
    if (!isFacilitator && currentPhase === 'planning') {
      const currentRoundDoc = rounds[currentRound];
      const currentTeamData = currentRoundDoc?.teamData;
      if (currentTeamData && Object.keys(currentTeamData).length > 0) {
        const submittedMap: Record<string, boolean> = {
          ...(control?.planSubmittedByRound?.[currentRound] || {}),
        };
        const maskedTeamData: typeof currentTeamData = {};
        for (const [tid, tData] of Object.entries(currentTeamData)) {
          submittedMap[tid] = true;
          if (!viewerOnly && teamId && tid === teamId) {
            maskedTeamData[tid] = tData;
          }
        }
        effectiveRounds = {
          ...rounds,
          [currentRound]: {
            ...currentRoundDoc,
            teamData: maskedTeamData,
          },
        };
        if (control) {
          effectiveControl = {
            ...control,
            planSubmittedByRound: {
              ...(control.planSubmittedByRound || {}),
              [currentRound]: submittedMap,
            },
          };
        }
      }
    }

    return assembleGameState({
      classId,
      teams,
      themeId,
      control: effectiveControl,
      world,
      rounds: effectiveRounds,
      visiblePlans,
    });
  }, [enabled, classId, teams, themeId, control, world, rounds, visiblePlans, isFacilitator, viewerOnly, teamId, currentRound, currentPhase]);

  return {
    gameState,
    isLoaded: !enabled || (controlLoaded && worldLoaded),
    actionsMap,
  };
}
