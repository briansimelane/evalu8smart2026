import React, { useMemo } from 'react';
import { GameState, Team } from '@/types/game';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import { isRuleActiveForTeam } from '@/lib/defaultRules';
import { isSteveBlocking as isSteveBlockingRule, isTeamBuildingOffice, getCompletedOffices } from '@/lib/rules';
import { getTeamBubbleText } from '@/lib/multiworld/teamLabel';
import { useMotion } from '../motionAdapter';
import { cn } from '@/lib/utils';
import { Truck } from 'lucide-react';
import { RegionLayoutItem } from '../layoutData';
import { useGameTheme, regionLabel, techLabel, techIcon } from '@/lib/gameTheme';

const getContrastTextColor = (hexColor: string) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#0f172a' : '#ffffff';
};

interface RegionPlate3DProps {
  regionName: string;
  layout: RegionLayoutItem;
  gameState: GameState;
}

export function RegionPlate3D({ regionName, layout, gameState }: RegionPlate3DProps) {
  const round = gameState.currentRound;
  const regionConfig = gameState.regionLogistics?.[regionName];
  const m = useMotion();
  const theme = useGameTheme(gameState);
  const displayRegionName = regionLabel(theme, regionName);

  const customerData = useMemo(() => {
    return REGION_CUSTOMERS.find(c => c.region === regionName)?.customers || [];
  }, [regionName]);

  // Determine buyer team for each customer slot (in current round)
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

  const logisticsCost = regionConfig?.logisticsCost ?? layout.logisticsCost ?? 2;
  const maxTeams = regionConfig?.maxTeams ?? layout.maxTeams ?? 3;
  const teamsPresent = regionConfig?.teamsPresent || [];

  // Established Offices
  const isMultiOfficeActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'multiple_offices_per_region');
  const presentOffices = useMemo(() => {
    const list: Array<{ team: Team; officeIndex: number }> = [];
    teamsPresent.forEach(id => {
      const team = gameState.teams.find(t => t.id === id);
      if (!team) return;
      const count = isMultiOfficeActive ? Math.max(1, regionConfig?.officeCounts?.[id] || 1) : 1;
      for (let i = 0; i < count; i++) {
        list.push({ team, officeIndex: i });
      }
    });
    return list;
  }, [teamsPresent, gameState.teams, regionConfig?.officeCounts, isMultiOfficeActive]);

  // In-progress expansion offices
  const inProgressOffices = useMemo(() => {
    const list: Array<{ team: Team; invested: number }> = [];
    gameState.teams.forEach(team => {
      const invested = regionConfig?.teamProgress?.[team.id] || 0;
      if (invested <= 0) return;

      if (isTeamBuildingOffice(regionConfig, team.id, logisticsCost)) {
        const completed = getCompletedOffices(regionConfig, team.id);
        const discounted = Math.max(1, logisticsCost - 1);
        const consumed = completed <= 0 ? 0 : (logisticsCost + (completed - 1) * discounted);
        const unconsumedInvested = Math.max(0, invested - consumed);
        list.push({ team, invested: unconsumedInvested });
      }
    });
    return list;
  }, [gameState.teams, regionConfig, logisticsCost]);

  // Free office slots
  const occupiedCount = presentOffices.length + inProgressOffices.length;
  const freeSlotCount = Math.max(0, maxTeams - occupiedCount);

  // Control points calculation
  const controlLeaders = useMemo(() => {
    if (isSteveBlockingRule(gameState, regionName)) return null;

    const teamSalesMap: Record<string, number> = {};
    if (gameState.rounds) {
      for (const rData of gameState.rounds) {
        if (rData.roundNumber === round && rData.teamData) {
          for (const teamId of Object.keys(rData.teamData)) {
            const teamsPres = regionConfig?.teamsPresent || [];
            const hasOffice = teamsPres.includes(teamId) || ((regionConfig?.officeCounts?.[teamId] || 0) > 0);
            if (!hasOffice) continue;

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
        team: gameState.teams.find(t => t.id === teamId)!,
        salesCount,
      }))
      .filter(item => item.team && item.salesCount > 0)
      .sort((a, b) => b.salesCount - a.salesCount);

    if (sortedTeams.length === 0) return null;

    const totalOffices = Object.values(regionConfig?.officeCounts || {}).reduce((a, b) => a + Number(b), 0);
    const occupiedSlots = isMultiOfficeActive
      ? Math.max(1, totalOffices || teamsPresent.length)
      : Math.max(1, teamsPresent.length);
    const teamsPresentCount = Math.min(5, Math.max(1, occupiedSlots));

    const firstPlace = sortedTeams[0];
    const firstPoints = getControlPointsForRegion(regionName, teamsPresentCount, 'first');

    let secondPlace: { team: Team; salesCount: number } | null = null;
    let secondPoints = 0;
    if (sortedTeams.length > 1) {
      secondPlace = sortedTeams[1];
      secondPoints = getControlPointsForRegion(regionName, teamsPresentCount, 'second');
    }

    return {
      first: (firstPlace && firstPoints > 0) ? { team: firstPlace.team, points: firstPoints } : null,
      second: (secondPlace && secondPoints > 0) ? { team: secondPlace.team, points: secondPoints } : null,
    };
  }, [gameState, round, regionName, regionConfig, customerData, isMultiOfficeActive, teamsPresent]);

  // Name font size rule: dynamically scale so longer names (like AUSTRALIA, NORTH AFRICA, SOUTHERN AFRICA) fit cleanly
  const nameLength = displayRegionName.length;
  const nameFontSizeClass =
    nameLength >= 13 ? 'text-[10.5px]' :
    nameLength > 10 ? 'text-[11.5px]' :
    nameLength >= 8 ? 'text-[13px]' :
    'text-[15.5px]';

  const officeSizeClass = maxTeams >= 4 ? "w-[25px] h-[25px] text-[10.5px]" : "w-7 h-7 text-xs";

  const { x, y, w, h } = layout.plate;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
      }}
      className="rounded-2xl border-2 border-[#cfd8ea] bg-gradient-to-b from-white to-[#e9eef8] shadow-xl p-2 select-none z-20 flex flex-col justify-between"
    >
      {/* Top Gloss Sheen Overlay */}
      <div className="absolute top-1 left-1.5 right-1.5 h-[36px] bg-white/70 rounded-xl pointer-events-none" />

      {/* Control Badges (Top-Right Corner) */}
      {controlLeaders?.first && (
        <div className="absolute -top-3.5 right-1 flex items-center gap-1 z-30 pointer-events-auto">
          {/* 2nd Place Badge (if any) */}
          {controlLeaders.second && (
            <div
              style={{
                backgroundColor: controlLeaders.second.team.color,
                color: getContrastTextColor(controlLeaders.second.team.color),
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shadow-md ring-2 ring-white"
              title={`${controlLeaders.second.team.name}: 2nd Place Control (${controlLeaders.second.points} pts)`}
            >
              {controlLeaders.second.points}
            </div>
          )}
          {/* 1st Place Leader Badge */}
          <div
            style={{
              backgroundColor: controlLeaders.first.team.color,
              color: getContrastTextColor(controlLeaders.first.team.color),
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-[13px] shadow-lg ring-4 ring-amber-400"
            title={`${controlLeaders.first.team.name}: 1st Place Control Leader (${controlLeaders.first.points} pts)`}
          >
            {controlLeaders.first.points}
          </div>
        </div>
      )}

      {/* Title Row */}
      <div className="relative flex items-center justify-between z-10 px-1 pt-0.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
          {/* Logistics Badge: grey-bordered pill */}
          <div className="w-[68px] h-[30px] rounded-[8px] bg-[#f1f5f9] border-2 border-[#64748b] flex items-center px-1 justify-between shadow-2xs shrink-0">
            {/* Cyan-500 rounded square with white truck */}
            <div className="w-6 h-6 rounded-[6px] bg-[#06b6d4] border border-[#0891b2] flex items-center justify-center text-white shrink-0">
              <Truck className="w-3.5 h-3.5 stroke-[2.4]" />
            </div>
            {/* Cost Number */}
            <span className="text-[18px] font-black text-[#0f172a] pr-1 font-sans leading-none">
              {logisticsCost}
            </span>
          </div>

          {/* Region Name */}
          <span className={cn("font-black text-[#0f172a] uppercase tracking-wide leading-none truncate", nameFontSizeClass)}>
            {displayRegionName}
          </span>
        </div>

        {/* Office Circles Right-Aligned (one per maxTeams) */}
        <div className="flex items-center gap-1.5 pr-0.5 shrink-0">
          {/* 1. Owned Offices */}
          {presentOffices.map(({ team, officeIndex }) => {
            const textColor = getContrastTextColor(team.color);
            const officeKey = `office:${regionName}:${team.id}`;
            return (
              <div
                key={`office-${team.id}-${officeIndex}`}
                style={{
                  backgroundColor: team.color,
                  color: textColor,
                }}
                className={cn(
                  "rounded-full flex items-center justify-center font-black shadow-md ring-2 ring-amber-400 shrink-0 transition-transform active:scale-95",
                  officeSizeClass,
                  m.isRecent(officeKey) && "ring-4 ring-amber-300 scale-105"
                )}
                title={`${team.name}: Established Office`}
              >
                {getTeamBubbleText(team)}
              </div>
            );
          })}

          {/* 2. In-Progress Expansion Offices */}
          {inProgressOffices.map(({ team, invested }) => {
            const fraction = Math.min(1, Math.max(0, invested / logisticsCost));
            const degrees = fraction * 360;
            return (
              <div
                key={`inprog-${team.id}`}
                style={{
                  borderColor: team.color,
                  background: `conic-gradient(${team.color} 0deg ${degrees}deg, #e2e8f0 ${degrees}deg 360deg)`,
                }}
                className={cn(
                  "rounded-full border-2 relative shrink-0 flex items-center justify-center overflow-hidden shadow-2xs",
                  officeSizeClass
                )}
                title={`${team.name}: ${invested}/${logisticsCost} Logistics invested`}
              >
                {/* Radial divider lines */}
                {logisticsCost > 1 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 24 24">
                    {Array.from({ length: logisticsCost }).map((_, i) => {
                      const angle = (i * 360) / logisticsCost;
                      const rad = (angle - 90) * (Math.PI / 180);
                      return (
                        <line
                          key={i}
                          x1="12"
                          y1="12"
                          x2={12 + 12 * Math.cos(rad)}
                          y2={12 + 12 * Math.sin(rad)}
                          stroke="#000"
                          strokeWidth="1.2"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            );
          })}

          {/* 3. Empty Office Slots */}
          {Array.from({ length: freeSlotCount }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className={cn(
                "rounded-full border-2 border-dashed border-[#c3cbe0] bg-white shrink-0",
                officeSizeClass
              )}
              title="Empty Office Slot"
            />
          ))}
        </div>
      </div>

      {/* Customer Chips Row */}
      <div className="relative flex items-center gap-2.5 z-10 px-1 pb-1">
        {customerStatus.map(({ customer, buyerTeam }, i) => {
          const isPrice = customer.type === 'price';
          const TechIcon = customer.technology ? techIcon(theme, customer.technology) : null;
          const custKey = `customer:${regionName}:${customer.id}`;
          const isSold = Boolean(buyerTeam);

          return (
            <div key={customer.id} className="relative flex flex-col items-center">
              {/* Customer Chip (36x36 rounded) */}
              <div
                style={{
                  backgroundColor: isPrice ? '#e11d2e' : '#7c3aed',
                  borderColor: isSold ? buyerTeam?.color : (isPrice ? '#b91c1c' : '#6d28d9'),
                  borderWidth: isSold ? '3.5px' : '1.5px',
                }}
                className={cn(
                  "w-[36px] h-[36px] rounded-[10px] flex items-center justify-center text-white shadow-md relative transition-transform",
                  m.isRecent(custKey) && "scale-110"
                )}
                title={
                  isPrice
                    ? `Price Customer: $${customer.price}${isSold ? ` (Sold to ${buyerTeam?.name})` : ' (Available)'}`
                    : `Tech Customer: ${techLabel(theme, customer.technology || '')}${isSold ? ` (Sold to ${buyerTeam?.name})` : ' (Available)'}`
                }
              >
                {/* Chip Sheen */}
                <div className="absolute top-1 left-1.5 right-1.5 h-[12px] bg-white/25 rounded-md pointer-events-none" />

                {isPrice ? (
                  <span className="text-[15px] font-black text-white leading-none">
                    ${customer.price}
                  </span>
                ) : (
                  TechIcon && <TechIcon className="w-5 h-5 text-white stroke-[2.5]" />
                )}
              </div>

              {/* Sold Buyer Token under Chip */}
              {isSold && buyerTeam && (
                <div
                  style={{
                    backgroundColor: buyerTeam.color,
                    color: getContrastTextColor(buyerTeam.color),
                  }}
                  className="w-[19px] h-[19px] rounded-full border-2 border-white flex items-center justify-center font-black text-[10px] shadow-sm -mt-1.5 z-20 leading-none"
                  title={`Sold to ${buyerTeam.name}`}
                >
                  {getTeamBubbleText(buyerTeam)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
