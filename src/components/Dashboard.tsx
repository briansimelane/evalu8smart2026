import { useState, useRef, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useGame, GameContext } from '@/contexts/GameContext';
import { CurrentState } from './dashboard/CurrentState';
import { Scoreboard } from './dashboard/Scoreboard';
import { RoundInput } from './dashboard/RoundInput';
import { PlanningPhase } from './dashboard/PlanningPhase';
import { Analytics } from './dashboard/Analytics';
import { ResearchPhase } from './dashboard/ResearchPhase';
import { ImprovementPhase } from './dashboard/ImprovementPhase';
import { SalesPhase } from './dashboard/SalesPhase';
import { ControlPhase } from './dashboard/ControlPhase';
import { SimulationReport } from './dashboard/SimulationReport';
import { LogisticsPhase } from './dashboard/LogisticsPhase';
import { FinancialsPhase } from './dashboard/FinancialsPhase';
import { SummaryMap } from './dashboard/SummaryMap';
import { GameSettingsDialog } from './dashboard/GameSettingsDialog';
import { TeamSubmissionStatus } from './dashboard/TeamSubmissionStatus';
import { CombinationsGuideModal } from './dashboard/CombinationsGuideModal';
import { LayoutDashboard, FileInput, BarChart3, Award, RotateCcw, Wrench, Microscope, Truck, Store, CheckSquare, ClipboardList, Package, FileText, BarChart2, LogOut, Globe, Menu, SlidersHorizontal, ChevronRight, Trophy, Presentation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { useDemoState } from '@/demo/DemoStateProvider';
import { DemoControlBar } from '@/demo/DemoControlBar';
import { useDemoHost } from '@/demo/useDemoHost';
import { toast } from 'sonner';
import { CeoClaimBar } from './CeoClaimBar';
import { GameIcon } from './dashboard/GameIcon';
import { useBotRunner } from '@/bots/useBotRunner';
const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  planning: { bg: 'bg-indigo-500/10 dark:bg-indigo-950/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' },
  production: { bg: 'bg-emerald-500/10 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  improvement: { bg: 'bg-amber-500/10 dark:bg-amber-950/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  innovation: { bg: 'bg-purple-500/10 dark:bg-purple-950/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
  expansion: { bg: 'bg-rose-500/10 dark:bg-rose-950/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/20' },
  sales: { bg: 'bg-sky-500/10 dark:bg-sky-950/20', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20' },
  control: { bg: 'bg-slate-500/10 dark:bg-slate-950/20', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' },
};

const PHASE_DISPLAY_NAMES: Record<string, string> = {
  planning: 'Planning Phase',
  production: 'Production Phase',
  improvement: 'Improvement Phase',
  innovation: 'Research Phase',
  expansion: 'Logistics Phase',
  sales: 'Sales Phase',
  control: 'Control Phase',
  scoring: 'Scoring Phase',
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const gameContext = useGame();
  const { gameState, resetGame, advanceRound, updatePhase, calculatePlayOrder, endGame } = gameContext;
  const { currentRole, logout, activeClass, selectClass, selectTeam, isDemo, exitDemo } = useSession();
  
  // Housekeeping for demo mode
  useDemoHost();

  const handleReturnToHub = () => {
    if (isDemo) {
      exitDemo();
      navigate('/login');
      return;
    }
    selectClass(null);
    selectTeam(null);
    navigate(currentRole === 'ADMIN' ? '/admin' : '/facilitator/classes');
  };
  
  // Automate bot actions client-side
  useBotRunner();
  const [activeTab, setActiveTab] = useState('planning');
  const [isAnimatingRound, setIsAnimatingRound] = useState(false);
  const roundInputRef = useRef<{ loadTeamData: (roundNumber: number, teamId: string) => void }>(null);
  const planningPhaseRef = useRef<{ loadTeamPlan: (roundNumber: number, teamId: string) => void }>(null);
  const prevRoundRef = useRef(gameState?.currentRound);

  useEffect(() => {
    const handleSelectFromGuide = () => {
      setActiveTab('planning');
    };
    window.addEventListener('select_combination_from_guide', handleSelectFromGuide);
    return () => window.removeEventListener('select_combination_from_guide', handleSelectFromGuide);
  }, []);

  const handleOpenViewer = () => {
    const code = activeClass?.facilitatorCode || activeClass?.id || '';
    if (code) {
      window.open(
        `/viewer/${code}`,
        'evalu8-viewer',
        'popup,width=1600,height=900'
      );
    }
  };

  // Compute active turn team globally for the ticker
  const activeTurnTeam = useMemo(() => {
    if (!gameState) return null;
    const round = gameState.currentRound;
    const rawPhase = (gameState.currentPhase || 'planning').toLowerCase();
    const phase = rawPhase === 'innovation' ? 'research' : (rawPhase === 'expansion' ? 'logistics' : rawPhase);
    const roundData = gameState.rounds.find(r => r.roundNumber === round);
    const playOrder = calculatePlayOrder(round);

    if (phase === 'planning') {
      return playOrder.find(t => !roundData?.teamData[t.id]);
    } else if (phase === 'improvement') {
      return playOrder.find(t => {
        const count = roundData?.teamData[t.id]?.improvementCards || 0;
        const isDone = gameState.improvementCards.some(c => 
          (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === round
        );
        return count > 0 && !isDone;
      });
    } else if (phase === 'research') {
      return playOrder.find(t => {
        const icons = roundData?.teamData[t.id]?.researchIcons || 0;
        const spent = (gameState.researchAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'logistics') {
      return playOrder.find(t => {
        const icons = roundData?.teamData[t.id]?.logisticsIcons || 0;
        const spent = (gameState.logisticsAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'sales') {
      const activeSalesPlayOrder = playOrder.filter(team => {
        const tData = roundData?.teamData[team.id];
        return (tData?.productsProduced || 0) > 0;
      });
      return activeSalesPlayOrder.find(t => {
        const tData = roundData?.teamData[t.id];
        return !tData?.customersSold;
      });
    }
    return null;
  }, [gameState, calculatePlayOrder]);

  const notificationText = useMemo(() => {
    if (!gameState) return '';
    const phaseName = PHASE_DISPLAY_NAMES[gameState.currentPhase || 'planning'] || 'Planning Phase';
    let text = `${phaseName.toUpperCase()} (ROUND ${gameState.currentRound})`;
    if (activeTurnTeam) {
      text += `  •  ACTIVE TURN: ${activeTurnTeam.name.toUpperCase()}`;
      if (gameState.botThinking?.[activeTurnTeam.id]) {
        text += ' (THINKING...)';
      }
    } else {
      text += `  •  ALL TEAMS COMPLETED`;
    }
    return text;
  }, [gameState, activeTurnTeam]);

  // Trigger animation when round changes
  useEffect(() => {
    if (gameState?.currentRound && prevRoundRef.current !== undefined && gameState.currentRound > prevRoundRef.current) {
      setIsAnimatingRound(true);
      setTimeout(() => setIsAnimatingRound(false), 1000);
    }
    prevRoundRef.current = gameState?.currentRound;
  }, [gameState?.currentRound]);

  // Automatically switch tabs when the facilitator changes the active phase
  useEffect(() => {
    if (gameState?.currentPhase) {
      setActiveTab(gameState.currentPhase);
    }
  }, [gameState?.currentPhase]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleEditTeamData = (roundNumber: number, teamId: string) => {
    setActiveTab('planning');
    // Small delay to ensure tab switch completes before loading data
    setTimeout(() => {
      planningPhaseRef.current?.loadTeamPlan(roundNumber, teamId);
    }, 100);
  };

  const renderPhasePlaceholder = (tabName: string) => {
    return <TeamSubmissionStatus tabName={tabName} />;
  };

  if (!gameState) return null;

  const realActiveRound = gameState.currentRound;
  const currentRoundData = gameState.rounds.find(r => r.roundNumber === realActiveRound);
  const submittedTeamDataMap = currentRoundData?.teamData || {};
  const allTeamsSubmitted = gameState.teams.length > 0 && gameState.teams.every(t => !!submittedTeamDataMap[t.id]);

  const isDataRestricted = !allTeamsSubmitted;
  const effectiveRound = isDataRestricted ? Math.max(0, realActiveRound - 1) : realActiveRound;

  const getRestrictedGameState = () => {
    if (!isDataRestricted) return gameState;
    const prevRounds = gameState.rounds.filter(r => r.roundNumber <= effectiveRound);
    return {
      ...gameState,
      currentRound: effectiveRound,
      rounds: prevRounds
    };
  };

  const restrictedGameState = getRestrictedGameState();

  const restrictedGameContextValue = {
    ...gameContext,
    gameState: restrictedGameState,
    getCurrentRound: () => (!isDataRestricted ? realActiveRound : effectiveRound)
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isDemo && <DemoControlBar />}
      {gameState.gameEnded && (
        <div className="bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-600 text-white py-3 px-4 text-center font-display text-xs sm:text-sm font-black tracking-wide flex items-center justify-center gap-2 shadow-md animate-fade-in relative z-50">
          <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-200 animate-bounce animate-duration-1000" />
          <span>SIMULATION COMPLETED — FINAL RESULTS AND PATENT SCORE BONUSES ARE NOW ACTIVE</span>
        </div>
      )}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <div className="container mx-auto py-3">
          <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
            {/* Header Title + Mobile Fly-out Menu Row */}
            <div className="flex items-center justify-between min-w-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="font-display text-lg sm:text-xl font-bold text-foreground truncate">Smartphone Inc Tracker</h1>
                  {activeClass?.name && (
                    <Badge className="bg-primary/10 text-primary border border-primary/20 text-[11px] px-2 py-0.5 font-semibold">
                      {activeClass.name}
                    </Badge>
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                  Round <span data-numeric className={`inline-block font-display transition-all duration-500 ease-out ${isAnimatingRound ? 'scale-[2.5] text-accent font-bold mx-2 -translate-y-1' : 'scale-100 font-semibold text-foreground mx-0'}`}>{gameState.currentRound}</span> of 5 · {gameState.teams.length} teams
                  <Badge className="ml-1 text-[10px] px-1.5 py-0 capitalize font-semibold bg-accent/10 text-accent border border-accent/25">
                    {(gameState.currentPhase || 'planning') === 'innovation' ? 'Research Phase' : (gameState.currentPhase || 'planning') === 'expansion' ? 'Logistics Phase' : `${gameState.currentPhase || 'planning'} Phase`}
                  </Badge>
                </div>
              </div>

              {/* Mobile Fly-out Menu Trigger (Visible on mobile, hidden on md+) */}
              <div className="md:hidden flex items-center gap-2">
                {currentRole === 'STUDENT' ? (
                  <Button variant="outline" size="sm" onClick={logout} className="border-border hover:bg-muted text-foreground">
                    <LogOut className="h-4 w-4" />
                  </Button>
                ) : (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 border-border bg-card shadow-sm font-semibold text-xs">
                        <Menu className="h-4 w-4" />
                        <span>Menu</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80 bg-card border-border text-foreground p-5 space-y-6">
                      <SheetHeader className="text-left border-b pb-3">
                        <SheetTitle className="text-base font-bold flex items-center gap-2">
                          <SlidersHorizontal className="h-4 w-4 text-primary" />
                          Game Actions
                        </SheetTitle>
                      </SheetHeader>

                      <div className="flex flex-col gap-3">
                        {/* Open Viewer */}
                        <Button
                          onClick={handleOpenViewer}
                          variant="outline"
                          className="w-full justify-start gap-2 h-10 border-border text-foreground font-semibold"
                        >
                          <Presentation className="h-4 w-4 text-primary" />
                          Open Projector Viewer
                        </Button>

                        {/* 1. Advance to Round */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              disabled={gameState.currentRound >= 5}
                              className="w-full justify-start gap-2 h-10 border-border text-foreground font-semibold"
                            >
                              <ChevronRight className="h-4 w-4 text-primary" />
                              Advance to Round {gameState.currentRound + 1}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border text-foreground">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Advance to Next Round?</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                Are you sure you want to advance to Round {gameState.currentRound + 1}? Ensure all teams have completed their inputs for the current round.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-border bg-background hover:bg-muted text-foreground">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={advanceRound} className="bg-primary hover:bg-primary/90 text-primary-foreground">Advance</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                         {/* End Game */}
                        {!gameState.gameEnded && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                className="w-full justify-start gap-2 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold"
                              >
                                <Trophy className="h-4 w-4" />
                                End Game
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border text-foreground">
                              <AlertDialogHeader>
                                <AlertDialogTitle>End the Simulation?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                  Are you sure you want to end the game early? This will calculate final patent points and lock all player actions.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-border bg-background hover:bg-muted text-foreground">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => {
                                  endGame();
                                  toast.success("Game Ended — The simulation has been completed. Patent points have been added to the final scores.");
                                }} className="bg-red-600 hover:bg-red-700 text-white">End Game</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        {/* 2. Reset Game */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start gap-2 h-10 border-border hover:bg-destructive/10 text-destructive hover:text-destructive font-semibold">
                              <RotateCcw className="h-4 w-4" />
                              Reset Game
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border text-foreground">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reset Game?</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                This will delete all game data and return to setup. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-border bg-background hover:bg-muted text-foreground">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={resetGame} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Reset</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* 3. Settings */}
                        <div className="pt-1">
                          <GameSettingsDialog />
                        </div>

                        {/* 4. All Games */}
                        <Button
                          variant="default"
                          onClick={handleReturnToHub}
                          className="w-full justify-start gap-2 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          All Games
                        </Button>

                        {/* 5. Log Out */}
                        <Button variant="outline" onClick={logout} className="w-full justify-start gap-2 h-10 border-border text-muted-foreground hover:text-foreground">
                          <LogOut className="h-4 w-4" />
                          Log Out
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
              </div>
            </div>

            {/* Active Phase Dropdown Row (Positioned below header, above navigation tabs) */}
            <div className="flex flex-wrap gap-2 items-center justify-between sm:justify-start">
              {currentRole !== 'STUDENT' ? (
                <>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">Active Phase:</span>
                    <Select
                      value={gameState.currentPhase || 'planning'}
                      onValueChange={updatePhase}
                    >
                      <SelectTrigger className="w-full md:w-[140px] h-9 bg-background border-border text-foreground font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="improvement" disabled={gameState.currentRound >= 5}>
                          Improvement {gameState.currentRound >= 5 ? '(Skipped)' : ''}
                        </SelectItem>
                        <SelectItem value="innovation">Research</SelectItem>
                        <SelectItem value="expansion">Logistics</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="control">Control</SelectItem>
                        <SelectItem value="scoring">Scoring</SelectItem>
                      </SelectContent>
                    </Select>
                    {gameState.teams.some(t => t.isBot) && (
                      <span className="text-xs text-muted-foreground italic flex items-center gap-1 ml-2">
                        🤖 Bots active (automated client-side)
                      </span>
                    )}
                    <Button 
                      onClick={handleOpenViewer}
                      variant="outline"
                      size="sm"
                      className="border-border hover:bg-muted text-foreground gap-1.5 font-semibold text-xs h-9 ml-2"
                      title="Open Live Board Projector View"
                    >
                      <Presentation className="h-3.5 w-3.5 text-primary" />
                      <span>Open Viewer</span>
                    </Button>
                  </div>

                  {/* Desktop Action Buttons (Visible on md+) */}
                  <div className="hidden md:flex items-center gap-2">

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={gameState.currentRound >= 5}
                          className="border-border hover:bg-muted text-foreground"
                        >
                          Advance to Round {gameState.currentRound + 1}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border text-foreground">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Advance to Next Round?</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to advance to Round {gameState.currentRound + 1}? Ensure all teams have completed their inputs for the current round.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-border bg-background hover:bg-muted text-foreground">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={advanceRound} className="bg-primary hover:bg-primary/90 text-primary-foreground">Advance</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    {!gameState.gameEnded && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5 shadow-sm text-xs"
                          >
                            <Trophy className="h-3.5 w-3.5" />
                            End Game
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border text-foreground">
                          <AlertDialogHeader>
                            <AlertDialogTitle>End the Simulation?</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                              Are you sure you want to end the game early? This will calculate final patent points and lock all player actions.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-border bg-background hover:bg-muted text-foreground">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              endGame();
                              toast.success("Game Ended — The simulation has been completed. Patent points have been added to the final scores.");
                            }} className="bg-red-600 hover:bg-red-700 text-white">End Game</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-border hover:bg-destructive hover:text-white text-foreground transition-colors">
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Reset Game
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border text-foreground">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset Game?</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            This will delete all game data and return to setup. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-border bg-background hover:bg-muted text-foreground">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={resetGame} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Reset</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <CombinationsGuideModal triggerLabel="Combinations Guide" triggerVariant="outline" triggerClassName="text-xs h-8 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 font-bold" />
                    <GameSettingsDialog />
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleReturnToHub}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-sm text-xs"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      All Games
                    </Button>
                    <Button variant="outline" size="sm" onClick={logout} className="border-border hover:bg-muted text-foreground">
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <CombinationsGuideModal triggerLabel="Combinations Guide" triggerVariant="outline" triggerClassName="text-xs h-8 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 font-bold" />
                  <Button variant="outline" size="sm" onClick={logout} className="border-border hover:bg-muted text-foreground">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 sm:py-5">
        {!isDemo && <CeoClaimBar />}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <div className="max-w-5xl mx-auto space-y-2">
            {/* Top Row - Game Phases */}
            {(() => {
              const currentGamePhase = (gameState.currentPhase || 'planning').toLowerCase();

              const renderPhaseTrigger = (
                value: string,
                label: string,
                iconNode: React.ReactNode,
                disabled?: boolean,
                title?: string
              ) => {
                const isLive = currentGamePhase === value;
                return (
                  <TabsTrigger
                    key={value}
                    value={value}
                    disabled={disabled}
                    title={title}
                    className={`relative flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2 transition-all ${
                      disabled ? 'opacity-40 cursor-not-allowed' : ''
                    } ${
                      isLive ? 'ring-2 ring-emerald-500/80 border-emerald-500/50 font-bold bg-emerald-500/10 text-emerald-950 dark:text-emerald-100' : ''
                    }`}
                  >
                    {isLive && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10" title="Active Game Phase">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white dark:border-slate-900"></span>
                      </span>
                    )}
                    {iconNode}
                    <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap flex items-center gap-1">
                      {label}
                      {isLive && (
                        <span className="hidden lg:inline-block text-[8px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-1 py-0.5 rounded-sm leading-none border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </span>
                  </TabsTrigger>
                );
              };

              return (
                <TabsList className="grid grid-cols-4 sm:grid-cols-8 gap-1 h-auto w-full bg-muted text-muted-foreground border border-border shadow-sm p-1 sm:p-1.5 rounded-xl">
                  {renderPhaseTrigger('planning', 'Planning', <GameIcon type="planning" size="xs" />)}
                  {renderPhaseTrigger('production', 'Production', <GameIcon type="production" size="xs" />)}
                  {renderPhaseTrigger(
                    'improvement',
                    'Improvement',
                    <GameIcon type="improvement" size="xs" />,
                    gameState.currentRound >= 5,
                    gameState.currentRound >= 5 ? 'Improvement phase is skipped in Round 5 (Final Round)' : undefined
                  )}
                  {renderPhaseTrigger('innovation', 'Research', <GameIcon type="research" size="xs" />)}
                  {renderPhaseTrigger('expansion', 'Logistics', <GameIcon type="logistics" size="xs" />)}
                  {renderPhaseTrigger('sales', 'Sales', <GameIcon type="sales" size="xs" />)}
                  {renderPhaseTrigger('control', 'Control', <GameIcon type="control" size="xs" />)}
                  {renderPhaseTrigger('scoring', 'Scoring', <GameIcon type="scoring" size="xs" />)}
                </TabsList>
              );
            })()}

            {/* Bottom Row - Data Views */}
            <TabsList className="grid grid-cols-3 sm:grid-cols-6 gap-1 h-auto w-full border border-border p-1 sm:p-1.5 rounded-xl">
              <TabsTrigger value="state" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Current State</span>
              </TabsTrigger>
              <TabsTrigger value="summary-map" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Summary Map</span>
              </TabsTrigger>
              <TabsTrigger value="scoreboard" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Scoreboard</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="financials" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <BarChart2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Financials</span>
              </TabsTrigger>
              <TabsTrigger value="report" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Simulation Report</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Phase Notification Banner */}
          {(() => {
            const phaseColors = PHASE_COLORS[gameState.currentPhase || 'planning'] || PHASE_COLORS.planning;
            return (
              <div className="my-3">
                <div className={`w-full border ${phaseColors.bg} ${phaseColors.border} ${phaseColors.text} py-2 px-4 font-display text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg shadow-sm flex items-center justify-center gap-2 text-center animate-pulse`}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                  </span>
                  <span>{notificationText}</span>
                </div>
              </div>
            );
          })()}

          {/* Game Phase Tabs */}
          <TabsContent value="planning" className="space-y-4">
            <PlanningPhase ref={planningPhaseRef} />
          </TabsContent>

          <TabsContent value="production" className="space-y-4">
            <RoundInput ref={roundInputRef} />
          </TabsContent>

          <TabsContent value="improvement" className="space-y-4">
            <ImprovementPhase />
          </TabsContent>

          <TabsContent value="innovation" className="space-y-4">
            <ResearchPhase />
          </TabsContent>

          <TabsContent value="expansion" className="space-y-4">
            <LogisticsPhase />
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            <SalesPhase />
          </TabsContent>

          <TabsContent value="control" className="space-y-4">
            <ControlPhase onEndGame={() => setActiveTab('summary-map')} />
          </TabsContent>

          <TabsContent value="scoring" className="space-y-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Round {gameState.currentRound} Scoring Phase
                  </span>
                  <Badge className="bg-amber-500 text-white font-extrabold text-xs">
                    Live Scoreboard Animating on Viewer
                  </Badge>
                </CardTitle>
                <CardDescription>
                  The Scoring phase is active. The live Viewer screen is currently animating the end-of-round Scoreboard listing all teams from lowest score to highest score.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Scoreboard />

                {currentRole !== 'STUDENT' && (
                  <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                    <Button
                      onClick={() => updatePhase('control')}
                      variant="outline"
                      size="sm"
                      className="font-semibold"
                    >
                      Back to Control Phase
                    </Button>

                    <Button
                      onClick={advanceRound}
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-md gap-2"
                    >
                      <span>Advance to Round {gameState.currentRound + 1}</span>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data View Tabs */}
          {(() => {
            const isPlaceholderMode = effectiveRound === 0 && !allTeamsSubmitted;

            return (
              <>
                <TabsContent value="state" className="space-y-4">
                  {isPlaceholderMode ? (
                    renderPhasePlaceholder("Current State")
                  ) : (
                    <GameContext.Provider value={restrictedGameContextValue}>
                      <TeamSubmissionStatus tabName="Current State" isCompact realRound={realActiveRound} />
                      <CurrentState onEditTeamData={handleEditTeamData} />
                    </GameContext.Provider>
                  )}
                </TabsContent>

                <TabsContent value="summary-map" className="space-y-4">
                  <SummaryMap />
                </TabsContent>

                <TabsContent value="scoreboard" className="space-y-4">
                  {isPlaceholderMode ? (
                    renderPhasePlaceholder("Scoreboard")
                  ) : (
                    <GameContext.Provider value={restrictedGameContextValue}>
                      <TeamSubmissionStatus tabName="Scoreboard" isCompact realRound={realActiveRound} />
                      <Scoreboard onEditTeamData={handleEditTeamData} />
                    </GameContext.Provider>
                  )}
                </TabsContent>

                <TabsContent value="analytics" className="space-y-4">
                  {isPlaceholderMode ? (
                    renderPhasePlaceholder("Analytics")
                  ) : (
                    <GameContext.Provider value={restrictedGameContextValue}>
                      <TeamSubmissionStatus tabName="Analytics" isCompact realRound={realActiveRound} />
                      <Analytics />
                    </GameContext.Provider>
                  )}
                </TabsContent>

                <TabsContent value="financials" className="space-y-4">
                  {isPlaceholderMode ? (
                    renderPhasePlaceholder("Financials")
                  ) : (
                    <GameContext.Provider value={restrictedGameContextValue}>
                      <TeamSubmissionStatus tabName="Financials" isCompact realRound={realActiveRound} />
                      <FinancialsPhase />
                    </GameContext.Provider>
                  )}
                </TabsContent>

                <TabsContent value="report" className="space-y-4">
                  {isPlaceholderMode ? (
                    renderPhasePlaceholder("Simulation Report")
                  ) : (
                    <GameContext.Provider value={restrictedGameContextValue}>
                      <TeamSubmissionStatus tabName="Simulation Report" isCompact realRound={realActiveRound} />
                      <SimulationReport />
                    </GameContext.Provider>
                  )}
                </TabsContent>
              </>
            );
          })()}
        </Tabs>
      </main>
    </div>
  );
};
