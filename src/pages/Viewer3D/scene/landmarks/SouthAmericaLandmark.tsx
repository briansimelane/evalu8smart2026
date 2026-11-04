import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function SouthAmericaLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  return (
    <g className={className}>
      {/* Mountain Base (Corcovado Peak) */}
      <ellipse cx={0} cy={0} rx={s * 0.9} ry={s * 0.25} fill="#5fae52" />
      <polygon points={`${-s * 0.7},0 ${-s * 0.15},${-s * 0.65} ${s * 0.15},${-s * 0.65} ${s * 0.8},0`} fill="#4d9c47" />
      
      {/* Statue Pedestal */}
      <polygon points={`${-s * 0.08},${-s * 0.64} ${s * 0.08},${-s * 0.64} ${s * 0.06},${-s * 0.92} ${-s * 0.06},${-s * 0.92}`} fill="#f4f1ea" />
      
      {/* Statue Outstretched Arms */}
      <polygon points={`${-s * 0.3},${-s * 0.84} ${s * 0.3},${-s * 0.84} ${s * 0.3},${-s * 0.77} ${-s * 0.3},${-s * 0.77}`} fill="#f4f1ea" />
      
      {/* Statue Head */}
      <circle cx={0} cy={-s * 0.97} r={s * 0.05} fill="#f4f1ea" />
      
      {/* Mountain Vegetation Trees */}
      <circle cx={-s * 0.9} cy={3} r={s * 0.18} fill="#2f8f4e" />
      <circle cx={s * 0.95} cy={3} r={s * 0.18} fill="#3da66a" />
      <circle cx={-s * 0.4} cy={-s * 0.2} r={s * 0.12} fill="#3b9650" />
      <circle cx={s * 0.45} cy={-s * 0.2} r={s * 0.12} fill="#2f8f4e" />
    </g>
  );
}
