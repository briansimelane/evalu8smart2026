import {
  GameState,
  TeamRoundData,
  TeamPlanDoc,
  TeamActionDoc,
  TeamLogisticsProgress,
  ImprovementCard,
} from '@/types/game';
import { COMBINATIONS, REGIONS } from '@/data/combinations';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import {
  calculatePlanStats,
  canExpandToRegion as canExpandToRegionRule,
  hasTech,
  isSteveBlocking,
  getCompletedOffices,
  isTeamBuildingOffice,
  getTechnologyCostForTeam as getTechnologyCostForTeamRule,
} from '@/lib/rules';
import { isRuleActiveForTeam, getRuleValueForTeam } from '@/lib/defaultRules';
import { createFacilitatorDefaultPlan } from '@/lib/phaseEngine';
import { computeTurnOrder, normalizePhaseName } from '@/lib/turnOrder';

export interface ResolutionResult {
  valid: boolean;
  error?: string;
  nextState: GameState;
}

/**
 * Pure control-points recalculation across all rounds.
 * Extracted identically from `GameContext.recalculateControlPoints`.
 */
export function recalculateControlPointsForState(prev: GameState): GameState {
  const updatedRounds = prev.rounds.map((round) => {
    const teamControlPoints: Record<string, Record<string, number>> = {};
    const teamControlTotals: Record<string, number> = {};

    prev.teams.forEach((t) => {
      teamControlPoints[t.id] = {};
      teamControlTotals[t.id] = 0;
    });

    REGIONS.forEach((region) => {
      if (isSteveBlocking(prev, region)) return;

      const regionData = REGION_CUSTOMERS.find((r) => r.region === region);
      if (!regionData) return;

      const teamSales: Array<{ teamId: string; salesCount: number; leftmostPosition: number }> = [];

      prev.teams.forEach((team) => {
        const teamData = round.teamData[team.id];
        if (!teamData || !teamData.customersSold || teamData.customersSold.length === 0) return;

        const regionLogisticsData = prev.regionLogistics[region];
        const teamsPresent = regionLogisticsData?.teamsPresent || [];
        const hasOfficeInRegion =
          teamsPresent.includes(team.id) || (regionLogisticsData?.officeCounts?.[team.id] || 0) > 0;
        if (!hasOfficeInRegion) return;

        const soldInRegion = teamData.customersSold.filter((customerId) =>
          regionData.customers.some((c) => c.id === customerId)
        );

        if (soldInRegion.length > 0) {
          let leftmostPosition = Infinity;
          soldInRegion.forEach((customerId) => {
            const customer = regionData.customers.find((c) => c.id === customerId);
            if (customer && customer.position < leftmostPosition) {
              leftmostPosition = customer.position;
            }
          });

          teamSales.push({
            teamId: team.id,
            salesCount: soldInRegion.length,
            leftmostPosition: leftmostPosition === Infinity ? 999 : leftmostPosition,
          });
        }
      });

      if (teamSales.length === 0) return;

      teamSales.sort((a, b) => {
        if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
        return a.leftmostPosition - b.leftmostPosition;
      });

      const regionLogisticsData = prev.regionLogistics[region];
      const isMultiOfficeActive = isRuleActiveForTeam(
        prev.ruleAdjustments,
        'multiple_offices_per_region'
      );
      const totalOffices = Object.values(regionLogisticsData?.officeCounts || {}).reduce(
        (a, b) => a + Number(b),
        0
      );
      const occupiedSlots = isMultiOfficeActive
        ? totalOffices || regionLogisticsData?.teamsPresent.length || 0
        : regionLogisticsData?.teamsPresent.length || 0;
      const scaleCount = Math.min(5, Math.max(1, occupiedSlots));

      if (teamSales.length > 0) {
        const firstTeamId = teamSales[0].teamId;
        const firstPoints = getControlPointsForRegion(region, scaleCount, 'first');
        teamControlPoints[firstTeamId][region] = firstPoints;
        teamControlTotals[firstTeamId] += firstPoints;
      }

      if (teamSales.length > 1) {
        const secondTeamId = teamSales[1].teamId;
        const secondPoints = getControlPointsForRegion(region, scaleCount, 'second');
        teamControlPoints[secondTeamId][region] = secondPoints;
        teamControlTotals[secondTeamId] += secondPoints;
      }
    });

    const newTeamData = { ...round.teamData };
    prev.teams.forEach((team) => {
      const td = newTeamData[team.id];
      if (!td) return;

      const newControlValue = teamControlTotals[team.id] || 0;
      const newRegionControl = teamControlPoints[team.id] || {};

      newTeamData[team.id] = {
        ...td,
        regionControlPoints: newRegionControl,
        controlValue: newControlValue,
        totalMoney: (td.revenue || 0) + newControlValue,
      };
    });

    return {
      ...round,
      teamData: newTeamData,
    };
  });

  return {
    ...prev,
    rounds: updatedRounds,
    updatedAt: new Date(),
  };
}

/**
 * Pure resolver for a team's planning submission (`addRoundData` during planning).
 */
export function resolvePlan(
  prev: GameState,
  roundNumber: number,
  teamId: string,
  data: TeamRoundData | TeamPlanDoc
): ResolutionResult {
  const combinations = prev.combinationsData || COMBINATIONS;
  const selectedCombo = combinations.find(
    (c) => c.combination === data.combination && c.position === data.position
  );
  if (!selectedCombo) {
    return {
      valid: false,
      error: `Invalid combination ${data.combination} or position ${data.position}`,
      nextState: prev,
    };
  }

  const cardUsages = data.cardUsages || {};
  const stats = calculatePlanStats(
    prev,
    teamId,
    data.combination,
    data.position,
    cardUsages,
    combinations
  );

  const existingTeamData = prev.rounds.find((r) => r.roundNumber === roundNumber)?.teamData?.[
    teamId
  ];
  const minExpectedProducts = existingTeamData?.productsProduced ?? stats.productsAvailable;

  if (
    data.price !== stats.calculatedPrice ||
    data.productsProduced < minExpectedProducts ||
    data.researchIcons !== stats.researchPoints ||
    data.logisticsIcons !== stats.logisticsPoints
  ) {
    return {
      valid: false,
      error: `Planning stats mismatch for team ${teamId}. Expected price=${stats.calculatedPrice}, minProduced=${minExpectedProducts}, research=${stats.researchPoints}, logistics=${stats.logisticsPoints}`,
      nextState: prev,
    };
  }

  const fullRoundData: TeamRoundData = {
    teamId,
    combination: data.combination,
    position: data.position,
    price: stats.calculatedPrice,
    productsProduced: Math.max(data.productsProduced, minExpectedProducts),
    improvementCards: stats.improvementPoints,
    researchIcons: stats.researchPoints,
    logisticsIcons: stats.logisticsPoints,
    cardUsages: Object.keys(cardUsages).length > 0 ? cardUsages : undefined,
    improvementCardUsage: data.improvementCardUsage,
    improvementCardId: data.improvementCardId,
    revenue: (data as TeamRoundData).revenue ?? existingTeamData?.revenue ?? 0,
    technologiesResearched:
      (data as TeamRoundData).technologiesResearched ??
      existingTeamData?.technologiesResearched ??
      [],
    expansionLocations:
      (data as TeamRoundData).expansionLocations ?? existingTeamData?.expansionLocations ?? [],
    salesByRegion:
      (data as TeamRoundData).salesByRegion ?? existingTeamData?.salesByRegion ?? {},
    regionControlPoints:
      (data as TeamRoundData).regionControlPoints ?? existingTeamData?.regionControlPoints ?? {},
    controlValue: (data as TeamRoundData).controlValue ?? existingTeamData?.controlValue ?? 0,
    totalMoney: (data as TeamRoundData).totalMoney ?? existingTeamData?.totalMoney ?? 0,
    customersSold: (data as TeamRoundData).customersSold ?? existingTeamData?.customersSold,
    nfcSalesUnits: (data as TeamRoundData).nfcSalesUnits ?? existingTeamData?.nfcSalesUnits,
    eligiblePriceCustomers:
      (data as TeamRoundData).eligiblePriceCustomers ?? existingTeamData?.eligiblePriceCustomers,
    eligibleValueCustomers:
      (data as TeamRoundData).eligibleValueCustomers ?? existingTeamData?.eligibleValueCustomers,
    eligibleSalesUnits:
      (data as TeamRoundData).eligibleSalesUnits ?? existingTeamData?.eligibleSalesUnits,
    demandFulfillmentRate:
      (data as TeamRoundData).demandFulfillmentRate ?? existingTeamData?.demandFulfillmentRate,
    facilitatorDefault: (data as TeamRoundData).facilitatorDefault,
  };

  // Mark used improvement cards if specified in cardUsages
  let updatedCards: ImprovementCard[] = prev.improvementCards || [];
  const usedCardIds = Object.entries(cardUsages)
    .filter(([_, usage]) => usage === 'use' || usage === 'product')
    .map(([idStr]) => Number(idStr));
  if (usedCardIds.length > 0) {
    updatedCards = updatedCards.map((card) =>
      card.availableForTeam === teamId && usedCardIds.includes(card.id)
        ? { ...card, used: true, usedBy: teamId }
        : card
    );
  }

  const rounds = [...prev.rounds];
  const roundIndex = rounds.findIndex((r) => r.roundNumber === roundNumber);

  if (roundIndex === -1) {
    rounds.push({
      roundNumber,
      teamData: { [teamId]: fullRoundData },
    });
  } else {
    rounds[roundIndex] = {
      ...rounds[roundIndex],
      teamData: {
        ...rounds[roundIndex].teamData,
        [teamId]: fullRoundData,
      },
    };
  }

  // Stamp GPS bonus claimed once per game when submitting a production plan (DR-1)
  const currentPhaseNorm = (prev.currentPhase || 'planning').toLowerCase();
  const isPlanningSubmission =
    currentPhaseNorm === 'planning' ||
    (fullRoundData.productsProduced !== undefined && fullRoundData.customersSold === undefined);
  const hasGPS = hasTech(prev, teamId, 'GPS');
  const alreadyClaimedGPS = Boolean(prev.advancedState?.gpsBonusClaimed?.[teamId]);
  let updatedAdvanced = prev.advancedState || {};
  if (isPlanningSubmission && hasGPS && !alreadyClaimedGPS) {
    updatedAdvanced = {
      ...updatedAdvanced,
      gpsBonusClaimed: {
        ...(updatedAdvanced.gpsBonusClaimed || {}),
        [teamId]: true,
      },
    };
  }

  return {
    valid: true,
    nextState: {
      ...prev,
      rounds,
      improvementCards: updatedCards,
      currentRound: Math.max(prev.currentRound, roundNumber),
      advancedState: updatedAdvanced,
      updatedAt: new Date(),
    },
  };
}

/**
 * Pure resolver for improvement card claim (`claimImprovementCard`).
 */
export function resolveImprovement(
  prev: GameState,
  teamId: string,
  cardId: number
): ResolutionResult {
  const alreadyClaimed = prev.improvementCards.some(
    (c) => c.availableForTeam === teamId && c.allocatedInRound === prev.currentRound
  );
  if (alreadyClaimed) {
    return {
      valid: false,
      error: `Team ${teamId} has already claimed an improvement card in round ${prev.currentRound}`,
      nextState: prev,
    };
  }

  const cardAlreadyTaken = prev.improvementCards.some(
    (c) => c.id === cardId && c.allocatedInRound === prev.currentRound
  );
  if (cardAlreadyTaken && cardId >= 0) {
    return {
      valid: false,
      error: `Card ${cardId} has already been claimed in round ${prev.currentRound}`,
      nextState: prev,
    };
  }

  const newCards = [...prev.improvementCards];
  if (cardId < 0) {
    newCards.push({
      id: cardId,
      icon1: 'Product',
      icon2: 'None' as any,
      availableForTeam: teamId,
      used: false,
      isInitial: false,
      allocatedInRound: prev.currentRound,
    });
  } else {
    const cardData = AVAILABLE_IMPROVEMENT_CARDS.find((c) => c.id === cardId);
    if (!cardData) {
      return {
        valid: false,
        error: `Unknown improvement card ${cardId}`,
        nextState: prev,
      };
    }
    newCards.push({
      id: cardData.id,
      icon1: cardData.icon1,
      icon2: cardData.icon2,
      availableForTeam: teamId,
      used: false,
      isInitial: false,
      allocatedInRound: prev.currentRound,
    });
  }

  // Automatically add product-only cards for teams with 0 improvement
  const currentRoundData = prev.rounds.find((r) => r.roundNumber === prev.currentRound);
  if (currentRoundData) {
    prev.teams.forEach((t) => {
      const tData = currentRoundData.teamData[t.id];
      const hasCard = newCards.some(
        (c) => c.availableForTeam === t.id && c.allocatedInRound === prev.currentRound
      );
      if (tData && tData.improvementCards === 0 && !hasCard) {
        const productCardId = -(newCards.filter((c) => c.id < 0).length + 1);
        newCards.push({
          id: productCardId,
          icon1: 'Product',
          icon2: 'None' as any,
          availableForTeam: t.id,
          used: false,
          isInitial: false,
          allocatedInRound: prev.currentRound,
        });
      }
    });
  }

  return {
    valid: true,
    nextState: {
      ...prev,
      improvementCards: newCards,
      updatedAt: new Date(),
    },
  };
}

/**
 * Pure single-technology research allocation step (matches `GameContext.allocateResearch`).
 */
export function resolveSingleResearchAllocation(
  prev: GameState,
  teamId: string,
  technology: string,
  points: number
): ResolutionResult {
  if (points <= 0 || !Number.isInteger(points)) {
    return { valid: false, error: `Invalid research points (${points})`, nextState: prev };
  }

  const tech = prev.technologies[technology];
  if (!tech) {
    return { valid: false, error: `Unknown technology ${technology}`, nextState: prev };
  }

  const currentRound = prev.currentRound;
  const roundData = prev.rounds.find((r) => r.roundNumber === currentRound);
  const teamRoundData = roundData?.teamData[teamId];
  if (!teamRoundData) {
    return {
      valid: false,
      error: `No plan submitted for team ${teamId} in round ${currentRound}`,
      nextState: prev,
    };
  }

  const allowedIcons = teamRoundData.researchIcons || 0;
  const roundAllocations = prev.researchAllocatedByRound[currentRound] || {};
  const prevSpent = roundAllocations[teamId] || 0;

  if (prevSpent + points > allowedIcons) {
    return {
      valid: false,
      error: `Allocating ${points} research points would exceed allowed limit of ${allowedIcons} (already spent ${prevSpent}) for team ${teamId}`,
      nextState: prev,
    };
  }

  const currentTPAll = { ...prev.teamResearchProgress };
  const teamProgress = currentTPAll[teamId] || {
    teamId,
    technologyInvestments: {},
    completedTechnologies: [],
  };

  if (teamProgress.completedTechnologies.includes(technology)) {
    const totalTechs = Object.keys(prev.technologies).length;
    if (teamProgress.completedTechnologies.length < totalTechs) {
      return {
        valid: false,
        error: `Technology ${technology} is already completed by team ${teamId}`,
        nextState: prev,
      };
    }
  }

  const currentInvestment = teamProgress.technologyInvestments[technology] || 0;
  const newInvestment = currentInvestment + points;

  const newTeamProgress = {
    ...teamProgress,
    technologyInvestments: {
      ...teamProgress.technologyInvestments,
      [technology]: newInvestment,
    },
  };
  currentTPAll[teamId] = newTeamProgress;

  const currentPatentHolder = prev.patents[technology];
  const costForActingTeam = getTechnologyCostForTeamRule(prev, teamId, technology);

  const newPatents = { ...prev.patents };
  const completedByActingTeam = newInvestment >= costForActingTeam;

  let nextRounds = prev.rounds;
  let nextAdvancedState = prev.advancedState;

  if (completedByActingTeam && !newTeamProgress.completedTechnologies.includes(technology)) {
    newTeamProgress.completedTechnologies = [
      ...newTeamProgress.completedTechnologies,
      technology,
    ];
    currentTPAll[teamId] = newTeamProgress;

    if (!currentPatentHolder) {
      newPatents[technology] = teamId;
    }

    const isTechPerksActive = isRuleActiveForTeam(
      prev.ruleAdjustments,
      'tech_permanent_benefits',
      teamId
    );
    const isGpsTech = technology.toUpperCase().includes('GPS');
    const alreadyClaimedGps = Boolean(prev.advancedState?.gpsBonusClaimed?.[teamId]);

    if (isTechPerksActive && isGpsTech && !alreadyClaimedGps) {
      const rounds = [...nextRounds];
      const rIndex = rounds.findIndex((r) => r.roundNumber === currentRound);
      if (rIndex !== -1 && rounds[rIndex].teamData[teamId]) {
        const rData = { ...rounds[rIndex] };
        const existingTeamData = rData.teamData[teamId];
        const tData: TeamRoundData = {
          ...existingTeamData,
          productsProduced: (existingTeamData.productsProduced || 0) + 5,
        };
        rData.teamData = { ...rData.teamData, [teamId]: tData };
        rounds[rIndex] = rData;
        nextRounds = rounds;
      }

      nextAdvancedState = {
        ...(nextAdvancedState || {}),
        gpsBonusClaimed: {
          ...(nextAdvancedState?.gpsBonusClaimed || {}),
          [teamId]: true,
        },
      };
    }
  }

  const finalPatents = newPatents;
  const stateWithPatents = {
    ...prev,
    rounds: nextRounds,
    advancedState: nextAdvancedState,
    patents: finalPatents,
    teamResearchProgress: currentTPAll,
  };

  prev.teams.forEach((t) => {
    const tp = currentTPAll[t.id] || {
      teamId: t.id,
      technologyInvestments: {},
      completedTechnologies: [],
    };
    const invested = tp.technologyInvestments[technology] || 0;
    const cost = getTechnologyCostForTeamRule(stateWithPatents, t.id, technology);
    if (invested >= cost && !tp.completedTechnologies.includes(technology)) {
      tp.completedTechnologies = [...tp.completedTechnologies, technology];
    }
    currentTPAll[t.id] = tp;
  });

  const updatedTech = {
    ...tech,
    teamProgress: {
      ...tech.teamProgress,
      [teamId]: newInvestment,
    },
  };

  const newRoundAllocations = {
    ...prev.researchAllocatedByRound,
    [currentRound]: {
      ...roundAllocations,
      [teamId]: prevSpent + points,
    },
  };

  let updatedRounds = nextRounds;
  const roundIndex = updatedRounds.findIndex((r) => r.roundNumber === currentRound);
  if (roundIndex !== -1) {
    const roundObj = updatedRounds[roundIndex];
    const updatedTeamDataMap = { ...roundObj.teamData };
    let hasChanges = false;

    const tempState = {
      ...prev,
      rounds: updatedRounds,
      advancedState: nextAdvancedState,
      teamResearchProgress: currentTPAll,
      patents: finalPatents,
    };

    prev.teams.forEach((t) => {
      const existingTeamData = roundObj.teamData[t.id];
      if (existingTeamData && existingTeamData.combination && existingTeamData.position) {
        const newStats = calculatePlanStats(
          tempState,
          t.id,
          existingTeamData.combination,
          existingTeamData.position,
          existingTeamData.cardUsages || {},
          prev.combinationsData || COMBINATIONS
        );

        const targetProducts = Math.max(
          existingTeamData.productsProduced || 0,
          newStats.productsAvailable
        );

        if (
          existingTeamData.productsProduced !== targetProducts ||
          existingTeamData.logisticsIcons !== newStats.logisticsPoints ||
          existingTeamData.researchIcons !== newStats.researchPoints ||
          existingTeamData.price !== newStats.calculatedPrice
        ) {
          hasChanges = true;
          updatedTeamDataMap[t.id] = {
            ...existingTeamData,
            price: newStats.calculatedPrice,
            productsProduced: targetProducts,
            researchIcons: newStats.researchPoints,
            logisticsIcons: newStats.logisticsPoints,
            improvementCards: newStats.improvementPoints,
          };
        }
      }
    });

    if (hasChanges) {
      updatedRounds = [...updatedRounds];
      updatedRounds[roundIndex] = {
        ...roundObj,
        teamData: updatedTeamDataMap,
      };
    }
  }

  return {
    valid: true,
    nextState: {
      ...prev,
      rounds: updatedRounds,
      advancedState: nextAdvancedState,
      teamResearchProgress: currentTPAll,
      technologies: {
        ...prev.technologies,
        [technology]: updatedTech,
      },
      patents: finalPatents,
      researchAllocatedByRound: newRoundAllocations,
      updatedAt: new Date(),
    },
  };
}

/**
 * Pure resolver for an entire team research turn (`allocations` map of technology -> points).
 */
export function resolveResearch(
  prev: GameState,
  teamId: string,
  allocations: Record<string, number>,
  finishTurn = true
): ResolutionResult {
  const currentRound = prev.currentRound;
  const roundData = prev.rounds.find((r) => r.roundNumber === currentRound);
  const teamRoundData = roundData?.teamData[teamId];
  if (!teamRoundData) {
    return {
      valid: false,
      error: `No plan submitted for team ${teamId} in round ${currentRound}`,
      nextState: prev,
    };
  }

  const allowedIcons = teamRoundData.researchIcons || 0;
  const prevSpent = prev.researchAllocatedByRound?.[currentRound]?.[teamId] || 0;
  const entries = Object.entries(allocations || {}).filter(([_, pts]) => Number(pts) > 0);
  const sumPoints = entries.reduce((acc, [_, pts]) => acc + Number(pts), 0);

  for (const [_, pts] of Object.entries(allocations || {})) {
    if (typeof pts !== 'number' || !Number.isInteger(pts) || pts < 0) {
      return { valid: false, error: 'Research points must be non-negative integers', nextState: prev };
    }
  }

  if (prevSpent + sumPoints > allowedIcons) {
    return {
      valid: false,
      error: `Total research points (${sumPoints}) exceed remaining allowance (${allowedIcons - prevSpent})`,
      nextState: prev,
    };
  }

  let workingState = prev;
  for (const [tech, pts] of entries) {
    const step = resolveSingleResearchAllocation(workingState, teamId, tech, pts);
    if (!step.valid) {
      return step;
    }
    workingState = step.nextState;
  }

  if (finishTurn) {
    const latestRoundData = workingState.rounds.find((r) => r.roundNumber === currentRound);
    const finalAllowed = latestRoundData?.teamData[teamId]?.researchIcons ?? allowedIcons;
    const roundMap = { ...(workingState.researchAllocatedByRound?.[currentRound] || {}) };
    roundMap[teamId] = finalAllowed;
    workingState = {
      ...workingState,
      researchAllocatedByRound: {
        ...workingState.researchAllocatedByRound,
        [currentRound]: roundMap,
      },
      updatedAt: new Date(),
    };
  }

  return { valid: true, nextState: workingState };
}

/**
 * Pure single-region logistics allocation step (matches `GameContext.allocateLogistics`).
 */
export function resolveSingleLogisticsAllocation(
  prev: GameState,
  teamId: string,
  regionName: string,
  points: number
): ResolutionResult {
  if (points <= 0 || !Number.isInteger(points)) {
    return { valid: false, error: `Invalid logistics points (${points})`, nextState: prev };
  }

  const region = prev.regionLogistics[regionName];
  if (!region) {
    return { valid: false, error: `Unknown region ${regionName}`, nextState: prev };
  }

  const teamProgress = prev.teamLogisticsProgress[teamId];
  if (!teamProgress) {
    return { valid: false, error: `Missing logistics progress for team ${teamId}`, nextState: prev };
  }

  const currentRound = prev.currentRound;
  const roundData = prev.rounds.find((r) => r.roundNumber === currentRound);
  const teamRoundData = roundData?.teamData[teamId];
  if (!teamRoundData) {
    return {
      valid: false,
      error: `No plan submitted for team ${teamId} in round ${currentRound}`,
      nextState: prev,
    };
  }

  const allowedIcons = teamRoundData.logisticsIcons || 0;
  const roundAllocations = prev.logisticsAllocatedByRound[currentRound] || {};
  const prevSpent = roundAllocations[teamId] || 0;

  if (prevSpent + points > allowedIcons) {
    return {
      valid: false,
      error: `Allocating ${points} logistics points would exceed allowed limit of ${allowedIcons} (already spent ${prevSpent}) for team ${teamId}`,
      nextState: prev,
    };
  }

  if (!canExpandToRegionRule(prev, teamId, regionName)) {
    return {
      valid: false,
      error: `Expansion into ${regionName} not allowed for team ${teamId}`,
      nextState: prev,
    };
  }

  const baseCost = region.logisticsCost || 2;
  const discountedCost = Math.max(1, baseCost - 1);
  const alreadyHasPresence =
    region.teamsPresent.includes(teamId) || (region.officeCounts?.[teamId] || 0) > 0;
  const currentOffices = region.officeCounts?.[teamId] || (alreadyHasPresence ? 1 : 0);

  const rawCurrentInvestment =
    teamProgress.regionInvestments[regionName] || region.teamProgress?.[teamId] || 0;
  const effectiveCurrentInvestment = Math.max(
    rawCurrentInvestment,
    alreadyHasPresence ? baseCost : 0
  );
  const newInvestment = effectiveCurrentInvestment + points;

  const updatedRegionProgress = {
    ...region.teamProgress,
    [teamId]: newInvestment,
  };

  const isMultiOfficeActive = isRuleActiveForTeam(
    prev.ruleAdjustments,
    'multiple_offices_per_region',
    teamId
  );

  let officesEarnedRaw = 0;
  if (isMultiOfficeActive) {
    if (newInvestment >= baseCost) {
      const extraInvest = newInvestment - baseCost;
      officesEarnedRaw = 1 + Math.floor(extraInvest / discountedCost);
    } else {
      officesEarnedRaw = 0;
    }
  } else {
    officesEarnedRaw = Math.floor(newInvestment / baseCost);
  }

  let updatedOfficeCount: number;
  if (isMultiOfficeActive) {
    const baseCostForClamp = region.logisticsCost || 2;
    let otherOccupancy = 0;
    const otherTeamIds = new Set<string>([
      ...Object.keys(region.officeCounts || {}),
      ...Object.keys(region.teamProgress || {}),
      ...(region.teamsPresent || []),
    ]);
    otherTeamIds.forEach((tid) => {
      if (tid === teamId) return;
      const completedOther = getCompletedOffices(region, tid);
      const buildingOther = isTeamBuildingOffice(region, tid, baseCostForClamp) ? 1 : 0;
      otherOccupancy += completedOther + buildingOther;
    });
    const maxForThisTeam = Math.max(0, region.maxTeams - otherOccupancy);
    updatedOfficeCount = Math.min(Math.max(currentOffices, officesEarnedRaw), maxForThisTeam);
  } else {
    updatedOfficeCount = officesEarnedRaw >= 1 ? 1 : currentOffices;
  }

  const hasPresence = updatedOfficeCount >= 1;

  const updatedRegion = {
    ...region,
    teamProgress: updatedRegionProgress,
    officeCounts: {
      ...(region.officeCounts || {}),
      [teamId]: updatedOfficeCount,
    },
    teamsPresent:
      hasPresence && !alreadyHasPresence
        ? [...region.teamsPresent, teamId]
        : region.teamsPresent,
  };

  const updatedTeamProgress: TeamLogisticsProgress = {
    ...teamProgress,
    regionInvestments: {
      ...teamProgress.regionInvestments,
      [regionName]: newInvestment,
    },
    regionsWithPresence:
      hasPresence && !alreadyHasPresence
        ? [...teamProgress.regionsWithPresence, regionName]
        : teamProgress.regionsWithPresence,
  };

  const newRoundAllocations = {
    ...prev.logisticsAllocatedByRound,
    [currentRound]: {
      ...roundAllocations,
      [teamId]: prevSpent + points,
    },
  };

  return {
    valid: true,
    nextState: {
      ...prev,
      regionLogistics: {
        ...prev.regionLogistics,
        [regionName]: updatedRegion,
      },
      teamLogisticsProgress: {
        ...prev.teamLogisticsProgress,
        [teamId]: updatedTeamProgress,
      },
      logisticsAllocatedByRound: newRoundAllocations,
      updatedAt: new Date(),
    },
  };
}

/**
 * Pure resolver for an entire team logistics turn (`allocations` map of regionName -> points).
 */
export function resolveLogistics(
  prev: GameState,
  teamId: string,
  allocations: Record<string, number>,
  finishTurn = true
): ResolutionResult {
  const currentRound = prev.currentRound;
  const roundData = prev.rounds.find((r) => r.roundNumber === currentRound);
  const teamRoundData = roundData?.teamData[teamId];
  if (!teamRoundData) {
    return {
      valid: false,
      error: `No plan submitted for team ${teamId} in round ${currentRound}`,
      nextState: prev,
    };
  }

  const allowedIcons = teamRoundData.logisticsIcons || 0;
  const prevSpent = prev.logisticsAllocatedByRound?.[currentRound]?.[teamId] || 0;

  for (const [_, pts] of Object.entries(allocations || {})) {
    if (typeof pts !== 'number' || !Number.isInteger(pts) || pts < 0) {
      return { valid: false, error: 'Logistics points must be non-negative integers', nextState: prev };
    }
  }

  const entries = Object.entries(allocations || {}).filter(([_, pts]) => Number(pts) > 0);
  const sumPoints = entries.reduce((acc, [_, pts]) => acc + Number(pts), 0);

  if (prevSpent + sumPoints > allowedIcons) {
    return {
      valid: false,
      error: `Total logistics points (${sumPoints}) exceed remaining allowance (${allowedIcons - prevSpent})`,
      nextState: prev,
    };
  }

  let workingState = prev;
  for (const [regionName, pts] of entries) {
    const step = resolveSingleLogisticsAllocation(workingState, teamId, regionName, pts);
    if (!step.valid) {
      return step;
    }
    workingState = step.nextState;
  }

  if (finishTurn) {
    const roundAllocations = { ...(workingState.logisticsAllocatedByRound?.[currentRound] || {}) };
    roundAllocations[teamId] = allowedIcons;
    workingState = {
      ...workingState,
      logisticsAllocatedByRound: {
        ...workingState.logisticsAllocatedByRound,
        [currentRound]: roundAllocations,
      },
      updatedAt: new Date(),
    };
  }

  return { valid: true, nextState: workingState };
}

/**
 * Pure resolver for a team's sales turn (`SalesPhase` submission).
 */
export function resolveSales(
  prev: GameState,
  teamId: string,
  payload: {
    customersSold?: string[];
    nfcSalesUnits?: number;
  }
): ResolutionResult {
  const currentRound = prev.currentRound;
  const roundData = prev.rounds.find((r) => r.roundNumber === currentRound);
  const teamRoundData = roundData?.teamData[teamId];
  if (!teamRoundData) {
    return {
      valid: false,
      error: `No plan submitted for team ${teamId} in round ${currentRound}`,
      nextState: prev,
    };
  }

  const customersSold = Array.from(new Set(payload.customersSold || []));
  const nfcSalesUnits = Number(payload.nfcSalesUnits || 0);

  if (!Number.isInteger(nfcSalesUnits) || nfcSalesUnits < 0) {
    return { valid: false, error: 'Invalid NFC sales units', nextState: prev };
  }

  const hasNfc = hasTech(prev, teamId, 'NFC');
  const has4G = hasTech(prev, teamId, '4G');

  if (nfcSalesUnits > 0 && !hasNfc) {
    return {
      valid: false,
      error: 'NFC Direct Sales require completed NFC technology',
      nextState: prev,
    };
  }
  if (nfcSalesUnits > 3) {
    return {
      valid: false,
      error: 'NFC Direct Sales cannot exceed 3 units per round',
      nextState: prev,
    };
  }

  const totalProductsSold = customersSold.length + nfcSalesUnits;
  if (totalProductsSold > (teamRoundData.productsProduced || 0)) {
    return {
      valid: false,
      error: `Total sales (${totalProductsSold}) exceed products produced (${teamRoundData.productsProduced || 0})`,
      nextState: prev,
    };
  }

  // Collect customers already sold to OTHER teams in this round
  const alreadySoldByOthers = new Set<string>();
  Object.entries(roundData.teamData).forEach(([otherTeamId, td]) => {
    if (otherTeamId !== teamId && td.customersSold) {
      td.customersSold.forEach((cid) => alreadySoldByOthers.add(cid));
    }
  });

  // Determine team's office regions and completed technologies
  const logisticsProgress = prev.teamLogisticsProgress[teamId];
  const boardRegions = Object.entries(prev.regionLogistics || {})
    .filter(([_, reg]) => reg.teamsPresent && reg.teamsPresent.includes(teamId))
    .map(([rName]) => rName);
  const teamRegions = Array.from(
    new Set([...(logisticsProgress?.regionsWithPresence || []), ...boardRegions])
  );

  const completedTechs = new Set<string>(
    prev.teamResearchProgress[teamId]?.completedTechnologies || []
  );
  Object.entries(prev.technologies || {}).forEach(([tName, tech]) => {
    const invested = tech.teamProgress?.[teamId] || 0;
    const cost = getTechnologyCostForTeamRule(prev, teamId, tName);
    if (invested >= cost) completedTechs.add(tName);
  });

  const salesByRegion: Record<string, number> = {};
  const nonOfficeSalesByRegion: Record<string, number> = {};

  for (const cid of customersSold) {
    if (alreadySoldByOthers.has(cid)) {
      return {
        valid: false,
        error: `Customer ${cid} has already been sold to another team this round`,
        nextState: prev,
      };
    }

    const regionEntry = REGION_CUSTOMERS.find((r) => r.customers.some((c) => c.id === cid));
    if (!regionEntry) {
      return {
        valid: false,
        error: `Unknown customer ID ${cid}`,
        nextState: prev,
      };
    }

    const regionName = regionEntry.region;
    if (isSteveBlocking(prev, regionName)) {
      return {
        valid: false,
        error: `Region ${regionName} is currently blocked by Steve`,
        nextState: prev,
      };
    }

    const hasOffice = teamRegions.includes(regionName);
    if (!hasOffice) {
      if (!has4G) {
        return {
          valid: false,
          error: `Team ${teamId} does not have presence in ${regionName}`,
          nextState: prev,
        };
      }
      const nextCount = (nonOfficeSalesByRegion[regionName] || 0) + 1;
      if (nextCount > 1) {
        return {
          valid: false,
          error: `4G allows at most 1 customer sale in non-office region ${regionName}`,
          nextState: prev,
        };
      }
      nonOfficeSalesByRegion[regionName] = nextCount;
    }

    const customer = regionEntry.customers.find((c) => c.id === cid)!;
    if (customer.type === 'price') {
      if (teamRoundData.price > (customer.price || 0)) {
        return {
          valid: false,
          error: `Customer ${cid} requires price <= $${customer.price}, but team price is $${teamRoundData.price}`,
          nextState: prev,
        };
      }
    } else if (customer.type === 'value') {
      const reqNorm = (customer.technology || '').toUpperCase();
      const hasReqTech = Array.from(completedTechs).some(
        (t) => (t || '').toUpperCase() === reqNorm
      );
      if (!hasReqTech) {
        return {
          valid: false,
          error: `Customer ${cid} requires ${customer.technology} technology`,
          nextState: prev,
        };
      }
    }

    salesByRegion[regionName] = (salesByRegion[regionName] || 0) + 1;
  }

  // Compute eligibility metrics identically to SalesPhase
  const allRegionNames = REGION_CUSTOMERS.map((r) => r.region);
  const displayedRegions = (has4G ? allRegionNames : teamRegions).filter(
    (rName) => !isSteveBlocking(prev, rName)
  );

  let priceCount = 0;
  let valueCount = 0;
  displayedRegions.forEach((regionName) => {
    const regionData = REGION_CUSTOMERS.find((r) => r.region === regionName);
    if (!regionData) return;
    regionData.customers.forEach((customer) => {
      if (alreadySoldByOthers.has(customer.id)) return;
      if (customer.type === 'price') {
        if (teamRoundData.price <= (customer.price || 0)) priceCount++;
      } else if (customer.type === 'value' && customer.technology) {
        const reqNorm = customer.technology.toUpperCase();
        if (Array.from(completedTechs).some((t) => (t || '').toUpperCase() === reqNorm)) {
          valueCount++;
        }
      }
    });
  });

  const totalEligible = priceCount + valueCount;
  const demandFulfillmentRate =
    totalEligible === 0 ? 0 : (totalProductsSold / totalEligible) * 100;
  const revenue = totalProductsSold * teamRoundData.price;

  const updatedTeamData: TeamRoundData = {
    ...teamRoundData,
    salesByRegion,
    customersSold,
    nfcSalesUnits,
    eligiblePriceCustomers: priceCount,
    eligibleValueCustomers: valueCount,
    eligibleSalesUnits: totalEligible,
    demandFulfillmentRate: Number(demandFulfillmentRate.toFixed(1)),
    revenue,
    totalMoney: revenue + (teamRoundData.controlValue || 0),
  };

  const stepPlan = resolvePlan(prev, currentRound, teamId, updatedTeamData);
  const stateWithSales = stepPlan.valid ? stepPlan.nextState : prev;
  const stateWithControl = recalculateControlPointsForState(stateWithSales);

  return {
    valid: true,
    nextState: stateWithControl,
  };
}

/**
 * Pure resolver for wildcard token conversions and Steve contributions (`WildcardsWidget`).
 */
export function resolveWildcardAction(
  prev: GameState,
  teamId: string,
  payload: {
    wildcardConversions?: {
      product?: number;
      research?: number;
      logistics?: number;
      improvement?: number;
    };
    steveContribution?: number;
  }
): ResolutionResult {
  if (!isRuleActiveForTeam(prev.ruleAdjustments, 'wildcard_tokens_system', teamId)) {
    return {
      valid: false,
      error: 'Wildcard tokens system is not active for this team',
      nextState: prev,
    };
  }

  const currentRound = prev.currentRound;
  const currentAdvanced = prev.advancedState || {};
  const wildcardsMap = { ...(currentAdvanced.wildcards || {}) };
  const tWildcard = wildcardsMap[teamId] || {
    teamId,
    totalTokens: 10,
    usedInRound: {},
    conversionsByRound: {},
  };

  const steve = currentAdvanced.steve || {
    activeRegion: null,
    wildcardsContributed: {},
    wildcardsContributedByRound: {},
  };

  const convsByR = { ...(tWildcard.conversionsByRound || {}) };
  const currentRoundConvs = {
    ...(convsByR[currentRound] || {}),
    ...(payload.wildcardConversions || {}),
  };

  // Validate per-action conversion caps
  const productConv = Number(currentRoundConvs.product || 0);
  const researchConv = Number(currentRoundConvs.research || 0);
  const logisticsConv = Number(currentRoundConvs.logistics || 0);
  const improvementConv = Number(currentRoundConvs.improvement || 0);

  if (
    productConv < 0 ||
    productConv > 2 ||
    researchConv < 0 ||
    researchConv > 2 ||
    logisticsConv < 0 ||
    logisticsConv > 2 ||
    improvementConv < 0 ||
    improvementConv > 1
  ) {
    return {
      valid: false,
      error: 'Wildcard conversion exceeds per-action cap (max 2 for product/research/logistics, max 1 for improvement)',
      nextState: prev,
    };
  }

  const steveByRoundMap = { ...(steve.wildcardsContributedByRound || {}) };
  const roundSteveMap = { ...(steveByRoundMap[currentRound] || {}) };
  const prevSteveInRound = Number(roundSteveMap[teamId] || 0);
  const nextSteveInRound =
    payload.steveContribution !== undefined
      ? Number(payload.steveContribution)
      : prevSteveInRound;

  if (nextSteveInRound < 0) {
    return { valid: false, error: 'Steve contribution cannot be negative', nextState: prev };
  }

  const steveDelta = nextSteveInRound - prevSteveInRound;
  const steveContribs = { ...(steve.wildcardsContributed || {}) };
  const currentTotalSteve = Object.values(steveContribs).reduce(
    (a, b) => Number(a) + Number(b),
    0
  );
  const nextTotalSteve = currentTotalSteve + steveDelta;
  if (nextTotalSteve < 0 || nextTotalSteve > 5) {
    return {
      valid: false,
      error: 'Total Steve wildcard contributions cannot exceed 5',
      nextState: prev,
    };
  }

  const nextTeamSteve = (steveContribs[teamId] || 0) + steveDelta;
  if (nextTeamSteve < 0) {
    return { valid: false, error: 'Team Steve contribution cannot be negative', nextState: prev };
  }

  const roundConvsTotal = productConv + researchConv + logisticsConv + improvementConv;
  const roundUsedTotal = roundConvsTotal + nextSteveInRound;

  const usedInR = { ...(tWildcard.usedInRound || {}) };
  usedInR[currentRound] = roundUsedTotal;

  const totalUsedAllRounds = Object.values(usedInR).reduce(
    (a, b) => Number(a) + Number(b),
    0
  );
  if (totalUsedAllRounds > (tWildcard.totalTokens || 10)) {
    return {
      valid: false,
      error: `Total wildcard tokens used (${totalUsedAllRounds}) exceeds team budget (${tWildcard.totalTokens || 10})`,
      nextState: prev,
    };
  }

  convsByR[currentRound] = {
    product: productConv,
    research: researchConv,
    logistics: logisticsConv,
    improvement: improvementConv,
  };

  wildcardsMap[teamId] = {
    ...tWildcard,
    usedInRound: usedInR,
    conversionsByRound: convsByR,
  };

  steveContribs[teamId] = nextTeamSteve;
  roundSteveMap[teamId] = nextSteveInRound;
  steveByRoundMap[currentRound] = roundSteveMap;

  const updatedAdvanced = {
    ...currentAdvanced,
    wildcards: wildcardsMap,
    steve: {
      ...steve,
      activeRegion: steve.activeRegion,
      wildcardsContributed: steveContribs,
      wildcardsContributedByRound: steveByRoundMap,
    },
  };

  let updatedRounds = prev.rounds;
  const roundIndex = prev.rounds.findIndex((r) => r.roundNumber === currentRound);
  if (roundIndex !== -1 && prev.rounds[roundIndex].teamData?.[teamId]) {
    const roundData = prev.rounds[roundIndex];
    const existingTeamData = roundData.teamData[teamId];
    if (existingTeamData.combination && existingTeamData.position) {
      const tempState = { ...prev, advancedState: updatedAdvanced };
      const newStats = calculatePlanStats(
        tempState,
        teamId,
        existingTeamData.combination,
        existingTeamData.position,
        existingTeamData.cardUsages || {},
        prev.combinationsData || COMBINATIONS
      );

      const targetProducts = Math.max(
        existingTeamData.productsProduced || 0,
        newStats.productsAvailable
      );

      updatedRounds = [...prev.rounds];
      updatedRounds[roundIndex] = {
        ...roundData,
        teamData: {
          ...roundData.teamData,
          [teamId]: {
            ...existingTeamData,
            price: newStats.calculatedPrice,
            productsProduced: targetProducts,
            researchIcons: newStats.researchPoints,
            logisticsIcons: newStats.logisticsPoints,
            improvementCards: newStats.improvementPoints,
          },
        },
      };
    }
  }

  return {
    valid: true,
    nextState: {
      ...prev,
      rounds: updatedRounds,
      advancedState: updatedAdvanced,
      updatedAt: new Date(),
    },
  };
}

/**
 * Pure dispatcher that resolves a `TeamActionDoc` against a `GameState` and advances `turn.index`.
 */
export function resolveTeamAction(
  prev: GameState,
  action: TeamActionDoc
): ResolutionResult {
  const phase = normalizePhaseName(action.phase);
  const currentPhase = normalizePhaseName(prev.currentPhase);

  if (phase === 'wildcard') {
    if (action.round !== prev.currentRound) {
      return {
        valid: false,
        error: `Wildcard action round (${action.round}) does not match current round (${prev.currentRound})`,
        nextState: prev,
      };
    }
    return resolveWildcardAction(prev, action.teamId, {
      wildcardConversions: action.payload?.wildcardConversions,
      steveContribution: action.payload?.steveContribution,
    });
  }

  if (action.round !== prev.currentRound || phase !== currentPhase) {
    return {
      valid: false,
      error: `Action round/phase (${action.round}/${phase}) does not match active state (${prev.currentRound}/${currentPhase})`,
      nextState: prev,
    };
  }

  if (prev.turn) {
    const expectedTeam = prev.turn.order[prev.turn.index];
    if (expectedTeam && expectedTeam !== action.teamId) {
      return {
        valid: false,
        error: `Out of turn: expected ${expectedTeam}, got ${action.teamId}`,
        nextState: prev,
      };
    }
  }

  let res: ResolutionResult;
  if (phase === 'improvement') {
    if (typeof action.payload?.cardId !== 'number') {
      return { valid: false, error: 'Missing cardId in improvement action', nextState: prev };
    }
    res = resolveImprovement(prev, action.teamId, action.payload.cardId);
  } else if (phase === 'innovation') {
    res = resolveResearch(prev, action.teamId, action.payload?.allocations || {}, true);
  } else if (phase === 'expansion') {
    res = resolveLogistics(prev, action.teamId, action.payload?.allocations || {}, true);
  } else if (phase === 'sales') {
    res = resolveSales(prev, action.teamId, {
      customersSold: action.payload?.customersSold || [],
      nfcSalesUnits: action.payload?.nfcSalesUnits || 0,
    });
  } else {
    return { valid: false, error: `Unsupported action phase: ${phase}`, nextState: prev };
  }

  if (!res.valid) {
    return res;
  }

  const nextTurn = prev.turn
    ? {
        ...prev.turn,
        index: prev.turn.index + 1,
      }
    : computeTurnOrder(res.nextState, phase);

  return {
    valid: true,
    nextState: {
      ...res.nextState,
      turn: nextTurn,
      updatedAt: new Date(),
    },
  };
}
