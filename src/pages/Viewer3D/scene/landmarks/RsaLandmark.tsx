import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function RsaLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  return (
    <g className={className}>
      {/* Table Mountain Rocky Slopes */}
      <polygon
        points={`${-s * 1.0},0 ${-s * 0.75},${-s * 0.5} ${-s * 0.5},${-s * 0.72} ${s * 0.6},${-s * 0.72} ${s * 0.85},${-s * 0.45} ${s * 1.05},0`}
        fill="#8c8f98"
      />
      {/* Flat Plateau Top (Table Mountain Face) */}
      <polygon
        points={`${-s * 0.5},${-s * 0.72} ${s * 0.6},${-s * 0.72} ${s * 0.85},${-s * 0.45} ${-s * 0.75},${-s * 0.5}`}
        fill="#a8abb4"
      />
      
      {/* Green Slopes / Table Mountain Fynbos Flora */}
      <polygon
        points={`${-s * 1.0},0 ${-s * 0.75},${-s * 0.5} ${-s * 0.5},${-s * 0.05}`}
        fill="#5fae52"
        opacity={0.9}
      />
      <polygon
        points={`${s * 1.05},0 ${s * 0.85},${-s * 0.45} ${s * 0.55},${-s * 0.05}`}
        fill="#5fae52"
        opacity={0.9}
      />
      
      {/* Cape Town Waterfront & City Skyline */}
      <rect x={-s * 0.4} y={-s * 0.3} width={s * 0.2} height={s * 0.3} fill="#cfd9ee" />
      <rect x={s * 0.0} y={-s * 0.4} width={s * 0.22} height={s * 0.4} fill="#dbe4f4" />
      <rect x={s * 0.3} y={-s * 0.25} width={s * 0.18} height={s * 0.25} fill="#cfd9ee" />

      {/* Pine/Protea Trees */}
      <circle cx={-s * 0.8} cy={2} r={s * 0.12} fill="#2f8f4e" />
      <circle cx={s * 0.85} cy={2} r={s * 0.14} fill="#3da66a" />
    </g>
  );
}
