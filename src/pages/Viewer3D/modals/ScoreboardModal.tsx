import React, { useMemo } from 'react';
import { GameState, SimulationClass, calculateTeamTotalScore } from '@/types/game';
import { ModalShell } from './ModalShell';
import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';

interface ScoreboardModalProps {
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

export function ScoreboardModal({
  isOpen,
  onClose,
  classData,
  gameState,
  quality = 'auto',
  reducedMotion = false,
}: ScoreboardModalProps) {
  const round = gameState.currentRound;
  const currentRoundData = gameState.rounds?.find(r => r.roundNumber === round);

  // Calculate scores and ranks
  const rankedTeams = useMemo(() => {
    const scored = gameState.teams.map(team => {
      const currentScore = calculateTeamTotalScore(team.id, round, gameState);
      const prevScore = round > 1 ? calculateTeamTotalScore(team.id, round - 1, gameState) : null;
      const gainThisRound = prevScore
        ? currentScore.totalScore - prevScore.totalScore
        : currentScore.totalScore - currentScore.startValue;

      // Owned patents
      const ownedPatents: string[] = [];
      if (gameState.patents) {
        Object.entries(gameState.patents).forEach(([techName, ownerId]) => {
          if (ownerId === team.id) {
            ownedPatents.push(techName);
          }
        });
      }

      const totalMoney = currentRoundData?.teamData?.[team.id]?.totalMoney || 0;

      return {
        team,
        score: currentScore,
        gainThisRound: Math.max(0, gainThisRound),
        ownedPatents,
        totalMoney,
      };
    });

    // Sort descending by totalScore, tie-break by currentRound totalMoney
    scored.sort((a, b) => {
      if (b.score.totalScore !== a.score.totalScore) {
        return b.score.totalScore - a.score.totalScore;
      }
      return b.totalMoney - a.totalMoney;
    });

    return scored;
  }, [gameState, round, currentRoundData]);

  // Max score for bar scaling
  const maxScore = useMemo(() => {
    const scores = rankedTeams.map(t => t.score.totalScore);
    return Math.max(...scores, 1);
  }, [rankedTeams]);

  const isGameEnded = !!gameState.gameEnded;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="SCOREBOARD"
      headerCategory={`CLASS: ${classData.name?.toUpperCase() || 'SMARTPHONE INC'}`}
      headerGradient="linear-gradient(90deg, #1e3a8a 0%, #3b5bdb 100%)"
      headerBadge={`ROUND ${round}`}
      titleColor="#ffffff"
      categoryColor="#bfd0ff"
      badgeBg="rgba(255, 255, 255, 0.18)"
      badgeBorder="rgba(255, 255, 255, 0.5)"
      badgeTextColor="#ffffff"
      isLowQuality={quality === 'low'}
      reducedMotion={reducedMotion}
    >
      <div className="w-full h-full px-11 py-5 flex flex-col justify-between overflow-hidden">
        {/* 1. Legend Row */}
        <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-7 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-[5px] bg-[#94a3b8]" />
              <span className="text-[14px] font-bold text-[#475569]">Start value</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-[5px] bg-[#38bdf8]" />
              <span className="text-[14px] font-bold text-[#475569]">Revenue</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-[5px] bg-[#8b5cf6]" />
              <span className="text-[14px] font-bold text-[#475569]">Control points</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-[5px] bg-[#f59e0b]" />
              <span className="text-[14px] font-bold text-[#475569]">Patents</span>
            </div>

            {isGameEnded && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-[5px] bg-[#10b981]" />
                  <span className="text-[14px] font-bold text-[#475569]">Wildcards</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-[5px] bg-[#ec4899]" />
                  <span className="text-[14px] font-bold text-[#475569]">Directives</span>
                </div>
              </>
            )}
          </div>

          <span className="text-[13px] font-bold text-[#94a3b8]">
            {isGameEnded
              ? "Final Standing"
              : "Wildcard and directive bonuses are added at game end"}
          </span>
        </div>

        {/* 2. Column Headers */}
        <div className="flex items-center px-6 py-2 text-[12px] font-black text-[#94a3b8] uppercase tracking-[1.5px]">
          <div className="w-[320px]">RANK / TEAM</div>
          <div className="w-[140px] text-center">START</div>
          <div className="w-[140px] text-center">REVENUE</div>
          <div className="w-[140px] text-center">CONTROL</div>
          <div className="w-[260px] text-center">PATENTS</div>
          <div className="w-[170px] text-center">THIS ROUND</div>
          <div className="flex-1 text-right pr-6">TOTAL</div>
        </div>

        {/* 3. Team Rows List */}
        <div className="flex-1 flex flex-col justify-start gap-2.5 overflow-hidden">
          {rankedTeams.map((entry, idx) => {
            const { team, score, gainThisRound, ownedPatents } = entry;
            const isLeader = idx === 0;
            const teamTextColor = getContrastTextColor(team.color);

            return (
              <div
                key={team.id}
                className={cn(
                  "relative w-full h-[116px] rounded-[18px] border px-6 flex flex-col justify-between py-3 transition-all duration-300",
                  isLeader
                    ? "bg-white border-[2.5px] border-[#94a3b8] shadow-sm"
                    : "bg-[#f8fafc] border-[#e2e8f0]"
                )}
              >
                {/* Row Stats Top Half */}
                <div className="flex items-center">
                  {/* Left: Position # + Team Pill */}
                  <div className="w-[320px] flex items-center gap-3.5">
                    {/* Position Number (1, 2, 3 and others - uniform neutral styling, no medal colors) */}
                    <div className="w-11 h-11 rounded-full bg-[#f1f5f9] border-2 border-[#cbd5e1] flex items-center justify-center font-black text-[#1e293b] text-[20px] shadow-2xs shrink-0">
                      {idx + 1}
                    </div>

                    {/* Team Pill */}
                    <div
                      style={{ backgroundColor: team.color, color: teamTextColor }}
                      className="h-[40px] px-5 rounded-[12px] flex items-center justify-center text-[18px] font-black shadow-xs tracking-wide truncate max-w-[220px]"
                      title={team.name}
                    >
                      {team.name}
                    </div>
                  </div>

                  {/* START */}
                  <div className="w-[140px] text-center font-black text-[26px] text-[#64748b]">
                    {score.startValue}
                  </div>

                  {/* REVENUE */}
                  <div className="w-[140px] text-center font-black text-[26px] text-[#0284c7]">
                    {score.cumulativeRevenue}
                  </div>

                  {/* CONTROL */}
                  <div className="w-[140px] text-center font-black text-[26px] text-[#7c3aed]">
                    {score.cumulativeControl}
                  </div>

                  {/* PATENTS */}
                  <div className="w-[260px] flex items-center justify-center gap-1.5 flex-wrap">
                    {ownedPatents.length > 0 ? (
                      <>
                        {ownedPatents.map(pName => (
                          <div
                            key={pName}
                            className="px-2 py-0.5 rounded-[10px] bg-[#fffbeb] border border-[#f59e0b] text-[11px] font-black text-[#b45309]"
                          >
                            {pName.toUpperCase()}
                          </div>
                        ))}
                        <span className="font-black text-[18px] text-[#d97706] ml-1">
                          +{score.patentBonus}
                        </span>
                      </>
                    ) : (
                      <span className="font-black text-[22px] text-[#cbd5e1]">—</span>
                    )}
                  </div>

                  {/* THIS ROUND GAIN */}
                  <div className="w-[170px] flex items-center justify-center gap-1">
                    <ArrowUp className="w-5 h-5 text-[#10b981] stroke-[3]" />
                    <span className="font-black text-[24px] text-[#059669]">
                      +{gainThisRound}
                    </span>
                  </div>

                  {/* TOTAL */}
                  <div className="flex-1 text-right pr-6 flex flex-col items-end leading-none">
                    <span className="font-black text-[40px] text-[#0f172a] tracking-tight">
                      {score.totalScore}
                    </span>
                    <span className="text-[10px] font-black text-[#94a3b8] tracking-[1.5px] mt-0.5">
                      POINTS
                    </span>
                  </div>
                </div>

                {/* Stacked Progress Bar */}
                <div className="w-full pl-[60px] pr-6">
                  <div className="w-full h-[14px] rounded-[7px] border border-[#e2e8f0] overflow-hidden flex bg-slate-100">
                    {score.startValue > 0 && (
                      <div
                        style={{ width: `${(score.startValue / maxScore) * 100}%` }}
                        className="h-full bg-[#94a3b8]"
                        title={`Start: ${score.startValue}`}
                      />
                    )}
                    {score.cumulativeRevenue > 0 && (
                      <div
                        style={{ width: `${(score.cumulativeRevenue / maxScore) * 100}%` }}
                        className="h-full bg-[#38bdf8]"
                        title={`Revenue: ${score.cumulativeRevenue}`}
                      />
                    )}
                    {score.cumulativeControl > 0 && (
                      <div
                        style={{ width: `${(score.cumulativeControl / maxScore) * 100}%` }}
                        className="h-full bg-[#8b5cf6]"
                        title={`Control: ${score.cumulativeControl}`}
                      />
                    )}
                    {score.patentBonus > 0 && (
                      <div
                        style={{ width: `${(score.patentBonus / maxScore) * 100}%` }}
                        className="h-full bg-[#f59e0b]"
                        title={`Patents: ${score.patentBonus}`}
                      />
                    )}
                    {score.wildcardBonus > 0 && (
                      <div
                        style={{ width: `${(score.wildcardBonus / maxScore) * 100}%` }}
                        className="h-full bg-[#10b981]"
                        title={`Wildcards: ${score.wildcardBonus}`}
                      />
                    )}
                    {score.directiveBonus > 0 && (
                      <div
                        style={{ width: `${(score.directiveBonus / maxScore) * 100}%` }}
                        className="h-full bg-[#ec4899]"
                        title={`Directives: ${score.directiveBonus}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. Footer Note */}
        <div className="text-center pt-2">
          <span className="text-[13px] font-bold text-[#94a3b8]">
            Click anywhere outside or press Esc to close
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
