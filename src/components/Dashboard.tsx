import { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useGame } from '@/contexts/GameContext';
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
import { LayoutDashboard, FileInput, BarChart3, Award, RotateCcw, Wrench, Microscope, Truck, Store, CheckSquare, ClipboardList, Package, FileText, BarChart2 } from 'lucide-react';
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

export const Dashboard = () => {
  const { gameState, resetGame, advanceRound } = useGame();
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

  if (!gameState) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">Smartphone Inc Tracker</h1>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Round <span className={`inline-block transition-all duration-500 ease-out ${isAnimatingRound ? 'scale-[2.5] text-blue-500 font-black mx-2 -translate-y-1' : 'scale-100 font-normal mx-0'}`}>{gameState.currentRound}</span> of 5 | {gameState.teams.length} Teams
              </p>
            </div>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={gameState.currentRound >= 5}
                    className="hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    Advance to Round {gameState.currentRound + 1}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Advance to Next Round?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to advance to Round {gameState.currentRound + 1}? Ensure all teams have completed their inputs for the current round.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={advanceRound} className="bg-blue-600 hover:bg-blue-700">Advance</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="hover:bg-destructive hover:text-white transition-colors">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Game
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Game?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all game data and return to setup. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={resetGame}>Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <GameSettingsDialog />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="max-w-5xl mx-auto space-y-3">
            {/* Top Row - Game Phases */}
            <TabsList className="grid w-full grid-cols-7 gap-1 h-auto bg-slate-800/80 text-slate-100 border border-slate-700/50 shadow-md backdrop-blur-md p-2 rounded-lg">
              <TabsTrigger value="planning" className="gap-2 py-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Planning</span>
              </TabsTrigger>
              <TabsTrigger value="production" className="gap-2 py-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Production</span>
              </TabsTrigger>
              <TabsTrigger value="improvement" className="gap-2 py-2">
                <Wrench className="h-4 w-4 text-yellow-500" />
                <span className="hidden sm:inline">Improvement</span>
              </TabsTrigger>
              <TabsTrigger value="innovation" className="gap-2 py-2">
                <Microscope className="h-4 w-4 text-purple-500" />
                <span className="hidden sm:inline">Research</span>
              </TabsTrigger>
              <TabsTrigger value="expansion" className="gap-2 py-2">
                <Truck className="h-4 w-4 text-blue-500" />
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
            <CurrentState onEditTeamData={handleEditTeamData} />
          </TabsContent>

          <TabsContent value="scoreboard" className="space-y-4">
            <Scoreboard onEditTeamData={handleEditTeamData} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Analytics />
          </TabsContent>

          <TabsContent value="financials" className="space-y-4">
            <FinancialsPhase />
          </TabsContent>

          <TabsContent value="report" className="space-y-4">
            <SimulationReport />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
