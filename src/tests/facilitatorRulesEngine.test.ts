import { describe, test, expect } from 'vitest';
import { getDefaultRuleAdjustments, isRuleActiveForTeam, getRuleValueForTeam } from '../lib/defaultRules';
import { getTechnologyCostForTeam, canExpandToRegion, calculatePlanStats } from '../lib/rules';
import { GameState, RuleAdjustmentsState, calculateTeamTotalScore } from '../types/game';

describe('Facilitator Rules Engine Test Suite', () => {
  test('default rules initialization', () => {
    const rulesState = getDefaultRuleAdjustments();
    expect(rulesState.rules).toBeDefined();
    expect(rulesState.rules['min_product_price']).toBeDefined();
    expect(rulesState.rules['min_product_price'].enabled).toBe(true);
    expect(rulesState.rules['min_product_price'].globalValue).toBe(2);
    expect(rulesState.rules['steve_event_blocker']).toBeDefined();
    expect(rulesState.rules['wildcard_tokens_system']).toBeDefined();
    expect(rulesState.rules['directives_bonus_points']).toBeDefined();
  });

  test('global rule toggle and value retrieval', () => {
    const rulesState = getDefaultRuleAdjustments();

    // Toggle rule off globally
    rulesState.rules['min_product_price'].enabled = false;
    expect(isRuleActiveForTeam(rulesState, 'min_product_price', 'team_1')).toBe(false);

    // Toggle back on with updated requirement value
    rulesState.rules['min_product_price'].enabled = true;
    rulesState.rules['min_product_price'].globalValue = 4;
    expect(isRuleActiveForTeam(rulesState, 'min_product_price', 'team_1')).toBe(true);
    expect(getRuleValueForTeam(rulesState, 'min_product_price', 'team_1')).toBe(4);
  });

  test('team-specific rule override', () => {
    const rulesState = getDefaultRuleAdjustments();

    // Set team_1 override: disabled rule
    rulesState.rules['tech_patent_discount'].teamOverrides = {
      'team_1': { enabled: false, value: 0 },
      'team_2': { enabled: true, value: 3 },
    };

    // team_1 uses override (disabled)
    expect(isRuleActiveForTeam(rulesState, 'tech_patent_discount', 'team_1')).toBe(false);
    expect(getRuleValueForTeam(rulesState, 'tech_patent_discount', 'team_1')).toBe(0);

    // team_2 uses override (enabled, value 3)
    expect(isRuleActiveForTeam(rulesState, 'tech_patent_discount', 'team_2')).toBe(true);
    expect(getRuleValueForTeam(rulesState, 'tech_patent_discount', 'team_2')).toBe(3);

    // team_3 has no override -> uses global default (enabled, value 1)
    expect(isRuleActiveForTeam(rulesState, 'tech_patent_discount', 'team_3')).toBe(true);
    expect(getRuleValueForTeam(rulesState, 'tech_patent_discount', 'team_3')).toBe(1);
  });

  test('rule enforcement in calculation functions', () => {
    const rulesState = getDefaultRuleAdjustments();

    const mockGameState: Partial<GameState> = {
      ruleAdjustments: rulesState,
      technologies: {
        'Wifi': { name: 'Wifi', researchPoints: 0, maxPoints: 3, researchCost: 3, teamProgress: {} },
        'Gaming': { name: 'Gaming', researchPoints: 0, maxPoints: 4, researchCost: 4, teamProgress: {} },
      },
      patents: {
        'Wifi': 'team_1', // team_1 holds patent
      },
      regionLogistics: {
        'USA': { name: 'USA', logisticsCost: 2, maxTeams: 3, connectedRegions: [], teamsPresent: ['team_1', 'team_2'], teamProgress: {} },
        'Canada': { name: 'Canada', logisticsCost: 2, maxTeams: 3, connectedRegions: ['USA'], teamsPresent: [], teamProgress: {} }
      },
      teamLogisticsProgress: {
        'team_1': { teamId: 'team_1', regionsWithPresence: ['USA'], regionInvestments: {} }
      },
      teamResearchProgress: {
        'team_1': { teamId: 'team_1', technologyInvestments: {}, completedTechnologies: ['Gaming', 'Battery'] }
      },
      improvementCards: []
    };

    // team_2 researching patented Wifi with default rules (discount = 1 off base 3 -> cost 2)
    let costTeam2 = getTechnologyCostForTeam(mockGameState as GameState, 'team_2', 'Wifi');
    expect(costTeam2).toBe(2);

    // Gaming tech perk (-1 tech cost) applies for team_1
    const costGamingTeam1 = getTechnologyCostForTeam(mockGameState as GameState, 'team_1', 'Wifi');
    expect(costGamingTeam1).toBe(2); // base 3 - 1 gaming perk = 2

    // Battery tech perk (+1 logistics icon on price increase)
    const comboData = [{ combination: 1, position: 1, price: 1, products: 2, improve: 0, research: 0, logistics: 1 }];
    const planStats = calculatePlanStats(mockGameState as GameState, 'team_1', 1, 1, {}, comboData);
    expect(planStats.logisticsPoints).toBe(2); // 1 base + 1 battery perk

    // Steve region blocker test
    mockGameState.advancedState = {
      steve: { activeRegion: 'Canada' }
    };
    const canExpandCanada = canExpandToRegion(mockGameState as GameState, 'team_1', 'Canada');
    expect(canExpandCanada).toBe(false); // Blocked by Steve!
  });

  test('score calculation with Wildcards and Directives', () => {
    const rulesState = getDefaultRuleAdjustments();
    const mockGameState: Partial<GameState> = {
      gameId: 'g1',
      teams: [{ id: 'team_1', name: 'Green Team', color: '#22c55e' }],
      currentRound: 5,
      gameEnded: true,
      rounds: [],
      ruleAdjustments: rulesState,
      advancedState: {
        wildcards: {
          'team_1': { teamId: 'team_1', totalTokens: 10, usedInRound: { 1: 2 } } // 8 leftover = 8 VPs
        },
        directives: [
          { id: 'directive_2', teamId: 'team_1', roundNumber: 1, points: 12, claimedAt: '' }
        ]
      }
    };

    const score = calculateTeamTotalScore('team_1', 5, mockGameState as GameState);
    expect(score.wildcardBonus).toBe(8);
    expect(score.directiveBonus).toBe(12);
    expect(score.totalScore).toBe(3 + 8 + 12); // Initial green score 3 + 8 + 12 = 23
  });

  test('calculatePlanStats includes wildcard token conversions for products, research, logistics, and improvement', () => {
    const rulesState = getDefaultRuleAdjustments();
    const comboData = [{ combination: 1, position: 1, price: 0, products: 3, research: 2, logistics: 2, improve: 1 }];

    const mockGameState: Partial<GameState> = {
      gameId: 'g1',
      currentRound: 1,
      teams: [{ id: 'team_1', name: 'Green Team', color: '#22c55e' }],
      improvementCards: [],
      ruleAdjustments: rulesState,
      advancedState: {
        wildcards: {
          'team_1': {
            teamId: 'team_1',
            totalTokens: 10,
            usedInRound: { 1: 3 },
            conversionsByRound: {
              1: { product: 2, research: 1, logistics: 0, improvement: 1 }
            }
          }
        }
      }
    };

    const stats = calculatePlanStats(mockGameState as GameState, 'team_1', 1, 1, {}, comboData);
    expect(stats.productsAvailable).toBe(3 + 2); // 3 base + 2 wildcard tokens = 5
    expect(stats.researchPoints).toBe(2 + 1); // 2 base + 1 wildcard token = 3
    expect(stats.improvementPoints).toBe(1 + 1); // 1 base + 1 wildcard token = 2
  });

  test('calculatePlanStats includes +5 products when GPS technology is completed', () => {
    const rulesState = getDefaultRuleAdjustments();
    const comboData = [{ combination: 1, position: 1, price: 0, products: 3, research: 2, logistics: 2, improve: 1 }];

    const mockGameState: Partial<GameState> = {
      gameId: 'g1',
      currentRound: 1,
      teams: [{ id: 'team_1', name: 'Green Team', color: '#22c55e' }],
      improvementCards: [],
      ruleAdjustments: rulesState,
      teamResearchProgress: {
        'team_1': {
          teamId: 'team_1',
          technologyInvestments: { 'GPS': 3 },
          completedTechnologies: ['GPS']
        }
      }
    };

    const stats = calculatePlanStats(mockGameState as GameState, 'team_1', 1, 1, {}, comboData);
    expect(stats.productsAvailable).toBe(3 + 5); // 3 base + 5 GPS bonus = 8

    // Once gpsBonusClaimed is true, +5 bonus is NOT granted again
    mockGameState.advancedState = {
      gpsBonusClaimed: { 'team_1': true }
    };
    const statsClaimed = calculatePlanStats(mockGameState as GameState, 'team_1', 1, 1, {}, comboData);
    expect(statsClaimed.productsAvailable).toBe(3); // 3 base, bonus already claimed!
  });

  test('calculatePlanStats includes carried over products when Wifi technology is completed', () => {
    const rulesState = getDefaultRuleAdjustments();
    const comboData = [{ combination: 1, position: 1, price: 0, products: 3, research: 2, logistics: 2, improve: 1 }];

    const mockGameState: Partial<GameState> = {
      gameId: 'g1',
      currentRound: 2,
      teams: [{ id: 'team_1', name: 'Green Team', color: '#22c55e' }],
      improvementCards: [],
      ruleAdjustments: rulesState,
      teamResearchProgress: {
        'team_1': {
          teamId: 'team_1',
          technologyInvestments: { 'Wifi': 3 },
          completedTechnologies: ['Wifi']
        }
      },
      advancedState: {
        carriedOverProducts: { 'team_1': 4 }
      }
    };

    const stats = calculatePlanStats(mockGameState as GameState, 'team_1', 1, 1, {}, comboData);
    expect(stats.productsAvailable).toBe(3 + 4); // 3 base + 4 carried-over products = 7
  });

  test('scoring gates return 0 VPs when wildcard or directive rules are disabled', () => {
    const rulesState = getDefaultRuleAdjustments();
    rulesState.rules['wildcard_tokens_system'].enabled = false;
    rulesState.rules['directives_bonus_points'].enabled = false;

    const mockGameState: Partial<GameState> = {
      gameId: 'g1',
      teams: [{ id: 'team_1', name: 'Green Team', color: '#22c55e' }],
      currentRound: 5,
      gameEnded: true,
      rounds: [],
      ruleAdjustments: rulesState,
      advancedState: {
        wildcards: {
          'team_1': { teamId: 'team_1', totalTokens: 10, usedInRound: { 1: 2 } }
        },
        directives: [
          { id: 'directive_2', teamId: 'team_1', roundNumber: 1, points: 12, claimedAt: '' }
        ]
      }
    };

    const score = calculateTeamTotalScore('team_1', 5, mockGameState as GameState);
    expect(score.wildcardBonus).toBe(0); // Gated OFF -> 0 VPs
    expect(score.directiveBonus).toBe(0); // Gated OFF -> 0 VPs
    expect(score.totalScore).toBe(3); // Only initial green score 3
  });
});
