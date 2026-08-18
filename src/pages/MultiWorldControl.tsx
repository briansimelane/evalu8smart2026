import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMultiWorldSession } from '@/hooks/useMultiWorldSession';
import { useMultiWorldBotRunner } from '@/hooks/useMultiWorldBotRunner';
import { useSession } from '@/contexts/SessionContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GamePhase, GameState } from '@/types/game';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
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
  Trophy
} from 'lucide-react';
import { calculateTeamTotalScore } from '@/types/game';
import { cn, removeUndefined, safeIsoString } from '@/lib/utils';
import { decidePlanning, decideSales } from '@/bots/botEngine';
import { calculatePlanStats } from '@/lib/rules';
import { COMBINATIONS } from '@/data/combinations';
import { REGION_CUSTOMERS } from '@/data/customers';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';

const PHASE_SEQUENCE: GamePhase[] = [
  'planning',
  'production',
  'improvement',
  'innovation',
  'expansion',
  'sales',
  'control',
  'scoring'
];

const PHASE_LABELS: Record<string, string> = {
  planning: '1. Planning',
  production: '2. Production',
  improvement: '3. Improvement Cards',
  innovation: '4. Research & Dev',
  expansion: '5. Logistics & Expansion',
  sales: '6. Sales Resolution',
  control: '7. Control Phase',
  scoring: '8. Scoring Phase'
};

function getNextPhaseAndRound(currentPhase: GamePhase, currentRound: number): { nextPhase: GamePhase; nextRound: number; isGameEnd: boolean } {
  const currentIndex = PHASE_SEQUENCE.indexOf(currentPhase);
  if (currentIndex >= 0 && currentIndex < PHASE_SEQUENCE.length - 1) {
    return { nextPhase: PHASE_SEQUENCE[currentIndex + 1], nextRound: currentRound, isGameEnd: false };
  } else {
    if (currentRound >= 5) {
      return { nextPhase: 'scoring', nextRound: 5, isGameEnd: true };
    }
    return { nextPhase: 'planning', nextRound: currentRound + 1, isGameEnd: false };
  }
}

function checkWorldReadiness(gameState: GameState | null): { isReady: boolean; reason?: string } {
  if (!gameState) return { isReady: false, reason: 'Game state loading...' };
  if (gameState.gameEnded) return { isReady: true, reason: 'Game finished' };

  const currentRound = gameState.currentRound;
  const roundData = gameState.rounds.find(r => r.roundNumber === currentRound);

  if (gameState.currentPhase === 'planning' && roundData) {
    const unsubmittedHumans = gameState.teams.filter(team => {
      if (team.isBot) return false;
      const td = roundData.teamData[team.id];
      return !td || td.price === undefined || td.price === null || td.price === 0;
    });

    if (unsubmittedHumans.length > 0) {
      return {
        isReady: false,
        reason: `Waiting on ${unsubmittedHumans.length} team(s): ${unsubmittedHumans.map(t => t.name).join(', ')}`
      };
    }
  }

  return { isReady: true };
}

export const MultiWorldControl: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { selectClass } = useSession();
  const [copiedCode, setCopiedCode] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const {
    session,
    worldAClass,
    worldBClass,
    worldAGameState,
    worldBGameState,
    loading,
    error,
    updateAdvanceMode
  } = useMultiWorldSession(sessionId || '');

  // Automatically run bot turns for World A & World B in background
  useMultiWorldBotRunner(session?.worldAClassId, worldAGameState);
  useMultiWorldBotRunner(session?.worldBClassId, worldBGameState);

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

  const readyA = checkWorldReadiness(worldAGameState);
  const readyB = checkWorldReadiness(worldBGameState);
  const bothReady = readyA.isReady && readyB.isReady;

  const handleCopyCode = () => {
    if (!session.sessionCode) return;
    navigator.clipboard.writeText(session.sessionCode);
    setCopiedCode(true);
    toast.success('Viewer session code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

function ensureWorldRoundDataAndBotSales(gameState: GameState): GameState {
  const newState = { ...gameState };
  const round = newState.currentRound;

  let roundsCopy = [...(newState.rounds || [])];
  let roundData = roundsCopy.find(r => r.roundNumber === round);

  if (!roundData) {
    roundData = { roundNumber: round, teamData: {} };
    roundsCopy.push(roundData);
  } else {
    roundData = { ...roundData, teamData: { ...(roundData.teamData || {}) } };
    const rIdx = roundsCopy.findIndex(r => r.roundNumber === round);
    roundsCopy[rIdx] = roundData;
  }
  newState.rounds = roundsCopy;

  // 1. Ensure all teams have round planning data (so productsProduced > 0)
  newState.teams.forEach(t => {
    if (!roundData!.teamData[t.id]) {
      const profile = (t as any).botProfile || 'BALANCED';
      const difficulty = (t as any).botDifficulty || 'MEDIUM';
      const decision = decidePlanning(newState, t.id, profile, difficulty, COMBINATIONS);
      const stats = calculatePlanStats(newState, t.id, decision.combination, decision.position, decision.cardUsages, COMBINATIONS);

      roundData!.teamData[t.id] = {
        teamId: t.id,
        combination: decision.combination,
        position: decision.position,
        price: stats.calculatedPrice || 5,
        productsProduced: stats.productsAvailable || 2,
        improvementCards: stats.improvementPoints || 0,
        researchIcons: stats.researchPoints || 0,
        logisticsIcons: stats.logisticsPoints || 1,
        cardUsages: decision.cardUsages,
        revenue: 0,
        technologiesResearched: [],
        expansionLocations: [],
        salesByRegion: {},
        regionControlPoints: {},
        controlValue: 0,
        totalMoney: 0,
      };
    }
  });

  const currentPhase = (newState.currentPhase || 'planning').toLowerCase();

  // 2. If in improvement phase, auto-allocate cards for round if missing so simulation doesn't get stuck
  if (currentPhase === 'improvement' && round < 5) {
    let cardsCopy = [...(newState.improvementCards || [])];
    const usedCardIds = cardsCopy.map(c => c.id);

    newState.teams.forEach((t, idx) => {
      const hasCardThisRound = cardsCopy.some(c => c.availableForTeam === t.id && c.allocatedInRound === round);
      if (!hasCardThisRound) {
        const availablePoolCard = AVAILABLE_IMPROVEMENT_CARDS.find(c => !usedCardIds.includes(c.id));
        if (availablePoolCard) {
          usedCardIds.push(availablePoolCard.id);
          cardsCopy.push({
            id: availablePoolCard.id,
            icon1: availablePoolCard.icon1,
            icon2: availablePoolCard.icon2,
            availableForTeam: t.id,
            used: false,
            isInitial: false,
            allocatedInRound: round
          });
        } else {
          cardsCopy.push({
            id: -(round * 100 + idx + 1),
            icon1: 'Product',
            icon2: 'None' as any,
            availableForTeam: t.id,
            used: false,
            isInitial: false,
            allocatedInRound: round
          });
        }
      }
    });
    newState.improvementCards = cardsCopy;
  }

  // 3. If in sales phase, auto-execute sales for any Bot team without sales completed
  if (currentPhase === 'sales') {
    const soldCustomers = new Set<string>();
    Object.values(roundData.teamData).forEach((td: any) => {
      if (td?.customersSold) {
        td.customersSold.forEach((cid: string) => soldCustomers.add(cid));
      }
    });

    newState.teams.forEach(t => {
      const isBot = t.isBot || (t as any).accessCode === 'BOT' || t.name.toLowerCase().includes('bot');
      const tData = roundData!.teamData[t.id];

      if (isBot && tData && !tData.customersSold) {
        const profile = (t as any).botProfile || 'BALANCED';
        const difficulty = (t as any).botDifficulty || 'MEDIUM';
        const chosenCustomerIds = decideSales(newState, t.id, profile, difficulty, soldCustomers);

        chosenCustomerIds.forEach(cid => soldCustomers.add(cid));

        const teamPrice = tData.price || 5;
        const revenue = teamPrice * chosenCustomerIds.length;
        const salesByRegion: Record<string, number> = {};

        chosenCustomerIds.forEach(cid => {
          const regObj = REGION_CUSTOMERS.find(r => r.customers.some(c => c.id === cid));
          if (regObj) {
            salesByRegion[regObj.region] = (salesByRegion[regObj.region] || 0) + 1;
          }
        });

        roundData!.teamData[t.id] = {
          ...tData,
          customersSold: chosenCustomerIds,
          salesByRegion,
          revenue,
          totalMoney: (tData.totalMoney || 0) + revenue
        };
      }
    });
  }

  return newState;
}

  const advanceSingleWorldState = async (classId: string, currentGameState: GameState) => {
    const { nextPhase, nextRound, isGameEnd } = getNextPhaseAndRound(currentGameState.currentPhase, currentGameState.currentRound);

    let updatedState: GameState = {
      ...currentGameState,
      currentPhase: nextPhase,
      currentRound: nextRound,
      gameEnded: isGameEnd || !!currentGameState.gameEnded,
      createdAt: safeIsoString(currentGameState.createdAt) as any,
      updatedAt: safeIsoString(new Date()) as any
    };

    updatedState = ensureWorldRoundDataAndBotSales(updatedState);

    const stateRef = doc(db, 'classes', classId, 'state', 'game');
    await setDoc(stateRef, removeUndefined({ gameState: updatedState }));
  };

  const handleAdvanceBoth = async () => {
    if (!worldAGameState || !worldBGameState) return;
    setIsAdvancing(true);

    try {
      await Promise.all([
        advanceSingleWorldState(session.worldAClassId, worldAGameState),
        advanceSingleWorldState(session.worldBClassId, worldBGameState)
      ]);
      toast.success('Advanced both worlds simultaneously!');
    } catch (err: any) {
      console.error("Error advancing both worlds:", err);
      toast.error('Failed to advance both worlds: ' + (err.message || err));
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleAdvanceWorld = async (worldKey: 'A' | 'B') => {
    const classId = worldKey === 'A' ? session.worldAClassId : session.worldBClassId;
    const gState = worldKey === 'A' ? worldAGameState : worldBGameState;
    if (!classId || !gState) return;

    setIsAdvancing(true);
    try {
      await advanceSingleWorldState(classId, gState);
      toast.success(`Advanced ${worldKey === 'A' ? session.worldALabel : session.worldBLabel}!`);
    } catch (err: any) {
      console.error(`Error advancing World ${worldKey}:`, err);
      toast.error(`Failed to advance World ${worldKey}`);
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-border">
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
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-600" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{session.name}</h1>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                Multi-World 10-Team
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Code: <span className="font-mono font-bold text-purple-700">{session.sessionCode}</span> ·
              Advance Mode: <span className="capitalize text-foreground font-semibold">{advanceMode}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Lockstep Control Surface Header */}
      <Card className="bg-card border-border mb-8 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Info: Mode & Readiness */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
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
                  <span className="text-muted-foreground">Status:</span>
                  {bothReady ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Ready to Advance Both
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-600" /> Waiting on Submissions
                    </Badge>
                  )}
                </div>
              </div>

              {!bothReady && (
                <div className="text-xs text-amber-800 space-y-1 bg-amber-50 p-2.5 rounded border border-amber-200">
                  {!readyA.isReady && <div>• {session.worldALabel}: {readyA.reason}</div>}
                  {!readyB.isReady && <div>• {session.worldBLabel}: {readyB.reason}</div>}
                </div>
              )}
            </div>

            {/* Right Action: Lockstep Advance */}
            <div className="flex items-center gap-3">
              {isLockstep && (
                <Button
                  size="lg"
                  disabled={!bothReady || isAdvancing}
                  onClick={handleAdvanceBoth}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-4 rounded-xl shadow-sm gap-2"
                >
                  <FastForward className="h-5 w-5" />
                  {isAdvancing ? 'Advancing Both...' : 'Advance Both Worlds'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Twin World Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* World A Panel */}
        <WorldCard
          label={session.worldALabel}
          classId={session.worldAClassId}
          simulationClass={worldAClass}
          gameState={worldAGameState}
          readiness={readyA}
          onAdvance={() => handleAdvanceWorld('A')}
          isAdvancing={isAdvancing}
          onOpenStandalone={() => {
            selectClass(session.worldAClassId);
            navigate(`/class/${session.worldAClassId}`);
          }}
          badgeColor="purple"
        />

        {/* World B Panel */}
        <WorldCard
          label={session.worldBLabel}
          classId={session.worldBClassId}
          simulationClass={worldBClass}
          gameState={worldBGameState}
          readiness={readyB}
          onAdvance={() => handleAdvanceWorld('B')}
          isAdvancing={isAdvancing}
          onOpenStandalone={() => {
            selectClass(session.worldBClassId);
            navigate(`/class/${session.worldBClassId}`);
          }}
          badgeColor="blue"
        />
      </div>
    </div>
  );
};

interface WorldCardProps {
  label: string;
  classId: string;
  simulationClass: any;
  gameState: GameState | null;
  readiness: { isReady: boolean; reason?: string };
  onAdvance: () => void;
  isAdvancing: boolean;
  onOpenStandalone: () => void;
  badgeColor: 'purple' | 'blue';
}

const WorldCard: React.FC<WorldCardProps> = ({
  label,
  classId,
  simulationClass,
  gameState,
  readiness,
  onAdvance,
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
            <CardTitle className="text-xl font-bold text-foreground">{label}</CardTitle>
            <Badge variant="outline" className="text-xs border-border text-muted-foreground">
              {teams.length} Teams
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenStandalone}
            className="text-xs text-purple-700 hover:text-purple-800 hover:bg-purple-50 gap-1 font-medium"
          >
            Standalone Control <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
        <CardDescription className="text-muted-foreground text-xs mt-1">
          Class: {simulationClass?.name || classId}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 flex-1 space-y-6">
        {/* Phase & Round Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Current Status</div>
            <div className="text-lg font-bold text-foreground mt-0.5">
              Round {currentRound} — <span className="text-purple-700 font-extrabold">{PHASE_LABELS[currentPhase]}</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onAdvance}
            disabled={isAdvancing}
            className="bg-background hover:bg-muted text-foreground border border-border gap-1.5 text-xs font-semibold shadow-sm"
          >
            <Play className="h-3.5 w-3.5 text-purple-600" />
            Advance {label} Only
          </Button>
        </div>

        {/* Readiness Info */}
        {!readiness.isReady && (
          <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{readiness.reason}</span>
          </div>
        )}

        {/* Team Roster & Scores */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Team Status & Standings
          </div>
          <div className="space-y-2">
            {teams.map((team) => {
              const scoreData = calculateTeamTotalScore(team.id, currentRound, gameState);
              return (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: team.color }} />
                    <span className="font-semibold text-foreground">{team.name}</span>
                    {team.isBot ? (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-1.5 flex items-center gap-0.5 font-normal">
                        <Bot className="h-2.5 w-2.5" /> Bot
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5 font-normal">
                        Human
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-muted-foreground text-[11px]">Score: </span>
                      <span className="font-bold text-amber-600 text-sm">{scoreData.totalScore} pts</span>
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
