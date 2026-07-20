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

export const ControlPhase = () => {
  const { gameState, addRoundData, getCurrentRound } = useGame();
  const { currentRole } = useSession();
  const [controlCalculated, setControlCalculated] = useState(false);
  const [regionControlResults, setRegionControlResults] = useState<RegionControlResult[]>([]);

  if (!gameState) return null;

  const currentRound = getCurrentRound();
  const currentRoundData = gameState.rounds.find(r => r.roundNumber === currentRound);
  const teamsWithData = new Set(Object.keys(currentRoundData?.teamData || {}));
  
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

  // Auto-calculate when component mounts and all sales data is available
  useEffect(() => {
    if (allTeamsHaveSalesData && !controlAlreadyCalculated && !controlCalculated) {
      calculateControl();
    }
  }, [allTeamsHaveSalesData, controlAlreadyCalculated, controlCalculated]);

  const handleApplyControl = () => {
    // Apply control points to all teams
    regionControlResults.forEach(result => {
      // Update first place team
      if (result.firstPlace) {
        const teamData = currentRoundData?.teamData[result.firstPlace.teamId];
        if (teamData) {
          const currentControlPoints = teamData.regionControlPoints || {};
          const updatedData = {
            ...teamData,
            regionControlPoints: {
              ...currentControlPoints,
              [result.region]: result.firstPlace.points
            },
            controlValue: (teamData.controlValue || 0) + result.firstPlace.points,
            totalMoney: (teamData.totalMoney || 0) + result.firstPlace.points
          };
          addRoundData(currentRound, result.firstPlace.teamId, updatedData);
        }
      }

      // Update second place team
      if (result.secondPlace) {
        const teamData = currentRoundData?.teamData[result.secondPlace.teamId];
        if (teamData) {
          const currentControlPoints = teamData.regionControlPoints || {};
          const updatedData = {
            ...teamData,
            regionControlPoints: {
              ...currentControlPoints,
              [result.region]: result.secondPlace.points
            },
            controlValue: (teamData.controlValue || 0) + result.secondPlace.points,
            totalMoney: (teamData.totalMoney || 0) + result.secondPlace.points
          };
          addRoundData(currentRound, result.secondPlace.teamId, updatedData);
        }
      }
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
              <div className="text-sm text-muted-foreground">
                Control points awarded based on sales performance in each region. Teams with presence in the region compete for control.
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...regionControlResults]
                  .sort((a, b) => REGION_CUSTOMERS.findIndex(r => r.region === a.region) - REGION_CUSTOMERS.findIndex(r => r.region === b.region))
                  .map(result => {
                  return (
                    <Card key={result.region} className="border-primary/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          {result.region}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {result.firstPlace ? (
                          <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
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
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                              +{result.firstPlace.points} points
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex items-center p-3 bg-muted/50 border border-border rounded-lg">
                            <span className="text-sm text-muted-foreground">No sales in this region</span>
                          </div>
                        )}

                        {result.secondPlace && (
                          <div className="flex items-center justify-between p-3 bg-slate-500/10 border border-slate-500/20 rounded-lg">
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
                            <Badge className="bg-slate-500 hover:bg-slate-600 text-white">
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
              <Alert>
                <AlertDescription>
                  Control points have been applied for this round.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
