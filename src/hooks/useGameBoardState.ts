import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GameState, SimulationClass, calculateTeamTotalScore, getInitialScore } from '@/types/game';
import { toValidDate } from '@/lib/utils';
import { getTechnologyCostForTeam as getTechnologyCostForTeamRule } from '@/lib/rules';

export function useGameBoardState(classCode: string) {
  const [classData, setClassData] = useState<SimulationClass | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classCode) return;
    setLoading(true);
    setError(null);

    let unsubClass: (() => void) | null = null;
    let unsubGame: (() => void) | null = null;

    const findAndSubscribe = async () => {
      try {
        let classId: string | null = null;

        // 1. Try treating classCode as the direct class ID
        const directDocRef = doc(db, 'classes', classCode);
        const directSnap = await getDoc(directDocRef);
        if (directSnap.exists()) {
          classId = classCode;
        } else {
          // 2. Query by facilitatorCode
          const qFac = query(collection(db, 'classes'), where('facilitatorCode', '==', classCode.toUpperCase()));
          const snapFac = await getDocs(qFac);
          if (!snapFac.empty) {
            classId = snapFac.docs[0].id;
          } else {
            // 3. Scan all classes to see if any team code matches
            const allSnap = await getDocs(collection(db, 'classes'));
            for (const d of allSnap.docs) {
              const data = d.data() as SimulationClass;
              const codes = Object.values(data.teamCodes || {});
              if (codes.some(c => c.toUpperCase() === classCode.toUpperCase())) {
                classId = d.id;
                break;
              }
            }
          }
        }

        if (!classId) {
          setError('Class not found. Please verify the code.');
          setLoading(false);
          return;
        }

        // Subscribe to class doc
        const classRef = doc(db, 'classes', classId);
        unsubClass = onSnapshot(classRef, (snap) => {
          if (snap.exists()) {
            setClassData({ id: snap.id, ...snap.data() } as SimulationClass);
          } else {
            setError('Class deleted.');
          }
        });

        // Subscribe to game doc (classes/{classId}/state/game)
        const gameRef = doc(db, 'classes', classId, 'state', 'game');
        unsubGame = onSnapshot(gameRef, async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const gState = data?.gameState as GameState;
            if (gState) {
              gState.createdAt = toValidDate(gState.createdAt);
              gState.updatedAt = toValidDate(gState.updatedAt);
              setGameState(gState);
            } else {
              setGameState(null);
            }
            setLoading(false);
          } else {
            // Fallback to legacy field in class doc
            const cSnap = await getDoc(classRef);
            if (cSnap.exists()) {
              const cData = cSnap.data() as SimulationClass;
              if (cData.gameState) {
                setGameState(cData.gameState);
              } else {
                setGameState(null);
              }
            } else {
              setGameState(null);
            }
            setLoading(false);
          }
        });
      } catch (err: any) {
        console.error("useGameBoardState error:", err);
        setError(err.message || 'Error connecting to Firestore');
        setLoading(false);
      }
    };

    findAndSubscribe();

    return () => {
      if (unsubClass) unsubClass();
      if (unsubGame) unsubGame();
    };
  }, [classCode]);

  return { classData, gameState, loading, error };
}

export function calculatePlayOrderForState(gameState: GameState, roundNumber: number) {
  if (!gameState) return [];

  const roundData = gameState.rounds.find(r => r.roundNumber === roundNumber);
  if (!roundData) return gameState.teams;

  const teamsWithData = gameState.teams.map(team => {
    const currentData = roundData.teamData[team.id];
    const previousScore = roundNumber > 1
      ? calculateTeamTotalScore(team.id, roundNumber - 1, gameState).totalScore
      : getInitialScore(team);

    return {
      team,
      currentPrice: currentData?.price ?? Infinity,
      previousScore,
    };
  });

  teamsWithData.sort((a, b) => {
    if (a.currentPrice !== b.currentPrice) {
      return a.currentPrice - b.currentPrice;
    }
    return a.previousScore - b.previousScore;
  });

  return teamsWithData.map(item => item.team);
}

export function getTechnologyCostForTeamForState(gameState: GameState, teamId: string, technology: string): number {
  if (!gameState) return 4;
  return getTechnologyCostForTeamRule(gameState, teamId, technology);
}
