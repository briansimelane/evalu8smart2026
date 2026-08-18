import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState } from '@/types/game';
import { diffGameState, isBulkTransition, BoardEvent } from './boardDiff';

export interface TickerEntry {
  id: string;
  label: string;
  color?: string;
  at: number;
}

export interface MotionState {
  /** tier for an element key, or 0 if it should not animate */
  tierFor(key: string): 0 | 1 | 2;
  /** ms to delay this element's animation (stagger) */
  delayFor(key: string): number;
  /** true while the element is inside its 9s afterglow window */
  isRecent(key: string): boolean;
  /** the color of the afterglow ring */
  recentColorFor(key: string): string | undefined;
  /** the soft background color of the afterglow ring */
  recentColorSoftFor(key: string): string | undefined;
  /** drives .mo-board[data-spotlight] */
  spotlight: boolean;
  /** true for one --mo-settle window after a round/phase change */
  settling: boolean;
  /** newest-first, capped at 6, for the ticker */
  ticker: TickerEntry[];
}

// Convert hex to soft transparent rgba with 0.18 alpha
function getSoftColor(hex: string): string {
  if (hex.startsWith('#')) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  }
  return 'rgba(245, 158, 11, 0.18)';
}

export function useBoardMotion(gameState: GameState | null): MotionState {
  const [tick, setTick] = useState(0);
  const [spotlight, setSpotlight] = useState(false);
  const [settling, setSettling] = useState(false);
  const [ticker, setTicker] = useState<TickerEntry[]>([]);

  const baselineStateRef = useRef<GameState | null>(null);
  const lastReceivedStateRef = useRef<GameState | null>(null);
  const highlightMapRef = useRef<Map<string, { tier: 1 | 2; startedAt: number; delay: number; duration: number }>>(new Map());
  const recentMapRef = useRef<Map<string, { teamColor: string; expiredAt: number }>>(new Map());

  const coalesceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const firstCoalesceTimeRef = useRef<number | null>(null);
  const spotlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync latest gameState
  useEffect(() => {
    if (!gameState) return;

    if (!baselineStateRef.current) {
      baselineStateRef.current = gameState;
      // Set initial ticker value
      const roundLabel = `Round ${gameState.currentRound} · ${(gameState.currentPhase || 'Planning').charAt(0).toUpperCase() + (gameState.currentPhase || 'planning').slice(1).toLowerCase()}`;
      setTicker([{
        id: `initial-${Date.now()}`,
        label: roundLabel,
        at: Date.now()
      }]);
      return;
    }

    lastReceivedStateRef.current = gameState;

    // Coalesce snapshot bursts: buffer incoming states on a 250ms trailing debounce, max 600ms wait
    const now = Date.now();
    if (firstCoalesceTimeRef.current === null) {
      firstCoalesceTimeRef.current = now;
    }

    const timePassedSinceFirst = now - firstCoalesceTimeRef.current;

    if (coalesceTimerRef.current) {
      clearTimeout(coalesceTimerRef.current);
    }

    const processChange = () => {
      const prev = baselineStateRef.current;
      const next = lastReceivedStateRef.current;
      if (!prev || !next) return;

      coalesceTimerRef.current = null;
      firstCoalesceTimeRef.current = null;

      let bulk = isBulkTransition(prev, next);
      const events = diffGameState(prev, next);

      if (events.length > 8) {
        bulk = true;
      }

      if (bulk) {
        highlightMapRef.current.clear();
        setSpotlight(false);
        setSettling(true);

        const roundLabel = `Round ${next.currentRound} · ${(next.currentPhase || 'Planning').charAt(0).toUpperCase() + (next.currentPhase || 'planning').slice(1).toLowerCase()}`;
        
        setTicker(prevTicker => [
          {
            id: `bulk-${Date.now()}`,
            label: roundLabel,
            at: Date.now()
          },
          ...prevTicker.slice(0, 5)
        ]);

        setTimeout(() => {
          setSettling(false);
        }, 700); // Settle animation is 700ms

        baselineStateRef.current = next;
        setTick(t => t + 1);
        return;
      }

      if (events.length === 0) {
        baselineStateRef.current = next;
        return;
      }

      // Deduplicate keys
      const uniqueEventsMap = new Map<string, BoardEvent>();
      events.forEach(e => {
        if (!uniqueEventsMap.has(e.key)) {
          uniqueEventsMap.set(e.key, e);
        }
      });
      const uniqueEvents = Array.from(uniqueEventsMap.values());

      // Sort by tier (1 before 2), then reading order
      const getReadingOrderScore = (key: string) => {
        if (key.startsWith('money:') || key.startsWith('price:')) return 10;
        if (key.startsWith('control:')) return 20;
        if (key.startsWith('customer:')) return 30;
        if (key.startsWith('office:')) return 40;
        if (key.startsWith('logistics:')) return 50;
        if (key.startsWith('improvement:')) return 60;
        if (key.startsWith('research:')) return 70;
        if (key.startsWith('tech:') || key.startsWith('patent:')) return 80;
        return 100;
      };

      uniqueEvents.sort((a, b) => {
        if (a.tier !== b.tier) {
          return a.tier - b.tier;
        }
        return getReadingOrderScore(a.key) - getReadingOrderScore(b.key);
      });

      // Cap at most 5 tier-1 highlights, others fall back to tier 3 afterglow
      let tier1Count = 0;
      const finalEventsToAnimate: BoardEvent[] = [];
      const eventsForAfterglowOnly: BoardEvent[] = [];

      uniqueEvents.forEach(e => {
        if (e.tier === 1) {
          if (tier1Count < 5) {
            tier1Count++;
            finalEventsToAnimate.push(e);
          } else {
            eventsForAfterglowOnly.push(e);
          }
        } else {
          finalEventsToAnimate.push(e);
        }
      });

      const shouldAnimate = !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const commitTime = Date.now();

      let staggerIndex = 0;
      const newTickerEntries: TickerEntry[] = [];

      finalEventsToAnimate.forEach(e => {
        const delay = staggerIndex * 350; // 350ms stagger (slower, clearer sequence)
        staggerIndex++;

        const duration = e.tier === 1 ? 2200 : 1400; // 2.2s for tier-1, 1.4s for tier-2 (much slower)

        if (shouldAnimate) {
          highlightMapRef.current.set(e.key, {
            tier: e.tier,
            startedAt: commitTime,
            delay,
            duration
          });
        }

        newTickerEntries.push({
          id: `${e.key}-${commitTime}`,
          label: e.label,
          color: e.teamColor,
          at: commitTime + delay
        });

        const color = e.teamColor || '#f59e0b';
        recentMapRef.current.set(e.key, {
          teamColor: color,
          expiredAt: commitTime + delay + duration + 15000 // 15s afterglow
        });
      });

      eventsForAfterglowOnly.forEach(e => {
        newTickerEntries.push({
          id: `${e.key}-${commitTime}`,
          label: e.label,
          color: e.teamColor,
          at: commitTime
        });

        const color = e.teamColor || '#f59e0b';
        recentMapRef.current.set(e.key, {
          teamColor: color,
          expiredAt: commitTime + 15000
        });
      });

      // Prepend to ticker and cap at 6
      if (newTickerEntries.length > 0) {
        // Sort new ticker entries so staggered ones arrive at their virtual time
        newTickerEntries.sort((a, b) => a.at - b.at);
        setTicker(prev => [...newTickerEntries, ...prev].slice(0, 6));
      }

      // Spotlight engages for tier-1 updates
      if (shouldAnimate && tier1Count > 0) {
        const maxAnimationTime = staggerIndex * 350 + 2200;
        setSpotlight(true);
        if (spotlightTimeoutRef.current) {
          clearTimeout(spotlightTimeoutRef.current);
        }
        spotlightTimeoutRef.current = setTimeout(() => {
          setSpotlight(false);
        }, maxAnimationTime + 400);
      }

      // Prune and cap active afterglow items at 5
      const currentActive = Array.from(recentMapRef.current.entries());
      if (currentActive.length > 5) {
        const excess = currentActive.length - 5;
        for (let i = 0; i < excess; i++) {
          recentMapRef.current.delete(currentActive[i][0]);
        }
      }

      baselineStateRef.current = next;
      setTick(t => t + 1);
    };

    if (timePassedSinceFirst >= 600) {
      processChange();
    } else {
      coalesceTimerRef.current = setTimeout(processChange, 250);
    }
  }, [gameState]);

  // Single requestAnimationFrame loop to check for expirations
  useEffect(() => {
    let animFrameId: number;

    const checkExpirations = () => {
      const now = Date.now();
      let changed = false;

      // Prune expired highlights
      for (const [key, val] of highlightMapRef.current.entries()) {
        if (now >= val.startedAt + val.delay + val.duration) {
          highlightMapRef.current.delete(key);
          changed = true;
        }
      }

      // Prune expired afterglows
      for (const [key, val] of recentMapRef.current.entries()) {
        if (now >= val.expiredAt) {
          recentMapRef.current.delete(key);
          changed = true;
        }
      }

      if (changed) {
        setTick(t => t + 1);
      }

      animFrameId = requestAnimationFrame(checkExpirations);
    };

    animFrameId = requestAnimationFrame(checkExpirations);

    return () => {
      cancelAnimationFrame(animFrameId);
      if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
      if (spotlightTimeoutRef.current) clearTimeout(spotlightTimeoutRef.current);
    };
  }, []);

  const tierFor = useCallback((key: string): 0 | 1 | 2 => {
    return highlightMapRef.current.get(key)?.tier || 0;
  }, [tick]);

  const delayFor = useCallback((key: string): number => {
    return highlightMapRef.current.get(key)?.delay || 0;
  }, [tick]);

  const isRecent = useCallback((key: string): boolean => {
    return recentMapRef.current.has(key);
  }, [tick]);

  const recentColorFor = useCallback((key: string): string | undefined => {
    return recentMapRef.current.get(key)?.teamColor;
  }, [tick]);

  const recentColorSoftFor = useCallback((key: string): string | undefined => {
    const color = recentMapRef.current.get(key)?.teamColor;
    return color ? getSoftColor(color) : undefined;
  }, [tick]);

  return {
    tierFor,
    delayFor,
    isRecent,
    recentColorFor,
    recentColorSoftFor,
    spotlight,
    settling,
    ticker
  };
}
