import { ImprovementCardData } from '@/data/improvements';
import { Combination } from '@/data/combinations';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';

export type BotProfile = 'BALANCED' | 'RESEARCHER' | 'EXPANDER' | 'PRICE_FIGHTER';
export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface Team {
  id: string;
  name: string;
  color: string;
  ceoName?: string;
  ceoPin?: string;
  status?: string;
  isBot?: boolean;
  botProfile?: BotProfile;
  botDifficulty?: BotDifficulty;
}

export type UserRole = 'ADMIN' | 'FACILITATOR' | 'STUDENT';

export interface ClassTeam {
  id: string;
  name: string;
  color: string;
  ceoName?: string;
  ceoPin?: string;
  updatedAt?: any;
  isBot?: boolean;
  botProfile?: BotProfile;
  botDifficulty?: BotDifficulty;
}

export interface FacilitatorUser {
  uid: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'FACILITATOR';
  createdAt: string;
  createdByEmail?: string;
  gamesCreatedCount?: number;
}

export interface SimulationClass {
  id: string;
  name: string;
  facilitatorCode: string;
  teamCodes: Record<string, string>; // teamId -> accessCode
  teamRegistry: ClassTeam[];
  gameState?: GameState | null; // Optional for backward compatibility with unmigrated classes
  createdAt: string;
  createdByEmail?: string;
  createdByName?: string;
}

export interface Technology {
  name: string;
  researchPoints: number;
  maxPoints: number;
  patentHolder?: string;
  researchCost: number;
  teamProgress: Record<string, number>; // teamId -> points invested by this team
}

export interface TeamResearchProgress {
  teamId: string;
  technologyInvestments: Record<string, number>; // tech name -> total research points invested
  completedTechnologies: string[]; // technologies fully researched
}

export interface Region {
  name: string;
  sales: Record<string, number>; // teamId -> units sold
  controlPoints: Record<string, number>; // teamId -> control points
}

export interface ImprovementCard {
  id: number;
  icon1: string;
  icon2: string;
  availableForTeam: string; // teamId
  used: boolean;
  usedBy?: string; // teamId
  isInitial?: boolean; // marks cards given at game start
  allocatedInRound?: number; // tracks when card became available
}

export interface RoundData {
  roundNumber: number;
  teamData: Record<string, TeamRoundData>;
  soldCustomers?: Set<string>; // Track which customers have been sold to in this round
}

export interface TeamRoundData {
  teamId: string;
  combination: number;
  position: number;
  price: number;
  productsProduced: number;
  improvementCards: number;
  researchIcons: number;
  logisticsIcons: number;
  revenue: number;
  technologiesResearched: string[];
  expansionLocations: string[];
  salesByRegion: Record<string, number>;
  regionControlPoints: Record<string, number>;
  controlValue: number;
  totalMoney: number;
  improvementCardUsage?: 'use' | 'product' | 'none';
  improvementCardId?: number;
  cardUsages?: Record<number, 'use' | 'product' | 'none'>;
  customersSold?: string[]; // IDs of customers sold to
  eligiblePriceCustomers?: number;
  eligibleValueCustomers?: number;
  eligibleSalesUnits?: number;
  demandFulfillmentRate?: number;
}

export interface RegionLogistics {
  name: string;
  logisticsCost: number;
  maxTeams: number;
  connectedRegions: string[];
  teamsPresent: string[]; // teamIds with full presence
  teamProgress: Record<string, number>; // teamId -> logistics points invested
}

export interface TeamLogisticsProgress {
  teamId: string;
  regionsWithPresence: string[]; // regions where team has full presence
  regionInvestments: Record<string, number>; // region -> logistics points invested
}

export type GamePhase = 'planning' | 'production' | 'improvement' | 'innovation' | 'expansion' | 'sales' | 'control' | 'PLANNING' | 'PRODUCTION' | (string & {});

export interface GameState {
  gameId: string;
  teams: Team[];
  currentRound: number;
  rounds: RoundData[];
  technologies: Record<string, Technology>;
  regions: Region[];
  patents: Record<string, string>; // techName -> teamId
  improvementCards: ImprovementCard[];
  improvementPoolByRound: Record<number, number[]>; // roundNumber -> array of AVAILABLE_IMPROVEMENT_CARDS ids
  teamResearchProgress: Record<string, TeamResearchProgress>; // teamId -> research progress
  researchAllocatedByRound: Record<number, Record<string, number>>; // roundNumber -> teamId -> icons spent
  regionLogistics: Record<string, RegionLogistics>; // regionName -> logistics data
  teamLogisticsProgress: Record<string, TeamLogisticsProgress>; // teamId -> logistics progress
  logisticsAllocatedByRound: Record<number, Record<string, number>>; // roundNumber -> teamId -> icons spent
  combinationsData?: Combination[]; // custom combination overrides
  currentPhase?: GamePhase;
  createdAt: Date;
  updatedAt: Date;
  botConfig?: {
    enabled: boolean;
    seed: number;
  };
  botThinking?: Record<string, boolean>;
  botActionsLog?: Array<{
    round: number;
    phase: string;
    teamId: string;
    summary: string;
    at: string;
  }>;
  gameEnded?: boolean;
}

export const PATENT_POINTS: Record<string, number> = {
  'GPS': 6,
  'Wifi': 6,
  'WIFI': 6,
  'Wi-Fi': 6,
  'Gaming': 8,
  'GAMING': 8,
  'Battery': 8,
  'BATTERY': 8,
  'NFC': 10,
  '4G': 12,
};

export const getPatentPointsForTech = (techName: string): number => {
  if (!techName) return 0;
  if (PATENT_POINTS[techName] !== undefined) return PATENT_POINTS[techName];
  const upper = techName.toUpperCase();
  if (PATENT_POINTS[upper] !== undefined) return PATENT_POINTS[upper];
  const title = techName.charAt(0).toUpperCase() + techName.slice(1).toLowerCase();
  if (PATENT_POINTS[title] !== undefined) return PATENT_POINTS[title];
  return 0;
};

export const getTeamPatentPoints = (
  teamId: string,
  patents: Record<string, string> | undefined,
  targetRound: number,
  gameEnded?: boolean,
  currentRound?: number
): number => {
  if (!patents) return 0;

  // Patent bonus points are ONLY added to the final round (round 5) or the round in which the game was ended.
  if (gameEnded) {
    // If the game was ended, patent points are awarded ONLY for the round in which it was ended (currentRound or 5)
    const endRound = currentRound || 5;
    if (targetRound < endRound) return 0;
  } else {
    // If the game is ongoing, patent points are awarded ONLY if targetRound is the final round (round 5)
    if (targetRound < 5) return 0;
    if (currentRound !== undefined && targetRound < currentRound) return 0;
  }

  let points = 0;
  Object.entries(patents).forEach(([tech, holderTeamId]) => {
    if (holderTeamId === teamId) {
      points += getPatentPointsForTech(tech);
    }
  });

  return points;
};

import { getTeamColorName } from '@/data/combinations';

export const COLOR_SCORES: Record<string, number> = {
  green: 3,
  purple: 3,
  blue: 4,
  black: 5,
  yellow: 6,
  red: 7
};

export const getInitialScore = (team: { name: string; color: string }): number => {
  if (!team) return 0;
  const colorName = getTeamColorName(team.color, team.name).toLowerCase();
  if (COLOR_SCORES[colorName] !== undefined) {
    return COLOR_SCORES[colorName];
  }
  return 0;
};

export const getControlPointsForTeamInRound = (
  roundObj: RoundData | undefined,
  teamId: string,
  gameState: GameState
): number => {
  if (!roundObj) return 0;

  let totalPoints = 0;

  REGION_CUSTOMERS.forEach(({ region, customers }) => {
    const regionLogisticsData = gameState.regionLogistics?.[region];
    const teamsPresent = regionLogisticsData?.teamsPresent || [];

    const teamSales: Array<{ teamId: string; salesCount: number; leftmostPos: number }> = [];

    gameState.teams.forEach(t => {
      const td = roundObj.teamData[t.id];
      if (!td || !td.customersSold) return;

      const soldInRegion = td.customersSold.filter(cid => customers.some(c => c.id === cid));
      if (soldInRegion.length > 0) {
        let minPos = Infinity;
        soldInRegion.forEach(cid => {
          const cust = customers.find(c => c.id === cid);
          if (cust && cust.position < minPos) minPos = cust.position;
        });

        teamSales.push({
          teamId: t.id,
          salesCount: soldInRegion.length,
          leftmostPos: minPos === Infinity ? 999 : minPos,
        });
      }
    });

    teamSales.sort((a, b) => {
      if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
      return a.leftmostPos - b.leftmostPos;
    });

    if (teamSales[0] && teamSales[0].teamId === teamId) {
      totalPoints += getControlPointsForRegion(region, teamsPresent.length, 'first');
    } else if (teamSales[1] && teamSales[1].teamId === teamId) {
      totalPoints += getControlPointsForRegion(region, teamsPresent.length, 'second');
    }
  });

  return totalPoints;
};

export interface RegionalControlDetail {
  region: string;
  points: number;
  rank: 'first' | 'second';
  teamsPresentCount: number;
}

export const getRegionalControlBreakdownForTeamInRound = (
  roundObj: RoundData | undefined,
  teamId: string,
  gameState: GameState
): RegionalControlDetail[] => {
  if (!roundObj) return [];

  const details: RegionalControlDetail[] = [];

  REGION_CUSTOMERS.forEach(({ region, customers }) => {
    const regionLogisticsData = gameState.regionLogistics?.[region];
    const teamsPresent = regionLogisticsData?.teamsPresent || [];

    const teamSales: Array<{ teamId: string; salesCount: number; leftmostPos: number }> = [];

    gameState.teams.forEach(t => {
      const td = roundObj.teamData[t.id];
      if (!td || !td.customersSold) return;

      const soldInRegion = td.customersSold.filter(cid => customers.some(c => c.id === cid));
      if (soldInRegion.length > 0) {
        let minPos = Infinity;
        soldInRegion.forEach(cid => {
          const cust = customers.find(c => c.id === cid);
          if (cust && cust.position < minPos) minPos = cust.position;
        });

        teamSales.push({
          teamId: t.id,
          salesCount: soldInRegion.length,
          leftmostPos: minPos === Infinity ? 999 : minPos,
        });
      }
    });

    teamSales.sort((a, b) => {
      if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
      return a.leftmostPos - b.leftmostPos;
    });

    if (teamSales[0] && teamSales[0].teamId === teamId) {
      const pts = getControlPointsForRegion(region, teamsPresent.length, 'first');
      if (pts > 0) {
        details.push({ region, points: pts, rank: 'first', teamsPresentCount: teamsPresent.length });
      }
    } else if (teamSales[1] && teamSales[1].teamId === teamId) {
      const pts = getControlPointsForRegion(region, teamsPresent.length, 'second');
      if (pts > 0) {
        details.push({ region, points: pts, rank: 'second', teamsPresentCount: teamsPresent.length });
      }
    }
  });

  return details;
};

export const calculateTeamTotalScore = (
  teamId: string,
  targetRound: number,
  gameState: GameState
): {
  startValue: number;
  cumulativeRevenue: number;
  cumulativeControl: number;
  patentBonus: number;
  totalScore: number;
} => {
  const team = gameState.teams.find(t => t.id === teamId);
  if (!team) {
    return { startValue: 0, cumulativeRevenue: 0, cumulativeControl: 0, patentBonus: 0, totalScore: 0 };
  }

  const startValue = getInitialScore(team);
  let cumulativeRevenue = 0;
  let cumulativeControl = 0;

  for (let r = 1; r <= targetRound; r++) {
    const rd = gameState.rounds.find(round => round.roundNumber === r);
    if (rd) {
      const tData = rd.teamData[teamId];
      if (tData) {
        cumulativeRevenue += tData.revenue || 0;
      }
      cumulativeControl += getControlPointsForTeamInRound(rd, teamId, gameState);
    }
  }

  const patentBonus = getTeamPatentPoints(teamId, gameState.patents, targetRound, gameState.gameEnded, gameState.currentRound);
  const totalScore = startValue + cumulativeRevenue + cumulativeControl + patentBonus;

  return {
    startValue,
    cumulativeRevenue,
    cumulativeControl,
    patentBonus,
    totalScore,
  };
};
