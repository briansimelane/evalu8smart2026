import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function NorthAfricaLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  return (
    <g className={className}>
      {/* Great Pyramid of Giza */}
      {/* Lit Face */}
      <polygon points={`${-s * 0.9},0 ${-s * 0.3},${-s * 0.55} ${s * 0.2},0`} fill="#e8c88a" />
      {/* Shadow Face */}
      <polygon points={`${-s * 0.3},${-s * 0.55} ${s * 0.2},0 ${-s * 0.05},0`} fill="#c9a566" />
      
      {/* Second Pyramid (Khafre) */}
      <polygon points={`0,0 ${s * 0.45},${-s * 0.38} ${s * 0.85},0`} fill="#e8c88a" />
      <polygon points={`${s * 0.45},${-s * 0.38} ${s * 0.85},0 ${s * 0.65},0`} fill="#c9a566" />
      
      {/* Islamic Minaret Tower */}
      <rect x={-s * 1.1} y={-s * 0.42} width={s * 0.12} height={s * 0.42} fill="#f4ecd8" stroke="#d5c8ad" strokeWidth={1} />
      {/* Balcony */}
      <rect x={-s * 1.12} y={-s * 0.32} width={s * 0.16} height={s * 0.04} fill="#e2d4b7" />
      {/* Emerald Green Dome & Crescent Spire */}
      <polygon points={`${-s * 1.1},${-s * 0.42} ${-s * 0.98},${-s * 0.42} ${-s * 1.04},${-s * 0.58}`} fill="#2e9b8a" />
      <line x1={-s * 1.04} y1={-s * 0.58} x2={-s * 1.04} y2={-s * 0.64} stroke="#ffd700" strokeWidth={1.5} />

      {/* Palms */}
      <g transform={`translate(${s * 0.95}, 3)`}>
        <path d={`M0,0 Q${s * 0.1},${-s * 0.4} ${s * 0.04},${-s * 0.75}`} stroke="#a9794a" strokeWidth={s * 0.06} fill="none" strokeLinecap="round" />
        {[-140, -100, -60, -20, 20].map((ang, i) => {
          const a = (ang * Math.PI) / 180;
          return (
            <path
              key={i}
              d={`M${s * 0.04},${-s * 0.75} q${Math.cos(a) * s * 0.25},${Math.sin(a) * s * 0.15 - s * 0.08} ${Math.cos(a) * s * 0.4},${Math.sin(a) * s * 0.2 + s * 0.06}`}
              stroke="#2e9b57"
              strokeWidth={s * 0.07}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <g transform={`translate(${-s * 0.55}, 4)`}>
        <path d={`M0,0 Q${-s * 0.08},${-s * 0.3} ${-s * 0.03},${-s * 0.52}`} stroke="#a9794a" strokeWidth={s * 0.05} fill="none" strokeLinecap="round" />
        {[-150, -100, -50, 0].map((ang, i) => {
          const a = (ang * Math.PI) / 180;
          return (
            <path
              key={i}
              d={`M${-s * 0.03},${-s * 0.52} q${Math.cos(a) * s * 0.2},${Math.sin(a) * s * 0.12 - s * 0.06} ${Math.cos(a) * s * 0.3},${Math.sin(a) * s * 0.16 + s * 0.05}`}
              stroke="#34a853"
              strokeWidth={s * 0.06}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </g>
    </g>
  );
}
