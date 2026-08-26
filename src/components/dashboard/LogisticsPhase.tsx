import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Truck, MapPin, Users, Link2, CheckCircle, XCircle, Trophy, Wifi, Gamepad2, Battery, Radio, Signal, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GameIcon } from './GameIcon';
import { SteveIcon } from './SteveIcon';
import { useToast } from '@/hooks/use-toast';
import { getControlPointsForRegion } from '@/data/control';
import { REGION_CUSTOMERS } from '@/data/customers';
import { useSession } from '@/contexts/SessionContext';
import { PhaseLockCard } from './PhaseLockCard';
import { isSteveBlocking as isSteveBlockingRule } from '@/lib/rules';
import { isRuleActiveForTeam } from '@/lib/defaultRules';

const TECHNOLOGY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'GPS': MapPin,
  'Wifi': Wifi,
  'Gaming': Gamepad2,
  'Battery': Battery,
  'NFC': Radio,
  '4G': Signal,
};

export const LogisticsPhase = () => {
  const { gameState, allocateLogistics, getTeamLogisticsProgress, canExpandToRegion, isRegionFull, calculatePlayOrder } = useGame();
  const { currentRole, currentTeamId, isReadOnly, selectTeam } = useSession();
  const activePhase = gameState?.currentPhase || 'planning';
  const isReadOnlyMode = isReadOnly || (currentRole === 'STUDENT' && activePhase !== 'expansion');
  const { toast } = useToast();
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

  const currentRound = gameState.currentRound;
  const currentRoundData = gameState.rounds.find(r => r.roundNumber === currentRound);
  const allTeamsHavePlans = gameState.teams.every(t => !!currentRoundData?.teamData[t.id]);

  if (currentRole === 'STUDENT' && !allTeamsHavePlans) {
    return <PhaseLockCard phaseName="Logistics Phase" />;
  }
  
  // Filter play order to only include teams with logistics icons > 0
  const allPlayOrder = calculatePlayOrder(currentRound);
  const playOrder = allPlayOrder.filter(team => {
    const icons = currentRoundData?.teamData[team.id]?.logisticsIcons || 0;
    return icons > 0;
  });

  // Get logistics icons available for selected team
  const teamLogisticsIcons = useMemo(() => {
    if (!selectedTeam) return 0;
    return currentRoundData?.teamData[selectedTeam]?.logisticsIcons || 0;
  }, [selectedTeam, currentRoundData]);

  // Get icons already spent this round
  const iconsSpentThisRound = useMemo(() => {
    if (!selectedTeam) return 0;
    return (gameState.logisticsAllocatedByRound || {})[currentRound]?.[selectedTeam] || 0;
  }, [selectedTeam, gameState, currentRound]);

  // Calculate total allocated in current session (pending in input boxes)
  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + val, 0);
  }, [allocations]);

  const totalSpentThisRound = iconsSpentThisRound + totalAllocated;
  const availableThisTeam = teamLogisticsIcons - iconsSpentThisRound;
  const iconsRemaining = availableThisTeam - totalAllocated;

  const teamProgress = useMemo(() => {
    if (!selectedTeam) return undefined;
    return getTeamLogisticsProgress(selectedTeam);
  }, [selectedTeam, getTeamLogisticsProgress]);

  const regionsWithPresence = teamProgress?.regionsWithPresence || [];

  // Check if all teams with logistics icons have fully allocated
  const allTeamsAllocated = useMemo(() => {
    return playOrder.every(team => {
      const icons = currentRoundData?.teamData[team.id]?.logisticsIcons || 0;
      const spent = (gameState.logisticsAllocatedByRound || {})[currentRound]?.[team.id] || 0;
      return spent >= icons;
    });
  }, [playOrder, currentRoundData, gameState, currentRound]);

  // Get regions team can expand to
  const availableRegions = useMemo(() => {
    if (!selectedTeam) return [];
    
    return Object.values(gameState.regionLogistics).filter(region => {
      const hasPresence = regionsWithPresence.includes(region.name);
      const hasInvestment = (teamProgress?.regionInvestments[region.name] || 0) > 0;
      const canExpand = canExpandToRegion(selectedTeam, region.name);
      
      return hasPresence || hasInvestment || canExpand;
    }).sort((a, b) => {
      const aIndex = REGION_CUSTOMERS.findIndex(r => r.region === a.name);
      const bIndex = REGION_CUSTOMERS.findIndex(r => r.region === b.name);
      return aIndex - bIndex;
    });
  }, [selectedTeam, gameState, regionsWithPresence, teamProgress, canExpandToRegion]);

  const handleAllocateChange = (regionName: string, value: string) => {
    const val = parseInt(value) || 0;
    if (val < 0) return;
    
    // Check if adding this allocation exceeds available icons
    const currentAlloc = allocations[regionName] || 0;
    const diff = val - currentAlloc;
    
    if (diff > iconsRemaining) {
      toast({
        title: "Limit Exceeded",
        description: `You only have ${iconsRemaining} logistics icons remaining to allocate.`,
        variant: "destructive"
      });
      return;
    }
    
    setAllocations(prev => ({
      ...prev,
      [regionName]: val
    }));
  };

  const handleConfirmAllocations = useCallback(() => {
    if (!selectedTeam) return;

    if (totalAllocated > availableThisTeam) {
      toast({
        title: "Insufficient Icons",
        description: `You only have ${availableThisTeam} logistics icons remaining.`,
        variant: "destructive"
      });
      return;
    }

    Object.entries(allocations).forEach(([regionName, points]) => {
      if (points > 0) {
        allocateLogistics(selectedTeam, regionName, points);
      }
    });

    toast({
      title: "Allocation Confirmed",
      description: `${totalAllocated} logistics icons allocated successfully.`,
    });

    setAllocations({});
  }, [selectedTeam, allocations, totalAllocated, availableThisTeam, allocateLogistics, toast]);

  const handleClear = () => {
    setAllocations({});
  };

  const getRegionStatus = (regionName: string) => {
    if (!selectedTeam) return 'unavailable';
    
    const hasPresence = regionsWithPresence.includes(regionName);
    if (hasPresence) return 'present';
    
    const canExpand = canExpandToRegion(selectedTeam, regionName);
    if (!canExpand) return 'unavailable';
    
    const hasInvestment = (teamProgress?.regionInvestments[regionName] || 0) > 0;
    if (hasInvestment) return 'in-progress';
    
    return 'available';
  };

  // Helper to render conic pie circle for logistics progress (matching Viewer RegionCard style)
  const renderLogisticsProgressCircle = (
    team: { id: string; name: string; color: string },
    invested: number,
    cost: number,
    isPresent: boolean
  ) => {
    if (isPresent) {
      return (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-md shrink-0 ring-2 ring-white transition-all"
          style={{ backgroundColor: team.color }}
          title={`${team.name}: Present in Region`}
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
        title={`${team.name}: ${invested}/${cost} Logistics Icons Invested`}
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
      {/* Warning if not all teams have submitted plans */}
      {!allTeamsHavePlans && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Not all teams have submitted their plans yet. All teams must submit plans before logistics can be allocated.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <GameIcon type="logistics" size="lg" />
            Logistics Phase - Round {currentRound}
          </h2>
          <p className="text-muted-foreground mt-1">
            Allocate logistics icons to expand into new regions. Presence allows selling to customers in that region.
          </p>
        </div>
      </div>

      {/* Play Order & Team Logistics Icons Overview */}
      {(() => {
        const activeTurnTeam = playOrder.find(t => {
          const icons = currentRoundData?.teamData[t.id]?.logisticsIcons || 0;
          const spent = (gameState.logisticsAllocatedByRound || {})[currentRound]?.[t.id] || 0;
          return icons > 0 && spent < icons;
        });

        return (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-warning" />
                <span>Play Order & Team Logistics Icons</span>
              </h3>
              {activeTurnTeam ? (
                <Badge className="bg-primary/15 text-cyan-700 dark:text-cyan-300 border border-primary/30 text-xs font-bold gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  Current Turn: {activeTurnTeam.name}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs font-bold gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Logistics Complete
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {playOrder.map((team, index) => {
                const icons = currentRoundData?.teamData[team.id]?.logisticsIcons || 0;
                const spent = (gameState.logisticsAllocatedByRound || {})[currentRound]?.[team.id] || 0;
                const isActiveTurn = team.id === activeTurnTeam?.id;

                return (
                  <div
                    key={team.id}
                    className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-1 text-xs transition-all ${
                      isActiveTurn
                        ? 'ring-2 ring-primary bg-primary/10 border-primary/80 shadow-md animate-pulse'
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
                          <Badge className="bg-primary text-white text-[9px] px-1 py-0 font-extrabold uppercase">
                            Turn
                          </Badge>
                        )
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50 text-muted-foreground">
                      <span className="font-semibold flex items-center gap-1">
                        <GameIcon type="logistics" size="xs" />
                        {icons} Icons
                      </span>
                      <span>{spent}/{icons} spent</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Team Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Team</label>
        <Select value={selectedTeam} onValueChange={setSelectedTeam} disabled={currentRole === 'STUDENT'}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a team..." />
          </SelectTrigger>
          <SelectContent>
            {playOrder.map(team => {
              const icons = currentRoundData?.teamData[team.id]?.logisticsIcons || 0;
              const teamSpent = (gameState.logisticsAllocatedByRound || {})[currentRound]?.[team.id] || 0;
              const hasRemaining = teamSpent < icons;
              
              if (!hasRemaining && teamSpent > 0 && team.id !== selectedTeam) return null;
              
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

      {selectedTeam && (
        <>
          {/* Current Presence */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Current Presence
            </h3>
            <div className="flex flex-wrap gap-2">
              {regionsWithPresence.length > 0 ? (
                regionsWithPresence.map(region => (
                  <Badge key={region} variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {region}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No regions established yet</p>
              )}
            </div>
          </div>

          {/* Logistics Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/20 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-2xl font-bold">{teamLogisticsIcons}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Spent This Round</p>
              <p className="text-2xl font-bold">{totalSpentThisRound}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-2xl font-bold text-primary">{iconsRemaining}</p>
            </div>
          </div>

          {/* Available Regions Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Regions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableRegions.map(region => {
                const isSteveBlocking = isSteveBlockingRule(gameState, region.name, selectedTeam);
                const status = isSteveBlocking ? 'unavailable' : getRegionStatus(region.name);
                const currentInvestment = teamProgress?.regionInvestments[region.name] || 0;
                const progressPercent = (currentInvestment / region.logisticsCost) * 100;
                const isFull = isRegionFull(region.name);
                const teamsInRegion = region.teamsPresent.map(tid => 
                  gameState.teams.find(t => t.id === tid)
                ).filter(Boolean);

                return (
                  <Card
                    key={region.name}
                    className={`${
                      isSteveBlocking ? 'border-red-500 bg-red-950/10 ring-2 ring-red-500/40' :
                      status === 'present' ? 'border-success bg-success/5' :
                      status === 'available' ? 'border-primary bg-primary/5' :
                      status === 'in-progress' ? 'border-warning bg-warning/5' :
                      'border-muted bg-muted/20'
                    }`}
                  >
                    <CardContent className="pt-4 space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{region.name}</h4>
                                {isSteveBlocking && (
                                  <Badge className="bg-red-950 text-red-300 border border-red-500/50 text-xs font-bold gap-1 [animation:pulse_1s_cubic-bezier(0.4,0,0.6,1)_3]">
                                    <SteveIcon size={14} />
                                    BLOCKED
                                  </Badge>
                                )}
                                {status === 'present' && (
                                  <Badge variant="default" className="gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Present
                                  </Badge>
                                )}
                                {status === 'unavailable' && (
                                  <Badge variant="destructive" className="gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Not Connected
                                  </Badge>
                                )}
                                {isFull && status !== 'present' && (
                                  <Badge variant="secondary">Full</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1 font-medium">
                                  <Truck className="h-3.5 w-3.5" />
                                  Logistics Cost: <strong className="text-foreground">{region.logisticsCost}</strong>
                                </span>
                                {isRuleActiveForTeam(gameState?.ruleAdjustments, 'multiple_offices_per_region', selectedTeam) ? (() => {
                                  const rl = gameState?.regionLogistics?.[region.name];
                                  const total = Object.values(rl?.officeCounts || {}).reduce((a, b) => a + Number(b), 0);
                                  const mine = rl?.officeCounts?.[selectedTeam] || 0;
                                  return (
                                    <span className="flex items-center gap-1 font-medium">
                                      <Users className="h-3.5 w-3.5 text-indigo-500" />
                                      Offices: <strong className="text-foreground">{mine} yours · {total}/{rl?.maxTeams ?? region.maxTeams} filled</strong>
                                    </span>
                                  );
                                })() : (
                                  <span className="flex items-center gap-1 font-medium">
                                    <Users className="h-3.5 w-3.5" />
                                    Presence: <strong className="text-foreground">{region.teamsPresent.length}/{region.maxTeams} teams</strong>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-xs font-semibold text-muted-foreground">Control Points:</span>
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold gap-1 px-2 py-0.5">
                                  <Trophy className="h-3 w-3 text-warning" />
                                  1st Place: +{getControlPointsForRegion(region.name, Math.max(1, region.teamsPresent.length), 'first')} pts
                                </Badge>
                                {getControlPointsForRegion(region.name, Math.max(1, region.teamsPresent.length), 'second') > 0 && (
                                  <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/30 text-xs font-bold gap-1 px-2 py-0.5">
                                    2nd Place: +{getControlPointsForRegion(region.name, Math.max(1, region.teamsPresent.length), 'second')} pts
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                      {/* Progress Bar */}
                      {currentInvestment > 0 && status !== 'present' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{currentInvestment} / {region.logisticsCost}</span>
                          </div>
                          <Progress value={progressPercent} />
                        </div>
                      )}

                      {/* All Teams Logistics Progress & Presence Breakdown */}
                      <div className="space-y-1.5 pt-2 border-t border-border/40 text-xs">
                        <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">All Teams Presence & Progress</span>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          {gameState.teams.map(team => {
                            const isPresent = region.teamsPresent.includes(team.id);
                            const progress = getTeamLogisticsProgress(team.id);
                            const invested = progress?.regionInvestments[region.name] || 0;

                            return (
                              <div key={team.id} className="flex items-center gap-1.5 bg-secondary/40 rounded-full pr-2.5 pl-0.5 py-0.5 border border-border/50 shadow-2xs">
                                {renderLogisticsProgressCircle(team, invested, region.logisticsCost, isPresent)}
                                <span className="text-[11px] font-bold truncate max-w-[85px]">{team.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono font-bold">
                                  {isPresent ? 'Present' : `${invested}/${region.logisticsCost}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Connected Regions */}
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          Connected to:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {region.connectedRegions.map(connectedRegion => {
                            const hasPresenceInConnected = regionsWithPresence.includes(connectedRegion);
                            return (
                              <Badge
                                key={connectedRegion}
                                variant={hasPresenceInConnected ? "default" : "outline"}
                                className="text-xs"
                              >
                                {connectedRegion}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Allocation Input */}
                      {isSteveBlocking ? (
                        <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/40 flex items-center gap-2 text-xs text-red-700 dark:text-red-300 font-bold pt-2 mt-2">
                          <SteveIcon size={16} />
                          <span>Steve is blocking expansion into {region.name}! (5 Wildcard Tokens required to clear Steve)</span>
                        </div>
                      ) : status !== 'unavailable' && status !== 'present' && !isFull && (
                        <div className="flex items-center gap-2 pt-2">
                          <label className="text-sm font-medium">Allocate:</label>
                          <Input
                            type="number"
                            min="0"
                            max={iconsRemaining}
                            value={allocations[region.name] || ''}
                            onChange={(e) => handleAllocateChange(region.name, e.target.value)}
                            className="w-20"
                            disabled={isReadOnlyMode}
                          />
                          <span className="text-xs text-muted-foreground">
                            icons (need {Math.max(0, region.logisticsCost - currentInvestment)} more to complete)
                          </span>
                        </div>
                      )}

                      {/* Customers Section */}
                      {(() => {
                        const regionCustomerData = REGION_CUSTOMERS.find(r => r.region === region.name);
                        if (!regionCustomerData) return null;
                        
                        return (
                          <div className="space-y-1.5 mt-auto pt-3 border-t border-border/40">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Region Customers</span>
                            <div className="flex flex-wrap gap-1">
                              {regionCustomerData.customers
                              .sort((a, b) => a.position - b.position)
                              .map(customer => {
                                const TechIcon = customer.technology ? TECHNOLOGY_ICONS[customer.technology] : null;

                                return (
                                  <div
                                    key={customer.id}
                                    className="relative flex flex-col items-center gap-0.5"
                                    title={customer.type === 'price' 
                                      ? `Price Customer - Max ${customer.price}` 
                                      : `Value Customer - Requires ${customer.technology}`}
                                  >
                                    <div className={`w-9 h-9 flex items-center justify-center rounded-md opacity-50 ${
                                      customer.type === 'price' ? 'bg-destructive' : 'bg-purple-600'
                                    }`}>
                                      {customer.type === 'price' ? (
                                        <span className="text-white font-bold text-xs">{customer.price}</span>
                                      ) : TechIcon ? (
                                        <TechIcon className="w-5 h-5 text-white" />
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleConfirmAllocations}
              disabled={totalAllocated === 0 || totalAllocated > availableThisTeam || isReadOnlyMode}
              className="flex-1"
            >
              Confirm Allocation ({totalAllocated} icons)
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              disabled={totalAllocated === 0 || isReadOnlyMode}
            >
              Clear
            </Button>
          </div>
        </>
      )}

      {!selectedTeam && (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Select a team to begin logistics allocation</p>
        </div>
      )}

      {/* All Regions Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              All Regions Status
            </CardTitle>
            {allTeamsAllocated ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs font-bold gap-1">
                Logistics Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold gap-1">
                Live Overview
              </Badge>
            )}
          </div>
          <CardDescription>
            Summary of all teams' logistics presence and progress across regions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(gameState.regionLogistics)
              .sort((a, b) => REGION_CUSTOMERS.findIndex(r => r.region === a.name) - REGION_CUSTOMERS.findIndex(r => r.region === b.name))
              .map(region => {
              const isSteveBlocking = isSteveBlockingRule(gameState, region.name);
              const isFull = isRegionFull(region.name);

              return (
                <Card
                  key={region.name}
                  className={`${
                    isSteveBlocking ? 'border-red-500 bg-red-950/10 ring-2 ring-red-500/40' :
                    isFull ? 'border-muted bg-muted/20' : 'border-primary/30 bg-primary/5'
                  }`}
                >
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{region.name}</h4>
                          {isSteveBlocking && (
                            <Badge className="bg-red-950 text-red-300 border border-red-500/50 text-[10px] flex items-center gap-1 font-bold [animation:pulse_1s_cubic-bezier(0.4,0,0.6,1)_3]">
                              <SteveIcon size={12} /> BLOCKED
                            </Badge>
                          )}
                          {isFull && (
                            <Badge variant="secondary">Full</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 font-medium">
                            <Truck className="h-3 w-3" />
                            Cost: {region.logisticsCost}
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <Users className="h-3 w-3" />
                            {region.teamsPresent.length}/{region.maxTeams} teams
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold gap-1 px-1.5 py-0">
                            <Trophy className="h-3 w-3 text-warning" />
                            1st: +{getControlPointsForRegion(region.name, Math.max(1, region.teamsPresent.length), 'first')} pts
                          </Badge>
                          {getControlPointsForRegion(region.name, Math.max(1, region.teamsPresent.length), 'second') > 0 && (
                            <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/30 text-[10px] font-bold px-1.5 py-0">
                              2nd: +{getControlPointsForRegion(region.name, Math.max(1, region.teamsPresent.length), 'second')} pts
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* All Teams Logistics Progress & Presence Circles Grid */}
                    <div className="space-y-1.5 pt-2 border-t border-border/40">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Team Presence & Progress</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {gameState.teams.map(team => {
                          const isPresent = region.teamsPresent.includes(team.id);
                          const progress = getTeamLogisticsProgress(team.id);
                          const investment = progress?.regionInvestments[region.name] || 0;

                          return (
                            <div
                              key={team.id}
                              className={`p-1.5 rounded-lg border flex items-center gap-2 text-xs transition-all ${
                                isPresent
                                  ? 'bg-success/10 border-success/30'
                                  : investment > 0
                                  ? 'bg-secondary/40 border-border'
                                  : 'bg-card/50 border-border/40 opacity-70'
                              }`}
                            >
                              {renderLogisticsProgressCircle(team, investment, region.logisticsCost, isPresent)}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-[11px] font-bold truncate">{team.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono font-bold">
                                  {isPresent ? 'Present' : `${investment}/${region.logisticsCost}`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                      {/* Connected Regions */}
                       <div className="space-y-1">
                         <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                           <Link2 className="h-3 w-3" />
                           Connected to:
                         </span>
                         <div className="flex flex-wrap gap-1">
                           {region.connectedRegions.map(connectedRegion => (
                             <Badge
                               key={connectedRegion}
                               variant="outline"
                               className="text-xs"
                             >
                               {connectedRegion}
                             </Badge>
                           ))}
                         </div>
                       </div>

                      {/* Customers Section */}
                      {(() => {
                        const regionCustomerData = REGION_CUSTOMERS.find(r => r.region === region.name);
                        if (!regionCustomerData) return null;
                        
                        return (
                          <div className="space-y-1.5 mt-auto pt-3 border-t border-border/40">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Region Customers</span>
                            <div className="flex flex-wrap gap-1">
                              {regionCustomerData.customers
                              .sort((a, b) => a.position - b.position)
                              .map(customer => {
                                const TechIcon = customer.technology ? TECHNOLOGY_ICONS[customer.technology] : null;

                                return (
                                  <div
                                    key={customer.id}
                                    className="relative flex flex-col items-center gap-0.5"
                                    title={customer.type === 'price' 
                                      ? `Price Customer - Max ${customer.price}` 
                                      : `Value Customer - Requires ${customer.technology}`}
                                  >
                                    <div className={`w-9 h-9 flex items-center justify-center rounded-md opacity-50 ${
                                      customer.type === 'price' ? 'bg-destructive' : 'bg-purple-600'
                                    }`}>
                                      {customer.type === 'price' ? (
                                        <span className="text-white font-bold text-xs">{customer.price}</span>
                                      ) : TechIcon ? (
                                        <TechIcon className="w-5 h-5 text-white" />
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
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
