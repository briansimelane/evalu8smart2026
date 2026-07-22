import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGame } from '@/contexts/GameContext';
import { REGIONS } from '@/data/combinations';
import { toast } from 'sonner';
import { Save, AlertTriangle, Trophy, Medal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getControlPointsForRegion } from '@/data/control';
import { REGION_CUSTOMERS } from '@/data/customers';

import { useSession } from '@/contexts/SessionContext';

interface RegionControlResult {
  region: string;
  firstPlace?: { teamId: string; teamName: string; teamColor: string; sales: number; points: number };
  secondPlace?: { teamId: string; teamName: string; teamColor: string; sales: number; points: number };
}

import { PhaseLockCard } from './PhaseLockCard';

interface ControlPhaseProps {
  onEndGame?: () => void;
}

export const ControlPhase = ({ onEndGame }: ControlPhaseProps) => {
  const { gameState, addRoundData, getCurrentRound, recalculateControlPoints } = useGame();
  const { currentRole, currentTeamId } = useSession();
  const [controlCalculated, setControlCalculated] = useState(false);
  const [regionControlResults, setRegionControlResults] = useState<RegionControlResult[]>([]);

  if (!gameState) return null;

  const currentRound = getCurrentRound();
  const currentRoundData = gameState.rounds.find(r => r.roundNumber === currentRound);
  const teamsWithData = new Set(Object.keys(currentRoundData?.teamData || {}));
  
  const allTeamsHavePlans = gameState.teams.every(t => !!currentRoundData?.teamData[t.id]);

  if (currentRole === 'STUDENT' && !allTeamsHavePlans) {
    return <PhaseLockCard phaseName="Control Phase" />;
  }
  
  // Check if all teams have submitted sales data
  const allTeamsHaveSalesData = gameState.teams.every(t => {
    const teamData = currentRoundData?.teamData[t.id];
    if (!teamData) return false; // no submission yet
    const produced = teamData.productsProduced || 0;
    return produced > 0 ? Array.isArray(teamData.customersSold) : true;
  });

  // Check if control has been calculated for this round
  const controlAlreadyCalculated = gameState.teams.some(t => {
    const teamData = currentRoundData?.teamData[t.id];
    return teamData && Object.keys(teamData.regionControlPoints || {}).length > 0;
  });

  // Calculate control for each region based on sales
  const calculateControl = () => {
    const results: RegionControlResult[] = [];

    REGIONS.forEach(region => {
      const teamSales: Array<{ teamId: string; teamName: string; teamColor: string; sales: number; leftmostPosition: number }> = [];

      // Get sales data for each team - check customers sold in this region
      gameState.teams.forEach(team => {
        const teamData = currentRoundData?.teamData[team.id];
        if (!teamData || !teamData.customersSold) return;

        // Filter customers sold that belong to this region
        const regionData = REGION_CUSTOMERS.find(r => r.region === region);
        if (!regionData) return;

        const customersInRegion = teamData.customersSold.filter(customerId =>
          regionData.customers.some(c => c.id === customerId)
        );
        
        const totalSales = customersInRegion.length;

        if (totalSales > 0) {
          // Find leftmost customer position for tie-breaking
          let leftmostPosition = Infinity;
          customersInRegion.forEach(customerId => {
            const customer = regionData.customers.find(c => c.id === customerId);
            if (customer && customer.position < leftmostPosition) {
              leftmostPosition = customer.position;
            }
          });

          teamSales.push({
            teamId: team.id,
            teamName: team.name,
            teamColor: team.color,
            sales: totalSales,
            leftmostPosition: leftmostPosition === Infinity ? 999 : leftmostPosition
          });
        }
      });

      // Sort by sales (descending), then by leftmost position (ascending) for ties
      teamSales.sort((a, b) => {
        if (b.sales !== a.sales) return b.sales - a.sales;
        return a.leftmostPosition - b.leftmostPosition;
      });

      // Count teams that actually made sales in this region (not just logistics presence)
      const teamsWithSales = teamSales.length;

      const result: RegionControlResult = { region };

      if (teamSales.length > 0) {
        const firstPoints = getControlPointsForRegion(region, teamsWithSales, 'first');
        result.firstPlace = {
          teamId: teamSales[0].teamId,
          teamName: teamSales[0].teamName,
          teamColor: teamSales[0].teamColor,
          sales: teamSales[0].sales,
          points: firstPoints
        };
      }

      if (teamSales.length > 1) {
        const secondPoints = getControlPointsForRegion(region, teamsWithSales, 'second');
        result.secondPlace = {
          teamId: teamSales[1].teamId,
          teamName: teamSales[1].teamName,
          teamColor: teamSales[1].teamColor,
          sales: teamSales[1].sales,
          points: secondPoints
        };
      }

      results.push(result);
    });

    results.sort((a, b) => {
      const aIndex = REGION_CUSTOMERS.findIndex(r => r.region === a.region);
      const bIndex = REGION_CUSTOMERS.findIndex(r => r.region === b.region);
      return aIndex - bIndex;
    });

    setRegionControlResults(results);
    setControlCalculated(true);
  };

  // Auto-calculate when component mounts and all sales data is available OR if control was already calculated
  useEffect(() => {
    if ((allTeamsHaveSalesData || controlAlreadyCalculated) && !controlCalculated) {
      calculateControl();
    }
  }, [allTeamsHaveSalesData, controlAlreadyCalculated, controlCalculated]);

  const handleApplyControl = () => {
    if (!currentRoundData) return;

    // Aggregate control points per team across all regions first to avoid React state mutation overwrites
    const teamControlUpdates: Record<string, {
      regionControlPoints: Record<string, number>;
      totalControlPoints: number;
    }> = {};

    gameState.teams.forEach(team => {
      const existing = currentRoundData.teamData[team.id];
      teamControlUpdates[team.id] = {
        regionControlPoints: { ...(existing?.regionControlPoints || {}) },
        totalControlPoints: 0,
      };
    });

    regionControlResults.forEach(result => {
      if (result.firstPlace) {
        const tid = result.firstPlace.teamId;
        if (teamControlUpdates[tid]) {
          teamControlUpdates[tid].regionControlPoints[result.region] = result.firstPlace.points;
          teamControlUpdates[tid].totalControlPoints += result.firstPlace.points;
        }
      }
      if (result.secondPlace) {
        const tid = result.secondPlace.teamId;
        if (teamControlUpdates[tid]) {
          teamControlUpdates[tid].regionControlPoints[result.region] = result.secondPlace.points;
          teamControlUpdates[tid].totalControlPoints += result.secondPlace.points;
        }
      }
    });

    gameState.teams.forEach(team => {
      const teamData = currentRoundData.teamData[team.id];
      if (!teamData) return;

      const update = teamControlUpdates[team.id];
      if (!update) return;

      const updatedData = {
        ...teamData,
        regionControlPoints: update.regionControlPoints,
        controlValue: update.totalControlPoints,
        totalMoney: (teamData.totalMoney || 0) - (teamData.controlValue || 0) + update.totalControlPoints,
      };

      addRoundData(currentRound, team.id, updatedData);
    });

    toast.success('Control points applied to all teams');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Round {currentRound} Control - Regional Control Points</CardTitle>
        <CardDescription>
          Control is determined by the number of products sold in each region. First and second place teams earn control points.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentRole === 'STUDENT' && !controlAlreadyCalculated && (
          <Alert>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
            <AlertDescription>
              Waiting for the facilitator to calculate and apply control points for Round {currentRound}.
            </AlertDescription>
          </Alert>
        )}

        {currentRole !== 'STUDENT' && !allTeamsHaveSalesData && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              All teams must complete their sales data before control can be calculated.
            </AlertDescription>
          </Alert>
        )}

        {currentRole !== 'STUDENT' && allTeamsHaveSalesData && !controlAlreadyCalculated && !controlCalculated && (
          <Button onClick={calculateControl} className="w-full" size="lg">
            <Trophy className="mr-2 h-4 w-4" />
            Calculate Control Points
          </Button>
        )}

        {(controlCalculated || controlAlreadyCalculated) && (
          <>
            <div className="space-y-4">
              {currentRole === 'STUDENT' && currentTeamId && (() => {
                const myTeamObj = gameState.teams.find(t => t.id === currentTeamId);

                let myTotalPointsThisRound = 0;
                const myWins: Array<{ region: string; place: '1st' | '2nd'; points: number }> = [];

                regionControlResults.forEach(res => {
                  if (res.firstPlace?.teamId === currentTeamId) {
                    myTotalPointsThisRound += res.firstPlace.points;
                    myWins.push({ region: res.region, place: '1st', points: res.firstPlace.points });
                  } else if (res.secondPlace?.teamId === currentTeamId) {
                    myTotalPointsThisRound += res.secondPlace.points;
                    myWins.push({ region: res.region, place: '2nd', points: res.secondPlace.points });
                  }
                });

                return (
                  <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500 animate-pulse" />
                        <h3 className="font-bold text-sm text-foreground">
                          {myTeamObj?.name || 'Your Team'}'s Allocated Control Points — Round {currentRound}
                        </h3>
                      </div>
                      <Badge className="bg-amber-600 text-white font-extrabold text-xs px-2.5 py-1">
                        +{myTotalPointsThisRound} Control Points
                      </Badge>
                    </div>

                    {myWins.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No regional control points earned in Round {currentRound}. Increase sales presence in target regions to win control points.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                        {myWins.map(w => (
                          <div key={w.region} className="flex items-center justify-between p-2 bg-card rounded-lg border text-xs">
                            <span className="font-medium text-foreground">{w.region} ({w.place} Place)</span>
                            <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                              +{w.points} pts
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="text-sm text-muted-foreground">
                Control points awarded based on sales performance in each region. Teams with presence in the region compete for control.
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...regionControlResults]
                  .sort((a, b) => REGION_CUSTOMERS.findIndex(r => r.region === a.region) - REGION_CUSTOMERS.findIndex(r => r.region === b.region))
                  .map(result => {
                  const isMyFirst = result.firstPlace?.teamId === currentTeamId && currentRole === 'STUDENT';
                  const isMySecond = result.secondPlace?.teamId === currentTeamId && currentRole === 'STUDENT';

                  return (
                    <Card key={result.region} className={`border-primary/20 ${(isMyFirst || isMySecond) ? 'ring-2 ring-amber-500/50 bg-amber-500/[0.02]' : ''}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            {result.region}
                          </span>
                          {(isMyFirst || isMySecond) && (
                            <Badge className="bg-amber-600 text-white text-[10px]">
                              Your Team ({isMyFirst ? '1st' : '2nd'})
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {result.firstPlace ? (
                          <div className={`flex items-center justify-between p-3 border rounded-lg ${result.firstPlace.teamId === currentTeamId && currentRole === 'STUDENT' ? 'bg-amber-500/20 border-amber-500/50 font-bold' : 'bg-amber-500/10 border-amber-500/20'}`}>
                            <div className="flex items-center gap-3">
                              <Trophy className="h-5 w-5 text-amber-500" />
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: result.firstPlace.teamColor }}
                                />
                                <span className="font-semibold">{result.firstPlace.teamName}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {result.firstPlace.sales} sales
                              </Badge>
                            </div>
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                              +{result.firstPlace.points} points
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex items-center p-3 bg-muted/50 border border-border rounded-lg">
                            <span className="text-sm text-muted-foreground">No sales in this region</span>
                          </div>
                        )}

                        {result.secondPlace && (
                          <div className={`flex items-center justify-between p-3 border rounded-lg ${result.secondPlace.teamId === currentTeamId && currentRole === 'STUDENT' ? 'bg-slate-500/20 border-slate-500/50 font-bold' : 'bg-slate-500/10 border-slate-500/20'}`}>
                            <div className="flex items-center gap-3">
                              <Medal className="h-5 w-5 text-slate-500" />
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: result.secondPlace.teamColor }}
                                />
                                <span className="font-semibold">{result.secondPlace.teamName}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {result.secondPlace.sales} sales
                              </Badge>
                            </div>
                            <Badge className="bg-slate-500 hover:bg-slate-600 text-white font-bold">
                              +{result.secondPlace.points} points
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {!controlAlreadyCalculated && currentRole !== 'STUDENT' && (
              <Button 
                onClick={handleApplyControl} 
                className="w-full" 
                size="lg"
              >
                <Save className="mr-2 h-4 w-4" />
                Apply Control Points to Teams
              </Button>
            )}

            {controlAlreadyCalculated && (
              <div className="space-y-3">
                <Alert>
                  <AlertDescription className="flex items-center justify-between">
                    <span>Control points have been applied for this round.</span>
                  </AlertDescription>
                </Alert>
                {currentRole !== 'STUDENT' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      recalculateControlPoints();
                      toast.success("Control points recalculated & repaired across all rounds!");
                    }}
                    className="w-full border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-semibold"
                  >
                    <Trophy className="mr-2 h-4 w-4 text-amber-500" />
                    Recalculate & Repair All Control Points
                  </Button>
                )}
              </div>
            )}

            {currentRound >= 5 && (
              <div className="pt-4 border-t border-border">
                <Button
                  onClick={() => {
                    toast.success("Game Ended! Displaying final Summary Map.");
                    if (onEndGame) onEndGame();
                  }}
                  size="lg"
                  className="w-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold shadow-xl gap-2 text-lg py-6"
                >
                  <Trophy className="h-6 w-6 text-yellow-200 animate-bounce" />
                  End Game — View Summary Map
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
