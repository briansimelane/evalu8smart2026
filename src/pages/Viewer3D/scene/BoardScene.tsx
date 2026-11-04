import React, { useRef, useEffect, useState, useMemo } from 'react';
import { LAYOUT_DATA } from '../layoutData';
import { HexBackground } from './HexBackground';
import { Island } from './Island';
import { Connector } from './Connector';
import { WrapArrow } from './WrapArrow';
import { Clouds } from './Clouds';
import { Water } from './Water';
import { Boat } from './Boat';

export interface IslandAnimState {
  isDipping?: boolean;
  dipProgress?: number;
  pulseColor?: string;
  pulseProgress?: number;
  isLifted?: boolean;
  leaderTeamColor?: string;
}

export interface ConnectorPulseState {
  connectorId: string;
  teamColor: string;
  progress: number;
}

interface BoardSceneProps {
  islandStates?: Record<string, IslandAnimState>;
  connectorPulses?: ConnectorPulseState[];
  activeRegionKey?: string | null;
  reducedMotion?: boolean;
  quality?: 'auto' | 'high' | 'low';
  onWebGLError?: (error: Error) => void;
}

export function BoardScene({
  islandStates = {},
  connectorPulses = [],
  activeRegionKey = null,
  reducedMotion = false,
  quality = 'high',
  onWebGLError,
}: BoardSceneProps) {
  const [cameraSway, setCameraSway] = useState({ x: 0, y: 0 });
  const isLowQuality = false;

  // Subtle idle sway (<= 0.3 degrees) when reducedMotion is off
  useEffect(() => {
    if (reducedMotion || isLowQuality) return;

    let animId: number;
    const startTime = performance.now();

    const updateSway = (now: number) => {
      const t = (now - startTime) / 1000;
      // Gentle floating sway (<= 1.5px / 0.2 deg)
      const swayX = Math.sin(t * 0.4) * 1.2;
      const swayY = Math.cos(t * 0.3) * 0.9;
      setCameraSway({ x: swayX, y: swayY });
      animId = requestAnimationFrame(updateSway);
    };

    animId = requestAnimationFrame(updateSway);
    return () => cancelAnimationFrame(animId);
  }, [reducedMotion, isLowQuality]);

  // Sort regions by Y coordinate (top to bottom) so lower islands layer properly
  const sortedRegionEntries = useMemo(() => {
    return Object.entries(LAYOUT_DATA.regions).sort((a, b) => {
      return a[1].island.y0 - b[1].island.y0;
    });
  }, []);

  return (
    <div className="absolute inset-0 w-[1920px] h-[1080px] pointer-events-none overflow-hidden select-none">
      {/* 2D / 3D Stage SVG Layer */}
      <svg
        viewBox="0 0 1920 1080"
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
        className="w-full h-full pointer-events-none"
        style={{
          transform: `translate(${cameraSway.x.toFixed(2)}px, ${cameraSway.y.toFixed(2)}px)`,
          transition: reducedMotion ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        <defs>
          {/* Reusable Gradients & Filters */}
          <linearGradient id="island-stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eef2f9" />
            <stop offset="35%" stopColor="#c9d3e6" />
            <stop offset="100%" stopColor="#8d9bb8" />
          </linearGradient>

          <linearGradient id="island-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fd06a" />
            <stop offset="100%" stopColor="#5faa45" />
          </linearGradient>

          <filter id="island-drop" x="-20%" y="-20%" width="140%" height="170%">
            <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#1e2c52" floodOpacity={0.28} />
          </filter>

          <filter id="island-blur" x="-20%" y="-20%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="8" />
          </filter>

          <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0f172a" floodOpacity={0.25} />
          </filter>
        </defs>

        {/* 1. Background Hex Grid on Gradient */}
        <HexBackground />

        {/* 2. Ambient Clouds (drifting across sky) */}
        {!isLowQuality && <Clouds reducedMotion={reducedMotion} />}

        {/* 3. Water feature (Caribbean Lagoon) */}
        <Water reducedMotion={reducedMotion || isLowQuality} />

        {/* 4. Caribbean Bobbing Sailboat */}
        {!isLowQuality && (
          <Boat
            x={LAYOUT_DATA.regions['Caribbean']?.island.x0 + 130 || 430}
            y={LAYOUT_DATA.regions['Caribbean']?.island.y0 - 25 || 565}
            scale={0.9}
            reducedMotion={reducedMotion}
          />
        )}

        {/* 5. Islands Layer (bottom-to-top rendering order) */}
        <g className="islands-layer">
          {sortedRegionEntries.map(([name, regLayout]) => {
            const state = islandStates[name] || {};
            const isLifted = activeRegionKey === name;

            return (
              <Island
                key={`island-${name}`}
                regionName={name}
                layout={regLayout}
                isDipping={state.isDipping}
                dipProgress={state.dipProgress}
                pulseColor={state.pulseColor}
                pulseProgress={state.pulseProgress}
                isLifted={isLifted || state.isLifted}
                leaderTeamColor={state.leaderTeamColor}
              />
            );
          })}
        </g>

        {/* 6. Connectors (roads drawn OVER islands and UNDER DOM plates) */}
        <Connector activePulses={connectorPulses} />

        {/* 7. Pacific Wrap Arrows (8 non-overlapping boundary arrows) */}
        <WrapArrow />
      </svg>
    </div>
  );
}
