import React from 'react';
import { GameState } from '@/types/game';
import { RegionCard } from './RegionCard';

interface RegionLayerProps {
  gameState: GameState;
}

export function RegionLayer({ gameState }: RegionLayerProps) {
  // Region grid coordinates arranged in 4 rows x 3 columns:
  // Column 1: USA is longest (width 354px, center X = 217px)
  // Column 2: Europe is longest (width 354px, center X = 697px)
  // Column 3: China is longest (width 354px, center X = 1177px)
  const regionPositions: Record<string, { left: number; top: number }> = {
    // Column 1 (USA center X = 217px)
    'Canada': { left: 77, top: 20 },
    'USA': { left: 40, top: 210 },
    'Caribbean': { left: 77, top: 400 },
    'South America': { left: 66, top: 590 },

    // Column 2 (Europe center X = 697px)
    'Europe': { left: 520, top: 20 },
    'Emirates': { left: 600, top: 210 },
    'North Africa': { left: 500, top: 400 },
    'RSA': { left: 557, top: 590 },

    // Column 3 (China center X = 1177px)
    'CIS': { left: 1026, top: 20 },
    'China': { left: 1000, top: 210 },
    'India': { left: 1026, top: 400 },
    'Australia': { left: 1026, top: 590 },
  };

  return (
    <div className="absolute left-[140px] right-[260px] top-0 bottom-0 overflow-visible pointer-events-none">
      {/* SVG Overlay Container for region connection lines (z-0, renders behind region cards) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
        {/* 1. CIS ↔ China connection line */}
        <path
          d="M 1166 185 C 1166 197.5, 1177 197.5, 1177 210"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 2. China ↔ India connection line */}
        <path
          d="M 1177 375 C 1177 387.5, 1166 387.5, 1166 400"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 3. India ↔ Australia connection line */}
        <path
          d="M 1166 565 L 1166 590"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 4. RSA ↔ Australia connection line */}
        <path
          d="M 837 672.5 L 1026 672.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 5. North Africa ↔ Europe connection line (100% straight vertical line connecting Europe and North Africa) */}
        <path
          d="M 525 185 L 525 400"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 6. Emirates ↔ RSA connection line (extended curve connecting middle-right edges of Emirates and RSA) */}
        <path
          d="M 880 290 C 950 360, 950 600, 837 672.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 7. India ↔ Emirates connection line (connects middle-right of Emirates to middle-left of India) */}
        <path
          d="M 880 292.5 C 945 292.5, 960 482.5, 1026 482.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 8. Europe ↔ CIS connection line */}
        <path
          d="M 874 102.5 L 1026 102.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 9. South America ↔ RSA connection line */}
        <path
          d="M 368 672.5 L 557 672.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 10. Caribbean ↔ South America connection line */}
        <path
          d="M 217 565 L 217 590"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 11. Caribbean ↔ USA connection line */}
        <path
          d="M 217 375 L 217 400"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 12. Canada ↔ USA connection line */}
        <path
          d="M 217 185 L 217 210"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 13. USA ↔ Europe connection line */}
        <path
          d="M 394 250 C 455 250, 460 102.5, 520 102.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 14. USA ↔ South America connection line (curves down open gap right of Caribbean into South America right side) */}
        <path
          d="M 350 375 C 440 430, 440 600, 368 672.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 15. North Africa ↔ South America connection line (connects to right side of South America at X=368px, Y=630px) */}
        <path
          d="M 500 482.5 C 430 482.5, 420 630, 368 630"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 16. Emirates ↔ North Africa connection line */}
        <path
          d="M 680 375 L 680 400"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 17. North Africa ↔ China connection line (connects middle-right of North Africa to middle-left of China) */}
        <path
          d="M 802 482.5 C 900 482.5, 920 292.5, 1000 292.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* 18. Australia ➔ USA (Pacific wrap-around exit line to the RIGHT of Australia card, shortened line length, full-size arrow) */}
        <g className="overflow-visible">
          <path
            d="M 1385 672.5 L 1453 672.5"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <polygon points="1449,664 1463,672.5 1449,681" fill="#0f172a" />
          <rect x="1385" y="638" width="72" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          <text x="1421" y="653" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">TO USA ➔</text>
        </g>

        {/* 19. USA ➔ Australia (Pacific wrap-around entry line on left side of USA) */}
        <g className="overflow-visible">
          <path
            d="M -25 292.5 L 40 292.5"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <polygon points="25,283 42,292.5 25,302" fill="#0f172a" />
          <rect x="-40" y="258" width="115" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          <text x="17" y="273" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">FROM AUSTRALIA</text>
        </g>

        {/* 20. Australia ➔ Caribbean (Pacific wrap-around exit line on right side of Australia, shortened line length, full-size arrow) */}
        <g className="overflow-visible">
          <path
            d="M 1365 720 L 1453 720"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <polygon points="1449,711.5 1463,720 1449,728.5" fill="#0f172a" />
          <rect x="1365" y="686" width="98" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          <text x="1414" y="701" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">TO CARIBBEAN ➔</text>
        </g>

        {/* 21. Caribbean ➔ Australia (Pacific wrap-around entry line on left side of Caribbean) */}
        <g className="overflow-visible">
          <path
            d="M 10 482.5 L 77 482.5"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <polygon points="62,474 79,482.5 62,491" fill="#0f172a" />
          <rect x="-3" y="448" width="118" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          <text x="56" y="463" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">FROM AUSTRALIA</text>
        </g>

        {/* 22. India ➔ Canada (Pacific wrap-around exit line on right side of India, shortened line length, full-size arrow) */}
        <g className="overflow-visible">
          <path
            d="M 1375 482.5 L 1453 482.5"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <polygon points="1449,474 1463,482.5 1449,491" fill="#0f172a" />
          <rect x="1375" y="448" width="82" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          <text x="1416" y="463" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">TO CANADA ➔</text>
        </g>

        {/* 23. Canada ➔ India (Pacific wrap-around entry line on left side of Canada) */}
        <g className="overflow-visible">
          <path
            d="M 10 135 L 77 135"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <polygon points="62,126.5 79,135 62,143.5" fill="#0f172a" />
          <rect x="-3" y="101" width="96" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          <text x="45" y="116" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">FROM INDIA</text>
        </g>

        {/* 24. CIS ➔ Canada (Pacific wrap-around exit line on right side of CIS, shortened line length, full-size arrow) */}
        <g className="overflow-visible">
          <path
            d="M 1375 102.5 L 1453 102.5"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <polygon points="1449,94 1463,102.5 1449,111" fill="#0f172a" />
          <rect x="1375" y="68" width="82" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          <text x="1416" y="83" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">TO CANADA ➔</text>
        </g>

        {/* 25. Canada ➔ CIS (Pacific wrap-around entry line on left side of Canada) */}
        <g className="overflow-visible">
          <path
            d="M 10 60 L 77 60"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <polygon points="62,51.5 79,60 62,68.5" fill="#0f172a" />
          <rect x="-3" y="26" width="86" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          <text x="40" y="41" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">FROM CIS</text>
        </g>
      </svg>

      {/* Render Region Cards (z-10, sits cleanly ON TOP of all connecting lines) */}
      <div className="absolute inset-0 overflow-visible pointer-events-auto z-10">
        {Object.entries(regionPositions).map(([regionName, pos]) => (
          <div 
            key={regionName} 
            style={{ left: pos.left, top: pos.top }} 
            className="absolute"
          >
            <RegionCard regionName={regionName} gameState={gameState} />
          </div>
        ))}
      </div>
    </div>
  );
}
