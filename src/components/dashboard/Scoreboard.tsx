import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame } from '@/contexts/GameContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Package, Wrench, Microscope, Truck, ShoppingCart, PackageX } from 'lucide-react';
import { TEAM_COLORS } from '@/data/combinations';
import { toast } from 'sonner';

interface ScoreboardProps {
  onEditTeamData?: (roundNumber: number, teamId: string) => void;
}

export const Scoreboard = ({ onEditTeamData }: ScoreboardProps) => {
  const { gameState } = useGame();

  if (!gameState) return null;

  const currentRoundData = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);

  // Initial team scores (Round 0) - based on selected team color (with name fallback)
  const COLOR_SCORES: Record<string, number> = {
    green: 3,
    blue: 4,
    black: 5,
    yellow: 6,
    red: 7
  };

  const colorNameFromHex = (hex: string): string | null => {
    const found = TEAM_COLORS.find(c => c.value.toLowerCase() === (hex || '').toLowerCase());
    return found ? found.name.toLowerCase() : null;
  };

  const getInitialScore = (team: typeof gameState.teams[0]): number => {
    const byColor = colorNameFromHex(team.color || '');
    if (byColor && COLOR_SCORES[byColor] !== undefined) return COLOR_SCORES[byColor];

    // Fallback: infer from team name if it contains the color
    const teamName = (team.name || '').toLowerCase();
    for (const key of Object.keys(COLOR_SCORES)) {
      if (teamName.includes(key)) return COLOR_SCORES[key];
    }
    return 0;
  };

  const getPreviousRoundValue = (teamId: string): number => {
    const team = gameState.teams.find(t => t.id === teamId);
    if (!team) return 0;
    
    const baseValue = getInitialScore(team);
    
    if (gameState.currentRound === 1) {
      return baseValue;
    }
    
    // Sum up all previous rounds' totalMoney
    let total = baseValue;
    for (let i = 1; i < gameState.currentRound; i++) {
      const round = gameState.rounds.find(r => r.roundNumber === i);
      if (round && round.teamData[teamId]) {
        total += round.teamData[teamId].totalMoney;
      }
    }
    return total;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Team Scoreboard</h2>
      
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {(() => {
              // Sort teams by Overall Value (highest first), then by Total Money (lowest first) for ties
              const sortedTeams = [...gameState.teams].sort((a, b) => {
                const aData = currentRoundData?.teamData[a.id];
                const bData = currentRoundData?.teamData[b.id];
                
                if (!aData || !bData) return 0;
                
                const aOverallValue = getPreviousRoundValue(a.id) + aData.totalMoney;
                const bOverallValue = getPreviousRoundValue(b.id) + bData.totalMoney;
                
                // Primary sort: by Overall Value (highest first)
                if (aOverallValue !== bOverallValue) {
                  return bOverallValue - aOverallValue;
                }
                
                // Secondary sort: by Total Money (lowest first)
                return aData.totalMoney - bData.totalMoney;
              });
              
              return sortedTeams.map(team => {
                const teamRoundData = currentRoundData?.teamData[team.id];
                
                if (!teamRoundData) return null;

                const totalRegionalSales = teamRoundData.customersSold ? teamRoundData.customersSold.length : 0;
                const lostProducts = teamRoundData.productsProduced - totalRegionalSales;
                const overallValue = getPreviousRoundValue(team.id) + teamRoundData.totalMoney;

                return (
                  <div
                    key={team.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      {/* Team Name */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full border-2"
                          style={{ backgroundColor: team.color }}
                        />
                        <div className="font-semibold text-lg">{team.name}</div>
                      </div>

                      {/* Input Details with Icons */}
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1.5">
                           <span className="font-bold text-red-500 text-lg">$</span>
                           <span className="text-base font-medium">{teamRoundData.price}</span>
                         </div>
                        <div className="flex items-center gap-1.5">
                          <Package className="h-5 w-5 text-black dark:text-white" />
                          <span className="text-base font-medium">{teamRoundData.productsProduced}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Wrench className="h-5 w-5 text-yellow-500" />
                          <span className="text-base font-medium">{teamRoundData.improvementCards}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Microscope className="h-5 w-5 text-purple-500" />
                          <span className="text-base font-medium">{teamRoundData.researchIcons}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-5 w-5 text-blue-500" />
                          <span className="text-base font-medium">{teamRoundData.logisticsIcons}</span>
                        </div>
                      </div>

                      {/* Results as Badges */}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-sm px-2.5 py-1">
                          Combo {teamRoundData.combination}-{teamRoundData.position}
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1">
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                          {totalRegionalSales}
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1">
                          <PackageX className="h-3.5 w-3.5 mr-1" />
                          {lostProducts}
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1">
                          Revenue: ${teamRoundData.revenue.toLocaleString()}
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1">
                          Control: ${teamRoundData.controlValue}
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1">
                          Current: ${teamRoundData.totalMoney.toLocaleString()}
                        </Badge>
                        <Badge variant="default" className="text-sm px-2.5 py-1 font-bold">
                          Overall: ${overallValue.toLocaleString()}
                        </Badge>
                      </div>

                      {/* Amend Button */}
                      {onEditTeamData && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditTeamData(gameState.currentRound, team.id)}
                        >
                          Amend
                        </Button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
