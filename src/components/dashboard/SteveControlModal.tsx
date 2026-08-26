import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { REGIONS } from '@/data/combinations';
import { SteveIcon } from './SteveIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, Dices, Zap, X } from 'lucide-react';
import { toast } from 'sonner';

import { isRuleActiveForTeam } from '@/lib/defaultRules';

export const SteveControlModal: React.FC = () => {
  const { gameState, getRuleAdjustments, moveSteve } = useGame();
  const [selectedRegion, setSelectedRegion] = useState<string>('Canada');

  const isSteveEnabled = isRuleActiveForTeam(gameState?.ruleAdjustments, 'steve_event_blocker');
  const currentRound = gameState?.currentRound || 1;

  const steveData = gameState?.advancedState?.steve || {
    activeRegion: null,
    wildcardsContributed: {},
  };

  const totalContributed = Object.values(steveData.wildcardsContributed || {}).reduce((a, b) => Number(a) + Number(b), 0);

  const handleMoveSteve = (targetRegion: string) => {
    if (!gameState) return;
    if (!isSteveEnabled) {
      toast.error('Steve Event & Region Blocker rule is currently switched OFF by the facilitator.');
      return;
    }
    moveSteve(targetRegion);
    toast.warning(`Steve has moved to block region: ${targetRegion}!`, {
      description: 'No team can expand into or sell products in this region until Steve is cleared.',
    });
  };

  const handleRandomMove = () => {
    if (!isSteveEnabled) {
      toast.error('Steve Event & Region Blocker rule is currently switched OFF by the facilitator.');
      return;
    }
    const availableRegions = REGIONS;
    const randomReg = availableRegions[Math.floor(Math.random() * availableRegions.length)];
    setSelectedRegion(randomReg);
    handleMoveSteve(randomReg);
  };

  const handleClearSteve = () => {
    if (!gameState) return;
    moveSteve(null);
    toast.success('Steve has been cleared from the board!');
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm overflow-hidden rounded-xl">
      <CardHeader className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SteveIcon size={28} />
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                Steve — Region Blocker Event
                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 font-semibold">
                  {isSteveEnabled ? (currentRound >= 3 ? 'Active (Round 3+)' : 'Standby (Round 3+)') : 'Disabled'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Blocks logistics expansion and sales in the target region. Cleared by paying 5 Wildcard tokens.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Status Box */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${steveData.activeRegion ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/40 animate-pulse' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
              <SteveIcon size={20} />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Currently Blocking</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {steveData.activeRegion ? (
                  <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5 font-extrabold">
                    <ShieldAlert className="h-4 w-4" /> {steveData.activeRegion}
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">No Region Blocked (Off Board)</span>
                )}
              </div>
            </div>
          </div>

          {steveData.activeRegion && (
            <div className="text-right space-y-1">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Clear Progress</div>
              <Badge variant="outline" className="font-mono text-xs border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 font-bold">
                {totalContributed} / 5 Wildcards Paid
              </Badge>
            </div>
          )}
        </div>

        {/* Disabled Rule Banner */}
        {!isSteveEnabled && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-bold">
            Steve Event & Region Blocker (Advanced Rule 5) is currently switched OFF by the facilitator.
          </div>
        )}

        {/* Facilitator Action Controls */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Facilitator Steve Controls
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Select value={selectedRegion} onValueChange={setSelectedRegion} disabled={!isSteveEnabled}>
                <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                  {REGIONS.map(r => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="default"
                size="sm"
                disabled={!isSteveEnabled}
                onClick={() => handleMoveSteve(selectedRegion)}
                className="h-9 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold whitespace-nowrap px-3 shadow-sm"
              >
                Place Steve
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!isSteveEnabled}
                onClick={handleRandomMove}
                className="h-9 text-xs border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/20 font-bold gap-1.5 flex-1"
              >
                <Dices className="h-3.5 w-3.5" />
                Random Move
              </Button>

              {steveData.activeRegion && (
                <Button
                  variant={totalContributed >= 5 ? "default" : "destructive"}
                  size="sm"
                  onClick={handleClearSteve}
                  className={`h-9 text-xs gap-1 font-extrabold shadow-sm ${
                    totalContributed >= 5 ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce' : ''
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  {totalContributed >= 5 ? 'Clear Steve (5/5 Paid)' : 'Clear'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
