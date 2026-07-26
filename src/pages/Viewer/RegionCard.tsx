import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { MapPin, Wifi, Gamepad2, Battery, Radio, Signal } from 'lucide-react';

const TECHNOLOGY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'GPS': MapPin,
  'Wifi': Wifi,
  'Gaming': Gamepad2,
  'Battery': Battery,
  'NFC': Radio,
  '4G': Signal,
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

interface RegionCardProps {
  regionName: string;
  gameState: GameState;
}

export function RegionCard({ regionName, gameState }: RegionCardProps) {
  const round = gameState.currentRound;
  const roundData = gameState.rounds.find(r => r.roundNumber === round);
  const regionConfig = gameState.regionLogistics[regionName];
  
  const customerData = useMemo(() => {
    return REGION_CUSTOMERS.find(c => c.region === regionName)?.customers || [];
  }, [regionName]);

  // Determine who bought each customer slot (checking current round sales only)
  const customerStatus = useMemo(() => {
    return customerData.map(cust => {
      let buyerTeam: Team | null = null;
      if (gameState.rounds) {
        for (const rData of gameState.rounds) {
          if (rData.roundNumber === round && rData.teamData) {
            for (const team of gameState.teams) {
              const tData = rData.teamData[team.id];
              if (tData?.customersSold?.includes(cust.id)) {
                buyerTeam = team;
                break;
              }
            }
            if (buyerTeam) break;
          }
        }
      }
      return { customer: cust, buyerTeam };
    });
  }, [customerData, gameState.rounds, gameState.teams, round]);

  const logisticsCost = regionConfig?.logisticsCost || 2;
  const maxTeams = regionConfig?.maxTeams || 3;
  const teamsPresent = regionConfig?.teamsPresent || [];

  // Calculate region control leaders for the current round
  const controlLeaders = useMemo(() => {
    const teamSalesMap: Record<string, number> = {};
    if (gameState.rounds) {
      for (const rData of gameState.rounds) {
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

    const sortedTeamsWithSales = Object.entries(teamSalesMap)
      .map(([teamId, salesCount]) => ({
        team: gameState.teams.find(t => t.id === teamId)!,
        salesCount
      }))
      .filter(item => item.team && item.salesCount > 0)
      .sort((a, b) => b.salesCount - a.salesCount);

    if (sortedTeamsWithSales.length === 0) return null;

    const teamsPresentCount = Math.max(1, teamsPresent.length);
    const firstPlace = sortedTeamsWithSales[0];
    const firstPoints = getControlPointsForRegion(regionName, teamsPresentCount, 'first');

    let secondPlace: { team: Team; salesCount: number } | null = null;
    let secondPoints = 0;

    if (sortedTeamsWithSales.length > 1) {
      secondPlace = sortedTeamsWithSales[1];
      secondPoints = getControlPointsForRegion(regionName, teamsPresentCount, 'second');
    }

    return {
      first: (firstPlace && firstPoints > 0) ? { team: firstPlace.team, points: firstPoints } : null,
      second: (secondPlace && secondPoints > 0) ? { team: secondPlace.team, points: secondPoints } : null,
    };
  }, [gameState.rounds, gameState.teams, round, customerData, regionName, teamsPresent]);

  // Present teams (established office with letter inside)
  const presentTeamObjs = useMemo(() => {
    return teamsPresent
      .map(id => gameState.teams.find(t => t.id === id))
      .filter(Boolean) as Team[];
  }, [teamsPresent, gameState.teams]);

  // In-progress teams (invested logistics points > 0, not yet present)
  const inProgressTeamObjs = useMemo(() => {
    return gameState.teams
      .filter(team => {
        if (teamsPresent.includes(team.id)) return false;
        const invested = regionConfig?.teamProgress?.[team.id] || 0;
        return invested > 0 && invested < logisticsCost;
      })
      .map(team => {
        const invested = regionConfig?.teamProgress?.[team.id] || 0;
        return { team, invested };
      });
  }, [gameState.teams, teamsPresent, regionConfig?.teamProgress, logisticsCost]);

  // Remaining empty office slots
  const occupiedSlotCount = presentTeamObjs.length + inProgressTeamObjs.length;
  const emptySlotCount = Math.max(0, maxTeams - occupiedSlotCount);

  // Helper to render segmented pie circle for in-progress logistics (matching Research style)
  const renderInProgressCircle = (team: Team, invested: number, cost: number) => {
    const fraction = Math.min(1, Math.max(0, invested / cost));
    const degrees = fraction * 360;
    const hasInvested = invested > 0;

    return (
      <div 
        key={`progress-${team.id}`}
        className={`w-7 h-7 rounded-full border-2 relative shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ${
          hasInvested 
            ? 'animate-bubble-pop ring-2 ring-purple-500/90 shadow-md' 
            : 'shadow-xs'
        }`}
        style={{
          borderColor: team.color,
          background: `conic-gradient(${team.color} 0deg ${degrees}deg, #e2e8f0 ${degrees}deg 360deg)`,
        }}
        title={`${team.name}: ${invested}/${cost} Logistics Icons Invested`}
      >
        {/* Radial divider lines for logistics cost sectors */}
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

  const slotCount = customerStatus.length;
  // Card width scales dynamically so all customers fit on a single horizontal row
  const cardWidth = Math.max(280, slotCount * 52 + 42);

  return (
    <div 
      style={{ width: `${cardWidth}px` }}
      className="absolute h-[165px] bg-white border border-slate-300 rounded-xl p-3 shadow-md flex flex-col justify-between backdrop-blur-sm group hover:border-slate-500 hover:shadow-xl transition-all duration-300 text-slate-900 z-10"
    >
      {/* Corner Control Points Badges (1st and 2nd Place Control - Animated with 3.5s bubble pop) */}
      {controlLeaders && (controlLeaders.first || controlLeaders.second) && (
        <div className="absolute -top-3.5 -right-3.5 flex items-center gap-1 z-30 animate-bubble-pop">
          {controlLeaders.first && (
            <div 
              style={{ 
                backgroundColor: controlLeaders.first.team.color, 
                color: getContrastTextColor(controlLeaders.first.team.color) 
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-2xl ring-4 ring-amber-400/90 animate-bubble-pop"
              title={`1st Place Control: ${controlLeaders.first.team.name} (+${controlLeaders.first.points} control points)`}
            >
              {controlLeaders.first.points}
            </div>
          )}
          {controlLeaders.second && (
            <div 
              style={{ 
                backgroundColor: controlLeaders.second.team.color, 
                color: getContrastTextColor(controlLeaders.second.team.color) 
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shadow-lg ring-2 ring-white animate-bubble-pop opacity-95"
              title={`2nd Place Control: ${controlLeaders.second.team.name} (+${controlLeaders.second.points} control points)`}
            >
              {controlLeaders.second.points}
            </div>
          )}
        </div>
      )}

      {/* Top Row: Title + Logistics Cost + Office Circles (Present, In-Progress, Empty) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <div className="flex items-center gap-2">
          {/* Logistics Badge with official GameIcon and dark gray border */}
          <div className="flex items-center gap-1.5 bg-slate-100 border-2 border-slate-500 px-2 py-0.5 rounded-lg shadow-xs">
            <GameIcon type="logistics" size="sm" />
            <span className="text-slate-900 text-sm font-black">{logisticsCost}</span>
          </div>
          <span className="font-display font-black text-base tracking-tight text-slate-900">{regionName.toUpperCase()}</span>
        </div>

        {/* Office & Logistics Slots Row (Present -> In-Progress -> Empty next to each other) */}
        <div className="flex items-center gap-1.5">
          {/* 1. Present Teams (Office Established - Letter Inside with Gold Ring & Bubble Pop) */}
          {presentTeamObjs.map(team => (
            <div 
              key={`present-${team.id}`}
              style={{ 
                backgroundColor: team.color,
                color: getContrastTextColor(team.color)
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ring-2 ring-amber-400 shadow-md shrink-0 animate-bubble-pop"
              title={`Office established by ${team.name} (Logistics Complete!)`}
            >
              {team.name[0]}
            </div>
          ))}

          {/* 2. In-Progress Teams (Shaded Pie Circles by Logistics Progress matching Research) */}
          {inProgressTeamObjs.map(({ team, invested }) => 
            renderInProgressCircle(team, invested, logisticsCost)
          )}

          {/* 3. Empty Open Slots (+) */}
          {Array.from({ length: emptySlotCount }).map((_, idx) => (
            <div 
              key={`empty-${idx}`} 
              className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 font-black shrink-0"
            >
              +
            </div>
          ))}
        </div>
      </div>

      {/* Middle Row: Customer Demand Slots (Single Row - No Wrapping) */}
      <div className="flex items-center gap-1.5 py-1 flex-nowrap justify-start">
        {customerStatus.map(({ customer, buyerTeam }) => {
          const isPrice = customer.type === 'price';
          const TechIcon = customer.technology ? TECHNOLOGY_ICONS[customer.technology] : null;

          return (
            <div 
              key={customer.id}
              style={buyerTeam ? { borderColor: buyerTeam.color } : undefined}
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center p-0.5 text-center font-mono shadow-sm transition-all duration-300 ${
                isPrice ? 'bg-red-600' : 'bg-purple-600'
              } ${buyerTeam ? 'border-[3px] shadow-md' : isPrice ? 'border border-red-700' : 'border border-purple-700'}`}
              title={
                buyerTeam 
                  ? `Sold to ${buyerTeam.name} (${isPrice ? `$${customer.price}` : customer.technology})` 
                  : isPrice ? `Price Customer: Max $${customer.price}` : `Value Customer: Requires ${customer.technology}`
              }
            >
              {/* Customer Requirement Icon/Price (100% visible and centered) */}
              {isPrice ? (
                <span className="font-black text-sm text-white">${customer.price}</span>
              ) : TechIcon ? (
                <TechIcon className="w-6 h-6 text-white stroke-[2.5]" />
              ) : (
                <GameIcon type="research" size="sm" />
              )}

              {/* Bottom-Center Team Color Dot Badge indicating purchasing team */}
              {buyerTeam && (
                <div 
                  style={{ backgroundColor: buyerTeam.color }}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full shadow-lg ring-2 ring-white z-20 animate-bubble-pop"
                  title={`Sold to ${buyerTeam.name}`}
                />
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
