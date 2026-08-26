import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Package, Microscope, Truck, Wrench, Plus, Minus, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { SteveIcon } from './SteveIcon';

import { isRuleActiveForTeam } from '@/lib/defaultRules';

export const FacilitatorWildcardConsole: React.FC = () => {
  const { gameState, allocateWildcardToken, contributeWildcardsToSteve, moveSteve } = useGame();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(gameState?.teams[0]?.id || '');

  if (!gameState) return null;

  const isWildcardsActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'wildcard_tokens_system');

  if (!isWildcardsActive) {
    return (
      <Card className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 rounded-xl">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Wildcard Tokens System (Advanced Rule 2) is Switched OFF
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The Wildcards rule is currently disabled in Facilitator Rules. No wildcard tokens are issued to teams.
        </p>
      </Card>
    );
  }

  const currentRound = gameState.currentRound || 1;
  const currentPhase = (gameState.currentPhase || 'planning').toLowerCase();
  const teams = gameState.teams || [];
  const activeTeamId = selectedTeamId || teams[0]?.id;
  const activeTeam = teams.find(t => t.id === activeTeamId);

  const wildcardData = gameState.advancedState?.wildcards?.[activeTeamId] || {
    teamId: activeTeamId,
    totalTokens: 10,
    usedInRound: {},
    conversionsByRound: {},
  };

  const usedTotal: number = Number(Object.values(wildcardData.usedInRound || {}).reduce((acc: number, val: any) => acc + Number(val || 0), 0));
  const remainingTokens: number = Math.max(0, Number(wildcardData.totalTokens || 10) - usedTotal);

  const currentRoundConvs = wildcardData.conversionsByRound?.[currentRound] || {};

  const steveData = gameState.advancedState?.steve || {
    activeRegion: null,
    wildcardsContributed: {},
  };
  const steveTotalContributed: number = Number(Object.values(steveData.wildcardsContributed || {}).reduce((acc: number, val: any) => acc + Number(val || 0), 0));

  const usedThisRound = Number(wildcardData.usedInRound?.[currentRound] || 0);
  const isRoundCapReached = usedThisRound >= 2;

  const handleAdjustPhaseToken = (
    targetType: 'product' | 'research' | 'logistics' | 'improvement',
    delta: number
  ) => {
    if (!activeTeamId) return;
    allocateWildcardToken(activeTeamId, targetType, delta);
    if (delta > 0) {
      toast.success(`Facilitator added +1 ${targetType.toUpperCase()} Wildcard icon for ${activeTeam?.name}!`);
    } else {
      toast.info(`Facilitator removed 1 ${targetType.toUpperCase()} Wildcard icon from ${activeTeam?.name}.`);
    }
  };

  const handleAdjustSteveToken = (teamId: string, delta: number) => {
    if (!steveData.activeRegion && delta > 0) {
      toast.info('Steve is not currently blocking any region.');
      return;
    }
    contributeWildcardsToSteve(teamId, delta);
    const targetTeamObj = teams.find(t => t.id === teamId);
    if (delta > 0) {
      toast.success(`Allocated 1 Wildcard Token from ${targetTeamObj?.name} to Steve!`);
    } else {
      toast.info(`Removed 1 Wildcard Token from ${targetTeamObj?.name} for Steve.`);
    }
  };

  return (
    <Card className="border border-indigo-200 dark:border-indigo-500/40 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm rounded-xl space-y-3 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <div className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              Facilitator Wildcard Allocation Console
              <Badge variant="outline" className="border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-semibold">
                Phase: {currentPhase.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rule: Teams can use <span className="font-bold text-slate-800 dark:text-slate-200">up to 2 tokens total per round</span> across conversions & Steve removal.
            </p>
          </div>
        </div>

        {/* Team Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">Target Team:</span>
          <Select value={activeTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="h-8 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 font-medium">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
              {teams.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Team Token Summary */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: activeTeam?.color }} />
          <span className="font-bold text-slate-900 dark:text-slate-100">{activeTeam?.name} Wildcard Tokens:</span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <Badge variant="outline" className="border-indigo-300 dark:border-indigo-500/40 text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 text-xs font-extrabold">
            {remainingTokens} / 10 Remaining
          </Badge>
          <Badge variant="outline" className={`text-xs font-bold ${isRoundCapReached ? 'border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/40' : 'border-slate-300 text-slate-600'}`}>
            R{currentRound}: {usedThisRound}/2 Used
          </Badge>
        </div>
      </div>

      {/* Phase Controls Grid (+ and - for 0, 1, 2) */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Phase Wildcard Controls for {activeTeam?.name} (max 2/round combined):</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {/* Production Phase Card */}
          <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-slate-950/50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">Production</div>
                <div className="text-[10px] text-slate-500">+1 Product Icon</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-800">
              <Button
                size="sm"
                variant="ghost"
                disabled={(currentRoundConvs.product || 0) <= 0}
                onClick={() => handleAdjustPhaseToken('product', -1)}
                className="h-6 w-6 p-0 text-xs text-red-600"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="font-bold px-1 text-slate-900 dark:text-slate-100">{currentRoundConvs.product || 0} / 2</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={(currentRoundConvs.product || 0) >= 2 || isRoundCapReached || remainingTokens <= 0}
                onClick={() => handleAdjustPhaseToken('product', 1)}
                className="h-6 w-6 p-0 text-xs text-emerald-600"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Improvement Phase Card */}
          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-slate-950/50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">Improvement</div>
                <div className="text-[10px] text-slate-500">+1 Improve Card</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-800">
              <Button
                size="sm"
                variant="ghost"
                disabled={(currentRoundConvs.improvement || 0) <= 0}
                onClick={() => handleAdjustPhaseToken('improvement', -1)}
                className="h-6 w-6 p-0 text-xs text-red-600"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="font-bold px-1 text-slate-900 dark:text-slate-100">{currentRoundConvs.improvement || 0} / 2</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={(currentRoundConvs.improvement || 0) >= 2 || isRoundCapReached || remainingTokens <= 0}
                onClick={() => handleAdjustPhaseToken('improvement', 1)}
                className="h-6 w-6 p-0 text-xs text-amber-600"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Research Phase Card */}
          <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-slate-950/50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Microscope className="h-4 w-4 text-purple-600" />
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">Research</div>
                <div className="text-[10px] text-slate-500">+1 Research Icon</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-800">
              <Button
                size="sm"
                variant="ghost"
                disabled={(currentRoundConvs.research || 0) <= 0}
                onClick={() => handleAdjustPhaseToken('research', -1)}
                className="h-6 w-6 p-0 text-xs text-red-600"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="font-bold px-1 text-slate-900 dark:text-slate-100">{currentRoundConvs.research || 0} / 2</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={(currentRoundConvs.research || 0) >= 2 || isRoundCapReached || remainingTokens <= 0}
                onClick={() => handleAdjustPhaseToken('research', 1)}
                className="h-6 w-6 p-0 text-xs text-purple-600"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Logistics Phase Card */}
          <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-slate-950/50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-rose-600" />
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">Logistics</div>
                <div className="text-[10px] text-slate-500">+1 Logistics Icon</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-800">
              <Button
                size="sm"
                variant="ghost"
                disabled={(currentRoundConvs.logistics || 0) <= 0}
                onClick={() => handleAdjustPhaseToken('logistics', -1)}
                className="h-6 w-6 p-0 text-xs text-red-600"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="font-bold px-1 text-slate-900 dark:text-slate-100">{currentRoundConvs.logistics || 0} / 2</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={(currentRoundConvs.logistics || 0) >= 2 || isRoundCapReached || remainingTokens <= 0}
                onClick={() => handleAdjustPhaseToken('logistics', 1)}
                className="h-6 w-6 p-0 text-xs text-rose-600"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Team Steve Removal Console */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
            <SteveIcon size={18} />
            Unblock Region Console (Multi-Team Token Split — Up to 5 tokens)
          </div>
          <Badge variant="outline" className={`text-xs font-mono font-bold ${steveTotalContributed >= 5 ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10'}`}>
            {steveTotalContributed} / 5 Tokens Paid {steveTotalContributed >= 5 ? '— Ready to Clear!' : ''}
          </Badge>
        </div>

        {steveTotalContributed >= 5 && steveData.activeRegion && (
          <Button
            onClick={() => {
              moveSteve(null);
              toast.success(`Steve cleared from ${steveData.activeRegion}! Region is now unblocked.`);
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md py-2"
          >
            Clear Steve (5/5 Tokens Paid — Unblock {steveData.activeRegion})
          </Button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {teams.map(t => {
            const teamSteveContrib = steveData.wildcardsContributed?.[t.id] || 0;
            const tWildcardData = gameState.advancedState?.wildcards?.[t.id] || { totalTokens: 10, usedInRound: {} };
            const tUsedTotal: number = Number(Object.values(tWildcardData.usedInRound || {}).reduce((acc: number, val: any) => acc + Number(val || 0), 0));
            const tRemaining: number = Math.max(0, Number(tWildcardData.totalTokens || 10) - tUsedTotal);
            const tUsedInCurrentRound = Number(tWildcardData.usedInRound?.[currentRound] || 0);

            return (
              <div key={t.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="font-bold truncate">{t.name.split(' ')[0]}</span>
                </div>

                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-slate-200 dark:border-slate-800 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={teamSteveContrib <= 0}
                    onClick={() => handleAdjustSteveToken(t.id, -1)}
                    className="h-5 w-5 p-0 text-[10px] text-red-600"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </Button>
                  <span className="font-mono font-bold text-[11px] px-1">{teamSteveContrib}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={tRemaining <= 0 || !steveData.activeRegion || steveTotalContributed >= 5 || tUsedInCurrentRound >= 2}
                    onClick={() => handleAdjustSteveToken(t.id, 1)}
                    className="h-5 w-5 p-0 text-[10px] text-emerald-600"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
