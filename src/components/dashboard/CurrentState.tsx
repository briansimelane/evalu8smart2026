import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame } from '@/contexts/GameContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Package, Edit, Wrench, Microscope, Truck, ShoppingCart, PackageX, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { TEAM_COLORS } from '@/data/combinations';
import { toast } from 'sonner';

interface CurrentStateProps {
  onEditTeamData?: (roundNumber: number, teamId: string) => void;
}

export const CurrentState = ({ onEditTeamData }: CurrentStateProps) => {
  const { gameState, advanceRound } = useGame();
  const [decisionsOpen, setDecisionsOpen] = useState(() => {
    const saved = localStorage.getItem('decisionsOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isSorted, setIsSorted] = useState(false);

  const handleAdvanceRound = () => {
    advanceRound();
    toast.success(`Advanced to Round ${gameState!.currentRound + 1}`);
  };

  const handleDecisionsToggle = (open: boolean) => {
    setDecisionsOpen(open);
    localStorage.setItem('decisionsOpen', JSON.stringify(open));
  };

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
      <h2 className="text-3xl font-bold">State: Round {gameState.currentRound}</h2>

      <Card>
        <CardHeader>
          <Collapsible open={decisionsOpen} onOpenChange={handleDecisionsToggle}>
            <div className="flex items-center justify-between w-full gap-4">
              <CollapsibleTrigger className="flex items-center justify-between flex-1">
                <ChevronDown className={`h-5 w-5 transition-transform ${decisionsOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsSorted(!isSorted)}
              >
                Update Order
              </Button>
            </div>
            <CollapsibleContent>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Team</TableHead>
                      <TableHead className="text-center text-base">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-red-500 text-base">$</span>
                          Price
                        </div>
                      </TableHead>
                      <TableHead className="text-center text-base">
                        <div className="flex items-center justify-center gap-1">
                          <Package className="h-4 w-4" />
                          Products
                        </div>
                      </TableHead>
                      <TableHead className="text-center text-base">
                        <div className="flex items-center justify-center gap-1">
                          <Wrench className="h-4 w-4 text-yellow-500" />
                          Improvement
                        </div>
                      </TableHead>
                      <TableHead className="text-center text-base">
                        <div className="flex items-center justify-center gap-1">
                          <Microscope className="h-4 w-4 text-purple-500" />
                          Research
                        </div>
                      </TableHead>
                      <TableHead className="text-center text-base">
                        <div className="flex items-center justify-center gap-1">
                          <Truck className="h-4 w-4 text-cyan-400" />
                          Logistics
                        </div>
                      </TableHead>
                      <TableHead className="text-center text-base">Previous Round Value</TableHead>
                      <TableHead className="text-center text-base">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let teamsToDisplay = [...gameState.teams];
                      
                      if (isSorted) {
                        teamsToDisplay.sort((a, b) => {
                          const aData = currentRoundData?.teamData[a.id];
                          const bData = currentRoundData?.teamData[b.id];
                          
                          if (!aData || !bData) return 0;
                          
                          // Primary sort: by price (lowest first)
                          if (aData.price !== bData.price) {
                            return aData.price - bData.price;
                          }
                          
                          // Secondary sort: by previous round value (lowest first)
                          return getPreviousRoundValue(a.id) - getPreviousRoundValue(b.id);
                        });
                      }
                      
                      return teamsToDisplay.map((team, index) => {
                        const teamRoundData = currentRoundData?.teamData[team.id];
                        if (!teamRoundData) return null;

                        return (
                          <TableRow key={team.id} className={index % 2 === 0 ? "bg-muted/50" : ""}>
                            <TableCell className="py-1 text-base">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full border"
                                  style={{ backgroundColor: team.color }}
                                />
                                <span className="font-medium">{team.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium py-1 text-base">{teamRoundData.price}</TableCell>
                            <TableCell className="text-center font-medium py-1 text-base">{teamRoundData.productsProduced}</TableCell>
                            <TableCell className="text-center font-medium py-1 text-base">{teamRoundData.improvementCards}</TableCell>
                            <TableCell className="text-center font-medium py-1 text-base">{teamRoundData.researchIcons}</TableCell>
                            <TableCell className="text-center font-medium py-1 text-base">{teamRoundData.logisticsIcons}</TableCell>
                            <TableCell className="text-center font-semibold py-1 text-base">${getPreviousRoundValue(team.id).toLocaleString()}</TableCell>
                            <TableCell className="text-center py-1">
                              {onEditTeamData && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onEditTeamData(gameState.currentRound, team.id)}
                                >
                                  Amend
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </CardHeader>
      </Card>

    </div>
  );
};
