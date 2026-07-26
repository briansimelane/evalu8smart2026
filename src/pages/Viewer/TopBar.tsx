import React, { useMemo, useRef, useState, useEffect } from 'react';
import { GameState, SimulationClass } from '@/types/game';
import { calculatePlayOrderForState } from '@/hooks/useGameBoardState';
import { GameIcon } from '@/components/dashboard/GameIcon';

interface TopBarProps {
  classData: SimulationClass;
  gameState: GameState;
}

// Helper to calculate high-contrast text color (black vs white) for any background hex
const getContrastTextColor = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
};

export function TopBar({ classData, gameState }: TopBarProps) {
  const round = gameState.currentRound;
  const currentPhase = (gameState.currentPhase || 'planning').toLowerCase();
  const roundData = gameState.rounds.find(r => r.roundNumber === round);
  
  // Calculate turn order (play order) for current round
  const playOrder = useMemo(() => {
    return calculatePlayOrderForState(gameState, round);
  }, [gameState, round]);

  // Track previous unsold count per team to animate individual team bubbles in Sales phase
  const [animatingTeamId, setAnimatingTeamId] = useState<string | null>(null);
  const prevUnsoldByTeamRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const prevMap = prevUnsoldByTeamRef.current;
    const currentMap: Record<string, number> = {};

    gameState.teams.forEach(team => {
      const tData = roundData?.teamData[team.id];
      const produced = tData?.productsProduced || 0;
      const sold = tData?.customersSold?.length || 0;
      const unsold = Math.max(0, produced - sold);
      currentMap[team.id] = unsold;

      if (currentPhase === 'sales' && prevMap[team.id] !== undefined && prevMap[team.id] !== unsold) {
        setAnimatingTeamId(team.id);
        const t = setTimeout(() => setAnimatingTeamId(null), 3500);
        return () => clearTimeout(t);
      }
    });

    prevUnsoldByTeamRef.current = currentMap;
  }, [gameState.teams, roundData, currentPhase]);

  // Determine active turn team
  const activeTurnTeam = useMemo(() => {
    const phase = gameState.currentPhase || 'planning';
    const roundData = gameState.rounds.find(r => r.roundNumber === round);
    if (!roundData) return null;

    if (phase === 'improvement') {
      return playOrder.find(t => {
        const count = roundData.teamData[t.id]?.improvementCards || 0;
        const isDone = gameState.improvementCards.some(c => 
          (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === round
        );
        return count > 0 && !isDone;
      });
    } else if (phase === 'innovation') {
      return playOrder.find(t => {
        const icons = roundData.teamData[t.id]?.researchIcons || 0;
        const spent = (gameState.researchAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'expansion') {
      return playOrder.find(t => {
        const icons = roundData.teamData[t.id]?.logisticsIcons || 0;
        const spent = (gameState.logisticsAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'sales') {
      const activeSalesPlayOrder = playOrder.filter(team => {
        const tData = roundData.teamData[team.id];
        return (tData?.productsProduced || 0) > 0;
      });
      return activeSalesPlayOrder.find(t => {
        const tData = roundData.teamData[t.id];
        return !tData?.customersSold;
      });
    }
    return null;
  }, [gameState, round, playOrder]);

  // Updated 8 Phases mapping with game icon keys
  const phases = [
    { key: 'planning', label: '1. Planning' },
    { key: 'production', label: '2. Production' },
    { key: 'improvement', label: '3. Improvements' },
    { key: 'research', label: '4. Research' },
    { key: 'logistics', label: '5. Logistics' },
    { key: 'sales', label: '6. Sales' },
    { key: 'control', label: '7. Control' },
    { key: 'scoring', label: '8. Scoring' },
  ];

  // Helper to determine if a phase is active, past, or future
  const getPhaseState = (index: number) => {
    const curPhase = gameState.currentPhase || 'planning';
    
    // Map currentPhase to index in our phases array
    let activeIdx = 0;
    if (curPhase === 'planning') activeIdx = 0;
    else if (curPhase === 'production') activeIdx = 1;
    else if (curPhase === 'improvement') activeIdx = 2;
    else if (curPhase === 'innovation' || curPhase === 'research') activeIdx = 3;
    else if (curPhase === 'expansion' || curPhase === 'logistics') activeIdx = 4;
    else if (curPhase === 'sales') activeIdx = 5;
    else if (curPhase === 'control') activeIdx = 6;
    else if (curPhase === 'scoring') activeIdx = 7;

    if (index === activeIdx) return 'active';
    if (index < activeIdx) return 'past';
    return 'future';
  };

  const isProductionPhase = getPhaseState(1) === 'active';
  const isProductionOrLater = getPhaseState(1) !== 'future';

  return (
    <div className="absolute top-0 left-0 right-0 h-[120px] bg-white/95 border-b border-slate-200 shadow-sm flex items-center justify-between px-6 z-10 backdrop-blur-md">
      {/* Round & Play Order */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Class: {classData.name}</span>
          <span className="text-3xl font-black text-slate-900 tracking-tight">ROUND {round}</span>
        </div>
        <div className="h-10 w-[1px] bg-slate-200" />
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest mr-1">Turn Order:</span>
          {playOrder.map((team, idx) => {
            const isActive = activeTurnTeam?.id === team.id;
            const textColor = getContrastTextColor(team.color);
            return (
              <div 
                key={team.id}
                style={{ backgroundColor: team.color, color: textColor }}
                className={`relative w-10 h-10 rounded-full shadow-md flex items-center justify-center text-sm font-black transition-all duration-500 border border-black/10 shrink-0 ${
                  isActive 
                    ? 'animate-attention ring-4 ring-offset-2 ring-emerald-500 scale-110 z-10 font-extrabold' 
                    : 'opacity-85 hover:opacity-100'
                }`}
                title={`${idx + 1}. ${team.name}`}
              >
                <span>{idx + 1}</span>
                {isActive && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase Track */}
      <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200/80">
        {phases.map((p, idx) => {
          const state = getPhaseState(idx);
          
          let opacityClass = 'opacity-100';
          let borderClass = 'border-slate-200 bg-white shadow-xs';
          let scaleClass = 'scale-95';

          if (state === 'active') {
            opacityClass = 'opacity-100';
            borderClass = 'border-amber-500 bg-white ring-4 ring-amber-400/80 ring-offset-2 shadow-xl animate-flash-three-slow z-20 font-black';
            scaleClass = 'scale-105';
          } else if (state === 'past') {
            opacityClass = 'opacity-50';
            borderClass = 'border-transparent bg-slate-200/50';
            scaleClass = 'scale-95';
          } else if (state === 'future') {
            opacityClass = 'opacity-85';
            borderClass = 'border-slate-200/60 bg-white/70';
            scaleClass = 'scale-95';
          }

          return (
            <div 
              key={p.key}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-500 ${borderClass} ${opacityClass} ${scaleClass}`}
            >
              <GameIcon type={p.key} size="sm" />
              <span className={`text-xs font-black uppercase tracking-wider ${state === 'active' ? 'text-slate-900' : 'text-slate-600'}`}>
                {p.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Independent Unsold Products Floating Bar (z-40, 100% Opaque bg-white, positioned below 2. Production) */}
      {isProductionOrLater && (
        <div 
          key={isProductionPhase ? `prod-bar-${round}` : 'prod-bar-static'}
          className={`absolute top-[96px] left-[785px] -translate-x-1/2 bg-white border-2 border-slate-400 rounded-xl px-3.5 py-1.5 shadow-2xl flex items-center gap-2.5 z-40 whitespace-nowrap opacity-100 pointer-events-auto transition-all duration-300 ${
            isProductionPhase ? 'animate-bubble-pop ring-4 ring-amber-400/80' : ''
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-300 pr-2.5">
            <GameIcon type="production" size="xs" />
            <span>Unsold Products:</span>
          </div>
          <div className="flex items-center gap-2">
            {gameState.teams.map(team => {
              const tData = roundData?.teamData[team.id];
              const produced = tData?.productsProduced || 0;
              const sold = tData?.customersSold?.length || 0;
              const unsold = Math.max(0, produced - sold);
              const textColor = getContrastTextColor(team.color);

              if (produced === 0) return null;

              const isTeamBubbleAnimating = animatingTeamId === team.id;

              return (
                <div 
                  key={team.id}
                  style={{ backgroundColor: team.color, color: textColor }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black shadow-sm ring-1 ring-black/10 transition-all duration-300 ${
                    isTeamBubbleAnimating ? 'animate-bubble-pop ring-4 ring-amber-400 scale-110' : ''
                  }`}
                  title={`${team.name}: ${unsold} unsold products remaining (${produced} produced, ${sold} sold)`}
                >
                  <span>{team.name[0]}:</span>
                  <span className="font-mono text-sm">{unsold}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
