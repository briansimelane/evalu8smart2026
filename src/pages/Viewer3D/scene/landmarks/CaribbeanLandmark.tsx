import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function CaribbeanLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  return (
    <g className={className}>
      {/* Tropical Lagoon Water */}
      <ellipse cx={0} cy={-s * 0.1} rx={s * 1.1} ry={s * 0.34} fill="#35c4e8" />
      <ellipse cx={0} cy={-s * 0.12} rx={s * 0.9} ry={s * 0.24} fill="#6fe0f2" opacity={0.7} />
      
      {/* Coconut Palms */}
      {/* Left Palm */}
      <g transform={`translate(${-s * 0.9}, 4)`}>
        <path d={`M0,0 Q${s * 0.12},${-s * 0.45} ${s * 0.05},${-s * 0.9}`} stroke="#a9794a" strokeWidth={s * 0.07} fill="none" strokeLinecap="round" />
        {[-150, -110, -70, -30, 10, 40].map((ang, i) => {
          const a = (ang * Math.PI) / 180;
          const tx = s * 0.05;
          const ty = -s * 0.9;
          const dx1 = Math.cos(a) * s * 0.35;
          const dy1 = Math.sin(a) * s * 0.2 - s * 0.12;
          const dx2 = Math.cos(a) * s * 0.5;
          const dy2 = Math.sin(a) * s * 0.3 + s * 0.1;
          return (
            <path
              key={i}
              d={`M${tx},${ty} q${dx1},${dy1} ${dx2},${dy2}`}
              stroke="#2e9b57"
              strokeWidth={s * 0.08}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* Right Palm */}
      <g transform={`translate(${s * 0.95}, 6)`}>
        <path d={`M0,0 Q${-s * 0.1},${-s * 0.4} ${-s * 0.04},${-s * 0.8}`} stroke="#a9794a" strokeWidth={s * 0.06} fill="none" strokeLinecap="round" />
        {[-160, -120, -80, -40, 0, 30].map((ang, i) => {
          const a = (ang * Math.PI) / 180;
          const tx = -s * 0.04;
          const ty = -s * 0.8;
          const dx1 = Math.cos(a) * s * 0.3;
          const dy1 = Math.sin(a) * s * 0.18 - s * 0.1;
          const dx2 = Math.cos(a) * s * 0.45;
          const dy2 = Math.sin(a) * s * 0.25 + s * 0.08;
          return (
            <path
              key={i}
              d={`M${tx},${ty} q${dx1},${dy1} ${dx2},${dy2}`}
              stroke="#34a853"
              strokeWidth={s * 0.07}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* Sailboat */}
      <g className="caribbean-boat" transform={`translate(0, 0)`}>
        {/* Boat Hull */}
        <polygon points={`${-s * 0.15},${-s * 0.1} ${s * 0.2},${-s * 0.1} ${s * 0.12},${-s * 0.02} ${-s * 0.1},${-s * 0.02}`} fill="#ffffff" />
        {/* Red Sail */}
        <polygon points={`0,${-s * 0.12} 0,${-s * 0.5} ${s * 0.2},${-s * 0.14}`} fill="#ff6b6b" />
        {/* White Fore-sail */}
        <polygon points={`0,${-s * 0.12} 0,${-s * 0.46} ${-s * 0.12},${-s * 0.16}`} fill="#f1f5f9" />
      </g>
    </g>
  );
}
