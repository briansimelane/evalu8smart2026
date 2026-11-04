import React, { useMemo } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GameState, SimulationClass } from '@/types/game';
import { calculatePlayOrderForState } from '@/hooks/useGameBoardState';
import { useSession } from '@/contexts/SessionContext';
import { useMotion } from '../motionAdapter';
import { getMotionClass, getMotionStyles } from '@/pages/Viewer/motion/motionClass';
import { cn, removeUndefined, safeIsoString } from '@/lib/utils';
import { getTeamBubbleText } from '@/lib/multiworld/teamLabel';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { Maximize2, Sparkles, Check, Monitor, Sliders, Trophy, Layers } from 'lucide-react';
import { revealPlanningAndAdvanceV2 } from '@/lib/referee/refereeEngine';

interface TopBar3DProps {
  classData: SimulationClass;
  gameState: GameState;
  quality?: 'auto' | 'high' | 'low';
  onQualityChange?: (quality: 'auto' | 'high' | 'low') => void;
  onToggleClassic: () => void;
  toggleFullscreen: () => void;
  onOpenImprovements?: () => void;
  onOpenScoreboard?: () => void;
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

const PHASES = [
  { key: 'planning', label: 'PLANNING', color: '#2563eb' },
  { key: 'production', label: 'PRODUCTION', color: '#0f172a' },
  { key: 'improvement', label: 'IMPROVEMENTS', color: '#eab308' },
  { key: 'research', label: 'RESEARCH', color: '#7c3aed' },
  { key: 'logistics', label: 'LOGISTICS', color: '#06b6d4' },
  { key: 'sales', label: 'SALES', color: '#059669' },
  { key: 'control', label: 'CONTROL', color: '#4f46e5' },
  { key: 'scoring', label: 'SCORING', color: '#f59e0b' },
];

export function TopBar3D({
  classData,
  gameState,
  quality,
  onQualityChange,
  onToggleClassic,
  toggleFullscreen,
  onOpenImprovements,
  onOpenScoreboard,
}: TopBar3DProps) {
  const { currentRole, isReadOnly } = useSession();
  const canChangePhase = currentRole !== 'STUDENT' && !isReadOnly;
  const round = gameState.currentRound;
  const roundData = gameState.rounds?.find(r => r.roundNumber === round);
  const m = useMotion();

  // Play Order
  const playOrder = useMemo(() => {
    return calculatePlayOrderForState(gameState, round);
  }, [gameState, round]);

  const activePhaseKey = (gameState.currentPhase || 'planning').toLowerCase();

  const getPhaseIndex = (phaseKey: string) => {
    if (phaseKey === 'planning') return 0;
    if (phaseKey === 'production') return 1;
    if (phaseKey === 'improvement') return 2;
    if (phaseKey === 'innovation' || phaseKey === 'research') return 3;
    if (phaseKey === 'expansion' || phaseKey === 'logistics') return 4;
    if (phaseKey === 'sales') return 5;
    if (phaseKey === 'control') return 6;
    if (phaseKey === 'scoring') return 7;
    return 0;
  };

  const activeIdx = getPhaseIndex(activePhaseKey);
  const isProductionOrLater = activeIdx >= 1;

  // Active turn team determination across all turn-based phases (v1 and v2)
  const activeTurnTeam = useMemo(() => {
    if (gameState.schemaVersion === 2 && gameState.turn && gameState.turn.round === round) {
      const turnPhase = (gameState.turn.phase || '').toLowerCase();
      const normTurnPhase = turnPhase === 'innovation' ? 'research' : turnPhase === 'expansion' ? 'logistics' : turnPhase;
      const normActivePhase = activePhaseKey === 'innovation' ? 'research' : activePhaseKey === 'expansion' ? 'logistics' : activePhaseKey;
      if (normTurnPhase === normActivePhase && normActivePhase !== 'planning') {
        const activeId = gameState.turn.order[gameState.turn.index];
        if (!activeId) return null;
        return gameState.teams.find(t => t.id === activeId) || null;
      }
    }

    if (!roundData) return null;

    if (activePhaseKey === 'improvement') {
      return playOrder.find(t => {
        const count = roundData.teamData?.[t.id]?.improvementCards || 0;
        const isDone = (gameState.improvementCards || []).some(
          c => (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === round
        );
        return count > 0 && !isDone;
      }) || null;
    } else if (activePhaseKey === 'innovation' || activePhaseKey === 'research') {
      return playOrder.find(t => {
        const icons = roundData.teamData?.[t.id]?.researchIcons || 0;
        const spent = (gameState.researchAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      }) || null;
    } else if (activePhaseKey === 'expansion' || activePhaseKey === 'logistics') {
      return playOrder.find(t => {
        const icons = roundData.teamData?.[t.id]?.logisticsIcons || 0;
        const spent = (gameState.logisticsAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      }) || null;
    } else if (activePhaseKey === 'sales') {
      const activeSales = playOrder.filter(team => {
        const tData = roundData.teamData?.[team.id];
        return (tData?.productsProduced || 0) > 0;
      });
      return activeSales.find(t => !roundData.teamData?.[t.id]?.customersSold) || null;
    }
    return null;
  }, [gameState, round, activePhaseKey, roundData, playOrder]);

  const handlePhaseClick = async (phaseKey: string) => {
    if (!canChangePhase) return;
    if (phaseKey === 'improvement' && round >= 5) return;
    if (!classData?.id || !gameState) return;

    try {
      const canonicalPhase = phaseKey === 'research' ? 'innovation' : phaseKey === 'logistics' ? 'expansion' : phaseKey;

      if (classData.schemaVersion === 2 || gameState.schemaVersion === 2) {
        await revealPlanningAndAdvanceV2(classData.id, gameState.teams, classData.themeId, {
          targetPhase: canonicalPhase,
        });
        return;
      }

      const sanitizedState = {
        ...gameState,
        currentPhase: phaseKey,
        createdAt: safeIsoString(gameState.createdAt),
        updatedAt: safeIsoString(new Date()),
      };
      const safeGameState = removeUndefined(sanitizedState);

      const gameRef = doc(db, 'classes', classData.id, 'state', 'game');
      await setDoc(gameRef, { gameState: safeGameState }, { merge: true });

      const classRef = doc(db, 'classes', classData.id);
      await updateDoc(classRef, {
        'gameState.currentPhase': phaseKey,
        'gameState.updatedAt': new Date().toISOString(),
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to change phase from TopBar3D:', err);
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-[120px] bg-white/95 border-b border-[#cdd6e8] shadow-sm flex items-center justify-between px-6 z-30 backdrop-blur-md select-none font-sans">
      {/* 1. Left: Class Name + Round + Turn Order */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-[12px] font-black text-[#64748b] uppercase tracking-[1.5px]">
            CLASS: {classData?.name?.toUpperCase() || 'SMARTPHONE INC'}
          </span>
          <span className="text-[34px] font-black text-[#0f172a] tracking-tight leading-tight">
            ROUND {round}
          </span>
        </div>

        <div className="h-10 w-[1.5px] bg-[#cbd5e1]" />

        {/* Turn Order */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black text-[#64748b] uppercase tracking-wider mr-0.5">
            TURN ORDER:
          </span>
          {isProductionOrLater ? (
            playOrder.map((team, idx) => {
              const isActive = activeTurnTeam?.id === team.id;
              const textColor = getContrastTextColor(team.color);
              const turnKey = `turn:${team.id}`;
              const turnClass = getMotionClass(m, turnKey, 'sm');
              const turnStyles = getMotionStyles(m, turnKey, team.color);
              const displayName = team.name.replace(/^Team\s+/i, '');

              return (
                <div
                  key={team.id}
                  style={{
                    backgroundColor: team.color,
                    color: textColor,
                    ['--turn-pulse-color' as string]: team.color,
                    ...turnStyles,
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-[6px] text-[11px] font-black shadow-2xs ring-1 ring-black/10 flex items-center gap-1 transition-all duration-300",
                    isActive && "ring-2 ring-purple-600 ring-offset-2 animate-turn-pulse",
                    turnClass
                  )}
                  title={`${team.name}: Play Order #${idx + 1}${isActive ? ' (Current Turn)' : ''}`}
                >
                  <span className="opacity-80 font-mono text-[10px]">{idx + 1}.</span>
                  <span>{displayName}</span>
                </div>
              );
            })
          ) : (
            <span className="text-[11px] text-[#94a3b8] font-bold italic tracking-wide">
              Determined in Production
            </span>
          )}
        </div>
      </div>

      {/* 2. Right: 8-Phase Stepper */}
      <div className="flex items-center gap-2 mt-5">
        {PHASES.map((p, idx) => {
          const isSkipped = p.key === 'improvement' && round >= 5;
          const isClickable = canChangePhase && !isSkipped;

          const isCurrent = idx === activeIdx;
          const isPast = idx < activeIdx;
          const isFuture = idx > activeIdx;

          if (isCurrent) {
            return (
              <button
                key={p.key}
                onClick={() => handlePhaseClick(p.key)}
                disabled={!isClickable}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-[14px] bg-white border-[3px] shadow-md transition-transform scale-105"
                style={{ borderColor: p.color }}
                title={`Active: ${p.label}`}
              >
                <div
                  className="w-8 h-8 rounded-[9px] flex items-center justify-center font-black text-sm text-white"
                  style={{
                    backgroundColor: p.color,
                    color: p.color === '#eab308' ? '#0f172a' : '#ffffff',
                  }}
                >
                  {idx + 1}
                </div>
                <span className="text-[12px] font-black text-[#0f172a] tracking-wider pr-1">
                  {p.label}
                </span>
              </button>
            );
          }

          if (isPast) {
            return (
              <button
                key={p.key}
                onClick={() => handlePhaseClick(p.key)}
                disabled={!isClickable}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-[12px] border-[1.5px] transition-all hover:bg-slate-100"
                style={{
                  backgroundColor: `${p.color}18`,
                  borderColor: `${p.color}55`,
                }}
                title={canChangePhase ? `Revisit ${p.label}` : p.label}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: p.color }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
                </div>
                <span className="text-[11px] font-extrabold text-[#475569] tracking-wider">
                  {p.label}
                </span>
              </button>
            );
          }

          // Future phase
          return (
            <button
              key={p.key}
              onClick={() => handlePhaseClick(p.key)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-[12px] bg-white/70 border border-[#cbd5e1] opacity-75 transition-all",
                isClickable && "hover:opacity-100 hover:border-slate-400",
                isSkipped && "opacity-35 cursor-not-allowed"
              )}
              title={isSkipped ? 'Improvements skipped in Round 5+' : (canChangePhase ? `Switch to ${p.label}` : p.label)}
            >
              <div className="w-6 h-6 rounded-full bg-[#f1f5f9] border border-[#cbd5e1] flex items-center justify-center text-[11px] font-black text-[#94a3b8]">
                {idx + 1}
              </div>
              <span className="text-[11px] font-bold text-[#94a3b8] tracking-wider">
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Floating Unsold Products Pill (visible Production or later) */}
      {isProductionOrLater && (
        <div className="absolute top-[88px] left-1/2 -translate-x-1/2 bg-white/95 border border-[#94a3b8] rounded-[10px] px-3.5 py-1.5 shadow-md flex items-center gap-2.5 z-40 backdrop-blur-sm whitespace-nowrap">
          <span className="text-[11px] font-black text-[#475569] uppercase tracking-wider">
            UNSOLD PRODUCTS:
          </span>
          <div className="flex items-center gap-2">
            {gameState.teams.map((team) => {
              const tData = roundData?.teamData?.[team.id];
              const produced = tData?.productsProduced || 0;
              const sold = tData?.customersSold?.length || 0;
              const unsold = Math.max(0, produced - sold);
              const textColor = getContrastTextColor(team.color);
              const teamShort = team.name.replace(/^Team\s+/i, '');

              return (
                <div
                  key={team.id}
                  style={{ backgroundColor: team.color, color: textColor }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-black shadow-2xs whitespace-nowrap min-w-fit"
                  title={`${team.name}: ${unsold} unsold remaining (${produced} produced, ${sold} sold)`}
                >
                  <span>{teamShort}:</span>
                  <span className="font-mono text-[13px] font-black leading-none">{unsold}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Top-Right Corner Controls: Modals + 2D/3D Viewer Toggle + Fullscreen */}
      <div className="absolute top-1.5 right-6 z-50 flex items-center gap-2">
        {/* Improvements Modal Trigger */}
        {onOpenImprovements && (
          <button
            onClick={onOpenImprovements}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-300 hover:border-amber-400 bg-amber-50/95 hover:bg-amber-100/95 text-xs font-black text-amber-800 shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Open Improvements Modal"
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>Improvements</span>
          </button>
        )}

        {/* Scoreboard Modal Trigger */}
        {onOpenScoreboard && (
          <button
            onClick={onOpenScoreboard}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-300 hover:border-blue-400 bg-blue-50/95 hover:bg-blue-100/95 text-xs font-black text-blue-800 shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Open Scoreboard Standings Modal"
          >
            <Trophy className="w-3.5 h-3.5 text-blue-600" />
            <span>Scoreboard</span>
          </button>
        )}

        {/* Switch to 2D Classic Viewer Button */}
        <button
          onClick={onToggleClassic}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-indigo-300 hover:border-indigo-500 bg-indigo-50/95 hover:bg-indigo-100 text-xs font-black text-indigo-700 hover:text-indigo-900 shadow-xs cursor-pointer active:scale-95 transition-all"
          title="Switch to 2D Classic Board Viewer"
        >
          <Monitor className="w-3.5 h-3.5 text-indigo-600" />
          <span>2D Viewer</span>
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 bg-white/95 text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer active:scale-95 transition-all"
          title="Toggle Fullscreen (F)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
