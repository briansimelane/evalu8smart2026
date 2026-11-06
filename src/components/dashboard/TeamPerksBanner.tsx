import React, { useState, useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { DIRECTIVES_LIST } from './DirectivesClaimModal';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trophy, Award, Sparkles, Zap, ExternalLink, Info, CheckCircle2 } from 'lucide-react';
import { SteveIcon } from './SteveIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isRuleActiveForTeam } from '@/lib/defaultRules';
import { hasTech, isSteveBlocking, isGpsBonusClaimed, getCarriedOverProductsForTeam } from '@/lib/rules';
import { getPatentPointsForTech } from '@/types/game';
import { useGameTheme, regionLabel, techLabel } from '@/lib/gameTheme';

interface TeamPerksBannerProps {
  teamId?: string;
}

export const TeamPerksBanner: React.FC<TeamPerksBannerProps> = ({ teamId: propTeamId }) => {
  const { gameState } = useGame();
  const theme = useGameTheme();
  const { currentTeamId, currentRole } = useSession();
  const [selectedFacilitatorTeamId, setSelectedFacilitatorTeamId] = useState<string>('');
  const [showPerksModal, setShowPerksModal] = useState<boolean>(false);

  if (!gameState) return null;

  const currentRound = gameState.currentRound || 1;
  const activeTeamId = propTeamId || currentTeamId || selectedFacilitatorTeamId || gameState.teams[0]?.id;
  const actingTeam = gameState.teams.find(t => t.id === activeTeamId) || gameState.teams[0];

  if (!actingTeam) return null;

  const actingTeamId = actingTeam.id;
  const isWildcardsActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'wildcard_tokens_system', actingTeamId);
  const isDirectivesActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'directives_bonus_points', actingTeamId);
  const isTechPerksActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'tech_permanent_benefits', actingTeamId);
  const isSteveActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'steve_event_blocker', actingTeamId);

  // 1. Patents held by this team
  const patentsObj = gameState.patents || {};
  const teamPatents = Object.entries(patentsObj)
    .filter(([_, holderId]) => holderId === actingTeamId)
    .map(([techName]) => techName);

  // 2. Directives claimed by this team
  const directivesList = gameState.advancedState?.directives || [];
  const teamDirectives = directivesList.filter(d => d.teamId === actingTeamId);

  // 3. Wildcard tokens
  const wildcardData = gameState.advancedState?.wildcards?.[actingTeamId] || {
    teamId: actingTeamId,
    totalTokens: 10,
    usedInRound: {},
  };
  const usedTotal = Object.values(wildcardData.usedInRound || {}).reduce(
    (a: number, b: number) => Number(a) + Number(b),
    0
  );
  const remainingWildcards = Math.max(0, (wildcardData.totalTokens || 10) - usedTotal);

  // 4. Steve state
  const activeSteveRegion = gameState.advancedState?.steve?.activeRegion;
  const steveBlocked = activeSteveRegion ? isSteveBlocking(gameState, activeSteveRegion, actingTeamId) : false;

  // 5. Tech perks for acting team
  const isGpsDone = hasTech(gameState, actingTeamId, 'GPS');
  const isGpsClaimed = isGpsBonusClaimed(gameState, actingTeamId);
  const isBatteryDone = hasTech(gameState, actingTeamId, 'BATTERY');
  const isGamingDone = hasTech(gameState, actingTeamId, 'GAMING');
  const isWifiDone = hasTech(gameState, actingTeamId, 'WIFI');
  const isNfcDone = hasTech(gameState, actingTeamId, 'NFC');
  const is4GDone = hasTech(gameState, actingTeamId, '4G');
  const carriedOver = getCarriedOverProductsForTeam(gameState, actingTeamId);
  const hasAnyTechPerk = isGpsDone || isBatteryDone || isGamingDone || isWifiDone || isNfcDone || is4GDone;

  // 6. Multi-team perks calculation for facilitator overview
  const teamsWithPerks = useMemo(() => {
    return gameState.teams.map(team => {
      const isTeamPerksActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'tech_permanent_benefits', team.id);
      const isTeamSteveActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'steve_event_blocker', team.id);
      const isSteveBlockedTeam = activeSteveRegion ? isSteveBlocking(gameState, activeSteveRegion, team.id) : false;

      const perks: Array<{
        key: string;
        label: string;
        shortBadge: string;
        description: string;
        badgeColor: string;
      }> = [];

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

  const showDirectives = isDirectivesActive;
  const showPerksEvents =
    currentRole === 'FACILITATOR'
      ? (isTechPerksActive || isSteveActive) && hasAnyActivePerksAcrossTeams
      : isTechPerksActive || (isSteveActive && steveBlocked);

  const visibleCardCount = 1 + (showDirectives ? 1 : 0) + (showPerksEvents ? 1 : 0);
  const gridColsClass =
    visibleCardCount === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : visibleCardCount === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1';

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3.5 shadow-sm rounded-xl space-y-2.5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full shadow-sm ring-2 ring-slate-100 dark:ring-slate-800" style={{ backgroundColor: actingTeam.color }} />
          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
            {actingTeam.name} — Dashboard Assets & Perks
          </span>

          {/* Facilitator Team Switcher & Perks Modal Button */}
          {currentRole === 'FACILITATOR' && !propTeamId && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Select value={actingTeamId} onValueChange={setSelectedFacilitatorTeamId}>
                <SelectTrigger className="h-7 text-xs w-[130px] border-slate-300 dark:border-slate-700">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {gameState.teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        <span>{t.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPerksModal(true)}
                className="h-7 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1.5"
                title="Open All Teams' Perks & Events Modal"
              >
                <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Teams' Perks</span>
                {hasAnyActivePerksAcrossTeams && (
                  <Badge className="h-4 px-1 text-[9px] bg-indigo-600 text-white font-bold">
                    {totalTeamsWithPerks.length}
                  </Badge>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Wildcard Counter Badge */}
        {isWildcardsActive && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 font-mono text-xs px-2.5 py-1">
              Wildcard Tokens: <span className="font-extrabold text-indigo-900 dark:text-white">{remainingWildcards} / 10 Left</span>
            </Badge>
          </div>
        )}
      </div>

      <div className={`grid ${gridColsClass} gap-2.5 text-xs`}>
        {/* Patents Section */}
        <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-slate-950/60 border border-amber-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-400">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Patents Owned
            </span>
            <Badge className="bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 text-[10px]">
              {teamPatents.length} Owned
            </Badge>
          </div>
          {teamPatents.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {teamPatents.map(p => (
                <Badge key={p} className="bg-amber-500 text-white font-semibold text-[11px] shadow-sm">
                  🏆 {techLabel(theme, p)} (+{getPatentPointsForTech(p)} VPs End Game)
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">No patents owned yet.</span>
          )}
        </div>

        {/* Directives Section */}
        {showDirectives && (
          <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-slate-950/60 border border-emerald-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Directives Awarded
              </span>
              <Badge className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 text-[10px]">
                {teamDirectives.length} Claimed
              </Badge>
            </div>
            {teamDirectives.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {teamDirectives.map(d => {
                  const def = DIRECTIVES_LIST.find(dl => dl.id === d.id);
                  return (
                    <Badge key={d.id} className="bg-emerald-600 text-white font-semibold text-[11px] shadow-sm">
                      ⭐ #{def?.number || d.id}: {def?.title || d.id} (+{d.points || 12} VPs)
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">No directives allocated yet.</span>
            )}
          </div>
        )}

        {/* Active Perks & Steve Alert Section - Only appears if associated rule is ON */}
        {showPerksEvents && (
          <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-slate-950/60 border border-indigo-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-400 text-xs">
                <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Active Perks & Events</span>
              </div>
              {currentRole === 'FACILITATOR' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPerksModal(true)}
                  className="h-6 px-2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 gap-1 shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Breakdown Modal</span>
                </Button>
              )}
            </div>

            {currentRole === 'FACILITATOR' ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {totalTeamsWithPerks.map(({ team, perks }) => (
                  <div
                    key={team.id}
                    onClick={() => setShowPerksModal(true)}
                    className="flex items-center justify-between gap-1.5 p-1.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-[11px] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-all"
                    title="Click to view detailed breakdown modal"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                      <span className="font-bold truncate text-slate-900 dark:text-slate-100">{team.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {perks.map(p => (
                        <Badge key={p.key} variant="outline" className={`text-[9px] px-1.5 py-0 font-medium ${p.badgeColor}`}>
                          ⚡ {p.shortBadge}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-0.5">
                {steveBlocked && activeSteveRegion && (
                  <Badge className="bg-red-600 text-white font-bold text-[10px] shadow-sm animate-pulse">
                    <SteveIcon size={12} /> Steve Blocking {regionLabel(theme, activeSteveRegion)}
                  </Badge>
                )}

                {isTechPerksActive && (
                  <>
                    {isGpsDone && (
                      <Badge variant="outline" className="border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300 text-[10px] font-semibold">
                        ⚡ {techLabel(theme, 'GPS')} {isGpsClaimed ? '(+5 Bonus Claimed)' : '(+5 One-Time Bonus Ready)'}
                      </Badge>
                    )}
                    {isBatteryDone && (
                      <Badge variant="outline" className="border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 text-[10px] font-semibold">
                        ⚡ {techLabel(theme, 'Battery')} ({theme.id === 'evalu8' ? theme.techs.BATTERY.perkText : '+1 Logistics when Price > $5'})
                      </Badge>
                    )}
                    {isGamingDone && (
                      <Badge variant="outline" className="border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 text-[10px] font-semibold">
                        ⚡ {techLabel(theme, 'Gaming')} ({theme.id === 'evalu8' ? theme.techs.GAMING.perkText : '-$1 Tech Cost'})
                      </Badge>
                    )}
                    {isWifiDone && (
                      <Badge variant="outline" className="border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 text-[10px] font-semibold">
                        ⚡ {techLabel(theme, 'Wifi')} ({theme.id === 'evalu8' ? theme.techs.WIFI.perkText : 'Unsold products carry over'}{carriedOver > 0 ? `: +${carriedOver} carried over` : ' — Active'})
                      </Badge>
                    )}
                    {isNfcDone && (
                      <Badge variant="outline" className="border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold">
                        ⚡ {techLabel(theme, 'NFC')} ({theme.id === 'evalu8' ? theme.techs.NFC.perkText : 'Sell up to 3 direct products without region placement'})
                      </Badge>
                    )}
                    {is4GDone && (
                      <Badge variant="outline" className="border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[10px] font-semibold">
                        ⚡ {techLabel(theme, '4G')} ({theme.id === 'evalu8' ? theme.techs['4G'].perkText : 'Remote sales: 1 sale per region without an office'})
                      </Badge>
                    )}
                  </>
                )}

                {!steveBlocked && isTechPerksActive && !hasAnyTechPerk && (
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    No tech perks unlocked yet. Research technologies to unlock permanent benefits.
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Facilitator All-Teams Perks & Events Modal */}
      {currentRole === 'FACILITATOR' && (
        <Dialog open={showPerksModal} onOpenChange={setShowPerksModal}>
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
                <Badge variant={isTechPerksActive ? 'default' : 'secondary'} className={isTechPerksActive ? 'bg-emerald-600 text-white font-bold text-[10px]' : 'text-[10px]'}>
                  Rule 1: Permanent Tech Benefits {isTechPerksActive ? 'ON' : 'OFF'}
                </Badge>
                <Badge variant={isSteveActive ? 'default' : 'secondary'} className={isSteveActive ? 'bg-amber-600 text-white font-bold text-[10px]' : 'text-[10px]'}>
                  Rule 5: Steve Event {isSteveActive ? (activeSteveRegion ? `ON (Blocking ${regionLabel(theme, activeSteveRegion)})` : 'ON') : 'OFF'}
                </Badge>
                <Badge variant={isDirectivesActive ? 'default' : 'secondary'} className={isDirectivesActive ? 'bg-indigo-600 text-white font-bold text-[10px]' : 'text-[10px]'}>
                  Rule 4: Directives {isDirectivesActive ? 'ON' : 'OFF'}
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
              <Button onClick={() => setShowPerksModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
