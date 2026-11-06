import { describe, it, expect } from 'vitest';
import { computeTurnOrder } from '@/lib/turnOrder';
import { resolvePlan } from '@/lib/referee/resolvers';
import { GameState, Team } from '@/types/game';
import { INITIAL_GAME_STATE } from '@/lib/initialGameState';
import { COMBINATIONS } from '@/data/combinations';

describe('Turn Order & Reopen Logic Verification', () => {
  const teams: Team[] = [
    { id: 'team-blue', name: 'Blue Team', color: '#3b82f6', isBot: true },
    { id: 'team-black', name: 'Black Team', color: '#1e293b', isBot: true },
    { id: 'team-green', name: 'Green Team', color: '#22c55e', isBot: false },
  ];

  it('correctly sets turn.index to the human player when bots have already completed research', () => {
    const baseState: GameState = {
      ...INITIAL_GAME_STATE,
      currentRound: 2,
      currentPhase: 'innovation',
      teams,
      rounds: [
        { roundNumber: 1, teamData: {} },
        {
          roundNumber: 2,
          teamData: {
            'team-blue': {
              teamId: 'team-blue',
              combination: 1,
              position: 1,
              price: 4,
              productsProduced: 5,
              researchIcons: 1,
              logisticsIcons: 1,
              improvementCards: 0,
              revenue: 0,
              totalMoney: 0,
              controlValue: 0,
              expansionLocations: [],
              technologiesResearched: [],
              salesByRegion: {},
              regionControlPoints: {},
            },
            'team-black': {
              teamId: 'team-black',
              combination: 2,
              position: 1,
              price: 5,
              productsProduced: 6,
              researchIcons: 1,
              logisticsIcons: 1,
              improvementCards: 0,
              revenue: 0,
              totalMoney: 0,
              controlValue: 0,
              expansionLocations: [],
              technologiesResearched: [],
              salesByRegion: {},
              regionControlPoints: {},
            },
            'team-green': {
              teamId: 'team-green',
              combination: 3,
              position: 1,
              price: 6,
              productsProduced: 8,
              researchIcons: 1,
              logisticsIcons: 1,
              improvementCards: 0,
              revenue: 0,
              totalMoney: 0,
              controlValue: 0,
              expansionLocations: [],
              technologiesResearched: [],
              salesByRegion: {},
              regionControlPoints: {},
            },
          },
        },
      ],
      // Blue and Black have already allocated their 1 icon; Green has NOT allocated
      researchAllocatedByRound: {
        2: {
          'team-blue': 1,
          'team-black': 1,
        },
      },
    };

    const turn = computeTurnOrder(baseState, 'innovation');
    expect(turn.order).toEqual(['team-blue', 'team-black', 'team-green']);
    // Since team-blue (index 0) and team-black (index 1) spent their icons, index points directly to team-green (index 2)!
    expect(turn.index).toBe(2);
    expect(turn.order[turn.index]).toBe('team-green');
  });

  it('sets turn.index to order.length when all teams have completed allocations', () => {
    const baseState: GameState = {
      ...INITIAL_GAME_STATE,
      currentRound: 2,
      currentPhase: 'innovation',
      teams,
      rounds: [
        { roundNumber: 1, teamData: {} },
        {
          roundNumber: 2,
          teamData: {
            'team-blue': { teamId: 'team-blue', combination: 1, position: 1, price: 4, productsProduced: 5, researchIcons: 1, logisticsIcons: 1, improvementCards: 0, revenue: 0, totalMoney: 0, controlValue: 0, expansionLocations: [], technologiesResearched: [], salesByRegion: {}, regionControlPoints: {} },
            'team-black': { teamId: 'team-black', combination: 2, position: 1, price: 5, productsProduced: 6, researchIcons: 1, logisticsIcons: 1, improvementCards: 0, revenue: 0, totalMoney: 0, controlValue: 0, expansionLocations: [], technologiesResearched: [], salesByRegion: {}, regionControlPoints: {} },
            'team-green': { teamId: 'team-green', combination: 3, position: 1, price: 6, productsProduced: 8, researchIcons: 1, logisticsIcons: 1, improvementCards: 0, revenue: 0, totalMoney: 0, controlValue: 0, expansionLocations: [], technologiesResearched: [], salesByRegion: {}, regionControlPoints: {} },
          },
        },
      ],
      researchAllocatedByRound: {
        2: {
          'team-blue': 1,
          'team-black': 1,
          'team-green': 1,
        },
      },
    };

    const turn = computeTurnOrder(baseState, 'innovation');
    expect(turn.index).toBe(3);
    expect(turn.index >= turn.order.length).toBe(true);
  });

  it('accepts plans where wildcard conversions were made and updates research/logistics icons from stats', () => {
    const baseState: GameState = {
      ...INITIAL_GAME_STATE,
      currentRound: 1,
      currentPhase: 'planning',
      teams,
      ruleAdjustments: {
        rules: {
          wildcard_tokens_system: {
            id: 'wildcard_tokens_system',
            enabled: true,
            type: 'custom',
            scope: 'all',
            value: 10,
          },
        },
      },
      advancedState: {
        wildcards: {
          'team-green': {
            teamId: 'team-green',
            totalTokens: 10,
            usedInRound: { 1: 2 },
            conversionsByRound: {
              1: {
                research: 1,
                logistics: 1,
              },
            },
          },
        },
      },
      rounds: [{ roundNumber: 1, teamData: {} }],
    };

    // Combination 1 Position 1 gives price 5-2=3, products 4, research 2, logistics 2
    // With 1 research wildcard + 1 logistics wildcard: research is 3, logistics is 3
    const res = resolvePlan(baseState, 1, 'team-green', {
      round: 1,
      teamId: 'team-green',
      combination: 1,
      position: 1,
      price: 3,
      productsProduced: 4,
      researchIcons: 2, // client submitted with base 2 before wildcard conversion was applied
      logisticsIcons: 2,
      improvementCards: 1,
      submittedAt: new Date().toISOString(),
    });

    if (!res.valid) {
      console.error('Plan resolution error:', res.error);
    }
    expect(res.valid).toBe(true);
    const savedData = res.nextState.rounds[0].teamData['team-green'];
    expect(savedData.researchIcons).toBe(3);
    expect(savedData.logisticsIcons).toBe(3);
  });
});
