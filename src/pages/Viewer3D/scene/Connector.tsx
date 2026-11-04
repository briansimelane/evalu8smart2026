import React, { useMemo } from 'react';
import { LAYOUT_DATA, ConnectorLayoutItem } from '../layoutData';

interface ConnectorProps {
  activePulses?: Array<{
    connectorId: string;
    teamColor: string;
    progress: number; // 0 to 1
  }>;
}

export function Connector({ activePulses = [] }: ConnectorProps) {
  const connectors = LAYOUT_DATA.connectors;

  // Convert polyline points to SVG path string
  const connectorPaths = useMemo(() => {
    return connectors.map((c, index) => {
      const d = 'M ' + c.path.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
      return {
        id: `${c.from}-${c.to}-${index}`,
        from: c.from,
        to: c.to,
        d,
        points: c.path,
      };
    });
  }, [connectors]);

  return (
    <g className="connectors-layer select-none pointer-events-none">
      <defs>
        <filter id="connector-blur" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation={6} />
        </filter>
      </defs>

      {/* 1. Drop shadow layer */}
      {connectorPaths.map(c => (
        <path
          key={`shadow-${c.id}`}
          d={c.d}
          fill="none"
          stroke="#0b1226"
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35}
          transform="translate(0, 6)"
          filter="url(#connector-blur)"
        />
      ))}

      {/* 2. Main road line layer */}
      {connectorPaths.map(c => (
        <path
          key={`base-${c.id}`}
          d={c.d}
          fill="none"
          stroke="#1b2748"
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* 3. Top edge highlight line */}
      {connectorPaths.map(c => (
        <path
          key={`highlight-${c.id}`}
          d={c.d}
          fill="none"
          stroke="#5a6fa8"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
          transform="translate(0, -2.5)"
        />
      ))}

      {/* 4. Active Animated Pulses along connectors */}
      {activePulses.map((pulse, idx) => {
        const found = connectorPaths.find(
          c => c.id === pulse.connectorId ||
               `${c.from}-${c.to}` === pulse.connectorId ||
               `${c.to}-${c.from}` === pulse.connectorId
        );
        if (!found || found.points.length < 2) return null;

        // Interpolate point along polyline
        const totalSegments = found.points.length - 1;
        const targetIndex = Math.min(totalSegments - 1, Math.floor(pulse.progress * totalSegments));
        const segFrac = (pulse.progress * totalSegments) - targetIndex;
        const p1 = found.points[targetIndex];
        const p2 = found.points[targetIndex + 1] || p1;

        const pulseX = p1[0] + (p2[0] - p1[0]) * segFrac;
        const pulseY = p1[1] + (p2[1] - p1[1]) * segFrac;

        return (
          <g key={`pulse-${idx}`} className="connector-pulse">
            <circle
              cx={pulseX}
              cy={pulseY}
              r={9}
              fill={pulse.teamColor}
              opacity={0.4}
              filter="url(#connector-blur)"
            />
            <circle
              cx={pulseX}
              cy={pulseY}
              r={5}
              fill="#ffffff"
              stroke={pulse.teamColor}
              strokeWidth={2.5}
            />
          </g>
        );
      })}
    </g>
  );
}
