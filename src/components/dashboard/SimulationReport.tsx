import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame } from '@/contexts/GameContext';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Wrench, Microscope, Truck, ShoppingCart, PackageX, TrendingUp, ChevronDown, ChevronRight, MapPin, Award, Download, Plus, Minus, CheckCircle, XCircle, FlaskConical, Wifi, Battery, Gamepad2, MapPinned, Nfc, Radio, Trophy, Medal, Box, Users } from 'lucide-react';
import { GameIcon } from './GameIcon';
import { TEAM_COLORS } from '@/data/combinations';
import { Button } from '@/components/ui/button';
import { useState, useRef, Fragment } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useReactToPrint } from 'react-to-print';
import { IconType } from '@/data/improvements';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import { useSession } from '@/contexts/SessionContext';
import { calculateTeamTotalScore, getControlPointsForTeamInRound, getInitialScore, getRegionalControlBreakdownForTeamInRound, getTeamPatentPoints } from '@/types/game';

export const SimulationReport = () => {
  const { gameState, getTechnologyCostForTeam } = useGame();
  const { currentRole, currentTeamId } = useSession();
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});
  const [showCompetitors, setShowCompetitors] = useState(false);
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
            <div className="relative inline-block" title="Price Increase (+$1)">
              <GameIcon type="price" size="xs" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black border border-emerald-500/80 flex items-center justify-center shadow-sm">
                <Plus className="h-2.5 w-2.5 text-emerald-400 stroke-[3]" />
              </div>
            </div>
            <span className="font-bold text-emerald-500">+1 Price</span>
          </div>
        );
      case 'Price and Product':
        return (
          <div className="flex items-center gap-1 text-xs">
            <div className="relative inline-block" title="Price Decrease (-$1)">
              <GameIcon type="price" size="xs" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black border border-red-500/80 flex items-center justify-center shadow-sm">
                <Minus className="h-2.5 w-2.5 text-red-500 stroke-[3]" />
              </div>
            </div>
            <span className="font-bold text-red-500">-1 Price</span>
            <GameIcon type="production" size="xs" />
          </div>
        );
      case 'Product':
        return (
          <div className="flex items-center gap-1 text-xs">
            <GameIcon type="production" size="xs" />
          </div>
        );
      case 'Research':
        return (
          <div className="flex items-center gap-1 text-xs">
            <GameIcon type="research" size="xs" />
          </div>
        );
      case 'Logistic':
        return (
          <div className="flex items-center gap-1 text-xs">
            <GameIcon type="logistics" size="xs" />
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



  const renderTeamCard = (team: typeof gameState.teams[0], isMyTeam: boolean = false) => {
    const initialScore = getInitialScore(team);
    let cumulativeMoney = initialScore;

    return (
      <div key={team.id} className="print-team-card mb-6 print:mb-0">
        <div className="print-team-content w-full">
          <Card className={`print:border-0 print:shadow-none ${isMyTeam ? 'border-2 border-primary/50 bg-primary/[0.02]' : ''}`}>
            <CardHeader className="print:py-2 print:px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full border-2" style={{ backgroundColor: team.color }} />
                  <CardTitle>{team.name}</CardTitle>
                  {isMyTeam && <Badge className="bg-primary text-white font-bold text-xs">Your Team</Badge>}
                </div>
                <CardDescription>Starting Value: ${initialScore}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile Cards View (<640px) */}
              <div className="space-y-3 block sm:hidden">
                {(() => {
                  const teamRounds = gameState.rounds
                    .filter(round => round.teamData && round.teamData[team.id])
                    .sort((a, b) => a.roundNumber - b.roundNumber);

                  if (teamRounds.length === 0) {
                    return <p className="text-center py-4 text-xs text-muted-foreground">No round performance submitted yet for {team.name}.</p>;
                  }

                  return teamRounds.map(round => {
                    const data = round.teamData[team.id];
                    const totalCustomersSold = data.customersSold?.length || 0;
                    const lostProducts = data.productsProduced - totalCustomersSold;
                    const roundControl = getControlPointsForTeamInRound(round, team.id, gameState);
                    const patentBonus = getTeamPatentPoints(team.id, gameState.patents, round.roundNumber);
                    const scoreBreakdown = calculateTeamTotalScore(team.id, round.roundNumber, gameState);
                    const overallValue = scoreBreakdown.totalScore;
                    const isExpanded = expandedRounds[`${team.id}-${round.roundNumber}`];

                    return (
                      <div key={round.roundNumber} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary text-primary-foreground font-black text-xs px-2 py-0.5">
                              Round {round.roundNumber}
                            </Badge>
                            <Badge variant="outline" className="text-xs font-semibold">
                              Combo {data.combination}-{data.position}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Points</span>
                            <span className="text-sm font-black text-primary">{overallValue.toLocaleString()} pts</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1 text-center text-xs">
                          <div className="bg-muted/40 p-1 rounded-lg">
                            <span className="text-[10px] text-muted-foreground block">Price</span>
                            <span className="font-bold">${data.price}</span>
                          </div>
                          <div className="bg-muted/40 p-1 rounded-lg">
                            <span className="text-[10px] text-muted-foreground block">Prod</span>
                            <span className="font-bold">{data.productsProduced}</span>
                          </div>
                          <div className="bg-muted/40 p-1 rounded-lg">
                            <span className="text-[10px] text-muted-foreground block">Revenue</span>
                            <span className="font-bold text-success">${(data.revenue || 0).toLocaleString()}</span>
                          </div>
                          <div className="bg-muted/40 p-1 rounded-lg">
                            <span className="text-[10px] text-muted-foreground block">Control</span>
                            <span className="font-bold text-warning">+{roundControl} pts</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="text-xs text-muted-foreground flex gap-2">
                            <span>Sold: <strong>{totalCustomersSold}</strong></span>
                            <span>Lost: <strong className="text-destructive">{lostProducts}</strong></span>
                            {patentBonus > 0 && <span className="text-purple-400">Patent: <strong>+{patentBonus}</strong></span>}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRound(team.id, round.roundNumber)}
                            className="h-7 text-xs gap-1 font-semibold text-primary"
                          >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            {isExpanded ? 'Hide Details' : 'Details'}
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="pt-3 border-t border-border/60 space-y-2.5 text-xs">
                            {/* Customers Sold */}
                            <div className="p-2.5 bg-muted/40 rounded-lg space-y-1">
                              <span className="font-bold block text-foreground">Customers Sold To ({totalCustomersSold}):</span>
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {(() => {
                                  const priceCust = data.customersSold?.filter((id: string) => id.includes('-p')) || [];
                                  const valueCust = data.customersSold?.filter((id: string) => id.includes('-v')) || [];
                                  return (
                                    <>
                                      {priceCust.length > 0 && <Badge variant="destructive" className="text-[10px]">{priceCust.length} Price Customers</Badge>}
                                      {valueCust.length > 0 && <Badge variant="default" className="text-[10px] bg-primary">{valueCust.length} Value Customers</Badge>}
                                      {priceCust.length === 0 && valueCust.length === 0 && <span className="text-muted-foreground italic text-[10px]">No sales</span>}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Regional Control Points */}
                            <div className="p-2.5 bg-muted/40 rounded-lg space-y-1">
                              <div className="flex justify-between font-bold text-foreground">
                                <span>Regional Control Breakdown:</span>
                                <span className="text-warning">+{roundControl} pts</span>
                              </div>
                              <div className="space-y-0.5 pt-0.5">
                                {(() => {
                                  const breakdown = getRegionalControlBreakdownForTeamInRound(round, team.id, gameState);
                                  if (breakdown.length === 0) return <span className="text-[10px] text-muted-foreground italic">No control points in this round</span>;
                                  return breakdown.map(detail => (
                                    <div key={detail.region} className="flex justify-between text-[11px]">
                                      <span>{detail.region} ({detail.rank === 'first' ? '1st Place' : '2nd Place'})</span>
                                      <span className="font-semibold">+{detail.points} pts</span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Desktop Table View (>=640px) */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Round</TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <GameIcon type="price" size="xs" />
                          <span className="text-xs">Price</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <GameIcon type="production" size="xs" />
                          <span className="text-xs">Produced</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <GameIcon type="improvement" size="xs" />
                          <span className="text-xs">Improvement</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <GameIcon type="research" size="xs" />
                          <span className="text-xs">Research</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <GameIcon type="logistics" size="xs" />
                          <span className="text-xs">Logistics</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="text-xs font-semibold">Combo</span>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <ShoppingCart className="h-4 w-4" />
                          <span className="text-xs">Sold</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <PackageX className="h-4 w-4 text-destructive" />
                          <span className="text-xs">Unsold</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-success text-sm">$</span>
                          <span className="text-xs">Revenue</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Trophy className="h-4 w-4 text-warning" />
                          <span className="text-xs">Control</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-semibold">Round Score</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Award className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs">Patent Bonus</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right font-bold">
                        <div className="flex flex-col items-end gap-1">
                          <TrendingUp className="h-4 w-4 text-success" />
                          <span className="text-xs font-bold text-foreground">Total Points</span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const teamRounds = gameState.rounds
                        .filter(round => round.teamData && round.teamData[team.id])
                        .sort((a, b) => a.roundNumber - b.roundNumber);

                      if (teamRounds.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={14} className="text-center py-6 text-muted-foreground text-sm">
                              No round performance submitted yet for {team.name}.
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return teamRounds.map(round => {
                        const data = round.teamData[team.id];
                        const totalCustomersSold = data.customersSold?.length || 0;
                        const lostProducts = data.productsProduced - totalCustomersSold;
                        const roundControl = getControlPointsForTeamInRound(round, team.id, gameState);
                        const patentBonus = getTeamPatentPoints(team.id, gameState.patents, round.roundNumber);
                        const scoreBreakdown = calculateTeamTotalScore(team.id, round.roundNumber, gameState);
                        const overallValue = scoreBreakdown.totalScore;
                        const isExpanded = expandedRounds[`${team.id}-${round.roundNumber}`];

                        // Get improvement cards available to this team in this round
                        const availableCards = gameState.improvementCards.filter(card => 
                          card.availableForTeam === team.id && 
                          !card.used &&
                          (card.allocatedInRound || 0) <= round.roundNumber
                        );

                        return (
                          <Fragment key={round.roundNumber}>
                            <TableRow className="cursor-pointer hover:bg-muted/50 print:h-6" onClick={() => toggleRound(team.id, round.roundNumber)}>
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
                              <TableCell className="text-right">${(data.revenue || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right">+{roundControl} pts</TableCell>
                              <TableCell className="text-right font-medium">{((data.revenue || 0) + roundControl).toLocaleString()} pts</TableCell>
                              <TableCell className="text-right font-medium text-muted-foreground dark:text-purple-400">
                                {patentBonus > 0 ? `+${patentBonus} pts` : '-'}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                <div className="flex items-center justify-end gap-1">
                                  <TrendingUp className="h-3 w-3 text-success" />
                                  {overallValue.toLocaleString()} pts
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={14} className="bg-muted/20 p-4 print:p-2">
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
                                                    <div className="w-4 h-4 bg-destructive rounded flex-shrink-0" />
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
                                          <Package className="h-4 w-4 text-success" />
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
                                              <Minus className="h-4 w-4 text-destructive" />
                                              <span className="text-sm font-medium">Sold</span>
                                            </div>
                                            <Badge variant="outline" className="font-semibold px-2 py-0.5 border-red-200 text-destructive">
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
                                          <Wrench className="h-4 w-4 text-warning" />
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
                                          <Truck className="h-4 w-4 text-primary" />
                                          Regional Presence and Sales
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="print:p-3 print:pt-0">
                                        <div className="space-y-2 print:space-y-1">
                                          {gameState.teamLogisticsProgress?.[team.id]?.regionsWithPresence?.map(region => {
                                            const soldInRegion = data.customersSold?.filter((cid: string) => {
                                              const regionData = REGION_CUSTOMERS.find(r => r.region === region);
                                              return regionData?.customers.some(c => c.id === cid);
                                            })?.length || 0;

                                            return (
                                              <div key={region} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5">
                                                  <CheckCircle className="h-3 w-3 text-success" />
                                                  <span className="font-medium">{region}</span>
                                                </div>
                                                <Badge variant="outline" className="text-xs font-semibold">
                                                  {soldInRegion} sold
                                                </Badge>
                                              </div>
                                            );
                                          })}
                                          
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
                                                  <XCircle className="h-3 w-3 text-warning" />
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
                                           <Trophy className="h-4 w-4 text-warning" />
                                           Control Points ({roundControl} pts)
                                         </CardTitle>
                                       </CardHeader>
                                       <CardContent className="print:p-3 print:pt-0">
                                         <div className="space-y-2 print:space-y-1">
                                           {(() => {
                                             const breakdown = getRegionalControlBreakdownForTeamInRound(round, team.id, gameState);
                                             if (breakdown.length === 0) {
                                               return <p className="text-xs text-muted-foreground">No regional control points earned in this round</p>;
                                             }
                                             return breakdown.map(detail => (
                                               <div key={detail.region} className="flex items-center justify-between p-2 bg-background rounded border text-xs">
                                                 <div className="flex items-center gap-1.5">
                                                   <Trophy className={`h-3.5 w-3.5 ${detail.rank === 'first' ? 'text-warning' : 'text-slate-400'}`} />
                                                   <span className="font-semibold">{detail.region}</span>
                                                   <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                     {detail.rank === 'first' ? '1st Place' : '2nd Place'}
                                                   </Badge>
                                                 </div>
                                                 <Badge className={detail.rank === 'first' ? 'bg-warning text-white' : 'bg-slate-500 text-white'}>
                                                   +{detail.points} pts
                                                 </Badge>
                                               </div>
                                             ));
                                           })()}
                                           <div className="flex items-center justify-between pt-2 border-t mt-2">
                                             <span className="text-xs font-bold">Total Round Control</span>
                                             <Badge variant="default" className="text-sm bg-warning text-white">
                                               +{roundControl} pts
                                             </Badge>
                                           </div>
                                         </div>
                                       </CardContent>
                                     </Card>

                                     {/* Research & Patents */}
                                    <Card className="print:shadow-none print:border-border/50">
                                      <CardHeader className="pb-3 print:pb-1 print:pt-3 print:px-3">
                                         <CardTitle className="text-sm flex items-center gap-2">
                                           <GameIcon type="research" size="xs" />
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
                                                      <Badge variant="default" className="bg-warning hover:bg-warning text-white text-xs px-2 py-0.5 flex items-center gap-1">
                                                        Patent: {tech.maxPoints}
                                                      </Badge>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    {isCompleted ? (
                                                      <CheckCircle className="h-3 w-3 text-success" />
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
                          </Fragment>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
              </Card>
            </div>
          </div>
        );
  };

  // Render for Student / Team view (shows User's Team on top, competitors collapsed below)
  if (currentRole === 'STUDENT' && currentTeamId) {
    const myTeam = gameState.teams.find(t => t.id === currentTeamId);
    const competitorTeams = gameState.teams.filter(t => t.id !== currentTeamId);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Simulation Report</h2>
            <p className="text-muted-foreground">
              Performance report for {myTeam?.name || 'your team'} and competitors
            </p>
          </div>
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>

        <div ref={reportRef} className="print:text-xs space-y-4">
          {/* User's Own Team Report Card */}
          {myTeam && renderTeamCard(myTeam, true)}

          {/* Competitor Teams Collapsible Stack */}
          {competitorTeams.length > 0 && (
            <Collapsible open={showCompetitors} onOpenChange={setShowCompetitors} className="space-y-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-between p-4 h-auto border-dashed border-2 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Competitor Teams Performance ({competitorTeams.length} Teams)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{showCompetitors ? 'Hide Competitors' : 'View Competitors'}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showCompetitors ? 'rotate-180' : ''}`} />
                  </div>
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-4 pt-2">
                {competitorTeams.map(team => renderTeamCard(team, false))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    );
  }

  // Render for Facilitator / Admin view (shows all teams stacked open as default)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight">Simulation Report</h2>
          <p className="text-muted-foreground">Complete performance overview for all teams across all rounds</p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div ref={reportRef} className="print:text-xs">
        {gameState.teams.map(team => renderTeamCard(team, false))}
      </div>
    </div>
  );
};
