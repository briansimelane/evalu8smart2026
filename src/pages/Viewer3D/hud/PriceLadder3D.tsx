import React, { useMemo } from 'react';
import { GameState } from '@/types/game';
import { useMotion } from '../motionAdapter';
import { cn } from '@/lib/utils';
import { getTeamBubbleText } from '@/lib/multiworld/teamLabel';

interface PriceLadder3DProps {
  gameState: GameState;
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

const PRICES = [8, 7, 6, 5, 4, 3, 2];

export function PriceLadder3D({ gameState }: PriceLadder3DProps) {
  const round = gameState.currentRound;
  const roundData = gameState.rounds?.find(r => r.roundNumber === round);
  const phase = (gameState.currentPhase || 'planning').toLowerCase();
  const isPlanning = phase === 'planning';
  const m = useMotion();

  // Team prices submitted in the current round
  const teamsByPrice = useMemo(() => {
    const mapping: Record<number, typeof gameState.teams> = {
      8: [], 7: [], 6: [], 5: [], 4: [], 3: [], 2: [],
    };

    if (!isPlanning) {
      gameState.teams.forEach(team => {
        const tData = roundData?.teamData?.[team.id];
        if (tData?.price !== undefined && tData?.price !== null) {
          const numPrice = Number(tData.price);
          if (mapping[numPrice]) {
            mapping[numPrice].push(team);
          }
        }
      });
    }
    return mapping;
  }, [gameState.teams, roundData, isPlanning]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 120,
        width: 140,
        height: 810,
      }}
      className="bg-white/95 border-r border-[#cdd6e8] shadow-md flex flex-col items-center justify-between py-4 px-2 select-none z-20 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="w-full flex flex-col items-center">
        <span className="text-[17px] font-black text-[#0f172a] uppercase tracking-[2px] pb-2">
          PRICE
        </span>
        <div className="w-[108px] h-[2px] bg-[#94a3b8]" />
      </div>

      {/* 7 Price Rows ($8 to $2) */}
      <div className="flex flex-col justify-between w-full flex-1 py-2">
        {PRICES.map((price, i) => {
          const teamsAtPrice = teamsByPrice[price] || [];

          return (
            <div key={price} className="relative flex items-center justify-between h-[85px] px-1 border-b border-[#cbd5e1] last:border-b-0">
              {/* Red Price Tag Badge (44x44, rx=11) */}
              <div className="w-[44px] h-[44px] rounded-[11px] bg-[#e11d2e] flex items-center justify-center text-white text-[18px] font-black shadow-md shrink-0">
                ${price}
              </div>

              {/* Team tokens at this price */}
              <div className="flex items-center justify-end flex-wrap gap-1.5 flex-1 pl-1">
                {!isPlanning && teamsAtPrice.map(team => {
                  const textColor = getContrastTextColor(team.color);
                  const priceKey = `price:${team.id}`;
                  return (
                    <div
                      key={team.id}
                      style={{
                        backgroundColor: team.color,
                        color: textColor,
                      }}
                      className={cn(
                        "min-w-[34px] h-[34px] px-1 rounded-full flex items-center justify-center font-black text-[13px] shadow-md ring-2 ring-white border border-black/15 transition-transform shrink-0 whitespace-nowrap",
                        m.isRecent(priceKey) && "scale-110 ring-4 ring-amber-300"
                      )}
                      title={`${team.name}: $${price}`}
                    >
                      {getTeamBubbleText(team)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Planning Phase: Prices Hidden Tray */}
      {isPlanning && (
        <div className="w-full p-2 bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl flex flex-col items-center gap-1.5 shadow-2xs">
          <span className="text-[10px] font-black text-[#64748b] uppercase tracking-wider">
            PRICES HIDDEN
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {gameState.teams.map(team => {
              const textColor = getContrastTextColor(team.color);
              return (
                <div
                  key={team.id}
                  style={{
                    backgroundColor: team.color,
                    color: textColor,
                  }}
                  className="min-w-[28px] h-[28px] px-1 rounded-full flex items-center justify-center font-black text-[11px] shadow-sm ring-1.5 ring-white border border-black/15 shrink-0 whitespace-nowrap"
                  title={`${team.name}: Planning...`}
                >
                  {getTeamBubbleText(team)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
