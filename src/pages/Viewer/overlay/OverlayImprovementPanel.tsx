import React from 'react';
import { GameState } from '@/types/game';
import { WorldTag } from './WorldMarker';
import { getContrastTextColor } from './WorldMarker';
import { Sparkles } from 'lucide-react';

interface OverlayImprovementPanelProps {
  gameStateA: GameState;
  gameStateB: GameState;
}

export const OverlayImprovementPanel: React.FC<OverlayImprovementPanelProps> = ({ gameStateA, gameStateB }) => {
  const renderImprovementCards = (world: 'A' | 'B', gState: GameState) => {
    const cards = gState.improvementCards || [];
    const poolIds = gState.improvementPoolByRound?.[gState.currentRound] || [];
    
    // Filter to current round pool cards or first 4
    const displayCards = cards.filter(c => poolIds.length === 0 || poolIds.includes(c.id)).slice(0, 4);

    return (
      <div className="grid grid-cols-2 gap-1.5">
        {displayCards.map(card => {
          const claimer = card.availableForTeam ? gState.teams.find(t => t.id === card.availableForTeam) : null;
          const isTaken = Boolean(claimer);

          return (
            <div
              key={`${world}-${card.id}`}
              className="p-1.5 bg-white rounded-lg border border-slate-200 text-xs font-black shadow-xs relative flex flex-col justify-between overflow-hidden"
              style={{
                borderLeft: world === 'A' ? '3px solid #7c3aed' : '3px solid #475569'
              }}
            >
              {/* Effect Slots */}
              <div className="flex items-center gap-1 text-[11px] text-slate-800 font-extrabold">
                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                <span>{card.icon1} + {card.icon2}</span>
              </div>

              {/* Claimed Ribbon */}
              {claimer ? (
                <div
                  className="mt-1 text-[8px] font-black uppercase px-1 py-0.5 rounded text-center truncate shadow-2xs"
                  style={{
                    backgroundColor: claimer.color,
                    color: getContrastTextColor(claimer.color),
                  }}
                  title={`Taken by ${claimer.name}`}
                >
                  TAKEN BY: {claimer.name}
                </div>
              ) : (
                <div className="mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">
                  AVAILABLE
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="absolute top-0 bottom-0 right-0 w-[300px] bg-white/95 border-l border-slate-300 p-3 flex flex-col justify-between z-10 backdrop-blur-md shadow-lg select-none">
      {/* Title */}
      <span className="text-sm font-black text-slate-900 uppercase tracking-wider border-b-2 border-slate-400 pb-1 w-full text-center">
        Improvements Market
      </span>

      {/* World A Section */}
      <div className="space-y-1.5 bg-purple-50/80 p-2 rounded-xl border border-purple-200 flex-1 flex flex-col justify-start overflow-hidden my-1">
        <div className="flex items-center justify-between">
          <WorldTag world="A" label="WORLD A MARKET" className="text-[9px]" />
          <span className="text-[9px] text-purple-700 font-bold">Round {gameStateA.currentRound}</span>
        </div>
        {renderImprovementCards('A', gameStateA)}
      </div>

      {/* World B Section */}
      <div className="space-y-1.5 bg-slate-100/90 p-2 rounded-xl border border-slate-200 flex-1 flex flex-col justify-start overflow-hidden">
        <div className="flex items-center justify-between">
          <WorldTag world="B" label="WORLD B MARKET" className="text-[9px]" />
          <span className="text-[9px] text-slate-600 font-bold">Round {gameStateB.currentRound}</span>
        </div>
        {renderImprovementCards('B', gameStateB)}
      </div>
    </div>
  );
};
