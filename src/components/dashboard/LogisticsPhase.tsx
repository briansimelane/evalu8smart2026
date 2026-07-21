import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Truck, MapPin, Users, Link2, CheckCircle, XCircle, Trophy, Wifi, Gamepad2, Battery, Radio, Signal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getControlPointsForRegion } from '@/data/control';
import { REGION_CUSTOMERS } from '@/data/customers';
import { useSession } from '@/contexts/SessionContext';
import { PhaseLockCard } from './PhaseLockCard';

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
  const { currentRole, currentTeamId, isReadOnly } = useSession();
  const activePhase = gameState?.currentPhase || 'planning';
  const isReadOnlyMode = isReadOnly || (currentRole === 'STUDENT' && activePhase !== 'expansion');
  const { toast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  useEffect(() => {
    if (currentTeamId) {
      setSelectedTeam(currentTeamId);
    }
  }, [currentTeamId]);

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
    return gameState.logisticsAllocatedByRound[currentRound]?.[selectedTeam] || 0;
  }, [selectedTeam, gameState, currentRound]);

  // Calculate total allocated in current session
  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + val, 0);
  }, [allocations]);

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
      const spent = gameState.logisticsAllocatedByRound[currentRound]?.[team.id] || 0;
      return spent >= icons;
    });
  }, [playOrder, currentRoundData, gameState, currentRound]);

  // Get regions team can expand to
  const availableRegions = useMemo(() => {
    if (!selectedTeam) return [];
    
    return Object.values(gameState.regionLogistics).filter(region => {
      // Show if team can expand OR already has presence OR has partial investment
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

  const handleAllocationChange = (regionName: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setAllocations(prev => ({
      ...prev,
      [regionName]: Math.max(0, numValue)
    }));
  };

  const handleConfirm = useCallback(() => {
    if (!selectedTeam) return;

    if (totalAllocated > availableThisTeam) {
      toast({
        title: "Insufficient Icons",
        description: `You only have ${availableThisTeam} logistics icons remaining.`,
        variant: "destructive"
      });
      return;
    }

    // Apply all allocations
    Object.entries(allocations).forEach(([regionName, points]) => {
      if (points > 0) {
        allocateLogistics(selectedTeam, regionName, points);
      }
    });

    // Check for completed regions
    const completedRegions: string[] = [];
    Object.entries(allocations).forEach(([regionName, points]) => {
      if (points > 0) {
        const currentInvestment = teamProgress?.regionInvestments[regionName] || 0;
        const region = gameState.regionLogistics[regionName];
        if (region && currentInvestment + points >= region.logisticsCost && !regionsWithPresence.includes(regionName)) {
          completedRegions.push(regionName);
        }
      }
    });

    if (completedRegions.length > 0) {
      toast({
        title: "Regions Established!",
        description: `Your team now has presence in: ${completedRegions.join(', ')}`,
      });
    } else {
      toast({
        title: "Allocation Confirmed",
        description: `${totalAllocated} logistics icons allocated successfully.`,
      });
    }

    setAllocations({});
  }, [selectedTeam, allocations, totalAllocated, availableThisTeam, allocateLogistics, teamProgress, regionsWithPresence, gameState, toast]);

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

  return (
    <div className="space-y-6">
      {!allTeamsAllocated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Logistics Phase - Round {currentRound}
            </CardTitle>
            <CardDescription>
              Expand your company's presence to new regions. You can only expand to regions connected to where you already have offices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Play Order & Logistics Icons Overview */}
            {(() => {
              const activeTurnTeam = playOrder.find(t => {
                const icons = currentRoundData?.teamData[t.id]?.logisticsIcons || 0;
                const spent = gameState.logisticsAllocatedByRound[currentRound]?.[t.id] || 0;
                return icons > 0 && spent < icons;
              });

              return (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span>Play Order & Team Logistics Icons</span>
                    </h3>
                    {activeTurnTeam ? (
                      <Badge className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-bold gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                        Current Turn: {activeTurnTeam.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-bold gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Logistics Complete
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {playOrder.map((team, index) => {
                      const icons = currentRoundData?.teamData[team.id]?.logisticsIcons || 0;
                      const spent = gameState.logisticsAllocatedByRound[currentRound]?.[team.id] || 0;
                      const isActiveTurn = team.id === activeTurnTeam?.id;

                      return (
                        <div
                          key={team.id}
                          className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-1 text-xs transition-all ${
                            isActiveTurn
                              ? 'ring-2 ring-cyan-500 bg-cyan-500/10 border-cyan-500/80 shadow-md animate-pulse'
                              : team.id === selectedTeam
                              ? 'ring-2 ring-blue-500 bg-blue-500/5 shadow-sm border-blue-500/50'
                              : 'bg-card/60 border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                              <span className="truncate">{index + 1}. {team.name}</span>
                            </div>
                            {isActiveTurn && (
                              <Badge className="bg-cyan-600 text-white text-[9px] px-1 py-0 font-extrabold uppercase">
                                Turn
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50 text-muted-foreground">
                            <span className="font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                              <Truck className="h-3.5 w-3.5" />
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
                const spent = iconsSpentThisRound;
                const hasRemaining = selectedTeam === team.id ? spent < icons : (gameState.logisticsAllocatedByRound[currentRound]?.[team.id] || 0) < icons;
                
                // Hide teams that have already allocated all their logistics
                if (!hasRemaining && (gameState.logisticsAllocatedByRound[currentRound]?.[team.id] || 0) > 0) return null;
                
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
                <p className="text-2xl font-bold">{iconsSpentThisRound}</p>
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
                  const status = getRegionStatus(region.name);
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
                        status === 'present' ? 'border-green-500 bg-green-500/5' :
                        status === 'available' ? 'border-blue-500 bg-blue-500/5' :
                        status === 'in-progress' ? 'border-yellow-500 bg-yellow-500/5' :
                        'border-muted bg-muted/20'
                      }`}
                    >
                      <CardContent className="pt-4 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{region.name}</h4>
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
                                  <span className="flex items-center gap-1">
                                    <Truck className="h-3 w-3" />
                                    Cost: {region.logisticsCost}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {region.teamsPresent.length}/{region.maxTeams} teams
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3 text-amber-500" />
                                    Control: {getControlPointsForRegion(region.name, region.teamsPresent.length, 'first')} / {getControlPointsForRegion(region.name, region.teamsPresent.length, 'second')}
                                  </span>
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

                        {/* Teams Present */}
                        {teamsInRegion.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Teams:</span>
                            <div className="flex gap-1">
                              {teamsInRegion.map(team => (
                                <div
                                  key={team?.id}
                                  className="w-4 h-4 rounded-full border-2 border-background"
                                  style={{ backgroundColor: team?.color }}
                                  title={team?.name}
                                />
                              ))}
                            </div>
                          </div>
                        )}

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
                        {status !== 'unavailable' && status !== 'present' && !isFull && (
                          <div className="flex items-center gap-2 pt-2">
                            <label className="text-sm font-medium">Allocate:</label>
                            <Input
                              type="number"
                              min="0"
                              max={iconsRemaining}
                              value={allocations[region.name] || ''}
                              onChange={(e) => handleAllocationChange(region.name, e.target.value)}
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
                                        customer.type === 'price' ? 'bg-red-600' : 'bg-purple-600'
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
                onClick={handleConfirm}
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
      </CardContent>
    </Card>
      )}

      {/* All Regions Summary - shown when all teams have allocated */}
      {allTeamsAllocated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              All Regions Status
            </CardTitle>
            <CardDescription>
              Summary of all teams' logistics presence and progress across regions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Badge variant="secondary">All Teams Allocated</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(gameState.regionLogistics)
                .sort((a, b) => REGION_CUSTOMERS.findIndex(r => r.region === a.name) - REGION_CUSTOMERS.findIndex(r => r.region === b.name))
                .map(region => {
                const isFull = isRegionFull(region.name);
                const teamsInRegion = region.teamsPresent.map(tid => 
                  gameState.teams.find(t => t.id === tid)
                ).filter(Boolean);

                // Get teams with partial progress
                const teamsInProgress = gameState.teams.filter(team => {
                  const progress = getTeamLogisticsProgress(team.id);
                  const investment = progress?.regionInvestments[region.name] || 0;
                  return investment > 0 && !region.teamsPresent.includes(team.id);
                });

                return (
                  <Card
                    key={region.name}
                    className={`${
                      isFull ? 'border-muted bg-muted/20' : 'border-primary/30 bg-primary/5'
                    }`}
                  >
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{region.name}</h4>
                            {isFull && (
                              <Badge variant="secondary">Full</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              Cost: {region.logisticsCost}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {region.teamsPresent.length}/{region.maxTeams} teams
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Teams Present */}
                      {teamsInRegion.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Teams Present:</span>
                          <div className="flex flex-wrap gap-2">
                            {teamsInRegion.map(team => (
                              <Badge
                                key={team?.id}
                                style={{ backgroundColor: team?.color }}
                                className="text-white gap-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                {team?.name}
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
                              const progress = getTeamLogisticsProgress(team.id);
                              const investment = progress?.regionInvestments[region.name] || 0;
                              const progressPercent = (investment / region.logisticsCost) * 100;
                              
                              return (
                                <div key={team.id} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: team.color }}
                                    />
                                    <span className="text-xs">{team.name}</span>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {investment}/{region.logisticsCost}
                                    </span>
                                  </div>
                                  <Progress value={progressPercent} className="h-1" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

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
                                      customer.type === 'price' ? 'bg-red-600' : 'bg-purple-600'
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
      )}
    </div>
  );
};
