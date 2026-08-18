import { describe, test, expect } from 'vitest';
import { GameState, Team } from '../types/game';
import { diffGameState, isBulkTransition } from '../pages/Viewer/motion/boardDiff';

function createMockGameState(): GameState {
  const teams: Team[] = [
    { id: 'team-green', name: 'Green Team', color: 'Green', isBot: true },
    { id: 'team-blue', name: 'Blue Team', color: 'Blue', isBot: true }
  ];

  const technologies = {
    'GPS': { name: 'GPS', researchPoints: 0, maxPoints: 3, researchCost: 3, teamProgress: {} },
    'Wifi': { name: 'Wifi', researchPoints: 0, maxPoints: 3, researchCost: 3, teamProgress: {} }
  };

  const regionLogistics = {
    'Canada': { name: 'Canada', logisticsCost: 2, maxTeams: 3, connectedRegions: [], teamsPresent: [], teamProgress: {} },
    'North Africa': { name: 'North Africa', logisticsCost: 3, maxTeams: 4, connectedRegions: [], teamsPresent: ['team-green'], teamProgress: {} }
  };

  return {
    gameId: 'test-game',
    teams,
    currentRound: 1,
    currentPhase: 'planning',
    rounds: [
      {
        roundNumber: 1,
        teamData: {
          'team-green': {
            teamId: 'team-green',
            combination: 1,
            position: 1,
            price: 5,
            productsProduced: 3,
            improvementCards: 0,
            researchIcons: 3,
            logisticsIcons: 3,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0
          },
          'team-blue': {
            teamId: 'team-blue',
            combination: 2,
            position: 1,
            price: 5,
            productsProduced: 3,
            improvementCards: 0,
            researchIcons: 3,
            logisticsIcons: 3,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0
          }
        }
      }
    ],
    technologies,
    regions: [],
    patents: {},
    improvementCards: [],
    improvementPoolByRound: {},
    teamResearchProgress: {
      'team-green': { teamId: 'team-green', technologyInvestments: {}, completedTechnologies: [] },
      'team-blue': { teamId: 'team-blue', technologyInvestments: {}, completedTechnologies: [] }
    },
    researchAllocatedByRound: {},
    regionLogistics,
    teamLogisticsProgress: {
      'team-green': { teamId: 'team-green', regionsWithPresence: ['North Africa'], regionInvestments: {} },
      'team-blue': { teamId: 'team-blue', regionsWithPresence: [], regionInvestments: {} }
    },
    logisticsAllocatedByRound: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

test('runs board diff tests', () => {
  console.log('--------------------------------------------------');
  console.log('RUNNING BOARD DIFF ENGINE UNIT TESTS');
  console.log('--------------------------------------------------\n');

  let passed = true;

  // Test 1: Identify customer sold event
  try {
    const prev = createMockGameState();
    const next = createMockGameState();
    
    // Green Team sells to customer can-p1 in round 1
    next.rounds[0].teamData['team-green'].customersSold = ['can-p1'];

    const events = diffGameState(prev, next);
    console.log('Test 1: Customer sold detection');
    console.log(`- Events detected: ${JSON.stringify(events, null, 2)}`);

    if (events.length === 1 && events[0].kind === 'customer-sold' && events[0].key === 'customer:Canada:can-p1') {
      console.log('✅ Passed: Customer sold event identified correctly.');
    } else {
      console.error('❌ Failed: Customer sold event incorrect or not detected.');
      passed = false;
    }
  } catch (err) {
    console.error('❌ Test 1 Error:', err);
    passed = false;
  }

  console.log();

  // Test 2: Identify office established and logistics progress
  try {
    const prev = createMockGameState();
    const next = createMockGameState();

    // Blue Team invests logistics points in Canada and establishes presence
    next.regionLogistics['Canada'].teamProgress['team-blue'] = 2;
    next.regionLogistics['Canada'].teamsPresent = ['team-blue'];
    next.teamLogisticsProgress['team-blue'].regionsWithPresence = ['Canada'];
    next.teamLogisticsProgress['team-blue'].regionInvestments['Canada'] = 2;

    const events = diffGameState(prev, next);
    console.log('Test 2: Office established detection');
    console.log(`- Events detected: ${JSON.stringify(events, null, 2)}`);

    const hasOfficeEvent = events.some(e => e.kind === 'office-established' && e.key === 'office:Canada:team-blue');
    const hasProgressEvent = events.some(e => e.kind === 'logistics-progress');

    if (hasOfficeEvent && !hasProgressEvent) {
      console.log('✅ Passed: Office established correctly suppresses partial progress on the same tick.');
    } else {
      console.error('❌ Failed: Office established suppression logic failed.');
      passed = false;
    }
  } catch (err) {
    console.error('❌ Test 2 Error:', err);
    passed = false;
  }

  console.log();

  // Test 3: Identify bulk transition on phase change
  try {
    const prev = createMockGameState();
    const next = createMockGameState();
    next.currentPhase = 'production';

    const bulk = isBulkTransition(prev, next);
    console.log('Test 3: Bulk transition on phase change');
    console.log(`- Is bulk: ${bulk}`);

    if (bulk === true) {
      console.log('✅ Passed: Phase change correctly detected as bulk transition.');
    } else {
      console.error('❌ Failed: Phase change not detected as bulk transition.');
      passed = false;
    }
  } catch (err) {
    console.error('❌ Test 3 Error:', err);
    passed = false;
  }

  expect(passed).toBe(true);
});
