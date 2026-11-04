import React, { useMemo } from 'react';
import { RegionLayoutItem } from '../layoutData';
import { REGION_LANDMARKS } from './landmarks';

interface IslandProps {
  regionName: string;
  layout: RegionLayoutItem;
  isDipping?: boolean;
  dipProgress?: number; // 0 to 1
  pulseColor?: string;
  pulseProgress?: number; // 0 to 1
  isLifted?: boolean;
  leaderTeamColor?: string;
}

const EXTRA_TREES: Record<string, number[]> = {
  'Canada': [0.35],
  'USA': [],
  'Caribbean': [],
  'South America': [0.5],
  'Europe': [0.2, 0.8],
  'Emirates': [0.2],
  'North Africa': [],
  'RSA': [0.15, 0.85],
  'CIS': [0.12, 0.9],
  'China': [0.18, 0.88],
  'India': [],
  'Australia': [0.12],
};

export function Island({
  regionName,
  layout,
  isDipping = false,
  dipProgress = 0,
  pulseColor,
  pulseProgress = 0,
  isLifted = false,
  leaderTeamColor,
}: IslandProps) {
  const { x0, x1, y0, y1, sideThickness } = layout.island;
  const W = x1 - x0;
  const D = y1 - y0;
  const cxs = (x0 + x1) / 2;
  const cys = (y0 + y1) / 2;
  const ch = 46.85; // chamfer size 0.55 * k

  // Landmark Component
  const LandmarkComponent = REGION_LANDMARKS[regionName];
  const isPines = regionName === 'Canada' || regionName === 'CIS';

  // Geometry polygons
  const { topPoints, sidePoints, grassPoints, pavedPoints, clipRect } = useMemo(() => {
    const top = [
      [x0 + ch, y0],
      [x1 - ch, y0],
      [x1, y0 + D * 0.35],
      [x1, y1],
      [x0, y1],
      [x0, y0 + D * 0.35],
    ];

    const side = [
      [x0, y0 + D * 0.35],
      [x0, y1 + sideThickness],
      [x1, y1 + sideThickness],
      [x1, y0 + D * 0.35],
    ];

    const inset = 7;
    const gtop = top.map(([a, b]) => [
      a + (a < cxs ? inset : -inset),
      b + (b < cys ? inset * 0.8 : -inset * 0.8),
    ]);

    const paved = [
      [x0 + 6, y1 - D * 0.3],
      [x1 - 6, y1 - D * 0.3],
      [x1 - 6, y1 - 6],
      [x0 + 6, y1 - 6],
    ];

    const clip = {
      x: x0 - 2,
      y: y0 - 190,
      width: W + 4,
      height: 190 + D,
    };

    return {
      topPoints: top.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
      sidePoints: side.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
      grassPoints: gtop.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
      pavedPoints: paved.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
      clipRect: clip,
    };
  }, [x0, x1, y0, y1, sideThickness, W, D, cxs, cys, ch]);

  // Dip offset calculation (spring bounce)
  let translateY = 0;
  if (isDipping) {
    // Dip 6px and spring-settle: 6 * sin(progress * PI)
    translateY = 6 * Math.sin(dipProgress * Math.PI);
  } else if (isLifted) {
    translateY = -3.5;
  }

  const clipId = `clip-${regionName.replace(/\s+/g, '')}`;

  return (
    <g
      className={`island-group region-${regionName.toLowerCase().replace(/\s+/g, '-')} transition-transform duration-300`}
      transform={`translate(0, ${translateY.toFixed(2)})`}
    >
      <defs>
        {/* Island clip path: clips landmark art to island horizontal width */}
        <clipPath id={clipId}>
          <rect
            x={clipRect.x}
            y={clipRect.y}
            width={clipRect.width}
            height={clipRect.height}
          />
        </clipPath>
      </defs>

      {/* 1. Soft Drop Shadow */}
      <polygon
        points={topPoints}
        fill="#223a6b"
        opacity={0.28}
        transform={`translate(0, ${(sideThickness + 14).toFixed(1)})`}
        filter="url(#island-blur)"
      />

      {/* 2. Stone Base (Extruded side) */}
      <polygon
        points={sidePoints}
        fill="url(#island-stone)"
        stroke="#aeb9d1"
        strokeWidth={1.5}
        strokeLinejoin="round"
        filter="url(#island-drop)"
      />

      {/* 3. Pale Lip Highlight */}
      <polygon
        points={topPoints}
        fill="#f5f8fd"
        stroke="#d3dcef"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* 4. Lush Grass Top */}
      <polygon
        points={grassPoints}
        fill="url(#island-grass)"
        stroke="#5faa45"
        strokeWidth={1}
        strokeLinejoin="round"
      />

      {/* 5. Expanding Ring Pulse on Grass (office opened animation) */}
      {pulseColor && pulseProgress > 0 && pulseProgress < 1 && (
        <ellipse
          cx={cxs}
          cy={cys}
          rx={20 + pulseProgress * (W * 0.42)}
          ry={10 + pulseProgress * (D * 0.38)}
          fill="none"
          stroke={pulseColor}
          strokeWidth={4 * (1 - pulseProgress)}
          opacity={1 - pulseProgress}
        />
      )}

      {/* 6. Paved Front Band */}
      <polygon
        points={pavedPoints}
        fill="#e8edf6"
        opacity={0.9}
        strokeLinejoin="round"
      />

      {/* 7. Clipped Artwork: Trees + Landmark */}
      <g clipPath={`url(#${clipId})`}>
        {/* Extra Region Trees */}
        {(EXTRA_TREES[regionName] || []).map((frac, idx) => {
          const tx = x0 + W * frac;
          const ty = y0 + D * 0.48;
          return isPines ? (
            <g key={`extra-pine-${idx}`} transform={`translate(${tx}, ${ty})`}>
              <rect x={-1.5} y={-8} width={3} height={8} fill="#6b4a2b" />
              <polygon points="-12,-6 12,-6 0,-22" fill="#2c7a4b" />
              <polygon points="-9,-15 9,-15 0,-29" fill="#348c56" />
              <polygon points="-6,-22 6,-22 0,-34" fill="#3ea163" />
            </g>
          ) : (
            <g key={`extra-tree-${idx}`} transform={`translate(${tx}, ${ty})`}>
              <rect x={-1.8} y={-10} width={3.6} height={10} fill="#6b4a2b" />
              <circle cx={0} cy={-16} r={12} fill="#2f8f4e" />
              <circle cx={-4} cy={-18} r={9} fill="#3da66a" />
            </g>
          );
        })}

        {/* 4 Edge-hugging Trees */}
        {[0.07, 0.15, 0.86, 0.94].map((frac, i) => {
          const tx = x0 + W * frac;
          const ty = y0 + D * (i < 2 ? 0.18 : 0.22);
          const tr = 8 + (i % 3) * 2;
          return isPines ? (
            <g key={`edge-tree-${i}`} transform={`translate(${tx}, ${ty})`}>
              <rect x={-1} y={-5} width={2} height={5} fill="#6b4a2b" />
              <polygon points="-8,-4 8,-4 0,-16" fill="#2c7a4b" />
              <polygon points="-6,-10 6,-10 0,-20" fill="#348c56" />
            </g>
          ) : (
            <g key={`edge-tree-${i}`} transform={`translate(${tx}, ${ty})`}>
              <rect x={-1} y={-7} width={2} height={7} fill="#6b4a2b" />
              <circle cx={0} cy={-12} r={tr} fill="#2f8f4e" />
              <circle cx={-3} cy={-14} r={tr * 0.75} fill="#3da66a" />
            </g>
          );
        })}

        {/* Landmark Center */}
        {LandmarkComponent && (
          <g transform={`translate(${layout.landmarkAnchor.x}, ${layout.landmarkAnchor.y})`}>
            <LandmarkComponent scale={layout.landmarkAnchor.scale} />
          </g>
        )}
      </g>

      {/* 8. Leader banner / flag (when region is controlled) */}
      {leaderTeamColor && (
        <g transform={`translate(${x1 - 18}, ${y0 + 10})`} className="leader-flag">
          <line x1={0} y1={0} x2={0} y2={-24} stroke="#475569" strokeWidth={2} />
          <polygon points="0,-24 16,-18 0,-12" fill={leaderTeamColor} stroke="#fbbf24" strokeWidth={1} />
          <circle cx={0} cy={-24} r={2} fill="#fbbf24" />
        </g>
      )}
    </g>
  );
}
