import { describe, it, expect } from 'vitest';
import {
  computeSyndicateMarks,
  collectRoundMetrics,
  DEFAULT_SYNDICATE_MARKS_CONFIG
} from '@/lib/marks/syndicateMarks';
import { GameState } from '@/types/game';
import { advanceOnePhase } from '@/lib/phaseEngine';
import { captureRoundMarksSnapshot, withMarksSnapshot } from '@/lib/marks/marksSnapshot';

describe('Syndicate Marks Engine & StdDev Golden Fixtures (v1.1 Patch)', () => {
  const teams = [
    { id: 't1', name: 'Team 1', teamNumber: 1 },
    { id: 't2', name: 'Team 2', teamNumber: 2 },
    { id: 't3', name: 'Team 3', teamNumber: 3 },
    { id: 't4', name: 'Team 4', teamNumber: 4 },
    { id: 't5', name: 'Team 5', teamNumber: 5 },
  ];

  // Per-round inputs matching Workbook rows 23–57
  const workbookMetrics = {
    1: {
      t1: { revenue: 6, controlledRegions: 1, offices: 2, technologies: 0, patents: 0, lostProducts: 1 },
      t2: { revenue: 12, controlledRegions: 2, offices: 2, technologies: 0, patents: 0, lostProducts: 0 },
      t3: { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0, lostProducts: 0 },
      t4: { revenue: 10, controlledRegions: 2, offices: 2, technologies: 0, patents: 0, lostProducts: 0 },
      t5: { revenue: 25, controlledRegions: 2, offices: 2, technologies: 0, patents: 0, lostProducts: 1 },
    },
    2: {
      t1: { revenue: 15, controlledRegions: 1, offices: 2, technologies: 1, patents: 1, lostProducts: 0 },
      t2: { revenue: 12, controlledRegions: 2, offices: 3, technologies: 1, patents: 1, lostProducts: 0 },
      t3: { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0, lostProducts: 0 },
      t4: { revenue: 12, controlledRegions: 1, offices: 3, technologies: 1, patents: 0, lostProducts: 0 },
      t5: { revenue: 30, controlledRegions: 2, offices: 3, technologies: 0, patents: 0, lostProducts: 1 },
    },
    3: {
      t1: { revenue: 30, controlledRegions: 2, offices: 3, technologies: 2, patents: 1, lostProducts: 0 },
      t2: { revenue: 20, controlledRegions: 2, offices: 4, technologies: 2, patents: 2, lostProducts: 0 },
      t3: { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0, lostProducts: 0 },
      t4: { revenue: 14, controlledRegions: 2, offices: 4, technologies: 1, patents: 0, lostProducts: 0 },
      t5: { revenue: 21, controlledRegions: 3, offices: 3, technologies: 1, patents: 1, lostProducts: 0 },
    },
    4: {
      t1: { revenue: 48, controlledRegions: 1, offices: 4, technologies: 4, patents: 2, lostProducts: 0 },
      t2: { revenue: 40, controlledRegions: 4, offices: 6, technologies: 3, patents: 2, lostProducts: 0 },
      t3: { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0, lostProducts: 0 },
      t4: { revenue: 30, controlledRegions: 4, offices: 5, technologies: 2, patents: 0, lostProducts: 0 },
      t5: { revenue: 36, controlledRegions: 2, offices: 3, technologies: 2, patents: 2, lostProducts: 0 },
    },
    5: {
      t1: { revenue: 56, controlledRegions: 3, offices: 5, technologies: 5, patents: 2, lostProducts: 0 },
      t2: { revenue: 39, controlledRegions: 5, offices: 6, technologies: 3, patents: 2, lostProducts: 0 },
      t3: { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0, lostProducts: 0 },
      t4: { revenue: 32, controlledRegions: 2, offices: 6, technologies: 3, patents: 0, lostProducts: 0 },
      t5: { revenue: 48, controlledRegions: 3, offices: 5, technologies: 3, patents: 2, lostProducts: 0 },
    },
  };

  const exT3Config = {
    ...DEFAULT_SYNDICATE_MARKS_CONFIG,
    excludedTeamIds: ['t3'],
  };

  it('Test 1 — Round 5, T3 excluded (StdDev baseline)', () => {
    const res = computeSyndicateMarks(teams, workbookMetrics, exT3Config, 5);

    expect(res.means.revenue).toBeCloseTo(134.0, 5);
    expect(res.sds.revenue).toBeCloseTo(25.169425898, 5);

    const t1 = res.teams.find(t => t.teamId === 't1')!;
    const t2 = res.teams.find(t => t.teamId === 't2')!;
    const t4 = res.teams.find(t => t.teamId === 't4')!;
    const t5 = res.teams.find(t => t.teamId === 't5')!;

    expect(t1.zScores.revenue).toBeCloseTo(0.834346, 5);
    expect(t1.zScores.controlledRegions).toBeCloseTo(-1.4, 5);
    expect(t1.zScores.offices).toBeCloseTo(-0.987878, 5);
    expect(t1.zScores.technologies).toBeCloseTo(1.527525, 5);
    expect(t1.zScores.patents).toBeCloseTo(0.557086, 5);
    expect(t1.weightedZ).toBeCloseTo(0.1062157032, 5);
    expect(t1.lostPoints).toBeCloseTo(5, 5);
    expect(t1.totalRaw).toBeCloseTo(61.0621570, 5);

    expect(t2.zScores.revenue).toBeCloseTo(-0.437038, 5);
    expect(t2.zScores.controlledRegions).toBeCloseTo(1.4, 5);
    expect(t2.zScores.offices).toBeCloseTo(1.207407, 5);
    expect(t2.zScores.technologies).toBeCloseTo(0.218218, 5);
    expect(t2.zScores.patents).toBeCloseTo(0.928477, 5);
    expect(t2.weightedZ).toBeCloseTo(0.6634126529, 5);
    expect(t2.lostPoints).toBeCloseTo(0, 5);
    expect(t2.totalRaw).toBeCloseTo(71.6341265, 5);

    expect(t4.zScores.revenue).toBeCloseTo(-1.430307, 5);
    expect(t4.zScores.controlledRegions).toBeCloseTo(-0.2, 5);
    expect(t4.zScores.offices).toBeCloseTo(0.768350, 5);
    expect(t4.zScores.technologies).toBeCloseTo(-0.654654, 5);
    expect(t4.zScores.patents).toBeCloseTo(-1.671258, 5);
    expect(t4.weightedZ).toBeCloseTo(-0.6375737308, 5);
    expect(t4.lostPoints).toBeCloseTo(0, 5);
    expect(t4.totalRaw).toBeCloseTo(58.6242627, 5);

    expect(t5.zScores.revenue).toBeCloseTo(1.032999, 5);
    expect(t5.zScores.controlledRegions).toBeCloseTo(0.2, 5);
    expect(t5.zScores.offices).toBeCloseTo(-0.987878, 5);
    expect(t5.zScores.technologies).toBeCloseTo(-1.091089, 5);
    expect(t5.zScores.patents).toBeCloseTo(0.185695, 5);
    expect(t5.weightedZ).toBeCloseTo(-0.1320546253, 5);
    expect(t5.lostPoints).toBeCloseTo(10, 5);
    expect(t5.totalRaw).toBeCloseTo(53.6794537, 5);
  });

  it('Test 2 — Round 5, all five teams included', () => {
    const res = computeSyndicateMarks(teams, workbookMetrics, DEFAULT_SYNDICATE_MARKS_CONFIG, 5);

    const t1 = res.teams.find(t => t.teamId === 't1')!;
    const t2 = res.teams.find(t => t.teamId === 't2')!;
    const t3 = res.teams.find(t => t.teamId === 't3')!;
    const t4 = res.teams.find(t => t.teamId === 't4')!;
    const t5 = res.teams.find(t => t.teamId === 't5')!;

    expect(t1.totalRaw).toBeCloseTo(65.7608155, 5);
    expect(t2.totalRaw).toBeCloseTo(72.8704210, 5);
    expect(t3.totalRaw).toBeCloseTo(48.0413247, 5);
    expect(t4.totalRaw).toBeCloseTo(64.5184345, 5);
    expect(t5.totalRaw).toBeCloseTo(58.8090042, 5);
  });

  it('Test 3 — Round 2, T3 excluded', () => {
    const res = computeSyndicateMarks(teams, workbookMetrics, exT3Config, 2);

    const t1 = res.teams.find(t => t.teamId === 't1')!;
    const t2 = res.teams.find(t => t.teamId === 't2')!;
    const t4 = res.teams.find(t => t.teamId === 't4')!;
    const t5 = res.teams.find(t => t.teamId === 't5')!;

    expect(t1.totalRaw).toBeCloseTo(55.3361615, 5);
    expect(t2.totalRaw).toBeCloseTo(70.2020896, 5);
    expect(t4.totalRaw).toBeCloseTo(63.5080358, 5);
    expect(t5.totalRaw).toBeCloseTo(55.9537131, 5);
  });

  it('Test 4 — Round 1, T3 excluded (sigma = 0 criteria)', () => {
    const res = computeSyndicateMarks(teams, workbookMetrics, exT3Config, 1);

    const t1 = res.teams.find(t => t.teamId === 't1')!;
    const t2 = res.teams.find(t => t.teamId === 't2')!;
    const t4 = res.teams.find(t => t.teamId === 't4')!;
    const t5 = res.teams.find(t => t.teamId === 't5')!;

    expect(t1.totalRaw).toBeCloseTo(49.4992429, 5);
    expect(t2.totalRaw).toBeCloseTo(65.8035530, 5);
    expect(t4.totalRaw).toBeCloseTo(65.2417171, 5);
    expect(t5.totalRaw).toBeCloseTo(59.4554870, 5);
  });

  it('Test 5 — Anchor and scale (averageMark 70, marksPerSigma 15)', () => {
    const scaleConfig = {
      ...exT3Config,
      averageMark: 70,
      marksPerSigma: 15,
    };
    const res = computeSyndicateMarks(teams, workbookMetrics, scaleConfig, 5);

    const t1 = res.teams.find(t => t.teamId === 't1')!;
    const t2 = res.teams.find(t => t.teamId === 't2')!;
    const t4 = res.teams.find(t => t.teamId === 't4')!;
    const t5 = res.teams.find(t => t.teamId === 't5')!;

    expect(t1.totalRaw).toBeCloseTo(66.5932355, 5);
    expect(t2.totalRaw).toBeCloseTo(79.9511898, 5);
    expect(t4.totalRaw).toBeCloseTo(60.4363940, 5);
    expect(t5.totalRaw).toBeCloseTo(58.0191806, 5);
  });

  it('Test 6 — Edited weights 30/10/20/20/20', () => {
    const weightsConfig = {
      ...exT3Config,
      weights: { revenue: 0.3, controlledRegions: 0.1, offices: 0.2, technologies: 0.2, patents: 0.2 },
    };
    const res = computeSyndicateMarks(teams, workbookMetrics, weightsConfig, 5);

    const t1 = res.teams.find(t => t.teamId === 't1')!;
    const t2 = res.teams.find(t => t.teamId === 't2')!;
    const t4 = res.teams.find(t => t.teamId === 't4')!;
    const t5 = res.teams.find(t => t.teamId === 't5')!;

    expect(t1.totalRaw).toBeCloseTo(63.2965026, 5);
    expect(t2.totalRaw).toBeCloseTo(69.7970884, 5);
    expect(t4.totalRaw).toBeCloseTo(57.3939559, 5);
    expect(t5.totalRaw).toBeCloseTo(54.5124531, 5);
  });

  it('Test 7 — Normalisation (D17)', () => {
    const unnormConfig1 = {
      ...exT3Config,
      weights: { revenue: 0.4, controlledRegions: 0.2, offices: 0.2, technologies: 0.2, patents: 0.2 }, // sum 1.2
    };
    const res1 = computeSyndicateMarks(teams, workbookMetrics, unnormConfig1, 5);

    const t1_1 = res1.teams.find(t => t.teamId === 't1')!;
    const t2_1 = res1.teams.find(t => t.teamId === 't2')!;
    const t4_1 = res1.teams.find(t => t.teamId === 't4')!;
    const t5_1 = res1.teams.find(t => t.teamId === 't5')!;

    expect(t1_1.totalRaw).toBeCloseTo(62.2757069, 5);
    expect(t2_1.totalRaw).toBeCloseTo(69.8000418, 5);
    expect(t4_1.totalRaw).toBeCloseTo(57.3030410, 5);
    expect(t5_1.totalRaw).toBeCloseTo(55.6212103, 5);

    // Weights sum 60% (20/10/10/10/10) must yield exact same normalised results as sum 120% (40/20/20/20/20)
    const unnormConfig2 = {
      ...exT3Config,
      weights: { revenue: 0.2, controlledRegions: 0.1, offices: 0.1, technologies: 0.1, patents: 0.1 }, // sum 0.6
    };
    const res2 = computeSyndicateMarks(teams, workbookMetrics, unnormConfig2, 5);
    const t1_2 = res2.teams.find(t => t.teamId === 't1')!;

    expect(t1_2.totalRaw).toBeCloseTo(t1_1.totalRaw, 8);
  });

  it('Test 8 — Average property', () => {
    const noLossMetrics = JSON.parse(JSON.stringify(workbookMetrics));
    for (let r = 1; r <= 5; r++) {
      for (const tid of ['t1', 't2', 't4', 't5']) {
        noLossMetrics[r][tid].lostProducts = 0;
      }
    }
    const res = computeSyndicateMarks(teams, noLossMetrics, exT3Config, 5);
    const scored = res.teams.filter(t => !t.excluded);
    const meanTotal = scored.reduce((acc, t) => acc + t.totalRaw, 0) / scored.length;

    expect(meanTotal).toBeCloseTo(65.0, 8);
  });

  it('Test 9 — Adjustment and clamp', () => {
    const adjConfig = {
      ...exT3Config,
      adjustments: {
        t4: { points: 5, reason: 'Bonus' },
        t5: { points: -60, reason: 'Severe penalty' },
      },
    };
    const res = computeSyndicateMarks(teams, workbookMetrics, adjConfig, 5);

    const t4 = res.teams.find(t => t.teamId === 't4')!;
    const t5 = res.teams.find(t => t.teamId === 't5')!;

    expect(t4.totalRaw).toBeCloseTo(58.6242627 + 5, 5); // 63.6242627
    expect(t5.totalRaw).toBeCloseTo(-6.3205463, 5);
    expect(t5.totalClamped).toBe(0);
  });

  it('Test 10 — Exclusion changes statistics', () => {
    const resWithT3 = computeSyndicateMarks(teams, workbookMetrics, DEFAULT_SYNDICATE_MARKS_CONFIG, 5);
    const resExT3 = computeSyndicateMarks(teams, workbookMetrics, exT3Config, 5);

    const t1WithT3 = resWithT3.teams.find(t => t.teamId === 't1')!;
    const t1ExT3 = resExT3.teams.find(t => t.teamId === 't1')!;

    expect(t1WithT3.weightedZ).toBeCloseTo(0.57608155, 5);
    expect(t1ExT3.weightedZ).toBeCloseTo(0.1062157032, 5);
  });

  // Retained v1.0 Tests
  it('Retained Test — Penalty only / worst loses full weight', () => {
    const res = computeSyndicateMarks(teams, workbookMetrics, exT3Config, 5);
    const t5 = res.teams.find(t => t.teamId === 't5')!;
    const t1 = res.teams.find(t => t.teamId === 't1')!;
    const t2 = res.teams.find(t => t.teamId === 't2')!;

    expect(t5.lostPoints).toBe(10);
    expect(t1.lostPoints).toBe(5);
    expect(t2.lostPoints).toBe(0);
  });

  it('Retained Test — No losses anywhere', () => {
    const noLossMetrics = JSON.parse(JSON.stringify(workbookMetrics));
    for (let r = 1; r <= 5; r++) {
      for (const tid of ['t1', 't2', 't3', 't4', 't5']) {
        noLossMetrics[r][tid].lostProducts = 0;
      }
    }
    const res = computeSyndicateMarks(teams, noLossMetrics, exT3Config, 5);
    res.teams.forEach(t => {
      expect(t.lostPoints).toBe(0);
    });
  });

  it('Retained Test — Lost products and Wifi (D4) via collectRoundMetrics', () => {
    const state: GameState = {
      gameId: 'g1',
      createdAt: new Date(),
      updatedAt: new Date(),
      currentRound: 1,
      teams: [{ id: 't1', name: 'Team 1', color: '#10b981' }],
      rounds: [{
        roundNumber: 1,
        teamData: {
          t1: {
            productsProduced: 5,
            customersSold: ['c1', 'c2', 'c3'],
            nfcSalesUnits: 1,
          } as any
        }
      }],
      technologies: {},
      regions: [],
      patents: {},
      improvementCards: [],
      improvementPoolByRound: {},
      teamResearchProgress: {},
      researchAllocatedByRound: {},
      regionLogistics: {},
      teamLogisticsProgress: {},
      logisticsAllocatedByRound: {},
    };

    const m1 = collectRoundMetrics(state, 1);
    expect(m1[1].t1.unsold).toBe(1);
    expect(m1[1].t1.lostProducts).toBe(1);

    const stateWithSnap: GameState = {
      ...state,
      marksSnapshots: {
        '1': {
          t1: {
            offices: 1, technologies: 1, patents: 0, controlledRegions: 1,
            wifiCarryOverActive: true, capturedAt: new Date().toISOString()
          }
        }
      }
    };
    const m2 = collectRoundMetrics(stateWithSnap, 1);
    expect(m2[1].t1.unsold).toBe(1);
    expect(m2[1].t1.carriedOver).toBe(1);
    expect(m2[1].t1.lostProducts).toBe(0);
  });

  it('Retained Test — Snapshot capture in advanceOnePhase and endGame', () => {
    const initialState: GameState = {
      gameId: 'g2',
      createdAt: new Date(),
      updatedAt: new Date(),
      currentRound: 1,
      currentPhase: 'scoring',
      teams: [
        { id: 't1', name: 'Team 1', color: '#10b981' },
        { id: 't2', name: 'Bot Team', color: '#ef4444', isBot: true },
      ],
      rounds: [{ roundNumber: 1, teamData: {} }],
      technologies: {},
      regions: [],
      patents: {},
      improvementCards: [],
      improvementPoolByRound: {},
      teamResearchProgress: {},
      researchAllocatedByRound: {},
      regionLogistics: {},
      teamLogisticsProgress: {},
      logisticsAllocatedByRound: {},
    };

    const nextState = advanceOnePhase(initialState);
    expect(nextState.currentRound).toBe(2);
    expect(nextState.marksSnapshots?.['1']?.t1).toBeDefined();
    expect(nextState.marksSnapshots?.['1']?.t2).toBeDefined();

    const stateEnd = withMarksSnapshot(nextState, 2);
    expect(stateEnd.marksSnapshots?.['2']?.t1).toBeDefined();
  });

  it('Retained Test — Offices count occupied spaces (D6)', () => {
    const state: GameState = {
      gameId: 'g3',
      createdAt: new Date(),
      updatedAt: new Date(),
      currentRound: 1,
      teams: [{ id: 't1', name: 'Team 1', color: '#10b981' }],
      rounds: [],
      technologies: {},
      regions: [],
      patents: {},
      improvementCards: [],
      improvementPoolByRound: {},
      teamResearchProgress: {},
      researchAllocatedByRound: {},
      regionLogistics: {
        'North America': {
          officeCounts: { t1: 3 }
        } as any,
        'Europe': {
          teamsPresent: ['t1']
        } as any
      },
      teamLogisticsProgress: {},
      logisticsAllocatedByRound: {},
    };

    const snap = captureRoundMarksSnapshot(state, 1);
    expect(snap.t1.offices).toBe(4);
  });

  it('Retained Test — Deterministic execution', () => {
    const r1 = computeSyndicateMarks(teams, workbookMetrics, exT3Config, 5);
    const r2 = computeSyndicateMarks(teams, workbookMetrics, exT3Config, 5);
    expect(r1).toEqual(r2);
  });
});
