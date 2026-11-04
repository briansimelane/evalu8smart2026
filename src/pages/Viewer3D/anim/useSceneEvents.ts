import { useState, useEffect, useRef } from 'react';
import { GameState } from '@/types/game';
import { useOptionalMotion } from '../motionAdapter';
import { LAYOUT_DATA } from '../layoutData';
import { IslandAnimState, ConnectorPulseState } from '../scene/BoardScene';

export function useSceneEvents(gameState: GameState | null, reducedMotion: boolean = false) {
  const m = useOptionalMotion();
  const [islandStates, setIslandStates] = useState<Record<string, IslandAnimState>>({});
  const [connectorPulses, setConnectorPulses] = useState<ConnectorPulseState[]>([]);
  const [activeRegionKey, setActiveRegionKey] = useState<string | null>(null);

  const prevGameStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    if (!gameState) return;
    const prev = prevGameStateRef.current;
    prevGameStateRef.current = gameState;

    if (!prev || reducedMotion) return;

    // Detect opened offices or logistics expansions
    const regionNames = Object.keys(LAYOUT_DATA.regions);
    const newPulses: ConnectorPulseState[] = [];

    regionNames.forEach(regionName => {
      const prevLogistics = prev.regionLogistics?.[regionName];
      const nextLogistics = gameState.regionLogistics?.[regionName];

      const prevOffices = prevLogistics?.teamsPresent || [];
      const nextOffices = nextLogistics?.teamsPresent || [];

      // New office opened in region!
      const newlyOpened = nextOffices.filter(tId => !prevOffices.includes(tId));
      if (newlyOpened.length > 0) {
        const team = gameState.teams.find(t => t.id === newlyOpened[0]);
        const teamColor = team?.color || '#3b82f6';

        // Trigger island dip (700 ms) and ring pulse
        const start = performance.now();
        const duration = 700;

        const animateDip = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          setIslandStates(prevMap => ({
            ...prevMap,
            [regionName]: {
              ...prevMap[regionName],
              isDipping: progress < 1,
              dipProgress: progress,
              pulseColor: teamColor,
              pulseProgress: progress,
            },
          }));

          if (progress < 1) {
            requestAnimationFrame(animateDip);
          } else {
            setIslandStates(prevMap => ({
              ...prevMap,
              [regionName]: {
                ...prevMap[regionName],
                isDipping: false,
                dipProgress: 0,
                pulseColor: undefined,
                pulseProgress: 0,
              },
            }));
          }
        };

        requestAnimationFrame(animateDip);
      }

      // Check if logistics connector pulse should trigger
      const prevProgress = prevLogistics?.teamProgress || {};
      const nextProgress = nextLogistics?.teamProgress || {};
      Object.keys(nextProgress).forEach(teamId => {
        if ((nextProgress[teamId] || 0) > (prevProgress[teamId] || 0)) {
          // Logistics progress increased: find a connector linked to this region
          const conn = LAYOUT_DATA.connectors.find(c => c.from === regionName || c.to === regionName);
          if (conn) {
            const team = gameState.teams.find(t => t.id === teamId);
            const teamColor = team?.color || '#06b6d4';
            const pulseId = `${conn.from}-${conn.to}`;

            // Animate light pulse along connector (900 ms)
            const pulseStart = performance.now();
            const pulseDuration = 900;

            const animatePulse = (now: number) => {
              const p = Math.min(1, (now - pulseStart) / pulseDuration);
              setConnectorPulses(cur => {
                const filtered = cur.filter(item => item.connectorId !== pulseId);
                if (p < 1) {
                  return [...filtered, { connectorId: pulseId, teamColor, progress: p }];
                }
                return filtered;
              });

              if (p < 1) {
                requestAnimationFrame(animatePulse);
              }
            };

            requestAnimationFrame(animatePulse);
          }
        }
      });
    });
  }, [gameState, reducedMotion]);

  return {
    islandStates,
    connectorPulses,
    activeRegionKey,
  };
}
