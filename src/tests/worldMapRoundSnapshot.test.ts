import { describe, it, expect } from 'vitest';
import { buildGameStateForRound } from '@/lib/roundSnapshot';
import { advanceOnePhase } from '@/lib/phaseEngine';
import { GameState, Team } from '@/types/game';

describe('World Map Round Snapshot & Historical State', () => {
  const teams: Team[] = [
    { id: 'team-green', name: 'Green Team', color: '#10B981' },
    { id: 'team-blue', name: 'Blue Team', color: '#3B82F6' },
    { id: 'team-black', name: 'Black Team', color: '#1F2937' },
  ];

  const baseGameState: GameState = {
    id: 'game-1',
    currentRound: 2,
    currentPhase: 'production',
    teams,
    rounds: [
      {
        roundNumber: 1,
        teamData: {
          'team-green': {
            teamId: 'team-green',
            combination: 1,
            position: 1,
            price: 6,
            productsProduced: 3,
            improvementCards: 1,
            researchIcons: 3,
            logisticsIcons: 2,
            revenue: 12,
            technologiesResearched: ['WIFI'],
            expansionLocations: ['Emirates'],
            salesByRegion: { 'North Africa': 1, 'Emirates': 1 },
            customersSold: ['na-p1', 'em-p1'],
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 12,
          },
          'team-blue': {
            teamId: 'team-blue',
            combination: 2,
            position: 1,
            price: 5,
            productsProduced: 4,
            improvementCards: 0,
            researchIcons: 2,
            logisticsIcons: 2,
            revenue: 10,
            technologiesResearched: [],
            expansionLocations: ['USA'],
            salesByRegion: { 'South America': 2 },
            customersSold: ['sa-p1', 'sa-p2'],
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 10,
          },
          'team-black': {
            teamId: 'team-black',
            combination: 3,
            position: 1,
            price: 4,
            productsProduced: 5,
            improvementCards: 0,
            researchIcons: 1,
            logisticsIcons: 3,
            revenue: 8,
            technologiesResearched: [],
            expansionLocations: ['USA'],
            salesByRegion: { 'Australia': 2 },
            customersSold: ['aus-p1', 'aus-p2'],
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 8,
          },
        },
      },
      {
        roundNumber: 2,
        teamData: {
          'team-green': {
            teamId: 'team-green',
            combination: 2,
            position: 1,
            price: 5,
            productsProduced: 4,
            improvementCards: 0,
            researchIcons: 2,
            logisticsIcons: 2,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 12,
          },
          'team-blue': {
            teamId: 'team-blue',
            combination: 1,
            position: 1,
            price: 6,
            productsProduced: 3,
            improvementCards: 0,
            researchIcons: 1,
            logisticsIcons: 1,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 10,
          },
          'team-black': {
            teamId: 'team-black',
            combination: 1,
            position: 1,
            price: 7,
            productsProduced: 2,
            improvementCards: 0,
            researchIcons: 1,
            logisticsIcons: 1,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 8,
          },
        },
      },
    ],
    technologies: {
      'GPS': { name: 'GPS', cost: 3, teamProgress: { 'team-green': 2 } },
      'WIFI': { name: 'WIFI', cost: 3, patentHolder: 'team-green', teamProgress: { 'team-green': 3 } },
      'Gaming': { name: 'Gaming', cost: 4, teamProgress: {} },
      'Battery': { name: 'Battery', cost: 4, teamProgress: {} },
      'NFC': { name: 'NFC', cost: 5, teamProgress: {} },
      '4G': { name: '4G', cost: 6, teamProgress: { 'team-blue': 1 } },
    },
    patents: {
      'WIFI': 'team-green',
    },
    patentRounds: {
      'WIFI': 1,
    },
    teamResearchProgress: {
      'team-green': {
        teamId: 'team-green',
        completedTechnologies: ['WIFI'],
        technologyInvestments: { 'WIFI': 3, 'GPS': 2 },
      },
      'team-blue': {
        teamId: 'team-blue',
        completedTechnologies: [],
        technologyInvestments: { '4G': 1 },
      },
      'team-black': {
        teamId: 'team-black',
        completedTechnologies: [],
        technologyInvestments: {},
      },
    },
    regionLogistics: {
      'North Africa': { name: 'North Africa', logisticsCost: 1, maxTeams: 3, connectedRegions: [], teamsPresent: ['team-green'], teamProgress: { 'team-green': 1 } },
      'Emirates': { name: 'Emirates', logisticsCost: 2, maxTeams: 2, connectedRegions: [], teamsPresent: ['team-green'], teamProgress: { 'team-green': 2 } },
      'South America': { name: 'South America', logisticsCost: 1, maxTeams: 3, connectedRegions: [], teamsPresent: ['team-blue'], teamProgress: { 'team-blue': 1 } },
      'Australia': { name: 'Australia', logisticsCost: 1, maxTeams: 3, connectedRegions: [], teamsPresent: ['team-black'], teamProgress: { 'team-black': 1 } },
      'USA': { name: 'USA', logisticsCost: 2, maxTeams: 4, connectedRegions: [], teamsPresent: ['team-blue', 'team-black'], teamProgress: { 'team-blue': 2, 'team-black': 2 } },
    },
    teamLogisticsProgress: {
      'team-green': { teamId: 'team-green', regionsWithPresence: ['North Africa', 'Emirates'], regionInvestments: { 'North Africa': 1, 'Emirates': 2 } },
      'team-blue': { teamId: 'team-blue', regionsWithPresence: ['South America', 'USA'], regionInvestments: { 'South America': 1, 'USA': 2 } },
      'team-black': { teamId: 'team-black', regionsWithPresence: ['Australia', 'USA'], regionInvestments: { 'Australia': 1, 'USA': 2 } },
    },
    researchAllocatedByRound: {
      1: { 'team-green': 3, 'team-blue': 0, 'team-black': 0 },
      2: { 'team-green': 2, 'team-blue': 1, 'team-black': 0 },
    },
    logisticsAllocatedByRound: {
      1: { 'team-green': 2, 'team-blue': 2, 'team-black': 2 },
    },
    improvementCards: [],
    improvementPoolByRound: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('reconstructs logistics and offices for Round 1 with starting regions & expansions', () => {
    const r1State = buildGameStateForRound(baseGameState, 1);

    expect(r1State.currentRound).toBe(1);
    expect(r1State.currentPhase).toBe('scoring');

    // Green Team should have presence in North Africa (start) and Emirates (expanded/sold)
    expect(r1State.teamLogisticsProgress['team-green'].regionsWithPresence).toContain('North Africa');
    expect(r1State.teamLogisticsProgress['team-green'].regionsWithPresence).toContain('Emirates');
    expect(r1State.regionLogistics['North Africa'].teamsPresent).toContain('team-green');
    expect(r1State.regionLogistics['Emirates'].teamsPresent).toContain('team-green');

    // Blue Team should have presence in South America (start) and USA
    expect(r1State.teamLogisticsProgress['team-blue'].regionsWithPresence).toContain('South America');
    expect(r1State.regionLogistics['South America'].teamsPresent).toContain('team-blue');

    // Black Team should have presence in Australia (start) and USA
    expect(r1State.teamLogisticsProgress['team-black'].regionsWithPresence).toContain('Australia');
    expect(r1State.regionLogistics['Australia'].teamsPresent).toContain('team-black');
  });

  it('reconstructs technologies and patents for Round 1', () => {
    const r1State = buildGameStateForRound(baseGameState, 1);

    // Green Team patented WIFI in round 1 with 3 points
    expect(r1State.patents['WIFI']).toBe('team-green');
    expect(r1State.technologies['WIFI'].patentHolder).toBe('team-green');
    expect(r1State.technologies['WIFI'].teamProgress['team-green']).toBe(3);
    expect(r1State.teamResearchProgress['team-green'].completedTechnologies).toContain('WIFI');

    // GPS was researched in round 2, so in round 1 it should not be completed
    expect(r1State.technologies['GPS'].patentHolder).toBeUndefined();
    expect(r1State.teamResearchProgress['team-green'].completedTechnologies).not.toContain('GPS');
  });

  it('returns live gameState when viewing current round (Round 2)', () => {
    const r2State = buildGameStateForRound(baseGameState, 2);

    expect(r2State.currentRound).toBe(2);
    expect(r2State.currentPhase).toBe('production');
    expect(r2State.technologies['GPS'].teamProgress['team-green']).toBe(2);
  });

  it('captures boardSnapshotsByRound on advanceOnePhase and uses snapshot directly', () => {
    const closingState: GameState = {
      ...baseGameState,
      currentRound: 1,
      currentPhase: 'scoring',
    };

    const nextState = advanceOnePhase(closingState);
    expect(nextState.currentRound).toBe(2);
    expect(nextState.boardSnapshotsByRound?.[1]).toBeDefined();
    expect(nextState.boardSnapshotsByRound?.[1].regionLogistics['Emirates'].teamsPresent).toContain('team-green');

    // buildGameStateForRound for Round 1 should load the snapshot
    const r1FromSnapshot = buildGameStateForRound(nextState, 1);
    expect(r1FromSnapshot.currentRound).toBe(1);
    expect(r1FromSnapshot.currentPhase).toBe('scoring');
    expect(r1FromSnapshot.patents['WIFI']).toBe('team-green');
  });
});
