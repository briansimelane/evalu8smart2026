import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function IndiaLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  return (
    <g className={className}>
      {/* Red Sandstone / Marble Plinth Base */}
      <rect x={-s * 0.75} y={-s * 0.16} width={s * 1.5} height={s * 0.16} fill="#efe9de" stroke="#dcd3c1" strokeWidth={1} />
      
      {/* Central Marble Mausoleum Body */}
      <rect x={-s * 0.4} y={-s * 0.5} width={s * 0.8} height={s * 0.34} fill="#fbf7ef" stroke="#e5ddcc" strokeWidth={1} />
      
      {/* Central Grand Iwan Arch */}
      <path
        d={`M${-s * 0.12},${-s * 0.16} v${-s * 0.18} q${s * 0.12},${-s * 0.1} ${s * 0.24},0 v${s * 0.18} z`}
        fill="#c9d4ea"
      />
      {/* Side Arches */}
      {[-0.26, 0.26].map((dx, i) => (
        <path
          key={i}
          d={`M${s * dx - s * 0.05},${-s * 0.2} v${-s * 0.1} q${s * 0.05},${-s * 0.06} ${s * 0.1},0 v${s * 0.1} z`}
          fill="#c9d4ea"
        />
      ))}

      {/* Iconic Onion Dome */}
      <path
        d={`M${-s * 0.28},${-s * 0.5} Q${-s * 0.32},${-s * 0.95} 0,${-s * 1.0} Q${s * 0.32},${-s * 0.95} ${s * 0.28},${-s * 0.5} Z`}
        fill="#ffffff"
        stroke="#e5ddcc"
        strokeWidth={1.5}
      />
      {/* Golden Finial Spire */}
      <line x1={0} y1={-s * 1.0} x2={0} y2={-s * 1.18} stroke="#d9b45a" strokeWidth={2} />
      <circle cx={0} cy={-s * 1.18} r={s * 0.03} fill="#d9b45a" />

      {/* Flanking Minarets */}
      {[-0.62, 0.62].map((dx, i) => (
        <g key={i}>
          {/* Minaret Pillar */}
          <rect
            x={s * dx - s * 0.05}
            y={-s * 0.75}
            width={s * 0.1}
            height={s * 0.6}
            fill="#fbf7ef"
            stroke="#e5ddcc"
            strokeWidth={1}
          />
          {/* Minaret Dome Cap */}
          <circle cx={s * dx} cy={-s * 0.78} r={s * 0.07} fill="#ffffff" stroke="#e5ddcc" strokeWidth={1} />
          {/* Minaret Finial */}
          <line x1={s * dx} y1={-s * 0.85} x2={s * dx} y2={-s * 0.9} stroke="#d9b45a" strokeWidth={1} />
        </g>
      ))}

      {/* Mughal Garden Cypress Trees */}
      <circle cx={-s * 0.95} cy={2} r={s * 0.15} fill="#2f8f4e" />
      <circle cx={s * 0.95} cy={2} r={s * 0.15} fill="#3da66a" />
    </g>
  );
}
