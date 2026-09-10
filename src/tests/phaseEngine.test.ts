import { describe, it, expect } from 'vitest';
import { getNextPhase, advanceOnePhase, getBlockingTeams } from '@/lib/phaseEngine';
import { GameState } from '@/types/game';

function createMockGameState(phase: string = 'planning', round: number = 1): GameState {
  return {
    gameId: 'test_game',
    currentRound: round,
    currentPhase: phase as any,
    teams: [
      { id: 'team-1', name: 'Alpha', color: '#10b981', isBot: false },
      { id: 'team-2', name: 'Beta', color: '#3b82f6', isBot: true },
    ],
    rounds: [
      {
        roundNumber: round,
        teamData: {
          'team-1': {
            teamId: 'team-1',
            combination: 1,
            position: 1,
            price: 7,
            productsProduced: 3,
            improvementCards: 1,
            researchIcons: 1,
            logisticsIcons: 1,
            revenue: 10,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 10
          }
        }
      }
    ],
    technologies: {},
    regions: [],
    patents: {},
    improvementCards: [],
    improvementPoolByRound: {},
    teamResearchProgress: {
      'team-1': { teamId: 'team-1', technologyInvestments: {}, completedTechnologies: ['Wi-Fi Technology'] },
      'team-2': { teamId: 'team-2', technologyInvestments: {}, completedTechnologies: [] }
    },
    researchAllocatedByRound: {},
    regionLogistics: {},
    teamLogisticsProgress: {},
    logisticsAllocatedByRound: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe('phaseEngine', () => {
  it('sequences phases correctly in standard round', () => {
    const state = createMockGameState('planning', 1);
    expect(getNextPhase(state)).toEqual({ nextPhase: 'production', nextRound: 1, isGameEnd: false });

    const state2 = createMockGameState('production', 1);
    expect(getNextPhase(state2)).toEqual({ nextPhase: 'improvement', nextRound: 1, isGameEnd: false });
  });

  it('skips improvement phase in Round 5', () => {
    const state = createMockGameState('production', 5);
    expect(getNextPhase(state)).toEqual({ nextPhase: 'innovation', nextRound: 5, isGameEnd: false });
  });

  it('advances from scoring to planning round + 1 with Wi-Fi carry-over', () => {
    const state = createMockGameState('scoring', 1);
    state.rounds[0].teamData['team-1'].productsProduced = 5;
    state.rounds[0].teamData['team-1'].customersSold = ['c1', 'c2']; // 5 - 2 = 3 unsold

    const nextState = advanceOnePhase(state);
    expect(nextState.currentRound).toBe(2);
    expect(nextState.currentPhase).toBe('planning');
    expect(nextState.advancedState?.carriedOverProducts?.['team-1']).toBe(3);
  });

  it('identifies blocking teams correctly', () => {
    const state = createMockGameState('planning', 1);
    // team-2 has no plan submitted
    const blocking = getBlockingTeams(state);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].teamId).toBe('team-2');
  });

  it('forces advance with $5 facilitator default plan for unsubmitted human teams', () => {
    const state = createMockGameState('planning', 1);
    // Add human team-3 with no plan
    state.teams.push({ id: 'team-3', name: 'Gamma', color: '#1e293b', isBot: false });

    const nextState = advanceOnePhase(state, new Date(), { force: true });
    expect(nextState.currentPhase).toBe('production');
    const gammaData = nextState.rounds[0].teamData['team-3'];
    expect(gammaData).toBeDefined();
    expect(gammaData.facilitatorDefault).toBe(true);
    expect(gammaData.price).toBe(5);
  });
});
