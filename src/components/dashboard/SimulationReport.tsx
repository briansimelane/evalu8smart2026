import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame } from '@/contexts/GameContext';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Wrench, Microscope, Truck, ShoppingCart, PackageX, TrendingUp, ChevronDown, ChevronRight, MapPin, Award, Download, Plus, Minus, CheckCircle, XCircle, FlaskConical, Wifi, Battery, Gamepad2, MapPinned, Nfc, Radio, Trophy, Medal, Box } from 'lucide-react';
import { TEAM_COLORS } from '@/data/combinations';
import { Button } from '@/components/ui/button';
import { useState, useRef } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useReactToPrint } from 'react-to-print';
import { IconType } from '@/data/improvements';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';

export const SimulationReport = () => {
  const { gameState, getTechnologyCostForTeam } = useGame();
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => reportRef.current,
    documentTitle: `Simulation_Report_Round_${gameState?.currentRound || 0}`,
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 6mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-team-card {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .print-team-content {
          zoom: 0.85; /* Shrinks the layout flow so all rows fit perfectly vertically */
        }
        .print-team-card:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
      }
    `,
    onBeforeGetContent: () => {
      // Expand current round for all teams
      const newExpanded: Record<string, boolean> = {};
      gameState?.teams.forEach(team => {
        newExpanded[`${team.id}-${gameState.currentRound}`] = true;
      });
      setExpandedRounds(newExpanded);
      return Promise.resolve();
    },
  });

  if (!gameState) return null;

  const getTechnologyIcon = (tech: string) => {
    switch (tech) {
      case 'GPS':
        return <MapPinned className="h-3 w-3" />;
      case 'Wifi':
        return <Wifi className="h-3 w-3" />;
      case 'Battery':
        return <Battery className="h-3 w-3" />;
      case 'Gaming':
        return <Gamepad2 className="h-3 w-3" />;
      case 'NFC':
        return <Nfc className="h-3 w-3" />;
      case '4G':
        return <Radio className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getCustomerDetails = (customerId: string) => {
    const regionCode = customerId.split('-')[0];
    const regionData = REGION_CUSTOMERS.find(r => 
      r.region.toLowerCase().replace(/\s+/g, '').startsWith(regionCode) ||
      regionCode === 'naf' && r.region === 'North Africa' ||
      regionCode === 'sam' && r.region === 'South America' ||
      regionCode === 'eur' && r.region === 'Europe' ||
      regionCode === 'emi' && r.region === 'Emirates' ||
      regionCode === 'rsa' && r.region === 'RSA' ||
      regionCode === 'cis' && r.region === 'CIS' ||
      regionCode === 'chn' && r.region === 'China' ||
      regionCode === 'ind' && r.region === 'India' ||
      regionCode === 'aus' && r.region === 'Australia' ||
      regionCode === 'usa' && r.region === 'USA' ||
      regionCode === 'can' && r.region === 'Canada' ||
      regionCode === 'car' && r.region === 'Caribbean'
    );
    return regionData?.customers.find(c => c.id === customerId);
  };

  const renderIconEffect = (iconType: IconType) => {
    switch (iconType) {
      case 'Price Plus':
        return (
          <div className="flex items-center gap-1 text-xs">
            <span className="font-bold text-red-500 text-sm">$</span>
            <Plus className="h-3 w-3" />
          </div>
        );
      case 'Price and Product':
        return (
          <div className="flex items-center gap-1 text-xs">
            <span className="font-bold text-red-500 text-sm">$</span>
            <Minus className="h-3 w-3" />
            <Package className="h-4 w-4" />
          </div>
        );
      case 'Product':
        return (
          <div className="flex items-center gap-1 text-xs">
            <Package className="h-4 w-4" />
          </div>
        );
      case 'Research':
        return (
          <div className="flex items-center gap-1 text-xs">
            <Microscope className="h-4 w-4 text-purple-500" />
          </div>
        );
      case 'Logistic':
        return (
          <div className="flex items-center gap-1 text-xs">
            <Truck className="h-4 w-4 text-blue-500" />
          </div>
        );
      default:
        return <span className="text-xs">{iconType}</span>;
    }
  };

  const toggleRound = (teamId: string, roundNumber: number) => {
    const key = `${teamId}-${roundNumber}`;
    setExpandedRounds(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const COLOR_SCORES: Record<string, number> = {
    green: 3,
    blue: 4,
    black: 5,
    yellow: 6,
    red: 7
  };

  const colorNameFromHex = (hex: string): string | null => {
    const found = TEAM_COLORS.find(c => c.value.toLowerCase() === (hex || '').toLowerCase());
    return found ? found.name.toLowerCase() : null;
  };

  const getInitialScore = (team: typeof gameState.teams[0]): number => {
    const byColor = colorNameFromHex(team.color || '');
    if (byColor && COLOR_SCORES[byColor] !== undefined) return COLOR_SCORES[byColor];

    const teamName = (team.name || '').toLowerCase();
    for (const key of Object.keys(COLOR_SCORES)) {
      if (teamName.includes(key)) return COLOR_SCORES[key];
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Simulation Report</h2>
          <p className="text-muted-foreground">Complete performance overview for all teams across all rounds</p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div ref={reportRef} className="print:text-xs">

      {gameState.teams.map(team => {
        const initialScore = getInitialScore(team);
        let cumulativeMoney = initialScore;

        return (
          <div key={team.id} className="print-team-card mb-6 print:mb-0">
            <div className="print-team-content w-full">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:py-2 print:px-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full border-2"
                  style={{ backgroundColor: team.color }}
                />
                <CardTitle>{team.name}</CardTitle>
              </div>
              <CardDescription>Starting Value: ${initialScore}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Round</TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-red-500 text-lg">$</span>
                          <span className="text-xs">Price</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Package className="h-4 w-4" />
                          <span className="text-xs">Produced</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Wrench className="h-4 w-4 text-yellow-500" />
                          <span className="text-xs">Improve</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Microscope className="h-4 w-4 text-purple-500" />
                          <span className="text-xs">Research</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Truck className="h-4 w-4 text-blue-500" />
                          <span className="text-xs">Logistics</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="text-xs">Combo</span>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <ShoppingCart className="h-4 w-4" />
                          <span className="text-xs">Sold</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <PackageX className="h-4 w-4" />
                          <span className="text-xs">Lost</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Control</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right font-bold">Overall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gameState.rounds
                      .filter(round => round.teamData[team.id])
                      .sort((a, b) => a.roundNumber - b.roundNumber)
                      .map(round => {
                        const data = round.teamData[team.id];
                        const totalCustomersSold = data.customersSold?.length || 0;
                        const lostProducts = data.productsProduced - totalCustomersSold;
                        const overallValue = cumulativeMoney + data.totalMoney;
                        cumulativeMoney = overallValue;
                        const isExpanded = expandedRounds[`${team.id}-${round.roundNumber}`];

                        // Get improvement cards available to this team in this round
                        const availableCards = gameState.improvementCards.filter(card => 
                          card.availableForTeam === team.id && 
                          !card.used &&
                          (card.allocatedInRound || 0) <= round.roundNumber
                        );

                        return (
                          <>
                            <TableRow key={round.roundNumber} className="cursor-pointer hover:bg-muted/50 print:h-6" onClick={() => toggleRound(team.id, round.roundNumber)}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  R{round.roundNumber}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">{data.price}</TableCell>
                              <TableCell className="text-center">{data.productsProduced}</TableCell>
                              <TableCell className="text-center">{data.improvementCards}</TableCell>
                              <TableCell className="text-center">{data.researchIcons}</TableCell>
                              <TableCell className="text-center">{data.logisticsIcons}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">
                                  {data.combination}-{data.position}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">{totalCustomersSold}</TableCell>
                              <TableCell className="text-center">{lostProducts}</TableCell>
                              <TableCell className="text-right">${data.revenue.toLocaleString()}</TableCell>
                              <TableCell className="text-right">${data.controlValue}</TableCell>
                              <TableCell className="text-right">${data.totalMoney.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-bold">
                                <div className="flex items-center justify-end gap-1">
                                  <TrendingUp className="h-3 w-3 text-green-500" />
                                  ${overallValue.toLocaleString()}
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={13} className="bg-muted/20 p-4 print:p-2">
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:gap-2 print:grid-cols-3">
                                    {/* Customers Sold */}
                                    <Card className="print:shadow-none print:border-border/50">
                                      <CardHeader className="pb-3 print:pb-1 print:pt-3 print:px-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <ShoppingCart className="h-4 w-4" />
                                          Customers Sold To
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="print:p-3 print:pt-0">
                                        <div className="space-y-3 print:space-y-1">
                                          {data.customersSold && data.customersSold.length > 0 ? (
                                            <>
                                              {/* Price Customers */}
                                              {(() => {
                                                const priceCustomers = data.customersSold.filter((id: string) => id.includes('-p'));
                                                return priceCustomers.length > 0 ? (
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 bg-red-500 rounded flex-shrink-0" />
                                                    <span className="text-sm font-medium">{priceCustomers.length} Price</span>
                                                  </div>
                                                ) : null;
                                              })()}
                                              
                                              {/* Value Customers */}
                                              {(() => {
                                                const valueCustomers = data.customersSold.filter((id: string) => id.includes('-v'));
                                                return valueCustomers.length > 0 ? (
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 bg-purple-500 rounded flex-shrink-0" />
                                                    <span className="text-sm font-medium">{valueCustomers.length} Value</span>
                                                  </div>
                                                ) : null;
                                              })()}
                                              
                                              <div className="pt-2 border-t">
                                                <div className="flex justify-between items-center">
                                                  <span className="text-sm font-medium">Total Sold:</span>
                                                  <Badge variant="default">{totalCustomersSold} customers</Badge>
                                                </div>
                                              </div>
                                            </>
                                          ) : (
                                            <p className="text-sm text-muted-foreground">No customers sold to</p>
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>

                                    {/* Production & Inventory */}
                                    <Card className="print:shadow-none print:border-border/50">
                                      <CardHeader className="pb-3 print:pb-1 print:pt-3 print:px-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <Package className="h-4 w-4 text-emerald-500" />
                                          Production & Inventory
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="print:p-3 print:pt-0">
                                        <div className="space-y-3 print:space-y-1">
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                              <Box className="h-4 w-4 text-slate-700" />
                                              <span className="text-sm font-medium">Produced</span>
                                            </div>
                                            <Badge variant="outline" className="font-semibold px-2 py-0.5">
                                              {data.productsProduced}
                                            </Badge>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                              <Minus className="h-4 w-4 text-red-500" />
                                              <span className="text-sm font-medium">Sold</span>
                                            </div>
                                            <Badge variant="outline" className="font-semibold px-2 py-0.5 border-red-200 text-red-600">
                                              -{totalCustomersSold}
                                            </Badge>
                                          </div>
                                          <div className="pt-2 border-t">
                                            <div className="flex justify-between items-center">
                                              <div className="flex items-center gap-2">
                                                <PackageX className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm font-bold">Lost Products</span>
                                              </div>
                                              <Badge variant={lostProducts > 0 ? "destructive" : "secondary"} className="font-semibold px-2 py-0.5">
                                                {lostProducts}
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>

                                     {/* Improvement Cards */}
                                    <Card className="print:shadow-none print:border-border/50">
                                      <CardHeader className="pb-3 print:pb-1 print:pt-3 print:px-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <Wrench className="h-4 w-4 text-yellow-500" />
                                          Available Improvement Cards
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="print:p-3 print:pt-0">
                                        <div className="space-y-2 print:space-y-1">
                           {availableCards.map(card => (
                                             <div key={card.id} className="flex items-center gap-2">
                                               <div className="flex items-center gap-2">
                                                 {renderIconEffect(card.icon1 as IconType)}
                                                 {renderIconEffect(card.icon2 as IconType)}
                                               </div>
                                              {card.isInitial && (
                                                <Badge variant="secondary" className="text-xs">Initial</Badge>
                                              )}
                                            </div>
                                          ))}
                                          {availableCards.length === 0 && (
                                            <p className="text-sm text-muted-foreground">No cards available</p>
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>

                                     {/* Regional Presence & Sales */}
                                    <Card className="print:shadow-none print:border-border/50">
                                      <CardHeader className="pb-3 print:pb-1 print:pt-3 print:px-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <Truck className="h-4 w-4 text-blue-500" />
                                          Regional Presence and Sales
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="print:p-3 print:pt-0">
                                        <div className="space-y-2 print:space-y-1">
                                          {gameState.teamLogisticsProgress?.[team.id]?.regionsWithPresence?.map(region => {
                                            const regionData = gameState.regionLogistics[region];
                                            // Get customers sold in this region - match by region name
                                            const regionCustomers = data.customersSold?.filter((customerId: string) => {
                                              const customer = getCustomerDetails(customerId);
                                              return customer && REGION_CUSTOMERS.find(r => r.region === region)?.customers.some(c => c.id === customerId);
                                            }) || [];
                                            
                                            return (
                                              <div key={region} className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-2">
                                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                                  <span className="text-sm">{region}</span>
                                                  <Badge variant="outline" className="text-xs">
                                                    Cost: {regionData?.logisticsCost || '?'}
                                                  </Badge>
                                                </div>
                                                
                                                {/* Customer sales details */}
                                                {regionCustomers.length > 0 && (
                                                  <div className="flex items-center gap-1.5 ml-2">
                                                    <span className="text-xs text-muted-foreground">Sales:</span>
                                                    {regionCustomers.map((customerId: string) => {
                                                      const customer = getCustomerDetails(customerId);
                                                      if (!customer) return null;
                                                      
                                                      if (customer.type === 'price') {
                                                        return (
                                                          <Badge key={customerId} className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-0.5">
                                                            ${customer.price}
                                                          </Badge>
                                                        );
                                                      } else {
                                                        return (
                                                          <Badge key={customerId} className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                                                            {getTechnologyIcon(customer.technology || '')}
                                                            <span>{customer.technology}</span>
                                                          </Badge>
                                                        );
                                                      }
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                          {(!gameState.teamLogisticsProgress?.[team.id]?.regionsWithPresence || 
                                            gameState.teamLogisticsProgress[team.id].regionsWithPresence.length === 0) && (
                                            <p className="text-sm text-muted-foreground">No regional presence yet</p>
                                          )}
                                          
                                          {/* In Progress */}
                                          {Object.entries(gameState.teamLogisticsProgress?.[team.id]?.regionInvestments || {})
                                            .filter(([region, invested]) => {
                                              const hasPresence = gameState.teamLogisticsProgress?.[team.id]?.regionsWithPresence?.includes(region);
                                              return !hasPresence && invested > 0;
                                            })
                                            .map(([region, invested]) => {
                                              const regionData = gameState.regionLogistics[region];
                                              return (
                                                <div key={region} className="flex items-center gap-2">
                                                  <XCircle className="h-3 w-3 text-yellow-500" />
                                                  <span className="text-sm">{region}</span>
                                                  <Badge variant="outline" className="text-xs">
                                                    {invested}/{regionData?.logisticsCost || '?'}
                                                  </Badge>
                                                </div>
                                              );
                                            })}
                                        </div>
                                      </CardContent>
                                     </Card>

                                     {/* Control Points */}
                                     <Card className="print:shadow-none print:border-border/50">
                                       <CardHeader className="pb-3 print:pb-1 print:pt-3 print:px-3">
                                         <CardTitle className="text-sm flex items-center gap-2">
                                           <Trophy className="h-4 w-4 text-amber-500" />
                                           Control Points
                                         </CardTitle>
                                       </CardHeader>
                                       <CardContent className="print:p-3 print:pt-0">
                                         <div className="space-y-2 print:space-y-1">
                                           {data.regionControlPoints && Object.keys(data.regionControlPoints).length > 0 ? (
                                             <>
                                               {Object.entries(data.regionControlPoints)
                                                 .filter(([_, points]) => points > 0)
                                                 .map(([region, points]) => {
                                                   // Check if this team was first or second in this region
                                                   const regionLogistics = gameState.regionLogistics[region];
                                                   const teamsPresent = regionLogistics?.teamsPresent.length || 0;
                                                   const firstPlacePoints = getControlPointsForRegion(region, teamsPresent, 'first');
                                                   const isFirstPlace = points === firstPlacePoints;
                                                   
                                                   return (
                                                     <div key={region} className="flex items-center justify-between p-2 bg-background rounded border">
                                                       <div className="flex items-center gap-2">
                                                         {isFirstPlace ? (
                                                           <Trophy className="h-4 w-4 text-amber-500" />
                                                         ) : (
                                                           <Medal className="h-4 w-4 text-slate-500" />
                                                         )}
                                                         <span className="text-sm font-medium">{region}</span>
                                                         <Badge variant="outline" className="text-xs">
                                                           {teamsPresent} team{teamsPresent !== 1 ? 's' : ''}
                                                         </Badge>
                                                       </div>
                                                       <Badge className={isFirstPlace ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-500 hover:bg-slate-600'}>
                                                         +{points}
                                                       </Badge>
                                                     </div>
                                                   );
                                                 })}
                                               <div className="flex items-center justify-between pt-2 border-t">
                                                 <span className="text-sm font-semibold">Total Control</span>
                                                 <Badge variant="default" className="text-base">
                                                   {data.controlValue}
                                                 </Badge>
                                               </div>
                                             </>
                                           ) : (
                                             <p className="text-sm text-muted-foreground">No control points earned</p>
                                           )}
                                         </div>
                                       </CardContent>
                                     </Card>

                                     {/* Research & Patents */}
                                    <Card className="print:shadow-none print:border-border/50">
                                      <CardHeader className="pb-3 print:pb-1 print:pt-3 print:px-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <Microscope className="h-4 w-4 text-purple-500" />
                                          Research & Patents
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="print:p-3 print:pt-0">
                                        <div className="space-y-2 print:space-y-1">
                                          <p className="text-xs font-medium mb-2">Technologies:</p>
                                          <div className="space-y-1">
            {Object.values(gameState.technologies).map(tech => {
              const teamProgress = gameState.teamResearchProgress?.[team.id];
              const invested = teamProgress?.technologyInvestments?.[tech.name] || 0;
              const cost = getTechnologyCostForTeam ? getTechnologyCostForTeam(team.id, tech.name) : tech.researchCost;
              const isCompleted = teamProgress?.completedTechnologies?.includes(tech.name) || invested >= cost;
              const hasPatent = gameState.patents?.[tech.name] === team.id;

              return (
                <div key={tech.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {getTechnologyIcon(tech.name)}
                    <span className="text-muted-foreground">{tech.name}</span>
                    {hasPatent && (
                      <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                        Patent: {tech.maxPoints}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isCompleted ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <div className="flex items-center gap-0.5">
                        <XCircle className="h-3 w-3 text-destructive" />
                        <FlaskConical className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{invested} / {cost}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
              </Card>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};
