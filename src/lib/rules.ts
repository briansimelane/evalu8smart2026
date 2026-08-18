import { GameState } from '@/types/game';
import { REGION_CUSTOMERS, Customer } from '@/data/customers';
import { ICON_EFFECTS } from '@/data/improvements';

export function calculatePlanStats(
  gameState: GameState,
  teamId: string,
  combinationNum: number,
  positionNum: number,
  cardUsages: Record<number, 'use' | 'product' | 'none'>,
  combinationsData: any[]
) {
  const selectedComboData = combinationsData.find(
    c => c.combination === combinationNum && c.position === positionNum
  );
  if (!selectedComboData) {
    return {
      calculatedPrice: 0,
      productsAvailable: 0,
      improvementPoints: 0,
      researchPoints: 0,
      logisticsPoints: 0
    };
  }

  let improvementPriceEffect = 0;
  let improvementProductEffect = 0;
  let improvementResearchEffect = 0;
  let improvementLogisticsEffect = 0;

  const allTeamCards = gameState.improvementCards.filter(card => card.availableForTeam === teamId);
  const getAllocatedRound = (card: any) => {
    return card.isInitial || card.allocatedInRound == null ? 0 : Number(card.allocatedInRound);
  };
  const activeRound = gameState.currentRound;
  const usableCards = allTeamCards.filter(card => getAllocatedRound(card) < activeRound);

  usableCards.forEach(card => {
    const usage = cardUsages[card.id] || 'none';
    if (usage === 'use') {
      const icon1Effects = ICON_EFFECTS[card.icon1 as keyof typeof ICON_EFFECTS] || { priceEffect: 0, productEffect: 0, researchEffect: 0, logisticsEffect: 0 };
      const icon2Effects = ICON_EFFECTS[card.icon2 as keyof typeof ICON_EFFECTS] || { priceEffect: 0, productEffect: 0, researchEffect: 0, logisticsEffect: 0 };
      improvementPriceEffect += icon1Effects.priceEffect + icon2Effects.priceEffect;
      improvementProductEffect += icon1Effects.productEffect + icon2Effects.productEffect;
      improvementResearchEffect += icon1Effects.researchEffect + icon2Effects.researchEffect;
      improvementLogisticsEffect += icon1Effects.logisticsEffect + icon2Effects.logisticsEffect;
    } else if (usage === 'product') {
      improvementProductEffect += 1;
    }
  });

  const calculatedPrice = Math.max(2, Math.min(8, 5 + selectedComboData.price + improvementPriceEffect));
  const productsAvailable = (selectedComboData.products || 0) + improvementProductEffect;
  const improvementPoints = selectedComboData.improve || 0;
  const researchPoints = (selectedComboData.research || 0) + improvementResearchEffect;
  const logisticsPoints = (selectedComboData.logistics || 0) + improvementLogisticsEffect;

  return {
    calculatedPrice,
    productsAvailable,
    improvementPoints,
    researchPoints,
    logisticsPoints
  };
}

export function getTechnologyCostForTeam(gameState: GameState, teamId: string, technologyName: string): number {
  const tech = gameState.technologies[technologyName];
  let baseCost = tech ? tech.researchCost : 4;
  
  if (technologyName.toUpperCase().includes('WIFI')) {
    baseCost = 3;
  } else if (technologyName.toUpperCase().includes('GPS')) {
    baseCost = 3;
  }

  const patentHolder = gameState.patents[technologyName];
  if (patentHolder && patentHolder !== teamId) {
    return Math.max(0, baseCost - 1);
  }
  return baseCost;
}

export function canExpandToRegion(gameState: GameState, teamId: string, regionName: string): boolean {
  const region = gameState.regionLogistics[regionName];
  if (!region) return false;

  // Check if region is full of teams
  if (region.teamsPresent.length >= region.maxTeams && !region.teamsPresent.includes(teamId)) {
    return false;
  }

  const teamProgress = gameState.teamLogisticsProgress[teamId];
  if (!teamProgress) return false;

  // Already has presence
  if (teamProgress.regionsWithPresence.includes(regionName)) return true;

  // Check connectivity
  return region.connectedRegions.some(connected =>
    teamProgress.regionsWithPresence.includes(connected)
  );
}

export function getAvailableRegionsForTeam(gameState: GameState, teamId: string): string[] {
  return Object.keys(gameState.regionLogistics).filter(regionName =>
    canExpandToRegion(gameState, teamId, regionName)
  );
}

export function isCustomerEligible(
  customer: Customer,
  teamId: string,
  teamPrice: number,
  completedTechs: string[],
  soldCustomers: Set<string>,
  alreadySoldByMe: string[] = []
): boolean {
  // If sold by another team, ineligible
  const isSoldByOther = soldCustomers.has(customer.id) && !alreadySoldByMe.includes(customer.id);
  if (isSoldByOther) return false;

  if (customer.type === 'price') {
    return teamPrice <= (customer.price || 0);
  } else {
    if (!customer.technology) return false;
    const reqNorm = customer.technology.toUpperCase();
    return completedTechs.some(t => (t || '').toUpperCase() === reqNorm);
  }
}
