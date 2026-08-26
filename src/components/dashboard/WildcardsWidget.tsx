import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Sparkles, Package, Microscope, Truck, Wrench, Plus, Minus, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { SteveIcon } from './SteveIcon';

import { isRuleActiveForTeam } from '@/lib/defaultRules';

interface WildcardsWidgetProps {
  teamId: string;
}

export const WildcardsWidget: React.FC<WildcardsWidgetProps> = ({ teamId }) => {
  const { gameState, allocateWildcardToken, contributeWildcardsToSteve, moveSteve } = useGame();
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
  const teamSteveContrib = steveData.wildcardsContributed?.[teamId] || 0;
  const steveTotalContributed = Object.values(steveData.wildcardsContributed || {}).reduce((a, b) => Number(a) + Number(b), 0);

  const usedThisRound = Number(wildcardData.usedInRound?.[currentRound] || 0);

  const handleAdjustToken = (
    targetType: 'product' | 'research' | 'logistics' | 'improvement',
    delta: number
  ) => {
    if (!gameState) return;
    if (isReadOnly) {
      toast.error("Only your team's CEO can allocate wildcard tokens.");
      return;
    }
    allocateWildcardToken(teamId, targetType, delta);
    if (delta > 0) {
      toast.success(`Converted 1 Wildcard Token to +1 ${targetType.toUpperCase()} icon!`, {
        description: `Round usage: ${usedThisRound + 1}/2 • Remaining tokens: ${remainingTokens - 1}`,
      });
    } else {
      toast.info(`Removed 1 ${targetType.toUpperCase()} Wildcard icon.`);
    }
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
          Spend <span className="font-bold text-slate-700 dark:text-slate-200">up to 2 tokens/action</span> (Product, Research, Logistics), <span className="font-bold text-slate-700 dark:text-slate-200">up to 1 token</span> for Improvement. Steve unblocking is capped at <span className="font-bold text-slate-700 dark:text-slate-200">5 tokens total</span> jointly across teams.
        </div>
        {isReadOnly && (
          <span className="text-[10px] italic text-amber-600 dark:text-amber-400 font-medium shrink-0">
            *Only your team's CEO can allocate tokens.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        {/* Product Conversion (Black Box) */}
        <div className="p-2 rounded-lg border border-slate-900 bg-slate-900 text-white dark:bg-slate-950 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <Package className="h-3.5 w-3.5 text-slate-100 flex-shrink-0" />
            <span className="font-bold truncate text-[11px] text-white">Product</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 dark:bg-slate-900 p-0.5 rounded border border-slate-700 dark:border-slate-800 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              disabled={isReadOnly || (currentRoundConvs.product || 0) <= 0}
              onClick={() => handleAdjustToken('product', -1)}
              className="h-5 w-5 p-0 text-[10px] text-red-400 hover:text-red-300 hover:bg-slate-700"
            >
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <span className="font-mono font-bold text-[11px] px-1 text-white">{currentRoundConvs.product || 0} / 2</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={isReadOnly || (currentRoundConvs.product || 0) >= 2 || remainingTokens <= 0}
              onClick={() => handleAdjustToken('product', 1)}
              className="h-5 w-5 p-0 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-slate-700"
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>

        {/* Improvement Conversion (Max 1 - Amber Box) */}
        <div className="p-2 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/40 dark:border-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <Wrench className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="font-bold truncate text-[11px]">Improve</span>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-slate-200 dark:border-slate-800 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              disabled={isReadOnly || (currentRoundConvs.improvement || 0) <= 0}
              onClick={() => handleAdjustToken('improvement', -1)}
              className="h-5 w-5 p-0 text-[10px] text-red-600"
            >
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <span className="font-mono font-bold text-[11px] px-1">{currentRoundConvs.improvement || 0} / 1</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={isReadOnly || (currentRoundConvs.improvement || 0) >= 1 || remainingTokens <= 0}
              onClick={() => handleAdjustToken('improvement', 1)}
              className="h-5 w-5 p-0 text-[10px] text-amber-600"
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>

        {/* Research Conversion (Purple Box) */}
        <div className="p-2 rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/40 dark:border-purple-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <Microscope className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <span className="font-bold truncate text-[11px]">Research</span>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-slate-200 dark:border-slate-800 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              disabled={isReadOnly || (currentRoundConvs.research || 0) <= 0}
              onClick={() => handleAdjustToken('research', -1)}
              className="h-5 w-5 p-0 text-[10px] text-red-600"
            >
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <span className="font-mono font-bold text-[11px] px-1">{currentRoundConvs.research || 0} / 2</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={isReadOnly || (currentRoundConvs.research || 0) >= 2 || remainingTokens <= 0}
              onClick={() => handleAdjustToken('research', 1)}
              className="h-5 w-5 p-0 text-[10px] text-purple-600"
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>

        {/* Logistics Conversion (Blue Box) */}
        <div className="p-2 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/40 dark:border-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="font-bold truncate text-[11px]">Logistics</span>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-slate-200 dark:border-slate-800 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              disabled={isReadOnly || (currentRoundConvs.logistics || 0) <= 0}
              onClick={() => handleAdjustToken('logistics', -1)}
              className="h-5 w-5 p-0 text-[10px] text-red-600"
            >
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <span className="font-mono font-bold text-[11px] px-1">{currentRoundConvs.logistics || 0} / 2</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={isReadOnly || (currentRoundConvs.logistics || 0) >= 2 || remainingTokens <= 0}
              onClick={() => handleAdjustToken('logistics', 1)}
              className="h-5 w-5 p-0 text-[10px] text-blue-600"
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>

        {/* Steve Contribution */}
        <div className="p-2 rounded-lg border border-red-200 bg-red-50/50 dark:bg-slate-950/50 dark:border-slate-800 flex items-center justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 truncate">
            <SteveIcon size={16} />
            <span className="font-bold truncate text-[11px]">Unblock</span>
          </div>
          {steveTotalContributed >= 5 && steveData.activeRegion ? (
            <Button
              size="sm"
              disabled={isReadOnly}
              onClick={() => {
                if (isReadOnly) return;
                moveSteve(null);
                toast.success(`Steve cleared! ${steveData.activeRegion} is now unblocked.`);
              }}
              className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2 shadow-xs"
            >
              Clear Steve (5/5 Paid)
            </Button>
          ) : (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-slate-200 dark:border-slate-800 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                disabled={isReadOnly || teamSteveContrib <= 0}
                onClick={() => handleAdjustSteve(-1)}
                className="h-5 w-5 p-0 text-[10px] text-red-600"
              >
                <Minus className="h-2.5 w-2.5" />
              </Button>
              <span className="font-mono font-bold text-[11px] px-1">{teamSteveContrib}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={isReadOnly || remainingTokens <= 0 || !steveData.activeRegion || steveTotalContributed >= 5}
                onClick={() => handleAdjustSteve(1)}
                className="h-5 w-5 p-0 text-[10px] text-emerald-600"
              >
                <Plus className="h-2.5 w-2.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
