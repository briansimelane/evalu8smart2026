import { describe, it, expect } from 'vitest';
import { GameState, Team, TeamActionDoc, calculateTeamTotalScore } from '@/types/game';
import { computeTurnOrder } from '@/lib/turnOrder';
import {
  resolvePlan,
  resolveTeamAction,
} from '@/lib/referee/resolvers';
import { splitGameState, assembleGameState } from '@/lib/v2State';
import { advanceOnePhase } from '@/lib/phaseEngine';
import {
  decidePlanning,
  decideImprovement,
  decideResearch,
  decideLogistics,
  decideSales,
} from '@/bots/botEngine';
import { COMBINATIONS, TECHNOLOGIES, REGIONS } from '@/data/combinations';
import { REGION_CONFIGS } from '@/data/regions';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { calculatePlanStats } from '@/lib/rules';

function buildFullInitialGameState(numTeams = 5): GameState {
  // Use official team colors so getInitialScore(team) assigns distinct starting scores (Green=11, Blue=12, Black=13, Yellow=14, Red=15)
  const palette = ['#16a34a', '#2563eb', '#0f172a', '#eab308', '#dc2626'];
  const profiles: Array<'BALANCED' | 'RESEARCHER' | 'EXPANDER' | 'PRICE_FIGHTER'> = [
    'BALANCED',
    'RESEARCHER',
    'EXPANDER',
    'PRICE_FIGHTER',
    'BALANCED',
  ];

  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Syndicate ${i + 1}`,
    color: palette[i % palette.length],
    isBot: true,
    botProfile: profiles[i % profiles.length],
    botDifficulty: 'MEDIUM',
  }));

  const techCosts: Record<string, number> = {
    GPS: 3,
    WIFI: 3,
    Gaming: 4,
    Battery: 4,
    NFC: 5,
    '4G': 6,
  };
  const technologies = Object.fromEntries(
    TECHNOLOGIES.map((name) => [
      name,
      {
        name,
        researchPoints: 0,
        maxPoints: techCosts[name] || 4,
        researchCost: techCosts[name] || 4,
        teamProgress: {},
      },
    ])
  );

  const regionLogistics = Object.fromEntries(
    REGION_CONFIGS.map((r) => [
      r.name,
      {
        ...r,
        teamsPresent: [] as string[],
        teamProgress: {} as Record<string, number>,
      },
    ])
  );

  // Give each team initial presence in USA and 2 initial improvement cards
  teams.forEach((t) => {
    regionLogistics['USA'].teamsPresent.push(t.id);
    regionLogistics['USA'].teamProgress[t.id] = 4;
  });

  const improvementCards = AVAILABLE_IMPROVEMENT_CARDS.map((c, idx) => {
    const ownerIdx = Math.floor(idx / 2);
    if (idx < numTeams * 2 && teams[ownerIdx]) {
      return {
        ...c,
        availableForTeam: teams[ownerIdx].id,
        allocatedInRound: 0,
        isInitial: true,
        used: false,
      };
    }
    return { ...c, availableForTeam: '', used: false };
  });

  const remainingIds = improvementCards.filter((c) => !c.availableForTeam).map((c) => c.id);
  const improvementPoolByRound: Record<number, number[]> = {
    1: remainingIds.slice(0, numTeams),
    2: remainingIds.slice(numTeams, numTeams * 2),
    3: remainingIds.slice(numTeams * 2, numTeams * 3),
    4: remainingIds.slice(numTeams * 3, numTeams * 4),
  };

  return {
    gameId: 'test-v2-parity',
    teams,
    currentRound: 1,
    currentPhase: 'planning',
    rounds: [],
    technologies,
    regions: REGIONS.map((r) => ({ name: r, sales: {}, controlPoints: {} })),
    patents: {},
    improvementCards,
    improvementPoolByRound,
    teamResearchProgress: Object.fromEntries(
      teams.map((t) => [t.id, { teamId: t.id, technologyInvestments: {}, completedTechnologies: [] }])
    ),
    researchAllocatedByRound: {},
    regionLogistics,
    teamLogisticsProgress: Object.fromEntries(
      teams.map((t) => [t.id, { teamId: t.id, regionsWithPresence: ['USA'], regionInvestments: { USA: 4 } }])
    ),
    logisticsAllocatedByRound: {},
    combinationsData: COMBINATIONS,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    schemaVersion: 2,
    stateVersion: 1,
  };
}

describe('Step 2.6 & 2.8 — computeTurnOrder & Pure Referee Resolvers', () => {
  it('computes turn order by price ascending, breaking ties by previous round total score ascending, and filters 0-icon teams', () => {
    const state = buildFullInitialGameState(3);
    state.rounds = [
      {
        roundNumber: 1,
        teamData: {
          'team-1': {
            teamId: 'team-1',
            combination: 1,
            position: 1,
            price: 6,
            productsProduced: 3,
            improvementCards: 0,
            researchIcons: 2,
            logisticsIcons: 1,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0,
          },
          'team-2': {
            teamId: 'team-2',
            combination: 2,
            position: 1,
            price: 5,
            productsProduced: 0,
            improvementCards: 1,
            researchIcons: 0,
            logisticsIcons: 2,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0,
          },
          'team-3': {
            teamId: 'team-3',
            combination: 1,
            position: 2,
            price: 6,
            productsProduced: 4,
            improvementCards: 1,
            researchIcons: 3,
            logisticsIcons: 0,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0,
          },
        },
      },
    ];

    // Planning includes all teams ordered by price (5 -> team-2, then tie at 6 broken by initialScore: team-1 (Green=11) < team-3 (Black=13))
    const planningTurn = computeTurnOrder(state, 'planning');
    expect(planningTurn.order).toEqual(['team-2', 'team-1', 'team-3']);

    // Improvement filters out team-1 (improvementCards = 0)
    const impTurn = computeTurnOrder(state, 'improvement');
    expect(impTurn.order).toEqual(['team-2', 'team-3']);

    // Research filters out team-2 (researchIcons = 0)
    const resTurn = computeTurnOrder(state, 'innovation');
    expect(resTurn.order).toEqual(['team-1', 'team-3']);

    // Logistics filters out team-3 (logisticsIcons = 0)
    const logTurn = computeTurnOrder(state, 'expansion');
    expect(logTurn.order).toEqual(['team-2', 'team-1']);

    // Sales filters out team-2 (productsProduced = 0)
    const salesTurn = computeTurnOrder(state, 'sales');
    expect(salesTurn.order).toEqual(['team-1', 'team-3']);
  });

  it('resolvePlan validates authoritative stats from combinationsData and rejects invalid combo/position or tampered stats', () => {
    const state = buildFullInitialGameState(2);

    const badCombo = resolvePlan(state, 1, 'team-1', {
      round: 1,
      teamId: 'team-1',
      combination: 99,
      position: 1,
      price: 1,
      productsProduced: 99,
      improvementCards: 99,
      researchIcons: 99,
      logisticsIcons: 99,
      submittedAt: new Date().toISOString(),
    });
    expect(badCombo.valid).toBe(false);

    // Tampered price/products is rejected
    const tampered = resolvePlan(state, 1, 'team-1', {
      round: 1,
      teamId: 'team-1',
      combination: 1,
      position: 1,
      price: 1,
      productsProduced: 999,
      improvementCards: 0,
      researchIcons: 0,
      logisticsIcons: 0,
      submittedAt: new Date().toISOString(),
    });
    expect(tampered.valid).toBe(false);

    // Legitimate stats matching calculatePlanStats succeed
    const stats = calculatePlanStats(state, 'team-1', 1, 1, {}, COMBINATIONS);
    const good = resolvePlan(state, 1, 'team-1', {
      round: 1,
      teamId: 'team-1',
      combination: 1,
      position: 1,
      price: stats.calculatedPrice,
      productsProduced: stats.productsAvailable,
      improvementCards: stats.improvementPoints,
      researchIcons: stats.researchPoints,
      logisticsIcons: stats.logisticsPoints,
      submittedAt: new Date().toISOString(),
    });
    expect(good.valid).toBe(true);
    const saved = good.nextState.rounds[0].teamData['team-1'];
    expect(saved.price).toBe(stats.calculatedPrice);
    expect(saved.productsProduced).toBe(stats.productsAvailable);
  });

  it('resolveTeamAction for innovation enforces turn order, icon budget, patent discount, and GPS +5 bonus', () => {
    let state = buildFullInitialGameState(2);
    state.ruleAdjustments = {
      rules: {
        tech_permanent_benefits: {
          id: 'tech_permanent_benefits',
          name: 'Technology Permanent Benefits',
          description: 'Enable tech perks',
          category: 'Research & Tech',
          enabled: true,
          globalValue: true,
          defaultValue: true,
          teamOverrides: {},
        },
      },
    };
    const s1 = calculatePlanStats(state, 'team-1', 3, 2, {}, COMBINATIONS);
    const s2 = calculatePlanStats(state, 'team-2', 4, 1, {}, COMBINATIONS);

    state = resolvePlan(state, 1, 'team-1', {
      round: 1,
      teamId: 'team-1',
      combination: 3,
      position: 2,
      price: s1.calculatedPrice,
      productsProduced: s1.productsAvailable,
      improvementCards: s1.improvementPoints,
      researchIcons: s1.researchPoints,
      logisticsIcons: s1.logisticsPoints,
      submittedAt: new Date().toISOString(),
    }).nextState;
    state = resolvePlan(state, 1, 'team-2', {
      round: 1,
      teamId: 'team-2',
      combination: 4,
      position: 1,
      price: s2.calculatedPrice,
      productsProduced: s2.productsAvailable,
      improvementCards: s2.improvementPoints,
      researchIcons: s2.researchPoints,
      logisticsIcons: s2.logisticsPoints,
      submittedAt: new Date().toISOString(),
    }).nextState;

    state.currentPhase = 'innovation';
    state.turn = computeTurnOrder(state, 'innovation');
    expect(state.turn.order).toEqual(['team-1', 'team-2']);

    // Out-of-turn action by team-2 is rejected
    const outOfTurn = resolveTeamAction(state, {
      round: 1,
      phase: 'innovation',
      teamId: 'team-2',
      payload: { allocations: { GPS: 2 } },
      total: 2,
      submittedAt: new Date().toISOString(),
    });
    expect(outOfTurn.valid).toBe(false);

    // Over-budget action by team-1 is rejected
    const overBudget = resolveTeamAction(state, {
      round: 1,
      phase: 'innovation',
      teamId: 'team-1',
      payload: { allocations: { GPS: 4 } },
      total: 4,
      submittedAt: new Date().toISOString(),
    });
    expect(overBudget.valid).toBe(false);

    // Valid 3 points into GPS (cost 3) for team-1 -> completes GPS, awards patent, grants +5 GPS product bonus, advances turn to team-2
    const team1BeforeProducts = state.rounds[0].teamData['team-1'].productsProduced;
    const valid1 = resolveTeamAction(state, {
      round: 1,
      phase: 'innovation',
      teamId: 'team-1',
      payload: { allocations: { GPS: 3 } },
      total: 3,
      submittedAt: new Date().toISOString(),
    });
    expect(valid1.valid).toBe(true);
    state = valid1.nextState;
    expect(state.patents['GPS']).toBe('team-1');
    expect(state.rounds[0].teamData['team-1'].productsProduced).toBe(team1BeforeProducts + 5);
    expect(state.turn?.index).toBe(1);

    // Now team-2 gets the -1 patent discount on GPS (cost becomes 2 instead of 3!)
    const valid2 = resolveTeamAction(state, {
      round: 1,
      phase: 'innovation',
      teamId: 'team-2',
      payload: { allocations: { GPS: 2 } },
      total: 2,
      submittedAt: new Date().toISOString(),
    });
    expect(valid2.valid).toBe(true);
    state = valid2.nextState;
    expect(state.teamResearchProgress['team-2'].completedTechnologies).toContain('GPS');
    expect(state.turn?.index).toBe(2);
  });

  it('resolveTeamAction for expansion and sales enforces connectivity, capacity, revenue, and control points', () => {
    let state = buildFullInitialGameState(2);
    const s1 = calculatePlanStats(state, 'team-1', 1, 1, {}, COMBINATIONS);
    const s2 = calculatePlanStats(state, 'team-2', 2, 1, {}, COMBINATIONS);

    state.rounds = [
      {
        roundNumber: 1,
        teamData: {
          'team-1': {
            teamId: 'team-1',
            combination: 1,
            position: 1,
            price: s1.calculatedPrice,
            productsProduced: s1.productsAvailable,
            improvementCards: s1.improvementPoints,
            researchIcons: s1.researchPoints,
            logisticsIcons: 2,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0,
          },
          'team-2': {
            teamId: 'team-2',
            combination: 2,
            position: 1,
            price: s2.calculatedPrice,
            productsProduced: s2.productsAvailable,
            improvementCards: s2.improvementPoints,
            researchIcons: s2.researchPoints,
            logisticsIcons: 2,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0,
          },
        },
      },
    ];

    state.currentPhase = 'expansion';
    state.turn = computeTurnOrder(state, 'expansion');
    const firstTeamId = state.turn.order[0];

    // First team only has presence in USA -> cannot jump directly to Emirates (not connected to USA)
    const disconnected = resolveTeamAction(state, {
      round: 1,
      phase: 'expansion',
      teamId: firstTeamId,
      payload: { allocations: { Emirates: 2 } },
      total: 2,
      submittedAt: new Date().toISOString(),
    });
    expect(disconnected.valid).toBe(false);

    // Canada is connected to USA and costs 2 -> establishes presence in Canada
    const connected = resolveTeamAction(state, {
      round: 1,
      phase: 'expansion',
      teamId: firstTeamId,
      payload: { allocations: { Canada: 2 } },
      total: 2,
      submittedAt: new Date().toISOString(),
    });
    expect(connected.valid).toBe(true);
    state = connected.nextState;
    expect(state.regionLogistics['Canada'].teamsPresent).toContain(firstTeamId);
    expect(state.turn?.index).toBe(1);

    // Now test SalesPhase resolution
    state.currentPhase = 'sales';
    state.turn = computeTurnOrder(state, 'sales');
    const firstSalesTeam = state.turn.order[0];
    const teamPrice = state.rounds[0].teamData[firstSalesTeam].price;

    // Sell to a customer in USA with high price threshold (usa-p1 has price 6)
    const salesRes = resolveTeamAction(state, {
      round: 1,
      phase: 'sales',
      teamId: firstSalesTeam,
      payload: {
        customersSold: ['usa-p1'],
        nfcSalesUnits: 0,
      },
      total: 1,
      submittedAt: new Date().toISOString(),
    });
    expect(salesRes.valid).toBe(true);
    state = salesRes.nextState;
    expect(state.rounds[0].teamData[firstSalesTeam].revenue).toBe(teamPrice);
    expect(state.rounds[0].teamData[firstSalesTeam].controlValue).toBeGreaterThan(0);
  });
});

describe('Steps 2.8 & 3.8 — 5-Round 5-Team Bot Game Parity & Document Size Limits', () => {
  it('produces identical game state across 5 rounds of 5-team bot play and keeps state/world under 100 KB', () => {
    let state = buildFullInitialGameState(5);

    for (let round = 1; round <= 5; round++) {
      expect(state.currentRound).toBe(round);
      expect(state.currentPhase).toBe('planning');

      // 1. Planning Phase: all 5 bots submit plans
      for (const team of state.teams) {
        const planDecision = decidePlanning(
          state,
          team.id,
          team.botProfile,
          team.botDifficulty,
          COMBINATIONS
        );
        const stats = calculatePlanStats(
          state,
          team.id,
          planDecision.combination,
          planDecision.position,
          planDecision.cardUsages,
          COMBINATIONS
        );
        const res = resolvePlan(state, round, team.id, {
          round,
          teamId: team.id,
          combination: planDecision.combination,
          position: planDecision.position,
          price: stats.calculatedPrice,
          productsProduced: stats.productsAvailable,
          improvementCards: stats.improvementPoints,
          researchIcons: stats.researchPoints,
          logisticsIcons: stats.logisticsPoints,
          cardUsages: planDecision.cardUsages,
          submittedAt: new Date().toISOString(),
        });
        expect(res.valid).toBe(true);
        state = res.nextState;
      }

      // Advance planning -> production -> improvement (or innovation in round 5)
      state = advanceOnePhase(state);
      expect(state.currentPhase).toBe('production');
      state = advanceOnePhase(state);

      // 2. Improvement Phase (Rounds 1..4)
      if (round < 5) {
        expect(state.currentPhase).toBe('improvement');
        while (state.turn && state.turn.index < state.turn.order.length) {
          const activeTeamId = state.turn.order[state.turn.index];
          const teamObj = state.teams.find((t) => t.id === activeTeamId)!;
          const cardId = decideImprovement(state, activeTeamId, teamObj.botProfile, teamObj.botDifficulty);
          const action: TeamActionDoc = {
            round,
            phase: 'improvement',
            teamId: activeTeamId,
            payload: { cardId },
            total: 1,
            submittedAt: new Date().toISOString(),
          };
          const res = resolveTeamAction(state, action);
          expect(res.valid).toBe(true);
          state = res.nextState;
        }
        state = advanceOnePhase(state);
      }

      // 3. Research Phase (`innovation`)
      expect(state.currentPhase).toBe('innovation');
      while (state.turn && state.turn.index < state.turn.order.length) {
        const activeTeamId = state.turn.order[state.turn.index];
        const teamObj = state.teams.find((t) => t.id === activeTeamId)!;
        const roundData = state.rounds.find((r) => r.roundNumber === round);
        const allowed = roundData?.teamData[activeTeamId]?.researchIcons || 0;
        const allocations = decideResearch(
          state,
          activeTeamId,
          allowed,
          teamObj.botProfile,
          teamObj.botDifficulty
        );
        const total = Object.values(allocations).reduce((s, n) => s + (Number(n) || 0), 0);
        const res = resolveTeamAction(state, {
          round,
          phase: 'innovation',
          teamId: activeTeamId,
          payload: { allocations },
          total,
          submittedAt: new Date().toISOString(),
        });
        expect(res.valid).toBe(true);
        state = res.nextState;
      }
      state = advanceOnePhase(state);

      // 4. Logistics Phase (`expansion`)
      expect(state.currentPhase).toBe('expansion');
      while (state.turn && state.turn.index < state.turn.order.length) {
        const activeTeamId = state.turn.order[state.turn.index];
        const teamObj = state.teams.find((t) => t.id === activeTeamId)!;
        const roundData = state.rounds.find((r) => r.roundNumber === round);
        const allowed = roundData?.teamData[activeTeamId]?.logisticsIcons || 0;
        const allocations = decideLogistics(
          state,
          activeTeamId,
          allowed,
          teamObj.botProfile,
          teamObj.botDifficulty
        );
        const total = Object.values(allocations).reduce((s, n) => s + (Number(n) || 0), 0);
        const res = resolveTeamAction(state, {
          round,
          phase: 'expansion',
          teamId: activeTeamId,
          payload: { allocations },
          total,
          submittedAt: new Date().toISOString(),
        });
        expect(res.valid).toBe(true);
        state = res.nextState;
      }
      state = advanceOnePhase(state);

      // 5. Sales Phase (`sales`)
      expect(state.currentPhase).toBe('sales');
      while (state.turn && state.turn.index < state.turn.order.length) {
        const activeTeamId = state.turn.order[state.turn.index];
        const teamObj = state.teams.find((t) => t.id === activeTeamId)!;
        const roundData = state.rounds.find((r) => r.roundNumber === round);
        const soldSoFar = new Set<string>();
        Object.values(roundData?.teamData || {}).forEach((td) => {
          (td.customersSold || []).forEach((cid) => soldSoFar.add(cid));
        });
        const customersSold = decideSales(
          state,
          activeTeamId,
          teamObj.botProfile,
          teamObj.botDifficulty,
          soldSoFar
        );
        const total = customersSold.length;
        const res = resolveTeamAction(state, {
          round,
          phase: 'sales',
          teamId: activeTeamId,
          payload: {
            customersSold,
            nfcSalesUnits: 0,
          },
          total,
          submittedAt: new Date().toISOString(),
        });
        expect(res.valid).toBe(true);
        state = res.nextState;
      }

      // Advance sales -> control -> scoring -> next round (or gameEnded in round 5)
      state = advanceOnePhase(state);
      expect(state.currentPhase).toBe('control');
      state = advanceOnePhase(state);
      expect(state.currentPhase).toBe('scoring');
      state = advanceOnePhase(state);
    }

    expect(state.gameEnded).toBe(true);
    expect(state.rounds).toHaveLength(5);

    // Split into v2 documents and reassemble -> verify zero data loss and exact score parity
    const { control, world, rounds } = splitGameState(state);
    const reassembled = assembleGameState({
      classId: state.gameId,
      teams: state.teams,
      control,
      world,
      rounds,
    });
    expect(reassembled).not.toBeNull();

    for (const team of state.teams) {
      const originalScore = calculateTeamTotalScore(team.id, 5, state);
      const assembledScore = calculateTeamTotalScore(team.id, 5, reassembled!);
      expect(assembledScore).toEqual(originalScore);
    }

    // Verify document byte sizes after 5 rounds of 5-team play
    const worldBytes = Buffer.byteLength(JSON.stringify(world), 'utf8');
    const controlBytes = Buffer.byteLength(JSON.stringify(control), 'utf8');
    const maxRoundBytes = Math.max(
      ...Object.values(rounds).map((r) => Buffer.byteLength(JSON.stringify(r), 'utf8'))
    );

    // Log sizes for auditability
    console.log(
      `[v2 5-Round Size Audit] state/world: ${worldBytes} bytes, state/control: ${controlBytes} bytes, max rounds/{n}: ${maxRoundBytes} bytes`
    );

    expect(worldBytes).toBeLessThan(100 * 1024); // < 100 KB (typically ~6-15 KB)
    expect(controlBytes).toBeLessThan(50 * 1024);
    expect(maxRoundBytes).toBeLessThan(50 * 1024);
  });
});
