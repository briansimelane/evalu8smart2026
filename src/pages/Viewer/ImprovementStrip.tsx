import React, { useMemo, useState, useEffect } from 'react';
import { GameState, Team, calculateTeamTotalScore, getControlPointsForTeamInRound, getTeamPatentPoints, getInitialScore } from '@/types/game';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { Plus, Minus, Trophy, Award, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
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
  const currentPhase = (gameState.currentPhase || 'planning').toLowerCase();
  const m = useMotion();

  const isScoringPhase = currentPhase === 'scoring';
  const [scoringTab, setScoringTab] = useState<'scoreboard' | 'upcoming'>('scoreboard');
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  const toggleExpand = (teamId: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  // Reset scoringTab to 'scoreboard' whenever entering scoring phase
  useEffect(() => {
    if (isScoringPhase) {
      setScoringTab('scoreboard');
    }
  }, [isScoringPhase, round]);

  // Check if improvement phase for current round has been completed
  const isImprovementCompleted = ['research', 'innovation', 'logistics', 'expansion', 'sales', 'control', 'scoring'].includes(currentPhase);

  // Check if all teams with >0 improvement points have claimed cards
  const currentRoundData = gameState.rounds.find(r => r.roundNumber === round);
  const teamsWithPoints = gameState.teams.filter(t => (currentRoundData?.teamData[t.id]?.improvementCards || 0) > 0);
  const allClaimed = teamsWithPoints.length > 0 && teamsWithPoints.every(t =>
    (gameState.improvementCards || []).some(c =>
      (c.availableForTeam === t.id || c.usedBy === t.id) &&
      (c.allocatedInRound === undefined || Number(c.allocatedInRound) === Number(round))
    )
  );
  
  // Show upcoming round cards if improvement phase for current round is completed and round < 4
  const isUpcomingPreview = (isImprovementCompleted && round < 4) || (isScoringPhase && scoringTab === 'upcoming' && round < 4);
  const activeDisplayRound = isUpcomingPreview ? round + 1 : round;

  // Determine card pool for activeDisplayRound
  const pool = useMemo(() => {
    const storedPool = gameState.improvementPoolByRound?.[activeDisplayRound];
    if (storedPool && storedPool.length > 0) {
      return storedPool;
    }

    if (isUpcomingPreview) {
      const usedCardIds = (gameState.improvementCards || [])
        .filter(c => c.used || c.allocatedInRound)
        .map(c => c.id);
      
      const currentRoundPool = gameState.improvementPoolByRound?.[round] || [];
      
      const available = AVAILABLE_IMPROVEMENT_CARDS.filter(
        c => !usedCardIds.includes(c.id) && !currentRoundPool.includes(c.id)
      );

      return available.slice(0, gameState.teams.length).map(c => c.id);
    }

    return gameState.improvementPoolByRound?.[round] || [];
  }, [gameState.improvementPoolByRound, activeDisplayRound, isUpcomingPreview, gameState.improvementCards, round, gameState.teams.length]);

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
      
      const claimedCard = !isUpcomingPreview 
        ? (gameState.improvementCards || []).find(c =>
            Number(c.id) === Number(cardId) &&
            (c.allocatedInRound === undefined || Number(c.allocatedInRound) === Number(round))
          )
        : null;

      return {
        id: cardId,
        data: cardData,
        claimed: claimedCard,
      };
    });
  }, [pool, gameState.improvementCards, round, isUpcomingPreview]);

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
            <div className="flex items-center gap-1.5 justify-between">
              <div className="flex items-center gap-1.5">
                <GameIcon type="improvement" size="xs" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Marketplace</span>
              </div>
              {isUpcomingPreview && (
                <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" /> Preview Next Round
                </span>
              )}
            </div>
            <span className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Improvements</span>
            <span className={cn(
              "text-[9px] font-bold italic",
              isUpcomingPreview ? "text-amber-700 font-extrabold" : "text-slate-500"
            )}>
              {isUpcomingPreview 
                ? `Round ${activeDisplayRound} Upcoming Cards (Next Round)`
                : `Round ${round} Card Pool`
              }
            </span>
          </div>

          {/* Vertical Market Cards List */}
          <div className="flex flex-col gap-2 justify-start shrink-0">
            {round >= 5 ? (
              <div className="w-[250px] p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 text-center shadow-xs">
                <span>⚠️ No Improvement Phase in Round 5</span>
              </div>
            ) : (
              marketCards.map(({ id, data, claimed }) => {
              if (!data) return null;

              const claimerId = claimed?.availableForTeam || claimed?.usedBy;
              const claimingTeam = claimerId 
                ? gameState.teams.find(t => t.id === claimerId) 
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
            })
          )}

            {/* Empty slot placeholders */}
            {pool.length === 0 && (
              <div className="w-full flex items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 text-xs font-black italic">
                No improvements on offer this round
              </div>
            )}
          </div>
        </>
      )}

      {/* 2. Scoring Phase: Full-Height Animated Scoreboard or Upcoming Cards View */}
      {isScoringPhase && (
        <div className="flex flex-col gap-3 h-full animate-fade-in">
          {/* Header & Tab Controls */}
          <div className="flex flex-col border-b-2 border-amber-400 pb-2.5 shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <GameIcon type="scoring" size="sm" showLabel={false} />
              <span className="text-base font-black text-slate-900 uppercase tracking-tight">Round {round} Scoring</span>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setScoringTab('scoreboard')}
                className={cn(
                  "flex-1 py-1.5 px-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  scoringTab === 'scoreboard'
                    ? "bg-amber-500 text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <GameIcon type="scoring" size="xs" showLabel={false} />
                <span>Scoreboard</span>
              </button>
              {round < 4 && (
                <button
                  type="button"
                  onClick={() => setScoringTab('upcoming')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    scoringTab === 'upcoming'
                      ? "bg-amber-500 text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  )}
                >
                  <GameIcon type="improvement" size="xs" showLabel={false} />
                  <span>Next Cards</span>
                </button>
              )}
            </div>
          </div>

          {scoringTab === 'scoreboard' ? (
            <div className="flex flex-col gap-2 flex-1 justify-start py-1 overflow-y-auto pr-0.5">
              {(() => {
                const currentRoundData = gameState.rounds.find(r => r.roundNumber === round);

                return orderedScoredTeams.map(({ team }, idx) => {
                  const rankNum = idx + 1;
                  const isWinner = rankNum === 1;
                  const textColor = getContrastTextColor(team.color);
                  const isExpanded = !!expandedTeams[team.id];

                  // Calculate 6-part score breakdown
                  const teamRoundData = currentRoundData?.teamData[team.id];
                  const revenue = teamRoundData?.revenue || 0;
                  const controlPoints = getControlPointsForTeamInRound(currentRoundData, team.id, gameState);
                  const patentBonus = getTeamPatentPoints(team.id, gameState.patents, round, gameState.gameEnded, round);
                  const currentYearScore = revenue + controlPoints + patentBonus;

                  const pastRoundScore = round > 1 
                    ? calculateTeamTotalScore(team.id, round - 1, gameState).totalScore
                    : getInitialScore(team);

                  const overallValue = pastRoundScore + currentYearScore;

                  // Reveal order: bottom team (highest index) reveals FIRST (0ms delay),
                  // second from bottom reveals second, up to 1st place winner revealing LAST
                  const totalTeams = orderedScoredTeams.length;
                  const revealOrderIndex = (totalTeams - 1) - idx;
                  const delayMs = revealOrderIndex * 750;

                  return (
                    <div 
                      key={team.id}
                      style={{
                        animation: 'mo-arrive 0.6s cubic-bezier(0.34, 1.3, 0.64, 1) both',
                        animationDelay: `${delayMs}ms`
                      }}
                      onClick={() => toggleExpand(team.id)}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col gap-2.5 shadow-xs hover:shadow-md transition-all cursor-pointer select-none shrink-0",
                        isWinner 
                          ? 'border-amber-300 bg-amber-50/60' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      )}
                    >
                      {/* Main Compact Row: Rank, Team Name + Current Score, Total Score Badge, Chevron */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Rank & Team Name + Current Score */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span 
                            style={{ backgroundColor: team.color, color: textColor }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-xs shrink-0 border border-black/10"
                          >
                            #{rankNum}
                          </span>

                          <div className="flex flex-col min-w-0">
                            <span className="font-black text-base text-slate-900 uppercase tracking-tight truncate flex items-center gap-1.5">
                              {team.name}
                              {isWinner && <Trophy className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />}
                            </span>
                            
                            {/* Current Score displayed right under team name */}
                            <span className="text-xs font-black text-emerald-600 tracking-wide">
                              Current: +${currentYearScore.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Total Score & Expand Icon */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Total Score Badge */}
                          <div className="flex flex-col items-end bg-slate-900 text-white px-3 py-1 rounded-xl shadow-xs">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Total Score</span>
                            <span className="text-base font-black tracking-tight">
                              ${overallValue.toLocaleString()}
                            </span>
                          </div>

                          {/* Chevron Icon */}
                          <div className="text-slate-400 hover:text-slate-700 transition-colors pl-0.5">
                            {isExpanded ? <ChevronUp className="w-5 h-5 stroke-[2.5]" /> : <ChevronDown className="w-5 h-5 stroke-[2.5]" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Breakdown Details Grid */}
                      {isExpanded && (
                        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-200/80 animate-fade-in text-slate-900">
                          {/* 1. Revenue */}
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Revenue</span>
                            <span className="text-sm font-black text-emerald-600">+${revenue.toLocaleString()}</span>
                          </div>

                          {/* 2. Control */}
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Control</span>
                            <span className="text-sm font-black text-amber-600">+{controlPoints} pts</span>
                          </div>

                          {/* 3. Patents */}
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Patents</span>
                            <span className="text-sm font-black text-purple-600">+{patentBonus} pts</span>
                          </div>

                          {/* 4. Past Round Score */}
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Past Score</span>
                            <span className="text-sm font-black text-slate-700">${pastRoundScore.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            /* Upcoming Cards View tab in Scoring Phase */
            <div className="flex flex-col gap-2 justify-start shrink-0">
              <span className="text-[10px] font-black text-amber-700 italic border-b border-slate-200 pb-1">
                Round {round + 1} Upcoming Cards (Preview for Next Round)
              </span>
              {marketCards.map(({ id, data }) => {
                if (!data) return null;

                return (
                  <div 
                    key={id}
                    className="relative rounded-xl border-2 border-slate-200 bg-white p-2 flex flex-col items-center justify-center shrink-0 shadow-xs"
                  >
                    <div className="flex items-center justify-center gap-2 w-full py-0.5">
                      <div className="flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 shadow-2xs flex-1 h-13">
                        {renderEffectSlot(data.icon1)}
                      </div>
                      <span className="text-slate-300 text-sm font-black">+</span>
                      <div className="flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 shadow-2xs flex-1 h-13">
                        {renderEffectSlot(data.icon2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
