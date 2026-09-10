import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GameState, Team } from '@/types/game';
import { WorldKey } from '@/types/multiworld';
import { getTeamCode } from '@/lib/multiworld/teamLabel';
import { ExternalLink, DollarSign, Award, Bot, Wrench, Microscope, Truck, Package } from 'lucide-react';

interface TeamDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team | null;
  worldKey: WorldKey | null;
  classId: string | null;
  worldLabel: string;
  gameState: GameState | null;
}

export function TeamDetailDrawer({
  isOpen,
  onClose,
  team,
  worldKey,
  classId,
  worldLabel,
  gameState
}: TeamDetailDrawerProps) {
  if (!team || !gameState) return null;

  const round = gameState.currentRound || 1;
  const roundData = gameState.rounds?.find(r => r.roundNumber === round);
  const tData = roundData?.teamData?.[team.id];
  const teamCode = getTeamCode(team, worldKey);

  const completedTechs = gameState.teamResearchProgress?.[team.id]?.completedTechnologies || [];
  const presenceRegions = gameState.teamLogisticsProgress?.[team.id]?.regionsWithPresence || [];
  const claimedCards = (gameState.improvementCards || []).filter(c =>
    (c.availableForTeam === team.id || c.usedBy === team.id) && c.allocatedInRound === round
  );

  return (
    <Sheet open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full flex-shrink-0"
              style={{ backgroundColor: team.color }}
            />
            <div>
              <SheetTitle className="text-xl font-extrabold flex items-center gap-2">
                <span>{team.name}</span>
                <Badge variant="outline" className="font-mono text-xs font-bold">
                  {teamCode}
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {worldLabel} (Class ID: {classId})
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 py-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted/50 rounded-xl border text-center space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Price
              </span>
              <p className="text-lg font-black">{tData?.price ? `$${tData.price}` : '—'}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-xl border text-center space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                <Package className="h-3.5 w-3.5 text-blue-500" /> Production
              </span>
              <p className="text-lg font-black">{tData?.productsProduced ?? '—'}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-xl border text-center space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                <Award className="h-3.5 w-3.5 text-purple-500" /> Revenue
              </span>
              <p className="text-lg font-black">{tData?.revenue ? `$${tData.revenue}` : '—'}</p>
            </div>
          </div>

          {/* Submission / Default Status */}
          {tData?.facilitatorDefault && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1 text-amber-900 dark:text-amber-200">
              <span className="font-bold">⚑ Facilitator Default Plan ($5)</span>
              <p className="text-[11px] opacity-90">
                This team did not submit a plan prior to force-advance. A standard $5 default plan (Combination 2, Position 2) was applied.
              </p>
            </div>
          )}

          {/* Round Action Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Round {round} Breakdown</h4>
            
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-card border rounded-lg">
                <span className="flex items-center gap-2 font-medium">
                  <Wrench className="h-4 w-4 text-warning" /> Improvement Cards
                </span>
                <span className="font-bold">
                  {claimedCards.length > 0 ? `${claimedCards.length} Card(s) Claimed` : 'None'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-card border rounded-lg">
                <span className="flex items-center gap-2 font-medium">
                  <Microscope className="h-4 w-4 text-purple-500" /> Tech Completed ({completedTechs.length})
                </span>
                <span className="font-bold truncate max-w-[200px]" title={completedTechs.join(', ')}>
                  {completedTechs.length > 0 ? completedTechs.join(', ') : 'None'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-card border rounded-lg">
                <span className="flex items-center gap-2 font-medium">
                  <Truck className="h-4 w-4 text-emerald-500" /> Regional Presence ({presenceRegions.length})
                </span>
                <span className="font-bold truncate max-w-[200px]" title={presenceRegions.join(', ')}>
                  {presenceRegions.length > 0 ? presenceRegions.join(', ') : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Standalone Dashboard Link */}
          {classId && (
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={() => window.open(`/class/${classId}/dashboard`, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Open Standalone World Dashboard
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
