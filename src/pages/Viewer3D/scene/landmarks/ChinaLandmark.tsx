import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function ChinaLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  return (
    <g className={className}>
      {/* Background Modern Towers (Shanghai / Beijing) */}
      <rect x={-s * 0.9} y={-s * 0.6} width={s * 0.24} height={s * 0.6} fill="#e6edf9" />
      <rect x={-s * 0.65} y={-s * 0.85} width={s * 0.2} height={s * 0.85} fill="#d6e1f5" />
      <rect x={s * 0.75} y={-s * 0.7} width={s * 0.22} height={s * 0.7} fill="#e6edf9" />

      {/* Traditional Multi-tiered Pagoda */}
      {[0, 1, 2, 3, 4].map(i => {
        const w = s * (0.34 - i * 0.05);
        const yy = -i * s * 0.2;
        return (
          <g key={i}>
            {/* Pagoda Wall / Column tier */}
            <rect
              x={-w * 0.7}
              y={yy - s * 0.06}
              width={w * 1.4}
              height={s * 0.08}
              fill="#f2c14e"
              stroke="#d49e29"
              strokeWidth={1}
            />
            {/* Upcurved Eaves Roof */}
            <polygon
              points={`${-w * 1.25},${yy - s * 0.06} ${w * 1.25},${yy - s * 0.06} ${w * 0.9},${yy - s * 0.2} ${-w * 0.9},${yy - s * 0.2}`}
              fill="#c8372d"
            />
          </g>
        );
      })}

      {/* Golden Finial Spire */}
      <line x1={0} y1={-s * 1.0} x2={0} y2={-s * 1.25} stroke="#f2c14e" strokeWidth={3} />
      <circle cx={0} cy={-s * 1.25} r={s * 0.04} fill="#f2c14e" />

      {/* Willow / Gingko trees */}
      <circle cx={s * 0.45} cy={2} r={s * 0.16} fill="#3da66a" />
      <circle cx={-s * 0.38} cy={2} r={s * 0.14} fill="#2f8f4e" />
    </g>
  );
}
