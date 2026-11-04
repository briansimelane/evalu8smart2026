import React, { useMemo } from 'react';
import { GameState, SimulationClass } from '@/types/game';
import { calculatePlayOrderForState } from '@/hooks/useGameBoardState';
import { AVAILABLE_IMPROVEMENT_CARDS, ImprovementCardData } from '@/data/improvements';
import { ModalShell } from './ModalShell';
import { ImprovementEffectTile } from './ImprovementEffectTile';
import { cn } from '@/lib/utils';
import { Check, Sparkles, AlertCircle } from 'lucide-react';

interface ImprovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData: SimulationClass;
  gameState: GameState;
  quality?: 'auto' | 'high' | 'low';
  reducedMotion?: boolean;
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

const EFFECT_LABELS: Record<string, string> = {
  'Price Plus': 'Price +$1',
  'Price and Product': 'Price −$1, +1 Product',
  'Product': '+1 Product',
  'Research': '+1 Research',
  'Logistic': '+1 Logistics',
};

export function ImprovementModal({
  isOpen,
  onClose,
  classData,
  gameState,
  quality = 'auto',
  reducedMotion = false,
}: ImprovementModalProps) {
  const round = gameState.currentRound;
  const roundData = gameState.rounds?.find(r => r.roundNumber === round);
  const isRound5OrLater = round >= 5;

  // Turn Order
  const playOrder = useMemo(() => {
    return calculatePlayOrderForState(gameState, round);
  }, [gameState, round]);

  // Card Pool derivation
  const poolCards = useMemo((): ImprovementCardData[] => {
    if (isRound5OrLater) return [];

    let poolIds = gameState.improvementPoolByRound?.[round] || [];
    if (poolIds.length === 0) {
      const usedCardIds = (gameState.improvementCards || [])
        .filter(c => c.used || c.allocatedInRound)
        .map(c => Number(c.id));
      const available = AVAILABLE_IMPROVEMENT_CARDS.filter(c => !usedCardIds.includes(c.id));
      const count = Math.max(gameState.teams.length, 5);
      poolIds = available.slice(0, count).map(c => c.id);
    }

    return poolIds
      .map(id => AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === id))
      .filter((c): c is ImprovementCardData => !!c);
  }, [gameState, round, isRound5OrLater]);

  // Claims map: cardId -> Team
  const claimsByCardId = useMemo(() => {
    const map: Record<number, typeof gameState.teams[0]> = {};
    (gameState.improvementCards || []).forEach(c => {
      if (c.allocatedInRound === round) {
        const teamId = c.availableForTeam || c.usedBy;
        if (teamId) {
          const team = gameState.teams.find(t => t.id === teamId);
          if (team) {
            map[Number(c.id)] = team;
          }
        }
      }
    });
    return map;
  }, [gameState.improvementCards, gameState.teams, round]);

  // Claims map: teamId -> claimedCardId
  const claimsByTeamId = useMemo(() => {
    const map: Record<string, number> = {};
    (gameState.improvementCards || []).forEach(c => {
      if (c.allocatedInRound === round) {
        const teamId = c.availableForTeam || c.usedBy;
        if (teamId) {
          map[teamId] = Number(c.id);
        }
      }
    });
    return map;
  }, [gameState.improvementCards, round]);

  // Active choosing team (first team in play order with improvement points > 0 and no card claimed yet)
  const activeChoosingTeam = useMemo(() => {
    if (isRound5OrLater) return null;
    return playOrder.find(team => {
      const pts = roundData?.teamData?.[team.id]?.improvementCards || 0;
      const hasClaimed = !!claimsByTeamId[team.id];
      return pts > 0 && !hasClaimed;
    }) || null;
  }, [playOrder, roundData, claimsByTeamId, isRound5OrLater]);

  const renderEffectSlot = (effectType: string, isClaimed: boolean) => {
    const isPriceAndProduct = effectType === 'Price and Product';

    return (
      <div className={cn(
        "relative w-full h-[152px] rounded-[14px] bg-[#f1f5f9] border border-[#e2e8f0] flex flex-col items-center justify-between py-3 transition-opacity",
        isClaimed && "opacity-55"
      )}>
        {/* Glossy Vector Icon Viewport */}
        <div className="w-[84px] h-[78px] relative flex items-center justify-center">
          <ImprovementEffectTile type={effectType} size={70} />
        </div>

        {/* Effect Label */}
        <span className={cn(
          "font-black text-[#0f172a] tracking-tight leading-tight px-1 text-center",
          isPriceAndProduct ? "text-[12px]" : "text-[14px]"
        )}>
          {EFFECT_LABELS[effectType] || effectType}
        </span>
      </div>
    );
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="IMPROVEMENTS"
      headerCategory={`CLASS: ${classData.name?.toUpperCase() || 'SMARTPHONE INC'}`}
      headerGradient="linear-gradient(90deg, #d97706 0%, #facc15 100%)"
      headerBadge={`ROUND ${round}`}
      headerNote={isRound5OrLater ? undefined : "Teams draft in turn order · 0 icons get Product card only"}
      titleColor="#1c1917"
      categoryColor="#78350f"
      badgeBg="rgba(255, 255, 255, 0.45)"
      badgeBorder="rgba(120, 53, 15, 0.5)"
      badgeTextColor="#1c1917"
      isLowQuality={quality === 'low'}
      reducedMotion={reducedMotion}
    >
      {isRound5OrLater ? (
        // Round 5+ Notice View
        <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center bg-slate-50">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-3xl font-black text-[#0f172a] mb-3 tracking-tight">
            No Improvement Phase in Round {round}
          </h2>
          <p className="text-lg text-slate-600 max-w-lg mb-8 leading-relaxed">
            In Round 5 and beyond, technology upgrades and product capacities are locked. Teams proceed directly to Research & Development and Market Expansion.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Return to Board
          </button>
        </div>
      ) : (
        // Standard Improvement Phase View (Rounds 1 - 4)
        <div className="w-full h-full px-11 py-6 flex flex-col justify-between overflow-hidden">
          {/* Main Content Area: Card Pool (Left) + Turn Order (Right) */}
          <div className="flex gap-8 items-start justify-between flex-1">
            {/* 1. Left: Card Pool */}
            <div className="flex-1 flex flex-col">
              <span className="text-[13px] font-black text-[#94a3b8] uppercase tracking-[2px] mb-3">
                CARD POOL
              </span>

              {/* Cards Row */}
              <div className="flex items-center gap-4 flex-wrap">
                {poolCards.map((card, idx) => {
                  const claimer = claimsByCardId[card.id];
                  const isClaimed = !!claimer;
                  const cardBorderColor = isClaimed ? claimer.color : '#10b981';
                  const claimerTextColor = isClaimed ? getContrastTextColor(claimer.color) : '#047857';

                  // Dynamic card width to guarantee fit for 5+ cards
                  const cardWidth = Math.min(172, Math.floor((920 - (poolCards.length - 1) * 16) / poolCards.length));

                  return (
                    <div
                      key={card.id}
                      style={{
                        width: `${cardWidth}px`,
                        borderColor: cardBorderColor,
                      }}
                      className={cn(
                        "h-[520px] rounded-[20px] border-[3px] bg-white shadow-sm flex flex-col justify-between p-3.5 transition-all duration-300",
                        isClaimed ? "border-solid bg-slate-50/70" : "border-emerald-500 hover:shadow-md"
                      )}
                    >
                      {/* Card Header */}
                      <div className="text-center">
                        <span className="text-[13px] font-black text-[#94a3b8] uppercase tracking-[2px]">
                          CARD {card.id}
                        </span>
                      </div>

                      {/* Two Effect Slots */}
                      <div className="flex flex-col gap-3 my-auto">
                        {renderEffectSlot(card.icon1, isClaimed)}
                        {renderEffectSlot(card.icon2, isClaimed)}
                      </div>

                      {/* Footer Band */}
                      {isClaimed ? (
                        <div
                          style={{
                            backgroundColor: claimer.color,
                            color: claimerTextColor,
                          }}
                          className="min-h-[50px] py-1 px-1.5 rounded-[12px] flex flex-col items-center justify-center shadow-xs text-center leading-tight"
                          title={`Claimed by ${claimer.name}`}
                        >
                          <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-85 leading-none">
                            CLAIMED BY
                          </span>
                          <span className="text-[13.5px] font-black tracking-wide truncate max-w-full uppercase mt-0.5 leading-tight">
                            {claimer.name.replace(/^TEAM\s+/i, '')}
                          </span>
                        </div>
                      ) : (
                        <div className="min-h-[50px] py-1 px-2 rounded-[12px] bg-[#ecfdf5] border-[2.5px] border-[#10b981] flex items-center justify-center text-[15px] font-black text-[#047857] tracking-wider">
                          AVAILABLE
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Right: Turn Order Panel */}
            <div className="w-[580px] shrink-0 flex flex-col">
              <span className="text-[13px] font-black text-[#94a3b8] uppercase tracking-[2px] mb-3">
                TURN ORDER
              </span>

              <div className="flex flex-col gap-3">
                {playOrder.map((team, idx) => {
                  const pts = roundData?.teamData?.[team.id]?.improvementCards || 0;
                  const claimedCardId = claimsByTeamId[team.id];
                  const isDone = !!claimedCardId;
                  const isChoosingNow = activeChoosingTeam?.id === team.id;
                  const teamTextColor = getContrastTextColor(team.color);

                  return (
                    <div
                      key={team.id}
                      className={cn(
                        "w-full h-[88px] rounded-[16px] px-5 flex items-center justify-between border transition-all duration-300",
                        isChoosingNow
                          ? "bg-[#fffbeb] border-[4px] border-[#f59e0b] shadow-md scale-[1.01]"
                          : "bg-[#f8fafc] border-[#e2e8f0]"
                      )}
                    >
                      {/* Left: Play Order # + Team Pill */}
                      <div className="flex items-center gap-4">
                        <span className="text-[26px] font-black text-[#94a3b8] w-6 text-center">
                          {idx + 1}
                        </span>

                        <div
                          style={{
                            backgroundColor: team.color,
                            color: teamTextColor,
                            ['--turn-pulse-color' as string]: team.color,
                          }}
                          className={cn(
                            "w-[130px] h-[40px] rounded-[12px] flex items-center justify-center text-[17px] font-black shadow-xs tracking-wide truncate px-2 transition-all duration-300",
                            isChoosingNow && "ring-2 ring-purple-600 ring-offset-2 animate-turn-pulse"
                          )}
                        >
                          {team.name}
                        </div>

                        {/* Points Chip */}
                        <div
                          className={cn(
                            "h-[36px] px-3.5 rounded-[10px] flex items-center justify-center font-black text-[17px] shadow-2xs",
                            pts === 0
                              ? "bg-amber-100/70 border border-amber-300 text-amber-900"
                              : "bg-white border border-[#cbd5e1] text-[#0f172a]"
                          )}
                          title={pts === 0 ? "0 improvement icons: receives default Product card only" : `${pts} improvement points`}
                        >
                          {pts} {pts === 1 ? 'pt' : 'pts'}
                        </div>
                      </div>

                      {/* Right: Status */}
                      <div className="flex items-center gap-3">
                        {isDone ? (
                          claimedCardId < 0 || pts === 0 ? (
                            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-[12px] bg-slate-100 border border-slate-300 shadow-2xs">
                              <ImprovementEffectTile type="Product" size={28} />
                              <div className="flex flex-col text-left">
                                <span className="text-[14px] font-black text-slate-800 leading-tight">
                                  Product Card Allocated
                                </span>
                                <span className="text-[12px] font-bold text-slate-500 leading-tight mt-0.5">
                                  Default card · +1 Product
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#10b981] flex items-center justify-center shadow-xs shrink-0">
                                <Check className="w-4 h-4 text-white stroke-[3.5]" />
                              </div>
                              <span className="text-[17px] font-extrabold text-[#334155]">
                                Claimed Card {claimedCardId}
                              </span>
                            </div>
                          )
                        ) : isChoosingNow ? (
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-[#f59e0b]" />
                              <div className="absolute w-10 h-10 rounded-full border-2 border-[#f59e0b] animate-ping opacity-75" />
                            </div>
                            <span className="text-[17px] font-black text-[#b45309]">
                              Choosing now…
                            </span>
                          </div>
                        ) : pts === 0 ? (
                          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-[12px] bg-amber-50 border border-amber-200 shadow-2xs">
                            <ImprovementEffectTile type="Product" size={28} />
                            <div className="flex flex-col text-left">
                              <span className="text-[14px] font-black text-[#78350f] leading-tight">
                                Gets Product Card Only
                              </span>
                              <span className="text-[12px] font-bold text-[#b45309] leading-tight mt-0.5">
                                0 improvement icons · +1 Product
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[16px] font-bold text-[#64748b]">
                            Waiting turn
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Bottom: Legend Strip */}
          <div className="pt-4 border-t border-[#e2e8f0] flex flex-col gap-2">
            <span className="text-[12px] font-black text-[#94a3b8] uppercase tracking-[2px]">
              WHAT THE ICONS DO
            </span>

            <div className="flex items-center gap-9 flex-wrap text-slate-700">
              <div className="flex items-center gap-2.5">
                <ImprovementEffectTile type="Price Plus" size={28} />
                <span className="text-[14px] font-extrabold">Price +$1</span>
              </div>

              <div className="flex items-center gap-2.5">
                <ImprovementEffectTile type="Price and Product" size={28} />
                <span className="text-[14px] font-extrabold">Price −$1, +1 Product</span>
              </div>

              <div className="flex items-center gap-2.5">
                <ImprovementEffectTile type="Product" size={28} />
                <span className="text-[14px] font-extrabold">+1 Product</span>
              </div>

              <div className="flex items-center gap-2.5">
                <ImprovementEffectTile type="Research" size={28} />
                <span className="text-[14px] font-extrabold">+1 Research icon</span>
              </div>

              <div className="flex items-center gap-2.5">
                <ImprovementEffectTile type="Logistic" size={28} />
                <span className="text-[14px] font-extrabold">+1 Logistics icon</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 rounded-[8px] bg-amber-50 border border-amber-200 ml-auto">
                <ImprovementEffectTile type="Product" size={22} />
                <span className="text-[13px] font-bold text-amber-900">
                  <span className="font-black">0 Icons:</span> Default Product card only (+1 Product)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
