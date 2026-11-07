import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { SteveIcon } from '@/components/dashboard/SteveIcon';
import { WorldMarker, WorldTag } from './WorldMarker';
import { cn } from '@/lib/utils';

import { useOptionalMotion } from '../motion/MotionContext';
import { getMotionClass } from '../motion/motionClass';
import { isRuleActiveForTeam } from '@/lib/defaultRules';
import { isSteveBlocking as isSteveBlockingRule } from '@/lib/rules';
import { getTeamBubbleText } from '@/lib/multiworld/teamLabel';
import { getGameTheme, regionLabel, techIcon, techLabel } from '@/lib/gameTheme';

interface OverlayRegionCardProps {
  regionName: string;
  gameStateA: GameState;
  gameStateB: GameState;
}

export function OverlayRegionCard({ regionName, gameStateA, gameStateB }: OverlayRegionCardProps) {
  const m = useOptionalMotion();
  const roundA = gameStateA.currentRound;
  const roundB = gameStateB.currentRound;
  const theme = getGameTheme(gameStateA.themeId ?? gameStateB.themeId);
  const displayRegionName = regionLabel(theme, regionName);

  const regA = gameStateA.regionLogistics[regionName];
  const regB = gameStateB.regionLogistics[regionName];

  const logisticsCost = regA?.logisticsCost || regB?.logisticsCost || 2;
  const maxTeamsA = regA?.maxTeams || 3;
  const maxTeamsB = regB?.maxTeams || 3;

  // Steve event blocker state for World A & World B
  const isSteveBlockingA = isSteveBlockingRule(gameStateA, regionName);
  const isSteveBlockingB = isSteveBlockingRule(gameStateB, regionName);
  const steveA = gameStateA.advancedState?.steve;
  const steveB = gameStateB.advancedState?.steve;
  const stevePaidA = isSteveBlockingA
    ? Object.values(steveA?.wildcardsContributed || {}).reduce((a, b) => a + Number(b), 0)
    : 0;
  const stevePaidB = isSteveBlockingB
    ? Object.values(steveB?.wildcardsContributed || {}).reduce((a, b) => a + Number(b), 0)
    : 0;
  const isSteveActiveOnCard = isSteveBlockingA || isSteveBlockingB;

  const customerData = useMemo(() => {
    return REGION_CUSTOMERS.find(c => c.region === regionName)?.customers || [];
  }, [regionName]);

  // Buyer lookup for World A
  const buyersA = useMemo(() => {
    return customerData.map(cust => {
      let buyer: Team | null = null;
      if (gameStateA.rounds) {
        for (const rData of gameStateA.rounds) {
          if (rData.roundNumber === roundA && rData.teamData) {
            for (const team of gameStateA.teams) {
              if (rData.teamData[team.id]?.customersSold?.includes(cust.id)) {
                buyer = team;
                break;
              }
            }
            if (buyer) break;
          }
        }
      }
      return { customer: cust, buyer };
    });
  }, [customerData, gameStateA.rounds, gameStateA.teams, roundA]);

  // Buyer lookup for World B
  const buyersB = useMemo(() => {
    return customerData.map(cust => {
      let buyer: Team | null = null;
      if (gameStateB.rounds) {
        for (const rData of gameStateB.rounds) {
          if (rData.roundNumber === roundB && rData.teamData) {
            for (const team of gameStateB.teams) {
              if (rData.teamData[team.id]?.customersSold?.includes(cust.id)) {
                buyer = team;
                break;
              }
            }
            if (buyer) break;
          }
        }
      }
      return { customer: cust, buyer };
    });
  }, [customerData, gameStateB.rounds, gameStateB.teams, roundB]);

  // Control leaders per world
  const computeControlLeaders = (gState: GameState, round: number) => {
    if (isSteveBlockingRule(gState, regionName)) return null;

    const teamSalesMap: Record<string, number> = {};
    if (gState.rounds) {
      for (const rData of gState.rounds) {
        if (rData.roundNumber === round && rData.teamData) {
          for (const teamId of Object.keys(rData.teamData)) {
            const regLogistics = gState.regionLogistics?.[regionName];
            const teamsPres = regLogistics?.teamsPresent || [];
            const hasOfficeInRegion = (teamsPres.includes(teamId)) || ((regLogistics?.officeCounts?.[teamId] || 0) > 0);
            if (!hasOfficeInRegion) continue;

            const sold = rData.teamData[teamId]?.customersSold || [];
            const matchingCount = customerData.filter(c => sold.includes(c.id)).length;
            if (matchingCount > 0) {
              teamSalesMap[teamId] = (teamSalesMap[teamId] || 0) + matchingCount;
            }
          }
        }
      }
    }

    const sortedTeams = Object.entries(teamSalesMap)
      .map(([teamId, salesCount]) => ({
        team: gState.teams.find(t => t.id === teamId)!,
        salesCount
      }))
      .filter(item => item.team && item.salesCount > 0)
      .sort((a, b) => b.salesCount - a.salesCount);

    if (sortedTeams.length === 0) return null;

    const isMultiActive = isRuleActiveForTeam(gState.ruleAdjustments, 'multiple_offices_per_region');
    const regConfigData = gState.regionLogistics[regionName];
    const totalOffices = Object.values(regConfigData?.officeCounts || {}).reduce((a, b) => a + Number(b), 0);
    const occupiedSlots = isMultiActive
      ? Math.max(1, totalOffices || (regConfigData?.teamsPresent || []).length)
      : Math.max(1, (regConfigData?.teamsPresent || []).length);
    const presentCount = Math.min(5, Math.max(1, occupiedSlots));
    const firstPlace = sortedTeams[0];
    const firstPts = getControlPointsForRegion(regionName, presentCount, 'first');

    let secondPlace: { team: Team; salesCount: number } | null = null;
    let secondPts = 0;

    if (sortedTeams.length > 1) {
      secondPlace = sortedTeams[1];
      secondPts = getControlPointsForRegion(regionName, presentCount, 'second');
    }

    return {
      first: (firstPlace && firstPts > 0) ? { team: firstPlace.team, points: firstPts } : null,
      second: (secondPlace && secondPts > 0) ? { team: secondPlace.team, points: secondPts } : null,
    };
  };

  const controlLeadersA = useMemo(() => computeControlLeaders(gameStateA, roundA), [gameStateA, roundA, regionName, customerData]);
  const controlLeadersB = useMemo(() => computeControlLeaders(gameStateB, roundB), [gameStateB, roundB, regionName, customerData]);

  // Office track helper for a single world
  const renderOfficeTrack = (world: 'A' | 'B', gState: GameState, regConfig: any, maxTeams: number) => {
    const isMultiOfficeActive = isRuleActiveForTeam(gState.ruleAdjustments, 'multiple_offices_per_region');
    const presentIds = regConfig?.teamsPresent || [];
    const presentOfficeList: Array<{ team: Team; officeIndex: number }> = [];
    presentIds.forEach((id: string) => {
      const team = gState.teams.find(t => t.id === id);
      if (!team) return;
      const count = isMultiOfficeActive ? Math.max(1, regConfig?.officeCounts?.[id] || 1) : 1;
      for (let i = 0; i < count; i++) {
        presentOfficeList.push({ team, officeIndex: i });
      }
    });

    const inProgressTeams = gState.teams
      .filter(team => {
        if (presentIds.includes(team.id)) return false;
        const invested = regConfig?.teamProgress?.[team.id] || 0;
        return invested > 0 && invested < logisticsCost;
      })
      .map(team => ({ team, invested: regConfig?.teamProgress?.[team.id] || 0 }));

    const occupiedCount = presentOfficeList.length + inProgressTeams.length;
    const emptyCount = Math.max(0, maxTeams - occupiedCount);

    const isWorldBlocked = world === 'A' ? isSteveBlockingA : isSteveBlockingB;

    return (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <WorldTag world={world} label={world} className="text-[8px] px-1 py-0 h-4" />
          {isWorldBlocked && (
            <span className="shrink-0 flex items-center text-red-600 animate-pulse" title={`Steve is blocking World ${world} expansion into ${displayRegionName}!`}>
              <SteveIcon size={12} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Present teams & offices */}
          {presentOfficeList.map(({ team, officeIndex }) => (
            <WorldMarker
              key={`present-${world}-${team.id}-${officeIndex}`}
              world={world}
              teamColor={team.color}
              size="xs"
              title={`World ${world} · Office #${officeIndex + 1} established by ${team.name}`}
            >
              {getTeamBubbleText(team)}
            </WorldMarker>
          ))}

          {/* In-progress teams */}
          {inProgressTeams.map(({ team, invested }) => {
            const fraction = Math.min(1, Math.max(0, invested / logisticsCost));
            const degrees = fraction * 360;
            return (
              <WorldMarker
                key={`progress-${world}-${team.id}`}
                world={world}
                teamColor={team.color}
                size="xs"
                title={`World ${world} · ${team.name}: ${invested}/${logisticsCost} Logistics`}
              >
                <div
                  className="w-full h-full rounded-full overflow-hidden relative"
                  style={{
                    background: `conic-gradient(${team.color} 0deg ${degrees}deg, #e2e8f0 ${degrees}deg 360deg)`
                  }}
                >
                  {logisticsCost > 1 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 24 24">
                      {Array.from({ length: logisticsCost }).map((_, i) => {
                        const angle = (i * 360) / logisticsCost;
                        const rad = (angle - 90) * (Math.PI / 180);
                        const x2 = 12 + 12 * Math.cos(rad);
                        const y2 = 12 + 12 * Math.sin(rad);
                        return (
                          <line key={i} x1="12" y1="12" x2={x2} y2={y2} stroke="#0f172a" strokeWidth="2" strokeOpacity="0.95" />
                        );
                      })}
                    </svg>
                  )}
                </div>
              </WorldMarker>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: emptyCount }).map((_, idx) => (
            <div
              key={`empty-${world}-${idx}`}
              className="w-4 h-4 rounded-full border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[8px] text-slate-400 font-black shrink-0"
            >
              +
            </div>
          ))}
        </div>
      </div>
    );
  };

  const slotCount = customerData.length;
  const cardWidth = Math.max(280, slotCount * 54 + 42);

  const controlKey = `control:${regionName}`;
  const cardChanged = Boolean(
    m && (
      m.tierFor(controlKey) > 0 ||
      customerData.some(c => m.tierFor(`customer:${regionName}:${c.id}`) > 0) ||
      (regA?.teamsPresent || []).some(id => m.tierFor(`office:${regionName}:${id}`) > 0) ||
      (regB?.teamsPresent || []).some(id => m.tierFor(`office:${regionName}:${id}`) > 0)
    )
  );

  return (
    <div
      style={{ width: `${cardWidth}px` }}
      className={cn(
        "absolute h-[180px] bg-white rounded-xl p-2.5 flex flex-col justify-between backdrop-blur-sm group hover:border-slate-500 hover:shadow-xl transition-all duration-300 text-slate-900 z-10 select-none mo-dimmable",
        isSteveActiveOnCard
          ? "border-2 border-red-600 shadow-2xl z-30 font-bold"
          : cardChanged 
            ? "border-2 border-amber-500 ring-4 ring-amber-400/90 ring-offset-2 shadow-2xl scale-105 z-30 font-bold" 
            : "border border-slate-300 shadow-md",
        m && getMotionClass(m, controlKey, 'lg')
      )}
      data-changed={cardChanged ? '1' : undefined}
    >
      {/* Corner Control Badges: Top-Left (World A), Top-Right (World B) */}
      {controlLeadersA && (controlLeadersA.first || controlLeadersA.second) && (
        <div className="absolute -top-2.5 -left-2.5 flex items-center gap-0.5 z-30">
          {controlLeadersA.first && (
            <WorldMarker
              world="A"
              teamColor={controlLeadersA.first.team.color}
              size="xs"
              title={`World A 1st Place Control: ${controlLeadersA.first.team.name} (+${controlLeadersA.first.points} pts)`}
            >
              <span className="text-[10px] font-black">{controlLeadersA.first.points}</span>
            </WorldMarker>
          )}
          {controlLeadersA.second && (
            <WorldMarker
              world="A"
              teamColor={controlLeadersA.second.team.color}
              size="xs"
              className="scale-75 opacity-90"
              title={`World A 2nd Place Control: ${controlLeadersA.second.team.name} (+${controlLeadersA.second.points} pts)`}
            >
              <span className="text-[9px] font-black">{controlLeadersA.second.points}</span>
            </WorldMarker>
          )}
        </div>
      )}

      {controlLeadersB && (controlLeadersB.first || controlLeadersB.second) && (
        <div className="absolute -top-2.5 -right-2.5 flex items-center gap-0.5 z-30">
          {controlLeadersB.first && (
            <WorldMarker
              world="B"
              teamColor={controlLeadersB.first.team.color}
              size="xs"
              title={`World B 1st Place Control: ${controlLeadersB.first.team.name} (+${controlLeadersB.first.points} pts)`}
            >
              <span className="text-[10px] font-black">{controlLeadersB.first.points}</span>
            </WorldMarker>
          )}
          {controlLeadersB.second && (
            <WorldMarker
              world="B"
              teamColor={controlLeadersB.second.team.color}
              size="xs"
              className="scale-75 opacity-90"
              title={`World B 2nd Place Control: ${controlLeadersB.second.team.name} (+${controlLeadersB.second.points} pts)`}
            >
              <span className="text-[9px] font-black">{controlLeadersB.second.points}</span>
            </WorldMarker>
          )}
        </div>
      )}

      {/* Header Row: Title + Dual Office Tracks */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-400 px-1.5 py-0.5 rounded shadow-xs">
            <GameIcon type="logistics" size="sm" />
            <span className="text-slate-900 text-xs font-black">{logisticsCost}</span>
          </div>
          <span className="font-display font-black text-sm tracking-tight text-slate-900">
            {displayRegionName.toUpperCase()}
          </span>
        </div>

        {/* Dual Stacked Office Tracks */}
        <div className="flex flex-col gap-0.5">
          {renderOfficeTrack('A', gameStateA, regA, maxTeamsA)}
          {renderOfficeTrack('B', gameStateB, regB, maxTeamsB)}
        </div>
      </div>

      {/* Horizontal Steve Blocker Banner for Combined Overlay Board */}
      {isSteveActiveOnCard && (
        <div className="absolute inset-x-2 top-[46px] h-7 bg-red-600/95 text-white rounded-lg shadow-lg px-2 flex items-center justify-between z-30 border border-white backdrop-blur-xs [animation:pulse_1s_cubic-bezier(0.4,0,0.6,1)_3]">
          <div className="flex items-center gap-1.5 truncate">
            <SteveIcon size={16} />
            {isSteveBlockingA && isSteveBlockingB ? (
              <>
                <div className="flex items-center gap-0.5">
                  <WorldTag world="A" label="A" className="text-[8px] px-1 py-0 h-3.5 bg-purple-700 text-white border-white/60" />
                  <WorldTag world="B" label="B" className="text-[8px] px-1 py-0 h-3.5 bg-slate-700 text-white border-white/60" />
                </div>
                <span className="font-extrabold text-[11px] uppercase tracking-wider truncate">
                  STEVE BLOCKED (WORLDS A & B)
                </span>
              </>
            ) : isSteveBlockingA ? (
              <>
                <WorldTag world="A" label="A" className="text-[8px] px-1 py-0 h-3.5 bg-purple-700 text-white border-white/60" />
                <span className="font-extrabold text-[11px] uppercase tracking-wider truncate">
                  STEVE BLOCKED (WORLD A)
                </span>
              </>
            ) : (
              <>
                <WorldTag world="B" label="B" className="text-[8px] px-1 py-0 h-3.5 bg-slate-700 text-white border-white/60" />
                <span className="font-extrabold text-[11px] uppercase tracking-wider truncate">
                  STEVE BLOCKED (WORLD B)
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-red-100 font-mono font-bold bg-red-800/90 px-1.5 py-0.5 rounded whitespace-nowrap">
            {isSteveBlockingA && isSteveBlockingB ? (
              <>
                <span>A: {stevePaidA}/5</span>
                <span>•</span>
                <span>B: {stevePaidB}/5</span>
              </>
            ) : isSteveBlockingA ? (
              <span>{stevePaidA}/5 Paid</span>
            ) : (
              <span>{stevePaidB}/5 Paid</span>
            )}
          </div>
        </div>
      )}

      {/* Customer Demand Slots Row with Top (A) and Bottom (B) Buyer Chips */}
      <div className="flex items-center gap-1.5 py-1.5 justify-start flex-nowrap overflow-visible">
        {customerData.map((customer, idx) => {
          const isPrice = customer.type === 'price';
          const TechIcon = customer.technology ? techIcon(theme, customer.technology) : null;
          const custTechLabel = customer.technology ? techLabel(theme, customer.technology) : '';

          const buyerA = buyersA[idx]?.buyer;
          const buyerB = buyersB[idx]?.buyer;

          const tooltip = `Customer #${customer.position}: ${isPrice ? `$${customer.price}` : custTechLabel}\n` +
            `A: ${buyerA ? buyerA.name : 'Unsold'}  |  B: ${buyerB ? buyerB.name : 'Unsold'}`;

          return (
            <div
              key={customer.id}
              className={cn(
                'relative w-11 h-11 rounded-xl flex items-center justify-center p-0.5 font-mono shadow-sm transition-all duration-200 border',
                isPrice ? 'bg-red-600 border-red-700' : 'bg-purple-600 border-purple-700'
              )}
              title={tooltip}
            >
              {/* Requirement text/icon */}
              {isPrice ? (
                <span className="font-black text-xs text-white">${customer.price}</span>
              ) : TechIcon ? (
                <TechIcon className="w-5 h-5 text-white stroke-[2.5]" />
              ) : (
                <GameIcon type="research" size="sm" />
              )}

              {/* World A Buyer Chip (Top-Center) */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
                {buyerA ? (
                  <WorldMarker
                    world="A"
                    teamColor={buyerA.color}
                    size="xs"
                    title={`A · Sold to ${buyerA.name}`}
                  >
                    {getTeamBubbleText(buyerA)}
                  </WorldMarker>
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-dashed border-purple-300 bg-purple-50/80 shadow-xs" title="A · Unsold" />
                )}
              </div>

              {/* World B Buyer Chip (Bottom-Center) */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20">
                {buyerB ? (
                  <WorldMarker
                    world="B"
                    teamColor={buyerB.color}
                    size="xs"
                    title={`B · Sold to ${buyerB.name}`}
                  >
                    {getTeamBubbleText(buyerB)}
                  </WorldMarker>
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-dashed border-slate-400 bg-slate-100 shadow-xs" title="B · Unsold" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
