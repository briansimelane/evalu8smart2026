import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { MultiWorldSession } from '@/types/multiworld';
import { ViewerScaler } from './ViewerScaler';
import { Globe, Trophy } from 'lucide-react';
import { calculateTeamTotalScore } from '@/types/game';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { cn } from '@/lib/utils';

import { WorldTag, WorldMarker } from './overlay/WorldMarker';
import { OverlayPriceLadder } from './overlay/OverlayPriceLadder';
import { OverlayRegionCard } from './overlay/OverlayRegionCard';
import { OverlayTechPanel } from './overlay/OverlayTechPanel';
import { OverlayImprovementPanel } from './overlay/OverlayImprovementPanel';
import { MotionProvider, useOptionalMotion } from './motion/MotionContext';
import { getMotionClass, getMotionStyles } from './motion/motionClass';

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

function SingleBoardContent({ session, gameStateA, gameStateB }: { session: MultiWorldSession; gameStateA: GameState; gameStateB: GameState }) {
  const m = useOptionalMotion();
  const currentRound = Math.max(gameStateA.currentRound, gameStateB.currentRound);
  const roundDataA = gameStateA.rounds.find(r => r.roundNumber === gameStateA.currentRound);
  const roundDataB = gameStateB.rounds.find(r => r.roundNumber === gameStateB.currentRound);

  // Turn order calculation (sorted by price ascending, hidden during planning)
  const turnOrderA = useMemo(() => {
    if (gameStateA.currentPhase === 'planning' || !roundDataA?.teamData) return [];
    return gameStateA.teams
      .map(team => ({ team, price: roundDataA.teamData[team.id]?.price || 0 }))
      .filter(t => t.price > 0)
      .sort((a, b) => a.price - b.price);
  }, [gameStateA.teams, gameStateA.currentPhase, roundDataA]);

  const turnOrderB = useMemo(() => {
    if (gameStateB.currentPhase === 'planning' || !roundDataB?.teamData) return [];
    return gameStateB.teams
      .map(team => ({ team, price: roundDataB.teamData[team.id]?.price || 0 }))
      .filter(t => t.price > 0)
      .sort((a, b) => a.price - b.price);
  }, [gameStateB.teams, gameStateB.currentPhase, roundDataB]);

  const isPlanningPhase = (gameStateA.currentPhase || 'planning') === 'planning' && (gameStateB.currentPhase || 'planning') === 'planning';

  return (
    <ViewerScaler>
      <div
        className={cn(
          "relative w-[1920px] h-[1080px] bg-slate-100 text-slate-900 overflow-hidden font-sans select-none border border-slate-300 shadow-2xl mo-board",
          m?.spotlight && "mo-spotlight",
          m?.settling && "mo-settle"
        )}
        data-spotlight={m?.spotlight ? 'on' : undefined}
      >
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
                  SINGLE BOARD OVERLAY
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

          {/* Turn Order Header Bar for Current Round (Hidden during Planning) */}
          {!isPlanningPhase ? (
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-xs text-xs">
              <div className="flex items-center gap-1 font-black text-slate-800 uppercase tracking-wider pr-1">
                <span className="text-purple-600">⚡</span>
                <span>Turn Order (Rd {currentRound}):</span>
              </div>

              {/* World A Turn Order */}
              <div className="flex items-center gap-1.5 bg-purple-50/90 px-2.5 py-1 rounded-lg border border-purple-200">
                <WorldTag world="A" label="A" className="text-[8px] px-1 py-0 h-4" />
                <div className="flex items-center gap-1">
                  {turnOrderA.length === 0 ? (
                    <span className="text-[10px] text-purple-400 font-bold italic">Planning in Progress</span>
                  ) : (
                    turnOrderA.map((t, idx) => (
                      <div key={`turn-A-${t.team.id}`} className="flex items-center gap-1">
                        {idx > 0 && <span className="text-slate-400 font-bold text-[10px]">→</span>}
                        <WorldMarker world="A" teamColor={t.team.color} size="xs" title={`${t.team.name}: $${t.price}`}>
                          {t.team.name.charAt(0).toUpperCase()}
                        </WorldMarker>
                        <span className="font-mono text-[10px] font-extrabold text-slate-800">${t.price}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* World B Turn Order */}
              <div className="flex items-center gap-1.5 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200">
                <WorldTag world="B" label="B" className="text-[8px] px-1 py-0 h-4" />
                <div className="flex items-center gap-1">
                  {turnOrderB.length === 0 ? (
                    <span className="text-[10px] text-slate-400 font-bold italic">Planning in Progress</span>
                  ) : (
                    turnOrderB.map((t, idx) => (
                      <div key={`turn-B-${t.team.id}`} className="flex items-center gap-1">
                        {idx > 0 && <span className="text-slate-400 font-bold text-[10px]">→</span>}
                        <WorldMarker world="B" teamColor={t.team.color} size="xs" title={`${t.team.name}: $${t.price}`}>
                          {t.team.name.charAt(0).toUpperCase()}
                        </WorldMarker>
                        <span className="font-mono text-[10px] font-extrabold text-slate-800">${t.price}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 italic shadow-2xs">
              <span>📋 Planning Phase Active — Turn Order & Pricing Hidden</span>
            </div>
          )}
        </div>

        {/* Units Produced & Unsold Inventory Floating Bar for World A & World B (Hidden during Planning) */}
        {!isPlanningPhase && (
          <div className="absolute top-[96px] left-[780px] -translate-x-1/2 bg-white border-2 border-slate-300 rounded-xl px-3.5 py-1.5 shadow-2xl flex items-center gap-3 z-30 backdrop-blur-md select-none">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider border-r border-slate-300 pr-3 shrink-0">
              <GameIcon type="production" size="xs" />
              <span>Units Produced:</span>
            </div>

            {/* World A Units */}
            <div className="flex items-center gap-1.5 bg-purple-50/90 px-2.5 py-1 rounded-lg border border-purple-200">
              <WorldTag world="A" label="A" className="text-[8px] px-1 py-0 h-4" />
              <div className="flex items-center gap-1.5">
                {gameStateA.teams.map(team => {
                  const tData = roundDataA?.teamData[team.id];
                  const produced = tData?.productsProduced || 0;
                  const sold = tData?.customersSold?.length || 0;
                  const unsold = Math.max(0, produced - sold);

                  return (
                    <div
                      key={`prod-A-${team.id}`}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black shadow-2xs border transition-all",
                        produced > 0 ? "bg-white border-purple-200" : "bg-slate-50 border-slate-200 opacity-60"
                      )}
                      title={`World A · ${team.name}: ${produced} Produced, ${sold} Sold, ${unsold} Unsold`}
                    >
                      <WorldMarker world="A" teamColor={team.color} size="xs">
                        {team.name.charAt(0).toUpperCase()}
                      </WorldMarker>
                      <span className="font-mono text-slate-900 font-extrabold">{produced}</span>
                      {produced > 0 && (
                        <span className="text-[10px] text-slate-500 font-bold" title={`${unsold} unsold remaining`}>
                          ({unsold})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* World B Units */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200">
              <WorldTag world="B" label="B" className="text-[8px] px-1 py-0 h-4" />
              <div className="flex items-center gap-1.5">
                {gameStateB.teams.map(team => {
                  const tData = roundDataB?.teamData[team.id];
                  const produced = tData?.productsProduced || 0;
                  const sold = tData?.customersSold?.length || 0;
                  const unsold = Math.max(0, produced - sold);

                  return (
                    <div
                      key={`prod-B-${team.id}`}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black shadow-2xs border transition-all",
                        produced > 0 ? "bg-white border-slate-300" : "bg-slate-50 border-slate-200 opacity-60"
                      )}
                      title={`World B · ${team.name}: ${produced} Produced, ${sold} Sold, ${unsold} Unsold`}
                    >
                      <WorldMarker world="B" teamColor={team.color} size="xs">
                        {team.name.charAt(0).toUpperCase()}
                      </WorldMarker>
                      <span className="font-mono text-slate-900 font-extrabold">{produced}</span>
                      {produced > 0 && (
                        <span className="text-[10px] text-slate-500 font-bold" title={`${unsold} unsold remaining`}>
                          ({unsold})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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

export function MultiWorldSingleBoard({ session, gameStateA, gameStateB, classDataA, classDataB }: MultiWorldSingleBoardProps) {
  if (!gameStateA || !gameStateB) {
    return (
      <div className="w-full h-[600px] bg-slate-100 flex items-center justify-center text-slate-500 font-semibold">
        Waiting for World A & World B state...
      </div>
    );
  }

  return (
    <MotionProvider gameState={gameStateA}>
      <SingleBoardContent session={session} gameStateA={gameStateA} gameStateB={gameStateB} />
    </MotionProvider>
  );
}
