import React, { useMemo, useState } from 'react';
import { WorldSubState } from '@/hooks/useMultiWorldSession';
import { WorldKey } from '@/types/multiworld';
import { calculateTeamTotalScore } from '@/types/game';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, DollarSign, Globe, Sparkles, Bot, Users } from 'lucide-react';
import { getTeamDisplayLabel } from '@/lib/multiworld/teamLabel';

interface CombinedLeaderboardProps {
  worlds: WorldSubState[];
  labelMode: 'name' | 'code';
}

interface ScoredTeamEntry {
  teamId: string;
  teamName: string;
  teamColor: string;
  worldKey: WorldKey;
  worldLabel: string;
  startValue: number;
  totalScore: number;
  cumulativeRevenue: number;
  cumulativeControl: number;
  patentBonus: number;
  patentsHeld: string[];
  isBot: boolean;
  teamIndex: number;
}

export const CombinedLeaderboard: React.FC<CombinedLeaderboardProps> = ({ worlds, labelMode }) => {
  const [worldFilter, setWorldFilter] = useState<string>('ALL');

  // Compute leaderboard across all loaded worlds
  const allScoredTeams = useMemo<ScoredTeamEntry[]>(() => {
    const list: ScoredTeamEntry[] = [];

    worlds.forEach((w) => {
      const gState = w.gameState;
      if (!gState) return;

      const round = gState.currentRound || 1;
      gState.teams.forEach((t, tIdx) => {
        const score = calculateTeamTotalScore(t.id, round, gState);
        const patents = Object.entries(gState.patents || {})
          .filter(([_, holderId]) => holderId === t.id)
          .map(([tech]) => tech);

        list.push({
          teamId: t.id,
          teamName: t.name,
          teamColor: t.color,
          worldKey: w.key,
          worldLabel: w.label,
          startValue: score.startValue,
          totalScore: score.totalScore,
          cumulativeRevenue: score.cumulativeRevenue,
          cumulativeControl: score.cumulativeControl,
          patentBonus: score.patentBonus,
          patentsHeld: patents,
          isBot: !!t.isBot,
          teamIndex: tIdx,
        });
      });
    });

    list.sort((a, b) => b.totalScore - a.totalScore);
    return list;
  }, [worlds]);

  const filteredTeams = useMemo(() => {
    if (worldFilter === 'ALL') return allScoredTeams;
    return allScoredTeams.filter((t) => t.worldKey === worldFilter);
  }, [allScoredTeams, worldFilter]);

  const topLeader = allScoredTeams[0];

  const topRevenueTeam = useMemo(() => {
    if (allScoredTeams.length === 0) return null;
    return [...allScoredTeams].sort((a, b) => b.cumulativeRevenue - a.cumulativeRevenue)[0];
  }, [allScoredTeams]);

  const topControlTeam = useMemo(() => {
    if (allScoredTeams.length === 0) return null;
    return [...allScoredTeams].sort((a, b) => b.cumulativeControl - a.cumulativeControl)[0];
  }, [allScoredTeams]);

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Global Championship Leader */}
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10 border-amber-300 dark:border-amber-700/50 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Championship Leader
              </p>
              {topLeader ? (
                <div>
                  <p className="text-sm font-black truncate text-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: topLeader.teamColor }} />
                    <span className="truncate">{getTeamDisplayLabel({ name: topLeader.teamName } as any, topLeader.worldKey, labelMode)}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-800 dark:text-amber-200">
                      W{topLeader.worldKey}
                    </Badge>
                  </p>
                  <p className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {topLeader.totalScore.toLocaleString()} pts
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No teams loaded</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Highest Revenue */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border-emerald-300 dark:border-emerald-700/50 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Top Revenue Team
              </p>
              {topRevenueTeam ? (
                <div>
                  <p className="text-sm font-black truncate text-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: topRevenueTeam.color }} />
                    <span className="truncate">{getTeamDisplayLabel({ name: topRevenueTeam.teamName } as any, topRevenueTeam.worldKey, labelMode)}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-400 text-emerald-800 dark:text-emerald-200">
                      W{topRevenueTeam.worldKey}
                    </Badge>
                  </p>
                  <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ${topRevenueTeam.cumulativeRevenue.toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Control Team */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/10 border-purple-300 dark:border-purple-700/50 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-xs shrink-0">
              <Globe className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Top Control Points
              </p>
              {topControlTeam ? (
                <div>
                  <p className="text-sm font-black truncate text-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: topControlTeam.color }} />
                    <span className="truncate">{getTeamDisplayLabel({ name: topControlTeam.teamName } as any, topControlTeam.worldKey, labelMode)}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-400 text-purple-800 dark:text-purple-200">
                      W{topControlTeam.worldKey}
                    </Badge>
                  </p>
                  <p className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    +{topControlTeam.cumulativeControl} control pts
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Competition Scale */}
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-slate-700 text-white rounded-xl shadow-xs shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Competition Scale
              </p>
              <p className="text-base font-black text-foreground mt-0.5">
                {worlds.length} Worlds · {allScoredTeams.length} Teams
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allScoredTeams.filter((t) => !t.isBot).length} Humans · {allScoredTeams.filter((t) => t.isBot).length} Bots
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Leaderboard Table Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Combined Cross-World Leaderboard
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Unified standings ranking teams across all {worlds.length} parallel worlds by Total Score
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Filter World:</span>
            <Select value={worldFilter} onValueChange={setWorldFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs font-bold bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Worlds ({worlds.length})</SelectItem>
                {worlds.map((w) => (
                  <SelectItem key={w.key} value={w.key}>
                    World {w.key}: {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[70px] font-extrabold text-center">Rank</TableHead>
                  <TableHead className="w-[200px] font-extrabold">Team</TableHead>
                  <TableHead className="w-[100px] font-extrabold text-center">World</TableHead>
                  <TableHead className="text-right font-extrabold">Total Score</TableHead>
                  <TableHead className="text-right font-extrabold">Revenue</TableHead>
                  <TableHead className="text-right font-extrabold">Control Pts</TableHead>
                  <TableHead className="text-right font-extrabold">Patent Bonus</TableHead>
                  <TableHead className="text-center font-extrabold">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.length > 0 ? (
                  filteredTeams.map((entry, idx) => {
                    const globalRank = allScoredTeams.findIndex((t) => t.teamId === entry.teamId && t.worldKey === entry.worldKey) + 1;
                    const displayLabel = getTeamDisplayLabel(
                      { name: entry.teamName } as any,
                      entry.worldKey,
                      labelMode
                    );

                    return (
                      <TableRow
                        key={`${entry.worldKey}-${entry.teamId}`}
                        className={
                          globalRank === 1
                            ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-500 font-semibold'
                            : globalRank === 2
                            ? 'bg-slate-500/10 hover:bg-slate-500/15 border-l-4 border-l-slate-400 font-semibold'
                            : globalRank === 3
                            ? 'bg-amber-700/10 hover:bg-amber-700/15 border-l-4 border-l-amber-700 font-semibold'
                            : ''
                        }
                      >
                        {/* Rank Badge */}
                        <TableCell className="text-center font-black">
                          {globalRank === 1 ? (
                            <Badge className="bg-amber-500 text-white font-black px-2 py-0.5 text-xs shadow-2xs">
                              🏆 #1
                            </Badge>
                          ) : globalRank === 2 ? (
                            <Badge className="bg-slate-400 text-white font-black px-2 py-0.5 text-xs shadow-2xs">
                              🥈 #2
                            </Badge>
                          ) : globalRank === 3 ? (
                            <Badge className="bg-amber-700 text-white font-black px-2 py-0.5 text-xs shadow-2xs">
                              🥉 #3
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">#{globalRank}</span>
                          )}
                        </TableCell>

                        {/* Team Name & Color */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: entry.teamColor }} />
                            <span className="font-extrabold text-foreground">{displayLabel}</span>
                          </div>
                        </TableCell>

                        {/* World Tag */}
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-xs font-bold border-purple-300 text-purple-800 dark:text-purple-300">
                            World {entry.worldKey}
                          </Badge>
                        </TableCell>

                        {/* Total Score */}
                        <TableCell className="text-right font-mono font-black text-sm text-purple-700 dark:text-purple-400">
                          {entry.totalScore.toLocaleString()}
                        </TableCell>

                        {/* Revenue */}
                        <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${entry.cumulativeRevenue.toLocaleString()}
                        </TableCell>

                        {/* Control Points */}
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          +{entry.cumulativeControl}
                        </TableCell>

                        {/* Patent Bonus */}
                        <TableCell className="text-right font-mono font-semibold text-muted-foreground">
                          {entry.patentBonus > 0 ? (
                            <span className="text-amber-600 font-bold">+{entry.patentBonus}</span>
                          ) : (
                            '0'
                          )}
                        </TableCell>

                        {/* Type */}
                        <TableCell className="text-center">
                          {entry.isBot ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-1.5 font-normal">
                              <Bot className="h-2.5 w-2.5 mr-0.5" /> Bot
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5 font-normal">
                              Human
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground italic">
                      No team scores available for this selection.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
