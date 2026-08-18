import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { getTechnologyCostForTeamForState } from '@/hooks/useGameBoardState';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { MapPin, Wifi, Gamepad2, Battery, Radio, Signal, Award, Check } from 'lucide-react';
import { WorldMarker, WorldTag } from './WorldMarker';

const TECHNOLOGY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'GPS': MapPin,
  'Wifi': Wifi,
  'Gaming': Gamepad2,
  'Battery': Battery,
  'NFC': Radio,
  '4G': Signal,
};

const DESIRED_TECH_ORDER = ['GPS', 'WIFI', 'GAMING', 'BATTERY', 'NFC', '4G'];

interface OverlayTechPanelProps {
  gameStateA: GameState;
  gameStateB: GameState;
}

export const OverlayTechPanel: React.FC<OverlayTechPanelProps> = ({ gameStateA, gameStateB }) => {
  const sortedTechs = useMemo(() => {
    return Object.values(gameStateA.technologies).sort((a, b) => {
      const rankA = DESIRED_TECH_ORDER.indexOf(a.name.toUpperCase());
      const rankB = DESIRED_TECH_ORDER.indexOf(b.name.toUpperCase());
      return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
    });
  }, [gameStateA.technologies]);

  const renderTechProgressCircle = (world: 'A' | 'B', team: Team, techName: string, gState: GameState) => {
    const progress = gState.teamResearchProgress[team.id];
    const isCompleted = progress?.completedTechnologies?.includes(techName);
    const invested = progress?.technologyInvestments?.[techName] || 0;
    const cost = getTechnologyCostForTeamForState(gState, team.id, techName);

    const fraction = isCompleted ? 1 : Math.min(1, Math.max(0, invested / Math.max(1, cost)));
    const degrees = fraction * 360;

    return (
      <WorldMarker
        key={`${world}-${team.id}-${techName}`}
        world={world}
        teamColor={team.color}
        size="xs"
        title={`${world} · ${team.name}: ${isCompleted ? 'Completed' : `${invested}/${cost} Research`}`}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden"
          style={{
            background: isCompleted
              ? team.color
              : `conic-gradient(${team.color} 0deg ${degrees}deg, #e2e8f0 ${degrees}deg 360deg)`
          }}
        >
          {isCompleted && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
        </div>
      </WorldMarker>
    );
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[150px] bg-white/95 border-t border-slate-300 px-4 flex items-center justify-between z-10 backdrop-blur-md shadow-xl text-slate-900 select-none">
      {/* Title */}
      <div className="flex flex-col shrink-0 pr-3 border-r border-slate-200">
        <div className="flex items-center gap-1.5">
          <GameIcon type="research" size="sm" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Research & Development</span>
        </div>
        <span className="text-xl font-black text-slate-900 uppercase tracking-tight mt-0.5">Technologies</span>
        <span className="text-[10px] text-purple-700 font-bold italic mt-0.5">World A & B Progress</span>
      </div>

      {/* Tech Cards Row */}
      <div className="flex items-center gap-3 flex-1 justify-start overflow-x-auto pl-3 py-1">
        {sortedTechs.map(tech => {
          const patentA = gameStateA.patents[tech.name] ? gameStateA.teams.find(t => t.id === gameStateA.patents[tech.name]) : null;
          const patentB = gameStateB.patents[tech.name] ? gameStateB.teams.find(t => t.id === gameStateB.patents[tech.name]) : null;
          const Icon = TECHNOLOGY_ICONS[tech.name] || MapPin;

          return (
            <div
              key={tech.name}
              className="w-[260px] h-[130px] rounded-xl border border-slate-300 bg-white p-2.5 flex flex-col justify-between shadow-sm shrink-0"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 text-purple-700 stroke-[2.5]" />
                  <span className="font-display font-black text-xs text-slate-900 tracking-tight">
                    {tech.name.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Progress Rows */}
              <div className="flex flex-col gap-1">
                {/* World A Progress Row */}
                <div className="flex items-center justify-between bg-purple-50/80 p-1 rounded border border-purple-100">
                  <div className="flex items-center gap-1 min-w-0">
                    <WorldTag world="A" label="A" className="text-[8px] px-1 py-0 h-4" />
                    {patentA ? (
                      <div className="flex items-center gap-1 bg-amber-100 text-amber-900 px-1 py-0.5 rounded text-[9px] font-black truncate border border-amber-300">
                        <Award className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="truncate">{patentA.name}</span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-purple-600 font-medium">Patent Free</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {gameStateA.teams.map(team => renderTechProgressCircle('A', team, tech.name, gameStateA))}
                  </div>
                </div>

                {/* World B Progress Row */}
                <div className="flex items-center justify-between bg-slate-100/90 p-1 rounded border border-slate-200">
                  <div className="flex items-center gap-1 min-w-0">
                    <WorldTag world="B" label="B" className="text-[8px] px-1 py-0 h-4" />
                    {patentB ? (
                      <div className="flex items-center gap-1 bg-amber-100 text-amber-900 px-1 py-0.5 rounded text-[9px] font-black truncate border border-amber-300">
                        <Award className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="truncate">{patentB.name}</span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-medium">Patent Free</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {gameStateB.teams.map(team => renderTechProgressCircle('B', team, tech.name, gameStateB))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
