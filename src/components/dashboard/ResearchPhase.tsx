import { useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Microscope, Trophy, CheckCircle, MapPin, Wifi, Gamepad2, Battery, Radio, Signal, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const TECHNOLOGY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'GPS': MapPin,
  'Wifi': Wifi,
  'Gaming': Gamepad2,
  'Battery': Battery,
  'NFC': Radio,
  '4G': Signal,
};

import { useSession } from '@/contexts/SessionContext';

export const ResearchPhase = () => {
  const { gameState, allocateResearch, getTeamResearchProgress, getTechnologyCostForTeam, calculatePlayOrder } = useGame();
  const { currentRole, currentTeamId, isReadOnly } = useSession();
  const activePhase = gameState?.currentPhase || 'planning';
  const isReadOnlyMode = isReadOnly || (currentRole === 'STUDENT' && activePhase !== 'innovation');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  
  useEffect(() => {
    if (currentRole === 'STUDENT' && currentTeamId) {
      setSelectedTeam(currentTeamId);
    }
  }, [currentRole, currentTeamId]);
  const [allocatedThisRound, setAllocatedThisRound] = useState<Record<string, number>>({});
  const [playOrder, setPlayOrder] = useState<typeof gameState.teams>([]);

  useEffect(() => {
    if (gameState && gameState.currentRound) {
      const allOrder = calculatePlayOrder(gameState.currentRound);

      // Filter play order to only include teams with research icons > 0
      const currentRound = gameState.currentRound;
      const roundData = gameState.rounds.find(r => r.roundNumber === currentRound);
      const filteredOrder = allOrder.filter(t => {
        const icons = roundData?.teamData[t.id]?.researchIcons || 0;
        return icons > 0;
      });

      setPlayOrder(filteredOrder);

      // Load persisted allocations for this round
      const roundAllocations = gameState.researchAllocatedByRound?.[gameState.currentRound] || {};
      setAllocatedThisRound(roundAllocations);

      // Auto-select first team with remaining research if none selected
      if (!selectedTeam && filteredOrder.length > 0) {
        const currentRound = gameState.currentRound;
        const roundData = gameState.rounds.find(r => r.roundNumber === currentRound);
        const firstAvailable = filteredOrder.find(t => {
          const icons = roundData?.teamData[t.id]?.researchIcons || 0;
          const spent = roundAllocations[t.id] || 0;
          return spent < icons;
        });
        if (firstAvailable) setSelectedTeam(firstAvailable.id);
      }
    }
  }, [gameState?.currentRound, gameState?.teams, gameState?.patents, gameState?.researchAllocatedByRound, calculatePlayOrder, selectedTeam]);

  if (!gameState) return null;

  const currentRoundData = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
  const selectedTeamData = selectedTeam ? currentRoundData?.teamData[selectedTeam] : undefined;
  const availableResearchIcons = selectedTeamData?.researchIcons || 0;

  const teamProgress = selectedTeam ? getTeamResearchProgress(selectedTeam) : undefined;
  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const spentThisRound = selectedTeam ? (allocatedThisRound[selectedTeam] || 0) : 0;
  const availableThisTeam = Math.max(0, availableResearchIcons - spentThisRound);
  const remainingIcons = availableThisTeam - totalAllocated;

  const handleAllocationChange = (technology: string, value: string) => {
    const numValue = parseInt(value) || 0;
    if (numValue < 0) return;

    // Calculate total allocation with this new value
    const otherAllocations = Object.entries(allocations)
      .filter(([tech]) => tech !== technology)
      .reduce((sum, [_, val]) => sum + val, 0);

    const newTotal = otherAllocations + numValue;

    // Prevent allocation if it exceeds available icons
    if (newTotal > availableThisTeam) {
      toast({
        title: "Allocation Limit Reached",
        description: `Cannot allocate more than ${availableThisTeam} research icons total remaining for this team this round.`,
        variant: "destructive",
      });
      return;
    }

    setAllocations(prev => ({
      ...prev,
      [technology]: numValue,
    }));
  };

  const handleConfirmAllocations = () => {
    if (!selectedTeam) return;

    if (totalAllocated > availableResearchIcons) {
      toast({
        title: "Invalid Allocation",
        description: `Cannot allocate more than ${availableResearchIcons} research icons.`,
        variant: "destructive",
      });
      return;
    }

    if (totalAllocated === 0) {
      toast({
        title: "No Allocation",
        description: "Please allocate research points to at least one technology.",
        variant: "destructive",
      });
      return;
    }

    // Apply all allocations
    Object.entries(allocations).forEach(([tech, points]) => {
      if (points > 0) {
        allocateResearch(selectedTeam, tech, points);
      }
    });

    // Check for completed technologies
    const updatedProgress = getTeamResearchProgress(selectedTeam);
    const newCompletions = Object.entries(allocations).filter(([tech, points]) => {
      if (points === 0) return false;
      const currentInvestment = (teamProgress?.technologyInvestments[tech] || 0);
      const newInvestment = currentInvestment + points;
      const cost = getTechnologyCostForTeam(selectedTeam, tech);
      return newInvestment >= cost && !teamProgress?.completedTechnologies.includes(tech);
    });

    if (newCompletions.length > 0) {
      newCompletions.forEach(([tech]) => {
        const patentOwner = gameState.patents[tech];
        if (patentOwner === selectedTeam) {
          toast({
            title: "Patent Awarded! 🏆",
            description: `${tech} research completed! You own the patent.`,
          });
        } else {
          toast({
            title: "Research Completed! ✅",
            description: `${tech} research completed!`,
          });
        }
      });
    }

    toast({
      title: "Research Allocated",
      description: `Allocated ${totalAllocated} research icons.`,
    });

    // Update local tracking and auto-advance (the GameContext now persists this too)
    const prevSpent = allocatedThisRound[selectedTeam] || 0;
    const newSpent = prevSpent + totalAllocated;
    const updatedAllocations = { ...allocatedThisRound, [selectedTeam]: newSpent };
    setAllocatedThisRound(updatedAllocations);

    const teamIcons = currentRoundData?.teamData[selectedTeam]?.researchIcons || 0;
    if (newSpent >= teamIcons) {
      const nextTeam = playOrder.find(t => {
        const icons = currentRoundData?.teamData[t.id]?.researchIcons || 0;
        const spent = updatedAllocations[t.id] || 0;
        return spent < icons;
      });
      setSelectedTeam(nextTeam ? nextTeam.id : '');
    }

    setAllocations({});
  };

  const handleClearAll = () => {
    setAllocations({});
  };

  const selectedTeamObj = gameState.teams.find(t => t.id === selectedTeam);
  
  const DESIRED_TECH_ORDER = ['GPS', 'Wifi', 'Gaming', 'Battery', 'NFC', '4G'];
  const technologies = Object.values(gameState.technologies).sort((a, b) => {
    const rankA = DESIRED_TECH_ORDER.indexOf(a.name);
    const rankB = DESIRED_TECH_ORDER.indexOf(b.name);
    return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
  });

  const getPlayOrderRank = (teamId: string) => {
    return playOrder.findIndex(t => t.id === teamId) + 1;
  };

  const getOrdinalSuffix = (num: number) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return num + "st";
    if (j === 2 && k !== 12) return num + "nd";
    if (j === 3 && k !== 13) return num + "rd";
    return num + "th";
  };

  // Check if all teams with research icons have fully allocated
  const allTeamsAllocated = playOrder.every(team => {
    const icons = currentRoundData?.teamData[team.id]?.researchIcons || 0;
    const spent = allocatedThisRound[team.id] || 0;
    return spent >= icons;
  });

  return (
    <div className="space-y-6">
      {!allTeamsAllocated && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Microscope className="h-6 w-6 text-purple-500" />
                  Research & Development
                </CardTitle>
                <CardDescription>Round {gameState.currentRound} - Allocate research points to technologies</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Play Order Display */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Play Order (by price/value)</h3>
              <div className="flex flex-wrap gap-2">
                {playOrder.map((team, index) => (
                  <Badge
                    key={team.id}
                    style={{ backgroundColor: team.color }}
                    className="text-white"
                  >
                    {index + 1}. {team.name}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Team Selection */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam} disabled={currentRole === 'STUDENT'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {playOrder.map((team) => {
                        const icons = currentRoundData?.teamData[team.id]?.researchIcons || 0;
                        const spent = allocatedThisRound[team.id] || 0;
                        const hasRemaining = spent < icons;

                        // Hide teams that have already allocated all their research
                        if (!hasRemaining && spent > 0) return null;

                        return (
                          <SelectItem key={team.id} value={team.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: team.color }}
                              />
                              {team.name}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTeamObj && (
                  <div className="bg-secondary/20 rounded-lg p-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selectedTeamObj.color }}
                      />
                      <h3 className="font-semibold">{selectedTeamObj.name}</h3>
                      <Badge variant="outline">{getOrdinalSuffix(getPlayOrderRank(selectedTeam))} in order</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Available Research Icons: <span className="font-bold text-foreground">{availableResearchIcons}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Remaining: <span className={`font-bold ${remainingIcons < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {remainingIcons}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {remainingIcons < 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You have over-allocated by {Math.abs(remainingIcons)} research icons. Please adjust your allocations.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Technology Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {technologies.map((tech) => {
                const Icon = TECHNOLOGY_ICONS[tech.name] || Microscope;
                const patentHolder = gameState.patents[tech.name];
                const baseCost = tech.researchCost;
                const effectiveCost = selectedTeam
                  ? getTechnologyCostForTeam(selectedTeam, tech.name)
                  : (patentHolder ? Math.max(0, baseCost - 1) : baseCost);
                const currentInvestment = teamProgress?.technologyInvestments[tech.name] || 0;
                const newAllocation = allocations[tech.name] || 0;
                const totalInvestment = currentInvestment + newAllocation;
                const isCompleted = teamProgress?.completedTechnologies.includes(tech.name) || false;
                const progressPercent = Math.min((totalInvestment / effectiveCost) * 100, 100);

                const patentHolderTeam = patentHolder ? gameState.teams.find(t => t.id === patentHolder) : undefined;
                const isPatentOwner = patentHolder === selectedTeam;
                const hasReducedCost = !!patentHolder && (!selectedTeam || !isPatentOwner);

                return (
                  <Card
                    key={tech.name}
                    className={`transition-all ${isCompleted
                      ? 'border-green-500 bg-green-500/5'
                      : isPatentOwner
                        ? 'border-yellow-500 bg-yellow-500/5'
                        : ''
                      }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5" />
                          <CardTitle className="text-base">{tech.name}</CardTitle>
                        </div>
                        {isCompleted && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Cost:</span>
                          {hasReducedCost ? (
                            <>
                              <span className="font-bold text-green-600">{effectiveCost}</span>
                              <span className="text-xs line-through text-muted-foreground">{tech.researchCost}</span>
                            </>
                          ) : (
                            <span className="font-bold">{effectiveCost}</span>
                          )}
                        </div>
                        {patentHolderTeam && (
                          <Badge
                            variant="outline"
                            className="gap-1 text-xs"
                            style={isPatentOwner ? { borderColor: patentHolderTeam.color, color: patentHolderTeam.color } : {}}
                          >
                            <Trophy className="h-3 w-3" />
                            {isPatentOwner ? 'You own patent' : `Patent: ${patentHolderTeam.name}`}
                          </Badge>
                        )}
                        {!patentHolder && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            Patent Available
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {totalInvestment} / {effectiveCost}
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>

                      {currentInvestment > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Previously invested: {currentInvestment}
                        </p>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor={`research-${tech.name}`} className="text-xs">
                          Allocate this round
                        </Label>
                        <Input
                          id={`research-${tech.name}`}
                          type="number"
                          min="0"
                          max={availableThisTeam}
                          value={allocations[tech.name] || ''}
                          onChange={(e) => handleAllocationChange(tech.name, e.target.value)}
                          placeholder="0"
                          disabled={isCompleted || availableThisTeam <= 0 || isReadOnlyMode}
                          className="h-8"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Allocation Summary */}
            {selectedTeam && totalAllocated > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Current Allocations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {Object.entries(allocations)
                      .filter(([_, points]) => points > 0)
                      .map(([tech, points]) => (
                        <div key={tech} className="flex justify-between text-sm">
                          <span className="font-medium">{tech}</span>
                          <span className="text-muted-foreground">{points} icons</span>
                        </div>
                      ))}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total Allocated</span>
                    <span className={remainingIcons < 0 ? 'text-destructive' : ''}>{totalAllocated} / {availableResearchIcons}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConfirmAllocations}
                      disabled={totalAllocated === 0 || remainingIcons < 0 || isReadOnlyMode}
                      className="flex-1"
                    >
                      Confirm Allocations
                    </Button>
                    <Button onClick={handleClearAll} variant="outline" disabled={isReadOnlyMode}>
                      Clear All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Research History */}
            {selectedTeam && teamProgress && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="history">
                  <AccordionTrigger>Research History for {selectedTeamObj?.name}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-5 gap-4 text-sm font-semibold text-muted-foreground border-b pb-2">
                        <span>Technology</span>
                        <span>Cost</span>
                        <span>Invested</span>
                        <span>Remaining</span>
                        <span>Status</span>
                      </div>
                      {technologies.map((tech) => {
                        const invested = teamProgress.technologyInvestments[tech.name] || 0;
                        const cost = getTechnologyCostForTeam(selectedTeam, tech.name);
                        const remaining = Math.max(0, cost - invested);
                        const isComplete = teamProgress.completedTechnologies.includes(tech.name);
                        const patentOwner = gameState.patents[tech.name];
                        const isPatentOwner = patentOwner === selectedTeam;

                        return (
                          <div key={tech.name} className="grid grid-cols-5 gap-4 text-sm py-2 border-b">
                            <span className="font-medium">{tech.name}</span>
                            <span>{cost}</span>
                            <span className="font-semibold">{invested}</span>
                            <span className="text-muted-foreground">{remaining}</span>
                            <div className="flex items-center gap-1">
                              {isComplete ? (
                                <Badge variant="outline" className="gap-1 text-xs bg-green-500/10 border-green-500">
                                  <CheckCircle className="h-3 w-3" />
                                  Complete
                                </Badge>
                              ) : invested > 0 ? (
                                <Badge variant="outline" className="text-xs">
                                  In Progress
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Not Started
                                </Badge>
                              )}
                              {isPatentOwner && (
                                <Trophy className="h-3 w-3 text-yellow-500" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Technologies Summary - shown when all teams have allocated */}
      {allTeamsAllocated && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Microscope className="h-5 w-5" />
                All Technologies Status
              </CardTitle>
              <Badge variant="secondary">All Teams Allocated</Badge>
            </div>
            <CardDescription>
              Complete overview of patents, completed research, and ongoing progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {technologies.map((tech) => {
                const Icon = TECHNOLOGY_ICONS[tech.name] || Microscope;
                const patentHolder = gameState.patents[tech.name];
                const patentHolderTeam = patentHolder ? gameState.teams.find(t => t.id === patentHolder) : undefined;

                // Get all teams with completed research
                const teamsCompleted = gameState.teams.filter(team => {
                  const progress = getTeamResearchProgress(team.id);
                  return progress?.completedTechnologies.includes(tech.name);
                });

                // Get teams with partial progress
                const teamsInProgress = gameState.teams.filter(team => {
                  const progress = getTeamResearchProgress(team.id);
                  const investment = progress?.technologyInvestments[tech.name] || 0;
                  return investment > 0 && !progress?.completedTechnologies.includes(tech.name);
                });

                return (
                  <Card
                    key={tech.name}
                    className={`${patentHolderTeam ? 'border-yellow-500 bg-yellow-500/5' : 'border-primary/30 bg-primary/5'
                      }`}
                  >
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5" />
                            <h4 className="font-semibold">{tech.name}</h4>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Cost: {tech.researchCost} research icons
                          </div>
                        </div>
                      </div>

                      {/* Patent Holder */}
                      {patentHolderTeam ? (
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            Patent Holder:
                          </span>
                          <Badge
                            style={{ backgroundColor: patentHolderTeam.color }}
                            className="text-white gap-1"
                          >
                            <Trophy className="h-3 w-3" />
                            {patentHolderTeam.name}
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Trophy className="h-3 w-3" />
                          Patent Available
                        </Badge>
                      )}

                      {/* Teams with Completed Research */}
                      {teamsCompleted.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Completed:</span>
                          <div className="flex flex-wrap gap-2">
                            {teamsCompleted.map(team => (
                              <Badge
                                key={team.id}
                                style={{ backgroundColor: team.color }}
                                className="text-white gap-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                {team.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Teams In Progress */}
                      {teamsInProgress.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">In Progress:</span>
                          <div className="space-y-1">
                            {teamsInProgress.map(team => {
                              const progress = getTeamResearchProgress(team.id);
                              const investment = progress?.technologyInvestments[tech.name] || 0;
                              const cost = getTechnologyCostForTeam(team.id, tech.name);
                              const progressPercent = (investment / cost) * 100;

                              return (
                                <div key={team.id} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: team.color }}
                                    />
                                    <span className="text-xs">{team.name}</span>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {investment}/{cost}
                                    </span>
                                  </div>
                                  <Progress value={progressPercent} className="h-1" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
