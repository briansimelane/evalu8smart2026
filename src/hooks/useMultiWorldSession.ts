import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MultiWorldSession, WorldKey } from '@/types/multiworld';
import { SimulationClass, GameState } from '@/types/game';
import { toValidDate } from '@/lib/utils';
import { normaliseSession } from '@/lib/multiworld/normaliseSession';

export interface WorldSubState {
  key: WorldKey;
  classId: string;
  label: string;
  teamCount: number;
  classData: SimulationClass | null;
  gameState: GameState | null;
}

export function useMultiWorldSession(sessionIdOrCode: string) {
  const [session, setSession] = useState<MultiWorldSession | null>(null);
  const [worldStates, setWorldStates] = useState<Record<string, { classData: SimulationClass | null; gameState: GameState | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubscribes = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!sessionIdOrCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubSession: (() => void) | null = null;

    const findAndSubscribeSession = async () => {
      try {
        let realSessionId: string | null = null;

        const directRef = doc(db, 'multiworld_sessions', sessionIdOrCode);
        const directSnap = await getDoc(directRef);

        if (directSnap.exists()) {
          realSessionId = sessionIdOrCode;
        } else {
          const qSession = query(
            collection(db, 'multiworld_sessions'),
            where('sessionCode', '==', sessionIdOrCode.toUpperCase())
          );
          const snapSession = await getDocs(qSession);
          if (!snapSession.empty) {
            realSessionId = snapSession.docs[0].id;
          }
        }

        if (!realSessionId) {
          setError('Multi-world session not found. Please check the session code.');
          setLoading(false);
          return;
        }

        const sessionRef = doc(db, 'multiworld_sessions', realSessionId);
        unsubSession = onSnapshot(sessionRef, (snap) => {
          if (snap.exists()) {
            const raw = { id: snap.id, ...snap.data() };
            const norm = normaliseSession(raw);
            setSession(norm);

            // Subscribe to each world's class and game state
            const currentClassIds = new Set(norm.worlds.map(w => w.classId));

            // Clean up obsolete subscriptions
            Object.keys(unsubscribes.current).forEach(key => {
              const classId = key.replace(/^(class|game)_/, '');
              if (!currentClassIds.has(classId)) {
                unsubscribes.current[key]();
                delete unsubscribes.current[key];
              }
            });

            norm.worlds.forEach(w => {
              const classId = w.classId;
              const classSubKey = `class_${classId}`;
              const gameSubKey = `game_${classId}`;

              if (!unsubscribes.current[classSubKey]) {
                const classRef = doc(db, 'classes', classId);
                unsubscribes.current[classSubKey] = onSnapshot(classRef, (cSnap) => {
                  const classData = cSnap.exists() ? ({ id: cSnap.id, ...cSnap.data() } as SimulationClass) : null;
                  setWorldStates(prev => ({
                    ...prev,
                    [classId]: { ...(prev[classId] || { gameState: null }), classData }
                  }));
                });
              }

              if (!unsubscribes.current[gameSubKey]) {
                const gameRef = doc(db, 'classes', classId, 'state', 'game');
                unsubscribes.current[gameSubKey] = onSnapshot(gameRef, (gSnap) => {
                  let gameState: GameState | null = null;
                  if (gSnap.exists()) {
                    const gState = gSnap.data()?.gameState as GameState;
                    if (gState) {
                      gState.createdAt = toValidDate(gState.createdAt);
                      gState.updatedAt = toValidDate(gState.updatedAt);
                      gameState = gState;
                    }
                  }
                  setWorldStates(prev => ({
                    ...prev,
                    [classId]: { ...(prev[classId] || { classData: null }), gameState }
                  }));
                });
              }
            });

            setLoading(false);
          } else {
            setError('Session was deleted.');
            setSession(null);
            setLoading(false);
          }
        }, (err) => {
          console.error("Error subscribing to multiworld session:", err);
          setError(err.message || 'Error subscribing to multiworld session');
          setLoading(false);
        });

      } catch (err: any) {
        console.error("useMultiWorldSession error:", err);
        setError(err.message || 'Error connecting to Firestore');
        setLoading(false);
      }
    };

    findAndSubscribeSession();

    return () => {
      if (unsubSession) unsubSession();
      Object.values(unsubscribes.current).forEach(unsub => unsub());
      unsubscribes.current = {};
    };
  }, [sessionIdOrCode]);

  const updateAdvanceMode = async (mode: 'lockstep' | 'independent') => {
    if (!session) return;
    try {
      const sessionRef = doc(db, 'multiworld_sessions', session.id);
      await updateDoc(sessionRef, { advanceMode: mode });
    } catch (err) {
      console.error("Failed to update advanceMode:", err);
    }
  };

  const updateTeamLabelMode = async (mode: 'name' | 'code') => {
    if (!session) return;
    try {
      const sessionRef = doc(db, 'multiworld_sessions', session.id);
      await updateDoc(sessionRef, { teamLabelMode: mode });
    } catch (err) {
      console.error("Failed to update teamLabelMode:", err);
    }
  };

  const worlds: WorldSubState[] = (session?.worlds || []).map(w => ({
    key: w.key,
    classId: w.classId,
    label: w.label,
    teamCount: w.teamCount || 5,
    classData: worldStates[w.classId]?.classData || null,
    gameState: worldStates[w.classId]?.gameState || null,
  }));

  // Backward compatibility getters for 2-world legacy code
  const worldAClass = worlds.find(w => w.key === 'A')?.classData || null;
  const worldBClass = worlds.find(w => w.key === 'B')?.classData || null;
  const worldAGameState = worlds.find(w => w.key === 'A')?.gameState || null;
  const worldBGameState = worlds.find(w => w.key === 'B')?.gameState || null;

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
    updateTeamLabelMode
  };
}
