import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MultiWorldSession, WorldKey } from '@/types/multiworld';
import {
  SimulationClass,
  GameState,
  ClassControlState,
  ClassWorldState,
  RoundData,
  TeamPlanDoc,
  Team,
  JoinCodeDoc,
} from '@/types/game';
import { toValidDate } from '@/lib/utils';
import { normaliseSession } from '@/lib/multiworld/normaliseSession';
import { assembleGameState } from '@/lib/v2State';
import { ensureSignedIn } from '@/demo/demoAuth';

export interface WorldSubState {
  key: WorldKey;
  classId: string;
  label: string;
  teamCount: number;
  classData: SimulationClass | null;
  gameState: GameState | null;
}

interface V2Parts {
  classData: SimulationClass | null;
  control: ClassControlState | null;
  world: ClassWorldState | null;
  rounds: Record<number, RoundData>;
  plans: Record<string, TeamPlanDoc>;
  seats?: Record<string, { ceoName?: string }>;
}

export function useMultiWorldSession(sessionIdOrCode: string) {
  const [session, setSession] = useState<MultiWorldSession | null>(null);
  const [worldStates, setWorldStates] = useState<
    Record<string, { classData: SimulationClass | null; gameState: GameState | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubscribes = useRef<Record<string, () => void>>({});
  const v2PartsRef = useRef<Record<string, V2Parts>>({});

  useEffect(() => {
    if (!sessionIdOrCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubSession: (() => void) | null = null;

    const rebuildV2WorldState = (classId: string) => {
      const parts = v2PartsRef.current[classId];
      if (!parts || !parts.classData) return;

      const rawTeams = parts.classData.teams || parts.classData.teamRegistry || [];
      const teams: Team[] = rawTeams.map((t, idx) => ({
        id: t.id || `team_${idx + 1}`,
        name: t.name,
        color: t.color,
        ceoName: parts.seats?.[t.id || `team_${idx + 1}`]?.ceoName || t.ceoName,
        isBot: !!t.isBot,
        botProfile: t.botProfile,
        botDifficulty: t.botDifficulty,
        teamNumber: t.teamNumber ?? idx + 1,
      }));

      const assembled = assembleGameState({
        classId,
        teams,
        themeId: parts.classData.themeId,
        control: parts.control,
        world: parts.world,
        rounds: parts.rounds,
        visiblePlans: parts.plans,
      });

      setWorldStates((prev) => ({
        ...prev,
        [classId]: {
          classData: parts.classData,
          gameState: assembled,
        },
      }));
    };

    const findAndSubscribeSession = async () => {
      try {
        await ensureSignedIn().catch(() => {});

        let realSessionId: string | null = null;
        const trimmed = sessionIdOrCode.trim();

        // 1. Check joinCodes/{CODE} first if it matches a joinCode
        const codeSnap = await getDoc(doc(db, 'joinCodes', trimmed.toUpperCase())).catch(
          () => null
        );
        if (codeSnap && codeSnap.exists()) {
          const jData = codeSnap.data() as JoinCodeDoc;
          if (jData.kind === 'multiworld' && jData.classId) {
            realSessionId = jData.classId;
          }
        }

        // 2. Check direct multiworld_sessions/{id}
        if (!realSessionId) {
          const directRef = doc(db, 'multiworld_sessions', trimmed);
          const directSnap = await getDoc(directRef);
          if (directSnap.exists()) {
            realSessionId = trimmed;
          } else {
            const qSession = query(
              collection(db, 'multiworld_sessions'),
              where('sessionCode', '==', trimmed.toUpperCase())
            );
            const snapSession = await getDocs(qSession);
            if (!snapSession.empty) {
              realSessionId = snapSession.docs[0].id;
            }
          }
        }

        if (!realSessionId) {
          setError('Multi-world session not found. Please check the session code.');
          setLoading(false);
          return;
        }

        const sessionRef = doc(db, 'multiworld_sessions', realSessionId);
        unsubSession = onSnapshot(
          sessionRef,
          (snap) => {
            if (snap.exists()) {
              const raw = { id: snap.id, ...snap.data() };
              const norm = normaliseSession(raw);
              setSession(norm);

              const currentClassIds = new Set(norm.worlds.map((w) => w.classId));

              Object.keys(unsubscribes.current).forEach((key) => {
                const classId = key.replace(/^(class|game|ctl|wld|rnd|pln)_/, '');
                if (!currentClassIds.has(classId)) {
                  unsubscribes.current[key]();
                  delete unsubscribes.current[key];
                }
              });

              norm.worlds.forEach((w) => {
                const classId = w.classId;
                const classSubKey = `class_${classId}`;

                if (!unsubscribes.current[classSubKey]) {
                  const classRef = doc(db, 'classes', classId);
                  unsubscribes.current[classSubKey] = onSnapshot(classRef, (cSnap) => {
                    const classData = cSnap.exists()
                      ? ({ id: cSnap.id, ...cSnap.data() } as SimulationClass)
                      : null;

                    if (classData?.schemaVersion === 2) {
                      if (!v2PartsRef.current[classId]) {
                        v2PartsRef.current[classId] = {
                          classData,
                          control: null,
                          world: null,
                          rounds: {},
                          plans: {},
                        };
                      } else {
                        v2PartsRef.current[classId].classData = classData;
                      }
                      rebuildV2WorldState(classId);

                      if (!unsubscribes.current[`ctl_${classId}`]) {
                        unsubscribes.current[`ctl_${classId}`] = onSnapshot(
                          doc(db, 'classes', classId, 'state', 'control'),
                          (ctlSnap) => {
                            if (v2PartsRef.current[classId]) {
                              v2PartsRef.current[classId].control = ctlSnap.exists()
                                ? (ctlSnap.data() as ClassControlState)
                                : null;
                              rebuildV2WorldState(classId);
                            }
                          }
                        );
                      }
                      if (!unsubscribes.current[`wld_${classId}`]) {
                        unsubscribes.current[`wld_${classId}`] = onSnapshot(
                          doc(db, 'classes', classId, 'state', 'world'),
                          (wldSnap) => {
                            if (v2PartsRef.current[classId]) {
                              v2PartsRef.current[classId].world = wldSnap.exists()
                                ? (wldSnap.data() as ClassWorldState)
                                : null;
                              rebuildV2WorldState(classId);
                            }
                          }
                        );
                      }
                      if (!unsubscribes.current[`rnd_${classId}`]) {
                        unsubscribes.current[`rnd_${classId}`] = onSnapshot(
                          collection(db, 'classes', classId, 'rounds'),
                          (rndSnap) => {
                            if (v2PartsRef.current[classId]) {
                              const rMap: Record<number, RoundData> = {};
                              rndSnap.forEach((d) => {
                                const rData = d.data() as RoundData;
                                const rNum = Number(d.id) || rData.roundNumber;
                                rMap[rNum] = rData;
                              });
                              v2PartsRef.current[classId].rounds = rMap;
                              rebuildV2WorldState(classId);
                            }
                          }
                        );
                      }
                      if (!unsubscribes.current[`pln_${classId}`]) {
                        unsubscribes.current[`pln_${classId}`] = onSnapshot(
                          collection(db, 'classes', classId, 'plans'),
                          (plnSnap) => {
                            if (v2PartsRef.current[classId]) {
                              const pMap: Record<string, TeamPlanDoc> = {};
                              plnSnap.forEach((d) => {
                                pMap[d.id] = d.data() as TeamPlanDoc;
                              });
                              v2PartsRef.current[classId].plans = pMap;
                              rebuildV2WorldState(classId);
                            }
                          },
                          () => {
                            // Viewers cannot list plans; ignore permission warning on viewer screen
                          }
                        );
                      }
                      if (!unsubscribes.current[`seat_${classId}`]) {
                        unsubscribes.current[`seat_${classId}`] = onSnapshot(
                          collection(db, 'classes', classId, 'seats'),
                          (seatSnap) => {
                            if (v2PartsRef.current[classId]) {
                              const sMap: Record<string, { ceoName?: string }> = {};
                              seatSnap.forEach((d) => {
                                sMap[d.id] = d.data() as { ceoName?: string };
                              });
                              v2PartsRef.current[classId].seats = sMap;
                              rebuildV2WorldState(classId);
                            }
                          },
                          () => {}
                        );
                      }
                    } else {
                      setWorldStates((prev) => ({
                        ...prev,
                        [classId]: { ...(prev[classId] || { gameState: null }), classData },
                      }));

                      const gameSubKey = `game_${classId}`;
                      if (!unsubscribes.current[gameSubKey]) {
                        const gameRef = doc(db, 'classes', classId, 'state', 'game');
                        unsubscribes.current[gameSubKey] = onSnapshot(gameRef, (gSnap) => {
                          let gameState: GameState | null = null;
                          if (gSnap.exists()) {
                            const gState = gSnap.data()?.gameState as GameState;
                            if (gState) {
                              gState.createdAt = toValidDate(gState.createdAt);
                              gState.updatedAt = toValidDate(gState.updatedAt);
                              if (!gState.currentPhase) {
                                gState.currentPhase = 'planning';
                              }
                              if (classData?.teams) {
                                const ceoMap = new Map(classData.teams.map((t: any) => [t.id, t.ceoName]));
                                gState.teams = (gState.teams || []).map((t) => ({
                                  ...t,
                                  ceoName: t.ceoName || ceoMap.get(t.id),
                                }));
                              }
                              gameState = gState;
                            }
                          }
                          setWorldStates((prev) => ({
                            ...prev,
                            [classId]: { ...(prev[classId] || { classData: null }), gameState },
                          }));
                        });
                      }
                    }
                  });
                }
              });

              setLoading(false);
            } else {
              setError('Session was deleted.');
              setSession(null);
              setLoading(false);
            }
          },
          (err) => {
            console.error('Error subscribing to multiworld session:', err);
            setError(err.message || 'Error subscribing to multiworld session');
            setLoading(false);
          }
        );
      } catch (err: any) {
        console.error('useMultiWorldSession error:', err);
        setError(err.message || 'Error connecting to Firestore');
        setLoading(false);
      }
    };

    findAndSubscribeSession();

    return () => {
      if (unsubSession) unsubSession();
      Object.values(unsubscribes.current).forEach((unsub) => unsub());
      unsubscribes.current = {};
      v2PartsRef.current = {};
    };
  }, [sessionIdOrCode]);

  const updateAdvanceMode = async (mode: 'lockstep' | 'independent') => {
    if (!session) return;
    try {
      const sessionRef = doc(db, 'multiworld_sessions', session.id);
      await updateDoc(sessionRef, { advanceMode: mode });
    } catch (err) {
      console.error('Failed to update advanceMode:', err);
    }
  };

  const updateTeamLabelMode = async (mode: 'name' | 'code') => {
    if (!session) return;
    try {
      const sessionRef = doc(db, 'multiworld_sessions', session.id);
      await updateDoc(sessionRef, { teamLabelMode: mode });
    } catch (err) {
      console.error('Failed to update teamLabelMode:', err);
    }
  };

  const worlds: WorldSubState[] = (session?.worlds || []).map((w) => ({
    key: w.key,
    classId: w.classId,
    label: w.label,
    teamCount: w.teamCount || 5,
    classData: worldStates[w.classId]?.classData || null,
    gameState: worldStates[w.classId]?.gameState || null,
  }));

  const worldAClass = worlds.find((w) => w.key === 'A')?.classData || null;
  const worldBClass = worlds.find((w) => w.key === 'B')?.classData || null;
  const worldAGameState = worlds.find((w) => w.key === 'A')?.gameState || null;
  const worldBGameState = worlds.find((w) => w.key === 'B')?.gameState || null;

  return {
    session,
    worlds,
    worldAClass,
    worldBClass,
    worldAGameState,
    worldBGameState,
    loading,
    error,
    updateAdvanceMode,
    updateTeamLabelMode,
  };
}
