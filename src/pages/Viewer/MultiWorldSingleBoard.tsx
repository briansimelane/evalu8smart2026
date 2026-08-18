import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { MultiWorldSession } from '@/types/multiworld';
import { ViewerScaler } from './ViewerScaler';
import { REGIONS } from '@/data/combinations';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { MapPin, Wifi, Gamepad2, Battery, Radio, Signal, Trophy, Globe, Award, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateTeamTotalScore } from '@/types/game';

interface MultiWorldSingleBoardProps {
  session: MultiWorldSession;
  gameStateA: GameState | null;
  gameStateB: GameState | null;
  classDataA?: any;
  classDataB?: any;
}

const getContrastTextColor = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
};

const TECHNOLOGY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'GPS': MapPin,
  'Wifi': Wifi,
  'Gaming': Gamepad2,
  'Battery': Battery,
  'NFC': Radio,
  '4G': Signal,
};

const REGION_CARD_WIDTHS: Record<string, number> = {
  'Canada': 280,
  'USA': 354,
  'Caribbean': 280,
  'South America': 302,
  'Europe': 354,
  'Emirates': 280,
  'North Africa': 302,
  'RSA': 280,
  'CIS': 280,
  'China': 354,
  'India': 280,
  'Australia': 280,
};

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
  const roundDataA = gameStateA.rounds.find(r => r.roundNumber === gameStateA.currentRound);
  const roundDataB = gameStateB.rounds.find(r => r.roundNumber === gameStateB.currentRound);

  const prices = [8, 7, 6, 5, 4, 3, 2];

  // Price ladder mapping for World A & World B teams
  const teamsByPrice = useMemo(() => {
    const mapping: Record<number, Array<{ team: Team; world: 'A' | 'B' }>> = {};
    prices.forEach(p => { mapping[p] = []; });

    if (gameStateA.currentPhase !== 'planning' && roundDataA) {
      gameStateA.teams.forEach(team => {
        const p = roundDataA.teamData[team.id]?.price;
        if (p && mapping[p]) {
          mapping[p].push({ team, world: 'A' });
        }
      });
    }

    if (gameStateB.currentPhase !== 'planning' && roundDataB) {
      gameStateB.teams.forEach(team => {
        const p = roundDataB.teamData[team.id]?.price;
        if (p && mapping[p]) {
          mapping[p].push({ team, world: 'B' });
        }
      });
    }

    return mapping;
  }, [gameStateA, gameStateB, roundDataA, roundDataB]);

  // Combined Top Scores for TopBar
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

  const DESIRED_TECH_ORDER = ['GPS', 'WIFI', 'GAMING', 'BATTERY', 'NFC', '4G'];
  const sortedTechs = useMemo(() => {
    return Object.values(gameStateA.technologies).sort((a, b) => {
      const rankA = DESIRED_TECH_ORDER.indexOf(a.name.toUpperCase());
      const rankB = DESIRED_TECH_ORDER.indexOf(b.name.toUpperCase());
      return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
    });
  }, [gameStateA.technologies]);

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

          {/* Top 5 Leaderboard Pill in Header */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-xs">
            <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider mr-1">Top Ranks:</span>
            <div className="flex items-center gap-2">
              {topScores.map((item) => (
                <div
                  key={`${item.world}-${item.team.id}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-extrabold shadow-xs"
                  style={{ backgroundColor: item.team.color, color: getContrastTextColor(item.team.color) }}
                  title={`${item.world === 'A' ? session.worldALabel : session.worldBLabel} - ${item.team.name}`}
                >
                  <span className="text-[10px] px-1 bg-black/20 rounded font-mono">
                    {item.world}
                  </span>
                  <span>{item.team.name}</span>
                  <span className="text-amber-300 font-mono">({item.score})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Main Board Canvas (Top 120px to Bottom 150px) */}
        <div className="absolute top-[120px] bottom-[150px] left-0 right-0">
          {/* Price Ladder Left Rail (Width: 140px) */}
          <div className="absolute top-0 bottom-0 left-0 w-[140px] bg-white/95 border-r border-slate-300 p-3.5 flex flex-col justify-between z-10 backdrop-blur-md shadow-lg">
            <span className="text-sm font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-400 pb-1.5 w-full text-center">
              Price
            </span>
            <div className="relative flex flex-col justify-between w-full flex-1 py-1">
              {prices.map(price => {
                const teams = teamsByPrice[price] || [];
                return (
                  <div key={price} className="relative flex items-center justify-between h-[90px] border-b border-slate-300 last:border-b-0 px-1 gap-1">
                    <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-red-600 text-white font-mono text-lg font-black shadow-md shrink-0 z-10">
                      ${price}
                    </div>
                    <div className="flex items-center justify-end flex-wrap gap-1 flex-1 min-w-0 pr-0.5">
                      {teams.map(({ team, world }) => (
                        <div
                          key={`${world}-${team.id}`}
                          className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shadow-md ring-2 ring-white shrink-0 relative"
                          style={{ backgroundColor: team.color, color: getContrastTextColor(team.color) }}
                          title={`World ${world} · ${team.name}: $${price}`}
                        >
                          <span className="text-[8px] absolute -top-1 -left-1 px-1 bg-slate-900 text-white rounded-full font-mono font-bold">
                            {world}
                          </span>
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Authentic Geographical Region Layer with SVG Connection Lines (Left 140px to Right 300px) */}
          <div className="absolute left-[140px] right-[300px] top-0 bottom-0 overflow-visible pointer-events-none">
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
              {Object.entries(REGION_POSITIONS).map(([regionName, pos]) => {
                const cardWidth = REGION_CARD_WIDTHS[regionName] || 280;
                const customerData = REGION_CUSTOMERS.find(c => c.region === regionName)?.customers || [];

                // World A data
                const regA = gameStateA.regionLogistics[regionName];
                const logisticsCost = regA?.logisticsCost || 2;
                const presentA = regA?.teamsPresent || [];

                // World B data
                const regB = gameStateB.regionLogistics[regionName];
                const presentB = regB?.teamsPresent || [];

                // Customers buyers
                const buyersA = customerData.map(c => {
                  let buyer: Team | null = null;
                  if (roundDataA?.teamData) {
                    for (const t of gameStateA.teams) {
                      if (roundDataA.teamData[t.id]?.customersSold?.includes(c.id)) {
                        buyer = t;
                        break;
                      }
                    }
                  }
                  return { customer: c, buyer };
                });

                const buyersB = customerData.map(c => {
                  let buyer: Team | null = null;
                  if (roundDataB?.teamData) {
                    for (const t of gameStateB.teams) {
                      if (roundDataB.teamData[t.id]?.customersSold?.includes(c.id)) {
                        buyer = t;
                        break;
                      }
                    }
                  }
                  return { customer: c, buyer };
                });

                return (
                  <div
                    key={regionName}
                    style={{ left: pos.left, top: pos.top, width: `${cardWidth}px` }}
                    className="absolute h-[165px] bg-white rounded-xl p-3 flex flex-col justify-between border border-slate-300 shadow-md backdrop-blur-sm hover:border-slate-500 hover:shadow-xl transition-all duration-300 text-slate-900"
                  >
                    {/* Header: Logistics Badge + Region Name */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-100 border-2 border-slate-500 px-2 py-0.5 rounded-lg shadow-xs">
                          <GameIcon type="logistics" size="sm" />
                          <span className="text-slate-900 text-sm font-black">{logisticsCost}</span>
                        </div>
                        <span className="font-display font-black text-base tracking-tight text-slate-900">
                          {regionName.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Dual World Overlay Content */}
                    <div className="grid grid-cols-2 gap-2 flex-1 my-1">
                      {/* World A Sub-Panel */}
                      <div className="bg-purple-50/80 border border-purple-200 rounded-lg p-1.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-purple-900">WORLD A</span>
                          <div className="flex gap-0.5">
                            {presentA.map(tId => {
                              const t = gameStateA.teams.find(tm => tm.id === tId);
                              if (!t) return null;
                              return (
                                <span
                                  key={tId}
                                  className="w-3 h-3 rounded-full border border-white shrink-0"
                                  style={{ backgroundColor: t.color }}
                                  title={`${t.name} present`}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* Customer Sales Grid */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {buyersA.map(({ customer, buyer }) => (
                            <div
                              key={customer.id}
                              className="w-4 h-4 rounded text-[8px] font-black flex items-center justify-center border shadow-xs"
                              style={{
                                backgroundColor: buyer ? buyer.color : '#f1f5f9',
                                color: buyer ? getContrastTextColor(buyer.color) : '#64748b'
                              }}
                              title={`A · Cust #${customer.position}: ${buyer ? buyer.name : 'Unsold'}`}
                            >
                              {customer.price ? `$${customer.price}` : customer.technology?.substring(0, 3) || 'V'}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* World B Sub-Panel */}
                      <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-1.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-blue-900">WORLD B</span>
                          <div className="flex gap-0.5">
                            {presentB.map(tId => {
                              const t = gameStateB.teams.find(tm => tm.id === tId);
                              if (!t) return null;
                              return (
                                <span
                                  key={tId}
                                  className="w-3 h-3 rounded-full border border-white shrink-0"
                                  style={{ backgroundColor: t.color }}
                                  title={`${t.name} present`}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* Customer Sales Grid */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {buyersB.map(({ customer, buyer }) => (
                            <div
                              key={customer.id}
                              className="w-4 h-4 rounded text-[8px] font-black flex items-center justify-center border shadow-xs"
                              style={{
                                backgroundColor: buyer ? buyer.color : '#f1f5f9',
                                color: buyer ? getContrastTextColor(buyer.color) : '#64748b'
                              }}
                              title={`B · Cust #${customer.position}: ${buyer ? buyer.name : 'Unsold'}`}
                            >
                              {customer.price ? `$${customer.price}` : customer.technology?.substring(0, 3) || 'V'}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Improvements Marketplace Right Panel (Width: 300px) */}
          <div className="absolute top-0 bottom-0 right-0 w-[300px] bg-white/95 border-l border-slate-300 p-3.5 flex flex-col justify-between z-10 backdrop-blur-md shadow-lg">
            <span className="text-base font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-400 pb-1.5 w-full text-center">
              Improvements
            </span>

            {/* World A Cards */}
            <div className="space-y-1.5 bg-purple-50 p-2.5 rounded-xl border border-purple-200">
              <span className="text-[11px] font-black text-purple-900 uppercase tracking-wider block">World A Cards</span>
              <div className="grid grid-cols-2 gap-1.5">
                {gameStateA.improvementCards?.slice(0, 4).map(card => {
                  const owner = gameStateA.teams.find(t => t.id === card.availableForTeam);
                  return (
                    <div key={card.id} className="p-2 bg-white rounded-lg border border-purple-200 text-xs font-extrabold shadow-xs">
                      <div className="text-purple-900">{card.icon1} + {card.icon2}</div>
                      {owner && <div className="text-[10px] text-slate-500 font-normal">For: {owner.name}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* World B Cards */}
            <div className="space-y-1.5 bg-blue-50 p-2.5 rounded-xl border border-blue-200">
              <span className="text-[11px] font-black text-blue-900 uppercase tracking-wider block">World B Cards</span>
              <div className="grid grid-cols-2 gap-1.5">
                {gameStateB.improvementCards?.slice(0, 4).map(card => {
                  const owner = gameStateB.teams.find(t => t.id === card.availableForTeam);
                  return (
                    <div key={card.id} className="p-2 bg-white rounded-lg border border-blue-200 text-xs font-extrabold shadow-xs">
                      <div className="text-blue-900">{card.icon1} + {card.icon2}</div>
                      {owner && <div className="text-[10px] text-slate-500 font-normal">For: {owner.name}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 4. R&D Tech Panel Bottom Strip (Height: 150px) */}
        <div className="absolute bottom-0 left-0 right-0 h-[150px] bg-white/95 border-t border-slate-300 px-6 flex items-center justify-between z-10 backdrop-blur-md shadow-xl text-slate-900">
          <div className="flex flex-col shrink-0 pr-4">
            <div className="flex items-center gap-2">
              <GameIcon type="research" size="md" />
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Research & Development</span>
            </div>
            <span className="text-2xl font-black text-slate-900 uppercase tracking-tight mt-0.5">Technologies</span>
            <span className="text-xs text-purple-700 font-bold italic mt-0.5">World A & World B Overlay</span>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-start overflow-x-auto pl-4 py-2">
            {sortedTechs.map(techA => {
              const patentA = gameStateA.patents[techA.name] ? gameStateA.teams.find(t => t.id === gameStateA.patents[techA.name]) : null;
              const patentB = gameStateB.patents[techA.name] ? gameStateB.teams.find(t => t.id === gameStateB.patents[techA.name]) : null;
              const Icon = TECHNOLOGY_ICONS[techA.name] || MapPin;

              return (
                <div key={techA.name} className="w-[250px] h-[122px] rounded-xl border-2 border-slate-400 bg-white p-3 flex flex-col justify-between shadow-md shrink-0 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-purple-700 stroke-[2.5]" />
                      <span className="font-display font-black text-sm text-slate-900 tracking-tight">{techA.name.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-black">
                    <div className="p-1.5 bg-purple-50 rounded-lg border border-purple-200 text-purple-900">
                      <div className="text-[9px] text-purple-700 font-bold">A Patent:</div>
                      <div className="truncate">{patentA ? patentA.name : 'Available'}</div>
                    </div>
                    <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-200 text-blue-900">
                      <div className="text-[9px] text-blue-700 font-bold">B Patent:</div>
                      <div className="truncate">{patentB ? patentB.name : 'Available'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ViewerScaler>
  );
}
