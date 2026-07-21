import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGame } from '@/contexts/GameContext';
import { REGION_CUSTOMERS, Customer } from '@/data/customers';
import { toast } from 'sonner';
import { Save, AlertTriangle, CheckCircle2, Package, Microscope, MapPin, Wifi, Gamepad2, Battery, Radio, Signal, Trophy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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

export const SalesPhase = () => {
  const { gameState, addRoundData, getCurrentRound, getTeamLogisticsProgress, calculatePlayOrder } = useGame();
  const { currentRole, currentTeamId, isReadOnly } = useSession();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (currentTeamId) {
      setSelectedTeam(currentTeamId);
    }
  }, [currentTeamId]);

  if (!gameState) return null;

  const currentRound = getCurrentRound();
  const currentRoundData = gameState.rounds.find(r => r.roundNumber === currentRound);
  const teamsWithData = new Set(Object.keys(currentRoundData?.teamData || {}));
  
  // Calculate play order for teams with products to sell
  const allPlayOrder = calculatePlayOrder(currentRound);
  const playOrder = allPlayOrder.filter(team => {
    const productsProduced = currentRoundData?.teamData[team.id]?.productsProduced || 0;
    return productsProduced > 0;
  });
  
  // Get sold customers in this round
  const soldCustomers = new Set<string>();
  if (currentRoundData) {
    Object.values(currentRoundData.teamData).forEach(data => {
      if (data.customersSold) {
        data.customersSold.forEach(customerId => soldCustomers.add(customerId));
      }
    });
  }
  
  // Get all teams that have completed their production plans
  const teamsWithPlans = useMemo(() => {
    return gameState.teams.filter(t => {
      const hasData = teamsWithData.has(t.id);
      const teamData = currentRoundData?.teamData[t.id];
      return hasData && teamData && teamData.productsProduced !== undefined;
    });
  }, [gameState.teams, teamsWithData, currentRoundData]);

  // Load saved sales into selectedCustomers when selectedTeam changes
  useEffect(() => {
    if (selectedTeam && currentRoundData?.teamData[selectedTeam]?.customersSold) {
      const sold = currentRoundData.teamData[selectedTeam].customersSold || [];
      const grouped: Record<string, string[]> = {};
      
      REGION_CUSTOMERS.forEach(({ region, customers }) => {
        const matching = sold.filter(id => customers.some(c => c.id === id));
        if (matching.length > 0) {
          grouped[region] = matching;
        }
      });
      setSelectedCustomers(grouped);
    } else {
      setSelectedCustomers({});
    }
  }, [selectedTeam, currentRoundData]);

  const selectedTeamData = selectedTeam && currentRoundData?.teamData[selectedTeam];
  const teamName = selectedTeam ? gameState.teams.find(t => t.id === selectedTeam)?.name : '';
  
  // Get team's present regions
  const teamLogistics = selectedTeam ? getTeamLogisticsProgress(selectedTeam) : null;
  const teamRegions = [...(teamLogistics?.regionsWithPresence || [])].sort((a, b) => {
    return REGION_CUSTOMERS.findIndex(r => r.region === a) - 
           REGION_CUSTOMERS.findIndex(r => r.region === b);
  });
  
  // Get team's completed technologies
  const teamResearch = selectedTeam ? gameState.teamResearchProgress[selectedTeam] : null;
  const completedTechs = new Set(teamResearch?.completedTechnologies || []);
  
  // Calculate total products to be sold and revenue
  const totalProductsToSell = Object.values(selectedCustomers).flat().length;
  const calculatedRevenue = selectedTeamData ? selectedTeamData.price * totalProductsToSell : 0;
  const productsAvailable = selectedTeamData?.productsProduced || 0;
  const salesExceedProduction = totalProductsToSell > productsAvailable;

  const isSalesSubmitted = selectedTeamData && !!selectedTeamData.customersSold;

  const allTeamsHavePlans = useMemo(() => {
    return gameState.teams.every(team => 
      teamsWithPlans.some(t => t.id === team.id)
    );
  }, [gameState.teams, teamsWithPlans]);

  if (currentRole === 'STUDENT' && !allTeamsHavePlans) {
    return <PhaseLockCard phaseName="Sales Phase" />;
  }

  const activeSalesTeam = useMemo(() => {
    return playOrder.find(team => {
      const teamData = currentRoundData?.teamData[team.id];
      const produced = teamData?.productsProduced || 0;
      return produced > 0 && !teamData?.customersSold;
    });
  }, [playOrder, currentRoundData]);

  const isMyTurn = currentRole !== 'STUDENT' || (currentTeamId === activeSalesTeam?.id);
  const activePhase = gameState?.currentPhase || 'planning';
  const isReadOnlyMode = isReadOnly || 
                          (currentRole === 'STUDENT' && !allTeamsHavePlans) || 
                          (currentRole === 'STUDENT' && !isMyTurn) || 
                          (currentRole === 'STUDENT' && isSalesSubmitted) ||
                          (currentRole === 'STUDENT' && activePhase !== 'sales');

  const isCustomerEligible = (customer: Customer): boolean => {
    if (!selectedTeamData) return false;
    
    // Eligible if not sold by others (we allow toggling our own sold customers)
    const isSoldByOther = soldCustomers.has(customer.id) && !selectedTeamData.customersSold?.includes(customer.id);
    if (isSoldByOther) return false;
    
    if (customer.type === 'price') {
      return selectedTeamData.price <= (customer.price || 0);
    } else {
      return customer.technology ? completedTechs.has(customer.technology) : false;
    }
  };

  const toggleCustomer = (regionName: string, customerId: string) => {
    setSelectedCustomers(prev => {
      const regionCustomers = prev[regionName] || [];
      const isSelected = regionCustomers.includes(customerId);
      
      if (isSelected) {
        return {
          ...prev,
          [regionName]: regionCustomers.filter(id => id !== customerId)
        };
      } else {
        return {
          ...prev,
          [regionName]: [...regionCustomers, customerId]
        };
      }
    });
  };

  const handleSubmit = () => {
    if (!selectedTeam || salesExceedProduction) {
      if (salesExceedProduction) {
        toast.error(`Cannot sell ${totalProductsToSell} products when only ${productsAvailable} were produced`);
      } else {
        toast.error('Please select a team');
      }
      return;
    }

    if (!selectedTeamData) return;

    const allSelectedCustomers = Object.values(selectedCustomers).flat();

    // Update the existing team data with sales information
    const updatedData = {
      ...selectedTeamData,
      customersSold: allSelectedCustomers,
      revenue: calculatedRevenue,
      totalMoney: (selectedTeamData.totalMoney || 0) - (selectedTeamData.revenue || 0) + calculatedRevenue
    };

    addRoundData(currentRound, selectedTeam, updatedData);
    toast.success(`Sales data saved for ${teamName}`);
    
    // Reset form
    setSelectedTeam('');
    setSelectedCustomers({});
  };

  const allTeamsSubmitted = gameState.teams.every(t => {
    const teamData = currentRoundData?.teamData[t.id];
    if (!teamData) return false; // no plan yet
    const produced = teamData.productsProduced || 0;
    return produced > 0 ? Array.isArray(teamData.customersSold) : true;
  });

  // Get regions with sales for status display
  const getRegionSalesStatus = () => {
    const statusByRegion: Record<string, Array<{ customer: Customer; soldTo?: string }>> = {};
    
    REGION_CUSTOMERS.forEach(({ region, customers }) => {
      statusByRegion[region] = customers.map(customer => {
        // Find which team sold to this customer
        const soldToTeam = currentRoundData ? Object.entries(currentRoundData.teamData).find(([_, data]) => 
          data.customersSold?.includes(customer.id)
        ) : undefined;
        
        return {
          customer,
          soldTo: soldToTeam ? soldToTeam[0] : undefined
        };
      });
    });
    
    return statusByRegion;
  };

  const regionSalesStatus = getRegionSalesStatus();

  return (
    <div className="space-y-6">
      {true && (
        <Card>
          <CardHeader>
            <CardTitle>Round {currentRound} Sales - Sell to Customers</CardTitle>
            <CardDescription>
              {selectedTeam && teamName 
                ? `Selling for ${teamName} - Select customers to sell to` 
                : 'Select a team to begin sales'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Play Order, Products & Technologies Overview */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span>Play Order & Team Inventory (Products & Technologies)</span>
                </h3>
                {activeSalesTeam ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Current Turn: {activeSalesTeam.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-bold gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Sales Complete
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {playOrder.map((team, index) => {
                  const teamData = currentRoundData?.teamData[team.id];
                  const products = teamData?.productsProduced || 0;
                  const techs = teamData?.technologiesResearched || [];
                  const isActiveTurn = team.id === activeSalesTeam?.id;

                  return (
                    <div
                      key={team.id}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-1.5 text-xs transition-all ${
                        isActiveTurn
                          ? 'ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/80 shadow-md animate-pulse'
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
                          <Badge className="bg-emerald-500 text-white text-[9px] px-1 py-0 font-extrabold uppercase">
                            Turn
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 text-[11px] pt-1 border-t border-border/50">
                        <div className="flex justify-between items-center font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Products:</span>
                          <span>{products}</span>
                        </div>
                        <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                          <span className="flex items-center gap-1"><Microscope className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /> Techs ({techs.length}):</span>
                          <span className="truncate text-[10px] font-mono">{techs.length > 0 ? techs.join(', ') : 'None'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {teamsWithPlans.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  All teams must complete their production plans before entering sales data.
                </AlertDescription>
              </Alert>
            )}

            {currentRole === 'STUDENT' && !allTeamsHavePlans && teamsWithPlans.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Waiting for all teams to submit plans. All teams must submit production plans before the sales phase can begin.
                </AlertDescription>
              </Alert>
            )}

            {currentRole === 'STUDENT' && allTeamsHavePlans && !isSalesSubmitted && !isMyTurn && activeSalesTeam && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>It is not your turn yet.</strong> The active turn belongs to <strong>{activeSalesTeam.name}</strong>. Please wait for them to finish their sales.
                </AlertDescription>
              </Alert>
            )}

            {currentRole === 'STUDENT' && allTeamsHavePlans && isSalesSubmitted && (
              <Alert className="border-emerald-500/50 bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                  <strong>Your sales have been submitted.</strong> You sold {totalProductsToSell} products for a total of ${calculatedRevenue.toLocaleString()} revenue. Waiting for other teams to complete their sales.
                </AlertDescription>
              </Alert>
            )}

            {teamsWithPlans.length > 0 && (
              <>
                <div className="space-y-2">
                  <label htmlFor="team-select" className="text-sm font-medium">Select Team</label>
                  <Select value={selectedTeam} onValueChange={(value) => {
                    setSelectedTeam(value);
                    setSelectedCustomers({});
                  }} disabled={currentRole === 'STUDENT'}>
                    <SelectTrigger id="team-select">
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamsWithPlans.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            {team.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTeam && selectedTeamData && (
                  <>
                    <Card className="bg-accent/10 border-accent/30">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Team Summary ({teamName})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <span className="font-bold text-red-500 text-sm">$</span>
                            Price:
                          </span>
                          <div className="font-semibold text-lg">${selectedTeamData.price}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Products Available:</span>
                          <div className="font-semibold text-lg">{productsAvailable}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Products to Sell:</span>
                          <div className={`font-semibold text-lg ${salesExceedProduction ? 'text-destructive' : ''}`}>
                            {totalProductsToSell}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Revenue:</span>
                          <div className="font-semibold text-lg text-primary">${calculatedRevenue.toLocaleString()}</div>
                        </div>
                      </CardContent>
                    </Card>

                    {completedTechs.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm font-medium">Completed Technologies:</span>
                        {Array.from(completedTechs).map(tech => (
                          <Badge key={tech} variant="secondary">{tech}</Badge>
                        ))}
                      </div>
                    )}

                    {salesExceedProduction && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Warning:</strong> Selected sales ({totalProductsToSell}) exceed available products ({productsAvailable}).
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Select Customers (Only Eligible Regions)</h3>
                      
                      {teamRegions.length === 0 && (
                        <Alert>
                          <AlertDescription>
                            This team has no regional presence yet. Expand to regions in the Logistics phase first.
                          </AlertDescription>
                        </Alert>
                      )}

                      {teamRegions.map(regionName => {
                        const regionData = REGION_CUSTOMERS.find(r => r.region === regionName);
                        if (!regionData) return null;

                        return (
                          <Card key={regionName}>
                            <CardHeader>
                              <CardTitle className="text-base">{regionName}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-2">
                                {regionData.customers
                                  .sort((a, b) => a.position - b.position)
                                  .map(customer => {
                                    const isEligible = isCustomerEligible(customer);
                                    const isSoldByOther = soldCustomers.has(customer.id) && !selectedTeamData?.customersSold?.includes(customer.id);
                                    const isSelected = selectedCustomers[regionName]?.includes(customer.id);
                                    const TechIcon = customer.technology ? TECHNOLOGY_ICONS[customer.technology] : null;

                                    return (
                                      <div
                                        key={customer.id}
                                        className={`relative flex items-center justify-center w-12 h-12 rounded-lg transition-all ${
                                          isSoldByOther ? 'opacity-40 cursor-not-allowed' :
                                          isSelected ? 'ring-2 ring-primary ring-offset-2' :
                                          isEligible ? 'cursor-pointer hover:scale-105' :
                                          'opacity-40 cursor-not-allowed'
                                        }`}
                                        onClick={() => {
                                          if (isEligible && !isSoldByOther && !isReadOnlyMode) {
                                            toggleCustomer(regionName, customer.id);
                                          }
                                        }}
                                        title={customer.type === 'price' 
                                          ? `Price Customer - Max ${customer.price}` 
                                          : `Value Customer - Requires ${customer.technology}`}
                                      >
                                        <div className={`w-full h-full flex items-center justify-center rounded-lg ${
                                          customer.type === 'price' ? 'bg-red-600' : 'bg-purple-600'
                                        }`}>
                                          {customer.type === 'price' ? (
                                            <span className="text-white font-bold text-sm">{customer.price}</span>
                                          ) : TechIcon ? (
                                            <TechIcon className="w-6 h-6 text-white" />
                                          ) : null}
                                        </div>
                                        {isSelected && (
                                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        onClick={handleSubmit} 
                        size="lg"
                        disabled={salesExceedProduction || totalProductsToSell === 0 || isReadOnlyMode}
                        className="flex-1"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Submit Sales
                      </Button>
                      <Button
                        onClick={() => {
                          const updatedData = {
                            ...selectedTeamData,
                            customersSold: [],
                            revenue: 0,
                            totalMoney: (selectedTeamData.totalMoney || 0) - (selectedTeamData.revenue || 0)
                          };
                          addRoundData(currentRound, selectedTeam, updatedData);
                          toast.success(`Zero sales recorded for ${teamName}`);
                          setSelectedTeam('');
                          setSelectedCustomers({});
                        }}
                        variant="outline"
                        size="lg"
                        disabled={isReadOnlyMode}
                      >
                        Record Zero Sales
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Regions Sales Status */}
      <Card>
        <CardHeader>
          <CardTitle>All Regions Sales Status</CardTitle>
          <CardDescription>Overview of regional intelligence and customer sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REGION_CUSTOMERS.map(({ region }) => {
              const regionStatus = regionSalesStatus[region];
              const hasSales = regionStatus.some(s => s.soldTo);

              const isAnyTeamActiveInRegion = gameState.teams.some(team => {
                const rd = gameState.regionLogistics[region];
                return rd?.teamsPresent.includes(team.id) || (rd?.teamProgress[team.id] || 0) > 0;
              });

              return (
                <Card key={region} className={hasSales ? 'border-primary/50 flex flex-col' : 'flex flex-col'}>
                  <CardHeader className="pb-1.5 border-b border-border/40 mb-2 px-3 pt-3">
                    <CardTitle className="text-sm">{region}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 px-3 pb-3 flex-1 flex flex-col gap-3">
                    {/* Team Intelligence Section */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Team Activity</span>
                      <div className="bg-secondary/30 rounded-md p-1.5 space-y-1.5">
                        {isAnyTeamActiveInRegion ? gameState.teams.map(team => {
                          const regionData = gameState.regionLogistics[region];
                          const isPresent = regionData?.teamsPresent.includes(team.id);
                          const investedPoints = regionData?.teamProgress[team.id] || 0;
                          const logisticsCost = regionData?.logisticsCost || 1;
                          const isProgressing = investedPoints > 0 && !isPresent;
                          
                          if (!isPresent && !isProgressing) return null;

                          const price = currentRoundData?.teamData[team.id]?.price || 0;
                          const research = gameState.teamResearchProgress[team.id];
                          const completedTechs = research?.completedTechnologies || [];
                          
                          // Get researching techs with their spent/required ratio
                          const researchingTechs = Object.entries(research?.technologyInvestments || {})
                            .filter(([tech, pts]) => pts > 0 && !completedTechs.includes(tech))
                            .map(([tech, pts]) => {
                              const cost = gameState.technologies[tech]?.researchCost || 4;
                              const currentPatentHolder = gameState.patents[tech];
                              const actualCost = currentPatentHolder && currentPatentHolder !== team.id ? Math.max(0, cost - 1) : cost;
                              return { tech, spent: pts, required: actualCost };
                            });

                          return (
                            <div key={team.id} className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }}/>
                                  <span className="font-medium text-xs">{team.name}</span>
                                  {isPresent ? (
                                    <Badge variant="default" className="text-[9px] px-1 py-0 h-4 leading-tight">Present</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 leading-tight">{investedPoints}/{logisticsCost}</Badge>
                                  )}
                                </div>
                                <span className="font-mono text-[10px] bg-background border px-1.5 py-0.5 rounded">${price}</span>
                              </div>
                              
                              {(completedTechs.length > 0 || researchingTechs.length > 0) && (
                                <div className="flex flex-wrap gap-1 items-center pl-3.5 mt-0.5">
                                  {completedTechs.map(tech => {
                                    const TechIcon = TECHNOLOGY_ICONS[tech];
                                    return (
                                      <div key={tech} className="flex items-center gap-1 text-primary text-[9px] bg-primary/10 border border-primary/20 px-1 py-0.5 rounded" title={`${tech} (Completed)`}>
                                        {TechIcon && <TechIcon className="w-2.5 h-2.5" />}
                                        <span className="font-medium">{tech}</span>
                                      </div>
                                    );
                                  })}
                                  {researchingTechs.map(({ tech, spent, required }) => {
                                    const TechIcon = TECHNOLOGY_ICONS[tech];
                                    return (
                                      <div key={tech} className="flex items-center gap-1 text-muted-foreground text-[9px] bg-secondary/50 border border-border px-1 py-0.5 rounded" title={`${tech} (Researching)`}>
                                        {TechIcon && <TechIcon className="w-2.5 h-2.5 opacity-70" />}
                                        <span>{tech} ({spent}/{required})</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }) : (
                          <div className="text-muted-foreground text-center py-2 italic text-[10px]">No teams expanding here yet</div>
                        )}
                      </div>
                    </div>

                    {/* Customers Section */}
                    <div className="space-y-1.5 mt-auto pt-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Region Customers</span>
                      <div className="flex flex-wrap gap-1">
                        {regionStatus
                        .sort((a, b) => a.customer.position - b.customer.position)
                        .map(({ customer, soldTo }) => {
                          const soldToTeam = soldTo ? gameState.teams.find(t => t.id === soldTo) : null;
                          const TechIcon = customer.technology ? TECHNOLOGY_ICONS[customer.technology] : null;

                          return (
                            <div
                              key={customer.id}
                              className="relative flex flex-col items-center gap-0.5"
                              title={customer.type === 'price' 
                                ? `Price Customer - Max ${customer.price}${soldTo ? ` - Sold to ${soldToTeam?.name}` : ''}` 
                                : `Value Customer - Requires ${customer.technology}${soldTo ? ` - Sold to ${soldToTeam?.name}` : ''}`}
                            >
                              <div className={`w-9 h-9 flex items-center justify-center rounded-md ${
                                customer.type === 'price' ? 'bg-red-600' : 'bg-purple-600'
                              } ${!soldTo ? 'opacity-50' : ''}`}>
                                {customer.type === 'price' ? (
                                  <span className="text-white font-bold text-xs">{customer.price}</span>
                                ) : TechIcon ? (
                                  <TechIcon className="w-5 h-5 text-white" />
                                ) : null}
                              </div>
                              {soldTo && soldToTeam && (
                                <div 
                                  className="w-2.5 h-2.5 rounded-full ring-1 ring-background"
                                  style={{ backgroundColor: soldToTeam.color }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Connected Regions Section */}
                    {(() => {
                      const connectedRegions = gameState.regionLogistics[region]?.connectedRegions || [];
                      if (connectedRegions.length > 0) {
                        return (
                          <div className="space-y-1 mt-2 border-t border-border/40 pt-2">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Connected Regions</span>
                            <div className="flex flex-wrap gap-0.5">
                              {connectedRegions.map(connRegion => (
                                <Badge key={connRegion} variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-background/50 text-muted-foreground">
                                  {connRegion}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {allTeamsSubmitted && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            All teams have completed their sales for Round {currentRound}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
