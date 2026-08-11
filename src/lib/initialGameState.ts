import { GameState, Team, TeamResearchProgress, RegionLogistics, TeamLogisticsProgress } from '@/types/game';
import { getTeamColorName, REGIONS, TECHNOLOGIES } from '@/data/combinations';
import { INITIAL_IMPROVEMENT_CARDS } from '@/data/improvements';
import { REGION_CONFIGS, INITIAL_TEAM_REGIONS } from '@/data/regions';

export const buildInitialGameState = (teams: Team[]): GameState => {
  const baseId = Date.now();
  const initialCards = teams.map((team, idx) => {
    const colorName = getTeamColorName(team.color, team.name);
    const cardData = INITIAL_IMPROVEMENT_CARDS[colorName];
    
    return {
      id: baseId + idx + 1,
      icon1: cardData.icon1,
      icon2: cardData.icon2,
      availableForTeam: team.id,
      used: false,
      isInitial: true,
    };
  });

  const techCosts: Record<string, number> = {
    'GPS': 3,
    'Wifi': 3,
    'WIFI': 3,
    'Wi-Fi': 3,
    'Gaming': 4,
    'GAMING': 4,
    'Battery': 4,
    'BATTERY': 4,
    'NFC': 5,
    '4G': 6,
  };

  const teamResearchProgress: Record<string, TeamResearchProgress> = {};
  teams.forEach(team => {
    teamResearchProgress[team.id] = {
      teamId: team.id,
      technologyInvestments: {},
      completedTechnologies: [],
    };
  });

  const regionLogistics: Record<string, RegionLogistics> = {};
  REGION_CONFIGS.forEach(config => {
    regionLogistics[config.name] = {
      name: config.name,
      logisticsCost: config.logisticsCost,
      maxTeams: config.maxTeams,
      connectedRegions: config.connectedRegions,
      teamsPresent: [],
      teamProgress: {}
    };
  });

  const teamLogisticsProgress: Record<string, TeamLogisticsProgress> = {};
  teams.forEach(team => {
    const colorName = getTeamColorName(team.color, team.name);
    const startingRegion = INITIAL_TEAM_REGIONS[colorName];
    
    if (startingRegion) {
      regionLogistics[startingRegion].teamsPresent.push(team.id);
      
      teamLogisticsProgress[team.id] = {
        teamId: team.id,
        regionsWithPresence: [startingRegion],
        regionInvestments: {}
      };
    } else {
      teamLogisticsProgress[team.id] = {
        teamId: team.id,
        regionsWithPresence: [],
        regionInvestments: {}
      };
    }
  });

  return {
    gameId: Date.now().toString(),
    teams,
    currentRound: 1,
    rounds: [],
    technologies: TECHNOLOGIES.reduce((acc, tech) => ({
      ...acc,
      [tech]: { 
        name: tech, 
        researchPoints: 0, 
        maxPoints: 6,
        researchCost: tech.toUpperCase().includes('WIFI') ? 3 : (techCosts[tech] || 4),
        teamProgress: {}
      }
    }), {}),
    regions: REGIONS.map(region => ({
      name: region,
      sales: {},
      controlPoints: {}
    })),
    patents: {},
    improvementCards: initialCards,
    improvementPoolByRound: {},
    teamResearchProgress,
    researchAllocatedByRound: {},
    regionLogistics,
    teamLogisticsProgress,
    logisticsAllocatedByRound: {},
    createdAt: new Date().toISOString() as any,
    updatedAt: new Date().toISOString() as any,
    botConfig: teams.some(t => t.isBot) ? { enabled: true, seed: Math.floor(Math.random() * 1000000) } : null as any
  };
};
