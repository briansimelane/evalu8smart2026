import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGame } from '@/contexts/GameContext';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Truck, Package, TrendingUp, TrendingDown, Wrench, Shuffle, Microscope, CirclePlus, CircleMinus, AlertCircle } from 'lucide-react';
import { AVAILABLE_IMPROVEMENT_CARDS, ImprovementCardData } from '@/data/improvements';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export const ImprovementPhase = () => {
  const { gameState, allocateImprovementCards, selectRandomCards, reshuffleRoundCards, previewNextRoundCards } = useGame();
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

  const currentRoundData = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
  if (!currentRoundData) return null;

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

  const teamsWithImprovement = gameState.teams.filter(team => {
    const teamData = currentRoundData.teamData[team.id];
    return teamData && teamData.improvementCards > 0;
  });

  const teamsWithoutImprovement = gameState.teams.filter(team => {
    const teamData = currentRoundData.teamData[team.id];
    return teamData && teamData.improvementCards === 0;
  });

  const handleAllocate = (cardId: number, teamId: string) => {
    setAllocations(prev => ({ ...prev, [cardId]: teamId }));
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

  const isCardAllocated = (cardId: number) => allocations[cardId] !== undefined;
  const isTeamAllocated = (teamId: string) => Object.values(allocations).includes(teamId);

  return (
    <div className="space-y-6">
      {gameState.currentRound === 4 && !isAllocated && (
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
            {isAllocated ? 'Allocation complete.' + (gameState.currentRound < 4 ? ' Preview of next round below.' : '') : 'Allocate improvement cards to teams based on their performance'}
          </p>
        </div>
        {!isAllocated && (
          <Button onClick={handleReshuffle} variant="outline">
            <Shuffle className="h-4 w-4 mr-2" />
            Reshuffle Cards
          </Button>
        )}
      </div>

      {/* Teams with Improvement */}
      {!isAllocated && teamsWithImprovement.length > 0 && (
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
                    
                    <Select
                      value={allocatedCardId?.toString() || ''}
                      onValueChange={(value) => handleAllocate(parseInt(value), team.id)}
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
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Cards Display */}
      {!isAllocated && (
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

      {/* Next Round Preview - Only show if not Round 4 */}
      {isAllocated && nextRoundCards.length > 0 && gameState.currentRound < 4 && (
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
      {teamsWithoutImprovement.length > 0 && !isAllocated && (
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

      {!isAllocated && (
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
