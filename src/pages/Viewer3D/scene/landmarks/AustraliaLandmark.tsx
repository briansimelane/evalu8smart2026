import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function AustraliaLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  const shells = [
    { dx: -0.38, r: 0.3, h: 0.55 },
    { dx: -0.12, r: 0.34, h: 0.7 },
    { dx: 0.14, r: 0.3, h: 0.58 },
    { dx: 0.36, r: 0.22, h: 0.4 },
  ];

  return (
    <g className={className}>
      {/* Sydney Harbour Water */}
      <ellipse cx={0} cy={-s * 0.05} rx={s * 1.1} ry={s * 0.3} fill="#3ab6ea" />
      <ellipse cx={s * 0.2} cy={-s * 0.1} rx={s * 0.9} ry={s * 0.2} fill="#7fd9f5" opacity={0.7} />

      {/* Granite Podium Base */}
      <polygon
        points={`${-s * 0.6},0 ${s * 0.6},0 ${s * 0.6},${-s * 0.08} ${-s * 0.6},${-s * 0.08}`}
        fill="#efe6d4"
        stroke="#dcd3c1"
        strokeWidth={1}
      />

      {/* Opera House Iconic Shell Sails */}
      {shells.map((sh, i) => {
        const xBase = s * sh.dx;
        const r = s * sh.r;
        const h = s * sh.h;
        return (
          <path
            key={i}
            d={`M${xBase - r},${-s * 0.08} Q${xBase - r * 0.9},${-h} ${xBase + r * 0.5},${-h * 0.95} Q${xBase + r * 0.6},${-h * 0.35} ${xBase + r},${-s * 0.08} Z`}
            fill="#ffffff"
            stroke="#d6dde9"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Sydney City Skyline Tower & Eucalyptus Tree */}
      <rect x={-s * 0.95} y={-s * 0.4} width={s * 0.22} height={s * 0.4} fill="#dbe4f4" />
      <circle cx={s * 0.95} cy={2} r={s * 0.15} fill="#2f8f4e" />
    </g>
  );
}
