import { useEffect, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';

export function useDemoHost() {
  const { gameState, selectRandomCards, recalculateControlPoints } = useGame();
  const { isDemo } = useSession();
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isDemo || !gameState) return;

    const round = gameState.currentRound;
    const phase = (gameState.currentPhase || 'planning').toLowerCase();

    // 1. Draw improvement pool on entering Improvement phase
    if (phase === 'improvement') {
      const key = `${round}:improvementPool`;
      if (!processedRef.current.has(key)) {
        processedRef.current.add(key);
        const pool = gameState.improvementPoolByRound?.[round];
        if (!pool || pool.length === 0) {
          selectRandomCards();
        }
      }
    }

    // 2. Recalculate control points in Control phase
    if (phase === 'control') {
      const key = `${round}:controlPoints`;
      if (!processedRef.current.has(key)) {
        processedRef.current.add(key);
        recalculateControlPoints();
      }
    }
  }, [gameState, isDemo, selectRandomCards, recalculateControlPoints]);
}
