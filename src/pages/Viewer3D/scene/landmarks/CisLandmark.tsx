import React from 'react';

interface LandmarkProps {
  scale?: number;
  className?: string;
}

export function CisLandmark({ scale = 80, className = '' }: LandmarkProps) {
  const s = scale;
  const cols = ['#d63a3a', '#2e9b57', '#f2b632', '#3a6fd6', '#d63a3a'];
  const domes = [
    { dx: -0.38, h: 0.5, r: 0.12, col: cols[0] },
    { dx: 0.38, h: 0.5, r: 0.12, col: cols[1] },
    { dx: -0.18, h: 0.62, r: 0.13, col: cols[2] },
    { dx: 0.18, h: 0.62, r: 0.13, col: cols[3] },
    { dx: 0.0, h: 0.95, r: 0.17, col: cols[4] },
  ];

  return (
    <g className={className}>
      {/* Background Moscow Kremlin Walls / Buildings */}
      <rect x={-s * 0.95} y={-s * 0.35} width={s * 0.3} height={s * 0.35} fill="#f1d9d9" />
      <polygon points={`${-s * 0.95},${-s * 0.35} ${-s * 0.65},${-s * 0.35} ${-s * 0.8},${-s * 0.48}`} fill="#b8472f" />
      <rect x={s * 0.65} y={-s * 0.35} width={s * 0.3} height={s * 0.35} fill="#f1d9d9" />
      <polygon points={`${s * 0.65},${-s * 0.35} ${s * 0.95},${-s * 0.35} ${s * 0.8},${-s * 0.48}`} fill="#b8472f" />

      {/* Red Brick Cathedral Base Structure */}
      <rect x={-s * 0.5} y={-s * 0.4} width={s * 1.0} height={s * 0.4} fill="#b8472f" />
      
      {/* Onion Dome Towers */}
      {domes.map((d, i) => {
        const cx = d.dx * s;
        const base = -s * 0.4;
        const towerH = s * d.h * 0.55;
        const towerW = d.r * s * 1.4;
        const domeR = d.r * s;
        const domeH = s * d.h * 0.45;
        const domeTop = base - towerH - domeH;

        return (
          <g key={i}>
            {/* Tower drum */}
            <rect
              x={cx - towerW / 2}
              y={base - towerH}
              width={towerW}
              height={towerH}
              fill="#993822"
            />
            {/* Onion Dome Shape */}
            <path
              d={`M${cx - domeR},${base - towerH} Q${cx - domeR * 1.25},${base - towerH - domeH * 0.6} ${cx},${domeTop} Q${cx + domeR * 1.25},${base - towerH - domeH * 0.6} ${cx + domeR},${base - towerH} Z`}
              fill={d.col}
              stroke="#fff"
              strokeWidth={1}
            />
            {/* Golden Orthodox Cross */}
            <line x1={cx} y1={domeTop} x2={cx} y2={domeTop - s * 0.08} stroke="#ffd700" strokeWidth={1.5} />
            <line x1={cx - s * 0.03} y1={domeTop - s * 0.05} x2={cx + s * 0.03} y2={domeTop - s * 0.05} stroke="#ffd700" strokeWidth={1.5} />
          </g>
        );
      })}

      {/* Pine trees */}
      <polygon points={`${-s * 0.8},${-s * 0.05} ${-s * 0.6},${-s * 0.05} ${-s * 0.7},${-s * 0.3}`} fill="#2c7a4b" />
      <polygon points={`${s * 0.6},${-s * 0.05} ${s * 0.8},${-s * 0.05} ${s * 0.7},${-s * 0.3}`} fill="#2c7a4b" />
    </g>
  );
}
