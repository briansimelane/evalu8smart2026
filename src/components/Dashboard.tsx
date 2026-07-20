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
import { GameSettingsDialog } from './dashboard/GameSettingsDialog';
import { LayoutDashboard, FileInput, BarChart3, Award, RotateCcw, Wrench, Microscope, Truck, Store, CheckSquare, ClipboardList, Package, FileText, BarChart2, LogOut } from 'lucide-react';
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

import { useSession } from '@/contexts/SessionContext';
import { CeoClaimBar } from './CeoClaimBar';

export const Dashboard = () => {
  const gameContext = useGame();
  const { gameState, resetGame, advanceRound, updatePhase } = gameContext;
  const { currentRole, logout } = useSession();
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
    return (
      <Card className="max-w-2xl mx-auto border-dashed border-2 border-muted bg-card text-center p-12 space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
          <Award className="h-6 w-6 text-blue-500 animate-pulse" />
        </div>
        <CardTitle className="text-xl">Round 1 Simulation Pending</CardTitle>
        <CardDescription className="max-w-md mx-auto text-sm text-muted-foreground">
          The {tabName} will become available once Round 1 plans are submitted and the facilitator advances the game to the Production phase.
        </CardDescription>
      </Card>
    );
  };

  if (!gameState) return null;

  const isPlanningPhase = currentRole === 'STUDENT' && (gameState.currentPhase === 'planning' || !gameState.currentPhase);
  const effectiveRound = isPlanningPhase ? gameState.currentRound - 1 : gameState.currentRound;

  const getRestrictedGameState = () => {
    if (!isPlanningPhase) return gameState;
    const prevRounds = gameState.rounds.filter(r => r.roundNumber < gameState.currentRound);
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
    getCurrentRound: () => effectiveRound
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">Smartphone Inc Tracker</h1>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                Round <span className={`inline-block transition-all duration-500 ease-out ${isAnimatingRound ? 'scale-[2.5] text-blue-500 font-black mx-2 -translate-y-1' : 'scale-100 font-normal mx-0'}`}>{gameState.currentRound}</span> of 5 | {gameState.teams.length} Teams
                <Badge variant={(gameState.currentPhase || 'planning') === 'planning' ? 'secondary' : 'default'} className="ml-1 text-[10px] px-1.5 py-0 capitalize font-semibold">
                  {(gameState.currentPhase || 'planning') === 'innovation' ? 'Research Phase' : (gameState.currentPhase || 'planning') === 'expansion' ? 'Logistics Phase' : `${gameState.currentPhase || 'planning'} Phase`}
                </Badge>
              </p>
            </div>
            
            <div className="flex gap-2 items-center">
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
                        <SelectItem value="improvement">Improvement</SelectItem>
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
                        <AlertDialogAction onClick={advanceRound} className="bg-blue-600 hover:bg-blue-700 text-white">Advance</AlertDialogAction>
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
                        <AlertDialogAction onClick={resetGame} className="bg-red-600 hover:bg-red-700 text-white">Reset</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  <GameSettingsDialog />
                  <Button variant="outline" size="sm" onClick={logout} className="border-border hover:bg-muted text-foreground">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <CeoClaimBar />
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="max-w-5xl mx-auto space-y-3">
            {/* Top Row - Game Phases */}
            <TabsList className="grid w-full grid-cols-7 gap-1 h-auto bg-muted text-muted-foreground border border-border shadow-sm p-2 rounded-lg">
              <TabsTrigger value="planning" className="gap-2 py-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Planning</span>
              </TabsTrigger>
              <TabsTrigger value="production" className="gap-2 py-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Production</span>
              </TabsTrigger>
              <TabsTrigger value="improvement" className="gap-2 py-2">
                <Wrench className="h-4 w-4 text-yellow-600" />
                <span className="hidden sm:inline">Improvement</span>
              </TabsTrigger>
              <TabsTrigger value="innovation" className="gap-2 py-2">
                <Microscope className="h-4 w-4 text-purple-600" />
                <span className="hidden sm:inline">Research</span>
              </TabsTrigger>
              <TabsTrigger value="expansion" className="gap-2 py-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="hidden sm:inline">Logistics</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="gap-2 py-2">
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">Sales</span>
              </TabsTrigger>
              <TabsTrigger value="control" className="gap-2 py-2">
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Control</span>
              </TabsTrigger>
            </TabsList>

            {/* Bottom Row - Data Views */}
            <TabsList className="grid w-full grid-cols-5 gap-1 h-auto p-2">
              <TabsTrigger value="state" className="gap-2 py-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Current State</span>
              </TabsTrigger>
              <TabsTrigger value="scoreboard" className="gap-2 py-2">
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">Scoreboard</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2 py-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="financials" className="gap-2 py-2">
                <BarChart2 className="h-4 w-4" />
                <span className="hidden sm:inline">Financials</span>
              </TabsTrigger>
              <TabsTrigger value="report" className="gap-2 py-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Simulation Report</span>
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
            <ControlPhase />
          </TabsContent>

          {/* Data View Tabs */}
          <TabsContent value="state" className="space-y-4">
            {effectiveRound === 0 ? (
              renderPhasePlaceholder("Current State")
            ) : (
              <GameContext.Provider value={restrictedGameContextValue}>
                <CurrentState onEditTeamData={handleEditTeamData} />
              </GameContext.Provider>
            )}
          </TabsContent>

          <TabsContent value="scoreboard" className="space-y-4">
            {effectiveRound === 0 ? (
              renderPhasePlaceholder("Scoreboard")
            ) : (
              <GameContext.Provider value={restrictedGameContextValue}>
                <Scoreboard onEditTeamData={handleEditTeamData} />
              </GameContext.Provider>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {effectiveRound === 0 ? (
              renderPhasePlaceholder("Analytics")
            ) : (
              <GameContext.Provider value={restrictedGameContextValue}>
                <Analytics />
              </GameContext.Provider>
            )}
          </TabsContent>

          <TabsContent value="financials" className="space-y-4">
            {effectiveRound === 0 ? (
              renderPhasePlaceholder("Financials")
            ) : (
              <GameContext.Provider value={restrictedGameContextValue}>
                <FinancialsPhase />
              </GameContext.Provider>
            )}
          </TabsContent>

          <TabsContent value="report" className="space-y-4">
            {effectiveRound === 0 ? (
              renderPhasePlaceholder("Simulation Report")
            ) : (
              <GameContext.Provider value={restrictedGameContextValue}>
                <SimulationReport />
              </GameContext.Provider>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
