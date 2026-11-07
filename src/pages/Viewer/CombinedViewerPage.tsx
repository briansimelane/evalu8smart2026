import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMultiWorldSession, WorldSubState } from '@/hooks/useMultiWorldSession';
import { ViewerBoard } from './ViewerPage';
import { MultiWorldSingleBoard } from './MultiWorldSingleBoard';
import { TeamLabelProvider, useTeamLabel } from './TeamLabelContext';
import { WorldKey } from '@/types/multiworld';
import { calculateTeamTotalScore, getPatentPointsForTech } from '@/types/game';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Globe, Trophy, Maximize2, AlertCircle, Monitor, Layers, Columns, MonitorCheck, ChevronDown, ChevronUp, LayoutGrid, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameTheme, useApplyGameThemeAttribute, techLabel, regionLabel } from '@/lib/gameTheme';
import { getNextPhase, PHASE_LABELS } from '@/lib/phaseEngine';
import { SteveIcon } from '@/components/dashboard/SteveIcon';
import { isRuleActiveForTeam } from '@/lib/defaultRules';
import './viewer.css';

interface ScoredTeam {
  teamId: string;
  teamName: string;
  color: string;
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

export function CombinedViewerContent() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const { session, worlds, loading: sessionLoading, error: sessionError } = useMultiWorldSession(sessionCode || '');
  const { formatTeamLabel } = useTeamLabel();
  const activeThemeId = worlds.find(w => w.gameState?.themeId)?.gameState?.themeId ?? session?.themeId;
  useApplyGameThemeAttribute(activeThemeId);
  const theme = useGameTheme({ themeId: activeThemeId });

  // Selected view mode: 'single' (overlay if 2 worlds), 'grid' (1-10 worlds), 'leaderboard', or 'world:<key>'
  const [layoutMode, setLayoutMode] = useState<string>(
    worlds.length > 2 ? 'grid' : 'single'
  );
  const [expandedTeamKey, setExpandedTeamKey] = useState<string | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error enabling fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < worlds.length) {
          setLayoutMode(`world:${worlds[idx].key}`);
        }
      } else if (e.key === '0' && worlds.length >= 10) {
        setLayoutMode(`world:${worlds[9].key}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [worlds]);

  // Compute combined leaderboard across all 1-10 worlds
  const combinedLeaderboard = useMemo<ScoredTeam[]>(() => {
    const list: ScoredTeam[] = [];

    worlds.forEach((w) => {
      const gState = w.gameState;
      if (!gState) return;

      const round = gState.currentRound;
      gState.teams.forEach((t, tIdx) => {
        const score = calculateTeamTotalScore(t.id, round, gState);
        const patents = Object.entries(gState.patents || {})
          .filter(([_, holderId]) => holderId === t.id)
          .map(([tech]) => tech);

        list.push({
          teamId: t.id,
          teamName: t.name,
          color: t.color,
          worldKey: w.key,
          worldLabel: w.label,
          startValue: score.startValue,
          totalScore: score.totalScore,
          cumulativeRevenue: score.cumulativeRevenue,
          cumulativeControl: score.cumulativeControl,
          patentBonus: score.patentBonus,
          patentsHeld: patents,
          isBot: !!t.isBot,
          teamIndex: tIdx
        });
      });
    });

    list.sort((a, b) => b.totalScore - a.totalScore);
    return list;
  }, [worlds]);

  const isProvisional = useMemo(() => {
    const loaded = worlds.filter(w => w.gameState);
    if (loaded.length < worlds.length) return true;
    if (loaded.length === 0) return true;

    const firstRound = loaded[0].gameState?.currentRound;
    const firstPhase = loaded[0].gameState?.currentPhase;

    return loaded.some(w => w.gameState?.currentRound !== firstRound || w.gameState?.currentPhase !== firstPhase);
  }, [worlds]);

  const activeSteveWorlds = useMemo(() => {
    return worlds
      .map(w => {
        const gState = w.gameState;
        if (!gState) return null;
        const s = gState.advancedState?.steve;
        if (s?.activeRegion && isRuleActiveForTeam(gState.ruleAdjustments, 'steve_event_blocker')) {
          const paid = Object.values(s.wildcardsContributed || {}).reduce((a, b) => a + Number(b), 0);
          return {
            worldKey: w.key,
            worldLabel: w.label,
            region: s.activeRegion,
            paid
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ worldKey: WorldKey; worldLabel: string; region: string; paid: number }>;
  }, [worlds]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
        <p className="text-lg font-semibold animate-pulse text-purple-700">Loading Multi-World Viewer...</p>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Monitor className="w-12 h-12 text-purple-600" />
        <h1 className="text-2xl font-bold text-slate-900">Combined Viewer Session Not Found</h1>
        <p className="text-slate-600 max-w-md">{sessionError || 'Please check your multi-world session code.'}</p>
        <p className="text-xs text-slate-500 font-mono">Code: {sessionCode?.toUpperCase()}</p>
      </div>
    );
  }

  const worldA = worlds.find(w => w.key === 'A');
  const worldB = worlds.find(w => w.key === 'B');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col select-none">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-xs z-20 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-purple-600 animate-pulse" />
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              {session.name}
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                {worlds.length} Worlds
              </Badge>
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              Session Code: <span className="text-purple-700 font-bold">{session.sessionCode}</span>
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold flex-wrap">
          {worlds.length === 2 && (
            <button
              onClick={() => setLayoutMode('single')}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
                layoutMode === 'single' ? "bg-purple-600 text-white font-bold shadow-xs" : "text-slate-700 hover:bg-slate-200"
              )}
              title="Both Worlds Overlay on Single Board"
            >
              <MonitorCheck className="h-3.5 w-3.5" />
              Overlay Board
            </button>
          )}

          <button
            onClick={() => setLayoutMode('grid')}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
              layoutMode === 'grid' ? "bg-purple-600 text-white font-bold shadow-xs" : "text-slate-700 hover:bg-slate-200"
            )}
            title="All Worlds Grid View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid ({worlds.length})
          </button>

          <button
            onClick={() => setLayoutMode('leaderboard')}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
              layoutMode === 'leaderboard' ? "bg-purple-600 text-white font-bold shadow-xs" : "text-slate-700 hover:bg-slate-200"
            )}
          >
            <Trophy className="h-3.5 w-3.5" />
            Leaderboard ({combinedLeaderboard.length})
          </button>

          {/* Individual World Selector Buttons */}
          {worlds.map((w, idx) => (
            <button
              key={w.key}
              onClick={() => setLayoutMode(`world:${w.key}`)}
              className={cn(
                "px-2.5 py-1.5 rounded-md transition-colors font-bold",
                layoutMode === `world:${w.key}` ? "bg-purple-600 text-white shadow-xs" : "text-slate-700 hover:bg-slate-200"
              )}
              title={`Press ${idx + 1} to switch to World ${w.key}`}
            >
              World {w.key}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {activeSteveWorlds.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-300 px-2.5 py-1 rounded-lg text-xs shadow-2xs">
              <SteveIcon size={16} />
              <span className="font-black text-red-700">Steve Blocker:</span>
              <div className="flex items-center gap-1">
                {activeSteveWorlds.map(sw => (
                  <span key={sw.worldKey} className="bg-white border border-red-200 text-red-800 font-bold px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1 shadow-2xs">
                    <span className="font-extrabold text-purple-700">W{sw.worldKey}:</span>
                    <span>{regionLabel(theme, sw.region)} ({sw.paid}/5)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {isProvisional && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Provisional
            </Badge>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Toggle Fullscreen (F)"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 relative overflow-auto bg-slate-100">
        {/* Layout 1: Single Board Overlay (for 2 worlds) */}
        {layoutMode === 'single' && worldA && worldB && (
          <div className="w-full flex justify-center">
            {worldA.gameState && worldB.gameState ? (
              <MultiWorldSingleBoard
                session={session}
                gameStateA={worldA.gameState}
                gameStateB={worldB.gameState}
                classDataA={worldA.classData}
                classDataB={worldB.classData}
              />
            ) : (
              <div className="h-[500px] flex items-center justify-center text-slate-400">
                Board data loading...
              </div>
            )}
          </div>
        )}

        {/* Layout 2: Responsive Grid (1-10 worlds) */}
        {layoutMode === 'grid' && (
          <div className={cn(
            "w-full max-w-[1920px] grid gap-6 py-2",
            worlds.length === 1 ? "grid-cols-1" :
            worlds.length === 2 ? "grid-cols-1 lg:grid-cols-2" :
            worlds.length <= 4 ? "grid-cols-1 md:grid-cols-2" :
            "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          )}>
            {worlds.map((w) => (
              <div key={w.key} className="flex flex-col items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xl p-2 relative">
                <div className="w-full bg-purple-50/80 px-4 py-2 flex items-center justify-between border-b border-purple-200 mb-2 gap-2 flex-wrap">
                  <span className="font-black text-purple-900 text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    World {w.key}: {w.label}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-800 font-bold">
                      Round {w.gameState?.currentRound || 1} — {PHASE_LABELS[w.gameState?.currentPhase || 'planning'] || w.gameState?.currentPhase}
                    </span>
                    {w.gameState && (() => {
                      const { nextPhase, nextRound, isGameEnd } = getNextPhase(w.gameState);
                      return (
                        <span className="text-[11px] font-semibold text-purple-700 bg-purple-100/70 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <ArrowRight className="h-2.5 w-2.5" />
                          Next: {isGameEnd ? 'End' : nextRound > (w.gameState.currentRound || 1) ? `R${nextRound} ${PHASE_LABELS[nextPhase]}` : PHASE_LABELS[nextPhase]}
                        </span>
                      );
                    })()}
                    {w.gameState && (() => {
                      const s = w.gameState.advancedState?.steve;
                      if (s?.activeRegion && isRuleActiveForTeam(w.gameState.ruleAdjustments, 'steve_event_blocker')) {
                        const paid = Object.values(s.wildcardsContributed || {}).reduce((a, b) => a + Number(b), 0);
                        return (
                          <span className="text-[11px] font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                            <SteveIcon size={13} />
                            <span>Steve: {regionLabel(theme, s.activeRegion)} ({paid}/5)</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                {w.gameState ? (
                  <ViewerBoard classData={w.classData || { name: w.label }} gameState={w.gameState} />
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-slate-400 italic">
                    Loading World {w.key} state...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Layout 3: Single World Focused View (`world:<key>`) */}
        {layoutMode.startsWith('world:') && (() => {
          const targetKey = layoutMode.split(':')[1];
          const targetWorld = worlds.find(w => w.key === targetKey);
          if (!targetWorld) return null;

          return (
            <div className="w-full h-full min-h-[calc(100vh-100px)] flex flex-col items-center justify-center p-2">
              <div className="w-full max-w-[1920px] flex flex-col items-center border border-purple-200 rounded-xl overflow-hidden bg-white shadow-xl p-2 relative">
                <div className="w-full bg-purple-50 px-4 py-2 flex items-center justify-between border-b border-purple-200 mb-2 gap-2 flex-wrap">
                  <span className="font-extrabold text-purple-900 text-base flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-600" />
                    World {targetWorld.key}: {targetWorld.label}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-800 font-bold">
                      Round {targetWorld.gameState?.currentRound || 1} — {PHASE_LABELS[targetWorld.gameState?.currentPhase || 'planning'] || targetWorld.gameState?.currentPhase}
                    </span>
                    {targetWorld.gameState && (() => {
                      const { nextPhase, nextRound, isGameEnd } = getNextPhase(targetWorld.gameState);
                      return (
                        <span className="text-[11px] font-semibold text-purple-700 bg-purple-100/70 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <ArrowRight className="h-2.5 w-2.5" />
                          Next: {isGameEnd ? 'End' : nextRound > (targetWorld.gameState.currentRound || 1) ? `R${nextRound} ${PHASE_LABELS[nextPhase]}` : PHASE_LABELS[nextPhase]}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {targetWorld.gameState ? (
                  <div className="w-full h-[85vh] flex items-center justify-center overflow-hidden">
                    <ViewerBoard classData={targetWorld.classData || { name: targetWorld.label }} gameState={targetWorld.gameState} />
                  </div>
                ) : (
                  <div className="h-[500px] flex items-center justify-center text-slate-400">
                    World {targetWorld.key} data loading...
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Layout 4: Combined Leaderboard */}
        {layoutMode === 'leaderboard' && (
          <Card className="w-full max-w-5xl bg-white border-slate-200 shadow-xl my-4 text-slate-900">
            <CardHeader className="border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-amber-500" />
                  Combined Overall Leaderboard ({combinedLeaderboard.length} Teams)
                </CardTitle>
                {isProvisional && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                    Provisional
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {combinedLeaderboard.map((team, idx) => {
                  const isTop3 = idx < 3;
                  const rankBadge = idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`;
                  const teamKey = `${team.worldKey}-${team.teamId}`;
                  const isExpanded = expandedTeamKey === teamKey;
                  const displayLabel = formatTeamLabel({ id: team.teamId, name: team.teamName, color: team.color, isBot: team.isBot }, team.teamIndex);

                  return (
                    <div
                      key={teamKey}
                      className={cn(
                        "rounded-xl border transition-all overflow-hidden bg-white shadow-2xs",
                        isTop3 ? "border-amber-300 shadow-xs" : "border-slate-200"
                      )}
                    >
                      {/* Interactive Header Row */}
                      <div
                        onClick={() => setExpandedTeamKey(isExpanded ? null : teamKey)}
                        className={cn(
                          "flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/90 transition-colors select-none",
                          isTop3 ? "bg-amber-50/80" : "bg-slate-50"
                        )}
                        title="Click to view score breakdown calculation"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-extrabold text-sm min-w-[50px] text-amber-700">{rankBadge}</span>
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs px-2 py-0.5 font-bold font-mono">
                            World {team.worldKey}
                          </Badge>
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="font-bold text-slate-900 text-base">{displayLabel}</span>
                          {team.isBot && (
                            <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-medium">
                              🤖 Bot
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right text-xs text-slate-500 hidden sm:block">
                            <div>Rev: ${team.cumulativeRevenue} | Ctrl: {team.cumulativeControl} pts</div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              <span className="text-2xl font-black text-amber-600">{team.totalScore}</span>
                              <span className="text-xs text-slate-500 ml-1">pts</span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-slate-500 shrink-0 ml-1" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-500 shrink-0 ml-1" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Down-Click Score Breakdown Panel */}
                      {isExpanded && (
                        <div className="p-4 bg-slate-100/90 border-t border-slate-200 text-xs space-y-3 font-sans animate-scale-in">
                          <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center justify-between border-b border-slate-200 pb-1.5">
                            <span>Score Breakdown — {displayLabel} (World {team.worldKey})</span>
                            <span className="font-mono text-purple-700 font-black text-sm">Total: {team.totalScore} Pts</span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-800">
                            <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Starting Position</div>
                              <div className="text-base font-black text-slate-800 font-mono mt-0.5">+{team.startValue} pts</div>
                            </div>
                            <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Cumulative Sales Rev</div>
                              <div className="text-base font-black text-emerald-600 font-mono mt-0.5">+${team.cumulativeRevenue}</div>
                            </div>
                            <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Regional Control</div>
                              <div className="text-base font-black text-blue-600 font-mono mt-0.5">+{team.cumulativeControl} pts</div>
                            </div>
                            <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Patents Awarded</div>
                              <div className="text-base font-black text-purple-600 font-mono mt-0.5">+{team.patentBonus} pts</div>
                            </div>
                          </div>

                          {/* Patents Held List */}
                          {team.patentsHeld && team.patentsHeld.length > 0 ? (
                            <div className="pt-1 flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[10px] text-slate-500 uppercase">Patents Held:</span>
                              {team.patentsHeld.map(tech => (
                                <Badge key={tech} className="bg-purple-100 text-purple-800 border-purple-200 font-mono text-[10px]">
                                  🏆 {techLabel(theme, tech)} (+{getPatentPointsForTech(tech)} pts)
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="pt-1 text-[11px] text-slate-500 italic">No patents held yet</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export function CombinedViewerPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const { session } = useMultiWorldSession(sessionCode || '');

  return (
    <TeamLabelProvider labelMode={session?.teamLabelMode || 'name'}>
      <CombinedViewerContent />
    </TeamLabelProvider>
  );
}

export default CombinedViewerPage;

