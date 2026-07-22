import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGame } from '@/contexts/GameContext';
import { REGION_CUSTOMERS } from '@/data/customers';
import { TEAM_COLORS } from '@/data/combinations';
import { Trophy, Medal, Truck, DollarSign, Package, Globe, Microscope, Users, Sparkles, CheckCircle } from 'lucide-react';
import { getControlPointsForRegion } from '@/data/control';
import { getControlPointsForTeamInRound, getTeamPatentPoints } from '@/types/game';

interface SummaryMapProps {
  initialRound?: number;
}

const COLOR_SCORES: Record<string, number> = {
  green: 3,
  blue: 4,
  black: 5,
  yellow: 6,
  red: 7
};

export const SummaryMap = ({ initialRound }: SummaryMapProps) => {
  const { gameState } = useGame();

  if (!gameState) return null;

  const maxAvailableRound = Math.max(1, gameState.currentRound);
  const [selectedRound, setSelectedRound] = useState<number>(() => {
    return initialRound || gameState.currentRound;
  });

  const activeRoundNumber = Math.min(selectedRound, maxAvailableRound);
  const roundData = gameState.rounds.find(r => r.roundNumber === activeRoundNumber);

  const colorNameFromHex = (hex: string): string => {
    const found = TEAM_COLORS.find(c => c.value.toLowerCase() === (hex || '').toLowerCase());
    return found ? found.name.toLowerCase() : '';
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

  const getControlPointsForTeamInRound = (roundNum: number, teamId: string): number => {
    const rd = gameState.rounds.find(r => r.roundNumber === roundNum);
    if (!rd) return 0;

    let totalPoints = 0;

    REGION_CUSTOMERS.forEach(({ region, customers }) => {
      const regionLogisticsData = gameState.regionLogistics[region];
      const teamsPresent = regionLogisticsData?.teamsPresent || [];

      const teamSales: Array<{ teamId: string; salesCount: number; leftmostPos: number }> = [];

      gameState.teams.forEach(t => {
        const tData = rd.teamData[t.id];
        if (!tData || !tData.customersSold) return;

        const soldInRegion = tData.customersSold.filter(cid => customers.some(c => c.id === cid));
        if (soldInRegion.length > 0) {
          let minPos = Infinity;
          soldInRegion.forEach(cid => {
            const cust = customers.find(c => c.id === cid);
            if (cust && cust.position < minPos) minPos = cust.position;
          });

          teamSales.push({
            teamId: t.id,
            salesCount: soldInRegion.length,
            leftmostPos: minPos === Infinity ? 999 : minPos,
          });
        }
      });

      teamSales.sort((a, b) => {
        if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
        return a.leftmostPos - b.leftmostPos;
      });

      if (teamSales[0] && teamSales[0].teamId === teamId) {
        totalPoints += getControlPointsForRegion(region, teamsPresent.length, 'first');
      } else if (teamSales[1] && teamSales[1].teamId === teamId) {
        totalPoints += getControlPointsForRegion(region, teamsPresent.length, 'second');
      }
    });

    return totalPoints;
  };

  // Team scores up to the selected round
  const teamStandings = useMemo(() => {
    return gameState.teams.map(team => {
      const startValue = getInitialScore(team);
      let cumulativeRevenue = 0;
      let cumulativeControl = 0;
      let roundRevenue = 0;
      let roundControl = 0;
      let roundSales = 0;
      let roundPrice = 0;

      for (let r = 1; r <= activeRoundNumber; r++) {
        const roundObj = gameState.rounds.find(rd => rd.roundNumber === r);
        const rData = roundObj?.teamData[team.id];
        if (rData) {
          const rev = rData.revenue || 0;
          const ctrl = getControlPointsForTeamInRound(roundObj, team.id, gameState);

          if (r < activeRoundNumber) {
            cumulativeRevenue += rev;
            cumulativeControl += ctrl;
          } else {
            roundRevenue = rev;
            roundControl = ctrl;
            roundSales = rData.customersSold ? rData.customersSold.length : 0;
            roundPrice = rData.price || 0;
          }
        }
      }

      const roundScore = roundRevenue + roundControl;
      const patentBonus = getTeamPatentPoints(team.id, gameState.patents, activeRoundNumber);
      const totalScore = startValue + roundRevenue + roundControl + cumulativeRevenue + cumulativeControl + patentBonus;
      const techProgress = gameState.teamResearchProgress[team.id]?.completedTechnologies || [];
      const logisticsProgress = gameState.teamLogisticsProgress[team.id]?.regionsWithPresence || [];

      return {
        team,
        startValue,
        roundRevenue,
        roundControl,
        roundScore,
        roundSales,
        roundPrice,
        patentBonus,
        cumulativeRevenue, // Prior Rounds Revenue (Rounds 1..activeRound-1)
        cumulativeControl, // Prior Rounds Control (Rounds 1..activeRound-1)
        totalScore,
        techProgress,
        logisticsProgress,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [gameState, activeRoundNumber]);

  // Regional Sales & Control breakdown for selected round
  const regionalBreakdown = useMemo(() => {
    return REGION_CUSTOMERS.map(({ region, customers }) => {
      const regionLogisticsData = gameState.regionLogistics[region];
      const teamsPresent = regionLogisticsData?.teamsPresent || [];

      // Sales details per team in this region
      const salesDetails: Array<{
        teamId: string;
        teamName: string;
        teamColor: string;
        unitsSold: number;
        revenue: number;
        leftmostPos: number;
      }> = [];

      gameState.teams.forEach(team => {
        const tData = roundData?.teamData[team.id];
        if (!tData || !tData.customersSold) return;

        const soldInRegion = tData.customersSold.filter(cid => customers.some(c => c.id === cid));
        if (soldInRegion.length > 0) {
          let minPos = Infinity;
          soldInRegion.forEach(cid => {
            const cust = customers.find(c => c.id === cid);
            if (cust && cust.position < minPos) minPos = cust.position;
          });

          const price = tData.price || 0;
          salesDetails.push({
            teamId: team.id,
            teamName: team.name,
            teamColor: team.color,
            unitsSold: soldInRegion.length,
            revenue: soldInRegion.length * price,
            leftmostPos: minPos === Infinity ? 999 : minPos,
          });
        }
      });

      // Sort for control points: sales desc, tie-breaker leftmostPos asc
      const sortedSales = [...salesDetails].sort((a, b) => {
        if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
        return a.leftmostPos - b.leftmostPos;
      });

      const firstPlace = sortedSales[0] ? {
        ...sortedSales[0],
        points: getControlPointsForRegion(region, teamsPresent.length, 'first'),
      } : null;

      const secondPlace = sortedSales[1] ? {
        ...sortedSales[1],
        points: getControlPointsForRegion(region, teamsPresent.length, 'second'),
      } : null;

      // Customer fulfillment details
      const customerStatus = customers.map(c => {
        let buyerTeam = null;
        if (roundData) {
          for (const team of gameState.teams) {
            const tData = roundData.teamData[team.id];
            if (tData?.customersSold?.includes(c.id)) {
              buyerTeam = team;
              break;
            }
          }
        }
        return { customer: c, buyerTeam };
      });

      return {
        region,
        customers,
        teamsPresent,
        salesDetails,
        firstPlace,
        secondPlace,
        customerStatus,
      };
    });
  }, [gameState, roundData]);

  // Round summary totals
  const totalRoundSales = useMemo(() => {
    return regionalBreakdown.reduce((sum, r) => sum + r.salesDetails.reduce((s, d) => s + d.unitsSold, 0), 0);
  }, [regionalBreakdown]);

  const totalRoundRevenue = useMemo(() => {
    return regionalBreakdown.reduce((sum, r) => sum + r.salesDetails.reduce((s, d) => s + d.revenue, 0), 0);
  }, [regionalBreakdown]);

  return (
    <div className="space-y-6">
      {/* Header with Round Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-card rounded-xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2 text-foreground">
            <Globe className="h-7 w-7 text-emerald-500" />
            End of Round Summary Map
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete overview of Sales, Regional Control, Technology, and Logistics for Round {activeRoundNumber}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-muted/60 p-2 rounded-lg border">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Select Round:
          </span>
          <Select
            value={activeRoundNumber.toString()}
            onValueChange={(val) => setSelectedRound(parseInt(val))}
          >
            <SelectTrigger className="w-[140px] h-9 bg-background border-border font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxAvailableRound }, (_, i) => i + 1).map(r => (
                <SelectItem key={r} value={r.toString()} className="font-semibold">
                  Round {r} {r === gameState.currentRound ? '(Current)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Round Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total Revenue (R{activeRoundNumber})</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                ${totalRoundRevenue.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total Sales Units</p>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                {totalRoundSales} units
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Active Leader</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 truncate">
                {teamStandings[0]?.team.name || 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Microscope className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Max Techs Unlocked</p>
              <p className="text-xl font-black text-purple-600 dark:text-purple-400">
                {Math.max(...teamStandings.map(t => t.techProgress.length), 0)} Techs
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regional Summary Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Globe className="h-5 w-5 text-cyan-500" />
          Regional Map & Performance Breakdown — Round {activeRoundNumber}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {regionalBreakdown.map(({ region, customers, teamsPresent, salesDetails, firstPlace, secondPlace, customerStatus }) => {
            return (
              <Card key={region} className="border-border/80 shadow-md hover:border-cyan-500/50 transition-colors flex flex-col">
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Truck className="h-4 w-4 text-cyan-500" />
                      {region}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {teamsPresent.length} Teams Present
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
                  {/* Control Winners */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Regional Control Winners
                    </span>

                    {firstPlace ? (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: firstPlace.teamColor }} />
                          <span className="font-bold truncate">{firstPlace.teamName}</span>
                          <span className="text-muted-foreground text-[11px]">({firstPlace.unitsSold} sales)</span>
                        </div>
                        <Badge className="bg-amber-500 text-white font-black text-[10px]">
                          +{firstPlace.points} pts
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic p-2 bg-muted/40 rounded border">
                        No sales recorded in Round {activeRoundNumber}
                      </p>
                    )}

                    {secondPlace && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Medal className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: secondPlace.teamColor }} />
                          <span className="font-semibold truncate">{secondPlace.teamName}</span>
                          <span className="text-muted-foreground text-[11px]">({secondPlace.unitsSold} sales)</span>
                        </div>
                        <Badge className="bg-slate-500 text-white font-bold text-[10px]">
                          +{secondPlace.points} pts
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Team Sales Breakdown */}
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Team Sales & Revenue
                    </span>
                    {salesDetails.length > 0 ? (
                      <div className="space-y-1">
                        {salesDetails.map(s => (
                          <div key={s.teamId} className="flex items-center justify-between text-xs p-1.5 bg-card/70 rounded border border-border/50">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.teamColor }} />
                              <span className="font-medium truncate">{s.teamName}</span>
                            </div>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {s.unitsSold} units (${s.revenue.toLocaleString()})
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No sales activity</p>
                    )}
                  </div>

                  {/* Customer Status Pills */}
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Customer Demand Status
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {customerStatus.map(({ customer, buyerTeam }) => (
                        <Badge
                          key={customer.id}
                          variant={buyerTeam ? "default" : "outline"}
                          className={`text-[10px] gap-1 px-1.5 py-0.5 ${
                            buyerTeam ? 'border-emerald-500/50' : 'opacity-60'
                          }`}
                          style={buyerTeam ? { backgroundColor: buyerTeam.color + '25', borderColor: buyerTeam.color, color: 'inherit' } : undefined}
                          title={buyerTeam ? `Sold to ${buyerTeam.name}` : `Unsold customer`}
                        >
                          {customer.type === 'price' ? `$${customer.price}` : customer.technology}
                          {buyerTeam && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Standings & Cumulative Leaderboard for Selected Round */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Cumulative Standings — Round {activeRoundNumber}
          </CardTitle>
          <CardDescription>
            Combined performance including Starting Value, Revenue, Control Points, and Technologies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 bg-muted/60 p-3 rounded-lg border text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Total Score Formula:
            </span>
            <code className="bg-background px-2 py-1 rounded border text-foreground font-mono">
              Total Score = Starting Value + Round Score (Revenue + Control) + Prior Revenue + Prior Control + Patent Bonus
            </code>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Round Sales</TableHead>
                  <TableHead className="text-right">Round Price</TableHead>
                  <TableHead className="text-right">Round Revenue</TableHead>
                  <TableHead className="text-right">Round Control</TableHead>
                  <TableHead className="text-right font-bold text-cyan-600 dark:text-cyan-400">Round Score</TableHead>
                  <TableHead className="text-right">Starting Value</TableHead>
                  <TableHead className="text-right" title="Revenue from rounds prior to current round">Prior Revenue</TableHead>
                  <TableHead className="text-right" title="Control points from rounds prior to current round">Prior Control</TableHead>
                  <TableHead className="text-right font-semibold text-purple-600 dark:text-purple-400">Patent Bonus</TableHead>
                  <TableHead className="text-right font-black">Total Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamStandings.map((item, idx) => (
                  <TableRow key={item.team.id} className={idx === 0 ? 'bg-amber-500/10 font-semibold' : ''}>
                    <TableCell className="font-bold">#{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.team.color }} />
                        <span className="font-bold">{item.team.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.roundSales} units</TableCell>
                    <TableCell className="text-right">${item.roundPrice}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      ${item.roundRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-amber-600 dark:text-amber-400">
                      +{item.roundControl} pts
                    </TableCell>
                    <TableCell className="text-right font-bold text-cyan-600 dark:text-cyan-400">
                      {item.roundScore.toLocaleString()} pts
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-500 dark:text-slate-400">
                      {item.startValue} pts
                    </TableCell>
                    <TableCell className="text-right">${item.cumulativeRevenue.toLocaleString()}</TableCell>
                    <TableCell className="text-right">+{item.cumulativeControl} pts</TableCell>
                    <TableCell className="text-right font-semibold text-purple-600 dark:text-purple-400">
                      +{item.patentBonus} pts
                    </TableCell>
                    <TableCell className="text-right font-black text-lg text-primary">
                      {item.totalScore.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
