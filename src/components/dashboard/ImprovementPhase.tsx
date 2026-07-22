import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGame } from '@/contexts/GameContext';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Truck, Package, TrendingUp, TrendingDown, Wrench, Shuffle, Microscope, CirclePlus, CircleMinus, AlertCircle, AlertTriangle, Trophy, CheckCircle2 } from 'lucide-react';
import { AVAILABLE_IMPROVEMENT_CARDS, ImprovementCardData } from '@/data/improvements';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMemo } from 'react';

import { useSession } from '@/contexts/SessionContext';
import { PhaseLockCard } from './PhaseLockCard';

export const ImprovementPhase = () => {
  const { gameState, allocateImprovementCards, selectRandomCards, reshuffleRoundCards, previewNextRoundCards, claimImprovementCard, calculatePlayOrder } = useGame();
  const { currentRole, currentTeamId, currentClassTeams, isReadOnly, selectTeam } = useSession();
  const activePhase = gameState?.currentPhase || 'planning';
  const { toast } = useToast();
  const [availableCards, setAvailableCards] = useState<ImprovementCardData[]>([]);
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [nextRoundCards, setNextRoundCards] = useState<ImprovementCardData[]>([]);
  const [isAllocated, setIsAllocated] = useState(false);

  useEffect(() => {
    if (gameState && availableCards.length === 0) {
      const selected = selectRandomCards();
      setAvailableCards(selected);
    }
  }, [gameState, availableCards.length, selectRandomCards]);

  if (!gameState) return null;

  if (gameState.currentRound >= 5) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/10 max-w-4xl mx-auto my-8 shadow-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Wrench className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100">Improvement Phase Skipped (Final Round)</h3>
          <p className="text-sm text-amber-800/90 dark:text-amber-200/90 max-w-lg mx-auto leading-relaxed">
            Round {gameState.currentRound} is the final round of the simulation. No improvement cards are available or allocated in the final round. Teams proceed directly to Research & Expansion.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentRoundData = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);

  const allocationsCompleted = useMemo(() => {
    return gameState.improvementCards.some(c => c.allocatedInRound === gameState.currentRound);
  }, [gameState.improvementCards, gameState.currentRound]);

  const teamsWithPlans = useMemo(() => {
    return currentRoundData
      ? Object.keys(currentRoundData.teamData).map(teamId => {
          const team = gameState.teams.find(t => t.id === teamId);
          const teamData = currentRoundData.teamData[teamId];
          return { team, teamData };
        }).filter(item => item.team)
      : [];
  }, [currentRoundData, gameState.teams]);

  const allTeamsHavePlans = useMemo(() => {
    return gameState.teams.every(team => teamsWithPlans.some(t => t.team?.id === team.id));
  }, [gameState.teams, teamsWithPlans]);

  if (currentRole === 'STUDENT' && !allTeamsHavePlans) {
    return <PhaseLockCard phaseName="Improvement Phase" />;
  }

  useEffect(() => {
    if (gameState && (isAllocated || allocationsCompleted) && nextRoundCards.length === 0) {
      const nextCards = previewNextRoundCards();
      setNextRoundCards(nextCards);
    }
  }, [gameState, isAllocated, allocationsCompleted, nextRoundCards.length, previewNextRoundCards]);

  const getIconElement = (iconType: string) => {
    if (iconType === 'Price and Product') {
      return (
        <>
          <div className="relative inline-block">
            <span className="font-bold text-red-500 text-3xl leading-none">$</span>
            <CircleMinus className="h-4 w-4 text-red-500 absolute -bottom-1 -right-1" />
          </div>
          <Package className="h-8 w-8 text-black dark:text-white" />
        </>
      );
    }
    
    const iconMap: Record<string, JSX.Element> = {
      'Research': <Microscope className="h-8 w-8 inline text-purple-500" />,
      'Price Plus': (
        <div className="relative inline-block">
          <span className="font-bold text-red-500 text-3xl leading-none">$</span>
          <CirclePlus className="h-4 w-4 text-red-500 absolute -bottom-1 -right-1" />
        </div>
      ),
      'Product': <Package className="h-8 w-8 inline text-black dark:text-white" />,
      'Logistic': <Truck className="h-8 w-8 inline text-blue-500" />,
    };
    return iconMap[iconType] || null;
  };

  const teamsWithImprovement = useMemo(() => {
    if (!currentRoundData) return [];
    return gameState.teams.filter(team => {
      const teamData = currentRoundData.teamData[team.id];
      return teamData && teamData.improvementCards > 0;
    });
  }, [gameState.teams, currentRoundData]);

  const teamsWithoutImprovement = useMemo(() => {
    if (!currentRoundData) return [];
    return gameState.teams.filter(team => {
      const teamData = currentRoundData.teamData[team.id];
      return teamData && teamData.improvementCards === 0;
    });
  }, [gameState.teams, currentRoundData]);

  const handleAllocate = (cardId: number, teamId: string) => {
    setAllocations(prev => ({ ...prev, [cardId]: teamId }));

    if (currentRole !== 'STUDENT' && gameState) {
      const playOrder = calculatePlayOrder(gameState.currentRound);
      const teamsWithImprovement = playOrder.filter(t => {
        const count = currentRoundData?.teamData[t.id]?.improvementCards || 0;
        return count > 0;
      });
      const currIdx = teamsWithImprovement.findIndex(t => t.id === teamId);
      if (currIdx >= 0 && currIdx < teamsWithImprovement.length - 1) {
        const nextTeam = teamsWithImprovement[currIdx + 1];
        selectTeam(nextTeam.id);
        toast({
          title: "Turn Order",
          description: `Advanced to ${nextTeam.name}`
        });
      }
    }
  };

  const handleConfirmAllocations = () => {
    // If there are teams with improvement, validate all are allocated
    if (teamsWithImprovement.length > 0) {
      const allTeamsAllocated = teamsWithImprovement.every(team => 
        Object.values(allocations).includes(team.id)
      );

      if (!allTeamsAllocated) {
        toast({
          title: "Incomplete Allocation",
          description: "Please allocate cards to all teams with improvement points.",
          variant: "destructive"
        });
        return;
      }
    }

    // Allocate cards (empty object if no teams with improvement)
    allocateImprovementCards(allocations);
    setIsAllocated(true);
    
    // Preview next round's cards
    const nextCards = previewNextRoundCards();
    setNextRoundCards(nextCards);
    
    toast({
      title: "Cards Allocated",
      description: teamsWithImprovement.length > 0 
        ? "Improvement cards have been assigned to teams. Preview for next round is now available."
        : "Product cards auto-assigned to all teams. Preview for next round is now available.",
    });
    setAllocations({});
  };

  const handleReshuffle = () => {
    const selected = reshuffleRoundCards();
    setAvailableCards(selected);
    setAllocations({});
    toast({
      title: "Cards Reshuffled",
      description: "New random cards have been selected.",
    });
  };

  const isCardAllocated = (cardId: number) => {
    return allocations[cardId] !== undefined || gameState.improvementCards.some(c => c.id === cardId && c.allocatedInRound === gameState.currentRound);
  };
  const isTeamAllocated = (teamId: string) => Object.values(allocations).includes(teamId);

  return (
    <div className="space-y-6">
      {/* Warning if not all teams have submitted plans */}
      {!allTeamsHavePlans && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Not all teams have submitted their plans yet. All teams must submit plans before improvement cards can be allocated.
          </AlertDescription>
        </Alert>
      )}

      {/* Waiting alert for students if plans are submitted but cards not allocated yet */}
      {allTeamsHavePlans && !(isAllocated || allocationsCompleted) && currentRole === 'STUDENT' && (
        <Alert>
          <AlertTriangle className="h-4 w-4 text-blue-500" />
          <AlertDescription>
            Waiting for the facilitator to allocate improvement cards for Round {gameState.currentRound}.
          </AlertDescription>
        </Alert>
      )}

      {gameState.currentRound === 4 && !(isAllocated || allocationsCompleted) && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">Final Improvement Phase</p>
                <p className="text-sm text-amber-800 dark:text-amber-200">This is Round 4 - the last improvement phase. There will be no improvement phase in Round 5.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-8 w-8 text-yellow-500" />
            Improvement Phase - Round {gameState.currentRound}
          </h2>
          <p className="text-muted-foreground mt-1">
            {(isAllocated || allocationsCompleted) ? 'Allocation complete.' + (gameState.currentRound < 4 ? ' Preview of next round below.' : '') : 'Allocate improvement cards to teams based on their performance'}
          </p>
        </div>
        {!(isAllocated || allocationsCompleted) && currentRole !== 'STUDENT' && (
          <Button onClick={handleReshuffle} variant="outline">
            <Shuffle className="h-4 w-4 mr-2" />
            Reshuffle Cards
          </Button>
        )}
      </div>

      {/* Turn Order & Improvement Overview */}
      {(() => {
        const playOrder = calculatePlayOrder(gameState.currentRound);
        const activeTurnTeam = playOrder.find(t => {
          const count = currentRoundData?.teamData[t.id]?.improvementCards || 0;
          const isDone = isTeamAllocated(t.id) || gameState.improvementCards.some(c => c.usedBy === t.id && c.allocatedInRound === gameState.currentRound);
          return count > 0 && !isDone;
        });

        return (
          <div className="space-y-2 p-4 bg-card border border-border rounded-xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>Turn Order & Improvement Points — Round {gameState.currentRound}</span>
              </h3>
              <div className="flex items-center gap-2">
                {activeTurnTeam ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Current Turn: {activeTurnTeam.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-bold gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Improvements Complete
                  </Badge>
                )}
                <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground bg-muted/40 hidden md:inline-flex">
                  Ordered by Price & Wealth
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
              {playOrder.map((team, index) => {
                const teamData = currentRoundData?.teamData[team.id];
                const improvementCount = teamData?.improvementCards || 0;
                const isClaimedOrAllocated = isTeamAllocated(team.id) || gameState.improvementCards.some(c => c.usedBy === team.id && c.allocatedInRound === gameState.currentRound);
                const isActiveTurn = team.id === activeTurnTeam?.id;

                return (
                  <div
                    key={team.id}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between space-y-1.5 transition-all ${
                      isActiveTurn
                        ? 'ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/80 shadow-md animate-pulse'
                        : team.id === currentTeamId && currentRole === 'STUDENT'
                        ? 'ring-2 ring-yellow-500 bg-yellow-500/5 shadow-sm border-yellow-500/50'
                        : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-muted-foreground font-mono text-[11px]">{index + 1}.</span>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                        <span className="truncate">{team.name}</span>
                      </div>
                      {isActiveTurn && (
                        <Badge className="bg-emerald-500 text-white text-[9px] px-1 py-0 font-extrabold uppercase">
                          Turn
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Wrench className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                        {improvementCount} {improvementCount === 1 ? 'Card' : 'Cards'}
                      </span>

                      {improvementCount === 0 ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal bg-muted/40 text-muted-foreground border-border">
                          Skipped (0 Cards)
                        </Badge>
                      ) : isClaimedOrAllocated ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          Claimed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Teams with Improvement */}
      {!(isAllocated || allocationsCompleted) && teamsWithImprovement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Teams Earning Improvement Cards</CardTitle>
            <CardDescription>Select a card for each team below</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamsWithImprovement.map(team => {
                const teamData = currentRoundData.teamData[team.id];
                const allocatedCardId = Object.entries(allocations).find(
                  ([_, teamId]) => teamId === team.id
                )?.[0];
                const isMyTeam = currentRole === 'STUDENT' && team.id === currentTeamId;
                const isOtherTeamStudent = currentRole === 'STUDENT' && team.id !== currentTeamId;

                return (
                  <div key={team.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="font-semibold">{team.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {teamData.improvementCards} card{teamData.improvementCards > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    {isOtherTeamStudent ? (
                      <div className="p-3 bg-muted/40 rounded-lg border text-xs space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Team Status:</span>
                          {isTeamAllocated(team.id) ? (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                              Card Claimed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">
                              Selecting Card...
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <Select
                          value={allocatedCardId?.toString() || ''}
                          onValueChange={(value) => handleAllocate(parseInt(value), team.id)}
                          disabled={
                            currentRole === 'STUDENT' && 
                            (isReadOnly || team.id !== currentTeamId || activePhase !== 'improvement')
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select improvement card" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCards.map((card, cardIndex) => (
                              <SelectItem
                                key={card.id}
                                value={card.id.toString()}
                                disabled={isCardAllocated(card.id)}
                              >
                                <div className="flex items-center gap-2">
                                  Card {cardIndex + 1}: {getIconElement(card.icon1)} {getIconElement(card.icon2)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {isMyTeam && activePhase === 'improvement' && !isReadOnly && (
                          <Button
                            size="sm"
                            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            disabled={!allocatedCardId}
                            onClick={() => {
                              if (allocatedCardId) {
                                claimImprovementCard(parseInt(allocatedCardId), team.id);
                                toast({
                                  title: "Card Claimed",
                                  description: "Your team has claimed this improvement card successfully."
                                });
                              }
                            }}
                          >
                            Claim Card
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Cards Display */}
      {!(isAllocated || allocationsCompleted) && (
        <Card>
          <CardHeader>
            <CardTitle>Available Improvement Cards</CardTitle>
            <CardDescription>
              {availableCards.length} cards available for this round
              {teamsWithImprovement.length === 0 && " (all teams will receive product cards)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {availableCards.map((card, cardIndex) => {
                const allocatedTeam = allocations[card.id];
                const team = gameState.teams.find(t => t.id === allocatedTeam);
                
                return (
                  <div
                    key={card.id}
                    className={`p-4 border rounded-lg transition-all ${
                      allocatedTeam ? 'opacity-50 border-primary' : ''
                    }`}
                  >
                    <div className="text-center space-y-3">
                      <div className="font-semibold text-sm">Card {cardIndex + 1}</div>
                      <div className="flex justify-center gap-2">
                        <div className="flex items-center justify-center p-3 rounded-lg bg-white border-2 border-gray-300">
                          {getIconElement(card.icon1)}
                        </div>
                        <div className="flex items-center justify-center p-3 rounded-lg bg-white border-2 border-gray-300">
                          {getIconElement(card.icon2)}
                        </div>
                      </div>
                      {team && (
                        <Badge variant="default" className="text-xs">
                          {team.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allocated Cards Summary (once confirmed) */}
      {(isAllocated || allocationsCompleted) && (
        <Card>
          <CardHeader>
            <CardTitle>Allocated Improvement Cards - Round {gameState.currentRound}</CardTitle>
            <CardDescription>
              Improvement cards assigned to teams for this round
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gameState.teams.map(team => {
                const teamCards = gameState.improvementCards.filter(c => 
                  c.availableForTeam === team.id && c.allocatedInRound === gameState.currentRound
                );
                
                return (
                  <div key={team.id} className="p-4 border rounded-lg space-y-3 bg-card/50">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="font-semibold">{team.name}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {teamCards.length > 0 ? (
                        teamCards.map(card => (
                          <div key={card.id} className="flex gap-2 items-center p-2 bg-background border rounded">
                            <div className="flex gap-1">
                              <div className="flex items-center justify-center p-1.5 rounded bg-white border border-gray-200">
                                {getIconElement(card.icon1)}
                              </div>
                              {card.icon2 && (
                                <div className="flex items-center justify-center p-1.5 rounded bg-white border border-gray-200">
                                  {getIconElement(card.icon2)}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground text-center">
                              {card.id < 0 ? 'Product Card' : 'Improvement Card'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No cards allocated this round</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Round Preview - Only show if not Round 4 */}
      {(isAllocated || allocationsCompleted) && nextRoundCards.length > 0 && gameState.currentRound < 4 && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-yellow-500" />
              Preview: Round {gameState.currentRound + 1} Improvement Cards
            </CardTitle>
            <CardDescription>
              These cards will be available for allocation in the next round
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {nextRoundCards.map((card, cardIndex) => (
                <div
                  key={card.id}
                  className="p-4 border rounded-lg bg-muted/50"
                >
                  <div className="text-center space-y-3">
                    <div className="font-semibold text-sm">Card {cardIndex + 1}</div>
                    <div className="flex justify-center gap-2">
                      <div className="flex items-center justify-center p-3 rounded-lg bg-white border-2 border-gray-300">
                        {getIconElement(card.icon1)}
                      </div>
                      <div className="flex items-center justify-center p-3 rounded-lg bg-white border-2 border-gray-300">
                        {getIconElement(card.icon2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams Without Improvement (Auto-assigned Product cards) - Only show before confirmation */}
      {teamsWithoutImprovement.length > 0 && !(isAllocated || allocationsCompleted) && (
        <Card>
          <CardHeader>
            <CardTitle>Teams Receiving Product Cards</CardTitle>
            <CardDescription>
              These teams automatically receive a Product card (one product)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {teamsWithoutImprovement.map(team => (
                <div key={team.id} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="text-sm font-medium">{team.name}</span>
                  </div>
                  <div className="flex justify-center">
                    <div className="flex items-center justify-center p-3 rounded-lg bg-white border-2 border-gray-300">
                      <Package className="h-10 w-10 text-black dark:text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!(isAllocated || allocationsCompleted) && currentRole !== 'STUDENT' && (
        <div className="flex justify-end">
          <Button
            onClick={handleConfirmAllocations}
            size="lg"
            disabled={teamsWithImprovement.length > 0 && Object.keys(allocations).length !== teamsWithImprovement.length}
          >
            Confirm Allocations
          </Button>
        </div>
      )}
    </div>
  );
};
