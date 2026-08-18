import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMultiWorldSession } from '@/hooks/useMultiWorldSession';
import { useGameBoardState } from '@/hooks/useGameBoardState';
import { ViewerBoard } from './ViewerPage';
import { MultiWorldSingleBoard } from './MultiWorldSingleBoard';
import { calculateTeamTotalScore } from '@/types/game';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Globe, Trophy, Maximize2, AlertCircle, Monitor, Layers, Columns, MonitorCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import './viewer.css';

interface ScoredTeam {
  teamId: string;
  teamName: string;
  color: string;
  worldLabel: 'A' | 'B';
  totalScore: number;
  cumulativeRevenue: number;
  cumulativeControl: number;
  patentBonus: number;
  isBot: boolean;
}

export function CombinedViewerPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const { session, loading: sessionLoading, error: sessionError } = useMultiWorldSession(sessionCode || '');

  const classIdA = session?.worldAClassId || '';
  const classIdB = session?.worldBClassId || '';

  const { classData: classDataA, gameState: gameStateA, loading: loadingA, error: errorA } = useGameBoardState(classIdA);
  const { classData: classDataB, gameState: gameStateB, loading: loadingB, error: errorB } = useGameBoardState(classIdB);

  // Layout mode switcher: 'single' (both worlds overlay on 1 board) by default!
  const [layoutMode, setLayoutMode] = useState<'single' | 'stacked' | 'side' | 'leaderboard' | 'worldA' | 'worldB'>('single');

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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute combined leaderboard
  const combinedLeaderboard = useMemo<ScoredTeam[]>(() => {
    const list: ScoredTeam[] = [];

    if (gameStateA) {
      const roundA = gameStateA.currentRound;
      gameStateA.teams.forEach((t) => {
        const score = calculateTeamTotalScore(t.id, roundA, gameStateA);
        list.push({
          teamId: t.id,
          teamName: t.name,
          color: t.color,
          worldLabel: 'A',
          totalScore: score.totalScore,
          cumulativeRevenue: score.cumulativeRevenue,
          cumulativeControl: score.cumulativeControl,
          patentBonus: score.patentBonus,
          isBot: !!t.isBot
        });
      });
    }

    if (gameStateB) {
      const roundB = gameStateB.currentRound;
      gameStateB.teams.forEach((t) => {
        const score = calculateTeamTotalScore(t.id, roundB, gameStateB);
        list.push({
          teamId: t.id,
          teamName: t.name,
          color: t.color,
          worldLabel: 'B',
          totalScore: score.totalScore,
          cumulativeRevenue: score.cumulativeRevenue,
          cumulativeControl: score.cumulativeControl,
          patentBonus: score.patentBonus,
          isBot: !!t.isBot
        });
      });
    }

    list.sort((a, b) => b.totalScore - a.totalScore);
    return list;
  }, [gameStateA, gameStateB]);

  const isProvisional = useMemo(() => {
    if (!gameStateA || !gameStateB) return true;
    if (gameStateA.currentRound !== gameStateB.currentRound) return true;
    if (gameStateA.currentPhase !== gameStateB.currentPhase) return true;
    return false;
  }, [gameStateA, gameStateB]);

  if (sessionLoading || (loadingA && loadingB)) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
        <p className="text-lg font-semibold animate-pulse text-purple-700">Loading Multi-World 10-Team Board...</p>
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Floating Combined Top Bar Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-30 shrink-0 shadow-sm sticky top-0">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-purple-600 animate-pulse" />
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              {session.name}
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                10-Team Multi-World
              </Badge>
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              Session Code: <span className="text-purple-700 font-bold">{session.sessionCode}</span>
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setLayoutMode('single')}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
              layoutMode === 'single' ? "bg-purple-600 text-white font-bold shadow-xs" : "text-slate-700 hover:bg-slate-200"
            )}
            title="Both Worlds Overlay on Single Board"
          >
            <MonitorCheck className="h-3.5 w-3.5" />
            Single Board (Overlay Both Worlds)
          </button>

          <button
            onClick={() => setLayoutMode('stacked')}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
              layoutMode === 'stacked' ? "bg-purple-600 text-white font-bold shadow-xs" : "text-slate-700 hover:bg-slate-200"
            )}
            title="World A Top / World B Bottom Stacked View"
          >
            <Layers className="h-3.5 w-3.5" />
            Stacked Boards
          </button>

          <button
            onClick={() => setLayoutMode('side')}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
              layoutMode === 'side' ? "bg-purple-600 text-white font-bold shadow-xs" : "text-slate-700 hover:bg-slate-200"
            )}
          >
            <Columns className="h-3.5 w-3.5" />
            Side-by-Side
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

          <button
            onClick={() => setLayoutMode('worldA')}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              layoutMode === 'worldA' ? "bg-purple-600 text-white font-bold shadow-xs" : "text-slate-700 hover:bg-slate-200"
            )}
          >
            {session.worldALabel}
          </button>

          <button
            onClick={() => setLayoutMode('worldB')}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              layoutMode === 'worldB' ? "bg-purple-600 text-white font-bold shadow-xs" : "text-slate-700 hover:bg-slate-200"
            )}
          >
            {session.worldBLabel}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isProvisional && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-600" /> Provisional Rank (Rounds Divergent)
            </Badge>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition shadow-sm"
            title="Toggle Fullscreen (F)"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Display Area */}
      <main className="flex-1 p-4 relative overflow-y-auto flex flex-col justify-start items-center space-y-6">
        {/* DEFAULT MODE: SINGLE BOARD OVERLAY (Both Worlds on 1 Board) */}
        {layoutMode === 'single' && (
          <div className="w-full flex justify-center">
            <MultiWorldSingleBoard
              session={session}
              gameStateA={gameStateA}
              gameStateB={gameStateB}
              classDataA={classDataA}
              classDataB={classDataB}
            />
          </div>
        )}

        {/* Layout 2: STACKED (World A Top / World B Bottom) */}
        {layoutMode === 'stacked' && (
          <div className="w-full max-w-[1920px] flex flex-col gap-6 items-center">
            {/* World A Board (TOP) */}
            <div className="w-full flex flex-col items-center border border-purple-300 rounded-2xl overflow-hidden bg-white shadow-xl p-3 relative">
              <div className="w-full bg-gradient-to-r from-purple-100 to-purple-50 px-5 py-3 flex items-center justify-between border-b border-purple-200 mb-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-600 shadow-sm" />
                  <span className="font-black text-purple-900 text-lg tracking-tight">
                    {session.worldALabel} (TOP BOARD)
                  </span>
                  <Badge className="bg-purple-200 text-purple-900 border-purple-300 font-bold text-xs">
                    World A
                  </Badge>
                </div>
                <div className="text-sm text-purple-900 font-bold flex items-center gap-3">
                  <span>Round {gameStateA?.currentRound || 1}</span>
                  <span>·</span>
                  <span className="capitalize">{gameStateA?.currentPhase} Phase</span>
                </div>
              </div>
              {gameStateA ? (
                <div className="w-full flex justify-center overflow-x-auto">
                  <ViewerBoard classData={classDataA || { name: session.worldALabel }} gameState={gameStateA} />
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-slate-400">
                  {errorA || 'World A state unavailable'}
                </div>
              )}
            </div>

            {/* World B Board (BOTTOM) */}
            <div className="w-full flex flex-col items-center border border-blue-300 rounded-2xl overflow-hidden bg-white shadow-xl p-3 relative">
              <div className="w-full bg-gradient-to-r from-blue-100 to-blue-50 px-5 py-3 flex items-center justify-between border-b border-blue-200 mb-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-600 shadow-sm" />
                  <span className="font-black text-blue-900 text-lg tracking-tight">
                    {session.worldBLabel} (BOTTOM BOARD)
                  </span>
                  <Badge className="bg-blue-200 text-blue-900 border-blue-300 font-bold text-xs">
                    World B
                  </Badge>
                </div>
                <div className="text-sm text-blue-900 font-bold flex items-center gap-3">
                  <span>Round {gameStateB?.currentRound || 1}</span>
                  <span>·</span>
                  <span className="capitalize">{gameStateB?.currentPhase} Phase</span>
                </div>
              </div>
              {gameStateB ? (
                <div className="w-full flex justify-center overflow-x-auto">
                  <ViewerBoard classData={classDataB || { name: session.worldBLabel }} gameState={gameStateB} />
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-slate-400">
                  {errorB || 'World B state unavailable'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Layout 3: SIDE-BY-SIDE */}
        {layoutMode === 'side' && (
          <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* World A Board */}
            <div className="flex flex-col items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xl p-2 relative">
              <div className="w-full bg-purple-50 px-4 py-2 flex items-center justify-between border-b border-purple-200 mb-2">
                <span className="font-extrabold text-purple-800 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  {session.worldALabel}
                </span>
                <span className="text-xs text-slate-600 font-semibold">
                  Round {gameStateA?.currentRound || 1} — {gameStateA?.currentPhase}
                </span>
              </div>
              {gameStateA ? (
                <div className="w-full flex justify-center">
                  <ViewerBoard classData={classDataA || { name: session.worldALabel }} gameState={gameStateA} />
                </div>
              ) : (
                <div className="h-[500px] flex items-center justify-center text-slate-400">
                  {errorA || 'World A unavailable'}
                </div>
              )}
            </div>

            {/* World B Board */}
            <div className="flex flex-col items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xl p-2 relative">
              <div className="w-full bg-blue-50 px-4 py-2 flex items-center justify-between border-b border-blue-200 mb-2">
                <span className="font-extrabold text-blue-800 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  {session.worldBLabel}
                </span>
                <span className="text-xs text-slate-600 font-semibold">
                  Round {gameStateB?.currentRound || 1} — {gameStateB?.currentPhase}
                </span>
              </div>
              {gameStateB ? (
                <div className="w-full flex justify-center">
                  <ViewerBoard classData={classDataB || { name: session.worldBLabel }} gameState={gameStateB} />
                </div>
              ) : (
                <div className="h-[500px] flex items-center justify-center text-slate-400">
                  {errorB || 'World B unavailable'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Layout 4: World A Only */}
        {layoutMode === 'worldA' && (
          <div className="w-full flex justify-center">
            <div className="flex flex-col items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xl p-2 relative w-full max-w-[1920px]">
              <div className="w-full bg-purple-50 px-4 py-2 flex items-center justify-between border-b border-purple-200 mb-2">
                <span className="font-extrabold text-purple-800 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  {session.worldALabel}
                </span>
                <span className="text-xs text-slate-600 font-semibold">
                  Round {gameStateA?.currentRound || 1} — {gameStateA?.currentPhase}
                </span>
              </div>
              {gameStateA ? (
                <ViewerBoard classData={classDataA || { name: session.worldALabel }} gameState={gameStateA} />
              ) : (
                <div className="h-[500px] flex items-center justify-center text-slate-400">
                  {errorA || 'World A unavailable'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Layout 5: World B Only */}
        {layoutMode === 'worldB' && (
          <div className="w-full flex justify-center">
            <div className="flex flex-col items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xl p-2 relative w-full max-w-[1920px]">
              <div className="w-full bg-blue-50 px-4 py-2 flex items-center justify-between border-b border-blue-200 mb-2">
                <span className="font-extrabold text-blue-800 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  {session.worldBLabel}
                </span>
                <span className="text-xs text-slate-600 font-semibold">
                  Round {gameStateB?.currentRound || 1} — {gameStateB?.currentPhase}
                </span>
              </div>
              {gameStateB ? (
                <ViewerBoard classData={classDataB || { name: session.worldBLabel }} gameState={gameStateB} />
              ) : (
                <div className="h-[500px] flex items-center justify-center text-slate-400">
                  {errorB || 'World B unavailable'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Layout 6: Combined 10-Team Leaderboard */}
        {layoutMode === 'leaderboard' && (
          <Card className="w-full max-w-4xl bg-white border-slate-200 shadow-xl my-4 text-slate-900">
            <CardHeader className="border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-amber-500" />
                  Combined Overall Leaderboard (Up to 10 Teams)
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

                  return (
                    <div
                      key={`${team.worldLabel}-${team.teamId}`}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all",
                        isTop3 ? "bg-amber-50/80 border-amber-300 shadow-xs" : "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-extrabold text-sm min-w-[50px] text-amber-700">{rankBadge}</span>
                        <Badge
                          className={cn(
                            "text-xs px-2 py-0.5 font-bold font-mono",
                            team.worldLabel === 'A'
                              ? "bg-purple-100 text-purple-800 border-purple-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          )}
                        >
                          World {team.worldLabel}
                        </Badge>
                        <span
                          className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="font-bold text-slate-900 text-base">{team.teamName}</span>
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
                        <div className="text-right">
                          <span className="text-2xl font-black text-amber-600">{team.totalScore}</span>
                          <span className="text-xs text-slate-500 ml-1">pts</span>
                        </div>
                      </div>
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

export default CombinedViewerPage;
