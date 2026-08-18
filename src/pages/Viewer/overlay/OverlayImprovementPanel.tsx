import React from 'react';
import { GameState } from '@/types/game';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { WorldTag, getContrastTextColor } from './WorldMarker';
import { Plus, Minus } from 'lucide-react';

interface OverlayImprovementPanelProps {
  gameStateA: GameState;
  gameStateB: GameState;
}

export const OverlayImprovementPanel: React.FC<OverlayImprovementPanelProps> = ({ gameStateA, gameStateB }) => {
  const renderEffectSlot = (iconType: string) => {
    if (iconType === 'Price and Product') {
      return (
        <div className="flex items-center gap-1">
          <div className="relative inline-block" title="Price Decrease (-$1)">
            <GameIcon type="price" size="sm" showLabel={false} />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-slate-900 border border-red-500 flex items-center justify-center shadow-xs">
              <Minus className="h-2.5 w-2.5 text-red-500 stroke-[3]" />
            </div>
          </div>
          <GameIcon type="production" size="sm" showLabel={false} />
        </div>
      );
    }
    
    if (iconType === 'Price Plus') {
      return (
        <div className="relative inline-block" title="Price Increase (+$1)">
          <GameIcon type="price" size="sm" showLabel={false} />
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-slate-900 border border-emerald-500 flex items-center justify-center shadow-xs">
            <Plus className="h-2.5 w-2.5 text-emerald-400 stroke-[3]" />
          </div>
        </div>
      );
    }

    if (iconType === 'Price Minus') {
      return (
        <div className="relative inline-block" title="Price Decrease (-$1)">
          <GameIcon type="price" size="sm" showLabel={false} />
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-slate-900 border border-red-500 flex items-center justify-center shadow-xs">
            <Minus className="h-2.5 w-2.5 text-red-500 stroke-[3]" />
          </div>
        </div>
      );
    }

    if (iconType === 'Research') return <GameIcon type="research" size="sm" showLabel={false} />;
    if (iconType === 'Product') return <GameIcon type="production" size="sm" showLabel={false} />;
    if (iconType === 'Logistic') return <GameIcon type="logistics" size="sm" showLabel={false} />;

    return <GameIcon type={iconType} size="sm" showLabel={false} />;
  };

  const renderImprovementCards = (world: 'A' | 'B', gState: GameState) => {
    const cards = gState.improvementCards || [];
    const poolIds = gState.improvementPoolByRound?.[gState.currentRound] || [];
    
    // Filter to current round pool cards or fallback to available cards
    let displayCards = cards.filter(c => poolIds.length === 0 || poolIds.includes(c.id)).slice(0, 4);

    if (displayCards.length === 0 && poolIds.length > 0) {
      displayCards = poolIds.map(id => {
        const found = cards.find(c => c.id === id);
        if (found) return found;
        const staticData = AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === id);
        return {
          id,
          icon1: staticData?.icon1 || 'Research',
          icon2: staticData?.icon2 || 'Product',
          availableForTeam: null
        } as any;
      }).slice(0, 4);
    }

    return (
      <div className="grid grid-cols-2 gap-1.5">
        {displayCards.map(card => {
          const staticData = AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === card.id);
          const icon1 = card.icon1 || staticData?.icon1 || 'Research';
          const icon2 = card.icon2 || staticData?.icon2 || 'Product';

          const claimer = card.availableForTeam ? gState.teams.find(t => t.id === card.availableForTeam) : null;

          return (
            <div
              key={`${world}-${card.id}`}
              className="p-1.5 bg-white rounded-lg border border-slate-200 text-xs font-black shadow-xs relative flex flex-col justify-between overflow-hidden"
              style={{
                borderLeft: world === 'A' ? '3px solid #7c3aed' : '3px solid #475569'
              }}
            >
              {/* Effect Icons Slot */}
              <div className="flex items-center justify-center gap-1 w-full py-1">
                <div className="flex items-center justify-center p-1 rounded bg-slate-50 border border-slate-200 shadow-2xs flex-1 h-8">
                  {renderEffectSlot(icon1)}
                </div>
                <span className="text-slate-300 text-[10px] font-black">+</span>
                <div className="flex items-center justify-center p-1 rounded bg-slate-50 border border-slate-200 shadow-2xs flex-1 h-8">
                  {renderEffectSlot(icon2)}
                </div>
              </div>

              {/* Claimed Ribbon or Available Tag */}
              {claimer ? (
                <div
                  className="mt-0.5 text-[8px] font-black uppercase px-1 py-0.5 rounded text-center truncate shadow-2xs"
                  style={{
                    backgroundColor: claimer.color,
                    color: getContrastTextColor(claimer.color),
                  }}
                  title={`Taken by ${claimer.name}`}
                >
                  TAKEN BY: {claimer.name}
                </div>
              ) : (
                <div className="mt-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">
                  AVAILABLE
                </div>
              )}
            </div>
          );
        })}

        {displayCards.length === 0 && (
          <div className="col-span-2 p-3 text-center text-xs font-bold text-slate-400 italic bg-white/60 rounded-lg border border-dashed border-slate-200">
            No improvements this round
          </div>
        )}
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
