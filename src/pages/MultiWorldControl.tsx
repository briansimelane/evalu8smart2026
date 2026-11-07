import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMultiWorldSession, WorldSubState } from '@/hooks/useMultiWorldSession';
import { useMultiWorldBotRunners } from '@/hooks/useMultiWorldBotRunners';
import { useSession } from '@/contexts/SessionContext';
import { WorldKey } from '@/types/multiworld';
import { GamePhase, GameState, calculateTeamTotalScore, RuleAdjustmentsState } from '@/types/game';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RulesAdjustmentPanel } from '@/components/dashboard/RulesAdjustmentPanel';
import { DirectivesClaimModal } from '@/components/dashboard/DirectivesClaimModal';
import { SteveIcon } from '@/components/dashboard/SteveIcon';
import { MultiWorldSingleBoard } from '@/pages/Viewer/MultiWorldSingleBoard';
import '@/pages/Viewer/viewer.css';
import { isRuleActiveForTeam, getRuleValueForTeam } from '@/lib/defaultRules';
import { ActionMatrix } from '@/components/multiworld/ActionMatrix';
import { CombinedLeaderboard } from '@/components/multiworld/CombinedLeaderboard';
import { mutateWorldState } from '@/lib/multiworld/worldWrite';
import { advanceOnePhase, getBlockingTeams, getNextPhase, PHASE_LABELS, PHASE_SEQUENCE, SHORT_PHASE_LABELS } from '@/lib/phaseEngine';
import { calculatePlayOrderForState, computeTurnOrder, normalizePhaseName } from '@/lib/turnOrder';
import { getCarriedOverProductsForTeam } from '@/lib/rules';
import { getTeamDisplayLabel } from '@/lib/multiworld/teamLabel';
import { useApplyGameThemeAttribute } from '@/lib/gameTheme';
import { useReferee } from '@/hooks/useReferee';
import { revealPlanningAndAdvanceV2 } from '@/lib/referee/refereeEngine';
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
  ArrowRight,
  Clock,
  Eye,
  Sliders,
  Table as TableIcon,
  LayoutGrid,
  Zap,
  Trophy,
  User,
  Award,
  Map as MapIcon,
  DollarSign,
  Package,
  Wrench,
  FlaskConical,
  Truck,
  Sparkles
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

const ChildWorldReferee: React.FC<{ world: WorldSubState }> = ({ world }) => {
  const isV2 = world.classData?.schemaVersion === 2 || world.gameState?.schemaVersion === 2;
  const teams = (world.gameState?.teams && world.gameState.teams.length > 0)
    ? world.gameState.teams
    : (world.classData?.teams || (world.classData as any)?.teamRegistry || []);
  const themeId = world.gameState?.themeId || world.classData?.themeId;

  useReferee({
    classId: world.classId || null,
    enabled: Boolean(world.classId && isV2),
    teams,
    themeId,
  });
  return null;
};

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

  const activeThemeId = worlds.find(w => w.gameState?.themeId)?.gameState?.themeId ?? session?.themeId;
  useApplyGameThemeAttribute(activeThemeId);

  // Automatically execute bot turns for all worlds in this session
  useMultiWorldBotRunners(worlds);

  // Tab selection: default to matrix if > 2 worlds
  const [activeTab, setActiveTab] = useState<string>(
    worlds.length > 2 ? 'matrix' : 'cards'
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        {worlds.map((w) => (
          <ChildWorldReferee key={w.classId || w.key} world={w} />
        ))}
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

  // Target worlds for lockstep / bulk advance
  const targetWorlds = selectedWorldKeys.length > 0
    ? worlds.filter(w => selectedWorldKeys.includes(w.key))
    : worlds;

  const worldA = worlds.find(w => w.key === 'A');
  const worldB = worlds.find(w => w.key === 'B');

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
            if (
              (w.gameState?.schemaVersion === 2 || w.classData?.schemaVersion === 2) &&
              (w.gameState?.currentPhase || 'planning').toLowerCase() === 'planning'
            ) {
              const teams = (w.gameState?.teams && w.gameState.teams.length > 0)
                ? w.gameState.teams
                : (w.classData?.teams || (w.classData as any)?.teamRegistry || []);
              await revealPlanningAndAdvanceV2(w.classId, teams, w.gameState?.themeId || w.classData?.themeId, {
                force,
              });
            } else {
              await mutateWorldState(w.classId, (freshState) => {
                return advanceOnePhase(freshState, new Date(), { force });
              });
            }
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
      const targetWorld = worlds.find((w) => w.classId === classId);
      if (
        (targetWorld?.gameState?.schemaVersion === 2 || targetWorld?.classData?.schemaVersion === 2) &&
        (targetWorld?.gameState?.currentPhase || 'planning').toLowerCase() === 'planning'
      ) {
        const teams = (targetWorld.gameState?.teams && targetWorld.gameState.teams.length > 0)
          ? targetWorld.gameState.teams
          : (targetWorld.classData?.teams || (targetWorld.classData as any)?.teamRegistry || []);
        await revealPlanningAndAdvanceV2(
          classId,
          teams,
          targetWorld.gameState?.themeId || targetWorld.classData?.themeId,
          { force }
        );
      } else {
        await mutateWorldState(classId, (freshState) => {
          return advanceOnePhase(freshState, new Date(), { force });
        });
      }
      toast.success(`Advanced ${worldLabel}!`);
    } catch (err: any) {
      console.error(`Error advancing ${worldLabel}:`, err);
      toast.error(`Failed to advance ${worldLabel}: ${err.message}`);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleAllocateDirectiveForWorld = async (classId: string, teamId: string, directiveId: string) => {
    try {
      await mutateWorldState(classId, (fresh) => {
        if (!isRuleActiveForTeam(fresh.ruleAdjustments, 'directives_bonus_points', teamId)) {
          return fresh;
        }
        const pointsVal = Number(getRuleValueForTeam(fresh.ruleAdjustments, 'directives_bonus_points', teamId, 12));
        const currentAdvanced = fresh.advancedState || {};
        const claimedList = currentAdvanced.directives || [];

        if (claimedList.some((d) => d.id === directiveId)) return fresh;
        if (claimedList.some((d) => d.teamId === teamId && d.roundNumber === (fresh.currentRound || 1))) return fresh;

        const newClaim = {
          id: directiveId,
          teamId,
          roundNumber: fresh.currentRound || 1,
          points: pointsVal,
          claimedAt: new Date().toISOString(),
        };

        return {
          ...fresh,
          advancedState: {
            ...currentAdvanced,
            directives: [...claimedList, newClaim],
          },
          updatedAt: new Date(),
        };
      });
    } catch (err: any) {
      console.error('Failed to allocate directive for world:', err);
      toast.error('Failed to allocate directive: ' + err.message);
    }
  };

  const handleRevokeDirectiveForWorld = async (classId: string, directiveId: string) => {
    try {
      await mutateWorldState(classId, (fresh) => {
        const currentAdvanced = fresh.advancedState || {};
        const claimedList = currentAdvanced.directives || [];
        return {
          ...fresh,
          advancedState: {
            ...currentAdvanced,
            directives: claimedList.filter((d) => d.id !== directiveId),
          },
          updatedAt: new Date(),
        };
      });
    } catch (err: any) {
      console.error('Failed to revoke directive for world:', err);
      toast.error('Failed to revoke directive: ' + err.message);
    }
  };

  const handleUpdateRuleAdjustmentsForWorld = async (classId: string, rulesState: RuleAdjustmentsState | null) => {
    try {
      await mutateWorldState(classId, (fresh) => {
        const newState = { ...fresh };
        if (rulesState) {
          newState.ruleAdjustments = {
            ...rulesState,
            lastUpdated: new Date().toISOString(),
          };
          const isSteveActive = isRuleActiveForTeam(newState.ruleAdjustments, 'steve_event_blocker');
          if (!isSteveActive && newState.advancedState?.steve?.activeRegion) {
            newState.advancedState = {
              ...newState.advancedState,
              steve: {
                ...newState.advancedState.steve,
                activeRegion: null,
              },
            };
          }
        } else {
          delete newState.ruleAdjustments;
        }
        return newState;
      });
    } catch (err: any) {
      console.error('Failed to update rules for world:', err);
      toast.error('Failed to update rules: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      {worlds.map((w) => (
        <ChildWorldReferee key={w.classId || w.key} world={w} />
      ))}
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
            <TabsTrigger value="map" className="gap-1.5 text-xs font-bold">
              <MapIcon className="h-4 w-4 text-purple-600" />
              World Map
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
                  onAllocateDirective={handleAllocateDirectiveForWorld}
                  onRevokeDirective={handleRevokeDirectiveForWorld}
                  onUpdateRuleAdjustments={handleUpdateRuleAdjustmentsForWorld}
                />
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 3: World Map (Combined Board) */}
        <TabsContent value="map" className="mt-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-bold text-foreground">Combined World Map</span>
                <Badge variant="outline" className="text-xs">
                  {worlds.length === 2 ? 'World A & World B Overlay' : `${worlds.length} Worlds`}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/viewer/multi/${session.sessionCode}`, '_blank')}
                className="text-xs gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Fullscreen Combined Viewer
              </Button>
            </div>
            {worlds.length === 2 && worldA?.gameState && worldB?.gameState ? (
              <div className="w-full flex justify-center py-2 bg-slate-100 rounded-xl overflow-hidden border border-slate-300 shadow-inner">
                <MultiWorldSingleBoard
                  session={session}
                  gameStateA={worldA.gameState}
                  gameStateB={worldB.gameState}
                  classDataA={worldA.classData}
                  classDataB={worldB.classData}
                />
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground bg-card rounded-lg border border-border">
                <p className="text-sm font-semibold">Single Board Overlay is optimized for 2 worlds.</p>
                <p className="text-xs mt-1">Use "Open Fullscreen Combined Viewer" above to view all {worlds.length} worlds in responsive grid.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Combined Multi-World Leaderboard */}
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
  onAllocateDirective: (classId: string, teamId: string, directiveId: string) => Promise<void>;
  onRevokeDirective: (classId: string, directiveId: string) => Promise<void>;
  onUpdateRuleAdjustments: (classId: string, rulesState: RuleAdjustmentsState | null) => Promise<void>;
}

const SHORT_PHASE_LABELS: Record<string, string> = {
  planning: '1. Plan',
  production: '2. Prod',
  improvement: '3. Impr',
  innovation: '4. Res',
  expansion: '5. Log',
  sales: '6. Sales',
  control: '7. Ctrl',
  scoring: '8. Score',
};

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
  badgeColor,
  onAllocateDirective,
  onRevokeDirective,
  onUpdateRuleAdjustments,
}) => {
  if (!gameState) {
    return (
      <Card className="bg-card border-border p-6 text-center text-muted-foreground">
        <p>Loading {label} state...</p>
      </Card>
    );
  }

  const currentRound = gameState.currentRound || 1;
  const currentPhase = gameState.currentPhase || 'planning';
  const normPhase = normalizePhaseName(currentPhase);
  const teams = gameState.teams || [];
  const currentRoundData = gameState.rounds?.find(r => r.roundNumber === currentRound);

  // Directives and Rules state for this World
  const claimedDirectivesList = gameState.advancedState?.directives || [];
  const claimedDirectivesCount = claimedDirectivesList.length;
  const isDirectivesRuleActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'directives_bonus_points');
  const hasCustomRules = Boolean(
    gameState.ruleAdjustments &&
    gameState.ruleAdjustments.rules &&
    Object.values(gameState.ruleAdjustments.rules).some(
      (r: any) => r.enabled || (r.teamOverrides && Object.keys(r.teamOverrides).length > 0)
    )
  );

  // Steve event blocker state for this World
  const steve = gameState.advancedState?.steve;
  const isSteveActive = Boolean(steve?.activeRegion && isRuleActiveForTeam(gameState.ruleAdjustments, 'steve_event_blocker'));
  const activeSteveRegion = isSteveActive ? steve?.activeRegion : null;
  const stevePaidCount = isSteveActive
    ? Object.values(steve?.wildcardsContributed || {}).reduce((a, b) => a + Number(b), 0)
    : 0;

  // Compute next phase info
  const { nextPhase, nextRound, isGameEnd } = getNextPhase(gameState);
  const nextPhaseLabel = isGameEnd
    ? 'Game Complete'
    : nextRound > currentRound
    ? `Round ${nextRound} — ${PHASE_LABELS[nextPhase]}`
    : PHASE_LABELS[nextPhase];

  // Compute turn order & active turn
  const playOrder = calculatePlayOrderForState(gameState, currentRound);
  const v2Turn =
    gameState.schemaVersion === 2 &&
    gameState.turn &&
    gameState.turn.round === currentRound &&
    normalizePhaseName(gameState.turn.phase) === normPhase
      ? gameState.turn
      : null;

  const effectiveTurn = React.useMemo(() => {
    if (v2Turn) return v2Turn;
    return computeTurnOrder(gameState, currentPhase);
  }, [v2Turn, gameState, currentPhase]);

  // Determine sorted order for display
  const orderedTeams = React.useMemo(() => {
    const map = new Map(teams.map((t) => [t.id, t]));
    const list: Team[] = [];

    // In turn-based phases, sequence strictly by effective turn order
    if (['improvement', 'innovation', 'expansion', 'sales'].includes(normPhase)) {
      const order = effectiveTurn?.order || [];
      order.forEach((tid) => {
        const found = map.get(tid);
        if (found) {
          list.push(found);
          map.delete(tid);
        }
      });
      // Append any teams not in the turn order (e.g. 0 allowance)
      map.forEach((t) => list.push(t));
      return list;
    }

    // In production phase, sequence strictly by price priority (lowest price first) then wealth
    if (normPhase === 'production') {
      playOrder.forEach((t) => {
        const found = map.get(t.id);
        if (found) {
          list.push(found);
          map.delete(t.id);
        }
      });
      map.forEach((t) => list.push(t));
      return list;
    }

    // In scoring phase, sequence by total score descending
    if (normPhase === 'scoring') {
      const scoredTeams = [...teams].sort((a, b) => {
        const scoreA = calculateTeamTotalScore(a.id, currentRound, gameState).totalScore;
        const scoreB = calculateTeamTotalScore(b.id, currentRound, gameState).totalScore;
        return scoreB - scoreA;
      });
      return scoredTeams;
    }

    // Default (e.g. planning): sequence by base play order (lowest prior score / wealth)
    playOrder.forEach((t) => {
      const found = map.get(t.id);
      if (found) {
        list.push(found);
        map.delete(t.id);
      }
    });
    map.forEach((t) => list.push(t));
    return list;
  }, [teams, effectiveTurn, normPhase, playOrder, currentRound, gameState]);

  const getTeamStatus = (team: Team, idx: number) => {
    const tData = currentRoundData?.teamData?.[team.id];
    let isSubmitted = false;
    let isActiveTurn = false;
    let hasAllowance = true;

    if (normPhase === 'planning') {
      isSubmitted = Boolean(
        (tData && tData.price !== undefined && tData.price !== null && tData.price > 0) ||
        gameState.planSubmittedByRound?.[currentRound]?.[team.id]
      );
    } else if (['improvement', 'innovation', 'expansion', 'sales'].includes(normPhase)) {
      if (effectiveTurn && Array.isArray(effectiveTurn.order)) {
        const orderIdx = effectiveTurn.order.indexOf(team.id);
        if (orderIdx === -1) {
          hasAllowance = false;
          isSubmitted = true;
        } else if (orderIdx < effectiveTurn.index) {
          isSubmitted = true;
        } else if (orderIdx === effectiveTurn.index) {
          isActiveTurn = true;
        }
      } else {
        if (normPhase === 'improvement') {
          hasAllowance = currentRound < 5 && (tData?.improvementCards || 0) > 0;
          isSubmitted = !hasAllowance || (gameState.improvementCards || []).some(
            c => (c.availableForTeam === team.id || c.usedBy === team.id) && c.allocatedInRound === currentRound
          );
        } else if (normPhase === 'innovation') {
          const icons = tData?.researchIcons || 0;
          hasAllowance = icons > 0;
          const spent = (gameState.researchAllocatedByRound || {})[currentRound]?.[team.id] || 0;
          isSubmitted = !hasAllowance || spent >= icons;
        } else if (normPhase === 'expansion') {
          const icons = tData?.logisticsIcons || 0;
          hasAllowance = icons > 0;
          const spent = (gameState.logisticsAllocatedByRound || {})[currentRound]?.[team.id] || 0;
          isSubmitted = !hasAllowance || spent >= icons;
        } else if (normPhase === 'sales') {
          const produced = tData?.productsProduced || 0;
          hasAllowance = produced > 0;
          isSubmitted = !hasAllowance || Boolean(tData?.customersSold);
        }
      }
    } else {
      isSubmitted = true;
    }

    return { isSubmitted, isActiveTurn, hasAllowance };
  };

  const renderTeamPhaseDetails = (team: Team, tData?: any, scoreTotal?: number) => {
    if (normPhase === 'planning') {
      const isSubmitted = Boolean(
        (tData && tData.price !== undefined && tData.price !== null && tData.price > 0) ||
        gameState.planSubmittedByRound?.[currentRound]?.[team.id]
      );

      if (isSubmitted && tData && tData.price) {
        return (
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Price: ${tData.price}
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Package className="h-3 w-3 text-blue-600" />
              Prod: {tData.productsProduced || 0} units
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <FlaskConical className="h-3 w-3 text-purple-600" />
              Res: {tData.researchIcons || 0}
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Truck className="h-3 w-3 text-cyan-600" />
              Log: {tData.logisticsIcons || 0}
            </span>
            {tData.improvementCards ? (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-amber-600" />
                  Cards: {tData.improvementCards}
                </span>
              </>
            ) : null}
          </div>
        );
      }
      return (
        <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
          <Clock className="h-3 w-3 text-amber-500/70" />
          Awaiting Round {currentRound} decisions (Price, Production, Research & Logistics)
        </span>
      );
    }

    if (normPhase === 'production') {
      const carryover = getCarriedOverProductsForTeam(gameState, team.id);
      const produced = tData?.productsProduced || 0;
      const totalInventory = produced + carryover;
      const price = tData?.price;

      return (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Price: {price !== undefined ? `$${price}` : 'Sealed'}
          </span>
          <span className="text-muted-foreground/50">•</span>
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Package className="h-3 w-3 text-blue-600" />
            Produced: {produced} units
          </span>
          {carryover > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-purple-600 dark:text-purple-400 font-semibold">
                +{carryover} carryover
              </span>
            </>
          )}
          <span className="text-muted-foreground/50">•</span>
          <span className="font-bold text-foreground">
            Total Inventory: {totalInventory}
          </span>
          {tData?.totalMoney !== undefined && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-muted-foreground font-medium">Treasury: ${tData.totalMoney}</span>
            </>
          )}
        </div>
      );
    }

    if (normPhase === 'improvement') {
      if (currentRound >= 5) {
        return (
          <span className="text-[11px] text-muted-foreground italic">
            Improvement phase skipped in Round 5 (Final Round)
          </span>
        );
      }

      const cardsAllowance = tData?.improvementCards || 0;
      if (cardsAllowance <= 0) {
        return (
          <span className="text-[11px] text-muted-foreground italic">
            0 card allowance (No improvement cards in plan)
          </span>
        );
      }

      const pickedCard = (gameState.improvementCards || []).find(
        (c: any) => (c.availableForTeam === team.id || c.usedBy === team.id) && c.allocatedInRound === currentRound
      );
      const convertedToProduct = tData?.improvementCardUsage === 'product';

      if (convertedToProduct) {
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <Package className="h-3 w-3" />
            <span>Converted 1 improvement card allowance into <strong>+1 Product</strong></span>
          </div>
        );
      }

      if (pickedCard) {
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-foreground font-medium">
            <Wrench className="h-3 w-3 text-amber-600" />
            <span>Claimed: <strong>{pickedCard.title || pickedCard.name}</strong> ({pickedCard.type || 'Card'} #{pickedCard.id})</span>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
          <Wrench className="h-3 w-3 text-amber-500" />
          <span>Allowance: <strong>{cardsAllowance} card</strong> to choose from marketplace</span>
        </div>
      );
    }

    if (normPhase === 'innovation') {
      const icons = tData?.researchIcons || 0;
      if (icons <= 0) {
        return (
          <span className="text-[11px] text-muted-foreground italic">
            0 research icons (No innovation icons allocated)
          </span>
        );
      }

      const spent = (gameState.researchAllocatedByRound || {})[currentRound]?.[team.id] || 0;
      const remaining = Math.max(0, icons - spent);
      const researched = tData?.technologiesResearched || [];

      return (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <FlaskConical className="h-3 w-3 text-purple-600" />
            Allowance: {icons} icons
          </span>
          <span className="text-muted-foreground/50">•</span>
          <span className={spent >= icons ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>
            Spent: {spent} / {icons}
          </span>
          {remaining > 0 ? (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                {remaining} unallocated
              </span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Allocations complete</span>
            </>
          )}
          {researched.length > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-purple-600 dark:text-purple-400 font-medium">Patents: {researched.join(', ')}</span>
            </>
          )}
        </div>
      );
    }

    if (normPhase === 'expansion') {
      const icons = tData?.logisticsIcons || 0;
      if (icons <= 0) {
        return (
          <span className="text-[11px] text-muted-foreground italic">
            0 logistics icons (No expansion icons allocated)
          </span>
        );
      }

      const spent = (gameState.logisticsAllocatedByRound || {})[currentRound]?.[team.id] || 0;
      const remaining = Math.max(0, icons - spent);
      const locations = tData?.expansionLocations || [];

      return (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Truck className="h-3 w-3 text-cyan-600" />
            Allowance: {icons} icons
          </span>
          <span className="text-muted-foreground/50">•</span>
          <span className={spent >= icons ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>
            Spent: {spent} / {icons}
          </span>
          {remaining > 0 ? (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                {remaining} unallocated
              </span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Offices established</span>
            </>
          )}
          {locations.length > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">Target: {locations.join(', ')}</span>
            </>
          )}
        </div>
      );
    }

    if (normPhase === 'sales') {
      const produced = tData?.productsProduced || 0;
      const customers = tData?.customersSold || [];
      const sold = customers.length || Object.values(tData?.salesByRegion || {}).reduce((a: number, b: any) => a + Number(b), 0);
      const unsold = Math.max(0, produced - sold);
      const revenue = tData?.revenue || (sold * (tData?.price || 0));

      return (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Price: ${tData?.price || 0}
          </span>
          <span className="text-muted-foreground/50">•</span>
          <span className="font-bold text-foreground">
            Sold: {sold} / {produced} units
          </span>
          <span className="text-muted-foreground/50">•</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            Revenue: +${revenue}
          </span>
          {unsold > 0 ? (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{unsold} unsold units</span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">100% Sold</span>
            </>
          )}
        </div>
      );
    }

    if (normPhase === 'control') {
      const controlValue = tData?.controlValue || Object.values(tData?.regionControlPoints || {}).reduce((a: number, b: any) => a + Number(b), 0);
      const controlledRegions = Object.entries(tData?.regionControlPoints || {})
        .filter(([_, pts]) => Number(pts) > 0)
        .map(([reg, pts]) => `${reg} (${pts} pts)`);

      return (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Control Score: +{controlValue} pts
          </span>
          {controlledRegions.length > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-foreground font-medium">
                Regions: {controlledRegions.join(', ')}
              </span>
            </>
          )}
        </div>
      );
    }

    if (normPhase === 'scoring') {
      const revenue = tData?.revenue || 0;
      const control = tData?.controlValue || 0;

      return (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="text-foreground font-medium">Round Revenue: <strong>+${revenue}</strong></span>
          <span className="text-muted-foreground/50">•</span>
          <span className="text-purple-600 dark:text-purple-400 font-medium">Control: <strong>+{control} pts</strong></span>
          <span className="text-muted-foreground/50">•</span>
          <span className="text-amber-600 dark:text-amber-400 font-bold">Total: {scoreTotal} pts</span>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="bg-card border-border shadow-sm flex flex-col">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-3 h-3 rounded-full ${badgeColor === 'purple' ? 'bg-purple-600' : 'bg-blue-600'}`} />
            <CardTitle className="text-xl font-bold text-foreground">World {worldKey}: {label}</CardTitle>
            <Badge variant="outline" className="text-xs border-border text-muted-foreground">
              {teams.length} Teams
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* World Directives Modal Trigger */}
            <DirectivesClaimModal
              gameState={gameState}
              worldLabel={`World ${worldKey}: ${label}`}
              onAllocateDirective={(tId, dId) => onAllocateDirective(classId, tId, dId)}
              onRevokeDirective={(dId) => onRevokeDirective(classId, dId)}
              onUpdateRuleAdjustments={(updated) => onUpdateRuleAdjustments(classId, updated)}
              triggerNode={
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "text-xs h-7.5 px-2.5 gap-1.5 font-semibold border shadow-2xs transition-colors",
                    claimedDirectivesCount > 0
                      ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                      : "border-border text-foreground/80 hover:text-foreground hover:bg-muted"
                  )}
                  title={`View & Allocate Directives for World ${worldKey}`}
                >
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  <span>Directives</span>
                  {claimedDirectivesCount > 0 && (
                    <Badge className="ml-0.5 px-1.5 py-0 text-[10px] bg-amber-500 text-white font-bold h-4">
                      {claimedDirectivesCount}
                    </Badge>
                  )}
                </Button>
              }
            />

            {/* World Rules Modal Trigger */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "text-xs h-7.5 px-2.5 gap-1.5 font-semibold border shadow-2xs transition-colors",
                    hasCustomRules
                      ? "border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20"
                      : "border-border text-foreground/80 hover:text-foreground hover:bg-muted"
                  )}
                  title={`Configure Rules for World ${worldKey}`}
                >
                  <Sliders className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Rules</span>
                  {hasCustomRules && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-indigo-600" />
                    <span>Rules Engine — World {worldKey}: {label}</span>
                  </DialogTitle>
                </DialogHeader>
                <RulesAdjustmentPanel
                  gameState={gameState}
                  worldLabel={`World ${worldKey}: ${label}`}
                  onUpdateRuleAdjustments={(updated) => onUpdateRuleAdjustments(classId, updated)}
                  onAllocateDirective={(tId, dId) => onAllocateDirective(classId, tId, dId)}
                  onRevokeDirective={(dId) => onRevokeDirective(classId, dId)}
                />
              </DialogContent>
            </Dialog>

            {/* Steve Blocker Active Indicator */}
            {isSteveActive && activeSteveRegion && (
              <Badge
                variant="outline"
                className="text-xs h-7.5 px-2.5 gap-1.5 font-bold border-red-500/40 text-red-700 dark:text-red-300 bg-red-500/10 shadow-2xs"
                title={`Steve is blocking ${activeSteveRegion} (${stevePaidCount}/5 Wildcards Paid)`}
              >
                <SteveIcon size={14} />
                <span>Steve: {activeSteveRegion}</span>
                <span className="text-[10px] opacity-75 font-mono font-normal">({stevePaidCount}/5)</span>
              </Badge>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenStandalone}
              className="text-xs h-7.5 px-2 text-purple-700 hover:text-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 gap-1 font-medium"
            >
              Standalone <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-muted-foreground text-xs mt-1">
          Class: {simulationClass?.name || classId}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 flex-1 space-y-5">
        {/* Phase & Round Status */}
        <div className="space-y-3 p-3.5 rounded-lg bg-muted/40 border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                <span>Phase Progression</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-purple-700 dark:text-purple-300 font-semibold lowercase">
                  moving to {isGameEnd ? 'game end' : nextRound > currentRound ? `round ${nextRound} ${PHASE_LABELS[nextPhase]}` : PHASE_LABELS[nextPhase]}
                </span>
              </div>
              <div className="text-base font-extrabold text-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Round {currentRound} — <span className="text-purple-700 dark:text-purple-400">{PHASE_LABELS[currentPhase] || currentPhase}</span></span>
                <Badge variant="outline" className="text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                  Next: {nextPhase ? (SHORT_PHASE_LABELS[nextPhase] || nextPhase) : 'End'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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

          {/* 8-Phase Stepper Sequence */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 pt-1 border-t border-border/50">
            {PHASE_SEQUENCE.map((phaseKey, pIdx) => {
              const isCurrent = normPhase === phaseKey;
              const isNext = !isGameEnd && nextPhase === phaseKey;
              const isPast = pIdx < PHASE_SEQUENCE.indexOf(normPhase as any);
              const isSkipped = currentRound >= 5 && phaseKey === 'improvement';

              return (
                <div
                  key={phaseKey}
                  className={cn(
                    "px-1 py-1 rounded text-center text-[10px] transition-all flex flex-col items-center justify-center min-h-[34px]",
                    isCurrent
                      ? "bg-purple-600 text-white font-extrabold shadow-xs ring-2 ring-purple-600/30"
                      : isNext
                      ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-bold"
                      : isPast
                      ? "bg-muted/70 text-muted-foreground line-through opacity-60"
                      : isSkipped
                      ? "opacity-30 line-through text-muted-foreground"
                      : "bg-background/60 text-muted-foreground border border-transparent"
                  )}
                  title={`${PHASE_LABELS[phaseKey] || phaseKey}${isCurrent ? ' (Active)' : isNext ? ' (Moving here next)' : ''}`}
                >
                  <span className="truncate w-full leading-tight font-medium">
                    {SHORT_PHASE_LABELS[phaseKey] || phaseKey}
                  </span>
                  {isCurrent && (
                    <span className="text-[8px] uppercase tracking-wider font-black text-purple-100">Live</span>
                  )}
                  {isNext && (
                    <span className="text-[8px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400">Next</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Readiness Info */}
        {!readiness.isReady && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{readiness.reason}</span>
          </div>
        )}

        {/* Steve Blocker Alert Banner */}
        {isSteveActive && activeSteveRegion && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 flex items-center justify-between text-xs font-semibold gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <SteveIcon size={16} />
              <span>Steve Blocker Active: <strong>{activeSteveRegion}</strong> ({stevePaidCount}/5 Wildcards Paid)</span>
            </div>
            <Badge variant="outline" className="border-red-500/30 text-red-700 dark:text-red-300 text-[10px] font-bold">
              Expansion & Sales Disabled
            </Badge>
          </div>
        )}

        {/* Team Roster & Turn Order */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>Team Turn Order & Phase Resources ({teams.length})</span>
            </div>
            {normPhase === 'planning' ? (
              <span className="text-[10px] text-muted-foreground font-normal lowercase italic">concurrent planning</span>
            ) : ['improvement', 'innovation', 'expansion', 'sales'].includes(normPhase) ? (
              <Badge variant="outline" className="text-[10px] font-bold text-purple-700 dark:text-purple-300 border-purple-500/30 bg-purple-500/10 py-0">
                Turn-based sequence
              </Badge>
            ) : normPhase === 'production' ? (
              <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 py-0">
                Price priority order
              </Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            {orderedTeams.map((team, tIdx) => {
              const scoreData = calculateTeamTotalScore(team.id, currentRound, gameState);
              const displayLabel = getTeamDisplayLabel(team, worldKey, labelMode);
              const isBot = team.isBot || (team as any).accessCode === 'BOT' || team.name?.toLowerCase().includes('bot');
              const { isSubmitted, isActiveTurn, hasAllowance } = getTeamStatus(team, tIdx);
              const tData = currentRoundData?.teamData?.[team.id];
              const isThinking = !isSubmitted && Boolean(gameState.botThinking?.[team.id]);
              const ceoName = team.ceoName || null;
              const teamClaimedDirectives = claimedDirectivesList.filter((d: any) => d.teamId === team.id);

              return (
                <div
                  key={team.id}
                  className={cn(
                    "p-2.5 rounded-lg border text-xs shadow-xs transition-all flex flex-col gap-2",
                    isActiveTurn
                      ? "bg-amber-500/10 border-amber-500/70 ring-2 ring-amber-500/40 shadow-sm"
                      : "bg-background border-border hover:border-border/80"
                  )}
                >
                  {/* Top Line: Turn #, Color, Name, Bot/Human, CEO, Status, Score */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Turn Order Badge */}
                      <span
                        className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[10px] shrink-0 border",
                          isActiveTurn
                            ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                            : "bg-muted text-muted-foreground border-border"
                        )}
                        title={`Turn Order #${tIdx + 1}`}
                      >
                        #{tIdx + 1}
                      </span>

                      <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: team.color }} />
                      <span className="font-bold text-foreground truncate max-w-[120px] sm:max-w-none">{displayLabel}</span>

                      {isBot ? (
                        <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px] py-0 px-1.5 flex items-center gap-0.5 font-normal">
                          <Bot className="h-2.5 w-2.5" /> Bot
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] py-0 px-1.5 font-normal">
                          Human
                        </Badge>
                      )}

                      {/* CEO Name Display */}
                      <span className="text-muted-foreground text-[11px] flex items-center gap-1 pl-1 border-l border-border/60">
                        <User className="h-3 w-3 text-muted-foreground/70" />
                        <span className="font-medium text-foreground/90 truncate max-w-[110px]">
                          {ceoName ? ceoName : <span className="italic text-muted-foreground">Vacant</span>}
                        </span>
                      </span>

                      {/* Directives Badges */}
                      {teamClaimedDirectives.length > 0 && (
                        <div className="flex items-center gap-1 pl-1 border-l border-border/60 flex-wrap">
                          {teamClaimedDirectives.map((d: any) => (
                            <Badge
                              key={d.id}
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold flex items-center gap-0.5"
                              title={`Claimed Directive ${d.id.replace('directive_', '#')} in Round ${d.roundNumber} (+${d.points || 12} VPs)`}
                            >
                              <Award className="h-2.5 w-2.5 text-amber-500" />
                              <span>{d.id.replace('directive_', '#')}</span>
                              <span className="text-[9px] font-normal text-amber-600 dark:text-amber-400">+{d.points || 12}</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Submission / Turn Status */}
                      {isSubmitted ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold text-[10px] py-0.5 px-1.5 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                          {normPhase === 'planning' ? 'Submitted' : 'Done'}
                        </Badge>
                      ) : isThinking ? (
                        <Badge className="bg-amber-500 text-white border-amber-600 font-bold text-[10px] py-0.5 px-2 flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          Thinking...
                        </Badge>
                      ) : isActiveTurn ? (
                        <Badge className="bg-amber-500 text-white border-amber-600 font-extrabold text-[10px] py-0.5 px-2.5 flex items-center gap-1.5 animate-pulse shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 animate-ping" />
                          Active Turn
                        </Badge>
                      ) : !hasAllowance ? (
                        <Badge variant="outline" className="text-muted-foreground text-[10px] py-0 px-1.5 opacity-60">
                          0 Allowance
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-400/40 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-[10px] py-0.5 px-1.5 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                          {normPhase === 'planning' ? 'Planning...' : 'Waiting'}
                        </Badge>
                      )}

                      <div className="text-right pl-2 border-l border-border/60">
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-xs whitespace-nowrap">
                          {scoreData.totalScore} pts
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-line: Phase Action, Resources & Progress */}
                  <div className="bg-muted/40 dark:bg-muted/20 px-2 py-1 rounded border border-border/40">
                    {renderTeamPhaseDetails(team, tData, scoreData.totalScore)}
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

