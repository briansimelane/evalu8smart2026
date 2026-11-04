import React from 'react';
import { GameState } from '@/types/game';
import { getTechnologyCostForTeamForState } from '@/hooks/useGameBoardState';
import { useMotion } from '../motionAdapter';
import { cn } from '@/lib/utils';
import { useGameTheme, techLabel, techIcon } from '@/lib/gameTheme';

interface TechStrip3DProps {
  gameState: GameState;
}

const TECH_CONFIGS = [
  { name: 'GPS', pts: 6, baseSegments: 3 },
  { name: 'WIFI', pts: 6, baseSegments: 3 },
  { name: 'Gaming', pts: 8, baseSegments: 4 },
  { name: 'Battery', pts: 8, baseSegments: 4 },
  { name: 'NFC', pts: 10, baseSegments: 5 },
  { name: '4G', pts: 12, baseSegments: 6 },
];

function lookupByKeyCaseInsensitive<T>(map: Record<string, T> | undefined, key: string): T | undefined {
  if (!map) return undefined;
  if (key in map) return map[key];
  const lower = key.toLowerCase();
  const foundKey = Object.keys(map).find(k => k.toLowerCase() === lower);
  return foundKey ? map[foundKey] : undefined;
}

const getContrastTextColor = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
};

export function TechStrip3D({ gameState }: TechStrip3DProps) {
  const m = useMotion();
  const theme = useGameTheme(gameState);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 930,
        width: 1920,
        height: 150,
      }}
      className="bg-white/95 border-t border-[#cdd6e8] shadow-lg flex items-center justify-between px-7 z-20 backdrop-blur-md select-none font-sans"
    >
      {/* 1. Left Section Header */}
      <div className="flex flex-col shrink-0 pr-6">
        <span className="text-[11px] font-black text-[#64748b] uppercase tracking-[1.5px]">
          RESEARCH & DEVELOPMENT
        </span>
        <span className="text-[25px] font-black text-[#0f172a] tracking-tight leading-tight mt-0.5">
          TECHNOLOGIES
        </span>
        <span className="text-[12px] font-bold italic text-[#64748b] mt-0.5">
          Patents & Team Progress
        </span>
      </div>

      {/* 2. 6 Technology Cards */}
      <div className="flex items-center gap-4 flex-1 justify-start">
        {TECH_CONFIGS.map(techCfg => {
          const { name, pts, baseSegments } = techCfg;
          const Icon = techIcon(theme, name);
          const patentHolderId = lookupByKeyCaseInsensitive(gameState.patents, name);
          const patentHolder = patentHolderId ? gameState.teams.find(t => t.id === patentHolderId) : null;
          const patentKey = `patent:${name}`;
          const isNewPatent = m.tierFor(patentKey) === 1;

          return (
            <div
              key={name}
              className={cn(
                "w-[252px] h-[122px] rounded-xl border-2 border-[#9aa8c4] bg-white p-2.5 flex flex-col justify-between shadow-xs transition-all",
                isNewPatent && "ring-2 ring-amber-400"
              )}
            >
              {/* Card Title Row */}
              <div className="flex items-center justify-between pb-1 border-b border-[#e2e8f0]">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 text-purple-700 stroke-[2.4]" />
                  <span className="font-black text-[14px] text-[#0f172a] tracking-tight">
                    {techLabel(theme, name).toUpperCase()}
                  </span>
                  {/* Points Badge */}
                  <span className="text-[10px] font-black text-[#b45309] bg-[#fffbeb] border border-[#fde68a] px-1.5 py-0.5 rounded shadow-2xs">
                    🏆 {pts} pts
                  </span>
                </div>

                {/* Patent Owner Pill or AVAILABLE */}
                {patentHolder ? (
                  <div
                    style={{
                      backgroundColor: patentHolder.color,
                      color: getContrastTextColor(patentHolder.color),
                    }}
                    className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase shadow-xs ring-2 ring-[#fbbf24] flex items-center gap-1"
                    title={`Patent Owner: ${patentHolder.name}`}
                  >
                    <span>{patentHolder.name.toUpperCase()}</span>
                  </div>
                ) : (
                  <span className="text-[9px] font-extrabold text-[#94a3b8] tracking-wider uppercase">
                    AVAILABLE
                  </span>
                )}
              </div>

              {/* 5 Team Progress Circles */}
              <div className="flex items-center justify-between px-1 py-1">
                {gameState.teams.map((team) => {
                  const progress = gameState.teamResearchProgress?.[team.id];
                  const pointsInvested = lookupByKeyCaseInsensitive(progress?.technologyInvestments, name) || 0;
                  const targetCost = getTechnologyCostForTeamForState(gameState, team.id, name) || (baseSegments - (patentHolder && patentHolder.id !== team.id ? 1 : 0));
                  const isCompleted = Boolean(
                    progress?.completedTechnologies?.some(t => t.toLowerCase() === name.toLowerCase()) ||
                    (pointsInvested >= targetCost && targetCost > 0)
                  );
                  const isOwner = patentHolder?.id === team.id;
                  const numSegments = Math.max(1, targetCost);
                  const filledSegments = Math.min(numSegments, pointsInvested);
                  const r = 15;

                  return (
                    <div
                      key={team.id}
                      className="relative flex items-center justify-center"
                      title={`${team.name}: ${isCompleted ? 'Completed' : `${filledSegments}/${numSegments} researched`}`}
                    >
                      {isCompleted ? (
                        /* Completed Circle with Checkmark */
                        <div
                          style={{
                            backgroundColor: team.color,
                            color: getContrastTextColor(team.color),
                          }}
                          className={cn(
                            "w-[30px] h-[30px] rounded-full flex items-center justify-center font-black text-xs shadow-xs ring-2",
                            isOwner ? "ring-[#fbbf24] ring-2" : "ring-white"
                          )}
                        >
                          ✓
                        </div>
                      ) : (
                        /* Segmented Spoke Circle */
                        <svg width="30" height="30" viewBox="0 0 32 32" className="overflow-visible">
                          <circle
                            cx="16"
                            cy="16"
                            r={r}
                            fill="#ffffff"
                            stroke={team.color}
                            strokeWidth="2.4"
                          />
                          {/* Filled Pie Slices */}
                          {Array.from({ length: filledSegments }).map((_, k) => {
                            const a0 = -Math.PI / 2 + (2 * Math.PI * k) / numSegments;
                            const a1 = -Math.PI / 2 + (2 * Math.PI * (k + 1)) / numSegments;
                            const x0 = 16 + r * Math.cos(a0);
                            const y0 = 16 + r * Math.sin(a0);
                            const x1 = 16 + r * Math.cos(a1);
                            const y1 = 16 + r * Math.sin(a1);
                            const largeArc = (a1 - a0) > Math.PI ? 1 : 0;
                            const d = `M 16,16 L ${x0.toFixed(1)},${y0.toFixed(1)} A ${r},${r} 0 ${largeArc} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
                            return (
                              <path key={k} d={d} fill={team.color} />
                            );
                          })}
                          {/* Dividing Spoke Lines */}
                          {numSegments > 1 && Array.from({ length: numSegments }).map((_, k) => {
                            const a = -Math.PI / 2 + (2 * Math.PI * k) / numSegments;
                            const xEnd = 16 + (r - 0.5) * Math.cos(a);
                            const yEnd = 16 + (r - 0.5) * Math.sin(a);
                            return (
                              <line
                                key={k}
                                x1="16"
                                y1="16"
                                x2={xEnd.toFixed(1)}
                                y2={yEnd.toFixed(1)}
                                stroke={filledSegments > 0 ? '#ffffff' : team.color}
                                strokeWidth="1.8"
                                opacity="0.9"
                              />
                            );
                          })}
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
