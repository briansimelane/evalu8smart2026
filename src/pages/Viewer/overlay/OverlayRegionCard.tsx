import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { MapPin, Wifi, Gamepad2, Battery, Radio, Signal } from 'lucide-react';
import { WorldMarker, WorldTag, getContrastTextColor } from './WorldMarker';
import { cn } from '@/lib/utils';

const TECHNOLOGY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'GPS': MapPin,
  'Wifi': Wifi,
  'Gaming': Gamepad2,
  'Battery': Battery,
  'NFC': Radio,
  '4G': Signal,
};

interface OverlayRegionCardProps {
  regionName: string;
  gameStateA: GameState;
  gameStateB: GameState;
}

export function OverlayRegionCard({ regionName, gameStateA, gameStateB }: OverlayRegionCardProps) {
  const roundA = gameStateA.currentRound;
  const roundB = gameStateB.currentRound;

  const regA = gameStateA.regionLogistics[regionName];
  const regB = gameStateB.regionLogistics[regionName];

  const logisticsCost = regA?.logisticsCost || regB?.logisticsCost || 2;
  const maxTeamsA = regA?.maxTeams || 3;
  const maxTeamsB = regB?.maxTeams || 3;

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
    const teamSalesMap: Record<string, number> = {};
    if (gState.rounds) {
      for (const rData of gState.rounds) {
        if (rData.roundNumber === round && rData.teamData) {
          for (const teamId of Object.keys(rData.teamData)) {
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

    const presentCount = Math.max(1, (gState.regionLogistics[regionName]?.teamsPresent || []).length);
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
    const presentIds = regConfig?.teamsPresent || [];
    const presentTeams = presentIds.map((id: string) => gState.teams.find(t => t.id === id)).filter(Boolean) as Team[];

    const inProgressTeams = gState.teams
      .filter(team => {
        if (presentIds.includes(team.id)) return false;
        const invested = regConfig?.teamProgress?.[team.id] || 0;
        return invested > 0 && invested < logisticsCost;
      })
      .map(team => ({ team, invested: regConfig?.teamProgress?.[team.id] || 0 }));

    const occupiedCount = presentTeams.length + inProgressTeams.length;
    const emptyCount = Math.max(0, maxTeams - occupiedCount);

    return (
      <div className="flex items-center gap-1">
        <WorldTag world={world} label={world} className="text-[8px] px-1 py-0 h-4" />
        <div className="flex items-center gap-1">
          {/* Present teams */}
          {presentTeams.map(team => (
            <WorldMarker
              key={`present-${world}-${team.id}`}
              world={world}
              teamColor={team.color}
              size="xs"
              title={`World ${world} · Office established by ${team.name}`}
            >
              {team.name.charAt(0).toUpperCase()}
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
                />
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

  return (
    <div
      style={{ width: `${cardWidth}px` }}
      className="absolute h-[180px] bg-white rounded-xl p-2.5 flex flex-col justify-between border border-slate-300 shadow-md backdrop-blur-sm hover:border-slate-500 hover:shadow-xl transition-all duration-300 text-slate-900 z-10 select-none"
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
            {regionName.toUpperCase()}
          </span>
        </div>

        {/* Dual Stacked Office Tracks */}
        <div className="flex flex-col gap-0.5">
          {renderOfficeTrack('A', gameStateA, regA, maxTeamsA)}
          {renderOfficeTrack('B', gameStateB, regB, maxTeamsB)}
        </div>
      </div>

      {/* Customer Demand Slots Row with Top (A) and Bottom (B) Buyer Chips */}
      <div className="flex items-center gap-1.5 py-1.5 justify-start flex-nowrap overflow-visible">
        {customerData.map((customer, idx) => {
          const isPrice = customer.type === 'price';
          const TechIcon = customer.technology ? TECHNOLOGY_ICONS[customer.technology] : null;

          const buyerA = buyersA[idx]?.buyer;
          const buyerB = buyersB[idx]?.buyer;

          const tooltip = `Customer #${customer.position}: ${isPrice ? `$${customer.price}` : customer.technology}\n` +
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
                  />
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
                  />
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
