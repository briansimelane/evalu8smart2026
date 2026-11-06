import React, { useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Zap, Info } from 'lucide-react';
import { isRuleActiveForTeam } from '@/lib/defaultRules';
import { hasTech, isSteveBlocking, isGpsBonusClaimed, getCarriedOverProductsForTeam } from '@/lib/rules';
import { useGameTheme, regionLabel, techLabel } from '@/lib/gameTheme';

export interface TeamPerkItem {
  key: string;
  label: string;
  shortBadge: string;
  description: string;
  badgeColor: string;
}

export interface TeamPerksSummary {
  team: any;
  perks: TeamPerkItem[];
  hasPerks: boolean;
}

export interface TeamPerksModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  triggerLabel?: string;
  showTrigger?: boolean;
  children?: React.ReactNode;
}

export const TeamPerksModal: React.FC<TeamPerksModalProps> = ({
  open,
  onOpenChange,
  triggerClassName,
  triggerLabel,
  showTrigger = true,
  children,
}) => {
  const { gameState } = useGame();
  const theme = useGameTheme();
  const { currentRole } = useSession();

  const currentRound = gameState?.currentRound || 1;
  const activeSteveRegion = gameState?.advancedState?.steve?.activeRegion;

  const isTechPerksActiveGlobal = isRuleActiveForTeam(gameState?.ruleAdjustments, 'tech_permanent_benefits');
  const isSteveActiveGlobal = isRuleActiveForTeam(gameState?.ruleAdjustments, 'steve_event_blocker');
  const isDirectivesActiveGlobal = isRuleActiveForTeam(gameState?.ruleAdjustments, 'directives_bonus_points');

  const teamsWithPerks: TeamPerksSummary[] = useMemo(() => {
    if (!gameState) return [];

    return gameState.teams.map(team => {
      const isTeamPerksActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'tech_permanent_benefits', team.id);
      const isTeamSteveActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'steve_event_blocker', team.id);
      const isSteveBlockedTeam = activeSteveRegion ? isSteveBlocking(gameState, activeSteveRegion, team.id) : false;

      const perks: TeamPerkItem[] = [];

      if (isTeamSteveActive && isSteveBlockedTeam && activeSteveRegion) {
        perks.push({
          key: 'STEVE',
          label: 'Steve Blocker',
          shortBadge: `Steve: ${regionLabel(theme, activeSteveRegion)}`,
          description: `Steve is blocking ${regionLabel(theme, activeSteveRegion)}! Regional expansion & sales disabled.`,
          badgeColor: 'bg-red-600 text-white font-bold',
        });
      }

      if (isTeamPerksActive) {
        if (hasTech(gameState, team.id, 'GPS')) {
          const claimed = isGpsBonusClaimed(gameState, team.id);
          perks.push({
            key: 'GPS',
            label: techLabel(theme, 'GPS'),
            shortBadge: `${techLabel(theme, 'GPS')}: ${claimed ? 'Bonus Claimed' : '+5 Products Ready'}`,
            description: claimed
              ? '+5 Products bonus already claimed in production'
              : '+5 Products bonus available (added once per game in planning phase)',
            badgeColor: 'border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300',
          });
        }
        if (hasTech(gameState, team.id, 'BATTERY')) {
          perks.push({
            key: 'BATTERY',
            label: techLabel(theme, 'Battery'),
            shortBadge: `${techLabel(theme, 'Battery')}: +1 Log (P > $5)`,
            description: theme.id === 'evalu8' ? theme.techs.BATTERY.perkText : '+1 Logistics point when product price exceeds $5',
            badgeColor: 'border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300',
          });
        }
        if (hasTech(gameState, team.id, 'GAMING')) {
          perks.push({
            key: 'GAMING',
            label: techLabel(theme, 'Gaming'),
            shortBadge: `${techLabel(theme, 'Gaming')}: -$1 Tech Cost`,
            description: theme.id === 'evalu8' ? theme.techs.GAMING.perkText : '-$1 Tech Cost on all technology research and patents',
            badgeColor: 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300',
          });
        }
        if (hasTech(gameState, team.id, 'WIFI')) {
          const carried = getCarriedOverProductsForTeam(gameState, team.id);
          perks.push({
            key: 'WIFI',
            label: techLabel(theme, 'Wifi'),
            shortBadge: `${techLabel(theme, 'Wifi')}${carried > 0 ? `: +${carried} Carried Over` : ' (Carry-Over Active)'}`,
            description: theme.id === 'evalu8'
              ? `Unsold vehicles carry over between rounds${carried > 0 ? ` (+${carried} carried over into Round ${currentRound})` : ''}`
              : `Unsold products carry over between rounds${carried > 0 ? ` (+${carried} carried over into Round ${currentRound})` : ''}`,
            badgeColor: 'border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300',
          });
        }
        if (hasTech(gameState, team.id, 'NFC')) {
          perks.push({
            key: 'NFC',
            label: techLabel(theme, 'NFC'),
            shortBadge: `${techLabel(theme, 'NFC')}: Direct Sales (Up to 3)`,
            description: theme.id === 'evalu8' ? theme.techs.NFC.perkText : 'Direct sales: sell up to 3 products per round without a regional office',
            badgeColor: 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
          });
        }
        if (hasTech(gameState, team.id, '4G')) {
          perks.push({
            key: '4G',
            label: techLabel(theme, '4G'),
            shortBadge: `${techLabel(theme, '4G')}: Remote Sales (1/region)`,
            description: theme.id === 'evalu8' ? theme.techs['4G'].perkText : 'Remote sales: 1 sale per region where the team has no office',
            badgeColor: 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300',
          });
        }
      }

      return {
        team,
        perks,
        hasPerks: perks.length > 0,
      };
    });
  }, [gameState, activeSteveRegion, theme, currentRound]);

  const totalTeamsWithPerks = useMemo(() => {
    return teamsWithPerks.filter(t => t.hasPerks);
  }, [teamsWithPerks]);

  const hasAnyActivePerksAcrossTeams = totalTeamsWithPerks.length > 0;

  if (!gameState) return null;

  const dialogContent = (
    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
      <DialogHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Active Perks & Events — All Teams Breakdown</span>
          </DialogTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 text-xs font-bold">
              Round {currentRound}
            </Badge>
            <Badge className="bg-indigo-600 text-white text-xs font-bold">
              {totalTeamsWithPerks.length} / {gameState.teams.length} Teams with Active Perks
            </Badge>
          </div>
        </div>
        <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
          Facilitator reference for all active permanent technological benefits and regional events across teams.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
        {/* Rules status banner */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex-wrap">
          <span className="font-semibold text-muted-foreground">Rules Status:</span>
          <Badge variant={isTechPerksActiveGlobal ? 'default' : 'secondary'} className={isTechPerksActiveGlobal ? 'bg-emerald-600 text-white font-bold text-[10px]' : 'text-[10px]'}>
            Rule 1: Permanent Tech Benefits {isTechPerksActiveGlobal ? 'ON' : 'OFF'}
          </Badge>
          <Badge variant={isSteveActiveGlobal ? 'default' : 'secondary'} className={isSteveActiveGlobal ? 'bg-amber-600 text-white font-bold text-[10px]' : 'text-[10px]'}>
            Rule 5: Steve Event {isSteveActiveGlobal ? (activeSteveRegion ? `ON (Blocking ${regionLabel(theme, activeSteveRegion)})` : 'ON') : 'OFF'}
          </Badge>
          <Badge variant={isDirectivesActiveGlobal ? 'default' : 'secondary'} className={isDirectivesActiveGlobal ? 'bg-indigo-600 text-white font-bold text-[10px]' : 'text-[10px]'}>
            Rule 4: Directives {isDirectivesActiveGlobal ? 'ON' : 'OFF'}
          </Badge>
        </div>

        {/* Team by Team Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {teamsWithPerks.map(({ team, perks, hasPerks }) => (
            <Card key={team.id} className={`p-3.5 space-y-2.5 border transition-all ${hasPerks ? 'border-indigo-300/80 dark:border-indigo-800/80 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800 bg-card/60'}`}>
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full ring-2 ring-background" style={{ backgroundColor: team.color }} />
                  <span className="font-bold text-sm text-foreground">{team.name}</span>
                  {team.isBot && <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">BOT</span>}
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {perks.length} {perks.length === 1 ? 'Benefit' : 'Benefits'}
                </Badge>
              </div>

              {hasPerks ? (
                <div className="space-y-1.5">
                  {perks.map(p => (
                    <div key={p.key} className="p-2 rounded-md bg-background border border-border/60 space-y-0.5 text-xs">
                      <div className="flex items-center justify-between gap-1.5 font-bold">
                        <span className="flex items-center gap-1.5">
                          <span>⚡</span>
                          <span>{p.label}</span>
                        </span>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${p.badgeColor}`}>
                          Active
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{p.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-1">
                  No active technological perks or events unlocked yet.
                </p>
              )}
            </Card>
          ))}
        </div>

        {/* Perks Reference Guide for Facilitator */}
        <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2 text-xs">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <Info className="h-4 w-4 text-indigo-500" />
            Permanent Technological Benefits Quick Reference (Advanced Rule 1)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div className="p-2 rounded bg-background border border-border/60">
              <strong className="text-foreground block">⚡ {techLabel(theme, 'GPS')}</strong>
              +5 products bonus once per game (added during Planning phase).
            </div>
            <div className="p-2 rounded bg-background border border-border/60">
              <strong className="text-foreground block">⚡ {techLabel(theme, 'Battery')}</strong>
              +1 Logistics point when product price exceeds $5.
            </div>
            <div className="p-2 rounded bg-background border border-border/60">
              <strong className="text-foreground block">⚡ {techLabel(theme, 'Gaming')}</strong>
              -$1 Tech cost discount on all technology research and patents.
            </div>
            <div className="p-2 rounded bg-background border border-border/60">
              <strong className="text-foreground block">⚡ {techLabel(theme, 'WIFI')}</strong>
              Unsold products carry over into the next round instead of being lost.
            </div>
            <div className="p-2 rounded bg-background border border-border/60">
              <strong className="text-foreground block">⚡ {techLabel(theme, 'NFC')}</strong>
              Direct sales: sell up to 3 products per round without a regional office.
            </div>
            <div className="p-2 rounded bg-background border border-border/60">
              <strong className="text-foreground block">⚡ {techLabel(theme, '4G')}</strong>
              Remote sales: 1 sale per region without an office (direct customer sale).
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-2 border-t border-border">
        {onOpenChange ? (
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        ) : (
          <DialogTrigger asChild>
            <Button>Close</Button>
          </DialogTrigger>
        )}
      </DialogFooter>
    </DialogContent>
  );

  // Controlled mode without trigger
  if (!showTrigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {dialogContent}
      </Dialog>
    );
  }

  // Uncontrolled mode or with trigger
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children ? (
          children
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={triggerClassName || "text-xs h-8 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 font-bold gap-1 whitespace-nowrap"}
            title="Active Perks & Events Breakdown"
          >
            <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{triggerLabel || "Tech Perks"}</span>
            {hasAnyActivePerksAcrossTeams && (
              <Badge className="h-4 px-1 text-[9px] bg-indigo-600 text-white font-bold">
                {totalTeamsWithPerks.length}
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
};
