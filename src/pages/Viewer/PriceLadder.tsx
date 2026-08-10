import React, { useMemo, useState, useEffect } from 'react';
import { GameState } from '@/types/game';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { useMotion } from './motion/MotionContext';
import { getMotionClass, getMotionStyles } from './motion/motionClass';
import { cn } from '@/lib/utils';

interface PriceLadderProps {
  gameState: GameState;
}

// Helper for high-contrast text color
const getContrastTextColor = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
};

export function PriceLadder({ gameState }: PriceLadderProps) {
  const round = gameState.currentRound;
  const roundData = gameState.rounds.find(r => r.roundNumber === round);
  const currentPhase = (gameState.currentPhase || 'planning').toLowerCase();
  const isPlanning = currentPhase === 'planning';
  const m = useMotion();

  const prices = [8, 7, 6, 5, 4, 3, 2];

  // State to track animated price positions per team
  const [displayedPrices, setDisplayedPrices] = useState<Record<string, number>>({});
  const [animatedRound, setAnimatedRound] = useState<number | null>(null);

  useEffect(() => {
    if (isPlanning) {
      setDisplayedPrices({});
      setAnimatedRound(null);
      return;
    }

    // Collect actual submitted prices for each team
    const targetPrices: Record<string, number> = {};
    gameState.teams.forEach(team => {
      const tData = roundData?.teamData[team.id];
      if (tData && tData.price && tData.price > 0) {
        targetPrices[team.id] = tData.price;
      }
    });

    // Play initial reveal animation ($5 -> target price) once per round when leaving Planning phase
    if (animatedRound !== round && Object.keys(targetPrices).length > 0) {
      const initial5: Record<string, number> = {};
      Object.keys(targetPrices).forEach(teamId => {
        initial5[teamId] = 5;
      });
      setDisplayedPrices(initial5);

      const timer = setTimeout(() => {
        setDisplayedPrices(targetPrices);
        setAnimatedRound(round);
      }, 200);

      return () => clearTimeout(timer);
    } else {
      // Keep displayedPrices strictly in sync with latest team prices
      setDisplayedPrices(targetPrices);
    }
  }, [round, isPlanning, gameState.teams, roundData, animatedRound]);

  // Map each price row ($8 to $2) to the teams currently positioned at that price
  const teamsByPrice = useMemo(() => {
    const mapping: Record<number, typeof gameState.teams> = {};
    prices.forEach(p => {
      mapping[p] = [];
    });

    if (!isPlanning) {
      gameState.teams.forEach(team => {
        const p = displayedPrices[team.id];
        if (p && mapping[p]) {
          mapping[p].push(team);
        }
      });
    }
    return mapping;
  }, [gameState.teams, displayedPrices, isPlanning]);

  // Unrevealed prices tray (used when in Planning phase or for teams without price set)
  const unrevealedTeams = useMemo(() => {
    if (isPlanning) {
      return gameState.teams;
    }
    return gameState.teams.filter(team => !displayedPrices[team.id]);
  }, [gameState.teams, isPlanning, displayedPrices]);

  const ladderChanged = gameState.teams.some(team => m.tierFor(`price:${team.id}`) > 0);

  return (
    <div 
      className={cn(
        "absolute top-0 bottom-0 left-0 w-[140px] bg-white/95 border-r border-slate-300 p-3.5 flex flex-col justify-between z-10 backdrop-blur-md shadow-lg text-slate-900 mo-dimmable",
        ladderChanged && "z-20"
      )}
      data-changed={ladderChanged ? '1' : undefined}
    >
      <div className="flex flex-col items-center gap-2 h-full">
        {/* Header */}
        <span className="text-base font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-400 pb-1.5 w-full text-center">
          Price
        </span>
        
        <div className="relative flex flex-col justify-between w-full flex-1 py-1">
          {prices.map(price => (
            <div key={price} className="relative flex items-center justify-between h-[90px] border-b border-slate-300 last:border-b-0 px-1">
              {/* Price Tag with larger in-game red badge */}
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-red-600 text-white font-mono text-lg font-black shadow-md shrink-0">
                ${price}
              </div>
              
              {/* Offset space for absolutely positioned team tokens */}
              <div className="flex-1 min-w-[80px]" />
            </div>
          ))}

          {/* Absolute tokens layer */}
          <div className="absolute inset-0 pointer-events-none">
            {gameState.teams.map((team, orderIndex) => {
              const price = displayedPrices[team.id];
              const isVisible = !isPlanning && price !== undefined;
              if (!isVisible) return null;

              const rowIndex = prices.indexOf(price);
              if (rowIndex === -1) return null;

              const teamsAtThisPrice = teamsByPrice[price] || [];
              const teamOffsetIndex = teamsAtThisPrice.indexOf(team);
              const xOffset = teamOffsetIndex * -30;

              const priceKey = `price:${team.id}`;
              const priceClass = getMotionClass(m, priceKey, 'sm');
              const priceStyles = getMotionStyles(m, priceKey, team.color);

              const textColor = getContrastTextColor(team.color);
              const delay = orderIndex * 140;

              return (
                <div
                  key={team.id}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: 0,
                    transform: `translate(${xOffset}px, calc(${rowIndex} * (100% / 7) + (100% / 14) - 14px))`,
                    transition: 'transform var(--mo-announce) var(--mo-ease-pop), opacity var(--mo-quick) var(--mo-ease-soft)',
                    transitionDelay: `${delay}ms`,
                    backgroundColor: team.color,
                    color: textColor,
                    ...priceStyles
                  }}
                  className={cn(
                    "w-7 h-7 rounded-full shadow-lg ring-2 ring-white flex items-center justify-center font-black text-xs shrink-0 border border-black/10 pointer-events-auto transition-all",
                    priceClass
                  )}
                  title={`${team.name}: $${price}`}
                >
                  {team.name.charAt(0).toUpperCase()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Unrevealed Prices Tray */}
        {unrevealedTeams.length > 0 && (
          <div className="w-full mt-1 p-2 bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Prices Hidden</span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {unrevealedTeams.map(team => {
                const textColor = getContrastTextColor(team.color);
                const priceKey = `price:${team.id}`;
                return (
                  <div 
                    key={team.id}
                    className={cn(
                      "w-6 h-6 rounded-full border border-black/20 flex items-center justify-center font-extrabold text-[10px] shadow-md ring-2 ring-white shrink-0 transition-all",
                      m.isRecent(priceKey) && 'mo-recent'
                    )}
                    style={{ backgroundColor: team.color, color: textColor }}
                    title={`${team.name} (Planning...)`}
                  >
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
