import React from 'react';
import { LAYOUT_DATA } from '../layoutData';

interface ArrowSpec {
  region: string;
  off: number;
  side: 'r' | 'l';
  label: string;
  incoming: boolean;
}

const ARROW_SPECS: ArrowSpec[] = [
  // Exits at right edge
  { region: 'CIS', off: 0, side: 'r', label: 'TO CANADA →', incoming: false },
  { region: 'India', off: 0, side: 'r', label: 'TO CANADA →', incoming: false },
  { region: 'Australia', off: -14, side: 'r', label: 'TO USA →', incoming: false },
  { region: 'Australia', off: 50, side: 'r', label: 'TO CARIBBEAN →', incoming: false },
  // Entries at left edge
  { region: 'Canada', off: -24, side: 'l', label: 'FROM CIS →', incoming: true },
  { region: 'Canada', off: 44, side: 'l', label: 'FROM INDIA →', incoming: true },
  { region: 'USA', off: 0, side: 'l', label: 'FROM AUSTRALIA →', incoming: true },
  { region: 'Caribbean', off: 0, side: 'l', label: 'FROM AUSTRALIA →', incoming: true },
];

export function WrapArrow() {
  return (
    <g className="pacific-wrap-arrows select-none">
      {ARROW_SPECS.map((spec, i) => {
        const regLayout = LAYOUT_DATA.regions[spec.region];
        if (!regLayout) return null;

        const { x0, x1, y0, y1 } = regLayout.island;
        const D = y1 - y0;
        const yy = y0 + D * 0.5 + spec.off;

        let x1Line: number;
        let x2Line: number;
        let polyPts: string;
        let px: number;

        if (spec.side === 'r') {
          x1Line = x1 + 4;
          x2Line = x1Line + 92;
          polyPts = `${x2Line - 4},${yy - 9} ${x2Line + 13},${yy} ${x2Line - 4},${yy + 9}`;
          px = x1Line + 6;
        } else {
          x2Line = x0 - 2;
          x1Line = x2Line - 92;
          polyPts = `${x2Line - 13},${yy - 9} ${x2Line + 4},${yy} ${x2Line - 13},${yy + 9}`;
          px = x1Line - 2;
        }

        const pillW = 22 + spec.label.length * 7.0;
        const pillH = 22;
        const pillY = yy - 34;

        return (
          <g key={i} className="wrap-arrow-item">
            {/* Arrow Path Line */}
            <line
              x1={x1Line}
              y1={yy}
              x2={x2Line}
              y2={yy}
              stroke="#0f172a"
              strokeWidth={5}
              strokeLinecap="round"
            />
            {/* Arrow Head */}
            <polygon points={polyPts} fill="#0f172a" strokeLinejoin="round" />

            {/* Label Pill above line */}
            <rect
              x={px}
              y={pillY}
              width={pillW}
              height={pillH}
              rx={7}
              fill="#0f172a"
            />
            <text
              x={px + pillW / 2}
              y={yy - 19}
              fontSize={11}
              fontWeight={900}
              textAnchor="middle"
              fill="#ffffff"
              letterSpacing="0.5px"
            >
              {spec.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
