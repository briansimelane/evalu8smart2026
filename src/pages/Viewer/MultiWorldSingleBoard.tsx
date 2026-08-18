import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { MultiWorldSession } from '@/types/multiworld';
import { ViewerScaler } from './ViewerScaler';
import { Globe, Trophy } from 'lucide-react';
import { calculateTeamTotalScore } from '@/types/game';

import { WorldTag, WorldMarker } from './overlay/WorldMarker';
import { OverlayPriceLadder } from './overlay/OverlayPriceLadder';
import { OverlayRegionCard } from './overlay/OverlayRegionCard';
import { OverlayTechPanel } from './overlay/OverlayTechPanel';
import { OverlayImprovementPanel } from './overlay/OverlayImprovementPanel';

interface MultiWorldSingleBoardProps {
  session: MultiWorldSession;
  gameStateA: GameState | null;
  gameStateB: GameState | null;
  classDataA?: any;
  classDataB?: any;
}

const REGION_POSITIONS: Record<string, { left: number; top: number }> = {
  'Canada': { left: 77, top: 20 },
  'USA': { left: 40, top: 210 },
  'Caribbean': { left: 77, top: 400 },
  'South America': { left: 66, top: 590 },
  'Europe': { left: 520, top: 20 },
  'Emirates': { left: 600, top: 210 },
  'North Africa': { left: 500, top: 400 },
  'RSA': { left: 557, top: 590 },
  'CIS': { left: 1026, top: 20 },
  'China': { left: 1000, top: 210 },
  'India': { left: 1026, top: 400 },
  'Australia': { left: 1026, top: 590 },
};

export function MultiWorldSingleBoard({ session, gameStateA, gameStateB }: MultiWorldSingleBoardProps) {
  if (!gameStateA || !gameStateB) {
    return (
      <div className="w-full h-[600px] bg-slate-100 flex items-center justify-center text-slate-500 font-semibold">
        Waiting for World A & World B state...
      </div>
    );
  }

  const currentRound = Math.max(gameStateA.currentRound, gameStateB.currentRound);

  // Combined Top Scores for TopBar Leaderboard
  const topScores = useMemo(() => {
    const list: Array<{ team: Team; score: number; world: 'A' | 'B' }> = [];
    gameStateA.teams.forEach(t => {
      const s = calculateTeamTotalScore(t.id, gameStateA.currentRound, gameStateA);
      list.push({ team: t, score: s.totalScore, world: 'A' });
    });
    gameStateB.teams.forEach(t => {
      const s = calculateTeamTotalScore(t.id, gameStateB.currentRound, gameStateB);
      list.push({ team: t, score: s.totalScore, world: 'B' });
    });
    list.sort((a, b) => b.score - a.score);
    return list.slice(0, 5);
  }, [gameStateA, gameStateB]);

  return (
    <ViewerScaler>
      <div className="relative w-[1920px] h-[1080px] bg-slate-100 text-slate-900 overflow-hidden font-sans select-none border border-slate-300 shadow-2xl mo-board">
        {/* Solid Light Grey Background behind map */}
        <div className="absolute inset-0 bg-slate-100 pointer-events-none" />

        {/* 1. Authentic Top Bar (Height: 120px) */}
        <div className="absolute top-0 left-0 right-0 h-[120px] bg-white/95 border-b border-slate-300 px-6 flex items-center justify-between z-20 backdrop-blur-md shadow-md">
          <div className="flex items-center gap-4">
            <Globe className="h-8 w-8 text-purple-600 animate-pulse" />
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {session.name}
                <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200">
                  SINGLE BOARD OVERLAY (10 TEAMS)
                </span>
              </h1>
              <div className="text-xs text-slate-500 font-bold flex items-center gap-4 mt-0.5">
                <span>Code: <strong className="text-purple-700 font-mono">{session.sessionCode}</strong></span>
                <span>·</span>
                <span>Round {currentRound}</span>
                <span>·</span>
                <span className="capitalize">{session.worldALabel}: {gameStateA.currentPhase}</span>
                <span>·</span>
                <span className="capitalize">{session.worldBLabel}: {gameStateB.currentPhase}</span>
              </div>
            </div>
          </div>

          {/* Top 5 Leaderboard Pill in Header with World Markers */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-xs">
            <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider mr-1">Top Ranks:</span>
            <div className="flex items-center gap-2">
              {topScores.map((item) => (
                <div
                  key={`${item.world}-${item.team.id}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-extrabold shadow-xs bg-white border border-slate-200"
                  title={`${item.world === 'A' ? session.worldALabel : session.worldBLabel} - ${item.team.name}`}
                >
                  <WorldMarker
                    world={item.world}
                    teamColor={item.team.color}
                    size="xs"
                  >
                    {item.team.name.charAt(0).toUpperCase()}
                  </WorldMarker>
                  <span className="text-slate-800">{item.team.name}</span>
                  <span className="text-amber-600 font-mono">({item.score})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Main Board Canvas (Top 120px to Bottom 150px) */}
        <div className="absolute top-[120px] bottom-[150px] left-0 right-0">
          {/* Price Ladder Left Rail (Width: 150px) */}
          <OverlayPriceLadder gameStateA={gameStateA} gameStateB={gameStateB} />

          {/* Authentic Geographical Region Layer with SVG Connection Lines (Left 150px to Right 300px) */}
          <div className="absolute left-[150px] right-[300px] top-0 bottom-0 overflow-visible pointer-events-none">
            {/* SVG Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
              <path d="M 1166 185 C 1166 197.5, 1177 197.5, 1177 210" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 1177 375 C 1177 387.5, 1166 387.5, 1166 400" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 1166 565 L 1166 590" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 837 672.5 L 1026 672.5" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 525 185 L 525 400" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 880 290 C 950 360, 950 600, 837 672.5" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 880 292.5 C 945 292.5, 960 482.5, 1026 482.5" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 874 102.5 L 1026 102.5" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 368 672.5 L 557 672.5" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 217 565 L 217 590" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 217 375 L 217 400" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 217 185 L 217 210" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 394 250 C 455 250, 460 102.5, 520 102.5" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 350 375 C 440 430, 440 600, 368 672.5" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 500 482.5 C 430 482.5, 420 630, 368 630" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 680 375 L 680 400" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M 802 482.5 C 900 482.5, 920 292.5, 1000 292.5" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
            </svg>

            {/* Render Map Region Cards positioned at exact coordinates */}
            <div className="absolute inset-0 overflow-visible pointer-events-auto z-10">
              {Object.entries(REGION_POSITIONS).map(([regionName, pos]) => (
                <div
                  key={regionName}
                  style={{ left: pos.left, top: pos.top }}
                  className="absolute"
                >
                  <OverlayRegionCard
                    regionName={regionName}
                    gameStateA={gameStateA}
                    gameStateB={gameStateB}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 3. Improvements Marketplace Right Panel (Width: 300px) */}
          <OverlayImprovementPanel gameStateA={gameStateA} gameStateB={gameStateB} />
        </div>

        {/* 4. R&D Tech Panel Bottom Strip (Height: 150px) */}
        <OverlayTechPanel gameStateA={gameStateA} gameStateB={gameStateB} />
      </div>
    </ViewerScaler>
  );
}
