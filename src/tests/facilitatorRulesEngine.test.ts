import { describe, test, expect } from 'vitest';
import { getDefaultRuleAdjustments, isRuleActiveForTeam, getRuleValueForTeam } from '../lib/defaultRules';
import {
  getTechnologyCostForTeam,
  canExpandToRegion,
  calculatePlanStats,
  getLogisticsCostForTeam,
  getCompletedOffices,
  isTeamBuildingOffice,
  getRegionOccupancy,
  isSteveBlocking,
} from '../lib/rules';
import { GameState, Team, calculateTeamTotalScore } from '../types/game';
import { getControlPointsForRegion } from '../data/control';

// 9.0 Shared Harness
function makeGameState(overrides?: Partial<GameState>): GameState {
  const defaultRules = getDefaultRuleAdjustments();
  const baseState: GameState = {
    gameId: 'test_game',
    currentRound: 1,
    currentPhase: 'planning',
    gameEnded: false,
    teams: [
      { id: 'team_1', name: 'Green Team', color: '#22c55e' },
      { id: 'team_2', name: 'Blue Team', color: '#3b82f6' },
      { id: 'team_3', name: 'Red Team', color: '#ef4444' },
    ],
    ruleAdjustments: defaultRules,
    rounds: [],
    patents: {},
    technologies: {
      'GPS': { name: 'GPS', researchPoints: 0, maxPoints: 3, researchCost: 3, teamProgress: {} },
      'Wifi': { name: 'Wifi', researchPoints: 0, maxPoints: 3, researchCost: 3, teamProgress: {} },
      'Battery': { name: 'Battery', researchPoints: 0, maxPoints: 4, researchCost: 4, teamProgress: {} },
      'Gaming': { name: 'Gaming', researchPoints: 0, maxPoints: 4, researchCost: 4, teamProgress: {} },
    },
    teamResearchProgress: {
      'team_1': { teamId: 'team_1', technologyInvestments: {}, completedTechnologies: [] },
      'team_2': { teamId: 'team_2', technologyInvestments: {}, completedTechnologies: [] },
      'team_3': { teamId: 'team_3', technologyInvestments: {}, completedTechnologies: [] },
    },
    regionLogistics: {
      'USA': {
        name: 'USA',
        logisticsCost: 4,
        maxTeams: 5,
        connectedRegions: ['North Africa', 'Canada'],
        teamsPresent: [],
        teamProgress: {},
        officeCounts: {},
      },
      'North Africa': {
        name: 'North Africa',
        logisticsCost: 3,
        maxTeams: 4,
        connectedRegions: ['USA'],
        teamsPresent: [],
        teamProgress: {},
        officeCounts: {},
      },
      'Canada': {
        name: 'Canada',
        logisticsCost: 2,
        maxTeams: 3,
        connectedRegions: ['USA'],
        teamsPresent: [],
        teamProgress: {},
        officeCounts: {},
      },
    },
    teamLogisticsProgress: {
      'team_1': { teamId: 'team_1', regionsWithPresence: ['USA'], regionInvestments: {} },
      'team_2': { teamId: 'team_2', regionsWithPresence: ['USA'], regionInvestments: {} },
      'team_3': { teamId: 'team_3', regionsWithPresence: ['USA'], regionInvestments: {} },
    },
    improvementCards: [],
    logisticsAllocatedByRound: {},
    researchAllocatedByRound: {},
    advancedState: {
      wildcards: {},
      directives: [],
      steve: { activeRegion: null },
      carriedOverProducts: {},
      gpsBonusClaimed: {},
    },
    ...(overrides || {}),
  };
  return baseState;
}

function enableRule(state: GameState, ruleId: string) {
  state.ruleAdjustments.rules[ruleId].enabled = true;
}

function disableRule(state: GameState, ruleId: string) {
  state.ruleAdjustments.rules[ruleId].enabled = false;
}

function completeTech(state: GameState, teamId: string, tech: string) {
  const current = state.teamResearchProgress[teamId]?.completedTechnologies || [];
  if (!current.includes(tech)) {
    state.teamResearchProgress[teamId] = {
      ...(state.teamResearchProgress[teamId] || { teamId, technologyInvestments: {}, completedTechnologies: [] }),
      completedTechnologies: [...current, tech],
    };
  }
}

describe('Facilitator Rules Engine Test Suite', () => {

  test('default rules initialization', () => {
    const rulesState = getDefaultRuleAdjustments();
    expect(rulesState.rules['min_product_price'].enabled).toBe(true);
    expect(rulesState.rules['steve_event_blocker'].enabled).toBe(false);
    expect(rulesState.rules['wildcard_tokens_system'].enabled).toBe(false);
    expect(rulesState.rules['directives_bonus_points'].enabled).toBe(false);
    expect(rulesState.rules['tech_permanent_benefits'].enabled).toBe(false);
    expect(rulesState.rules['multiple_offices_per_region'].enabled).toBe(false);
  });

  describe('9.1 Rule 1 — Permanent Tech Benefits (tech_permanent_benefits)', () => {
    const comboData = [{ combination: 1, position: 1, price: 1, products: 3, research: 2, logistics: 2, improve: 1 }];

    test('GPS once-per-game bonus (+5) & stamp behavior', () => {
      const state = makeGameState();
      enableRule(state, 'tech_permanent_benefits');
      completeTech(state, 'team_1', 'GPS');

      // Rule ON + GPS complete + gpsBonusClaimed unset -> +5 products (3 base + 5 = 8)
      const stats = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(stats.productsAvailable).toBe(8);

      // Stamp claimed -> +5 bonus is no longer granted
      state.advancedState!.gpsBonusClaimed!['team_1'] = true;
      const statsClaimed = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(statsClaimed.productsAvailable).toBe(3);

      // Rule OFF -> no +5 even if unclaimed & GPS complete
      disableRule(state, 'tech_permanent_benefits');
      delete state.advancedState!.gpsBonusClaimed!['team_1'];
      const statsRuleOff = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(statsRuleOff.productsAvailable).toBe(3);
    });

    test('Wifi carried over products', () => {
      const state = makeGameState();
      enableRule(state, 'tech_permanent_benefits');
      completeTech(state, 'team_1', 'Wifi');
      state.advancedState!.carriedOverProducts!['team_1'] = 4;

      // Rule ON + Wifi complete -> products include +4 carried over (3 + 4 = 7)
      const stats = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(stats.productsAvailable).toBe(7);

      // Rule OFF -> carried over bonus ignored
      disableRule(state, 'tech_permanent_benefits');
      const statsOff = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(statsOff.productsAvailable).toBe(3);
    });

    test('Battery logistics icon bonus', () => {
      const state = makeGameState();
      enableRule(state, 'tech_permanent_benefits');
      completeTech(state, 'team_1', 'Battery');

      // Price > 5 (price: 1 -> raw price 5 + 1 = 6 > 5) -> +1 logistics icon (2 base + 1 = 3)
      const highPriceCombo = [{ combination: 1, position: 1, price: 1, products: 3, research: 2, logistics: 2, improve: 1 }];
      const statsHigh = calculatePlanStats(state, 'team_1', 1, 1, {}, highPriceCombo);
      expect(statsHigh.logisticsPoints).toBe(3);

      // Price <= 5 (price: 0 -> raw price 5 + 0 = 5 <= 5) -> no bonus (2 base)
      const lowPriceCombo = [{ combination: 1, position: 1, price: 0, products: 3, research: 2, logistics: 2, improve: 1 }];
      const statsLow = calculatePlanStats(state, 'team_1', 1, 1, {}, lowPriceCombo);
      expect(statsLow.logisticsPoints).toBe(2);

      // Rule OFF -> no bonus regardless of price
      disableRule(state, 'tech_permanent_benefits');
      const statsOff = calculatePlanStats(state, 'team_1', 1, 1, {}, highPriceCombo);
      expect(statsOff.logisticsPoints).toBe(2);
    });

    test('Gaming research cost discount', () => {
      const state = makeGameState();
      enableRule(state, 'tech_permanent_benefits');
      completeTech(state, 'team_1', 'Gaming');

      // Rule ON + Gaming complete -> research cost discounted by 1 (Wifi base 3 - 1 = 2)
      const costOn = getTechnologyCostForTeam(state, 'team_1', 'Wifi');
      expect(costOn).toBe(2);

      // Rule OFF -> returns base cost 3
      disableRule(state, 'tech_permanent_benefits');
      const costOff = getTechnologyCostForTeam(state, 'team_1', 'Wifi');
      expect(costOff).toBe(3);
    });

    test('Toggle flip removes all 4 tech perks simultaneously', () => {
      const state = makeGameState();
      enableRule(state, 'tech_permanent_benefits');
      completeTech(state, 'team_1', 'GPS');
      completeTech(state, 'team_1', 'Wifi');
      completeTech(state, 'team_1', 'Battery');
      completeTech(state, 'team_1', 'Gaming');
      state.advancedState!.carriedOverProducts!['team_1'] = 2;

      // When ON -> GPS(+5) + Wifi(+2) = 10 products, Battery(+1) = 3 logistics, Gaming cost = 2
      let stats = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(stats.productsAvailable).toBe(3 + 5 + 2); // 10
      expect(stats.logisticsPoints).toBe(3);
      expect(getTechnologyCostForTeam(state, 'team_1', 'Wifi')).toBe(2);

      // Flip OFF -> immediately reverts to base values
      disableRule(state, 'tech_permanent_benefits');
      stats = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(stats.productsAvailable).toBe(3);
      expect(stats.logisticsPoints).toBe(2);
      expect(getTechnologyCostForTeam(state, 'team_1', 'Wifi')).toBe(3);
    });
  });

  describe('9.2 Rule 2 — Wildcard Tokens (wildcard_tokens_system)', () => {
    test('calculatePlanStats includes wildcard token conversions', () => {
      const state = makeGameState();
      enableRule(state, 'wildcard_tokens_system');
      const comboData = [{ combination: 1, position: 1, price: 0, products: 3, research: 2, logistics: 2, improve: 1 }];

      state.advancedState!.wildcards!['team_1'] = {
        teamId: 'team_1',
        totalTokens: 10,
        usedInRound: { 1: 3 },
        conversionsByRound: {
          1: { product: 2, research: 1, logistics: 0, improvement: 1 }
        }
      };

      const stats = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(stats.productsAvailable).toBe(3 + 2); // 3 base + 2 wildcard = 5
      expect(stats.researchPoints).toBe(2 + 1); // 2 base + 1 wildcard = 3
      expect(stats.improvementPoints).toBe(1 + 1); // 1 base + 1 wildcard = 2
    });

    test('end-game wildcard token scoring gate', () => {
      const state = makeGameState({ gameEnded: true, currentRound: 5 });
      enableRule(state, 'wildcard_tokens_system');

      state.advancedState!.wildcards!['team_1'] = {
        teamId: 'team_1',
        totalTokens: 10,
        usedInRound: { 1: 2 } // 8 remaining -> 8 VPs
      };

      const scoreOn = calculateTeamTotalScore('team_1', 5, state);
      expect(scoreOn.wildcardBonus).toBe(8);

      // Gated OFF -> 0 VPs
      disableRule(state, 'wildcard_tokens_system');
      const scoreOff = calculateTeamTotalScore('team_1', 5, state);
      expect(scoreOff.wildcardBonus).toBe(0);
    });
  });

  describe('9.3 Rule 3 — Multiple Offices & Occupancy (multiple_offices_per_region)', () => {
    test('DR-1 Cost curve: 1st office full cost, 2nd+ discounted cost', () => {
      const state = makeGameState();
      enableRule(state, 'multiple_offices_per_region');

      // North Africa baseCost = 3
      // Team with no office -> full cost 3
      expect(getLogisticsCostForTeam(state, 'team_1', 'North Africa')).toBe(3);

      // Team already present -> cost for 2nd office becomes 2 (3 - 1)
      state.regionLogistics['North Africa'].teamsPresent = ['team_1'];
      state.regionLogistics['North Africa'].officeCounts = { 'team_1': 1 };
      expect(getLogisticsCostForTeam(state, 'team_1', 'North Africa')).toBe(2);
    });

    test('DR-2 & DR-3 North Africa Scenario: occupancy includes in-progress while control counts completed only', () => {
      const state = makeGameState();
      enableRule(state, 'multiple_offices_per_region');

      // North Africa (maxTeams: 4, baseCost: 3)
      // Green (team_1): 3 completed offices (officeCounts = 3, teamProgress = 7 points: 3 + 2 + 2 = 7)
      // Blue (team_2): 1 invested out of 3 needed for 1st office (in-progress)
      const na = state.regionLogistics['North Africa'];
      na.teamsPresent = ['team_1'];
      na.officeCounts = { 'team_1': 3 };
      na.teamProgress = { 'team_1': 7, 'team_2': 1 };

      // 1. Occupancy = 3 (Green completed) + 1 (Blue in-progress) = 4
      expect(getCompletedOffices(na, 'team_1')).toBe(3);
      expect(getCompletedOffices(na, 'team_2')).toBe(0);
      expect(isTeamBuildingOffice(na, 'team_2', 3)).toBe(true);
      expect(getRegionOccupancy(state, 'North Africa')).toBe(4);

      // 2. Region is full (4 >= 4)
      expect(getRegionOccupancy(state, 'North Africa') >= na.maxTeams).toBe(true);

      // 3. Expansion for Red (team_3) is BLOCKED because region is full
      expect(canExpandToRegion(state, 'team_3', 'North Africa')).toBe(false);

      // 4. Blue (mid-building team) CAN expand/continue investing in North Africa
      expect(canExpandToRegion(state, 'team_2', 'North Africa')).toBe(true);

      // 5. Control points scaling uses COMPLETED offices only (3 completed -> control3 = 5 points, NOT control4 = 6)
      const completedTotal = Object.values(na.officeCounts || {}).reduce((a, b) => a + Number(b), 0);
      expect(completedTotal).toBe(3);
      expect(getControlPointsForRegion('North Africa', completedTotal, 'first')).toBe(5);

      // 6. When Blue completes its 1st office (invests 3 points total):
      na.teamsPresent = ['team_1', 'team_2'];
      na.officeCounts = { 'team_1': 3, 'team_2': 1 };
      na.teamProgress = { 'team_1': 7, 'team_2': 3 };

      const newCompletedTotal = Object.values(na.officeCounts).reduce((a, b) => a + Number(b), 0);
      expect(newCompletedTotal).toBe(4);
      expect(getControlPointsForRegion('North Africa', newCompletedTotal, 'first')).toBe(6);
    });

    test('DR-2 Reserve-on-start applies even when multiple_offices_per_region rule is OFF', () => {
      const state = makeGameState();
      disableRule(state, 'multiple_offices_per_region'); // Rule OFF!

      // Canada (maxTeams: 3, baseCost: 2)
      // Green (team_1) holds 2 completed offices (consumed = 2 + 1 = 3 points). Blue (team_2) has 1 point invested (in-progress).
      const can = state.regionLogistics['Canada'];
      can.teamsPresent = ['team_1'];
      can.officeCounts = { 'team_1': 2 };
      can.teamProgress = { 'team_1': 3, 'team_2': 1 };

      // Occupancy = 2 (Green completed) + 1 (Blue building) = 3 -> Canada is FULL
      expect(getRegionOccupancy(state, 'Canada')).toBe(3);
      expect(canExpandToRegion(state, 'team_3', 'Canada')).toBe(false); // Red blocked!
    });
  });

  describe('9.4 Rule 4 — Directives (directives_bonus_points)', () => {
    test('directives scoring gate and custom rule value', () => {
      const state = makeGameState({ gameEnded: true, currentRound: 5 });
      enableRule(state, 'directives_bonus_points');

      state.advancedState!.directives = [
        { id: 'd1', teamId: 'team_1', roundNumber: 1, points: 0, claimedAt: '' },
        { id: 'd2', teamId: 'team_1', roundNumber: 2, points: 0, claimedAt: '' }
      ];

      // Rule ON + global default value 12 -> 2 x 12 = 24 VPs
      const scoreOn = calculateTeamTotalScore('team_1', 5, state);
      expect(scoreOn.directiveBonus).toBe(24);

      // Custom rule value = 15 -> 2 x 15 = 30 VPs
      state.ruleAdjustments.rules['directives_bonus_points'].globalValue = 15;
      const scoreCustom = calculateTeamTotalScore('team_1', 5, state);
      expect(scoreCustom.directiveBonus).toBe(30);

      // Rule OFF -> 0 VPs
      disableRule(state, 'directives_bonus_points');
      const scoreOff = calculateTeamTotalScore('team_1', 5, state);
      expect(scoreOff.directiveBonus).toBe(0);
    });
  });

  describe('9.5 Rule 5 — Steve Event Blocker (steve_event_blocker)', () => {
    test('isSteveBlocking gating and region blocking', () => {
      const state = makeGameState();
      enableRule(state, 'steve_event_blocker');
      state.advancedState!.steve = { activeRegion: 'Canada', roundIntroduced: 3 };

      // Steve active in Canada -> Canada blocked, USA unblocked
      expect(isSteveBlocking(state, 'Canada', 'team_1')).toBe(true);
      expect(isSteveBlocking(state, 'USA', 'team_1')).toBe(false);

      expect(canExpandToRegion(state, 'team_1', 'Canada')).toBe(false);
      expect(canExpandToRegion(state, 'team_1', 'USA')).toBe(true);

      // Rule OFF -> Steve blocker inactive everywhere
      disableRule(state, 'steve_event_blocker');
      expect(isSteveBlocking(state, 'Canada', 'team_1')).toBe(false);
      expect(canExpandToRegion(state, 'team_1', 'Canada')).toBe(true);
    });
  });

  describe('9.6 Cross-Cutting — Toggle Coherence & Regression', () => {
    test('Parameterized test: All 5 advanced rules produce zero effects when disabled', () => {
      const advancedRuleIds = [
        'tech_permanent_benefits',
        'wildcard_tokens_system',
        'multiple_offices_per_region',
        'directives_bonus_points',
        'steve_event_blocker',
      ];

      const state = makeGameState({ gameEnded: true, currentRound: 5 });
      advancedRuleIds.forEach(id => disableRule(state, id));

      completeTech(state, 'team_1', 'GPS');
      completeTech(state, 'team_1', 'Wifi');
      completeTech(state, 'team_1', 'Battery');
      completeTech(state, 'team_1', 'Gaming');
      state.advancedState!.carriedOverProducts!['team_1'] = 5;
      state.advancedState!.wildcards!['team_1'] = { teamId: 'team_1', totalTokens: 10, usedInRound: {} };
      state.advancedState!.directives = [{ id: 'd1', teamId: 'team_1', roundNumber: 1, points: 12, claimedAt: '' }];
      state.advancedState!.steve = { activeRegion: 'USA' };

      const comboData = [{ combination: 1, position: 1, price: 1, products: 3, research: 2, logistics: 2, improve: 1 }];
      const stats = calculatePlanStats(state, 'team_1', 1, 1, {}, comboData);
      expect(stats.productsAvailable).toBe(3); // No GPS (+5) or Wifi (+5)
      expect(stats.logisticsPoints).toBe(2); // No Battery (+1)
      expect(getTechnologyCostForTeam(state, 'team_1', 'Wifi')).toBe(3); // No Gaming (-1)

      const score = calculateTeamTotalScore('team_1', 5, state);
      expect(score.wildcardBonus).toBe(0);
      expect(score.directiveBonus).toBe(0);
      expect(isSteveBlocking(state, 'USA', 'team_1')).toBe(false);
    });

    test('Standard game regression snapshot (All advanced rules OFF)', () => {
      const state = makeGameState({
        currentRound: 2,
        gameEnded: true,
        rounds: [
          {
            roundNumber: 1,
            teamData: {
              'team_1': { price: 5, revenue: 20, customersSold: ['c1', 'c2'] },
              'team_2': { price: 6, revenue: 18, customersSold: ['c3'] },
            }
          },
          {
            roundNumber: 2,
            teamData: {
              'team_1': { price: 4, revenue: 25, customersSold: ['c4', 'c5'] },
              'team_2': { price: 5, revenue: 22, customersSold: ['c6'] },
            }
          }
        ]
      });

      const scoreTeam1 = calculateTeamTotalScore('team_1', 2, state);
      const scoreTeam2 = calculateTeamTotalScore('team_2', 2, state);

      // Initial Green 3 + Round 1 Rev 20 + Round 2 Rev 25 = 48
      expect(scoreTeam1.totalScore).toBe(3 + 20 + 25);
      // Initial Blue 4 + Round 1 Rev 18 + Round 2 Rev 22 = 44
      expect(scoreTeam2.totalScore).toBe(4 + 18 + 22);
    });
  });
});
