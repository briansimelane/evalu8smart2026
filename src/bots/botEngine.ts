import { GameState, BotProfile, BotDifficulty, TeamRoundData, Team } from '@/types/game';
import { Customer, REGION_CUSTOMERS } from '@/data/customers';
import { PATENT_POINTS } from '@/types/game';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { COMBINATIONS } from '@/data/combinations';
import { 
  calculatePlanStats, 
  getTechnologyCostForTeam, 
  getAvailableRegionsForTeam, 
  isCustomerEligible,
  hasTech 
} from '@/lib/rules';
import { isRuleActiveForTeam } from '@/lib/defaultRules';

// Seeded PRNG mulberry32
export function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROFILE_WEIGHTS = {
  BALANCED: { products: 0.3, research: 0.3, logistics: 0.3 },
  RESEARCHER: { products: 0.15, research: 0.65, logistics: 0.1 },
  EXPANDER: { products: 0.15, research: 0.1, logistics: 0.65 },
  PRICE_FIGHTER: { products: 0.6, research: 0.1, logistics: 0.1 }
};

export interface PlanCandidate {
  combination: number;
  position: number;
  cardUsages: Record<number, 'use' | 'product' | 'none'>;
  price: number;
  products: number;
  research: number;
  logistics: number;
  improvement: number;
  score: number;
}

// 5.1 PLANNING DECISION LOGIC
export function decidePlanning(
  gameState: GameState,
  teamId: string,
  profile: BotProfile = 'BALANCED',
  difficulty: BotDifficulty = 'MEDIUM',
  combinationsData: any[]
): {
  combination: number;
  position: number;
  cardUsages: Record<number, 'use' | 'product' | 'none'>;
} {
  const round = gameState.currentRound;
  const teamIdx = gameState.teams.findIndex(t => t.id === teamId);
  const seed = (gameState.botConfig?.seed || 999) + round * 31 + teamIdx;
  const rng = mulberry32(seed);

  // Enumerate all unique available (combination, position) pairs
  const combos = (combinationsData && combinationsData.length > 0) ? combinationsData : COMBINATIONS;
  const candidateCombos: Array<{ combination: number; position: number }> = [];
  combos.forEach(c => {
    candidateCombos.push({ combination: c.combination, position: c.position });
  });

  // Fetch all usable cards
  const allTeamCards = gameState.improvementCards.filter(card => card.availableForTeam === teamId);
  const getAllocatedRound = (card: any) => {
    return card.isInitial || card.allocatedInRound == null ? 0 : Number(card.allocatedInRound);
  };
  const usableCards = allTeamCards.filter(card => getAllocatedRound(card) < round);

  // Score candidates
  const weights = PROFILE_WEIGHTS[profile];
  
  // Cache current logistics presence and completed technologies
  const logisticsData = gameState.teamLogisticsProgress[teamId];
  const presentRegions = logisticsData?.regionsWithPresence || [];
  const researchData = gameState.teamResearchProgress[teamId];
  const completedTechs = researchData?.completedTechnologies || [];

  const scoredCandidates: PlanCandidate[] = candidateCombos.map(cand => {
    // 1. Determine optimal card usages for THIS specific candidate combination
    const cardUsages: Record<number, 'use' | 'product' | 'none'> = {};
    usableCards.forEach(card => {
      if (difficulty === 'EASY' && rng() < 0.20) {
        cardUsages[card.id] = 'none';
        return;
      }

      // If combination has low base production, prioritize using cards as products
      if (cand.combination >= 4 && (card.icon1 === 'Product' || card.icon2 === 'Product')) {
        cardUsages[card.id] = 'product';
      } else if (profile === 'RESEARCHER' && (card.icon1 === 'Research' || card.icon2 === 'Research')) {
        cardUsages[card.id] = 'use';
      } else if (profile === 'EXPANDER' && (card.icon1 === 'Logistic' || card.icon2 === 'Logistic')) {
        cardUsages[card.id] = 'use';
      } else {
        cardUsages[card.id] = rng() < 0.5 ? 'product' : 'use';
      }
    });

    const stats = calculatePlanStats(gameState, teamId, cand.combination, cand.position, cardUsages, combinationsData);
    
    // 2. Estimate sales potential in our regions at stats.calculatedPrice
    let potentialSales = 0;
    presentRegions.forEach(regionName => {
      const regionData = REGION_CUSTOMERS.find(r => r.region === regionName);
      if (regionData) {
        regionData.customers.forEach(cust => {
          // A customer will buy if:
          // - Price type and price is >= our calculatedPrice
          // - Tech type and tech is completed
          const priceEligible = cust.type === 'price' && stats.calculatedPrice <= (cust.price || 0);
          const techEligible = cust.type === 'value' && cust.technology && completedTechs.includes(cust.technology);
          if (priceEligible || techEligible) {
            potentialSales++;
          }
        });
      }
    });

    // We can't sell more than we produce
    const expectedSalesVolume = Math.min(stats.productsAvailable, potentialSales);
    const expectedRevenue = expectedSalesVolume * stats.calculatedPrice;

    // 3. Compute score based on expected volume, expected revenue, research, and logistics points
    let score = 0;
    score += expectedSalesVolume * weights.products * 4.0;
    score += expectedRevenue * weights.products * 0.8;
    score += stats.researchPoints * weights.research * 4.5;
    score += stats.logisticsPoints * weights.logistics * 4.5;

    // Preference adjust based on profile
    if (profile === 'PRICE_FIGHTER') {
      score += (10 - stats.calculatedPrice) * 2.0;
    } else {
      score += stats.calculatedPrice * 0.4;
    }

    // 4. Add slight PRNG noise to prevent repetitive predictable choices in identical states
    // Noise scaling: Easy has more noise, Hard has less noise
    const noiseScale = difficulty === 'EASY' ? 3.0 : (difficulty === 'MEDIUM' ? 1.5 : 0.5);
    score += (rng() - 0.5) * noiseScale;

    return {
      combination: cand.combination,
      position: cand.position,
      cardUsages,
      price: stats.calculatedPrice,
      products: stats.productsAvailable,
      research: stats.researchPoints,
      logistics: stats.logisticsPoints,
      improvement: stats.improvementPoints,
      score
    };
  });

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Difficulty selection bounds
  let chosenIdx = 0;
  if (difficulty === 'EASY' && scoredCandidates.length > 1) {
    const limit = Math.min(6, scoredCandidates.length);
    chosenIdx = Math.floor(rng() * limit);
  } else if (difficulty === 'MEDIUM' && scoredCandidates.length > 1) {
    const limit = Math.min(3, scoredCandidates.length);
    chosenIdx = Math.floor(rng() * limit);
  }

  if (scoredCandidates.length === 0) {
    return { combination: 1, position: 1, cardUsages: {} };
  }

  const chosen = scoredCandidates[chosenIdx] || scoredCandidates[0] || { combination: 1, position: 1, cardUsages: {} };
  return {
    combination: chosen.combination || 1,
    position: chosen.position || 1,
    cardUsages: chosen.cardUsages || {}
  };
}

// 5.3 RESEARCH DECISION LOGIC
export function decideResearch(
  gameState: GameState,
  teamId: string,
  researchPoints: number,
  profile: BotProfile = 'BALANCED',
  difficulty: BotDifficulty = 'MEDIUM'
): Record<string, number> {
  const round = gameState.currentRound;
  const teamIdx = gameState.teams.findIndex(t => t.id === teamId);
  const seed = (gameState.botConfig?.seed || 999) + round * 17 + teamIdx;
  const rng = mulberry32(seed);

  const allocations: Record<string, number> = {};
  let remainingPoints = researchPoints;

  const teamProgress = gameState.teamResearchProgress[teamId];
  const completed = teamProgress?.completedTechnologies || [];
  const currentInvestments = teamProgress?.technologyInvestments || {};

  // Clone technologies to dynamically track progression
  const tempInvestments = { ...currentInvestments };
  const tempCompleted = [...completed];

  while (remainingPoints > 0) {
    const techCandidates = Object.keys(gameState.technologies).filter(techName => {
      return !tempCompleted.includes(techName);
    });

    if (techCandidates.length === 0) break;

    // Score technologies
    const scoredTechs = techCandidates.map(techName => {
      const tech = gameState.technologies[techName];
      const baseCost = tech.researchCost;
      const currentSpent = tempInvestments[techName] || 0;

      // Adjust cost depending on temporary patent status
      const hasPatent = !!gameState.patents[techName] || Object.values(allocations).some(() => false); // simplify
      const cost = getTechnologyCostForTeam(gameState, teamId, techName);
      const remainingCost = Math.max(0, cost - currentSpent);

      let score = 0;
      // 1. Prioritize unpatented tech (patent race)
      const patentHolder = gameState.patents[techName];
      if (!patentHolder) {
        score += 15;
      }

      // 2. Prioritize technologies closer to completion
      if (remainingCost > 0) {
        score += (6 - remainingCost) * 2.0;
      }

      // 3. Profile adjustments
      if (profile === 'RESEARCHER') {
        score += (PATENT_POINTS[techName] || 6) * 1.5;
      } else {
        // Non-researchers prefer cheap/essential customer-enabling techs
        if (techName === 'Wifi' || techName === 'GPS') {
          score += 5;
        }
      }

      return { name: techName, score, remainingCost };
    });

    scoredTechs.sort((a, b) => b.score - a.score);

    // Apply difficulty choice
    let chosenIdx = 0;
    if (difficulty === 'EASY' && scoredTechs.length > 1) {
      chosenIdx = Math.floor(rng() * Math.min(3, scoredTechs.length));
    }

    const targetTech = scoredTechs[chosenIdx];
    if (!targetTech || targetTech.remainingCost === 0) break;

    // Allocate 1 point at a time
    allocations[targetTech.name] = (allocations[targetTech.name] || 0) + 1;
    tempInvestments[targetTech.name] = (tempInvestments[targetTech.name] || 0) + 1;
    remainingPoints--;

    const currentSpent = tempInvestments[targetTech.name];
    const actualCost = getTechnologyCostForTeam(gameState, teamId, targetTech.name);
    if (currentSpent >= actualCost) {
      tempCompleted.push(targetTech.name);
    }
  }

  return allocations;
}

// 5.4 LOGISTICS DECISION LOGIC
export function decideLogistics(
  gameState: GameState,
  teamId: string,
  logisticsPoints: number,
  profile: BotProfile = 'BALANCED',
  difficulty: BotDifficulty = 'MEDIUM'
): Record<string, number> {
  const round = gameState.currentRound;
  const teamIdx = gameState.teams.findIndex(t => t.id === teamId);
  const seed = (gameState.botConfig?.seed || 999) + round * 13 + teamIdx;
  const rng = mulberry32(seed);

  const allocations: Record<string, number> = {};
  let remainingPoints = logisticsPoints;

  const teamProgress = gameState.teamLogisticsProgress[teamId];
  const presence = teamProgress?.regionsWithPresence || [];
  const investments = teamProgress?.regionInvestments || {};

  const tempPresence = [...presence];
  const tempInvestments = { ...investments };

  while (remainingPoints > 0) {
    const candidateRegions = getAvailableRegionsForTeam(gameState, teamId).filter(rName => {
      // Exclude regions where we already have full presence
      return !tempPresence.includes(rName);
    });

    if (candidateRegions.length === 0) break;

    // Score candidates
    const scoredRegions = candidateRegions.map(rName => {
      const regionData = gameState.regionLogistics[rName];
      const cost = regionData.logisticsCost;
      const spent = tempInvestments[rName] || 0;
      const remainingCost = Math.max(0, cost - spent);

      let score = 0;

      // 1. Finish partially invested regions first
      if (spent > 0) {
        score += 20;
      }

      // 2. Count customer potential in this region
      const customerData = REGION_CUSTOMERS.find(c => c.region === rName);
      if (customerData) {
        score += customerData.customers.length * 2.0;
      }

      // 3. Spreading vs Crowding penalties
      const presenceCount = regionData.teamsPresent.length;
      if (profile === 'EXPANDER') {
        // Expander spreads and ignores crowding
        score += 5;
      } else {
        score -= presenceCount * 3.0; // avoid crowded areas
      }

      return { name: rName, score, remainingCost };
    });

    scoredRegions.sort((a, b) => b.score - a.score);

    let chosenIdx = 0;
    if (difficulty === 'EASY' && scoredRegions.length > 1) {
      chosenIdx = Math.floor(rng() * Math.min(3, scoredRegions.length));
    }

    const targetRegion = scoredRegions[chosenIdx];
    if (!targetRegion || targetRegion.remainingCost === 0) break;

    allocations[targetRegion.name] = (allocations[targetRegion.name] || 0) + 1;
    tempInvestments[targetRegion.name] = (tempInvestments[targetRegion.name] || 0) + 1;
    remainingPoints--;

    if (tempInvestments[targetRegion.name] >= gameState.regionLogistics[targetRegion.name].logisticsCost) {
      tempPresence.push(targetRegion.name);
    }
  }

  return allocations;
}

// 5.5 SALES DECISION LOGIC (greedy selection by play order turn)
export function decideSales(
  gameState: GameState,
  teamId: string,
  profile: BotProfile = 'BALANCED',
  difficulty: BotDifficulty = 'MEDIUM',
  soldCustomers: Set<string>
): string[] {
  const round = gameState.currentRound;
  const teamIdx = gameState.teams.findIndex(t => t.id === teamId);
  const seed = (gameState.botConfig?.seed || 999) + round * 7 + teamIdx;
  const rng = mulberry32(seed);

  const roundData = gameState.rounds.find(r => r.roundNumber === round);
  const teamData = roundData?.teamData[teamId];
  if (!teamData) return [];

  const teamPrice = teamData.price;
  const productsAvailable = teamData.productsProduced;

  const logistics = gameState.teamLogisticsProgress[teamId];
  const regionsFromProgress = logistics?.regionsWithPresence || [];
  const regionsFromBoard = Object.entries(gameState.regionLogistics || {})
    .filter(([_, reg]) => reg.teamsPresent && reg.teamsPresent.includes(teamId))
    .map(([rName]) => rName);

  const teamRegions = Array.from(new Set([...regionsFromProgress, ...regionsFromBoard]));

  const research = gameState.teamResearchProgress[teamId];
  const completedTechs = research?.completedTechnologies || [];

  const has4G = isRuleActiveForTeam(gameState?.ruleAdjustments, 'tech_permanent_benefits', teamId) && hasTech(gameState, teamId, '4G');

  // Group eligible remote 4G customers by non-office region
  const officeCustomers: Customer[] = [];
  const remote4GByRegion: Record<string, Customer[]> = {};

  REGION_CUSTOMERS.forEach(({ region, customers }) => {
    const isOffice = teamRegions.includes(region);
    if (!isOffice && !has4G) return;

    customers.forEach(customer => {
      if (isCustomerEligible(customer, teamId, teamPrice, completedTechs, soldCustomers)) {
        if (isOffice) {
          officeCustomers.push(customer);
        } else {
          if (!remote4GByRegion[region]) remote4GByRegion[region] = [];
          remote4GByRegion[region].push(customer);
        }
      }
    });
  });

  // Sort office customers greedily
  if (difficulty === 'EASY') {
    officeCustomers.sort(() => rng() - 0.5);
  } else {
    officeCustomers.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }

  // Pick up to capacity from office regions
  const chosenOffice = officeCustomers.slice(0, productsAvailable);
  const chosenIds = chosenOffice.map(c => c.id);

  // If products remain and 4G perk is active, pick at most 1 customer per non-office region
  if (has4G && chosenIds.length < productsAvailable) {
    Object.values(remote4GByRegion).forEach(custs => {
      if (chosenIds.length < productsAvailable && custs.length > 0) {
        if (difficulty === 'EASY') {
          custs.sort(() => rng() - 0.5);
        } else {
          custs.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
        }
        chosenIds.push(custs[0].id);
      }
    });
  }

  return chosenIds;
}

export function decideImprovement(
  gameState: GameState,
  teamId: string,
  profile: BotProfile = 'BALANCED',
  difficulty: BotDifficulty = 'MEDIUM'
): number {
  const round = gameState.currentRound;
  const pool = gameState.improvementPoolByRound?.[round] || [];
  if (pool.length === 0) {
    return -100 - gameState.teams.findIndex(t => t.id === teamId);
  }

  // Filter pool to only include cards that have NOT been claimed by any team this round
  const unclaimedIds = pool.filter(id => {
    return !gameState.improvementCards.some(c => c.id === id && c.allocatedInRound === round);
  });

  if (unclaimedIds.length === 0) {
    return -100 - gameState.teams.findIndex(t => t.id === teamId);
  }

  const candidates = unclaimedIds.map(id => AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === id)).filter(Boolean);
  if (candidates.length === 0) {
    return -100 - gameState.teams.findIndex(t => t.id === teamId);
  }

  const rng = mulberry32((gameState.botConfig?.seed || 999) + round * 23 + gameState.teams.findIndex(t => t.id === teamId));

  const scored = candidates.map(card => {
    if (!card) return { id: -999, score: -999 };
    let score = 0;
    if (profile === 'RESEARCHER') {
      if (card.icon1 === 'Research' || card.icon2 === 'Research') score += 10;
    } else if (profile === 'EXPANDER') {
      if (card.icon1 === 'Logistic' || card.icon2 === 'Logistic') score += 10;
    } else if (profile === 'PRICE_FIGHTER') {
      if (card.icon1 === 'Price and Product' || card.icon1 === 'Price Plus') score += 10;
    }
    // Add small random tie-breaker using PRNG
    score += rng() * 2;
    return { id: card.id, score };
  });

  scored.sort((a, b) => b.score - a.score);

  let chosenIdx = 0;
  if (difficulty === 'EASY' && scored.length > 1) {
    chosenIdx = Math.floor(rng() * Math.min(3, scored.length));
  }

  const result = scored[chosenIdx];
  return result && result.id !== -999 ? result.id : (-100 - gameState.teams.findIndex(t => t.id === teamId));
}
