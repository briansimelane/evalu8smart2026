import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame } from '@/contexts/GameContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, ShoppingCart, PackageX } from 'lucide-react';
import { GameIcon } from './GameIcon';
import { TEAM_COLORS } from '@/data/combinations';
import { calculateTeamTotalScore, getControlPointsForTeamInRound, getTeamPatentPoints, getInitialScore } from '@/types/game';
import { toast } from 'sonner';

import { useSession } from '@/contexts/SessionContext';

interface ScoreboardProps {
  onEditTeamData?: (roundNumber: number, teamId: string) => void;
}

export const Scoreboard = ({ onEditTeamData }: ScoreboardProps) => {
  const { gameState } = useGame();
  const { currentRole } = useSession();

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
      <h2 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight">Team Scoreboard</h2>
      
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {(() => {
              // Sort teams by Overall Value (highest first)
              const sortedTeams = [...gameState.teams].sort((a, b) => {
                const aOverallValue = calculateTeamTotalScore(a.id, gameState.currentRound, gameState).totalScore;
                const bOverallValue = calculateTeamTotalScore(b.id, gameState.currentRound, gameState).totalScore;
                
                if (aOverallValue !== bOverallValue) {
                  return bOverallValue - aOverallValue;
                }
                
                const aMoney = currentRoundData?.teamData[a.id]?.totalMoney || 0;
                const bMoney = currentRoundData?.teamData[b.id]?.totalMoney || 0;
                return aMoney - bMoney;
              });
              
              return sortedTeams.map(team => {
                const teamRoundData = currentRoundData?.teamData[team.id] || {
                  price: 0,
                  productsProduced: 0,
                  improvementCards: 0,
                  researchIcons: 0,
                  logisticsIcons: 0,
                  combination: 0,
                  position: 0,
                  revenue: 0,
                  controlValue: 0,
                  totalMoney: 0,
                  customersSold: []
                };

                const totalRegionalSales = teamRoundData.customersSold ? teamRoundData.customersSold.length : 0;
                const lostProducts = Math.max(0, teamRoundData.productsProduced - totalRegionalSales);
                const roundControl = getControlPointsForTeamInRound(currentRoundData, team.id, gameState);
                const scoreBreakdown = calculateTeamTotalScore(team.id, gameState.currentRound, gameState);
                const overallValue = scoreBreakdown.totalScore;
                const totalPatentsAndBonuses = scoreBreakdown.patentBonus + scoreBreakdown.wildcardBonus + scoreBreakdown.directiveBonus;

                return (
                  <div
                    key={team.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors space-y-3"
                  >
                    {/* Row 1: Header (Team Name & Input Icons) */}
                    <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-border/40">
                      {/* Team Name */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full border-2 shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <div className="font-semibold text-lg flex items-center gap-1.5 flex-wrap">
                          {team.name}
                          {team.isBot && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-normal">🤖 Bot</span>}
                          {gameState?.botThinking?.[team.id] && (
                            <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded animate-pulse font-normal flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                              Thinking...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Input Details with Icons */}
                      <div className="flex items-center gap-3 shrink-0">
                         <div className="flex items-center gap-1.5">
                           <GameIcon type="price" size="sm" />
                           <span className="text-base font-medium">
                             {(gameState.currentPhase || 'planning') === 'planning' ? '🔒 Hidden' : `$${teamRoundData.price}`}
                           </span>
                         </div>
                        <div className="flex items-center gap-1.5">
                          <GameIcon type="production" size="sm" />
                          <span className="text-base font-medium">{teamRoundData.productsProduced}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <GameIcon type="improvement" size="sm" />
                          <span className="text-base font-medium">{teamRoundData.improvementCards}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <GameIcon type="research" size="sm" />
                          <span className="text-base font-medium">{teamRoundData.researchIcons}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <GameIcon type="logistics" size="sm" />
                          <span className="text-base font-medium">{teamRoundData.logisticsIcons}</span>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Results as Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-sm px-2.5 py-1">
                          Combo {teamRoundData.combination ? `${teamRoundData.combination}-${teamRoundData.position}` : '—'}
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1">
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                          {totalRegionalSales} sold
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1">
                          <PackageX className="h-3.5 w-3.5 mr-1" />
                          {lostProducts} unsold
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1 text-success dark:text-success font-semibold">
                          Revenue: ${(teamRoundData.revenue || 0).toLocaleString()}
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1 text-warning dark:text-warning font-semibold">
                          Control: +{roundControl} pts
                        </Badge>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1 text-muted-foreground dark:text-purple-400 font-semibold" title={`Patents: ${scoreBreakdown.patentBonus} pts, Wildcards: ${scoreBreakdown.wildcardBonus} pts, Directives: ${scoreBreakdown.directiveBonus} pts`}>
                          Patents & Bonuses: +{totalPatentsAndBonuses} pts
                        </Badge>
                        <Badge variant="default" className="text-sm px-2.5 py-1 font-bold bg-primary text-white">
                          Total Score: {overallValue.toLocaleString()} pts
                        </Badge>
                      </div>

                      {/* Amend Button - Facilitator / Admin only */}
                      {currentRole !== 'STUDENT' && onEditTeamData && (
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
