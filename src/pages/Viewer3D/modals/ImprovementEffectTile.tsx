import React from 'react';

interface ImprovementEffectTileProps {
  type: string;
  size?: number;
  className?: string;
}

export function ImprovementEffectTile({ type, size = 80, className = '' }: ImprovementEffectTileProps) {
  const PACK_PATH = (
    <>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" />
      <path d="m7.5 4.27 9 5.15" />
    </>
  );

  const MICROSCOPE_PATH = (
    <>
      <path d="M6 18h8" />
      <path d="M3 22h18" />
      <path d="M14 22a7 7 0 1 0 0-14h-1" />
      <path d="M9 14h2" />
      <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
      <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
    </>
  );

  const TRUCK_PATH = (
    <>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </>
  );

  const renderSingleTile = (fill: string, stroke: string, glyph: React.ReactNode, tileW: number, tileH: number) => {
    const rx = Math.round(tileW * 0.24);
    return (
      <svg
        width={tileW}
        height={tileH}
        viewBox={`0 0 ${tileW} ${tileH}`}
        className="overflow-visible drop-shadow-md shrink-0"
      >
        {/* Base Tile */}
        <rect
          x="1.5"
          y="1.5"
          width={tileW - 3}
          height={tileH - 3}
          rx={rx}
          fill={fill}
          stroke={stroke}
          strokeWidth="3"
        />

        {/* Top Gloss Sheen */}
        <rect
          x="5"
          y="4.5"
          width={tileW - 10}
          height={tileH * 0.26}
          rx={rx * 0.5}
          fill="#ffffff"
          opacity="0.22"
        />

        {/* Glyph / Content */}
        {glyph}
      </svg>
    );
  };

  const renderPriceTile = (tileW: number, sign: '+' | '-') => {
    const rx = Math.round(tileW * 0.24);
    const badgeColor = sign === '+' ? '#10b981' : '#ef4444';
    const badgeR = tileW * 0.2;
    const badgeCx = tileW - badgeR - 1;
    const badgeCy = tileW - badgeR - 1;

    return (
      <svg
        width={tileW}
        height={tileW}
        viewBox={`0 0 ${tileW} ${tileW}`}
        className="overflow-visible drop-shadow-md shrink-0"
      >
        {/* Base Tile */}
        <rect
          x="1.5"
          y="1.5"
          width={tileW - 3}
          height={tileW - 3}
          rx={rx}
          fill="#e11d2e"
          stroke="#9f1239"
          strokeWidth="3"
        />

        {/* Top Gloss Sheen */}
        <rect
          x="5"
          y="4.5"
          width={tileW - 10}
          height={tileW * 0.26}
          rx={rx * 0.5}
          fill="#ffffff"
          opacity="0.22"
        />

        {/* Big Dollar Sign */}
        <text
          x={tileW / 2}
          y={tileW * 0.68}
          fontSize={tileW * 0.52}
          fontWeight="900"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="sans-serif"
        >
          $
        </text>

        {/* Badge in Bottom Right */}
        <circle
          cx={badgeCx}
          cy={badgeCy}
          r={badgeR}
          fill="#0f172a"
          stroke={badgeColor}
          strokeWidth="2.5"
        />

        {sign === '+' ? (
          <path
            d={`M${badgeCx - badgeR * 0.5},${badgeCy} h${badgeR} M${badgeCx},${badgeCy - badgeR * 0.5} v${badgeR}`}
            stroke={badgeColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : (
          <path
            d={`M${badgeCx - badgeR * 0.5},${badgeCy} h${badgeR}`}
            stroke={badgeColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  };

  const renderGlyph = (paths: React.ReactNode, tileW: number) => {
    const s = (tileW / 24) * 0.62;
    const offset = (tileW - 24 * s) / 2;
    return (
      <g
        transform={`translate(${offset}, ${offset}) scale(${s})`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths}
      </g>
    );
  };

  const normType = (type || '').trim().toLowerCase();

  if (normType === 'price plus' || normType === 'price+' || normType === 'price +') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {renderPriceTile(size, '+')}
      </div>
    );
  }

  if (normType === 'price and product' || normType === 'price & product' || normType === 'price - and product' || normType === 'price minus and product') {
    const dualSize = Math.round(size * 0.66);
    return (
      <div className={`flex items-center justify-center gap-1.5 ${className}`}>
        {renderPriceTile(dualSize, '-')}
        {renderSingleTile(
          '#475569',
          '#1e293b',
          renderGlyph(PACK_PATH, dualSize),
          dualSize,
          dualSize
        )}
      </div>
    );
  }

  if (normType === 'product' || normType === 'products') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {renderSingleTile(
          '#475569',
          '#1e293b',
          renderGlyph(PACK_PATH, size),
          size,
          size
        )}
      </div>
    );
  }

  if (normType === 'research') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {renderSingleTile(
          '#7c3aed',
          '#5b21b6',
          renderGlyph(MICROSCOPE_PATH, size),
          size,
          size
        )}
      </div>
    );
  }

  if (normType === 'logistic' || normType === 'logistics') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {renderSingleTile(
          '#06b6d4',
          '#0891b2',
          renderGlyph(TRUCK_PATH, size),
          size,
          size
        )}
      </div>
    );
  }

  return (
    <div className={`w-[${size}px] h-[${size}px] bg-slate-300 rounded-xl ${className}`} />
  );
}
