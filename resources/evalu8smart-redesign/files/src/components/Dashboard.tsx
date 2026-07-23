import { useState, useRef, useEffect } from 'react';
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
import { LayoutDashboard, FileInput, BarChart3, Award, RotateCcw, Wrench, Microscope, Truck, Store, CheckSquare, ClipboardList, Package, FileText, BarChart2, LogOut, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { CeoClaimBar } from './CeoClaimBar';

export const Dashboard = () => {
  const navigate = useNavigate();
  const gameContext = useGame();
  const { gameState, resetGame, advanceRound, updatePhase } = gameContext;
  const { currentRole, logout, activeClass } = useSession();
  const [activeTab, setActiveTab] = useState('planning');
  const [isAnimatingRound, setIsAnimatingRound] = useState(false);
  const roundInputRef = useRef<{ loadTeamData: (roundNumber: number, teamId: string) => void }>(null);
  const planningPhaseRef = useRef<{ loadTeamPlan: (roundNumber: number, teamId: string) => void }>(null);
  const prevRoundRef = useRef(gameState?.currentRound);

  // Trigger animation when round changes
  useEffect(() => {
    if (gameState?.currentRound && prevRoundRef.current !== undefined && gameState.currentRound > prevRoundRef.current) {
      setIsAnimatingRound(true);
      setTimeout(() => setIsAnimatingRound(false), 1000);
    }
    prevRoundRef.current = gameState?.currentRound;
  }, [gameState?.currentRound]);

  // Automatically switch tabs for students when the facilitator changes the active phase
  useEffect(() => {
    if (currentRole === 'STUDENT' && gameState?.currentPhase) {
      setActiveTab(gameState.currentPhase);
    }
  }, [gameState?.currentPhase, currentRole]);

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
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <div className="container mx-auto py-3">
          <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
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
            
            <div className="flex flex-wrap gap-2 items-center">
              {currentRole === 'STUDENT' ? (
                <Button variant="outline" size="sm" onClick={logout} className="border-border hover:bg-muted text-foreground">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-xs text-muted-foreground font-semibold">Active Phase:</span>
                    <Select
                      value={gameState.currentPhase || 'planning'}
                      onValueChange={updatePhase}
                    >
                      <SelectTrigger className="w-[140px] h-8 bg-background border-border text-foreground">
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
                      </SelectContent>
                    </Select>
                  </div>
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
                  
                  <GameSettingsDialog />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(currentRole === 'ADMIN' ? '/admin' : '/facilitator/classes')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-sm text-xs"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    All Games
                  </Button>
                  <Button variant="outline" size="sm" onClick={logout} className="border-border hover:bg-muted text-foreground">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 sm:py-5">
        <CeoClaimBar />
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <div className="max-w-5xl mx-auto space-y-2">
            {/* Top Row - Game Phases */}
            <TabsList className="tabstrip sm:grid-cols-7 gap-1 h-auto bg-muted text-muted-foreground border border-border shadow-sm p-1.5 rounded-lg">
              <TabsTrigger value="planning" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <ClipboardList className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Planning</span>
              </TabsTrigger>
              <TabsTrigger value="production" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <Package className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Production</span>
              </TabsTrigger>
              <TabsTrigger 
                value="improvement" 
                disabled={gameState.currentRound >= 5} 
                className="gap-1.5 px-2.5 py-2 sm:px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                title={gameState.currentRound >= 5 ? "Improvement phase is skipped in Round 5 (Final Round)" : undefined}
              >
                <Wrench className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Improvement</span>
              </TabsTrigger>
              <TabsTrigger value="innovation" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <Microscope className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Research</span>
              </TabsTrigger>
              <TabsTrigger value="expansion" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <Truck className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Logistics</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <Store className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Sales</span>
              </TabsTrigger>
              <TabsTrigger value="control" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <CheckSquare className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Control</span>
              </TabsTrigger>
            </TabsList>

            {/* Bottom Row - Data Views */}
            <TabsList className="tabstrip sm:grid-cols-6 gap-1 h-auto border border-border p-1.5 rounded-lg">
              <TabsTrigger value="state" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <LayoutDashboard className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Current State</span>
              </TabsTrigger>
              <TabsTrigger value="summary-map" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <Globe className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Summary Map</span>
              </TabsTrigger>
              <TabsTrigger value="scoreboard" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <Award className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Scoreboard</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="financials" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <BarChart2 className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Financials</span>
              </TabsTrigger>
              <TabsTrigger value="report" className="gap-1.5 px-2.5 py-2 sm:px-3">
                <FileText className="h-4 w-4" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Simulation Report</span>
              </TabsTrigger>
            </TabsList>
          </div>

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
