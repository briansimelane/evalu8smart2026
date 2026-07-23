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
import { GameIcon } from './GameIcon';
import { getInitialScore } from '@/types/game';

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
    <div className="space-y-4">
      <h2 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight">State: Round {gameState.currentRound}</h2>

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
                {/* Mobile Cards View (<640px) */}
                <div className="space-y-3 block sm:hidden">
                  {(() => {
                    let teamsToDisplay = [...gameState.teams];
                    if (isSorted) {
                      teamsToDisplay.sort((a, b) => {
                        const aData = currentRoundData?.teamData[a.id];
                        const bData = currentRoundData?.teamData[b.id];
                        if (!aData || !bData) return 0;
                        if (aData.price !== bData.price) return aData.price - bData.price;
                        return getPreviousRoundValue(a.id) - getPreviousRoundValue(b.id);
                      });
                    }
                    return teamsToDisplay.map(team => {
                      const teamRoundData = currentRoundData?.teamData[team.id];
                      if (!teamRoundData) return null;
                      return (
                        <div key={team.id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2.5">
                          <div className="flex items-center justify-between border-b border-border/60 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ backgroundColor: team.color }} />
                              <span className="font-bold text-sm">{team.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold">
                              Prev: ${getPreviousRoundValue(team.id).toLocaleString()}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1 text-center pt-1">
                            <div className="flex flex-col items-center p-1 bg-muted/40 rounded-lg">
                              <GameIcon type="price" size="xs" />
                              <span className="text-[10px] text-muted-foreground mt-0.5">Price</span>
                              <span className="text-xs font-bold">${teamRoundData.price}</span>
                            </div>
                            <div className="flex flex-col items-center p-1 bg-muted/40 rounded-lg">
                              <GameIcon type="production" size="xs" />
                              <span className="text-[10px] text-muted-foreground mt-0.5">Prod</span>
                              <span className="text-xs font-bold">{teamRoundData.productsProduced}</span>
                            </div>
                            <div className="flex flex-col items-center p-1 bg-muted/40 rounded-lg">
                              <GameIcon type="improvement" size="xs" />
                              <span className="text-[10px] text-muted-foreground mt-0.5">Imp</span>
                              <span className="text-xs font-bold">{teamRoundData.improvementCards}</span>
                            </div>
                            <div className="flex flex-col items-center p-1 bg-muted/40 rounded-lg">
                              <GameIcon type="research" size="xs" />
                              <span className="text-[10px] text-muted-foreground mt-0.5">Res</span>
                              <span className="text-xs font-bold">{teamRoundData.researchIcons}</span>
                            </div>
                            <div className="flex flex-col items-center p-1 bg-muted/40 rounded-lg">
                              <GameIcon type="logistics" size="xs" />
                              <span className="text-[10px] text-muted-foreground mt-0.5">Log</span>
                              <span className="text-xs font-bold">{teamRoundData.logisticsIcons}</span>
                            </div>
                          </div>
                          {onEditTeamData && (
                            <div className="pt-1 flex justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onEditTeamData(gameState.currentRound, team.id)}
                                className="h-8 text-xs font-semibold gap-1 text-primary"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                Amend Plan
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Desktop Table View (>=640px) */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-base">Team</TableHead>
                        <TableHead className="text-center text-base">
                          <div className="flex items-center justify-center gap-1">
                            <GameIcon type="price" size="xs" showLabel label="Price" />
                          </div>
                        </TableHead>
                        <TableHead className="text-center text-base">
                          <div className="flex items-center justify-center gap-1">
                            <GameIcon type="production" size="xs" showLabel label="Products" />
                          </div>
                        </TableHead>
                        <TableHead className="text-center text-base">
                          <div className="flex items-center justify-center gap-1">
                            <GameIcon type="improvement" size="xs" showLabel label="Improvement" />
                          </div>
                        </TableHead>
                        <TableHead className="text-center text-base">
                          <div className="flex items-center justify-center gap-1">
                            <GameIcon type="research" size="xs" showLabel label="Research" />
                          </div>
                        </TableHead>
                        <TableHead className="text-center text-base">
                          <div className="flex items-center justify-center gap-1">
                            <GameIcon type="logistics" size="xs" showLabel label="Logistics" />
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
                            if (aData.price !== bData.price) return aData.price - bData.price;
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
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </CardHeader>
      </Card>

    </div>
  );
};
