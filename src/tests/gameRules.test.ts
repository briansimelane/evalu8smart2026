import { test, expect } from 'vitest';
import { GameState, Team } from '../types/game';
import { decideResearch, decideLogistics } from '../bots/botEngine';
import { getTechnologyCostForTeam, canExpandToRegion } from '../lib/rules';

// A helper to create a clean mock GameState
function createMockGameState(): GameState {
  const teams: Team[] = [
    { id: 'team-green', name: 'Green Team', color: 'Green', isBot: true, botProfile: 'BALANCED', botDifficulty: 'MEDIUM' },
    { id: 'team-blue', name: 'Blue Team', color: 'Blue', isBot: true, botProfile: 'RESEARCHER', botDifficulty: 'MEDIUM' }
  ];

  const technologies = {
    'GPS': { name: 'GPS', researchPoints: 0, maxPoints: 3, researchCost: 3, teamProgress: {} },
    'Wifi': { name: 'Wifi', researchPoints: 0, maxPoints: 3, researchCost: 3, teamProgress: {} },
    'Gaming': { name: 'Gaming', researchPoints: 0, maxPoints: 4, researchCost: 4, teamProgress: {} },
    'Battery': { name: 'Battery', researchPoints: 0, maxPoints: 4, researchCost: 4, teamProgress: {} },
    'NFC': { name: 'NFC', researchPoints: 0, maxPoints: 5, researchCost: 5, teamProgress: {} },
    '4G': { name: '4G', researchPoints: 0, maxPoints: 6, researchCost: 6, teamProgress: {} }
  };

  const regionLogistics = {
    'Canada': { name: 'Canada', logisticsCost: 2, maxTeams: 3, connectedRegions: ['CIS', 'India', 'USA'], teamsPresent: [], teamProgress: {} },
    'USA': { name: 'USA', logisticsCost: 4, maxTeams: 5, connectedRegions: ['Canada', 'Australia', 'Caribbean', 'South America'], teamsPresent: [], teamProgress: {} },
    'Caribbean': { name: 'Caribbean', logisticsCost: 2, maxTeams: 3, connectedRegions: ['USA', 'Australia', 'South America'], teamsPresent: [], teamProgress: {} },
    'South America': { name: 'South America', logisticsCost: 3, maxTeams: 4, connectedRegions: ['Caribbean', 'USA', 'North Africa', 'RSA'], teamsPresent: ['team-blue'], teamProgress: { 'team-blue': 3 } },
    'Europe': { name: 'Europe', logisticsCost: 4, maxTeams: 5, connectedRegions: ['USA', 'CIS', 'North Africa'], teamsPresent: [], teamProgress: {} },
    'Emirates': { name: 'Emirates', logisticsCost: 2, maxTeams: 3, connectedRegions: ['India', 'RSA', 'North Africa'], teamsPresent: [], teamProgress: {} },
    'North Africa': { name: 'North Africa', logisticsCost: 3, maxTeams: 4, connectedRegions: ['Europe', 'China', 'Emirates'], teamsPresent: ['team-green'], teamProgress: { 'team-green': 3 } },
    'RSA': { name: 'RSA', logisticsCost: 2, maxTeams: 3, connectedRegions: ['South America', 'Emirates', 'Australia'], teamsPresent: [], teamProgress: {} },
    'CIS': { name: 'CIS', logisticsCost: 3, maxTeams: 4, connectedRegions: ['Canada', 'China', 'Europe'], teamsPresent: [], teamProgress: {} },
    'China': { name: 'China', logisticsCost: 4, maxTeams: 5, connectedRegions: ['CIS', 'India', 'North Africa'], teamsPresent: [], teamProgress: {} },
    'India': { name: 'India', logisticsCost: 3, maxTeams: 4, connectedRegions: ['Canada', 'Emirates', 'China'], teamsPresent: [], teamProgress: {} },
    'Australia': { name: 'Australia', logisticsCost: 3, maxTeams: 4, connectedRegions: ['USA', 'Caribbean', 'RSA'], teamsPresent: [], teamProgress: {} }
  };

  const rounds = [
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
  ];

  return {
    gameId: 'test-game',
    teams,
    currentRound: 1,
    rounds,
    technologies,
    regions: [],
    patents: {},
    improvementCards: [],
    improvementPoolByRound: {},
    teamResearchProgress: {
      'team-green': { teamId: 'team-green', technologyInvestments: {}, completedTechnologies: [] },
      'team-blue': { teamId: 'team-blue', technologyInvestments: {}, completedTechnologies: [] }
    },
    researchAllocatedByRound: {
      1: {}
    },
    regionLogistics,
    teamLogisticsProgress: {
      'team-green': { teamId: 'team-green', regionsWithPresence: ['North Africa'], regionInvestments: { 'North Africa': 3 } },
      'team-blue': { teamId: 'team-blue', regionsWithPresence: ['South America'], regionInvestments: { 'South America': 3 } }
    },
    logisticsAllocatedByRound: {
      1: {}
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// Simple state mutation functions that mirror GameContext logic WITHOUT validation (for testing bypasses)
function allocateResearchNoValidation(state: GameState, teamId: string, technology: string, points: number) {
  const tech = state.technologies[technology];
  const baseCost = tech.researchCost;

  const teamProgress = state.teamResearchProgress[teamId] || {
    teamId,
    technologyInvestments: {},
    completedTechnologies: []
  };

  const currentInvestment = teamProgress.technologyInvestments[technology] || 0;
  const newInvestment = currentInvestment + points;

  teamProgress.technologyInvestments[technology] = newInvestment;
  state.teamResearchProgress[teamId] = teamProgress;

  // Patent and completion checks
  const patentHolder = state.patents[technology];
  const cost = patentHolder && patentHolder !== teamId ? Math.max(0, baseCost - 1) : baseCost;

  if (newInvestment >= cost && !teamProgress.completedTechnologies.includes(technology)) {
    teamProgress.completedTechnologies.push(technology);
    if (!state.patents[technology]) {
      state.patents[technology] = teamId;
    }
  }

  // Update tech progress
  tech.teamProgress[teamId] = newInvestment;

  // Track round allocations
  const currentRound = state.currentRound;
  const roundAllocations = state.researchAllocatedByRound[currentRound] || {};
  const prevSpent = roundAllocations[teamId] || 0;
  state.researchAllocatedByRound[currentRound] = {
    ...roundAllocations,
    [teamId]: prevSpent + points
  };
}

function allocateLogisticsNoValidation(state: GameState, teamId: string, regionName: string, points: number) {
  const region = state.regionLogistics[regionName];
  const teamProgress = state.teamLogisticsProgress[teamId];

  const currentInvestment = teamProgress.regionInvestments[regionName] || 0;
  const newInvestment = currentInvestment + points;

  region.teamProgress[teamId] = newInvestment;
  teamProgress.regionInvestments[regionName] = newInvestment;

  const hasPresence = newInvestment >= region.logisticsCost;
  if (hasPresence && !region.teamsPresent.includes(teamId)) {
    region.teamsPresent.push(teamId);
    teamProgress.regionsWithPresence.push(regionName);
  }

  // Track round allocations
  const currentRound = state.currentRound;
  const roundAllocations = state.logisticsAllocatedByRound[currentRound] || {};
  const prevSpent = roundAllocations[teamId] || 0;
  state.logisticsAllocatedByRound[currentRound] = {
    ...roundAllocations,
    [teamId]: prevSpent + points
  };
}

// Core validation checks (what we WILL implement in GameContext.tsx)
function validateResearchAllocation(state: GameState, teamId: string, technology: string, points: number): { valid: boolean; reason?: string } {
  const roundData = state.rounds.find(r => r.roundNumber === state.currentRound);
  const teamRoundData = roundData?.teamData[teamId];
  if (!teamRoundData) {
    return { valid: false, reason: `No plan submitted for team ${teamId} in round ${state.currentRound}` };
  }

  const allowedIcons = teamRoundData.researchIcons || 0;
  const spentThisRound = state.researchAllocatedByRound[state.currentRound]?.[teamId] || 0;
  
  if (spentThisRound + points > allowedIcons) {
    return {
      valid: false,
      reason: `Allocating ${points} points would exceed available research icons (${allowedIcons}) as ${spentThisRound} has already been spent.`
    };
  }

  // Check if technology is already completed
  const teamProgress = state.teamResearchProgress[teamId];
  if (teamProgress?.completedTechnologies.includes(technology)) {
    // If all technologies are completed, fallback allocation is allowed, otherwise reject
    const totalTechs = Object.keys(state.technologies).length;
    const completedCount = teamProgress.completedTechnologies.length;
    if (completedCount < totalTechs) {
      return { valid: false, reason: `Technology ${technology} is already completed.` };
    }
  }

  return { valid: true };
}

function validateLogisticsAllocation(state: GameState, teamId: string, regionName: string, points: number): { valid: boolean; reason?: string } {
  const roundData = state.rounds.find(r => r.roundNumber === state.currentRound);
  const teamRoundData = roundData?.teamData[teamId];
  if (!teamRoundData) {
    return { valid: false, reason: `No plan submitted for team ${teamId} in round ${state.currentRound}` };
  }

  const allowedIcons = teamRoundData.logisticsIcons || 0;
  const spentThisRound = state.logisticsAllocatedByRound[state.currentRound]?.[teamId] || 0;

  if (spentThisRound + points > allowedIcons) {
    return {
      valid: false,
      reason: `Allocating ${points} points would exceed available logistics icons (${allowedIcons}) as ${spentThisRound} has already been spent.`
    };
  }

  // Validate expansion constraints (must be connected and not full)
  const region = state.regionLogistics[regionName];
  if (!region) {
    return { valid: false, reason: `Region ${regionName} does not exist.` };
  }

  const teamProgress = state.teamLogisticsProgress[teamId];
  const isAlreadyPresent = teamProgress?.regionsWithPresence.includes(regionName);

  if (!isAlreadyPresent) {
    // Check if region is full
    if (region.teamsPresent.length >= region.maxTeams) {
      return { valid: false, reason: `Region ${regionName} is full (${region.teamsPresent.length}/${region.maxTeams} teams).` };
    }

    // Check connectivity
    const hasConnectedPresence = region.connectedRegions.some(connected =>
      teamProgress?.regionsWithPresence.includes(connected)
    );
    if (!hasConnectedPresence) {
      return { valid: false, reason: `Region ${regionName} is not connected to any region with team presence.` };
    }
  }

  return { valid: true };
}

test('runs simulation rules tests', () => {
  console.log('--------------------------------------------------');
  console.log('RUNNING BOARD GAME SIMULATION RULES VALIDATION TEST');
  console.log('--------------------------------------------------\n');

  let passed = true;

  // Test 1: Verify correct bot decision boundaries under normal circumstances
  try {
    const state = createMockGameState();
    const researchDecision = decideResearch(state, 'team-blue', 3, 'RESEARCHER', 'MEDIUM');
    const totalResearchAllocated = Object.values(researchDecision).reduce((s, p) => s + p, 0);

    const logisticsDecision = decideLogistics(state, 'team-blue', 3, 'RESEARCHER', 'MEDIUM');
    const totalLogisticsAllocated = Object.values(logisticsDecision).reduce((s, p) => s + p, 0);

    console.log('Test 1: Bot Single Decision Limit Check');
    console.log(`- Blue Team allocated Research points: ${JSON.stringify(researchDecision)} (Total: ${totalResearchAllocated})`);
    console.log(`- Blue Team allocated Logistics points: ${JSON.stringify(logisticsDecision)} (Total: ${totalLogisticsAllocated})`);

    if (totalResearchAllocated !== 3 || totalLogisticsAllocated !== 3) {
      console.error('❌ Failed: Bot allocated points incorrect');
      passed = false;
    } else {
      console.log('✅ Passed: Bot decisions stayed within limits on a single pass.');
    }
  } catch (err) {
    console.error('❌ Test 1 Error:', err);
    passed = false;
  }

  console.log();

  // Test 2: Simulate stale state race conditions (double execution of timeouts)
  try {
    console.log('Test 2: Simulating Stale State Concurrency Bug');
    const state = createMockGameState();

    // Imagine double execution (stale context)
    // Run 1: thinks spent = 0, decides 3 points
    const run1Alloc = decideResearch(state, 'team-blue', 3, 'RESEARCHER', 'MEDIUM');
    // Run 2: also thinks spent = 0 (before Run 1 is committed/synced), decides 3 points
    const run2Alloc = decideResearch(state, 'team-blue', 3, 'RESEARCHER', 'MEDIUM');

    // Simulate committing both in the unvalidated game engine
    Object.entries(run1Alloc).forEach(([tech, p]) => allocateResearchNoValidation(state, 'team-blue', tech, p));
    Object.entries(run2Alloc).forEach(([tech, p]) => allocateResearchNoValidation(state, 'team-blue', tech, p));

    const totalSpent = state.researchAllocatedByRound[1]['team-blue'] || 0;
    console.log(`- Total points actually spent in round 1 for Blue Team: ${totalSpent}`);

    if (totalSpent === 6) {
      console.log('✅ Vulnerability Replicated: The unvalidated state successfully allowed double-spend (bug reproduced).');
    } else {
      console.error('❌ Failed: Unvalidated state did not allow double-spend (bug reproduction failed).');
      passed = false;
    }
  } catch (err) {
    console.error('❌ Test 2 Error:', err);
    passed = false;
  }

  console.log();

  // Test 3: Verify the proposed validations block rule violations
  try {
    console.log('Test 3: Testing Validation Logic (Proposed Fixes)');
    const state = createMockGameState();

    // 1st allocation: valid (3 points)
    const validAlloc = { 'GPS': 3 };
    let check1 = { valid: true };
    for (const [tech, p] of Object.entries(validAlloc)) {
      const v = validateResearchAllocation(state, 'team-blue', tech, p);
      if (!v.valid) {
        check1 = v;
        break;
      }
      allocateResearchNoValidation(state, 'team-blue', tech, p);
    }
    console.log(`- First allocation (3 points to GPS): valid = ${check1.valid}`);

    // 2nd allocation: invalid (another 3 points to Wifi, exceeding limit)
    let check2 = validateResearchAllocation(state, 'team-blue', 'Wifi', 3);
    console.log(`- Second allocation (Wifi, +3 points, exceeding limit of 3): valid = ${check2.valid}, reason = "${check2.reason}"`);

    // 3rd allocation: invalid logistics (expansion to disconnected region Canada)
    // Blue Team starting presence is South America, Canada is disconnected from South America
    let check3 = validateLogisticsAllocation(state, 'team-blue', 'Canada', 3);
    console.log(`- Expansion to Canada (disconnected): valid = ${check3.valid}, reason = "${check3.reason}"`);

    if (check1.valid && !check2.valid && !check3.valid) {
      console.log('✅ Passed: The validation rules successfully detected and blocked illegal states!');
    } else {
      console.error('❌ Failed: Validation rules failed to correctly identify illegal states.');
      passed = false;
    }
  } catch (err) {
    console.error('❌ Test 3 Error:', err);
    passed = false;
  }

  console.log();

  // Test 4: Simulate stale state race conditions WITH validation active
  try {
    console.log('Test 4: Simulating Stale State Concurrency WITH Validation Active');
    const state = createMockGameState();

    const allocateResearchWithValidation = (s: GameState, tId: string, techName: string, p: number) => {
      const v = validateResearchAllocation(s, tId, techName, p);
      if (!v.valid) {
        console.log(`- Blocked double-allocation of ${p} points to ${techName} for ${tId}: reason = "${v.reason}"`);
        return;
      }
      allocateResearchNoValidation(s, tId, techName, p);
    };

    // Imagine double execution (stale context)
    const run1Alloc = decideResearch(state, 'team-blue', 3, 'RESEARCHER', 'MEDIUM');
    const run2Alloc = decideResearch(state, 'team-blue', 3, 'RESEARCHER', 'MEDIUM');

    // Commit run1
    Object.entries(run1Alloc).forEach(([tech, p]) => allocateResearchWithValidation(state, 'team-blue', tech, p));
    // Commit run2 (should be blocked by validation)
    Object.entries(run2Alloc).forEach(([tech, p]) => allocateResearchWithValidation(state, 'team-blue', tech, p));

    const totalSpent = state.researchAllocatedByRound[1]['team-blue'] || 0;
    console.log(`- Total points actually spent in round 1 for Blue Team: ${totalSpent}`);

    if (totalSpent === 3) {
      console.log('✅ Passed: Concurrency/stale state double-spend blocked correctly!');
    } else {
      console.error(`❌ Failed: Allowed spent total of ${totalSpent} (expected 3)`);
      passed = false;
    }
  } catch (err) {
    console.error('❌ Test 4 Error:', err);
    passed = false;
  }

  expect(passed).toBe(true);
});
