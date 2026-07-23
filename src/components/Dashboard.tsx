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
import { LayoutDashboard, FileInput, BarChart3, Award, RotateCcw, Wrench, Microscope, Truck, Store, CheckSquare, ClipboardList, Package, FileText, BarChart2, LogOut, Globe, Menu, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
import { CeoClaimBar } from './CeoClaimBar';
import { GameIcon } from './dashboard/GameIcon';

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
                          onClick={() => navigate(currentRole === 'ADMIN' ? '/admin' : '/facilitator/classes')}
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
                      </SelectContent>
                    </Select>
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
                  </div>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={logout} className="border-border hover:bg-muted text-foreground">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
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
            <TabsList className="grid grid-cols-4 sm:grid-cols-7 gap-1 h-auto w-full bg-muted text-muted-foreground border border-border shadow-sm p-1 sm:p-1.5 rounded-xl">
              <TabsTrigger value="planning" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <GameIcon type="planning" size="xs" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Planning</span>
              </TabsTrigger>
              <TabsTrigger value="production" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <GameIcon type="production" size="xs" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Production</span>
              </TabsTrigger>
              <TabsTrigger 
                value="improvement" 
                disabled={gameState.currentRound >= 5} 
                className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                title={gameState.currentRound >= 5 ? "Improvement phase is skipped in Round 5 (Final Round)" : undefined}
              >
                <GameIcon type="improvement" size="xs" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Improvement</span>
              </TabsTrigger>
              <TabsTrigger value="innovation" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <GameIcon type="research" size="xs" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Research</span>
              </TabsTrigger>
              <TabsTrigger value="expansion" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <GameIcon type="logistics" size="xs" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Logistics</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <GameIcon type="sales" size="xs" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Sales</span>
              </TabsTrigger>
              <TabsTrigger value="control" className="flex-col sm:flex-row gap-1 sm:gap-1.5 px-1 py-1.5 sm:px-3 sm:py-2">
                <GameIcon type="control" size="xs" />
                <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Control</span>
              </TabsTrigger>
            </TabsList>

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
