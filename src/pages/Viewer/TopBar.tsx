import React, { useMemo } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GameState, Team, SimulationClass } from '@/types/game';
import { calculatePlayOrderForState } from '@/hooks/useGameBoardState';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { useMotion } from './motion/MotionContext';
import { getMotionClass, getMotionStyles } from './motion/motionClass';
import { cn, removeUndefined, safeIsoString } from '@/lib/utils';
import { useSession } from '@/contexts/SessionContext';
import { getTeamBubbleText } from '@/lib/multiworld/teamLabel';

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
  const { currentRole, isReadOnly } = useSession();
  const canChangePhase = currentRole !== 'STUDENT' && !isReadOnly;
  const round = gameState.currentRound;
  const roundData = gameState.rounds.find(r => r.roundNumber === round);
  const m = useMotion();
  
  // Calculate turn order (play order) for current round
  const playOrder = useMemo(() => {
    return calculatePlayOrderForState(gameState, round);
  }, [gameState, round]);

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

  // Handler to switch phase directly from Viewer TopBar
  const handlePhaseClick = async (phaseKey: string) => {
    if (!canChangePhase) return;
    if (phaseKey === 'improvement' && round >= 5) return;
    if (!classData?.id || !gameState) return;
    try {
      const sanitizedState = {
        ...gameState,
        currentPhase: phaseKey,
        createdAt: safeIsoString(gameState.createdAt),
        updatedAt: safeIsoString(new Date())
      };

      const safeGameState = removeUndefined(sanitizedState);

      const gameRef = doc(db, 'classes', classData.id, 'state', 'game');
      await setDoc(gameRef, { gameState: safeGameState }, { merge: true });

      const classRef = doc(db, 'classes', classData.id);
      await updateDoc(classRef, {
        'gameState.currentPhase': phaseKey,
        'gameState.updatedAt': new Date().toISOString()
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to change phase from Viewer TopBar:', err);
    }
  };

  // 8 Phases mapping with game icon keys
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
          {isProductionOrLater ? (
            playOrder.map((team, idx) => {
              const isActive = activeTurnTeam?.id === team.id;
              const textColor = getContrastTextColor(team.color);

              const turnKey = `turn:${team.id}`;
              const turnClass = getMotionClass(m, turnKey, 'sm');
              const turnStyles = getMotionStyles(m, turnKey, team.color);

              return (
                <div 
                  key={team.id}
                  style={{ backgroundColor: team.color, color: textColor, ...turnStyles }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-black shadow-sm ring-1 ring-black/10 transition-all duration-300 flex items-center gap-1.5",
                    isActive && "ring-2 ring-purple-600 ring-offset-2 scale-105 animate-pulse",
                    turnClass
                  )}
                >
                  <span className="font-mono">{idx + 1}.</span>
                  <span>{team.name}</span>
                </div>
              );
            })
          ) : (
            <span className="text-xs text-slate-400 italic">Determined in Production</span>
          )}
        </div>
      </div>

      {/* 8 Phase Stepper Bar */}
      <div className="flex items-center gap-2">
        {phases.map((p, idx) => {
          const state = getPhaseState(idx);
          const isDisabled = p.key === 'improvement' && round >= 5;
          const isClickable = canChangePhase && !isDisabled;

          let borderClass = 'border-slate-300 bg-white';
          let opacityClass = 'opacity-100';
          let scaleClass = 'scale-100';

          if (state === 'active') {
            borderClass = 'border-purple-600 bg-purple-50 ring-2 ring-purple-500/20 shadow-sm';
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
            <button 
              key={p.key}
              onClick={() => handlePhaseClick(p.key)}
              disabled={!isClickable}
              title={isDisabled ? 'Improvement phase skipped in Round 5+' : (canChangePhase ? `Switch to ${p.label}` : p.label)}
              className={cn(
                "relative flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-300 select-none",
                borderClass,
                opacityClass,
                scaleClass,
                isClickable ? "cursor-pointer" : "cursor-default",
                isClickable && state !== 'active' && "hover:scale-105 hover:bg-white hover:border-slate-400 hover:shadow-md active:scale-95",
                isDisabled && "cursor-not-allowed opacity-40"
              )}
            >
              <GameIcon type={p.key} size="sm" />
              <span className={cn(
                "text-xs font-black uppercase tracking-wider",
                state === 'active' ? 'text-slate-900' : 'text-slate-600'
              )}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Independent Unsold Products Floating Bar */}
      {isProductionOrLater && (
        <div 
          className="absolute top-[96px] left-[785px] -translate-x-1/2 bg-white border-2 border-slate-400 rounded-xl px-3.5 py-1.5 shadow-2xl flex items-center gap-2.5 z-40 whitespace-nowrap opacity-100 pointer-events-auto transition-all duration-300"
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

              const bubbleKey = `money:${team.id}`;
              const bubbleClass = getMotionClass(m, bubbleKey, 'sm');
              const bubbleStyles = getMotionStyles(m, bubbleKey, team.color);

              return (
                <div 
                  key={team.id}
                  style={{ backgroundColor: team.color, color: textColor, ...bubbleStyles }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black shadow-sm ring-1 ring-black/10 transition-all duration-300",
                    bubbleClass
                  )}
                  title={`${team.name}: ${unsold} unsold products remaining (${produced} produced, ${sold} sold)`}
                >
                  <span>{getTeamBubbleText(team)}:</span>
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
