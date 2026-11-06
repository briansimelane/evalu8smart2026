import { GameState, RegionLogistics, TeamLogisticsProgress, TeamResearchProgress, Technology, RoundBoardSnapshot } from '@/types/game';
import { INITIAL_TEAM_REGIONS } from '@/data/regions';
import { getTeamColorName } from '@/data/combinations';
import { REGION_CUSTOMERS } from '@/data/customers';

// Fast lookup from customer ID to region name
const CUSTOMER_REGION_MAP: Record<string, string> = {};
REGION_CUSTOMERS.forEach(rc => {
  rc.customers.forEach(c => {
    CUSTOMER_REGION_MAP[c.id] = rc.region;
  });
});

/**
 * Builds the game state representing a specific round.
 * - If roundNumber === currentRound: returns live gameState as it progresses.
 * - If roundNumber < currentRound: returns the state of the map at the scoring end of that round.
 */
export function buildGameStateForRound(gameState: GameState, roundNumber: number): GameState {
  if (!gameState) return gameState;

  const targetRound = Math.min(Math.max(1, roundNumber), gameState.currentRound || 1);

  // If viewing current round, return live gameState as it progresses
  if (targetRound >= (gameState.currentRound || 1)) {
    return gameState;
  }

  const targetRounds = (gameState.rounds || []).filter(r => r.roundNumber <= targetRound);

  // 1. Check if a high-fidelity snapshot was saved at round scoring close
  if (gameState.boardSnapshotsByRound?.[targetRound]) {
    const snapshot = gameState.boardSnapshotsByRound[targetRound];
    return {
      ...gameState,
      currentRound: targetRound,
      currentPhase: 'scoring',
      rounds: targetRounds,
      regionLogistics: snapshot.regionLogistics,
      teamLogisticsProgress: snapshot.teamLogisticsProgress,
      technologies: snapshot.technologies,
      teamResearchProgress: snapshot.teamResearchProgress,
      patents: snapshot.patents,
      improvementCards: snapshot.improvementCards || gameState.improvementCards,
    };
  }

  // 2. High-fidelity historical reconstruction for rounds prior to snapshot recording:
  // Rebuild region presence and logistics progress up to targetRound
  const teamLogisticsProgress: Record<string, TeamLogisticsProgress> = {};
  (gameState.teams || []).forEach(team => {
    const colorName = getTeamColorName(team.color, team.name);
    const startingRegion = INITIAL_TEAM_REGIONS[colorName];
    const presence = new Set<string>();
    if (startingRegion) presence.add(startingRegion);

    targetRounds.forEach(r => {
      const tData = r.teamData?.[team.id];
      if (!tData) return;

      // Expansion locations recorded in round
      if (Array.isArray(tData.expansionLocations)) {
        tData.expansionLocations.forEach(loc => {
          if (loc) presence.add(loc);
        });
      }

      // Sales made in this round prove office presence
      if (tData.salesByRegion) {
        Object.entries(tData.salesByRegion).forEach(([reg, qty]) => {
          if (qty > 0) presence.add(reg);
        });
      }

      if (Array.isArray(tData.customersSold)) {
        tData.customersSold.forEach(custId => {
          const reg = CUSTOMER_REGION_MAP[custId];
          if (reg) presence.add(reg);
        });
      }
    });

    // Check if team spent logistics icons up to targetRound
    let totalLogisticsSpent = 0;
    targetRounds.forEach(r => {
      totalLogisticsSpent += (gameState.logisticsAllocatedByRound?.[r.roundNumber]?.[team.id] || 0);
    });

    const currentPresence = gameState.teamLogisticsProgress?.[team.id]?.regionsWithPresence || [];
    if (presence.size <= 1 && totalLogisticsSpent > 0 && currentPresence.length > 1) {
      currentPresence.forEach(reg => {
        if (reg !== startingRegion) presence.add(reg);
      });
    }

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
    const officeCounts: Record<string, number> = {};

    (gameState.teams || []).forEach(team => {
      if (teamLogisticsProgress[team.id]?.regionsWithPresence.includes(regionName)) {
        teamsPresent.push(team.id);
        teamProgress[team.id] = regData.logisticsCost;
        officeCounts[team.id] = Math.max(1, regData.officeCounts?.[team.id] || 1);
      }
    });

    regionLogistics[regionName] = {
      ...regData,
      teamsPresent,
      teamProgress,
      officeCounts,
    };
  });

  // Rebuild completed technologies, patents, and research progress up to targetRound
  const teamResearchProgress: Record<string, TeamResearchProgress> = {};
  const patents: Record<string, string> = {};
  const technologies: Record<string, Technology> = {};

  Object.entries(gameState.technologies || {}).forEach(([techName, techData]) => {
    technologies[techName] = {
      ...techData,
      patentHolder: undefined,
      teamProgress: {},
    };
  });

  (gameState.teams || []).forEach(team => {
    const completed = new Set<string>();
    const investments: Record<string, number> = {};

    // Check round data technologiesResearched
    targetRounds.forEach(r => {
      const tData = r.teamData?.[team.id];
      if (tData?.technologiesResearched) {
        tData.technologiesResearched.forEach(tech => completed.add(tech));
      }
    });

    // Check patent holders & research points spent up to targetRound
    let totalResearchSpent = 0;
    targetRounds.forEach(r => {
      totalResearchSpent += (gameState.researchAllocatedByRound?.[r.roundNumber]?.[team.id] || 0);
    });

    const currentCompleted = gameState.teamResearchProgress?.[team.id]?.completedTechnologies || [];
    currentCompleted.forEach(techName => {
      if (completed.has(techName)) return;

      const patentRound = gameState.patentRounds?.[techName];
      if (patentRound !== undefined && patentRound <= targetRound) {
        completed.add(techName);
        return;
      }

      const isHolder = gameState.patents?.[techName] === team.id;
      const techCost = gameState.technologies?.[techName]?.cost || 3;

      if (isHolder && totalResearchSpent >= techCost) {
        completed.add(techName);
      } else if (!isHolder && totalResearchSpent >= techCost && targetRound >= (gameState.currentRound - 1)) {
        completed.add(techName);
      }
    });

    // Mark completed investments
    completed.forEach(techName => {
      const cost = gameState.technologies?.[techName]?.cost || 3;
      investments[techName] = cost;
      if (technologies[techName]) {
        technologies[techName].teamProgress[team.id] = cost;
      }
    });

    // Carry over in-progress investments for uncompleted techs
    const currentInvestments = gameState.teamResearchProgress?.[team.id]?.technologyInvestments || {};
    Object.entries(currentInvestments).forEach(([techName, pts]) => {
      if (!completed.has(techName) && pts > 0) {
        if (targetRound === 1) {
          const spentInR1 = gameState.researchAllocatedByRound?.[1]?.[team.id] || 0;
          const completedCostR1 = Array.from(completed).reduce((sum, t) => sum + (gameState.technologies?.[t]?.cost || 3), 0);
          const remR1 = Math.max(0, spentInR1 - completedCostR1);
          if (remR1 > 0) {
            const inv = Math.min(pts, remR1);
            investments[techName] = inv;
            if (technologies[techName]) technologies[techName].teamProgress[team.id] = inv;
          }
        } else {
          investments[techName] = pts;
          if (technologies[techName]) technologies[techName].teamProgress[team.id] = pts;
        }
      }
    });

    teamResearchProgress[team.id] = {
      teamId: team.id,
      completedTechnologies: Array.from(completed),
      technologyInvestments: investments,
    };
  });

  // Assign patents up to targetRound
  Object.keys(technologies).forEach(techName => {
    const holder = gameState.patents?.[techName];
    if (holder && teamResearchProgress[holder]?.completedTechnologies.includes(techName)) {
      patents[techName] = holder;
      technologies[techName].patentHolder = holder;
    }
  });

  // Filter improvement cards allocated in rounds <= targetRound
  const improvementCards = (gameState.improvementCards || []).filter(
    card => !card.allocatedInRound || card.allocatedInRound <= targetRound
  );

  return {
    ...gameState,
    currentRound: targetRound,
    currentPhase: 'scoring',
    rounds: targetRounds,
    regionLogistics,
    teamLogisticsProgress,
    technologies,
    teamResearchProgress,
    patents,
    improvementCards,
  };
}
