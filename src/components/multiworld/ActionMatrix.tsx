import React, { useState } from 'react';
import { GameState, Team, GamePhase } from '@/types/game';
import { WorldKey } from '@/types/multiworld';
import { WorldSubState } from '@/hooks/useMultiWorldSession';
import { PHASE_SEQUENCE, PHASE_LABELS } from '@/lib/phaseEngine';
import { WorldSectionHeader } from './WorldSectionHeader';
import { ActionMatrixRow } from './ActionMatrixRow';
import { TeamDetailDrawer } from './TeamDetailDrawer';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ActionMatrixProps {
  worlds: WorldSubState[];
  labelMode: 'name' | 'code';
  selectedWorldKeys: WorldKey[];
  onToggleSelectWorld: (worldKey: WorldKey, selected: boolean) => void;
}

export function ActionMatrix({
  worlds,
  labelMode,
  selectedWorldKeys,
  onToggleSelectWorld
}: ActionMatrixProps) {
  const [selectedDrawerTeam, setSelectedDrawerTeam] = useState<{
    team: Team;
    worldKey: WorldKey;
    gameState: GameState;
    classId: string;
    worldLabel: string;
  } | null>(null);

  // Mobile filter for single world view on small screens (<= 640px)
  const [mobileWorldFilter, setMobileWorldFilter] = useState<string>('ALL');

  const activeWorlds = worlds.filter(w => mobileWorldFilter === 'ALL' || w.key === mobileWorldFilter);

  return (
    <div className="space-y-6">
      {/* Legend & Mobile Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-card border rounded-xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span className="text-muted-foreground font-bold uppercase tracking-wider mr-1">Cell Legend:</span>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
            ✓ Done
          </Badge>
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
            ◐ Partial
          </Badge>
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
            ○ Pending
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
            ⚑ $5 Default
          </Badge>
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-300">
            🤖 Bot
          </Badge>
          <Badge variant="outline" className="text-muted-foreground opacity-60">
            n/a Skipped
          </Badge>
        </div>

        {/* Mobile World Filter */}
        <div className="sm:hidden flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Filter World:</span>
          <Select value={mobileWorldFilter} onValueChange={setMobileWorldFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Worlds</SelectItem>
              {worlds.map(w => (
                <SelectItem key={w.key} value={w.key}>
                  World {w.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Matrix Tables per World */}
      <div className="space-y-6">
        {activeWorlds.map(w => {
          const gState = w.gameState;
          const classData = w.classData;
          const teams = gState?.teams || [];

          return (
            <div key={w.key} className="space-y-2">
              <WorldSectionHeader
                worldKey={w.key}
                worldLabel={w.label}
                classId={w.classId}
                gameState={gState}
                isSelected={selectedWorldKeys.includes(w.key)}
                onToggleSelect={(sel) => onToggleSelectWorld(w.key, sel)}
              />

              <div className="border rounded-xl overflow-hidden shadow-xs bg-card">
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[180px] font-extrabold sticky left-0 bg-muted z-20 border-r">
                          Team
                        </TableHead>
                        {PHASE_SEQUENCE.map(phaseKey => (
                          <TableHead key={phaseKey} className="text-center font-bold text-xs whitespace-nowrap min-w-[90px]">
                            {PHASE_LABELS[phaseKey] || phaseKey}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold text-xs min-w-[70px]">
                          Score
                        </TableHead>
                        <TableHead className="text-center font-bold text-xs min-w-[70px]">
                          Cash
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gState && teams.length > 0 ? (
                        teams.map(team => (
                          <ActionMatrixRow
                            key={team.id}
                            team={team}
                            worldKey={w.key}
                            gameState={gState}
                            labelMode={labelMode}
                            onSelectTeam={(t, wk, gs) => {
                              setSelectedDrawerTeam({
                                team: t,
                                worldKey: wk,
                                gameState: gs,
                                classId: w.classId,
                                worldLabel: w.label
                              });
                            }}
                          />
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-6 text-xs text-muted-foreground italic">
                            Waiting for world game state to initialize...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Team Detail Drawer */}
      <TeamDetailDrawer
        isOpen={!!selectedDrawerTeam}
        onClose={() => setSelectedDrawerTeam(null)}
        team={selectedDrawerTeam?.team || null}
        worldKey={selectedDrawerTeam?.worldKey || null}
        classId={selectedDrawerTeam?.classId || null}
        worldLabel={selectedDrawerTeam?.worldLabel || ''}
        gameState={selectedDrawerTeam?.gameState || null}
      />
    </div>
  );
}
