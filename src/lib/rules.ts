import { GameState } from '@/types/game';
import { REGION_CUSTOMERS, Customer } from '@/data/customers';
import { ICON_EFFECTS } from '@/data/improvements';
import { isRuleActiveForTeam, getRuleValueForTeam } from '@/lib/defaultRules';

export function hasTech(gameState: GameState | null | undefined, teamId: string, techKey: string): boolean {
  if (!gameState || !teamId || !techKey) return false;
  const completedTechs = gameState.teamResearchProgress?.[teamId]?.completedTechnologies || [];
  const targetUpper = techKey.toUpperCase();
  return completedTechs.some(t => String(t).toUpperCase().includes(targetUpper));
}

export function isSteveBlocking(gameState: GameState | null | undefined, regionName: string, teamId?: string): boolean {
  if (!gameState || !regionName) return false;
  const activeRegion = gameState.advancedState?.steve?.activeRegion;
  if (!activeRegion || activeRegion !== regionName) return false;
  return isRuleActiveForTeam(gameState.ruleAdjustments, 'steve_event_blocker', teamId);
}

export function getLogisticsCostForTeam(gameState: GameState | null | undefined, teamId: string, regionName: string): number {
  if (!gameState) return 2;
  const region = gameState.regionLogistics?.[regionName];
  if (!region) return 2;
  const baseCost = region.logisticsCost || 2;
  const isMultiOfficeActive = isRuleActiveForTeam(gameState.ruleAdjustments, 'multiple_offices_per_region', teamId);
  const teamProgress = gameState.teamLogisticsProgress?.[teamId];
  const hasPresence = teamProgress?.regionsWithPresence?.includes(regionName);
  if (isMultiOfficeActive && hasPresence) {
    return Math.max(1, baseCost - 1);
  }
  return baseCost;
}

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

  const isMinPriceActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'min_product_price', teamId);
  const isMaxPriceActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'max_product_price', teamId);

  const minPrice = isMinPriceActive ? Number(getRuleValueForTeam(gameState?.ruleAdjustments, 'min_product_price', teamId, 2)) : 0;
  const maxPrice = isMaxPriceActive ? Number(getRuleValueForTeam(gameState?.ruleAdjustments, 'max_product_price', teamId, 8)) : 99;

  const rawCalculatedPrice = 5 + selectedComboData.price + improvementPriceEffect;
  const calculatedPrice = Math.max(minPrice, Math.min(maxPrice, rawCalculatedPrice));
  let productsAvailable = (selectedComboData.products || 0) + improvementProductEffect;
  let improvementPoints = selectedComboData.improve || 0;
  let researchPoints = (selectedComboData.research || 0) + improvementResearchEffect;
  let logisticsPoints = (selectedComboData.logistics || 0) + improvementLogisticsEffect;

  // WILDCARD TOKENS SYSTEM (Advanced Rule 2)
  const isWildcardsRuleActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'wildcard_tokens_system', teamId);
  if (isWildcardsRuleActive) {
    const teamWildcards = gameState?.advancedState?.wildcards?.[teamId];
    const roundConvs = teamWildcards?.conversionsByRound?.[activeRound] || {};
    productsAvailable += Number(roundConvs.product || 0);
    researchPoints += Number(roundConvs.research || 0);
    logisticsPoints += Number(roundConvs.logistics || 0);
    improvementPoints += Number(roundConvs.improvement || 0);
  }

  // PERMANENT TECH PERKS: Battery (+1 logistics when price > 5), GPS (+5 one-time), Wifi (carry-over)
  const isTechPerksActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'tech_permanent_benefits', teamId);

  if (isTechPerksActive) {
    // Battery perk: +1 logistics if price > $5
    if (hasTech(gameState, teamId, 'BATTERY')) {
      if (calculatedPrice > 5) {
        logisticsPoints += 1;
      }
    }

    // GPS perk: +5 products bonus awarded ONCE per game (DR-1)
    const hasGPS = hasTech(gameState, teamId, 'GPS');
    const gpsBonusClaimed = Boolean(gameState?.advancedState?.gpsBonusClaimed?.[teamId]);
    if (hasGPS && !gpsBonusClaimed) {
      productsAvailable += 5;
    }

    // Wifi perk: add carried over products from previous round
    if (hasTech(gameState, teamId, 'WIFI')) {
      const carriedOver = gameState?.advancedState?.carriedOverProducts?.[teamId] || 0;
      productsAvailable += carriedOver;
    }
  }

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
  
  const isWifiGpsActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'wifi_gps_cost', teamId);
  const wifiGpsCostVal = isWifiGpsActive ? Number(getRuleValueForTeam(gameState?.ruleAdjustments, 'wifi_gps_cost', teamId, 3)) : 3;

  if (technologyName.toUpperCase().includes('WIFI')) {
    baseCost = wifiGpsCostVal;
  } else if (technologyName.toUpperCase().includes('GPS')) {
    baseCost = wifiGpsCostVal;
  }

  // PERMANENT TECH PERKS: Gaming (-1 research/patent cost)
  const isTechPerksActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'tech_permanent_benefits', teamId);
  if (isTechPerksActive && hasTech(gameState, teamId, 'GAMING')) {
    baseCost = Math.max(1, baseCost - 1);
  }

  const patentHolder = gameState.patents[technologyName];
  if (patentHolder && patentHolder !== teamId) {
    const isDiscountActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'tech_patent_discount', teamId);
    const discount = isDiscountActive ? Number(getRuleValueForTeam(gameState?.ruleAdjustments, 'tech_patent_discount', teamId, 1)) : 0;
    return Math.max(0, baseCost - discount);
  }
  return baseCost;
}

export function canExpandToRegion(
  gameState: GameState,
  teamId: string,
  regionName: string
): boolean {
  if (isSteveBlocking(gameState, regionName, teamId)) {
    return false;
  }

  if (!gameState || !gameState.regionLogistics) return false;
  const region = gameState.regionLogistics[regionName];
  if (!region) return false;

  const teamProgress = gameState.teamLogisticsProgress?.[teamId];
  if (!teamProgress) return false;

  // MULTIPLE OFFICES RULE: If team already has presence, can build additional office if slots available
  const isMultiOfficeActive = isRuleActiveForTeam(gameState?.ruleAdjustments, 'multiple_offices_per_region', teamId);
  const totalOffices = Object.values(region.officeCounts || {}).reduce((a, b) => a + Number(b), 0);
  const occupiedSlots = region.officeCounts ? totalOffices : region.teamsPresent.length;

  if (teamProgress.regionsWithPresence.includes(regionName)) {
    return isMultiOfficeActive ? occupiedSlots < region.maxTeams : true;
  }

  if (occupiedSlots >= region.maxTeams) {
    return false;
  }

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

