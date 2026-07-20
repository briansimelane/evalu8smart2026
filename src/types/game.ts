import { ImprovementCardData } from '@/data/improvements';
import { Combination } from '@/data/combinations';

export interface Team {
  id: string;
  name: string;
  color: string;
  ceoName?: string;
  ceoPin?: string;
  status?: string;
}

export type UserRole = 'ADMIN' | 'FACILITATOR' | 'STUDENT';

export interface SimulationClass {
  id: string;
  name: string;
  facilitatorCode: string;
  teamCodes: Record<string, string>; // teamId -> accessCode
  gameState: GameState | null;
  createdAt: string;
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
  currentPhase?: 'PLANNING' | 'PRODUCTION';
  createdAt: Date;
  updatedAt: Date;
}
