import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function CanadaLandmark({ scale = 80, className = '' }: LandmarkProps) {
  // CN Tower + snowy mountain peaks + pine trees
  const s = scale;
  return (
    <g className={className}>
      {/* Left mountain */}
      <polygon points={`${-s * 0.9},0 ${-s * 0.45},${-s * 0.55} ${-s * 0.15},0`} fill="#9db4cf" />
      <polygon points={`${-s * 0.45},${-s * 0.55} ${-s * 0.33},${-s * 0.37} ${-s * 0.45},${-s * 0.4} ${-s * 0.57},${-s * 0.37}`} fill="#ffffff" />
      
      {/* Right mountain */}
      <polygon points={`${s * 0.2},0 ${s * 0.75},${-s * 0.5} ${s * 1.0},0`} fill="#8aa5c4" />
      <polygon points={`${s * 0.75},${-s * 0.5} ${s * 0.64},${-s * 0.35} ${s * 0.75},${-s * 0.38} ${s * 0.86},${-s * 0.35}`} fill="#ffffff" />
      
      {/* CN Tower Base & Shaft */}
      <polygon points={`${-s * 0.09},0 ${s * 0.09},0 ${s * 0.02},${-s * 0.75} ${-s * 0.02},${-s * 0.75}`} fill="#cfd6e0" />
      <rect x={-s * 0.02} y={-s * 1.15} width={s * 0.04} height={s * 0.4} fill="#b9c3d2" />
      
      {/* Observation Deck Pod */}
      <ellipse cx={0} cy={-s * 0.82} rx={s * 0.17} ry={s * 0.07} fill="#e6ebf2" stroke="#9aa6b8" strokeWidth={1} />
      
      {/* Antenna Spire */}
      <line x1={0} y1={-s * 1.15} x2={0} y2={-s * 1.3} stroke="#8c9baa" strokeWidth={1.5} />
      
      {/* Pine trees */}
      <g transform={`translate(${-s * 0.55}, 2)`}>
        <rect x={-s * 0.015} y={-s * 0.1} width={s * 0.03} height={s * 0.1} fill="#6b4a2b" />
        <polygon points={`${-s * 0.17},${-s * 0.08} ${s * 0.17},${-s * 0.08} 0,${-s * 0.29}`} fill="#2c7a4b" />
        <polygon points={`${-s * 0.13},${-s * 0.21} ${s * 0.13},${-s * 0.21} 0,${-s * 0.42}`} fill="#348c56" />
        <polygon points={`${-s * 0.09},${-s * 0.34} ${s * 0.09},${-s * 0.34} 0,${-s * 0.55}`} fill="#3ea163" />
      </g>
      <g transform={`translate(${s * 0.5}, 2)`}>
        <rect x={-s * 0.016} y={-s * 0.11} width={s * 0.033} height={s * 0.11} fill="#6b4a2b" />
        <polygon points={`${-s * 0.19},${-s * 0.09} ${s * 0.19},${-s * 0.09} 0,${-s * 0.32}`} fill="#2c7a4b" />
        <polygon points={`${-s * 0.15},${-s * 0.23} ${s * 0.15},${-s * 0.23} 0,${-s * 0.46}`} fill="#348c56" />
        <polygon points={`${-s * 0.1},${-s * 0.37} ${s * 0.1},${-s * 0.37} 0,${-s * 0.6}`} fill="#3ea163" />
      </g>
    </g>
  );
}
