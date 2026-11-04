import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function EmiratesLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  return (
    <g className={className}>
      {/* Dubai Skyline Towers */}
      {/* Left Outer Tower */}
      <rect x={-s * 0.85} y={-s * 0.55} width={s * 0.22} height={s * 0.55} fill="#cfe3f6" />
      {/* Left Inner Tower */}
      <rect x={-s * 0.6} y={-s * 0.8} width={s * 0.2} height={s * 0.8} fill="#dbeafb" />
      {/* Right Inner Tower */}
      <rect x={s * 0.45} y={-s * 0.7} width={s * 0.22} height={s * 0.7} fill="#cfe3f6" />
      {/* Right Outer Tower */}
      <rect x={s * 0.7} y={-s * 0.5} width={s * 0.2} height={s * 0.5} fill="#dbeafb" />

      {/* Burj Khalifa - Tier 1 Base */}
      <polygon points={`${-s * 0.16},0 ${s * 0.16},0 ${s * 0.12},${-s * 0.45} ${-s * 0.12},${-s * 0.45}`} fill="#bcd4ee" />
      
      {/* Burj Khalifa - Tier 2 Middle */}
      <polygon points={`${-s * 0.12},${-s * 0.45} ${s * 0.12},${-s * 0.45} ${s * 0.08},${-s * 0.8} ${-s * 0.08},${-s * 0.8}`} fill="#cfe3f6" />
      
      {/* Burj Khalifa - Tier 3 Upper */}
      <polygon points={`${-s * 0.08},${-s * 0.8} ${s * 0.08},${-s * 0.8} ${s * 0.04},${-s * 1.05} ${-s * 0.04},${-s * 1.05}`} fill="#dbeafb" />
      
      {/* Pinnacle Spire */}
      <line x1={0} y1={-s * 1.05} x2={0} y2={-s * 1.3} stroke="#9fb3c9" strokeWidth={2.5} />

      {/* Palms */}
      <g transform={`translate(${-s * 0.95}, 3)`}>
        <path d={`M0,0 Q${s * 0.08},${-s * 0.25} ${s * 0.04},${-s * 0.5}`} stroke="#a9794a" strokeWidth={s * 0.05} fill="none" strokeLinecap="round" />
        {[-140, -90, -40, 10].map((ang, i) => {
          const a = (ang * Math.PI) / 180;
          return (
            <path
              key={i}
              d={`M${s * 0.04},${-s * 0.5} q${Math.cos(a) * s * 0.25},${Math.sin(a) * s * 0.15 - s * 0.08} ${Math.cos(a) * s * 0.35},${Math.sin(a) * s * 0.2 + s * 0.06}`}
              stroke="#2e9b57"
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
