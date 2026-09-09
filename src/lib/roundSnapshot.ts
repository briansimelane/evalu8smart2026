import { GameState, RegionLogistics, TeamLogisticsProgress, TeamResearchProgress } from '@/types/game';
import { INITIAL_TEAM_REGIONS } from '@/data/regions';

export function buildGameStateForRound(gameState: GameState, roundNumber: number): GameState {
  if (!gameState) return gameState;

  const targetRound = Math.min(Math.max(1, roundNumber), gameState.currentRound || 1);
  const targetRounds = (gameState.rounds || []).filter(r => r.roundNumber <= targetRound);

  // 1. Rebuild region presence and logistics progress up to targetRound
  const teamLogisticsProgress: Record<string, TeamLogisticsProgress> = {};
  gameState.teams.forEach(team => {
    const startingRegion = INITIAL_TEAM_REGIONS[team.color];
    const presence = new Set<string>();
    if (startingRegion) presence.add(startingRegion);

    targetRounds.forEach(r => {
      const tData = r.teamData[team.id];
      if (tData?.expansionLocations) {
        tData.expansionLocations.forEach(loc => presence.add(loc));
      }
    });

    const presenceArray = Array.from(presence);
    const investments: Record<string, number> = {};
    presenceArray.forEach(reg => {
      const cost = gameState.regionLogistics?.[reg]?.logisticsCost || 1;
      investments[reg] = cost;
    });

    teamLogisticsProgress[team.id] = {
      teamId: team.id,
      regionsWithPresence: presenceArray,
      regionInvestments: investments,
    };
  });

  const regionLogistics: Record<string, RegionLogistics> = {};
  Object.entries(gameState.regionLogistics || {}).forEach(([regionName, regData]) => {
    const teamsPresent: string[] = [];
    const teamProgress: Record<string, number> = {};

    gameState.teams.forEach(team => {
      if (teamLogisticsProgress[team.id]?.regionsWithPresence.includes(regionName)) {
        teamsPresent.push(team.id);
        teamProgress[team.id] = regData.logisticsCost;
      }
    });

    regionLogistics[regionName] = {
      ...regData,
      teamsPresent,
      teamProgress,
    };
  });

  // 2. Rebuild completed technologies, patents, and research progress up to targetRound
  const teamResearchProgress: Record<string, TeamResearchProgress> = {};
  const patents: Record<string, string> = {};

  gameState.teams.forEach(team => {
    const completed = new Set<string>();
    targetRounds.forEach(r => {
      const tData = r.teamData[team.id];
      if (tData?.technologiesResearched) {
        tData.technologiesResearched.forEach(tech => completed.add(tech));
      }
    });
    teamResearchProgress[team.id] = {
      teamId: team.id,
      technologyInvestments: {},
      completedTechnologies: Array.from(completed),
    };
  });

  // Patent holder = first team to complete the tech in the earliest round <= targetRound
  targetRounds.forEach(r => {
    gameState.teams.forEach(team => {
      const tData = r.teamData[team.id];
      if (tData?.technologiesResearched) {
        tData.technologiesResearched.forEach(tech => {
          if (!patents[tech]) {
            patents[tech] = team.id;
          }
        });
      }
    });
  });

  // 3. Filter improvement cards allocated in rounds <= targetRound
  const improvementCards = (gameState.improvementCards || []).filter(
    card => !card.allocatedInRound || card.allocatedInRound <= targetRound
  );

  return {
    ...gameState,
    currentRound: targetRound,
    rounds: targetRounds,
    regionLogistics,
    teamLogisticsProgress,
    teamResearchProgress,
    patents,
    improvementCards,
  };
}
