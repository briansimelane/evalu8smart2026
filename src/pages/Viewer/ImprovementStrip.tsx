import React, { useMemo } from 'react';
import { GameState, Team, calculateTeamTotalScore } from '@/types/game';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { Plus, Minus, Trophy, Award } from 'lucide-react';
import { useMotion } from './motion/MotionContext';
import { getMotionClass, getMotionStyles } from './motion/motionClass';
import { cn } from '@/lib/utils';

interface ImprovementStripProps {
  gameState: GameState;
}

// Helper to calculate high-contrast text color (black vs white) for any background hex
const getContrastTextColor = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
};

export function ImprovementStrip({ gameState }: ImprovementStripProps) {
  const round = gameState.currentRound;
  const pool = gameState.improvementPoolByRound?.[round] || [];
  const m = useMotion();

  const isScoringPhase = (gameState.currentPhase || '').toLowerCase() === 'scoring';

  // Calculate teams sorted by total score in DESCENDING order
  const orderedScoredTeams = useMemo(() => {
    const teamsWithScore = gameState.teams.map(team => {
      const scoreObj = calculateTeamTotalScore(team.id, round, gameState);
      return {
        team,
        score: scoreObj.totalScore,
      };
    });

    return teamsWithScore.sort((a, b) => b.score - a.score);
  }, [gameState, round]);

  // Map pool card IDs to card states
  const marketCards = useMemo(() => {
    return pool.map(cardId => {
      const cardData = AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === cardId);
      
      const claimedCard = gameState.improvementCards.find(c => 
        c.id === cardId && c.allocatedInRound === round
      );

      return {
        id: cardId,
        data: cardData,
        claimed: claimedCard,
      };
    });
  }, [pool, gameState.improvementCards, round]);

  const renderEffectSlot = (iconType: string) => {
    if (iconType === 'Price and Product') {
      return (
        <div className="flex items-center gap-2">
          <div className="relative inline-block" title="Price Decrease (-$1)">
            <GameIcon type="price" size="lg" showLabel={false} />
            <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-black border border-red-500 flex items-center justify-center shadow-md">
              <Minus className="h-3.5 w-3.5 text-red-500 stroke-[3]" />
            </div>
          </div>
          <GameIcon type="production" size="lg" showLabel={false} />
        </div>
      );
    }
    
    if (iconType === 'Price Plus') {
      return (
        <div className="relative inline-block" title="Price Increase (+$1)">
          <GameIcon type="price" size="lg" showLabel={false} />
          <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-black border border-emerald-500 flex items-center justify-center shadow-md">
            <Plus className="h-3.5 w-3.5 text-emerald-400 stroke-[3]" />
          </div>
        </div>
      );
    }

    if (iconType === 'Price Minus') {
      return (
        <div className="relative inline-block" title="Price Decrease (-$1)">
          <GameIcon type="price" size="lg" showLabel={false} />
          <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-black border border-red-500 flex items-center justify-center shadow-md">
            <Minus className="h-3.5 w-3.5 text-red-500 stroke-[3]" />
          </div>
        </div>
      );
    }

    if (iconType === 'Research') return <GameIcon type="research" size="lg" showLabel={false} />;
    if (iconType === 'Product') return <GameIcon type="production" size="lg" showLabel={false} />;
    if (iconType === 'Logistic') return <GameIcon type="logistics" size="lg" showLabel={false} />;

    return <GameIcon type={iconType} size="lg" showLabel={false} />;
  };

  return (
    <div className="absolute top-0 bottom-0 right-0 w-[300px] bg-white/95 border-l border-slate-300 p-4 flex flex-col gap-3 z-10 overflow-y-auto backdrop-blur-md shadow-xl text-slate-900">
      {/* 1. Normal Phase: Marketplace Improvements Pool */}
      {!isScoringPhase && (
        <>
          {/* Compact Header */}
          <div className="flex flex-col border-b border-slate-200 pb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <GameIcon type="improvement" size="xs" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Marketplace</span>
            </div>
            <span className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Improvements</span>
            <span className="text-[9px] text-slate-500 font-bold italic">Round {round} Card Pool</span>
          </div>

          {/* Vertical Market Cards List */}
          <div className="flex flex-col gap-2 justify-start shrink-0">
            {marketCards.map(({ id, data, claimed }) => {
              if (!data) return null;

              const claimingTeam = claimed?.availableForTeam 
                ? gameState.teams.find(t => t.id === claimed.availableForTeam) 
                : null;

              const impKey = `improvement:${id}`;
              const isNewClaim = m.tierFor(impKey) === 1;
              const impClass = getMotionClass(m, impKey, 'sm');
              const impStyles = getMotionStyles(m, impKey, claimingTeam?.color);
              const impChanged = m.tierFor(impKey) > 0;

              return (
                <div 
                  key={id}
                  style={{
                    ...(claimingTeam ? { borderColor: claimingTeam.color } : undefined),
                    ...impStyles
                  }}
                  className={cn(
                    "relative rounded-xl transition-all duration-300 p-2 flex flex-col items-center justify-center shrink-0 mo-dimmable",
                    claimingTeam 
                      ? 'border-4 bg-slate-50/90 shadow-md' 
                      : 'border-2 border-slate-200 bg-white hover:border-slate-400 shadow-xs',
                    impChanged && "z-20"
                  )}
                  data-changed={impChanged ? '1' : undefined}
                >
                  {/* Card Icons / Effect Display Only */}
                  <div className="flex items-center justify-center gap-2 w-full py-0.5">
                    <div className="flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 shadow-2xs flex-1 h-13">
                      {renderEffectSlot(data.icon1)}
                    </div>
                    <span className="text-slate-300 text-sm font-black">+</span>
                    <div className="flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 shadow-2xs flex-1 h-13">
                      {renderEffectSlot(data.icon2)}
                    </div>
                  </div>

                  {/* Claiming team ribbon overlay */}
                  {claimingTeam && (
                    <div 
                      style={{ backgroundColor: claimingTeam.color, ...impStyles }}
                      className={cn(
                        "absolute top-0 right-0 px-2.5 py-0.5 rounded-tr-xl rounded-bl-xl text-[10px] font-black text-white uppercase shadow-lg flex items-center gap-1 transition-all ring-2 ring-amber-400",
                        impClass,
                        isNewClaim && 'mo-arrive'
                      )}
                    >
                      <span>TAKEN BY: {claimingTeam.name.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty slot placeholders */}
            {pool.length === 0 && (
              <div className="w-full flex items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 text-xs font-black italic">
                No improvements on offer this round
              </div>
            )}
          </div>
        </>
      )}

      {/* 2. Scoring Phase: Full-Height Animated Scoreboard */}
      {isScoringPhase && (
        <div className="flex flex-col gap-3 h-full animate-fade-in">
          <div className="flex flex-col border-b-2 border-amber-400 pb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="text-base font-black text-slate-900 uppercase tracking-tight">Round {round} Scoreboard</span>
            </div>
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider mt-1">
              Revealing Team Scores (From Bottom to Top 🏆)
            </span>
          </div>

          <div className="flex flex-col gap-3.5 flex-1 justify-center py-2">
            {orderedScoredTeams.map(({ team, score }, idx) => {
              const rankNum = idx + 1;
              const isWinner = rankNum === 1;
              const textColor = getContrastTextColor(team.color);

              return (
                <div 
                  key={team.id}
                  className={cn(
                    "p-3.5 rounded-2xl border-2 flex items-center justify-between shadow-lg transition-all",
                    isWinner 
                      ? 'border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-50 ring-4 ring-amber-400/80 shadow-2xl scale-105 z-20' 
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  )}
                >
                  {/* Rank & Team Badge */}
                  <div className="flex items-center gap-2.5">
                    <span 
                      style={{ backgroundColor: team.color, color: textColor }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-md shrink-0 border border-black/10"
                    >
                      #{rankNum}
                    </span>

                    <div className="flex flex-col">
                      <span className="font-extrabold text-sm text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                        {team.name}
                        {isWinner && <Trophy className="w-4 h-4 text-amber-500 fill-amber-400" />}
                      </span>
                      {isWinner ? (
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1">
                          👑 ROUND WINNER!
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Rank #{rankNum}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Team Score */}
                  <div className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-sm font-black shadow-md tracking-tight">
                    <span>${score.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
