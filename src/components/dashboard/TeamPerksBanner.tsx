import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { DIRECTIVES_LIST } from './DirectivesClaimModal';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Trophy, Award, Sparkles, Zap } from 'lucide-react';
import { SteveIcon } from './SteveIcon';

import { isRuleActiveForTeam } from '@/lib/defaultRules';

interface TeamPerksBannerProps {
  teamId?: string;
}

export const TeamPerksBanner: React.FC<TeamPerksBannerProps> = ({ teamId: propTeamId }) => {
  const { gameState } = useGame();
  const { currentTeamId } = useSession();

  if (!gameState) return null;

  const currentRound = gameState.currentRound || 1;
  const actingTeamId = propTeamId || currentTeamId || gameState.teams[0]?.id;
  const actingTeam = gameState.teams.find(t => t.id === actingTeamId);

  if (!actingTeam) return null;

  const isWildcardsActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'wildcard_tokens_system', actingTeamId);
  const isDirectivesActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'directives_bonus_points', actingTeamId);
  const isTechPerksActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'tech_permanent_benefits', actingTeamId);

  // 1. Patents held by this team
  const patentsObj = gameState.patents || {};
  const teamPatents = Object.entries(patentsObj)
    .filter(([_, holderId]) => holderId === actingTeamId)
    .map(([techName]) => techName);

  // 2. Directives claimed by this team
  const directivesList = gameState.advancedState?.directives || [];
  const teamDirectives = directivesList.filter(d => d.teamId === actingTeamId);

  // 3. Wildcard tokens
  const wildcardData = gameState.advancedState?.wildcards?.[actingTeamId] || {
    teamId: actingTeamId,
    totalTokens: 10,
    usedInRound: {},
  };
  const usedTotal = Object.values(wildcardData.usedInRound || {}).reduce(
    (a: number, b: number) => Number(a) + Number(b),
    0
  );
  const remainingWildcards = Math.max(0, (wildcardData.totalTokens || 10) - usedTotal);
  const usedThisRound = Number(wildcardData.usedInRound?.[currentRound] || 0);

  // 4. Steve state
  const activeSteveRegion = gameState.advancedState?.steve?.activeRegion;

  // 5. Tech perks
  const completedTechs = gameState.teamResearchProgress?.[actingTeamId]?.completedTechnologies || [];

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3.5 shadow-sm rounded-xl space-y-2.5">
      {/* Header bar with light theme styling */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full shadow-sm ring-2 ring-slate-100 dark:ring-slate-800" style={{ backgroundColor: actingTeam.color }} />
          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
            {actingTeam.name} — Dashboard Assets & Perks
          </span>
        </div>

        {/* Wildcard Counter Badge */}
        {isWildcardsActive && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 font-mono text-xs px-2.5 py-1">
              Wildcard Tokens: <span className="font-extrabold text-indigo-900 dark:text-white">{remainingWildcards} / 10 Left</span>
            </Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
        {/* Patents Section */}
        <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-slate-950/60 border border-amber-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-400">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Patents Owned
            </span>
            <Badge className="bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 text-[10px]">
              {teamPatents.length} Owned
            </Badge>
          </div>
          {teamPatents.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {teamPatents.map(p => (
                <Badge key={p} className="bg-amber-500 text-white font-semibold text-[11px] shadow-sm">
                  🏆 {p} (+3 VPs End Game)
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">No patents owned yet.</span>
          )}
        </div>

        {/* Directives Section */}
        {isDirectivesActive ? (
          <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-slate-950/60 border border-emerald-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Directives Awarded
              </span>
              <Badge className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 text-[10px]">
                {teamDirectives.length} Claimed
              </Badge>
            </div>
            {teamDirectives.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {teamDirectives.map(d => {
                  const def = DIRECTIVES_LIST.find(dl => dl.id === d.id);
                  return (
                    <Badge key={d.id} className="bg-emerald-600 text-white font-semibold text-[11px] shadow-sm">
                      ⭐ #{def?.number || d.id}: {def?.title || d.id} (+12 VPs End Game)
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">No directives allocated yet.</span>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1 text-slate-400">
            <span className="font-bold flex items-center gap-1.5 text-xs text-slate-500">
              <Award className="h-4 w-4" /> Directives Rule Disabled
            </span>
            <p className="text-[11px]">Directives bonus points rule is switched OFF by facilitator.</p>
          </div>
        )}

        {/* Active Perks & Steve Alert Section */}
        <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-slate-950/60 border border-indigo-200/80 dark:border-slate-800 space-y-1.5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-400">
            <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Active Perks & Events
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-0.5">
            {activeSteveRegion && (
              <Badge className="bg-red-600 text-white font-bold text-[10px] shadow-sm animate-pulse">
                <SteveIcon size={12} /> Steve Blocking {activeSteveRegion}
              </Badge>
            )}

            {completedTechs.includes('GPS') && (
              <Badge variant="outline" className="border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300 text-[10px] font-semibold">
                ⚡ GPS (+5 Products Bonus)
              </Badge>
            )}
            {completedTechs.includes('Battery') && (
              <Badge variant="outline" className="border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 text-[10px] font-semibold">
                ⚡ Battery (+1 Logistics on Price Up)
              </Badge>
            )}
            {completedTechs.includes('Gaming') && (
              <Badge variant="outline" className="border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 text-[10px] font-semibold">
                ⚡ Gaming (-$1 Tech Cost)
              </Badge>
            )}

            {!activeSteveRegion && completedTechs.length === 0 && (
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">No active events or special tech perks.</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
