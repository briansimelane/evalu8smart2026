import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import {
  computeWorldMarks,
  DEFAULT_SYNDICATE_MARKS_CONFIG,
  MARKS_CRITERIA,
  WorldMarksResult,
  TeamMarksResult
} from '@/lib/marks/syndicateMarks';
import { SyndicateMarksConfig, MarksCriterionKey } from '@/types/game';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import {
  Download,
  FileText,
  SlidersHorizontal,
  Undo2,
  AlertTriangle,
  ChevronDown,
  GraduationCap,
  Info,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export const SyndicateMarks: React.FC = () => {
  const gameContext = useGame();
  const { gameState } = gameContext;
  const { activeClass, updateClassMarksConfig } = useSession();

  // Config resolution
  const savedConfig = activeClass?.syndicateMarksConfig;
  const initialConfig: SyndicateMarksConfig = useMemo(() => {
    return {
      weights: {
        revenue: savedConfig?.weights?.revenue ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.revenue,
        controlledRegions: savedConfig?.weights?.controlledRegions ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.controlledRegions,
        offices: savedConfig?.weights?.offices ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.offices,
        technologies: savedConfig?.weights?.technologies ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.technologies,
        patents: savedConfig?.weights?.patents ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.patents,
      },
      lostProductsPenalty: savedConfig?.lostProductsPenalty ?? DEFAULT_SYNDICATE_MARKS_CONFIG.lostProductsPenalty,
      adjustments: savedConfig?.adjustments ?? {},
      excludedTeamIds: savedConfig?.excludedTeamIds ?? [],
      averageMark: savedConfig?.averageMark ?? DEFAULT_SYNDICATE_MARKS_CONFIG.averageMark ?? 65,
      marksPerSigma: savedConfig?.marksPerSigma ?? DEFAULT_SYNDICATE_MARKS_CONFIG.marksPerSigma ?? 10,
    };
  }, [savedConfig]);

  // Local reactive config state for immediate calculation updates
  const [localConfig, setLocalConfig] = useState<SyndicateMarksConfig>(initialConfig);

  useEffect(() => {
    setLocalConfig(initialConfig);
  }, [initialConfig]);

  // Selected round for "as at"
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // Computing world marks with localConfig
  const worldResult: WorldMarksResult | null = useMemo(() => {
    if (!gameState) return null;
    return computeWorldMarks(gameState, localConfig, selectedRound ?? undefined);
  }, [gameState, localConfig, selectedRound]);

  // Sync selectedRound default once loaded
  useEffect(() => {
    if (worldResult && selectedRound === null) {
      setSelectedRound(worldResult.latestScorableRound || 1);
    }
  }, [worldResult, selectedRound]);

  // Local state for inputs
  const [weightsInput, setWeightsInput] = useState<Record<MarksCriterionKey, string>>({
    revenue: (localConfig.weights.revenue * 100).toString(),
    controlledRegions: (localConfig.weights.controlledRegions * 100).toString(),
    offices: (localConfig.weights.offices * 100).toString(),
    technologies: (localConfig.weights.technologies * 100).toString(),
    patents: (localConfig.weights.patents * 100).toString(),
  });

  const [penaltyInput, setPenaltyInput] = useState<string>(
    (localConfig.lostProductsPenalty * 100).toString()
  );

  const [averageMarkInput, setAverageMarkInput] = useState<string>(
    (localConfig.averageMark ?? 65).toString()
  );

  const [marksPerSigmaInput, setMarksPerSigmaInput] = useState<string>(
    (localConfig.marksPerSigma ?? 10).toString()
  );

  const [adjustmentsInput, setAdjustmentsInput] = useState<Record<string, { points: string; reason: string }>>({});

  // Sync local inputs when savedConfig updates from database
  useEffect(() => {
    setWeightsInput({
      revenue: (localConfig.weights.revenue * 100).toString(),
      controlledRegions: (localConfig.weights.controlledRegions * 100).toString(),
      offices: (localConfig.weights.offices * 100).toString(),
      technologies: (localConfig.weights.technologies * 100).toString(),
      patents: (localConfig.weights.patents * 100).toString(),
    });
    setPenaltyInput((localConfig.lostProductsPenalty * 100).toString());
    setAverageMarkInput((localConfig.averageMark ?? 65).toString());
    setMarksPerSigmaInput((localConfig.marksPerSigma ?? 10).toString());

    const adjMap: Record<string, { points: string; reason: string }> = {};
    Object.entries(localConfig.adjustments || {}).forEach(([tid, adj]) => {
      adjMap[tid] = {
        points: adj.points !== undefined ? adj.points.toString() : '0',
        reason: adj.reason || '',
      };
    });
    setAdjustmentsInput(adjMap);
  }, [savedConfig]);

  // Debounced save to Firestore
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const persistConfig = (newCfg: SyndicateMarksConfig) => {
    if (!activeClass?.id) return;
    updateClassMarksConfig(activeClass.id, newCfg).catch((err) => {
      console.error('Failed to save syndicate marks config:', err);
      toast.error('Failed to save settings');
    });
  };

  const triggerDebouncedSave = (newCfg: SyndicateMarksConfig) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      persistConfig(newCfg);
    }, 600);
  };

  const handleWeightChange = (key: MarksCriterionKey, valStr: string) => {
    setWeightsInput(prev => ({ ...prev, [key]: valStr }));
    const valNum = parseFloat(valStr);
    if (!isNaN(valNum) && valNum >= 0) {
      const newWeights = { ...localConfig.weights, [key]: valNum / 100 };
      const newCfg = { ...localConfig, weights: newWeights };
      setLocalConfig(newCfg);
      triggerDebouncedSave(newCfg);
    }
  };

  const handlePenaltyChange = (valStr: string) => {
    setPenaltyInput(valStr);
    const valNum = parseFloat(valStr);
    if (!isNaN(valNum) && valNum >= 0) {
      const newCfg = { ...localConfig, lostProductsPenalty: valNum / 100 };
      setLocalConfig(newCfg);
      triggerDebouncedSave(newCfg);
    }
  };

  const handleAverageMarkChange = (valStr: string) => {
    setAverageMarkInput(valStr);
    const valNum = parseFloat(valStr);
    if (!isNaN(valNum) && valNum >= 0 && valNum <= 100) {
      const newCfg = { ...localConfig, averageMark: valNum };
      setLocalConfig(newCfg);
      triggerDebouncedSave(newCfg);
    }
  };

  const handleMarksPerSigmaChange = (valStr: string) => {
    setMarksPerSigmaInput(valStr);
    const valNum = parseFloat(valStr);
    if (!isNaN(valNum) && valNum >= 0) {
      const newCfg = { ...localConfig, marksPerSigma: valNum };
      setLocalConfig(newCfg);
      triggerDebouncedSave(newCfg);
    }
  };

  const handleAdjustmentChange = (teamId: string, ptsStr?: string, reasonStr?: string) => {
    const curr = adjustmentsInput[teamId] || {
      points: localConfig.adjustments[teamId]?.points !== undefined ? localConfig.adjustments[teamId].points.toString() : '',
      reason: localConfig.adjustments[teamId]?.reason || ''
    };
    const nextPtsStr = ptsStr !== undefined ? ptsStr : curr.points;
    const nextReasonStr = reasonStr !== undefined ? reasonStr : curr.reason;

    setAdjustmentsInput(prev => ({
      ...prev,
      [teamId]: { points: nextPtsStr, reason: nextReasonStr },
    }));

    const ptsNum = parseFloat(nextPtsStr);
    const newAdj = { ...localConfig.adjustments };

    const trimmedReason = nextReasonStr ? nextReasonStr.trim() : '';

    if (!isNaN(ptsNum) || trimmedReason !== '') {
      const entry: { points: number; reason?: string } = {
        points: isNaN(ptsNum) ? 0 : ptsNum,
      };
      if (trimmedReason !== '') {
        entry.reason = trimmedReason;
      }
      newAdj[teamId] = entry;
    } else {
      delete newAdj[teamId];
    }

    const newCfg = { ...localConfig, adjustments: newAdj };
    setLocalConfig(newCfg);
    triggerDebouncedSave(newCfg);
  };

  const handleToggleExclude = (teamId: string, exclude: boolean) => {
    let nextExcluded = [...localConfig.excludedTeamIds];
    if (exclude && !nextExcluded.includes(teamId)) {
      nextExcluded.push(teamId);
    } else if (!exclude) {
      nextExcluded = nextExcluded.filter(id => id !== teamId);
    }
    const newCfg = { ...localConfig, excludedTeamIds: nextExcluded };
    setLocalConfig(newCfg);
    persistConfig(newCfg);
  };

  const handleResetDefaults = () => {
    const newCfg: SyndicateMarksConfig = {
      ...DEFAULT_SYNDICATE_MARKS_CONFIG,
      adjustments: {},
      excludedTeamIds: [],
    };
    setLocalConfig(newCfg);
    persistConfig(newCfg);
    toast.success('Reset settings to workbook defaults');
  };

  // PDF Export states
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');

  const handleExportTeamPdf = async (team: TeamMarksResult) => {
    if (!worldResult) return;
    try {
      const { generateTeamMarksPdf } = await import('@/lib/marks/marksPdf');
      const className = activeClass?.name || gameState?.gameId || 'Class World';
      await generateTeamMarksPdf(team, worldResult, className);
      toast.success(`PDF exported for ${team.teamName}`);
    } catch (err: any) {
      console.error('Error generating team PDF:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const handleExportAllPdfs = async () => {
    if (!worldResult) return;
    try {
      setIsExportingAll(true);
      const { exportAllTeamPdfs } = await import('@/lib/marks/marksPdf');
      const className = activeClass?.name || gameState?.gameId || 'Class World';
      await exportAllTeamPdfs(worldResult, className, (curr, total) => {
        setExportProgress(`Generating ${curr} of ${total}...`);
      });
      toast.success('All team PDFs exported!');
    } catch (err: any) {
      console.error('Error batch exporting PDFs:', err);
      toast.error('Failed to export all PDFs');
    } finally {
      setIsExportingAll(false);
      setExportProgress('');
    }
  };

  const handleExportSummaryPdf = async () => {
    if (!worldResult) return;
    try {
      const { exportFacilitatorWorldSummaryPdf } = await import('@/lib/marks/marksPdf');
      const className = activeClass?.name || gameState?.gameId || 'Class World';
      await exportFacilitatorWorldSummaryPdf(worldResult, className);
      toast.success('World Summary PDF exported!');
    } catch (err: any) {
      console.error('Error generating summary PDF:', err);
      toast.error('Failed to generate summary PDF');
    }
  };

  if (!gameState || !worldResult) {
    return (
      <Card className="border border-border p-6 text-center text-muted-foreground">
        No active game state found.
      </Card>
    );
  }

  const latestScorable = worldResult.latestScorableRound;
  if (latestScorable === 0) {
    return (
      <Card className="border border-border p-8 text-center space-y-3">
        <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground" />
        <h3 className="text-base font-semibold">Syndicate Marks Unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Marks become available when Round 1 reaches the Scoring phase.
        </p>
      </Card>
    );
  }

  const currentAsAtRound = selectedRound ?? latestScorable;
  const posWeightSumPercent = Math.round(worldResult.positiveWeightSum * 100);
  const penaltyPercent = Math.round(localConfig.lostProductsPenalty * 100);
  const avgMarkVal = localConfig.averageMark ?? 65;
  const marksPerSigmaVal = localConfig.marksPerSigma ?? 10;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg leading-none">Syndicate Marks</h2>
            </div>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="text-sm font-medium text-foreground">{activeClass?.name || 'Class World'}</span>

            {/* Round Selector */}
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-muted-foreground font-medium">Marks as at end of:</span>
              <Select
                value={currentAsAtRound.toString()}
                onValueChange={(val) => setSelectedRound(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 text-xs w-[110px]">
                  <SelectValue placeholder={`Round ${currentAsAtRound}`} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: latestScorable }, (_, i) => i + 1).map((r) => (
                    <SelectItem key={r} value={r.toString()} className="text-xs">
                      Round {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Badge */}
            {worldResult.isFinal ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                Final
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs">
                Live — end of Round {currentAsAtRound}
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAllPdfs}
              disabled={isExportingAll}
              className="text-xs gap-1.5 h-8"
            >
              {isExportingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {isExportingAll ? exportProgress : 'Export All Team PDFs'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleExportSummaryPdf}
              className="text-xs gap-1.5 h-8"
            >
              <FileText className="h-3.5 w-3.5" />
              World Summary PDF (Facilitator)
            </Button>
          </div>
        </div>

        {/* Warning Banners */}
        {worldResult.warnings.length > 0 && (
          <div className="space-y-2">
            {worldResult.warnings.map((warn, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-3 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Settings Collapsible */}
        <Collapsible defaultOpen={false} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto font-medium hover:bg-muted/50 rounded-none">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>Scoring Criteria & StdDev Settings</span>
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (Average team {avgMarkVal}% · each σ ±{marksPerSigmaVal} marks · penalty up to −{penaltyPercent} marks · weights normalised {posWeightSumPercent}%)
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 pt-0 border-t border-border space-y-6">
            {/* Global StdDev Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-b border-border pb-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Average mark (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={averageMarkInput}
                  onChange={(e) => handleAverageMarkChange(e.target.value)}
                  className="h-8 text-xs max-w-[150px]"
                />
                <span className="text-[11px] text-muted-foreground block mt-1">
                  Mark for a team exactly at the world average on every criterion, with no lost products.
                </span>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Marks per standard deviation (σ)</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={marksPerSigmaInput}
                  onChange={(e) => handleMarksPerSigmaChange(e.target.value)}
                  className="h-8 text-xs max-w-[150px]"
                />
                <span className="text-[11px] text-muted-foreground block mt-1">
                  Marks gained for each standard deviation above the world average (and lost for each one below).
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Criterion Weights */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Criterion Weights (%)</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-muted-foreground block mb-1">Revenue</label>
                    <Input
                      type="number"
                      value={weightsInput.revenue}
                      onChange={(e) => handleWeightChange('revenue', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Controlled Regions</label>
                    <Input
                      type="number"
                      value={weightsInput.controlledRegions}
                      onChange={(e) => handleWeightChange('controlledRegions', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Offices</label>
                    <Input
                      type="number"
                      value={weightsInput.offices}
                      onChange={(e) => handleWeightChange('offices', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Technologies</label>
                    <Input
                      type="number"
                      value={weightsInput.technologies}
                      onChange={(e) => handleWeightChange('technologies', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Patents</label>
                    <Input
                      type="number"
                      value={weightsInput.patents}
                      onChange={(e) => handleWeightChange('patents', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Lost Products Penalty (%)</label>
                    <Input
                      type="number"
                      value={penaltyInput}
                      onChange={(e) => handlePenaltyChange(e.target.value)}
                      className="h-8 text-xs border-destructive/40"
                    />
                  </div>
                </div>
              </div>

              {/* Team Exclusions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Include in Scored Set</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetDefaults}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Undo2 className="h-3 w-3" />
                    Reset to defaults
                  </Button>
                </div>
                <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                  {gameState.teams.map((t) => {
                    const isExcluded = localConfig.excludedTeamIds.includes(t.id);
                    return (
                      <div key={t.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{t.name}</span>
                          {t.isBot && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Bot</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">{isExcluded ? 'Excluded' : 'Included'}</span>
                          <Switch
                            checked={!isExcluded}
                            onCheckedChange={(inc) => handleToggleExclude(t.id, !inc)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Main Marks Table */}
        <Card className="border border-border shadow-sm overflow-hidden">
          <CardHeader className="p-4 bg-muted/20 border-b border-border">
            <CardTitle className="text-base font-semibold">World Syndicate Scoreboard</CardTitle>
            <CardDescription className="text-xs">
              Standard-deviation evaluation of all teams in this world as at Round {currentAsAtRound}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[180px] min-w-[180px] sticky left-0 bg-muted/40 z-10 font-bold text-xs">
                    Team & Criteria
                  </TableHead>
                  <TableHead className="w-[110px] min-w-[110px] text-center font-semibold text-xs text-muted-foreground">
                    World Avg / σ
                  </TableHead>
                  {worldResult.teams.map((t) => (
                    <TableHead key={t.teamId} className="min-w-[140px] text-center font-bold text-xs">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>Team {t.teamNumber}: {t.teamName}</span>
                        {t.isBot && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Bot</Badge>}
                        {t.excluded && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">Excluded</Badge>}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 5 Positive Criteria Rows */}
                {MARKS_CRITERIA.map((crit) => {
                  const meanVal = worldResult.means[crit.key] ?? 0;
                  const sdVal = worldResult.sds[crit.key] ?? 0;
                  const displayMean = crit.format === 'currency' ? `$${Math.round(meanVal).toLocaleString()}` : meanVal.toFixed(1);

                  return (
                    <TableRow key={crit.key}>
                      <TableCell className="sticky left-0 bg-card font-medium text-xs border-r border-border">
                        <div className="flex flex-col">
                          <span>{crit.label}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            Weight: {Math.round(localConfig.weights[crit.key] * 100)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground font-mono bg-muted/10">
                        {displayMean} / {sdVal.toFixed(1)}
                      </TableCell>
                      {worldResult.teams.map((t) => {
                        if (t.excluded) {
                          return <TableCell key={t.teamId} className="text-center text-xs text-muted-foreground">-</TableCell>;
                        }
                        const tot = t.totals[crit.key];
                        const z = t.zScores[crit.key];
                        const contrib = t.contributions[crit.key];
                        const displayVal = crit.format === 'currency' ? `$${Math.round(tot).toLocaleString()}` : tot;

                        const zSign = z > 0 ? '+' : '';
                        const zText = `${zSign}${z.toFixed(2)}σ`;
                        const zColor = z > 0 ? 'text-emerald-600 dark:text-emerald-400' : (z < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground');

                        const contribSign = contrib > 0 ? '+' : '';
                        const contribText = `${contribSign}${contrib.toFixed(1)}`;

                        return (
                          <TableCell key={t.teamId} className="text-center text-xs">
                            <div className="flex flex-col items-center">
                              <span className="font-semibold text-foreground">{displayVal}</span>
                              <span className={`text-[10px] font-medium ${zColor}`}>{zText}</span>
                              <span className="font-bold text-primary text-xs mt-0.5">{contribText}</span>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}

                {/* Lost Products Row */}
                <TableRow className="bg-destructive/5">
                  <TableCell className="sticky left-0 bg-card font-medium text-xs border-r border-border">
                    <div className="flex flex-col">
                      <span className="text-destructive font-semibold">Less: Lost products</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Penalty: -{penaltyPercent} max
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground bg-muted/10">-</TableCell>
                  {worldResult.teams.map((t) => {
                    if (t.excluded) {
                      return <TableCell key={t.teamId} className="text-center text-xs text-muted-foreground">-</TableCell>;
                    }
                    const tot = t.totals.lostProducts;
                    const lostSharePct = (t.lostShare * 100).toFixed(0);

                    return (
                      <TableCell key={t.teamId} className="text-center text-xs">
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-foreground">{tot} lost</span>
                          <span className="text-[10px] text-muted-foreground">{lostSharePct}% of highest</span>
                          <span className="font-bold text-destructive text-xs mt-0.5">−{t.lostPoints.toFixed(1)}</span>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Average Mark Starting Point Row */}
                <TableRow className="bg-muted/10 text-xs">
                  <TableCell className="sticky left-0 bg-muted/10 font-medium text-xs border-r border-border">
                    Average mark starting point
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground font-mono bg-muted/10">-</TableCell>
                  {worldResult.teams.map((t) => (
                    <TableCell key={t.teamId} className="text-center text-xs font-semibold text-muted-foreground">
                      {t.excluded ? '-' : avgMarkVal.toFixed(1)}
                    </TableCell>
                  ))}
                </TableRow>

                {/* Subtotal Row */}
                <TableRow className="bg-muted/20 font-semibold text-xs">
                  <TableCell className="sticky left-0 bg-muted/20 font-bold text-xs border-r border-border">
                    Subtotal
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground font-mono bg-muted/10">-</TableCell>
                  {worldResult.teams.map((t) => (
                    <TableCell key={t.teamId} className="text-center text-xs font-bold">
                      {t.excluded ? '-' : `${t.subtotal.toFixed(1)}%`}
                    </TableCell>
                  ))}
                </TableRow>

                {/* Adjustment (pp) Row */}
                <TableRow>
                  <TableCell className="sticky left-0 bg-card font-medium text-xs border-r border-border">
                    <div className="flex flex-col">
                      <span>Class adjustment</span>
                      <span className="text-[10px] text-muted-foreground font-normal">percentage points</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground bg-muted/10">-</TableCell>
                  {worldResult.teams.map((t) => {
                    if (t.excluded) {
                      return <TableCell key={t.teamId} className="text-center text-xs text-muted-foreground">-</TableCell>;
                    }
                    const localAdj = adjustmentsInput[t.teamId] ?? {
                      points: t.adjustmentPoints !== undefined && t.adjustmentPoints !== 0 ? t.adjustmentPoints.toString() : '',
                      reason: t.adjustmentReason || '',
                    };

                    return (
                      <TableCell key={t.teamId} className="p-2">
                        <div className="flex flex-col gap-1 items-center max-w-[120px] mx-auto">
                          <Input
                            type="number"
                            placeholder="0"
                            value={localAdj.points}
                            onChange={(e) => handleAdjustmentChange(t.teamId, e.target.value, undefined)}
                            className="h-7 text-xs text-center font-medium"
                          />
                          <Input
                            type="text"
                            placeholder="Reason (optional)"
                            value={localAdj.reason}
                            onChange={(e) => handleAdjustmentChange(t.teamId, undefined, e.target.value)}
                            className="h-6 text-[10px] px-1 text-center"
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* TOTAL MARK Row */}
                <TableRow className="bg-sky-50 dark:bg-sky-950/40 border-t-2 border-sky-500/30">
                  <TableCell className="sticky left-0 bg-sky-100 dark:bg-sky-900/40 font-bold text-sm text-sky-900 dark:text-sky-100 border-r border-border">
                    TOTAL MARK
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground bg-sky-100/50 dark:bg-sky-900/20">-</TableCell>
                  {worldResult.teams.map((t) => {
                    if (t.excluded) {
                      return (
                        <TableCell key={t.teamId} className="text-center text-xs text-muted-foreground font-semibold">
                          Excluded
                        </TableCell>
                      );
                    }
                    const rawPct = t.totalRaw.toFixed(1);
                    const clampedPct = t.totalClamped.toFixed(1);
                    const isClamped = Math.abs(t.totalRaw - t.totalClamped) > 1e-6;

                    return (
                      <TableCell key={t.teamId} className="text-center p-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex flex-col items-center cursor-default">
                              <span className="text-base font-extrabold text-sky-700 dark:text-sky-300">
                                {clampedPct}%
                              </span>
                              {isClamped && (
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  (clamped)
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          {isClamped && (
                            <TooltipContent>
                              <p className="text-xs">Unclamped value: {rawPct}%</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Actions Row */}
                <TableRow className="bg-muted/10">
                  <TableCell className="sticky left-0 bg-card font-medium text-xs border-r border-border">
                    Actions
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground bg-muted/10">-</TableCell>
                  {worldResult.teams.map((t) => (
                    <TableCell key={t.teamId} className="text-center py-2">
                      {!t.excluded && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportTeamPdf(t)}
                          className="h-7 text-xs gap-1 hover:bg-sky-500/10 hover:text-sky-600"
                        >
                          <FileText className="h-3 w-3" />
                          Report
                        </Button>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Round Breakdown Audit Trail */}
        <Collapsible defaultOpen={false} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto font-medium hover:bg-muted/50 rounded-none">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Info className="h-4 w-4 text-primary" />
                <span>Round-by-Round Breakdown (Audit Trail)</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 pt-0 border-t border-border space-y-6">
            <div className="space-y-6 pt-4">
              {MARKS_CRITERIA.map((crit) => (
                <div key={crit.key} className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground">{crit.label} (Per Round)</h4>
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[160px] font-bold">Round</TableHead>
                          {worldResult.teams.map((t) => (
                            <TableHead key={t.teamId} className="text-center font-bold">
                              {t.teamName}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: currentAsAtRound }, (_, i) => i + 1).map((r) => (
                          <TableRow key={r}>
                            <TableCell className="font-medium text-muted-foreground">Round {r}</TableCell>
                            {worldResult.teams.map((t) => {
                              const rm = t.perRound[r];
                              if (!rm) return <TableCell key={t.teamId} className="text-center">-</TableCell>;
                              const val = rm[crit.key] ?? 0;
                              const displayVal = crit.format === 'currency' ? `$${Math.round(val).toLocaleString()}` : val;
                              const isEstimated = !!rm.estimated[crit.key];

                              return (
                                <TableCell key={t.teamId} className="text-center">
                                  <div className="inline-flex items-center gap-1">
                                    <span>{displayVal}</span>
                                    {rm.source === 'live' && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" title="Live snapshot" />
                                    )}
                                    {isEstimated && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertTriangle className="h-3 w-3 text-amber-500 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">{rm.estimated[crit.key]}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Methodology Note */}
        <Collapsible defaultOpen={false} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto font-medium hover:bg-muted/50 rounded-none">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Info className="h-4 w-4 text-primary" />
                <span>Syndicate Scoring Methodology</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 pt-0 border-t border-border">
            <p className="text-xs text-muted-foreground leading-relaxed pt-3">
              Each criterion is totalled across rounds. For each criterion we calculate the world average and standard deviation across the teams in this world, and express each team's total as a number of standard deviations above or below the average (z). The weighted z-scores are combined using the criterion weights. The mark is the average mark plus the marks-per-standard-deviation multiplied by the combined z-score. Lost products are a penalty only: the team with the most lost products loses the full penalty, others lose a share in proportion to their losses. Wifi carry-over removes lost products only in rounds where the Permanent Tech Benefits rule was on. Class adjustments are added last and the mark is limited to 0–100%.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </TooltipProvider>
  );
};
