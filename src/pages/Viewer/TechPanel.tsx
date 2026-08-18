import React, { useMemo } from 'react';
import { GameState, Team, getPatentPointsForTech } from '@/types/game';
import { Award, Check, MapPin, Wifi, Gamepad2, Battery, Radio, Signal } from 'lucide-react';
import { getTechnologyCostForTeamForState } from '@/hooks/useGameBoardState';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { useMotion } from './motion/MotionContext';
import { getMotionClass, getMotionStyles } from './motion/motionClass';
import { cn } from '@/lib/utils';

const getTechIconComponent = (techName: string) => {
  const norm = (techName || '').toUpperCase();
  if (norm.includes('GPS')) return MapPin;
  if (norm.includes('WIFI')) return Wifi;
  if (norm.includes('GAMING')) return Gamepad2;
  if (norm.includes('BATTERY')) return Battery;
  if (norm.includes('NFC')) return Radio;
  if (norm.includes('4G')) return Signal;
  return Wifi;
};

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

interface TechPanelProps {
  gameState: GameState;
}

export function TechPanel({ gameState }: TechPanelProps) {
  const DESIRED_TECH_ORDER = ['GPS', 'WIFI', 'GAMING', 'BATTERY', 'NFC', '4G'];
  const m = useMotion();

  const sortedTechs = useMemo(() => {
    return Object.values(gameState.technologies).sort((a, b) => {
      const rankA = DESIRED_TECH_ORDER.indexOf(a.name.toUpperCase());
      const rankB = DESIRED_TECH_ORDER.indexOf(b.name.toUpperCase());
      return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
    });
  }, [gameState.technologies]);

  // Helper to render segmented pie circle for technology research progress (matching logistics style)
  const renderTechProgressCircle = (team: Team, invested: number, cost: number, isCompleted: boolean, techName: string) => {
    const researchKey = `research:${techName}:${team.id}`;
    const researchClass = getMotionClass(m, researchKey, 'sm');
    const researchStyles = getMotionStyles(m, researchKey, team.color);

    if (isCompleted) {
      return (
        <div 
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-md shrink-0 ring-2 ring-white transition-all",
            researchClass
          )}
          style={{ 
            backgroundColor: team.color,
            ...researchStyles
          }}
          title={`${team.name}: ${techName} Completed!`}
        >
          ✓
        </div>
      );
    }

    const fraction = Math.min(1, Math.max(0, invested / cost));
    const degrees = fraction * 360;

    return (
      <div 
        className={cn(
          "w-7 h-7 rounded-full border-2 relative shrink-0 shadow-2xs flex items-center justify-center overflow-hidden transition-all duration-300 logistics-pie",
          researchClass
        )}
        style={{
          borderColor: team.color,
          ['--pie' as string]: `${degrees}deg`,
          background: `conic-gradient(${team.color} 0deg var(--pie), #e2e8f0 var(--pie) 360deg)`,
          ...researchStyles
        }}
        title={`${team.name}: ${invested}/${cost} Research Icons Invested`}
      >
        {/* Sector divider lines for research cost sectors */}
        {cost > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-45" viewBox="0 0 24 24">
            {Array.from({ length: cost }).map((_, i) => {
              const angle = (i * 360) / cost;
              const rad = (angle - 90) * (Math.PI / 180);
              const x2 = 12 + 12 * Math.cos(rad);
              const y2 = 12 + 12 * Math.sin(rad);
              return (
                <line key={i} x1="12" y1="12" x2={x2} y2={y2} stroke="#000000" strokeWidth="1.2" />
              );
            })}
          </svg>
        )}
      </div>
    );
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[150px] bg-white/95 border-t border-slate-300 flex items-center justify-between px-6 z-10 backdrop-blur-md shadow-xl text-slate-900">
      {/* Title / Section Header with bigger text */}
      <div className="flex flex-col shrink-0 pr-4">
        <div className="flex items-center gap-2">
          <GameIcon type="research" size="md" />
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Research & Development</span>
        </div>
        <span className="text-2xl font-black text-slate-900 uppercase tracking-tight mt-0.5">Technologies</span>
        <span className="text-xs text-slate-500 font-bold italic mt-0.5">Patents & Team Progress</span>
      </div>

      {/* Horizontal Technologies Cards List */}
      <div className="flex items-center gap-4 flex-1 justify-start overflow-x-auto pl-4 py-2">
        {sortedTechs.map(tech => {
          const patentHolderId = gameState.patents[tech.name];
          const patentHolder = patentHolderId ? gameState.teams.find(t => t.id === patentHolderId) : null;
          const TechIcon = getTechIconComponent(tech.name);

          const patentKey = `patent:${tech.name}`;
          const isNewPatent = m.tierFor(patentKey) === 1;

          const techKey = `tech:${tech.name}`;
          const techChanged = m.tierFor(techKey) > 0 || 
            gameState.teams.some(team => m.tierFor(`research:${tech.name}:${team.id}`) > 0);

          return (
            <div 
              key={tech.name} 
              className={cn(
                "w-[250px] h-[122px] rounded-xl border-2 border-slate-400 bg-white p-3 flex flex-col justify-between shadow-md hover:border-slate-600 transition-all duration-300 shrink-0 overflow-hidden mo-dimmable",
                techChanged && "z-20"
              )}
              data-changed={techChanged ? '1' : undefined}
            >
              {/* Header: Tech Name + Specific Tech Icon + Patent Badge */}
              <div className="flex items-center justify-between border-b border-slate-150 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <TechIcon className="w-4 h-4 text-purple-700 stroke-[2.5]" />
                  <span className="font-display font-black text-sm text-slate-900 tracking-tight">{tech.name.toUpperCase()}</span>
                  <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shadow-2xs">
                    🏆 {getPatentPointsForTech(tech.name)} pts
                  </span>
                </div>

                {patentHolder ? (
                  <div 
                    style={{ 
                      backgroundColor: patentHolder.color, 
                      color: getContrastTextColor(patentHolder.color),
                      ...getMotionStyles(m, patentKey, patentHolder.color)
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider uppercase shadow-md transition-all ring-2 ring-amber-400",
                      getMotionClass(m, patentKey, 'sm'),
                      isNewPatent && 'mo-arrive'
                    )}
                    title={`Patent Holder: ${patentHolder.name}`}
                  >
                    <Award className={cn("h-3.5 w-3.5 shrink-0", m.isRecent(patentKey) && 'mo-recent')} />
                    <span>{patentHolder.name}</span>
                  </div>
                ) : (
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase">Available</span>
                )}
              </div>

              {/* Team progress circles */}
              <div className="flex items-center gap-1.5 flex-wrap justify-start py-1.5 px-0.5 overflow-hidden flex-1">
                {gameState.teams.map(team => {
                  const progress = gameState.teamResearchProgress[team.id];
                  const pointsInvested = progress?.technologyInvestments[tech.name] || 0;
                  const targetCost = getTechnologyCostForTeamForState(gameState, team.id, tech.name);
                  const isCompleted = Boolean(progress?.completedTechnologies?.includes(tech.name) || (pointsInvested >= targetCost && targetCost > 0));

                  return (
                    <React.Fragment key={team.id}>
                      {renderTechProgressCircle(team, pointsInvested, targetCost, isCompleted, tech.name)}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
