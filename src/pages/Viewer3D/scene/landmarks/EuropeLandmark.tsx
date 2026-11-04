import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function EuropeLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  const c = '#7d6a58';
  return (
    <g className={className}>
      {/* Parisian Mansard Buildings */}
      {/* Left building */}
      <rect x={-s * 0.95} y={-s * 0.35} width={s * 0.3} height={s * 0.35} fill="#e8dcc8" />
      <polygon points={`${-s * 0.95},${-s * 0.35} ${-s * 0.65},${-s * 0.35} ${-s * 0.72},${-s * 0.44} ${-s * 0.88},${-s * 0.44}`} fill="#708090" />
      {/* Windows */}
      <rect x={-s * 0.9} y={-s * 0.3} width={s * 0.05} height={s * 0.07} fill="#8fb4e8" />
      <rect x={-s * 0.8} y={-s * 0.3} width={s * 0.05} height={s * 0.07} fill="#8fb4e8" />
      
      {/* Right building */}
      <rect x={s * 0.65} y={-s * 0.4} width={s * 0.3} height={s * 0.4} fill="#e8dcc8" />
      <polygon points={`${s * 0.65},${-s * 0.4} ${s * 0.95},${-s * 0.4} ${s * 0.88},${-s * 0.49} ${s * 0.72},${-s * 0.49}`} fill="#708090" />
      {/* Middle low building */}
      <rect x={s * 0.45} y={-s * 0.28} width={s * 0.22} height={s * 0.28} fill="#dfcfb5" />

      {/* Eiffel Tower - Legs */}
      <polygon points={`${-s * 0.28},0 ${-s * 0.2},0 ${-s * 0.05},${-s * 0.45} ${-s * 0.02},${-s * 0.45}`} fill={c} />
      <polygon points={`${s * 0.28},0 ${s * 0.2},0 ${s * 0.05},${-s * 0.45} ${s * 0.02},${-s * 0.45}`} fill={c} />
      
      {/* First Platform */}
      <polygon points={`${-s * 0.2},${-s * 0.28} ${s * 0.2},${-s * 0.28} ${s * 0.18},${-s * 0.22} ${-s * 0.18},${-s * 0.22}`} fill="#96806a" />
      
      {/* Spire Section */}
      <polygon points={`${-s * 0.05},${-s * 0.45} ${s * 0.05},${-s * 0.45} ${s * 0.012},${-s * 1.1} ${-s * 0.012},${-s * 1.1}`} fill={c} />
      
      {/* Second Platform */}
      <polygon points={`${-s * 0.09},${-s * 0.45} ${s * 0.09},${-s * 0.45} ${s * 0.09},${-s * 0.41} ${-s * 0.09},${-s * 0.41}`} fill="#96806a" />
      
      {/* Tower Tip */}
      <line x1={0} y1={-s * 1.1} x2={0} y2={-s * 1.25} stroke="#d9b45a" strokeWidth={1.5} />

      {/* Trees */}
      <circle cx={-s * 0.55} cy={2} r={s * 0.15} fill="#2f8f4e" />
      <circle cx={s * 0.4} cy={2} r={s * 0.14} fill="#3da66a" />
    </g>
  );
}
