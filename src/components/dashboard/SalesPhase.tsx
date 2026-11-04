import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGame } from '@/contexts/GameContext';
import { REGION_CUSTOMERS, Customer } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import { toast } from 'sonner';
import { Save, AlertTriangle, AlertCircle, CheckCircle2, Package, Microscope, MapPin, Trophy, Users, Target, TrendingUp, UserCheck, Info } from 'lucide-react';
import { GameIcon } from './GameIcon';
import { SteveIcon } from './SteveIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGameTheme, regionLabel, techIcon, techLabel } from '@/lib/gameTheme';
import { useSession } from '@/contexts/SessionContext';
import { PhaseLockCard } from './PhaseLockCard';
import { isSteveBlocking as isSteveBlockingRule, hasTech } from '@/lib/rules';
import { isRuleActiveForTeam } from '@/lib/defaultRules';

export const SalesPhase = () => {
  const { gameState, actionsMap, skipTurn, addRoundData, getCurrentRound, getTeamLogisticsProgress, calculatePlayOrder } = useGame();
  const theme = useGameTheme();
  const { currentRole, currentTeamId, isReadOnly, selectTeam } = useSession();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, string[]>>({});
  const [nfcSalesUnits, setNfcSalesUnits] = useState<number>(0);
  const [showPartialSalesConfirm, setShowPartialSalesConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (currentRole === 'STUDENT' && currentTeamId) {
      setSelectedTeam(currentTeamId);
    } else if (currentTeamId && !selectedTeam) {
      setSelectedTeam(currentTeamId);
    }
  }, [currentTeamId, currentRole, selectedTeam]);

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

  const savedCustomersSold = selectedTeam ? currentRoundData?.teamData[selectedTeam]?.customersSold : undefined;
  const savedSalesKey = savedCustomersSold ? JSON.stringify(savedCustomersSold) : null;
  const savedNfcSalesUnits = selectedTeam ? (currentRoundData?.teamData[selectedTeam]?.nfcSalesUnits || 0) : 0;

  // Load saved sales into selectedCustomers only when selectedTeam, round, or committed sales actually change
  useEffect(() => {
    if (selectedTeam && savedSalesKey !== null) {
      const sold: string[] = JSON.parse(savedSalesKey);
      const grouped: Record<string, string[]> = {};
      
      REGION_CUSTOMERS.forEach(({ region, customers }) => {
        const matching = sold.filter(id => customers.some(c => c.id === id));
        if (matching.length > 0) {
          grouped[region] = matching;
        }
      });
      setSelectedCustomers(grouped);
      setNfcSalesUnits(savedNfcSalesUnits);
    } else {
      setSelectedCustomers({});
      setNfcSalesUnits(0);
    }
  }, [selectedTeam, currentRound, savedSalesKey, savedNfcSalesUnits]);

  const selectedTeamData = selectedTeam && currentRoundData?.teamData[selectedTeam];
  const teamName = selectedTeam ? gameState.teams.find(t => t.id === selectedTeam)?.name : '';
  
  // Get team's present regions (derived from both logistics progress and board presence)
  const teamLogistics = selectedTeam ? getTeamLogisticsProgress(selectedTeam) : null;
  const regionsFromProgress = teamLogistics?.regionsWithPresence || [];
  const regionsFromBoard = selectedTeam 
    ? Object.entries(gameState.regionLogistics || {})
        .filter(([_, reg]) => reg.teamsPresent && reg.teamsPresent.includes(selectedTeam))
        .map(([rName]) => rName)
    : [];
  const teamRegions = Array.from(new Set([...regionsFromProgress, ...regionsFromBoard])).sort((a, b) => {
    return REGION_CUSTOMERS.findIndex(r => r.region === a) - 
           REGION_CUSTOMERS.findIndex(r => r.region === b);
  });
  
  // Get team's completed technologies
  const teamResearch = selectedTeam ? gameState.teamResearchProgress[selectedTeam] : null;
  const completedTechs = new Set(teamResearch?.completedTechnologies || []);
  
  // 4G Direct Sales calculation (up to 1 sale across non-office regions)
  const has4GTech = selectedTeam
    ? (isRuleActiveForTeam(gameState?.ruleAdjustments, 'tech_permanent_benefits', selectedTeam) && hasTech(gameState, selectedTeam, '4G'))
    : false;

  const displayedRegions = useMemo(() => {
    if (has4GTech) {
      return REGION_CUSTOMERS.map(r => r.region);
    }
    return teamRegions;
  }, [has4GTech, teamRegions]);

  const g4SalesCount = useMemo(() => {
    return Object.entries(selectedCustomers).reduce((count, [regionName, customerIds]) => {
      if (!teamRegions.includes(regionName)) {
        return count + customerIds.length;
      }
      return count;
    }, 0);
  }, [selectedCustomers, teamRegions]);

  // NFC Direct Sales calculation
  const hasNfcTech = Array.from(completedTechs).some(t => (t || '').toUpperCase() === 'NFC') || (selectedTeam ? hasTech(gameState, selectedTeam, 'NFC') : false);
  const regionalSalesCount = Object.values(selectedCustomers).flat().length;
  const productsAvailable = selectedTeamData?.productsProduced || 0;
  const remainingForNfc = Math.max(0, productsAvailable - regionalSalesCount);
  const maxNfcAllowed = hasNfcTech ? Math.min(3, remainingForNfc) : 0;
  const effectiveNfcSalesUnits = hasNfcTech ? Math.min(nfcSalesUnits, maxNfcAllowed) : 0;

  // Calculate total products to be sold and revenue
  const totalProductsToSell = regionalSalesCount + effectiveNfcSalesUnits;
  const calculatedRevenue = selectedTeamData ? selectedTeamData.price * totalProductsToSell : 0;
  const salesExceedProduction = totalProductsToSell > productsAvailable;

  // Calculate eligible price and value customers for the selected team across displayed regions
  const eligibleCustomerCounts = useMemo(() => {
    if (!selectedTeam || !selectedTeamData) {
      return { priceCount: 0, valueCount: 0, totalEligible: 0 };
    }

    let priceCount = 0;
    let valueCount = 0;

    displayedRegions.forEach(regionName => {
      const regionData = REGION_CUSTOMERS.find(r => r.region === regionName);
      if (!regionData) return;

      regionData.customers.forEach(customer => {
        // Check if sold by another team prior in turn order
        const isSoldByOther = soldCustomers.has(customer.id) && !selectedTeamData.customersSold?.includes(customer.id);
        if (isSoldByOther) return;

        if (customer.type === 'price') {
          if (selectedTeamData.price <= (customer.price || 0)) {
            priceCount++;
          }
        } else if (customer.type === 'value') {
          if (customer.technology) {
            const reqNorm = customer.technology.toUpperCase();
            if (Array.from(completedTechs).some(t => (t || '').toUpperCase() === reqNorm)) {
              valueCount++;
            }
          }
        }
      });
    });

    return {
      priceCount,
      valueCount,
      totalEligible: priceCount + valueCount
    };
  }, [selectedTeam, selectedTeamData, displayedRegions, soldCustomers, completedTechs]);

  const demandFulfillmentRate = useMemo(() => {
    if (eligibleCustomerCounts.totalEligible === 0) return 0;
    return (totalProductsToSell / eligibleCustomerCounts.totalEligible) * 100;
  }, [totalProductsToSell, eligibleCustomerCounts.totalEligible]);

  const isSalesSubmitted = selectedTeamData && !!selectedTeamData.customersSold;

  // Calculate unselected legal sales opportunities remaining for the selected team
  const additionalEligibleOpportunities = useMemo(() => {
    if (!selectedTeam || !selectedTeamData) return 0;

    let additionalOffice = 0;
    let hasEligibleNonOffice = false;

    displayedRegions.forEach(regionName => {
      const isOffice = teamRegions.includes(regionName);
      const regionData = REGION_CUSTOMERS.find(r => r.region === regionName);
      if (!regionData) return;

      const currentlySelectedInRegion = selectedCustomers[regionName] || [];

      regionData.customers.forEach(customer => {
        if (currentlySelectedInRegion.includes(customer.id)) return;

        const isSoldByOther = soldCustomers.has(customer.id) && !selectedTeamData.customersSold?.includes(customer.id);
        if (isSoldByOther) return;

        let eligible = false;
        if (customer.type === 'price') {
          eligible = selectedTeamData.price <= (customer.price || 0);
        } else if (customer.type === 'value' && customer.technology) {
          const reqNorm = customer.technology.toUpperCase();
          eligible = Array.from(completedTechs).some(t => (t || '').toUpperCase() === reqNorm);
        }

        if (eligible) {
          if (isOffice) {
            additionalOffice++;
          } else {
            hasEligibleNonOffice = true;
          }
        }
      });
    });

    const additional4G = (has4GTech && g4SalesCount === 0 && hasEligibleNonOffice) ? 1 : 0;
    const additionalNfc = Math.max(0, maxNfcAllowed - effectiveNfcSalesUnits);

    return additionalOffice + additional4G + additionalNfc;
  }, [
    selectedTeam,
    selectedTeamData,
    displayedRegions,
    teamRegions,
    selectedCustomers,
    soldCustomers,
    completedTechs,
    has4GTech,
    g4SalesCount,
    maxNfcAllowed,
    effectiveNfcSalesUnits,
  ]);

  const cannotMakeAnySale = Boolean(
    selectedTeamData &&
      !isSalesSubmitted &&
      (productsAvailable === 0 || (eligibleCustomerCounts.totalEligible === 0 && maxNfcAllowed === 0))
  );

  const allTeamsHavePlans = useMemo(() => {
    return gameState.teams.every(team => 
      teamsWithPlans.some(t => t.id === team.id)
    );
  }, [gameState.teams, teamsWithPlans]);

  if (currentRole === 'STUDENT' && !allTeamsHavePlans) {
    return <PhaseLockCard phaseName="Sales Phase" />;
  }

  const isV2Turn =
    gameState.schemaVersion === 2 &&
    gameState.turn &&
    gameState.turn.round === currentRound &&
    gameState.turn.phase === 'sales';

  const activeSalesTeam = useMemo(() => {
    if (isV2Turn && gameState.turn) {
      const turnTeamId = gameState.turn.order[gameState.turn.index];
      return turnTeamId ? gameState.teams.find(t => t.id === turnTeamId) : undefined;
    }
    return playOrder.find(team => {
      const teamData = currentRoundData?.teamData[team.id];
      const produced = teamData?.productsProduced || 0;
      return produced > 0 && !teamData?.customersSold;
    });
  }, [isV2Turn, gameState.turn, gameState.teams, playOrder, currentRoundData]);

  const isMyTurn = currentRole !== 'STUDENT' || (currentTeamId === activeSalesTeam?.id);
  const myActionStatus = currentTeamId ? actionsMap?.[`${currentRound}_sales_${currentTeamId}`] : undefined;
  const isWaitingForReferee = Boolean(myActionStatus && !myActionStatus.status);
  const activePhase = gameState?.currentPhase || 'planning';
  const isReadOnlyMode = isReadOnly || 
                          (currentRole === 'STUDENT' && !allTeamsHavePlans) || 
                          (currentRole === 'STUDENT' && !isMyTurn) || 
                          (currentRole === 'STUDENT' && isSalesSubmitted) ||
                          (currentRole === 'STUDENT' && isWaitingForReferee) ||
                          (currentRole === 'STUDENT' && activePhase !== 'sales');

  const isCustomerEligible = (customer: Customer): boolean => {
    if (!selectedTeamData) return false;
    
    // Eligible if not sold by others (we allow toggling our own sold customers)
    const isSoldByOther = soldCustomers.has(customer.id) && !selectedTeamData.customersSold?.includes(customer.id);
    if (isSoldByOther) return false;
    
    if (customer.type === 'price') {
      return selectedTeamData.price <= (customer.price || 0);
    } else {
      if (!customer.technology) return false;
      const reqNorm = customer.technology.toUpperCase();
      return Array.from(completedTechs).some(t => (t || '').toUpperCase() === reqNorm);
    }
  };

  const toggleCustomer = (regionName: string, customerId: string) => {
    const isOfficeRegion = teamRegions.includes(regionName);
    const isCurrentlySelected = (selectedCustomers[regionName] || []).includes(customerId);

    if (!isOfficeRegion && !isCurrentlySelected) {
      const currentRegionCount = (selectedCustomers[regionName] || []).length;
      if (currentRegionCount >= 1) {
        toast.error(`${techLabel(theme, '4G')} Technology allows a maximum of 1 product sale in ${regionLabel(theme, regionName)} (non-office region).`);
        return;
      }
    }

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

    // Warning check: Team has unsold stock remaining while additional legal sales opportunities exist
    const remainingStock = productsAvailable - totalProductsToSell;
    if (remainingStock > 0 && additionalEligibleOpportunities > 0) {
      setShowPartialSalesConfirm(true);
      return;
    }

    executeSubmitSales();
  };

  const executeSubmitSales = () => {
    setShowPartialSalesConfirm(false);
    if (!selectedTeam || !selectedTeamData) return;

    const allSelectedCustomers = Object.values(selectedCustomers).flat();

    // Update the existing team data with sales information
    const updatedData = {
      ...selectedTeamData,
      customersSold: allSelectedCustomers,
      nfcSalesUnits: effectiveNfcSalesUnits,
      revenue: calculatedRevenue,
      totalMoney: (selectedTeamData.totalMoney || 0) - (selectedTeamData.revenue || 0) + calculatedRevenue,
      eligiblePriceCustomers: eligibleCustomerCounts.priceCount,
      eligibleValueCustomers: eligibleCustomerCounts.valueCount,
      eligibleSalesUnits: eligibleCustomerCounts.totalEligible,
      demandFulfillmentRate: demandFulfillmentRate
    };

    addRoundData(currentRound, selectedTeam, updatedData);
    toast.success(`Sales data saved for ${teamName}`);
    
    if (currentRole !== 'STUDENT' && gameState) {
      const activeSalesPlayOrder = calculatePlayOrder(currentRound).filter(team => {
        const productsProduced = currentRoundData?.teamData[team.id]?.productsProduced || 0;
        return productsProduced > 0;
      });
      const currIdx = activeSalesPlayOrder.findIndex(t => t.id === selectedTeam);
      if (currIdx >= 0 && currIdx < activeSalesPlayOrder.length - 1) {
        const nextTeam = activeSalesPlayOrder[currIdx + 1];
        selectTeam(nextTeam.id);
        setSelectedTeam(nextTeam.id);
        setSelectedCustomers({});
        setNfcSalesUnits(0);
        toast.info(`Turn Order: Advanced to ${nextTeam.name}`);
        return;
      }
    }

    // Reset form
    setSelectedTeam('');
    setSelectedCustomers({});
    setNfcSalesUnits(0);
  };

  const handleRecordZeroSales = () => {
    if (!selectedTeam || !selectedTeamData || isReadOnlyMode) return;

    const updatedData = {
      ...selectedTeamData,
      customersSold: [],
      nfcSalesUnits: 0,
      revenue: 0,
      totalMoney: (selectedTeamData.totalMoney || 0) - (selectedTeamData.revenue || 0),
      eligiblePriceCustomers: eligibleCustomerCounts.priceCount,
      eligibleValueCustomers: eligibleCustomerCounts.valueCount,
      eligibleSalesUnits: eligibleCustomerCounts.totalEligible,
      demandFulfillmentRate: 0,
    };

    addRoundData(currentRound, selectedTeam, updatedData);
    toast.success(`Zero sales recorded for ${teamName}`);

    if (currentRole !== 'STUDENT' && gameState) {
      const activeSalesPlayOrder = calculatePlayOrder(currentRound).filter(team => {
        const productsProduced = currentRoundData?.teamData[team.id]?.productsProduced || 0;
        return productsProduced > 0;
      });
      const currIdx = activeSalesPlayOrder.findIndex(t => t.id === selectedTeam);
      if (currIdx >= 0 && currIdx < activeSalesPlayOrder.length - 1) {
        const nextTeam = activeSalesPlayOrder[currIdx + 1];
        selectTeam(nextTeam.id);
        setSelectedTeam(nextTeam.id);
        setSelectedCustomers({});
        setNfcSalesUnits(0);
        toast.info(`Turn Order: Advanced to ${nextTeam.name}`);
        return;
      }
    }

    setSelectedTeam('');
    setSelectedCustomers({});
    setNfcSalesUnits(0);
  };

  const handleEndTurn = () => {
    if (totalProductsToSell > 0 && !salesExceedProduction && selectedTeam) {
      handleSubmit();
      return;
    }
    if (gameState.schemaVersion === 2) {
      skipTurn();
      toast.info(`Skipped sales turn for ${activeSalesTeam?.name || teamName || 'Team'}`);
      return;
    }
    const targetTeamId = selectedTeam || activeSalesTeam?.id;
    const targetData = targetTeamId ? currentRoundData?.teamData[targetTeamId] : undefined;
    if (targetTeamId && targetData) {
      const updatedData = {
        ...targetData,
        customersSold: [],
        revenue: 0,
        totalMoney: (targetData.totalMoney || 0) - (targetData.revenue || 0),
      };
      addRoundData(currentRound, targetTeamId, updatedData);
      toast.success(`Ended sales turn for ${gameState.teams.find(t => t.id === targetTeamId)?.name || 'Team'}`);
      setSelectedTeam('');
      setSelectedCustomers({});
      setNfcSalesUnits(0);
    }
  };

  const allTeamsSubmitted = isV2Turn && gameState.turn
    ? gameState.turn.index >= gameState.turn.order.length
    : gameState.teams.every(t => {
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
    <div className="space-y-4">
      <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-xl font-bold flex items-center gap-2 flex-wrap tracking-tight">
              <GameIcon type="sales" size="md" />
              <span>Round {currentRound} Sales - Sell to Customers</span>
            </CardTitle>
            <CardDescription>
              {selectedTeam && teamName 
                ? `Selling for ${teamName} - Select customers to sell to` 
                : 'Select a team to begin sales'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Play Order, Products & Technologies Overview */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-warning" />
                  <span>Play Order & Team Inventory (Products & Technologies)</span>
                </h3>
                <div className="flex items-center gap-2">
                  {activeSalesTeam ? (
                    <Badge className="bg-success/15 text-success dark:text-emerald-300 border border-success/30 text-xs font-bold gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-success animate-ping" />
                      Current Turn: {activeSalesTeam.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs font-bold gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Sales Complete
                    </Badge>
                  )}
                  {currentRole !== 'STUDENT' && activeSalesTeam && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleEndTurn}
                      className="border-amber-500/50 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold gap-1.5 h-7 text-xs"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      End Team Turn
                    </Button>
                  )}
                </div>
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
                          ? 'ring-2 ring-success bg-success/10 border-success/80 shadow-md animate-pulse'
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
                            <Badge className="bg-success text-white text-[9px] px-1 py-0 font-extrabold uppercase">
                              Turn
                            </Badge>
                          )
                        )}
                      </div>

                      <div className="space-y-1 text-[11px] pt-1 border-t border-border/50">
                        <div className="flex justify-between items-center font-semibold">
                          <span className="flex items-center gap-1"><GameIcon type="production" size="xs" /> Products:</span>
                          <span>{products}</span>
                        </div>
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span className="flex items-center gap-1"><GameIcon type="research" size="xs" /> Techs ({techs.length}):</span>
                          <span className="truncate text-[10px] font-mono">{techs.length > 0 ? techs.map(t => techLabel(theme, t)).join(', ') : 'None'}</span>
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

            {isWaitingForReferee && (
              <Alert className="border-primary/40 bg-primary/10">
                <AlertDescription className="text-xs font-medium">
                  Submitted — waiting for facilitator to confirm your sales...
                </AlertDescription>
              </Alert>
            )}

            {myActionStatus?.status === 'rejected' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Action Rejected:</strong> {myActionStatus.error || 'Invalid sales submission. Please adjust and resubmit.'}
                </AlertDescription>
              </Alert>
            )}

            {currentRole === 'STUDENT' && allTeamsHavePlans && !isSalesSubmitted && !isMyTurn && activeSalesTeam && (
              <Alert className="border-warning/50 bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning animate-pulse" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>It is not your turn yet.</strong> The active turn belongs to <strong>{activeSalesTeam.name}</strong>. Please wait for them to finish their sales.
                </AlertDescription>
              </Alert>
            )}

            {currentRole === 'STUDENT' && allTeamsHavePlans && isSalesSubmitted && (
              <Alert className="border-success/50 bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
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
                    <Card className="bg-accent/10 border-accent/30 shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <GameIcon type="production" size="xs" />
                            Team Summary ({teamName})
                          </CardTitle>
                          {eligibleCustomerCounts.totalEligible > 0 && (
                            <Badge variant="outline" className="bg-success/10 border-success/30 text-success dark:text-emerald-300 font-bold self-start sm:self-auto">
                              Fulfillment Rate: {demandFulfillmentRate.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <span className="font-bold text-destructive text-sm">$</span>
                              Price:
                            </span>
                            <div className="font-semibold text-lg">${selectedTeamData.price}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Products Available:</span>
                            <div className="font-semibold text-lg">{productsAvailable}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Products Sold (Sales Units):</span>
                            <div className={`font-semibold text-lg ${salesExceedProduction ? 'text-destructive' : ''}`}>
                              {totalProductsToSell}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Revenue:</span>
                            <div className="font-semibold text-lg text-primary">${calculatedRevenue.toLocaleString()}</div>
                          </div>
                        </div>

                        {/* Customer Demand & Fulfillment Breakdown */}
                        <div className="pt-3 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-3 bg-card/60 p-3 rounded-lg border">
                          <div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                              <Users className="h-3.5 w-3.5 text-destructive" />
                              Eligible Price Customers:
                            </span>
                            <div className="font-bold text-base text-destructive dark:text-destructive">
                              {eligibleCustomerCounts.priceCount}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              Eligible Value Customers:
                            </span>
                            <div className="font-bold text-base text-muted-foreground dark:text-purple-400">
                              {eligibleCustomerCounts.valueCount}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                              <Target className="h-3.5 w-3.5 text-primary" />
                              Total Eligible Sales Units:
                            </span>
                            <div className="font-bold text-base text-primary dark:text-primary">
                              {eligibleCustomerCounts.totalEligible} units
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                              <TrendingUp className="h-3.5 w-3.5 text-success" />
                              Demand Fulfillment Rate:
                            </span>
                            <div className="font-bold text-base text-success dark:text-success">
                              {demandFulfillmentRate.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {completedTechs.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm font-medium">Completed Technologies:</span>
                        {Array.from(completedTechs).map(tech => (
                          <Badge key={tech} variant="secondary">{techLabel(theme, tech)}</Badge>
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

                    {hasNfcTech && (() => {
                      const NfcIcon = techIcon(theme, 'NFC');
                      return (
                        <Card className="border border-indigo-500/30 bg-indigo-500/5 shadow-xs">
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                                <NfcIcon className="h-4 w-4 text-indigo-500 animate-pulse" />
                                <span>{techLabel(theme, 'NFC')} Direct Sales (No Region Required)</span>
                              </CardTitle>
                              <Badge className="bg-indigo-600 text-white font-bold text-xs">
                                Up to 3 Leftover Products
                              </Badge>
                            </div>
                            <CardDescription className="text-xs">
                              {techLabel(theme, 'NFC')} technology allows your team to sell up to 3 products per round without placing them in a region. Each unit is sold at your set price (${selectedTeamData.price}).
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="py-2 px-4 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs font-semibold text-muted-foreground">Select {techLabel(theme, 'NFC')} Sales Units:</span>
                              <div className="flex items-center gap-1.5">
                                {[0, 1, 2, 3].map(n => {
                                  const isAllowed = n <= maxNfcAllowed;
                                  const isSelected = effectiveNfcSalesUnits === n;
                                  return (
                                    <Button
                                      key={n}
                                      type="button"
                                      variant={isSelected ? 'default' : 'outline'}
                                      size="sm"
                                      disabled={!isAllowed || isReadOnlyMode}
                                      onClick={() => setNfcSalesUnits(n)}
                                      className={`h-8 px-3 text-xs font-bold ${
                                        isSelected ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''
                                      }`}
                                    >
                                      {n} {n === 1 ? 'Unit' : 'Units'}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground pt-1 flex items-center gap-2 flex-wrap">
                              <span>Regional Sales: <strong>{regionalSalesCount}</strong></span>
                              <span>+</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{techLabel(theme, 'NFC')} Direct Sales: {effectiveNfcSalesUnits}</span>
                              <span>=</span>
                              <span>Total Sold: <strong className="text-foreground">{totalProductsToSell}</strong> / {productsAvailable}</span>
                              {effectiveNfcSalesUnits > 0 && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-bold ml-auto">
                                  +${(effectiveNfcSalesUnits * selectedTeamData.price).toLocaleString()} {techLabel(theme, 'NFC')} Revenue
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}

                    {has4GTech && (() => {
                      const G4Icon = techIcon(theme, '4G');
                      return (
                        <Card className="border border-amber-500/30 bg-amber-500/5 shadow-xs">
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700 dark:text-amber-300">
                                <G4Icon className="h-4 w-4 text-amber-500 animate-pulse" />
                                <span>{techLabel(theme, '4G')} Direct Sale (No Office Required)</span>
                              </CardTitle>
                              <Badge className="bg-amber-600 text-white font-bold text-xs">
                                Max 1 Sale Per Non-Office Region
                              </Badge>
                            </div>
                            <CardDescription className="text-xs">
                              {techLabel(theme, '4G')} technology allows your team to sell 1 product in each region where you have no office (earns sales revenue, no control points).
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      );
                    })()}

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">
                        Select Customers {has4GTech ? `(Office & ${techLabel(theme, '4G')} Remote Regions)` : '(Only Office Regions)'}
                      </h3>
                      
                      {displayedRegions.length === 0 && (
                        <Alert>
                          <AlertDescription>
                            This team has no regional presence yet. Expand to regions in the Logistics phase first.
                          </AlertDescription>
                        </Alert>
                      )}

                      {displayedRegions.map(regionName => {
                        const regionData = REGION_CUSTOMERS.find(r => r.region === regionName);
                        if (!regionData) return null;

                        const isOfficeRegion = teamRegions.includes(regionName);
                        const is4GRemoteRegion = !isOfficeRegion;
                        const isSteveBlocking = isSteveBlockingRule(gameState, regionName, selectedTeam);
                        const regionLogisticsData = gameState.regionLogistics?.[regionName];
                        const teamsPresentCount = regionLogisticsData?.teamsPresent?.length || 0;
                        const effectiveTeamsCount = Math.max(1, teamsPresentCount);
                        const firstPlaceControl = getControlPointsForRegion(regionName, effectiveTeamsCount, 'first');
                        const secondPlaceControl = getControlPointsForRegion(regionName, effectiveTeamsCount, 'second');
                        const G4Icon = techIcon(theme, '4G');

                        return (
                          <Card key={regionName} className={
                            isSteveBlocking ? 'border-red-500 bg-red-950/10 ring-2 ring-red-500/40' :
                            is4GRemoteRegion ? 'border-amber-500/40 bg-amber-500/5' : ''
                          }>
                            <CardHeader className="pb-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-primary" />
                                  {regionLabel(theme, regionName)}
                                  {is4GRemoteRegion && (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-semibold gap-1">
                                      <G4Icon className="h-3 w-3" />
                                      {techLabel(theme, '4G')} Direct Sale (No Office)
                                    </Badge>
                                  )}
                                  {isSteveBlocking && (
                                    <Badge className="bg-red-950 text-red-300 border border-red-500/50 text-xs font-bold gap-1 [animation:pulse_1s_cubic-bezier(0.4,0,0.6,1)_3]">
                                      <SteveIcon size={14} />
                                      BLOCKED
                                    </Badge>
                                  )}
                                </CardTitle>
                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                  {isOfficeRegion ? (
                                    <>
                                      <span className="text-muted-foreground font-semibold">Potential Control:</span>
                                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold gap-1">
                                        <Trophy className="h-3 w-3 text-warning" />
                                        1st Place: +{firstPlaceControl} pts
                                      </Badge>
                                      {secondPlaceControl > 0 && (
                                        <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/30 text-xs font-bold gap-1">
                                          2nd Place: +{secondPlaceControl} pts
                                        </Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground italic">({teamsPresentCount} {teamsPresentCount === 1 ? 'team' : 'teams'} present)</span>
                                    </>
                                  ) : (
                                    <span className="text-amber-600 dark:text-amber-400 text-xs italic font-medium">
                                      (No office — No control points earned)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              {isSteveBlocking ? (
                                <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/40 text-red-700 dark:text-red-300 flex items-center gap-2 text-xs font-bold">
                                  <SteveIcon size={18} />
                                  <span>Steve is blocking {regionLabel(theme, regionName)}! Product sales are disabled in this region.</span>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {regionData.customers
                                    .sort((a, b) => a.position - b.position)
                                    .map(customer => {
                                      const isEligible = isCustomerEligible(customer);
                                      const isSoldByOther = soldCustomers.has(customer.id) && !selectedTeamData?.customersSold?.includes(customer.id);
                                      const isSelected = selectedCustomers[regionName]?.includes(customer.id);
                                      const TechIcon = customer.technology ? techIcon(theme, customer.technology) : null;

                                      return (
                                        <div
                                          key={customer.id}
                                          className={`relative flex items-center justify-center w-12 h-12 rounded-lg transition-all ${
                                            isSteveBlocking ? 'opacity-30 cursor-not-allowed' :
                                            isSoldByOther ? 'opacity-40 cursor-not-allowed' :
                                            isSelected ? 'ring-2 ring-primary ring-offset-2' :
                                            isEligible ? 'cursor-pointer hover:scale-105' :
                                            'opacity-40 cursor-not-allowed'
                                          }`}
                                          onClick={() => {
                                            if (isEligible && !isSoldByOther && !isReadOnlyMode && !isSteveBlocking) {
                                              toggleCustomer(regionName, customer.id);
                                            }
                                          }}
                                          title={isSteveBlocking 
                                            ? `Blocked by Steve - Sales disabled`
                                            : customer.type === 'price' 
                                            ? `Price Customer - Max ${customer.price}` 
                                            : `Value Customer - Requires ${customer.technology ? techLabel(theme, customer.technology) : ''}`}
                                        >
                                          <div className={`w-full h-full flex items-center justify-center rounded-lg ${
                                            customer.type === 'price' ? 'bg-destructive' : 'bg-purple-600'
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
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Action Buttons or Submitted Status */}
                    {(() => {
                      const hasStudentSubmittedSales = Boolean(
                        isSalesSubmitted || (currentRole === 'STUDENT' && myActionStatus?.status === 'applied')
                      );
                      const hasUnsavedFacilitatorEdits =
                        currentRole !== 'STUDENT' &&
                        isSalesSubmitted &&
                        (JSON.stringify(Object.values(selectedCustomers).flat().sort()) !==
                          JSON.stringify([...(selectedTeamData?.customersSold || [])].sort()) ||
                          effectiveNfcSalesUnits !== savedNfcSalesUnits);

                      if (isWaitingForReferee) {
                        return null; // Top alert already displays "Submitted — waiting for facilitator..."
                      }

                      if (hasStudentSubmittedSales && !hasUnsavedFacilitatorEdits) {
                        return (
                          <Alert className="border-success/40 bg-success/10 text-emerald-900 dark:text-emerald-100 flex items-center gap-2.5 shadow-xs">
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            <AlertDescription className="font-semibold text-sm">
                              Sales submitted for <strong>{teamName}</strong> ({totalProductsToSell}{' '}
                              {totalProductsToSell === 1 ? 'product' : 'products'} sold for $
                              {calculatedRevenue.toLocaleString()} revenue in Round {currentRound}).
                            </AlertDescription>
                          </Alert>
                        );
                      }

                      if (isReadOnlyMode) {
                        return null;
                      }

                      return (
                        <div className="space-y-3 pt-4">
                          {cannotMakeAnySale && (
                            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <AlertTitle className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                                  No Legal Sales Opportunities Available
                                </AlertTitle>
                                <AlertDescription className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                                  {productsAvailable === 0 ? (
                                    <>
                                      <strong>{teamName || 'Your team'}</strong> produced <strong>0 products</strong> this round, so no products are available to sell. Please click <strong>Record Zero Sales</strong> below to complete your sales turn.
                                    </>
                                  ) : (
                                    <>
                                      None of the available customers in your active regions match your product price ($
                                      {selectedTeamData.price}) or completed technologies, and direct sales are unavailable. With no legal sales possible for your {productsAvailable} {productsAvailable === 1 ? 'product' : 'products'}, please click <strong>Record Zero Sales</strong> below to complete your sales turn.
                                    </>
                                  )}
                                </AlertDescription>
                              </div>
                            </Alert>
                          )}

                          <div className="flex flex-wrap gap-2 sticky bottom-0 z-30 bg-card/95 backdrop-blur p-3 -mx-6 -mb-6 border-t border-border shadow-2xl sm:static sm:p-0 sm:m-0 sm:shadow-none sm:border-0 sm:bg-transparent">
                            {cannotMakeAnySale ? (
                              <Button
                                onClick={handleRecordZeroSales}
                                className="flex-1 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                                size="lg"
                                disabled={isReadOnlyMode}
                              >
                                <Save className="mr-2 h-5 w-5" />
                                Record Zero Sales (Complete Turn)
                              </Button>
                            ) : (
                              <>
                                <Button
                                  onClick={handleSubmit}
                                  className="flex-1 font-bold"
                                  size="lg"
                                  disabled={salesExceedProduction || totalProductsToSell === 0 || isReadOnlyMode}
                                >
                                  <Save className="mr-2 h-5 w-5" />
                                  {hasUnsavedFacilitatorEdits ? 'Update Sales' : 'Submit Sales'}
                                </Button>
                                {currentRole !== 'STUDENT' && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="lg"
                                    onClick={handleEndTurn}
                                    className="border-amber-500/50 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold gap-1.5"
                                  >
                                    <UserCheck className="h-4 w-4" />
                                    End Team Turn
                                  </Button>
                                )}
                                <Button
                                  onClick={handleRecordZeroSales}
                                  variant="outline"
                                  size="lg"
                                  disabled={isReadOnlyMode}
                                >
                                  Record Zero Sales
                                </Button>
                              </>
                            )}
                            {cannotMakeAnySale && currentRole !== 'STUDENT' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={handleEndTurn}
                                className="border-amber-500/50 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold gap-1.5"
                              >
                                <UserCheck className="h-4 w-4" />
                                End Team Turn
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={showPartialSalesConfirm} onOpenChange={setShowPartialSalesConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Unsold Stock & Eligible Customers Remaining
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 pt-1">
                <span className="block">
                  <strong>{teamName || 'Your team'}</strong> produced{' '}
                  <strong>{productsAvailable} products</strong> and selected{' '}
                  <strong>{totalProductsToSell} to sell</strong> (
                  <strong className="text-foreground">
                    {productsAvailable - totalProductsToSell} unsold{' '}
                    {productsAvailable - totalProductsToSell === 1 ? 'product' : 'products'} remaining
                  </strong>
                  ).
                </span>
                <span className="block">
                  There {additionalEligibleOpportunities === 1 ? 'is' : 'are'} still{' '}
                  <strong>
                    {additionalEligibleOpportunities} eligible sales{' '}
                    {additionalEligibleOpportunities === 1 ? 'opportunity' : 'opportunities'}
                  </strong>{' '}
                  available across your active regions or direct sales.
                </span>
                <span className="block text-amber-700 dark:text-amber-300 font-medium">
                  Submitting now will finalize your sales turn for Round {currentRound} with{' '}
                  {productsAvailable - totalProductsToSell}{' '}
                  {productsAvailable - totalProductsToSell === 1 ? 'product' : 'products'} remaining unsold. Are you sure you want to proceed?
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back & Review Sales</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeSubmitSales}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                Confirm & Submit {totalProductsToSell} {totalProductsToSell === 1 ? 'Sale' : 'Sales'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      {/* All Regions Sales Status */}
      <Card>
        <CardHeader>
          <CardTitle>All Regions Sales Status</CardTitle>
          <CardDescription>Overview of regional intelligence and customer sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REGION_CUSTOMERS.map(({ region }) => {
              const isSteveBlocking = isSteveBlockingRule(gameState, region);
              const regionStatus = regionSalesStatus[region];
              const hasSales = regionStatus.some(s => s.soldTo);
              const regionLogisticsData = gameState.regionLogistics?.[region];
              const teamsPresentCount = regionLogisticsData?.teamsPresent?.length || 0;
              const effectiveTeamsCount = Math.max(1, teamsPresentCount);
              const firstPlaceControl = getControlPointsForRegion(region, effectiveTeamsCount, 'first');
              const secondPlaceControl = getControlPointsForRegion(region, effectiveTeamsCount, 'second');

              const isAnyTeamActiveInRegion = gameState.teams.some(team => {
                const rd = gameState.regionLogistics[region];
                return rd?.teamsPresent.includes(team.id) || (rd?.teamProgress[team.id] || 0) > 0;
              });

              return (
                <Card key={region} className={isSteveBlocking ? 'border-red-500 bg-red-950/10 ring-2 ring-red-500/40 flex flex-col' : hasSales ? 'border-primary/50 flex flex-col' : 'flex flex-col'}>
                  <CardHeader className="pb-2 border-b border-border/40 mb-2 px-3 pt-3">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                        {regionLabel(theme, region)}
                        {isSteveBlocking && (
                          <Badge className="bg-red-950 text-red-300 border border-red-500/50 text-[10px] flex items-center gap-1 font-bold [animation:pulse_1s_cubic-bezier(0.4,0,0.6,1)_3]">
                            <SteveIcon size={12} /> BLOCKED
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1 text-[10px]">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] font-bold px-1.5 py-0">
                          1st: +{firstPlaceControl} pts
                        </Badge>
                        {secondPlaceControl > 0 && (
                          <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 text-[10px] font-bold px-1.5 py-0">
                            2nd: +{secondPlaceControl} pts
                          </Badge>
                        )}
                      </div>
                    </div>
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
                                    const TechIcon = techIcon(theme, tech);
                                    return (
                                      <div key={tech} className="flex items-center gap-1 text-primary text-[9px] bg-primary/10 border border-primary/20 px-1 py-0.5 rounded" title={`${techLabel(theme, tech)} (Completed)`}>
                                        <TechIcon className="w-2.5 h-2.5" />
                                        <span className="font-medium">{techLabel(theme, tech)}</span>
                                      </div>
                                    );
                                  })}
                                  {researchingTechs.map(({ tech, spent, required }) => {
                                    const TechIcon = techIcon(theme, tech);
                                    return (
                                      <div key={tech} className="flex items-center gap-1 text-muted-foreground text-[9px] bg-secondary/50 border border-border px-1 py-0.5 rounded" title={`${techLabel(theme, tech)} (Researching)`}>
                                        <TechIcon className="w-2.5 h-2.5 opacity-70" />
                                        <span>{techLabel(theme, tech)} ({spent}/{required})</span>
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
                          const TechIcon = customer.technology ? techIcon(theme, customer.technology) : null;

                          return (
                            <div
                              key={customer.id}
                              className="relative flex flex-col items-center gap-0.5"
                              title={customer.type === 'price' 
                                ? `Price Customer - Max ${customer.price}${soldTo ? ` - Sold to ${soldToTeam?.name}` : ''}` 
                                : `Value Customer - Requires ${customer.technology ? techLabel(theme, customer.technology) : ''}${soldTo ? ` - Sold to ${soldToTeam?.name}` : ''}`}
                            >
                              <div className={`w-9 h-9 flex items-center justify-center rounded-md ${
                                customer.type === 'price' ? 'bg-destructive' : 'bg-purple-600'
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
                                  {regionLabel(theme, connRegion)}
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
