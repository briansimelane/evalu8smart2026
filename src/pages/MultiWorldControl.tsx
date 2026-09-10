import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMultiWorldSession, WorldSubState } from '@/hooks/useMultiWorldSession';
import { useMultiWorldBotRunners } from '@/hooks/useMultiWorldBotRunners';
import { useSession } from '@/contexts/SessionContext';
import { WorldKey } from '@/types/multiworld';
import { GamePhase, GameState, calculateTeamTotalScore } from '@/types/game';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RulesAdjustmentPanel } from '@/components/dashboard/RulesAdjustmentPanel';
import { ActionMatrix } from '@/components/multiworld/ActionMatrix';
import { CombinedLeaderboard } from '@/components/multiworld/CombinedLeaderboard';
import { mutateWorldState } from '@/lib/multiworld/worldWrite';
import { advanceOnePhase, getBlockingTeams, PHASE_LABELS, PHASE_SEQUENCE } from '@/lib/phaseEngine';
import { getTeamDisplayLabel } from '@/lib/multiworld/teamLabel';
import { cn } from '@/lib/utils';
import {
  Globe,
  FastForward,
  Play,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Bot,
  ShieldAlert,
  ArrowLeft,
  Eye,
  Sliders,
  Table as TableIcon,
  LayoutGrid,
  Zap,
  Trophy
} from 'lucide-react';

const PHASE_INDEX_MAP: Record<string, number> = {
  planning: 0,
  PLANNING: 0,
  production: 1,
  PRODUCTION: 1,
  improvement: 2,
  innovation: 3,
  expansion: 4,
  sales: 5,
  control: 6,
  scoring: 7
};

function getPhaseAbsoluteStep(gameState: GameState | null): number {
  if (!gameState) return 0;
  const round = gameState.currentRound || 1;
  const phaseIdx = PHASE_INDEX_MAP[gameState.currentPhase] || 0;
  return (round - 1) * 8 + phaseIdx;
}

export const MultiWorldControl: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { selectClass } = useSession();
  const [copiedCode, setCopiedCode] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [selectedWorldKeys, setSelectedWorldKeys] = useState<WorldKey[]>([]);

  const {
    session,
    worlds,
    loading,
    error,
    updateAdvanceMode,
    updateTeamLabelMode
  } = useMultiWorldSession(sessionId || '');

  // Automatically execute bot turns for all worlds in this session
  useMultiWorldBotRunners(worlds);

  // Tab selection: default to matrix if > 2 worlds
  const [activeTab, setActiveTab] = useState<string>(
    worlds.length > 2 ? 'matrix' : 'cards'
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
        <p className="text-purple-700 font-semibold animate-pulse">Loading Multi-World Control Surface...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-red-500" />
        <h1 className="text-2xl font-bold">Multi-World Session Unavailable</h1>
        <p className="text-muted-foreground max-w-md">{error || 'Session document could not be loaded.'}</p>
        <Button onClick={() => navigate('/facilitator/classes')} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white">
          Return to Facilitator Hub
        </Button>
      </div>
    );
  }

  const advanceMode = session.advanceMode || 'lockstep';
  const isLockstep = advanceMode === 'lockstep';
  const labelMode = session.teamLabelMode || 'name';
  const totalTeams = worlds.reduce((acc, w) => acc + (w.gameState?.teams?.length || w.teamCount || 5), 0);

  // Check for drift in independent mode
  let driftWarning: string | null = null;
  if (!isLockstep && worlds.length > 1) {
    const loadedWorlds = worlds.filter(w => w.gameState);
    if (loadedWorlds.length > 1) {
      const steps = loadedWorlds.map(w => ({
        label: w.label,
        key: w.key,
        step: getPhaseAbsoluteStep(w.gameState),
        phase: w.gameState?.currentPhase,
        round: w.gameState?.currentRound
      }));
      steps.sort((a, b) => a.step - b.step);
      const minW = steps[0];
      const maxW = steps[steps.length - 1];
      if (maxW.step - minW.step > 1) {
        driftWarning = `Independent mode phase drift: World ${minW.key} is in Round ${minW.round} ${PHASE_LABELS[minW.phase!]} while World ${maxW.key} is in Round ${maxW.round} ${PHASE_LABELS[maxW.phase!]}.`;
      }
    }
  }

  // Determine readiness across target worlds
  const targetWorlds = selectedWorldKeys.length > 0
    ? worlds.filter(w => selectedWorldKeys.includes(w.key))
    : worlds;

  const blockedWorlds = targetWorlds.filter(w => {
    if (!w.gameState) return true;
    return getBlockingTeams(w.gameState).length > 0;
  });

  const allTargetReady = blockedWorlds.length === 0;

  const handleToggleSelectWorld = (key: WorldKey, sel: boolean) => {
    setSelectedWorldKeys(prev =>
      sel ? [...prev, key] : prev.filter(k => k !== key)
    );
  };

  const handleCopyCode = () => {
    if (!session.sessionCode) return;
    navigator.clipboard.writeText(session.sessionCode);
    setCopiedCode(true);
    toast.success('Viewer session code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const executeAdvance = async (force: boolean) => {
    if (targetWorlds.length === 0) return;
    setIsAdvancing(true);

    try {
      const results = await Promise.all(
        targetWorlds.map(async (w) => {
          if (!w.classId) return { key: w.key, success: false, reason: 'Missing classId' };
          try {
            await mutateWorldState(w.classId, (freshState) => {
              return advanceOnePhase(freshState, new Date(), { force });
            });
            return { key: w.key, success: true };
          } catch (err: any) {
            return { key: w.key, success: false, reason: err.message || 'Advance failed' };
          }
        })
      );

      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        toast.success(
          force
            ? `Force advanced ${targetWorlds.length} world(s) with $5 default plan!`
            : `Advanced ${targetWorlds.length} world(s) to next phase!`
        );
      } else {
        toast.error(`Failed to advance ${failed.length} world(s): ${failed.map(f => `World ${f.key} (${f.reason})`).join(', ')}`);
      }
    } catch (err: any) {
      console.error('Lockstep advance error:', err);
      toast.error('Error advancing worlds: ' + err.message);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleAdvanceTargetWorlds = () => {
    if (!allTargetReady) {
      const names = blockedWorlds.map(w => {
        const blocking = w.gameState ? getBlockingTeams(w.gameState) : [];
        return `World ${w.key} (${blocking.map(t => t.name).join(', ')})`;
      }).join('; ');

      toast.warning(`Teams pending submission: ${names}`, {
        action: {
          label: 'Force Advance ($5 Default)',
          onClick: () => executeAdvance(true)
        },
        duration: 8000
      });
      return;
    }

    executeAdvance(false);
  };

  const handleAdvanceSingleWorld = async (classId: string, worldLabel: string, force: boolean = false) => {
    setIsAdvancing(true);
    try {
      await mutateWorldState(classId, (freshState) => {
        return advanceOnePhase(freshState, new Date(), { force });
      });
      toast.success(`Advanced ${worldLabel}!`);
    } catch (err: any) {
      console.error(`Error advancing ${worldLabel}:`, err);
      toast.error(`Failed to advance ${worldLabel}: ${err.message}`);
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      {/* Top Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-border gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/facilitator/classes')}
            className="border-border text-foreground hover:bg-muted gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Facilitator Hub
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Globe className="h-5 w-5 text-purple-600" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{session.name}</h1>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                {worlds.length} Worlds · {totalTeams} Teams
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Code: <span className="font-mono font-bold text-purple-700">{session.sessionCode}</span> ·
              Advance Mode: <span className="capitalize text-foreground font-semibold">{advanceMode}</span> ·
              Labels: <span className="capitalize text-foreground font-semibold">{labelMode}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Label Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border text-xs font-semibold">
            <span className="text-muted-foreground">Team Labels:</span>
            <Button
              size="sm"
              variant={labelMode === 'name' ? 'default' : 'ghost'}
              onClick={() => updateTeamLabelMode('name')}
              className={cn("h-6 text-[11px] px-2", labelMode === 'name' && "bg-purple-600 hover:bg-purple-700 text-white")}
            >
              Name
            </Button>
            <Button
              size="sm"
              variant={labelMode === 'code' ? 'default' : 'ghost'}
              onClick={() => updateTeamLabelMode('code')}
              className={cn("h-6 text-[11px] px-2", labelMode === 'code' && "bg-purple-600 hover:bg-purple-700 text-white")}
            >
              Code (T1WA)
            </Button>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 gap-1.5 font-bold"
              >
                <Sliders className="h-4 w-4" />
                Rules Adjustments
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Facilitator Rules Engine</DialogTitle>
              </DialogHeader>
              <RulesAdjustmentPanel />
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="border-border text-foreground hover:bg-muted gap-1.5"
          >
            {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            Copy Viewer Code
          </Button>
          <Button
            size="sm"
            onClick={() => window.open(`/viewer/multi/${session.sessionCode}`, '_blank')}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 font-semibold"
          >
            <Eye className="h-4 w-4" />
            Launch Combined Viewer
          </Button>
        </div>
      </div>

      {/* Drift Warning Banner */}
      {driftWarning && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{driftWarning}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateAdvanceMode('lockstep')}
            className="border-amber-600/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 text-xs font-bold shrink-0"
          >
            Switch to Lockstep
          </Button>
        </div>
      )}

      {/* Lockstep Control Surface Header */}
      <Card className="bg-card border-border mb-6 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left Info: Mode & Readiness */}
            <div className="space-y-2">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-md border border-border">
                  <span className="text-xs text-muted-foreground font-medium">Advance Mode:</span>
                  <span className="text-xs font-bold text-purple-700 uppercase">{advanceMode}</span>
                  <Switch
                    checked={isLockstep}
                    onCheckedChange={(checked) => updateAdvanceMode(checked ? 'lockstep' : 'independent')}
                    className="ml-2"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Lockstep Readiness:</span>
                  {allTargetReady ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> All Target Worlds Ready
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-600" /> {blockedWorlds.length} World(s) Waiting
                    </Badge>
                  )}
                </div>
              </div>

              {!allTargetReady && (
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                  {blockedWorlds.map(w => {
                    const blocking = w.gameState ? getBlockingTeams(w.gameState) : [];
                    return (
                      <div key={w.key}>
                        • World {w.key} ({w.label}): Waiting on {blocking.length} team(s): {blocking.map(t => t.name).join(', ')}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Action: Lockstep Advance */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                size="lg"
                onClick={handleAdvanceTargetWorlds}
                disabled={isAdvancing}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl shadow-sm gap-2"
              >
                <FastForward className="h-5 w-5" />
                {isAdvancing
                  ? 'Advancing...'
                  : selectedWorldKeys.length > 0
                  ? `Advance Selected (${selectedWorldKeys.length})`
                  : `Advance All Worlds (${worlds.length})`}
              </Button>

              {!allTargetReady && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => executeAdvance(true)}
                  disabled={isAdvancing}
                  className="border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-bold px-4 py-3 rounded-xl gap-1.5"
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  Force Advance ($5 Default)
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main View Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="matrix" className="gap-1.5 text-xs font-bold">
              <TableIcon className="h-4 w-4" />
              Action Matrix
            </TabsTrigger>
            <TabsTrigger value="cards" className="gap-1.5 text-xs font-bold">
              <LayoutGrid className="h-4 w-4" />
              World Cards ({worlds.length})
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5 text-xs font-bold">
              <Trophy className="h-4 w-4 text-amber-500" />
              Combined Leaderboard
            </TabsTrigger>
          </TabsList>

          {selectedWorldKeys.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-700">
              <span>{selectedWorldKeys.length} world(s) selected</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedWorldKeys([])}
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </Button>
            </div>
          )}
        </div>

        {/* Tab 1: Action Matrix */}
        <TabsContent value="matrix" className="mt-0">
          <ActionMatrix
            worlds={worlds}
            labelMode={labelMode}
            selectedWorldKeys={selectedWorldKeys}
            onToggleSelectWorld={handleToggleSelectWorld}
          />
        </TabsContent>

        {/* Tab 2: World Cards Grid */}
        <TabsContent value="cards" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {worlds.map((w, idx) => {
              const blocking = w.gameState ? getBlockingTeams(w.gameState) : [];
              const isReady = blocking.length === 0;

              return (
                <WorldCard
                  key={w.key}
                  worldKey={w.key}
                  label={w.label}
                  classId={w.classId}
                  simulationClass={w.classData}
                  gameState={w.gameState}
                  labelMode={labelMode}
                  readiness={{
                    isReady,
                    reason: !isReady ? `Waiting on: ${blocking.map(t => t.name).join(', ')}` : undefined
                  }}
                  onAdvance={() => handleAdvanceSingleWorld(w.classId, w.label, false)}
                  onForceAdvance={() => handleAdvanceSingleWorld(w.classId, w.label, true)}
                  isAdvancing={isAdvancing}
                  onOpenStandalone={() => {
                    selectClass(w.classId);
                    navigate(`/class/${w.classId}`);
                  }}
                  badgeColor={idx % 2 === 0 ? 'purple' : 'blue'}
                />
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 3: Combined Multi-World Leaderboard */}
        <TabsContent value="leaderboard" className="mt-0">
          <CombinedLeaderboard worlds={worlds} labelMode={labelMode} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface WorldCardProps {
  worldKey: WorldKey;
  label: string;
  classId: string;
  simulationClass: any;
  gameState: GameState | null;
  labelMode: 'name' | 'code';
  readiness: { isReady: boolean; reason?: string };
  onAdvance: () => void;
  onForceAdvance: () => void;
  isAdvancing: boolean;
  onOpenStandalone: () => void;
  badgeColor: 'purple' | 'blue';
}

const WorldCard: React.FC<WorldCardProps> = ({
  worldKey,
  label,
  classId,
  simulationClass,
  gameState,
  labelMode,
  readiness,
  onAdvance,
  onForceAdvance,
  isAdvancing,
  onOpenStandalone,
  badgeColor
}) => {
  if (!gameState) {
    return (
      <Card className="bg-card border-border p-6 text-center text-muted-foreground">
        <p>Loading {label} state...</p>
      </Card>
    );
  }

  const currentRound = gameState.currentRound;
  const currentPhase = gameState.currentPhase;
  const teams = gameState.teams || [];

  return (
    <Card className="bg-card border-border shadow-sm flex flex-col">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${badgeColor === 'purple' ? 'bg-purple-600' : 'bg-blue-600'}`} />
            <CardTitle className="text-xl font-bold text-foreground">World {worldKey}: {label}</CardTitle>
            <Badge variant="outline" className="text-xs border-border text-muted-foreground">
              {teams.length} Teams
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenStandalone}
            className="text-xs text-purple-700 hover:text-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 gap-1 font-medium"
          >
            Standalone Control <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
        <CardDescription className="text-muted-foreground text-xs mt-1">
          Class: {simulationClass?.name || classId}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 flex-1 space-y-5">
        {/* Phase & Round Status */}
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-muted/40 border border-border">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Current Status</div>
            <div className="text-base font-bold text-foreground mt-0.5">
              Round {currentRound} — <span className="text-purple-700 dark:text-purple-400 font-extrabold">{PHASE_LABELS[currentPhase] || currentPhase}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onAdvance}
              disabled={isAdvancing}
              className="bg-background hover:bg-muted text-foreground border border-border gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Play className="h-3.5 w-3.5 text-purple-600" />
              Advance
            </Button>
            {!readiness.isReady && (
              <Button
                size="sm"
                variant="outline"
                onClick={onForceAdvance}
                disabled={isAdvancing}
                className="border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-bold gap-1"
                title="Force advance and apply $5 default plan to unsubmitted human teams"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Force
              </Button>
            )}
          </div>
        </div>

        {/* Readiness Info */}
        {!readiness.isReady && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{readiness.reason}</span>
          </div>
        )}

        {/* Team Roster & Scores */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Team Roster ({teams.length})
          </div>
          <div className="space-y-1.5">
            {teams.map((team, tIdx) => {
              const scoreData = calculateTeamTotalScore(team.id, currentRound, gameState);
              const displayLabel = getTeamDisplayLabel(team, worldKey, labelMode);
              const isBot = team.isBot || (team as any).accessCode === 'BOT' || team.name?.toLowerCase().includes('bot');

              return (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: team.color }} />
                    <span className="font-bold text-foreground">{displayLabel}</span>
                    {isBot ? (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-1.5 flex items-center gap-0.5 font-normal">
                        <Bot className="h-2.5 w-2.5" /> Bot
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5 font-normal">
                        Human
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-muted-foreground text-[11px]">Score: </span>
                      <span className="font-bold text-amber-600 text-xs">{scoreData.totalScore} pts</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MultiWorldControl;

