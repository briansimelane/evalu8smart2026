import { useState, useMemo, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { ViewerBoard } from '@/pages/Viewer/ViewerPage';
import { buildGameStateForRound } from '@/lib/roundSnapshot';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';

export function ParticipantWorldMap() {
  const { gameState } = useGame();
  const { activeClass } = useSession();

  if (!gameState) return null;

  const maxAvailableRound = Math.max(1, gameState.currentRound || 1);
  const [selectedRound, setSelectedRound] = useState<number>(maxAvailableRound);

  // Sync selectedRound with maxAvailableRound when current round advances
  useEffect(() => {
    setSelectedRound(maxAvailableRound);
  }, [maxAvailableRound]);

  const activeRoundNumber = Math.min(selectedRound, maxAvailableRound);

  const displayedGameState = useMemo(() => {
    if (!gameState) return gameState;
    if (activeRoundNumber >= gameState.currentRound) {
      return gameState;
    }
    return buildGameStateForRound(gameState, activeRoundNumber);
  }, [gameState, activeRoundNumber]);

  const classData = activeClass || { id: 'demo', name: 'Solo Demo Game', code: 'DEMO', facilitatorCode: '' };

  const isPlanningPhase = (gameState.currentPhase || 'planning').toLowerCase() === 'planning';
  const isRoundOnePlanning = gameState.currentRound === 1 && isPlanningPhase && activeRoundNumber === 1;

  return (
    <div className="space-y-4">
      {/* Header with Round Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-card rounded-xl border shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold flex items-center gap-2 flex-wrap text-foreground tracking-tight">
              <Globe className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600 shrink-0" />
              <span>World Map — Round {activeRoundNumber}</span>
            </h2>
            {isRoundOnePlanning && (
              <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs font-bold">
                Starting Offices Active
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isRoundOnePlanning
              ? 'Starting offices and regional market demand are active for Round 1 planning. Pricing, turn order, and production will update in the Production phase.'
              : 'Interactive digital board view showing regional market presence, technology, sales, and control'}
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

      {/* World Map Interactive Board Stage */}
      <div className="w-full h-[72vh] min-h-[460px] max-h-[900px] rounded-xl overflow-hidden border border-border shadow-xl bg-slate-900 relative">
        <ViewerBoard classData={classData} gameState={displayedGameState} />
      </div>
    </div>
  );
}
