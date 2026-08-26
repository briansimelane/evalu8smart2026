import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { ClaimedDirective, Team } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Award, CheckCircle2, AlertCircle, Lock, ShieldCheck } from 'lucide-react';
import { isRuleActiveForTeam } from '@/lib/defaultRules';
import { toast } from 'sonner';

export interface DirectiveDefinition {
  id: string;
  number: number;
  title: string;
  description: string;
}

export const DIRECTIVES_LIST: DirectiveDefinition[] = [
  {
    id: 'directive_2',
    number: 2,
    title: 'High Volume Producer',
    description: 'Produce 13 or more products in 1 round (excluding products carried over from previous round).',
  },
  {
    id: 'directive_5',
    number: 5,
    title: 'Market Penetration',
    description: 'Sell 10 or more products in 1 round.',
  },
  {
    id: 'directive_6',
    number: 6,
    title: 'Strategic Stockpile',
    description: 'Don\'t sell any products in 1 round (0 products sold).',
  },
  {
    id: 'directive_7',
    number: 7,
    title: 'Global Distributor',
    description: 'Sell products in 5 different regions in 1 round.',
  },
  {
    id: 'directive_21',
    number: 21,
    title: 'Inventory Clearance',
    description: 'Discard 4 or more unsold products in 1 round.',
  },
  {
    id: 'directive_22',
    number: 22,
    title: 'Targeted Price Specialist',
    description: 'Sell products to only red price buyers in at least 3 regions in 1 round.',
  },
];

interface DirectivesClaimModalProps {
  teamId?: string;
  triggerClassName?: string;
}

export const DirectivesClaimModal: React.FC<DirectivesClaimModalProps> = ({ teamId, triggerClassName }) => {
  const { gameState, allocateDirective, revokeDirective } = useGame();
  const { currentRole } = useSession();
  const isFacilitator = currentRole === 'FACILITATOR' || currentRole === 'ADMIN';

  const [selectedTeamId, setSelectedTeamId] = useState<string>(teamId || gameState?.teams[0]?.id || '');

  const currentRound = gameState?.currentRound || 1;
  const teams = gameState?.teams || [];
  const targetTeamId = teamId || selectedTeamId;
  const claimedList: ClaimedDirective[] = gameState?.advancedState?.directives || [];
  const isDirectivesRuleActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'directives_bonus_points', targetTeamId);

  const handleAllocateDirective = (directive: DirectiveDefinition) => {
    if (!gameState || !targetTeamId) return;

    if (!isDirectivesRuleActive) {
      toast.error('Directives Bonus Points rule is currently switched OFF by the facilitator.');
      return;
    }

    if (!isFacilitator) {
      toast.error('Only the Facilitator can allocate directives to teams.');
      return;
    }

    // Rule: Each directive can only be claimed by ONE team across the whole game.
    const globalClaim = claimedList.find(d => d.id === directive.id);
    if (globalClaim) {
      const claimingTeam = teams.find(t => t.id === globalClaim.teamId);
      toast.error(`Directive #${directive.number} has already been claimed!`, {
        description: `Claimed by ${claimingTeam?.name || 'another team'} in Round ${globalClaim.roundNumber}. Each directive can only be claimed once globally.`,
      });
      return;
    }

    // Rule: One team may claim only ONE directive per round
    const teamClaimThisRound = claimedList.find(
      d => d.teamId === targetTeamId && d.roundNumber === currentRound
    );
    if (teamClaimThisRound) {
      const teamObj = teams.find(t => t.id === targetTeamId);
      toast.error(`${teamObj?.name || 'Team'} has already claimed a directive in Round ${currentRound}!`, {
        description: 'Teams may only receive at most ONE directive per round.',
      });
      return;
    }

    allocateDirective(targetTeamId, directive.id);

    const teamObj = teams.find(t => t.id === targetTeamId);
    toast.success(`Directive #${directive.number} Allocated to ${teamObj?.name}! (+12 VPs at Game End)`, {
      description: `Awarded 12 bonus points for "${directive.title}". Points will be added to final score at game end.`,
    });
  };

  const handleRevokeDirective = (directiveId: string) => {
    if (!gameState || !isFacilitator) return;
    revokeDirective(directiveId);
    toast.info('Directive allocation revoked.');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={triggerClassName || "border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 font-bold gap-1.5 text-xs"}
        >
          <Award className="h-4 w-4 text-amber-500" />
          Directives (12 VPs)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Award className="h-5 w-5 text-amber-500" />
            Special Directives (+12 VPs Each at Game End)
          </DialogTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Each directive can only be claimed by ONE team globally. Once claimed, it is gone. Facilitator allocates directives on behalf of teams. 12 VPs awarded at final scoring.
          </CardDescription>
        </DialogHeader>

        {/* Disabled Rule Alert Banner */}
        {!isDirectivesRuleActive && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded-lg flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 font-bold">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Directives Bonus Points (Advanced Rule 4) is currently switched OFF by the facilitator. Directives cannot be allocated.</span>
          </div>
        )}

        {/* Facilitator Allocation Bar */}
        {isFacilitator ? (
          <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
            <span className="text-xs font-bold text-indigo-300">Allocate Directive To:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {teams.map(t => (
                <Button
                  key={t.id}
                  variant={selectedTeamId === t.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`h-7 text-xs px-2.5 flex items-center gap-1.5 ${
                    selectedTeamId === t.id ? 'bg-indigo-600 text-white font-bold' : ''
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.name}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-muted/40 rounded-lg border border-border flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span>Directives are allocated by the Facilitator. Review available directives below and request allocation upon completing conditions.</span>
          </div>
        )}

        {/* Directives Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {DIRECTIVES_LIST.map(dir => {
            const globalClaim = claimedList.find(d => d.id === dir.id);
            const isClaimedGlobally = !!globalClaim;
            const claimingTeam = globalClaim ? teams.find(t => t.id === globalClaim.teamId) : null;

            return (
              <Card
                key={dir.id}
                className={`border transition-all ${
                  isClaimedGlobally
                    ? 'border-emerald-500/40 bg-emerald-500/5 opacity-90'
                    : 'border-border bg-card hover:border-amber-500/30'
                }`}
              >
                <CardHeader className="p-3.5 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 text-[10px] font-mono">
                          Directive #{dir.number}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          +12 VPs (End Game)
                        </Badge>
                      </div>
                      <CardTitle className="text-sm font-bold mt-1">{dir.title}</CardTitle>
                    </div>

                    {isClaimedGlobally ? (
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          className="text-[10px] flex items-center gap-1 font-bold text-white"
                          style={{ backgroundColor: claimingTeam?.color || '#10b981' }}
                        >
                          <CheckCircle2 className="h-3 w-3" /> {claimingTeam?.name || 'Claimed'} (R{globalClaim.roundNumber})
                        </Badge>
                        {isFacilitator && (
                          <button
                            onClick={() => handleRevokeDirective(dir.id)}
                            className="text-[10px] text-red-400 hover:underline"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ) : isFacilitator ? (
                      <Button
                        size="sm"
                        disabled={!isDirectivesRuleActive}
                        onClick={() => handleAllocateDirective(dir)}
                        className={`h-7 text-xs font-medium px-3 ${
                          !isDirectivesRuleActive ? 'bg-slate-300 text-slate-500 opacity-60' : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                      >
                        Allocate
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">
                        Available
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-3.5 pt-0 text-xs text-muted-foreground space-y-1.5">
                  <p>{dir.description}</p>
                  {isClaimedGlobally && (
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-emerald-500/20">
                      Claimed exclusively by {claimingTeam?.name} in Round {globalClaim.roundNumber}.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
