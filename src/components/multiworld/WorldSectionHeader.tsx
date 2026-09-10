import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { GameState } from '@/types/game';
import { WorldKey } from '@/types/multiworld';
import { getBlockingTeams, PHASE_LABELS } from '@/lib/phaseEngine';
import { ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

interface WorldSectionHeaderProps {
  worldKey: WorldKey;
  worldLabel: string;
  classId: string;
  gameState: GameState | null;
  isSelected?: boolean;
  onToggleSelect?: (selected: boolean) => void;
  showCheckbox?: boolean;
}

export function WorldSectionHeader({
  worldKey,
  worldLabel,
  classId,
  gameState,
  isSelected,
  onToggleSelect,
  showCheckbox = true
}: WorldSectionHeaderProps) {
  if (!gameState) {
    return (
      <div className="flex items-center justify-between p-3 bg-muted/40 border rounded-lg text-xs font-semibold text-muted-foreground">
        <span>{worldLabel} (Key {worldKey}) — Loading state...</span>
      </div>
    );
  }

  const round = gameState.currentRound || 1;
  const currentPhase = (gameState.currentPhase || 'planning').toLowerCase();
  const phaseLabel = PHASE_LABELS[currentPhase] || currentPhase;
  const blockingTeams = getBlockingTeams(gameState);
  const isReady = blockingTeams.length === 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-900 text-white rounded-xl shadow-sm border border-slate-800">
      <div className="flex items-center gap-3">
        {showCheckbox && onToggleSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onToggleSelect(!!checked)}
            className="border-white/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
          />
        )}
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-600 text-white font-extrabold font-mono text-xs px-2 py-0.5">
            {worldKey}
          </Badge>
          <span className="font-extrabold text-sm sm:text-base tracking-tight">{worldLabel}</span>
          <span className="text-xs text-slate-400 font-mono hidden md:inline">({classId})</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="bg-slate-800 text-slate-200 border-slate-700 text-xs font-bold gap-1">
          Round {round} · {phaseLabel}
        </Badge>

        {isReady ? (
          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Ready for Next Phase
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/40 text-xs font-bold gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            Waiting on {blockingTeams.length} team(s): {blockingTeams.map(t => t.name).join(', ')}
          </Badge>
        )}

        <button
          onClick={() => window.open(`/class/${classId}/dashboard`, '_blank')}
          className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          title="Open Standalone Dashboard"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
