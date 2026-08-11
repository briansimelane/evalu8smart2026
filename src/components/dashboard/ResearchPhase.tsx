import { useState, useEffect, useMemo } from 'react';
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
import { GameIcon } from './GameIcon';
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
import { PhaseLockCard } from './PhaseLockCard';
import { PATENT_POINTS, getPatentPointsForTech } from '@/types/game';

export const ResearchPhase = () => {
  const { gameState, allocateResearch, getTeamResearchProgress, getTechnologyCostForTeam, calculatePlayOrder } = useGame();
  const { currentRole, currentTeamId, isReadOnly, selectTeam } = useSession();
  const activePhase = gameState?.currentPhase || 'planning';
  const isReadOnlyMode = isReadOnly || (currentRole === 'STUDENT' && activePhase !== 'innovation');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  
  useEffect(() => {
    if (currentRole === 'STUDENT' && currentTeamId) {
      setSelectedTeam(currentTeamId);
    } else if (currentTeamId && !selectedTeam) {
      setSelectedTeam(currentTeamId);
    }
  }, [currentTeamId, currentRole, selectedTeam]);

  if (!gameState) return null;

  const currentRoundData = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
  const allTeamsHavePlans = gameState.teams.every(t => !!currentRoundData?.teamData[t.id]);

  if (currentRole === 'STUDENT' && !allTeamsHavePlans) {
    return <PhaseLockCard phaseName="Research Phase" />;
  }
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

      // Auto-select first team with remaining research if none selected (Facilitator mode only)
      if (currentRole !== 'STUDENT' && !selectedTeam && filteredOrder.length > 0) {
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
  }, [gameState?.currentRound, gameState?.teams, gameState?.patents, gameState?.researchAllocatedByRound, calculatePlayOrder, selectedTeam, currentRole]);

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
      const nextId = nextTeam ? nextTeam.id : '';
      if (currentRole !== 'STUDENT' && nextId) {
        setSelectedTeam(nextId);
        selectTeam(nextId);
        if (nextTeam) {
          toast({
            title: "Turn Order",
            description: `Advanced to ${nextTeam.name}`
          });
        }
      }
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

  const activeTurnTeam = useMemo(() => {
    return playOrder.find(t => {
      const icons = currentRoundData?.teamData[t.id]?.researchIcons || 0;
      const spent = allocatedThisRound[t.id] || 0;
      return icons > 0 && spent < icons;
    });
  }, [playOrder, currentRoundData, allocatedThisRound]);

  const isMyTurn = !activeTurnTeam || activeTurnTeam.id === currentTeamId;

  // Helper to render conic pie circle for research progress (matching Viewer TechPanel style)
  const renderTechProgressCircle = (
    team: { id: string; name: string; color: string },
    invested: number,
    cost: number,
    isCompleted: boolean,
    techName: string
  ) => {
    if (isCompleted) {
      return (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-md shrink-0 ring-2 ring-white transition-all"
          style={{ backgroundColor: team.color }}
          title={`${team.name}: ${techName} Completed!`}
        >
          ✓
        </div>
      );
    }

    const fraction = Math.min(1, Math.max(0, invested / cost));
    const degrees = fraction * 360;

    return (
      <div
        className="w-7 h-7 rounded-full border-2 border-slate-400/60 relative shrink-0 shadow-2xs flex items-center justify-center overflow-hidden transition-all duration-300"
        style={{
          borderColor: team.color,
          background: `conic-gradient(${team.color} 0deg ${degrees}deg, #e2e8f0 ${degrees}deg 360deg)`,
        }}
        title={`${team.name}: ${invested}/${cost} Research Icons Invested`}
      >
        {cost > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 24 24">
            {Array.from({ length: cost }).map((_, i) => {
              const angle = (i * 360) / cost;
              const rad = (angle - 90) * (Math.PI / 180);
              const x2 = 12 + 12 * Math.cos(rad);
              const y2 = 12 + 12 * Math.sin(rad);
              return (
                <line key={i} x1="12" y1="12" x2={x2} y2={y2} stroke="#000000" strokeWidth="1.2" />
              );
            })}
          </svg>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!allTeamsAllocated && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GameIcon type="research" size="md" />
                  Research & Development
                </CardTitle>
                <CardDescription>Round {gameState.currentRound} - Allocate research points to technologies</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Play Order & Research Icons Overview */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-warning" />
                  <span>Play Order & Team Research Icons</span>
                </h3>
                {activeTurnTeam ? (
                  <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-bold gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                    Current Turn: {activeTurnTeam.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs font-bold gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Research Complete
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {playOrder.map((team, index) => {
                  const icons = currentRoundData?.teamData[team.id]?.researchIcons || 0;
                  const spent = allocatedThisRound[team.id] || 0;
                  const isActiveTurn = team.id === activeTurnTeam?.id;

                  return (
                    <div
                      key={team.id}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-1 text-xs transition-all ${
                        isActiveTurn
                          ? 'ring-2 ring-purple-500 bg-purple-500/10 border-purple-500/80 shadow-md animate-pulse'
                          : team.id === selectedTeam
                          ? 'ring-2 ring-primary bg-primary/5 shadow-sm border-primary/50'
                          : 'bg-card/60 border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                          <span className="truncate flex items-center gap-1">
                            {index + 1}. {team.name}
                            {team.isBot && <span className="scale-90 text-[10px]">🤖</span>}
                          </span>
                        </div>
                        {isActiveTurn && (
                          gameState?.botThinking?.[team.id] ? (
                            <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded animate-pulse font-bold flex items-center gap-1 shrink-0">
                              Thinking...
                            </span>
                          ) : (
                            <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0 font-extrabold uppercase">
                              Turn
                            </Badge>
                          )
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50 text-muted-foreground">
                        <span className="font-semibold flex items-center gap-1">
                          <GameIcon type="research" size="xs" />
                          {icons} Icons
                        </span>
                        <span>{spent}/{icons} spent</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!isMyTurn && currentRole === 'STUDENT' && (
              <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <AlertDescription className="font-semibold text-sm">
                    Waiting for <strong>{activeTurnTeam?.name}</strong> to complete their research turn before you can allocate.
                  </AlertDescription>
                </div>
              </Alert>
            )}

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
                      ? 'border-success bg-success/5'
                      : isPatentOwner
                        ? 'border-warning bg-warning/5'
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
                          <CheckCircle className="h-5 w-5 text-success" />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm flex-wrap gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Cost:</span>
                            {hasReducedCost ? (
                              <>
                                <span className="font-bold text-success">{effectiveCost}</span>
                                <span className="text-xs line-through text-muted-foreground">{tech.researchCost}</span>
                              </>
                            ) : (
                              <span className="font-bold">{effectiveCost}</span>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20 gap-1 px-2 py-0.5">
                            <Trophy className="h-3 w-3 text-warning" />
                            +{getPatentPointsForTech(tech.name)} Patent Pts
                          </Badge>
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
                          disabled={isCompleted || availableThisTeam <= 0 || isReadOnlyMode || (currentRole === 'STUDENT' && !isMyTurn)}
                          className="h-8"
                        />
                      </div>

                      {/* All Teams Progress Breakdown (Viewer Circles) */}
                      <div className="pt-2.5 border-t border-border/40 space-y-1.5 text-xs">
                        <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">All Teams Progress</span>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          {gameState.teams.map(t => {
                            const p = getTeamResearchProgress(t.id);
                            const inv = p?.technologyInvestments[tech.name] || 0;
                            const c = getTechnologyCostForTeam(t.id, tech.name);
                            const isDone = p?.completedTechnologies.includes(tech.name) || false;

                            return (
                              <div key={t.id} className="flex items-center gap-1.5 bg-secondary/40 rounded-full pr-2.5 pl-0.5 py-0.5 border border-border/50 shadow-2xs">
                                {renderTechProgressCircle(t, inv, c, isDone, tech.name)}
                                <span className="text-[11px] font-bold truncate max-w-[85px]">{t.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono font-bold">
                                  {isDone ? '✓' : `${inv}/${c}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
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
                      disabled={totalAllocated === 0 || remainingIcons < 0 || isReadOnlyMode || (currentRole === 'STUDENT' && !isMyTurn)}
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
                      {technologies.map((tech) => {
                        const invested = teamProgress.technologyInvestments[tech.name] || 0;
                        const cost = getTechnologyCostForTeam(selectedTeam, tech.name);
                        const remaining = Math.max(0, cost - invested);
                        const isComplete = teamProgress.completedTechnologies.includes(tech.name);
                        const patentOwner = gameState.patents[tech.name];
                        const isPatentOwner = patentOwner === selectedTeam;
                        const patentPts = getPatentPointsForTech(tech.name);

                        return (
                          <div key={tech.name} className="grid grid-cols-6 gap-4 text-sm py-2 border-b items-center">
                            <span className="font-medium">{tech.name}</span>
                            <span>{cost}</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">+{patentPts} pts</span>
                            <span className="font-semibold">{invested}</span>
                            <span className="text-muted-foreground">{remaining}</span>
                            <div className="flex items-center gap-1">
                              {isComplete ? (
                                <Badge variant="outline" className="gap-1 text-xs bg-success/10 border-success">
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
                                <Trophy className="h-3 w-3 text-warning" />
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

      {/* All Technologies Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GameIcon type="research" size="sm" />
              All Technologies Status
            </CardTitle>
            {allTeamsAllocated ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs font-bold gap-1">
                Research Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold gap-1">
                Live Overview
              </Badge>
            )}
          </div>
          <CardDescription>
            Complete overview of patents, completed research, and ongoing progress across all teams
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
                    className={`${patentHolderTeam ? 'border-warning bg-warning/5' : 'border-primary/30 bg-primary/5'
                      }`}
                  >
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5" />
                            <h4 className="font-semibold">{tech.name}</h4>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>Cost: {tech.researchCost} research icons</span>
                            <span>•</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Trophy className="h-3 w-3" />
                              +{getPatentPointsForTech(tech.name)} Patent Pts
                            </span>
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

                      {/* All Teams Progress Circles Grid */}
                      <div className="space-y-1.5 pt-2 border-t border-border/40">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Team Progress Circles</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {gameState.teams.map(team => {
                            const progress = getTeamResearchProgress(team.id);
                            const investment = progress?.technologyInvestments[tech.name] || 0;
                            const isCompleted = progress?.completedTechnologies.includes(tech.name) || false;
                            const cost = getTechnologyCostForTeam(team.id, tech.name);

                            return (
                              <div
                                key={team.id}
                                className={`p-1.5 rounded-lg border flex items-center gap-2 text-xs transition-all ${
                                  isCompleted
                                    ? 'bg-success/10 border-success/30'
                                    : investment > 0
                                    ? 'bg-secondary/40 border-border'
                                    : 'bg-card/50 border-border/40 opacity-70'
                                }`}
                              >
                                {renderTechProgressCircle(team, investment, cost, isCompleted, tech.name)}
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-[11px] font-bold truncate">{team.name}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono font-bold">
                                    {isCompleted ? 'Completed' : `${investment}/${cost}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
    </div>
  );
};
