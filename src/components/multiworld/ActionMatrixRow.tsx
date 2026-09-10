import React from 'react';
import { GameState, Team, GamePhase } from '@/types/game';
import { WorldKey } from '@/types/multiworld';
import { deriveTeamPhaseStatus } from '@/lib/multiworld/actionMatrix';
import { getTeamCode, getTeamDisplayLabel } from '@/lib/multiworld/teamLabel';
import { PHASE_SEQUENCE } from '@/lib/phaseEngine';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActionMatrixRowProps {
  team: Team;
  worldKey: WorldKey;
  gameState: GameState;
  labelMode: 'name' | 'code';
  onSelectTeam: (team: Team, worldKey: WorldKey, gameState: GameState) => void;
}

export function ActionMatrixRow({
  team,
  worldKey,
  gameState,
  labelMode,
  onSelectTeam
}: ActionMatrixRowProps) {
  const round = gameState.currentRound || 1;
  const rawPhase = (gameState.currentPhase || 'planning').toLowerCase();
  const currentPhaseKey = rawPhase === 'research' ? 'innovation' : (rawPhase === 'logistics' ? 'expansion' : rawPhase) as GamePhase;
  const roundData = gameState.rounds?.find(r => r.roundNumber === round);
  const tData = roundData?.teamData?.[team.id];

  const teamCode = getTeamCode(team, worldKey);
  const displayLabel = getTeamDisplayLabel(team, worldKey, labelMode);
  const isBot = !!(team.isBot || (team as any).accessCode === 'BOT' || (team as any).code === 'BOT');

  return (
    <TableRow
      className="hover:bg-muted/60 cursor-pointer transition-colors text-xs"
      onClick={() => onSelectTeam(team, worldKey, gameState)}
    >
      {/* Team Column */}
      <TableCell className="font-bold sticky left-0 bg-card z-10 border-r shadow-xs">
        <div className="flex items-center gap-2 truncate max-w-[160px]">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: team.color }}
          />
          <span className="truncate font-extrabold" title={`${team.name} (${teamCode})`}>
            {displayLabel}
          </span>
          {isBot && <span className="text-[10px] text-muted-foreground shrink-0">🤖</span>}
        </div>
      </TableCell>

      {/* Phase Columns */}
      {PHASE_SEQUENCE.map(phaseKey => {
        const status = deriveTeamPhaseStatus(gameState, team.id, phaseKey);
        const isCurrentColumn = phaseKey === currentPhaseKey;

        let bgClass = 'bg-transparent text-muted-foreground';

        if (status.status === 'done') {
          bgClass = status.label.includes('⚑')
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30'
            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30';
        } else if (status.status === 'partial') {
          bgClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/30';
        } else if (status.status === 'pending') {
          bgClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold animate-pulse';
        } else if (status.status === 'bot') {
          bgClass = 'bg-purple-500/10 text-purple-600 dark:text-purple-300 font-semibold';
        } else if (status.status === 'na') {
          bgClass = 'text-muted-foreground/60 opacity-60';
        }

        return (
          <TableCell
            key={phaseKey}
            className={cn(
              "text-center py-2 px-2 transition-all",
              isCurrentColumn && "ring-1 ring-primary/40 bg-primary/5 font-extrabold"
            )}
          >
            <span className={cn("inline-block px-2 py-1 rounded-md text-[11px] whitespace-nowrap", bgClass)} title={status.detail || status.label}>
              {status.label}
            </span>
          </TableCell>
        );
      })}

      {/* Score */}
      <TableCell className="text-center font-bold text-foreground">
        {tData ? (tData.revenue || 0) + (tData.controlValue || 0) : 0}
      </TableCell>

      {/* Cash */}
      <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400">
        ${tData?.totalMoney ?? 0}
      </TableCell>
    </TableRow>
  );
}
