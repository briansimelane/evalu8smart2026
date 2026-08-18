import React from 'react';
import { GameState } from '@/types/game';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { WorldTag, getContrastTextColor } from './WorldMarker';
import { Plus, Minus } from 'lucide-react';
import { useOptionalMotion } from '../motion/MotionContext';
import { getMotionClass, getMotionStyles } from '../motion/motionClass';
import { cn } from '@/lib/utils';

interface OverlayImprovementPanelProps {
  gameStateA: GameState;
  gameStateB: GameState;
}

export const OverlayImprovementPanel: React.FC<OverlayImprovementPanelProps> = ({ gameStateA, gameStateB }) => {
  const m = useOptionalMotion();

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
    const round = gState.currentRound;
    const rawPhase = (gState.currentPhase || 'planning').toLowerCase();
    const isImprovementCompleted = ['research', 'innovation', 'logistics', 'expansion', 'sales', 'control', 'scoring'].includes(rawPhase);

    // Check if all teams with >0 improvement points have claimed cards
    const currentRoundData = gState.rounds.find(r => r.roundNumber === round);
    const teamsWithPoints = gState.teams.filter(t => (currentRoundData?.teamData[t.id]?.improvementCards || 0) > 0);
    const allClaimed = teamsWithPoints.length > 0 && teamsWithPoints.every(t =>
      (gState.improvementCards || []).some(c => (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === round)
    );

    const isUpcomingPreview = isImprovementCompleted && round < 4;
    const activeDisplayRound = isUpcomingPreview ? round + 1 : round;

    // Retrieve pool IDs for activeDisplayRound
    let poolIds = gState.improvementPoolByRound?.[activeDisplayRound] || [];

    if (poolIds.length === 0) {
      if (isUpcomingPreview) {
        const usedCardIds = (gState.improvementCards || []).filter(c => c.used || c.allocatedInRound).map(c => c.id);
        const currentRoundPool = gState.improvementPoolByRound?.[round] || [];
        const available = AVAILABLE_IMPROVEMENT_CARDS.filter(c => !usedCardIds.includes(c.id) && !currentRoundPool.includes(c.id));
        poolIds = available.slice(0, gState.teams.length).map(c => c.id);
      } else {
        const usedCardIds = (gState.improvementCards || []).filter(c => c.used).map(c => c.id);
        const available = AVAILABLE_IMPROVEMENT_CARDS.filter(c => !usedCardIds.includes(c.id));
        poolIds = available.slice(0, gState.teams.length).map(c => c.id);
      }
    }

    // Map pool IDs to display objects
    const displayCards = poolIds.slice(0, 4).map(id => {
      const staticData = AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === id);
      const claimedCard = !isUpcomingPreview
        ? (gState.improvementCards || []).find(c =>
            Number(c.id) === Number(id) &&
            Number(c.allocatedInRound) === Number(round)
          )
        : null;

      const claimerId = claimedCard?.availableForTeam || claimedCard?.usedBy;

      return {
        id,
        icon1: claimedCard?.icon1 || staticData?.icon1 || 'Research',
        icon2: claimedCard?.icon2 || staticData?.icon2 || 'Product',
        availableForTeam: claimerId || null
      };
    });

    // Check all team claims for current round summary (Strictly Round N claims)
    const teamClaims = gState.teams.map(team => {
      const cards = (gState.improvementCards || []).filter(c =>
        (c.availableForTeam === team.id || c.usedBy === team.id) &&
        Number(c.allocatedInRound) === Number(round)
      );
      return { team, cards };
    }).filter(tc => tc.cards.length > 0);

    return (
      <div className="flex flex-col gap-1.5 flex-1 justify-between">
        {round >= 5 ? (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[10px] font-bold text-amber-900 text-center">
            <span>⚠️ No Improvement Phase in Round 5</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {displayCards.map(card => {
            const icon1 = card.icon1;
            const icon2 = card.icon2;
            const claimer = card.availableForTeam ? gState.teams.find(t => t.id === card.availableForTeam) : null;

            const impKey = `improvement:${card.id}`;
            const isNewClaim = m ? m.tierFor(impKey) === 1 : false;
            const impClass = m ? getMotionClass(m, impKey, 'sm') : '';
            const impStyles = (m && claimer) ? getMotionStyles(m, impKey, claimer.color) : {};
            const impChanged = m ? m.tierFor(impKey) > 0 : false;

            return (
              <div
                key={`${world}-${card.id}`}
                className={cn(
                  "p-1.5 bg-white rounded-lg border border-slate-200 text-xs font-black shadow-xs relative flex flex-col justify-between overflow-hidden transition-all duration-300 mo-dimmable",
                  impChanged && "z-20 border-2 border-amber-400 shadow-md",
                  impClass,
                  isNewClaim && 'mo-arrive'
                )}
                style={{
                  borderLeft: world === 'A' ? '3px solid #7c3aed' : '3px solid #475569',
                  ...(claimer ? { borderColor: claimer.color } : {}),
                  ...impStyles
                }}
                data-changed={impChanged ? '1' : undefined}
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
                    {isUpcomingPreview ? 'PREVIEW' : 'AVAILABLE'}
                  </div>
                )}
              </div>
            );
          })}

          {displayCards.length === 0 && (
            <div className="col-span-2 p-3 text-center text-xs font-bold text-slate-400 italic bg-white/60 rounded-lg border border-dashed border-slate-200">
              No improvements on offer
            </div>
          )}
          </div>
        )}

        {/* Team Decisions Summary for Current Round (Visual Card Icons Marked by Team Color) */}
        {teamClaims.length > 0 && (
          <div className="pt-1.5 border-t border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider block">
                Round {round} Decisions:
              </span>
              <span className="text-[8px] font-bold text-slate-400">
                {teamClaims.length}/{gState.teams.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {teamClaims.map(({ team, cards }) => {
                return cards.map(card => {
                  const staticData = AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === card.id);
                  const icon1 = card.icon1 || staticData?.icon1 || 'Research';
                  const icon2 = card.icon2 || staticData?.icon2 || 'Product';
                  const isProductCard = card.id < 0;

                  return (
                    <div
                      key={`claim-sum-${world}-${team.id}-${card.id}`}
                      className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-white border border-slate-300 shadow-xs transition-all hover:scale-105"
                      style={{
                        borderColor: team.color,
                        borderLeftWidth: '4px',
                      }}
                      title={`${team.name}: ${isProductCard ? 'Product Card' : `${icon1} + ${icon2}`}`}
                    >
                      {/* Team Color Circle Marker */}
                      <div
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: team.color,
                          color: getContrastTextColor(team.color)
                        }}
                      >
                        {team.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Visual Card Effect Icons (No Words) */}
                      <div className="flex items-center gap-0.5 scale-75 origin-left">
                        {isProductCard ? (
                          <GameIcon type="production" size="xs" showLabel={false} />
                        ) : (
                          <>
                            {renderEffectSlot(icon1)}
                            {icon2 && icon2 !== 'None' && (
                              <>
                                <span className="text-slate-300 text-[8px] font-black">+</span>
                                {renderEffectSlot(icon2)}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const isPreviewA = (() => {
    const rawPhase = (gameStateA.currentPhase || 'planning').toLowerCase();
    const isCompleted = ['research', 'innovation', 'logistics', 'expansion', 'sales', 'control', 'scoring'].includes(rawPhase);
    const roundData = gameStateA.rounds.find(r => r.roundNumber === gameStateA.currentRound);
    const teamsWithPoints = gameStateA.teams.filter(t => (roundData?.teamData[t.id]?.improvementCards || 0) > 0);
    const allClaimed = teamsWithPoints.length > 0 && teamsWithPoints.every(t => (gameStateA.improvementCards || []).some(c => (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === gameStateA.currentRound));
    return (isCompleted || allClaimed) && gameStateA.currentRound < 4;
  })();

  const isPreviewB = (() => {
    const rawPhase = (gameStateB.currentPhase || 'planning').toLowerCase();
    const isCompleted = ['research', 'innovation', 'logistics', 'expansion', 'sales', 'control', 'scoring'].includes(rawPhase);
    const roundData = gameStateB.rounds.find(r => r.roundNumber === gameStateB.currentRound);
    const teamsWithPoints = gameStateB.teams.filter(t => (roundData?.teamData[t.id]?.improvementCards || 0) > 0);
    const allClaimed = teamsWithPoints.length > 0 && teamsWithPoints.every(t => (gameStateB.improvementCards || []).some(c => (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === gameStateB.currentRound));
    return (isCompleted || allClaimed) && gameStateB.currentRound < 4;
  })();

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
          <span className="text-[9px] text-purple-700 font-bold">
            {isPreviewA ? `Preview Rd ${gameStateA.currentRound + 1}` : `Round ${gameStateA.currentRound}`}
          </span>
        </div>
        {renderImprovementCards('A', gameStateA)}
      </div>

      {/* World B Section */}
      <div className="space-y-1.5 bg-slate-100/90 p-2 rounded-xl border border-slate-200 flex-1 flex flex-col justify-start overflow-hidden">
        <div className="flex items-center justify-between">
          <WorldTag world="B" label="WORLD B MARKET" className="text-[9px]" />
          <span className="text-[9px] text-slate-600 font-bold">
            {isPreviewB ? `Preview Rd ${gameStateB.currentRound + 1}` : `Round ${gameStateB.currentRound}`}
          </span>
        </div>
        {renderImprovementCards('B', gameStateB)}
      </div>
    </div>
  );
};
