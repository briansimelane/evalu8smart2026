import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function UsaLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  return (
    <g className={className}>
      {/* Background Skyline Buildings */}
      {/* Building 1 (Far Left) */}
      <rect x={-s * 0.89} y={-s * 0.45} width={s * 0.28} height={s * 0.45} fill="#cfd9ee" />
      <rect x={-s * 0.85} y={-s * 0.42} width={s * 0.2} height={s * 0.38} fill="#8fb4e8" opacity={0.65} />
      
      {/* Building 2 (Tall Left) */}
      <rect x={-s * 0.66} y={-s * 0.7} width={s * 0.22} height={s * 0.7} fill="#dbe4f4" />
      <polygon points={`${-s * 0.66},${-s * 0.7} ${-s * 0.44},${-s * 0.7} ${-s * 0.55},${-s * 0.82}`} fill="#cfd9ee" />

      {/* Building 3 (Right Middle) */}
      <rect x={s * 0.42} y={-s * 0.6} width={s * 0.26} height={s * 0.6} fill="#cfd9ee" />
      <polygon points={`${s * 0.42},${-s * 0.6} ${s * 0.68},${-s * 0.6} ${s * 0.55},${-s * 0.72}`} fill="#b8c6e2" />

      {/* Building 4 (Far Right) */}
      <rect x={s * 0.67} y={-s * 0.4} width={s * 0.22} height={s * 0.4} fill="#e3ebf8" />

      {/* Statue Pedestal Base */}
      <polygon points={`${-s * 0.16},0 ${s * 0.16},0 ${s * 0.12},${-s * 0.2} ${-s * 0.12},${-s * 0.2}`} fill="#c7ccd6" />
      
      {/* Statue Body (Verdigris green) */}
      <polygon points={`${-s * 0.11},${-s * 0.2} ${s * 0.11},${-s * 0.2} ${s * 0.15},${-s * 0.55} ${-s * 0.05},${-s * 0.6}`} fill="#7fcfba" />
      
      {/* Head */}
      <circle cx={-s * 0.02} cy={-s * 0.66} r={s * 0.07} fill="#8fe0cb" />
      
      {/* Crown Rays */}
      {[-60, -30, 0, 30, 60].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = -s * 0.02;
        const y1 = -s * 0.7;
        const x2 = x1 + Math.sin(rad) * s * 0.13;
        const y2 = y1 - Math.cos(rad) * s * 0.12;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7fcfba" strokeWidth={2} />;
      })}
      
      {/* Raised Arm & Torch */}
      <path d={`M${s * 0.08},${-s * 0.5} L${s * 0.2},${-s * 0.8}`} stroke="#7fcfba" strokeWidth={s * 0.06} strokeLinecap="round" />
      {/* Gold Flame */}
      <ellipse cx={s * 0.2} cy={-s * 0.88} rx={s * 0.05} ry={s * 0.08} fill="#ffd34d" />
      
      {/* Edge Trees */}
      <circle cx={-s * 0.95} cy={-s * 0.2} r={s * 0.14} fill="#2f8f4e" />
      <circle cx={s * 1.0} cy={-s * 0.21} r={s * 0.14} fill="#3da66a" />
    </g>
  );
}
