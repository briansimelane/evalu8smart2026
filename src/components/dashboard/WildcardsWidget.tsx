import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { Sparkles, Package, Microscope, Truck, Wrench, Plus, Minus, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { COMBINATIONS } from '@/data/combinations';
import { isRuleActiveForTeam } from '@/lib/defaultRules';

interface WildcardsWidgetProps {
  teamId: string;
  planImprovementPoints?: number;
}

export const WildcardsWidget: React.FC<WildcardsWidgetProps> = ({ teamId, planImprovementPoints }) => {
  const { gameState, allocateWildcardToken, contributeWildcardsToSteve } = useGame();
  const { isReadOnly } = useSession();
  const currentRound = gameState?.currentRound || 1;

  const isWildcardsActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'wildcard_tokens_system', teamId);

  if (!isWildcardsActive) {
    return null;
  }

  const wildcardData = gameState?.advancedState?.wildcards?.[teamId] || {
    teamId,
    totalTokens: 10,
    usedInRound: {},
    conversionsByRound: {},
  };

  const usedTotal = Object.values(wildcardData.usedInRound || {}).reduce((a, b) => Number(a) + Number(b), 0);
  const remainingTokens = Math.max(0, (wildcardData.totalTokens || 10) - usedTotal);

  const currentRoundConvs = wildcardData.conversionsByRound?.[currentRound] || {};

  const steveData = gameState?.advancedState?.steve || {
    activeRegion: null,
    wildcardsContributed: {},
  };
  const steveTotalContributed = Object.values(steveData.wildcardsContributed || {}).reduce((a, b) => Number(a) + Number(b), 0);

  const usedThisRound = Number(wildcardData.usedInRound?.[currentRound] || 0);

  // Determine if the team's plan sheet already provides an Improvement icon
  const roundData = gameState?.rounds?.find(r => r.roundNumber === currentRound)?.teamData?.[teamId];
  const combos = gameState?.combinationsData && gameState.combinationsData.length > 0 ? gameState.combinationsData : COMBINATIONS;
  const comboData = roundData ? combos.find(c => c.combination === roundData.combination && c.position === roundData.position) : undefined;
  const planImprove = planImprovementPoints !== undefined ? planImprovementPoints : (comboData?.improve ?? 0);

  const handleAdjustToken = (
    targetType: 'product' | 'research' | 'logistics' | 'improvement',
    delta: number
  ) => {
    if (!gameState) return;
    if (isReadOnly) {
      toast.error("Only your team's CEO can allocate wildcard tokens.");
      return;
    }

    const currentCount = Number(currentRoundConvs[targetType] || 0);

    // If decreasing
    if (delta < 0) {
      if (currentCount <= 0) return;
      allocateWildcardToken(teamId, targetType, delta);
      toast.info(`Removed 1 ${targetType.toUpperCase()} Wildcard icon.`);
      return;
    }

    // If increasing (delta > 0)
    // Specific check for Improvement
    if (targetType === 'improvement') {
      if (planImprove >= 1) {
        toast.warning(
          "Your plan already has 1 Improvement icon from your plan sheets. You cannot allocate an Improvement Wildcard when the plan already includes an Improvement."
        );
        return;
      }
      if (currentCount >= 1) {
        toast.warning(
          "You cannot allocate a second Improvement Wildcard. Maximum 1 Improvement is allowed per round."
        );
        return;
      }
    } else {
      if (currentCount >= 2) {
        toast.warning(`Maximum 2 Wildcard tokens allowed for ${targetType.toUpperCase()}.`);
        return;
      }
    }

    // Check remaining tokens
    if (remainingTokens <= 0) {
      toast.warning("No wildcard tokens remaining (0 / 10 left).");
      return;
    }

    allocateWildcardToken(teamId, targetType, delta);
    toast.success(`Converted 1 Wildcard Token to +1 ${targetType.toUpperCase()} icon!`, {
      description: `Round usage: ${usedThisRound + 1}/2 • Remaining tokens: ${remainingTokens - 1}`,
    });
  };

  const handleAdjustSteve = (delta: number) => {
    if (!gameState) return;
    if (isReadOnly) {
      toast.error("Only your team's CEO can allocate wildcard tokens.");
      return;
    }
    if (!steveData.activeRegion && delta > 0) {
      toast.info('Steve is not currently blocking any region.');
      return;
    }

    contributeWildcardsToSteve(teamId, delta);
    if (delta > 0) {
      toast.success(`Contributed 1 Wildcard token toward clearing Steve (${steveTotalContributed + 1}/5 paid).`);
    } else {
      toast.info(`Removed 1 Wildcard token from Steve.`);
    }
  };

  return (
    <Card className="border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm rounded-xl p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            Wildcard Tokens
            {isReadOnly && (
              <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 font-semibold gap-1">
                <Lock className="h-2.5 w-2.5" /> Read Only (CEO Only)
              </Badge>
            )}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <Badge variant="outline" className="text-xs border-indigo-300 dark:border-indigo-500/40 text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 font-bold">
            {remainingTokens} / 10 Left
          </Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <div>
          Spend <span className="font-bold text-slate-700 dark:text-slate-200">up to 2 tokens/action</span> (Product, Research, Logistics), <span className="font-bold text-slate-700 dark:text-slate-200">up to 1 token</span> for Improvement. Leftover tokens award 1 VP each at Game End.
        </div>
        {isReadOnly && (
          <span className="text-[10px] italic text-amber-600 dark:text-amber-400 font-medium shrink-0">
            *Only your team's CEO can allocate tokens.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Product Conversion (Black Box) */}
        <div className="p-2.5 rounded-lg border border-slate-900 bg-slate-900 text-white dark:bg-slate-950 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <Package className="h-4 w-4 text-slate-100 flex-shrink-0" />
            <span className="font-bold truncate text-[11px] text-white">Product</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800 dark:bg-slate-900 p-1 rounded-md border border-slate-700 dark:border-slate-800 flex-shrink-0">
            <Button
              type="button"
              size="sm"
              disabled={isReadOnly || (currentRoundConvs.product || 0) <= 0}
              onClick={() => handleAdjustToken('product', -1)}
              className="h-6 w-6 p-0 rounded-md font-bold text-white bg-red-600 hover:bg-red-700 active:scale-90 transition-all duration-150 shadow-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
              title="Decrease Product wildcard"
            >
              <Minus className="h-3 w-3 stroke-[3] text-white" />
            </Button>
            <span className="font-mono font-bold text-[11px] px-1 text-white">{currentRoundConvs.product || 0} / 2</span>
            <Button
              type="button"
              size="sm"
              disabled={isReadOnly}
              onClick={() => handleAdjustToken('product', 1)}
              className="h-6 w-6 p-0 rounded-md font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-90 transition-all duration-150 shadow-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
              title="Increase Product wildcard"
            >
              <Plus className="h-3 w-3 stroke-[3] text-white" />
            </Button>
          </div>
        </div>

        {/* Improvement Conversion (Max 1 - Amber Box) */}
        <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/40 dark:border-amber-900 flex items-center justify-between shadow-xs">
          <div className="flex flex-col truncate pr-1">
            <div className="flex items-center gap-1.5 truncate">
              <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="font-bold truncate text-[11px] text-amber-950 dark:text-amber-100">Improve</span>
            </div>
            {planImprove >= 1 && (
              <span className="text-[9px] text-amber-700 dark:text-amber-300 font-medium leading-tight">
                Plan has 1
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-800 flex-shrink-0 shadow-xs">
            <Button
              type="button"
              size="sm"
              disabled={isReadOnly || (currentRoundConvs.improvement || 0) <= 0}
              onClick={() => handleAdjustToken('improvement', -1)}
              className="h-6 w-6 p-0 rounded-md font-bold text-white bg-red-600 hover:bg-red-700 active:scale-90 transition-all duration-150 shadow-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
              title="Decrease Improvement wildcard"
            >
              <Minus className="h-3 w-3 stroke-[3] text-white" />
            </Button>
            <span className="font-mono font-bold text-[11px] px-1 text-slate-800 dark:text-slate-100">
              {currentRoundConvs.improvement || 0} / 1
            </span>
            <Button
              type="button"
              size="sm"
              disabled={isReadOnly}
              onClick={() => handleAdjustToken('improvement', 1)}
              className="h-6 w-6 p-0 rounded-md font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-90 transition-all duration-150 shadow-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
              title={
                planImprove >= 1
                  ? "Plan already includes an Improvement from plan sheets"
                  : (currentRoundConvs.improvement || 0) >= 1
                  ? "Improvement capped at 1"
                  : "Increase Improvement wildcard"
              }
            >
              <Plus className="h-3 w-3 stroke-[3] text-white" />
            </Button>
          </div>
        </div>

        {/* Research Conversion (Purple Box) */}
        <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/40 dark:border-purple-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <Microscope className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <span className="font-bold truncate text-[11px] text-purple-950 dark:text-purple-100">Research</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-800 flex-shrink-0 shadow-xs">
            <Button
              type="button"
              size="sm"
              disabled={isReadOnly || (currentRoundConvs.research || 0) <= 0}
              onClick={() => handleAdjustToken('research', -1)}
              className="h-6 w-6 p-0 rounded-md font-bold text-white bg-red-600 hover:bg-red-700 active:scale-90 transition-all duration-150 shadow-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
              title="Decrease Research wildcard"
            >
              <Minus className="h-3 w-3 stroke-[3] text-white" />
            </Button>
            <span className="font-mono font-bold text-[11px] px-1 text-slate-800 dark:text-slate-100">
              {currentRoundConvs.research || 0} / 2
            </span>
            <Button
              type="button"
              size="sm"
              disabled={isReadOnly}
              onClick={() => handleAdjustToken('research', 1)}
              className="h-6 w-6 p-0 rounded-md font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-90 transition-all duration-150 shadow-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
              title="Increase Research wildcard"
            >
              <Plus className="h-3 w-3 stroke-[3] text-white" />
            </Button>
          </div>
        </div>

        {/* Logistics Conversion (Blue Box) */}
        <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/40 dark:border-blue-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="font-bold truncate text-[11px] text-blue-950 dark:text-blue-100">Logistics</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 dark:border-slate-800 flex-shrink-0 shadow-xs">
            <Button
              type="button"
              size="sm"
              disabled={isReadOnly || (currentRoundConvs.logistics || 0) <= 0}
              onClick={() => handleAdjustToken('logistics', -1)}
              className="h-6 w-6 p-0 rounded-md font-bold text-white bg-red-600 hover:bg-red-700 active:scale-90 transition-all duration-150 shadow-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
              title="Decrease Logistics wildcard"
            >
              <Minus className="h-3 w-3 stroke-[3] text-white" />
            </Button>
            <span className="font-mono font-bold text-[11px] px-1 text-slate-800 dark:text-slate-100">
              {currentRoundConvs.logistics || 0} / 2
            </span>
            <Button
              type="button"
              size="sm"
              disabled={isReadOnly}
              onClick={() => handleAdjustToken('logistics', 1)}
              className="h-6 w-6 p-0 rounded-md font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-90 transition-all duration-150 shadow-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
              title="Increase Logistics wildcard"
            >
              <Plus className="h-3 w-3 stroke-[3] text-white" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
