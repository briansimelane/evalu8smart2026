import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MultiWorldSession } from '@/types/multiworld';
import { SimulationClass, GameState } from '@/types/game';
import { toValidDate } from '@/lib/utils';

export function useMultiWorldSession(sessionIdOrCode: string) {
  const [session, setSession] = useState<MultiWorldSession | null>(null);
  const [worldAClass, setWorldAClass] = useState<SimulationClass | null>(null);
  const [worldBClass, setWorldBClass] = useState<SimulationClass | null>(null);
  const [worldAGameState, setWorldAGameState] = useState<GameState | null>(null);
  const [worldBGameState, setWorldBGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionIdOrCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubSession: (() => void) | null = null;
    let unsubClassA: (() => void) | null = null;
    let unsubClassB: (() => void) | null = null;
    let unsubGameA: (() => void) | null = null;
    let unsubGameB: (() => void) | null = null;

    const findAndSubscribeSession = async () => {
      try {
        let realSessionId: string | null = null;

        // 1. Check if direct doc exists
        const directRef = doc(db, 'multiworld_sessions', sessionIdOrCode);
        const directSnap = await getDoc(directRef);

        if (directSnap.exists()) {
          realSessionId = sessionIdOrCode;
        } else {
          // 2. Query by sessionCode (case-insensitive)
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

        // Subscribe to multiworld session doc
        const sessionRef = doc(db, 'multiworld_sessions', realSessionId);
        unsubSession = onSnapshot(sessionRef, (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as MultiWorldSession;
            setSession(data);

            // Subscribe to World A & World B classes
            if (data.worldAClassId && !unsubClassA) {
              const classARef = doc(db, 'classes', data.worldAClassId);
              unsubClassA = onSnapshot(classARef, (cSnap) => {
                if (cSnap.exists()) {
                  setWorldAClass({ id: cSnap.id, ...cSnap.data() } as SimulationClass);
                } else {
                  setWorldAClass(null);
                }
              });

              const gameARef = doc(db, 'classes', data.worldAClassId, 'state', 'game');
              unsubGameA = onSnapshot(gameARef, (gSnap) => {
                if (gSnap.exists()) {
                  const gState = gSnap.data()?.gameState as GameState;
                  if (gState) {
                    gState.createdAt = toValidDate(gState.createdAt);
                    gState.updatedAt = toValidDate(gState.updatedAt);
                    setWorldAGameState(gState);
                  } else {
                    setWorldAGameState(null);
                  }
                } else {
                  setWorldAGameState(null);
                }
              });
            }

            if (data.worldBClassId && !unsubClassB) {
              const classBRef = doc(db, 'classes', data.worldBClassId);
              unsubClassB = onSnapshot(classBRef, (cSnap) => {
                if (cSnap.exists()) {
                  setWorldBClass({ id: cSnap.id, ...cSnap.data() } as SimulationClass);
                } else {
                  setWorldBClass(null);
                }
              });

              const gameBRef = doc(db, 'classes', data.worldBClassId, 'state', 'game');
              unsubGameB = onSnapshot(gameBRef, (gSnap) => {
                if (gSnap.exists()) {
                  const gState = gSnap.data()?.gameState as GameState;
                  if (gState) {
                    gState.createdAt = toValidDate(gState.createdAt);
                    gState.updatedAt = toValidDate(gState.updatedAt);
                    setWorldBGameState(gState);
                  } else {
                    setWorldBGameState(null);
                  }
                } else {
                  setWorldBGameState(null);
                }
              });
            }

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
      if (unsubClassA) unsubClassA();
      if (unsubClassB) unsubClassB();
      if (unsubGameA) unsubGameA();
      if (unsubGameB) unsubGameB();
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

  return {
    session,
    worldAClass,
    worldBClass,
    worldAGameState,
    worldBGameState,
    loading,
    error,
    updateAdvanceMode
  };
}
