import { RuleAdjustment, RuleAdjustmentsState } from '@/types/game';

export const DEFAULT_RULES: Record<string, RuleAdjustment> = {
  // TURN ORDER RULES
  lowest_price_first: {
    id: 'lowest_price_first',
    name: 'Turn Order: Lowest Price First',
    description: 'The team with the lowest price in the current round goes first across all turn-based phases (Improvement, Research, Logistics, Sales).',
    category: 'General',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  tiebreak_lowest_score_first: {
    id: 'tiebreak_lowest_score_first',
    name: 'Turn Order Tie-Breaker: Lowest Previous Round Points',
    description: 'In case of a tie in price, the team with the lowest total points from the previous round goes first.',
    category: 'General',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  reset_price_to_5_each_round: {
    id: 'reset_price_to_5_each_round',
    name: 'Base Price Reset to 5',
    description: 'Base product price always starts at $5 at the beginning of each round before combination offsets.',
    category: 'Production & Price',
    enabled: true,
    globalValue: 5,
    defaultValue: 5,
  },

  // SELLING GOODS & CONTROL RULES
  sell_in_turn_order_left_to_right: {
    id: 'sell_in_turn_order_left_to_right',
    name: 'Sales Sequence: Left-to-Right Customer Order',
    description: 'In turn order, teams sell to customers from leftmost to rightmost position based on price or technology requirement.',
    category: 'Sales',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  most_products_sold_controls_region: {
    id: 'most_products_sold_controls_region',
    name: 'Region Control: Most Products Sold',
    description: 'The team with the highest quantity of products sold in a region controls that region.',
    category: 'Sales',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  tiebreak_leftmost_customer_wins_control: {
    id: 'tiebreak_leftmost_customer_wins_control',
    name: 'Control Tie-Breaker: Leftmost Customer Owner',
    description: 'In case of a tie in products sold for region control, the team who sold to the leftmost customer wins control.',
    category: 'Sales',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },

  // IMPROVEMENT CARDS RULES
  improvement_card_usage_options: {
    id: 'improvement_card_usage_options',
    name: 'Improvement Card Usage Options',
    description: 'During planning phase, teams can choose: use full card for 2 icon effects, turn it over as 1 product, or don\'t use it in current round.',
    category: 'Production & Price',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },

  // PATENTS AND TECHNOLOGICAL RESEARCH RULES
  patents_scored_at_end_of_game: {
    id: 'patents_scored_at_end_of_game',
    name: 'Patent Points Counted at Game End',
    description: 'Patent points are only calculated and added to team scores at the end of the game (Round 5).',
    category: 'Research & Tech',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  single_patent_holder: {
    id: 'single_patent_holder',
    name: 'Single Exclusive Patent Holder',
    description: 'Only ONE team (the first to complete research) gains the patent for a technology.',
    category: 'Research & Tech',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  must_fully_research_tech_to_sell: {
    id: 'must_fully_research_tech_to_sell',
    name: 'Full Research Required to Sell Tech',
    description: 'Teams can only sell a technology to customers if they have fully completed research on it.',
    category: 'Research & Tech',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  multiple_teams_can_research_and_sell: {
    id: 'multiple_teams_can_research_and_sell',
    name: 'Multiple Teams Can Research & Sell',
    description: 'More than one team can fully research and sell the same technology to customers.',
    category: 'Research & Tech',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },

  // STARTING POINTS & REGIONS RULES
  standard_starting_points_and_regions: {
    id: 'standard_starting_points_and_regions',
    name: 'Round 1 Starting Points & Regions',
    description: 'Standard starting allocations: Green (3 pts, North Africa), Blue (4 pts, South America), Black (5 pts, Australia), Yellow (6 pts, India), Red (7 pts, CIS).',
    category: 'General',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },

  // PARAMETRIC RULES & CAPS
  tech_patent_discount: {
    id: 'tech_patent_discount',
    name: 'Patent Holder Research Cost Discount',
    description: 'Grants 1 research point cost reduction for non-patent holders attempting to research patented technology.',
    category: 'Research & Tech',
    enabled: true,
    globalValue: 1,
    defaultValue: 1,
  },
  min_product_price: {
    id: 'min_product_price',
    name: 'Minimum Product Price Floor ($)',
    description: 'Enforces lower bound price restriction ($2 minimum) for market combinations.',
    category: 'Production & Price',
    enabled: true,
    globalValue: 2,
    defaultValue: 2,
  },
  max_product_price: {
    id: 'max_product_price',
    name: 'Maximum Product Price Ceiling ($)',
    description: 'Enforces upper bound price restriction ($8 maximum) for market combinations.',
    category: 'Production & Price',
    enabled: true,
    globalValue: 8,
    defaultValue: 8,
  },
  // ADVANCED RULES (1 to 5)
  tech_permanent_benefits: {
    id: 'tech_permanent_benefits',
    name: 'Advanced Rule 1: Permanent Technological Benefits',
    description: 'Grants permanent perks on full research: GPS (+5 products bonus once per game), Wifi (unsold product carry-over), Gaming (-$1 research/patent cost), Battery (+1 logistics when product price is > $5).',
    category: 'Research & Tech',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  wildcard_tokens_system: {
    id: 'wildcard_tokens_system',
    name: 'Advanced Rule 2: Wildcard Tokens System',
    description: 'Teams start with 10 Wildcard Tokens (max 2 used/round) convertible to Product, Research, Logistics, or Improvement icons, Steve removal, or trades. Leftover tokens earn 1 VP each.',
    category: 'General',
    enabled: true,
    globalValue: 10,
    defaultValue: 10,
  },
  multiple_offices_per_region: {
    id: 'multiple_offices_per_region',
    name: 'Advanced Rule 3: Multiple Offices in a Region',
    description: 'Allows teams to establish multiple offices in the same region. Subsequent offices cost $1 less than base logistics cost.',
    category: 'Logistics',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
  directives_bonus_points: {
    id: 'directives_bonus_points',
    name: 'Advanced Rule 4: Directives for Additional Points',
    description: 'Adds 6 directive challenges worth 12 VPs each (#2, #5, #6, #7, #21, #22). Teams can claim at most 1 directive per round.',
    category: 'General',
    enabled: true,
    globalValue: 12,
    defaultValue: 12,
  },
  steve_event_blocker: {
    id: 'steve_event_blocker',
    name: 'Advanced Rule 5: Steve Event & Region Blocker',
    description: 'Steve comes into play in Round 3+. Facilitator can click "Move Steve" to block a region from expansion and sales. Steve is removed when 5 Wildcard Tokens are paid.',
    category: 'Logistics',
    enabled: true,
    globalValue: true,
    defaultValue: true,
  },
};

export function getDefaultRuleAdjustments(): RuleAdjustmentsState {
  return {
    rules: JSON.parse(JSON.stringify(DEFAULT_RULES)),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Checks whether a specific rule is active for a team (taking team overrides into account).
 */
export function isRuleActiveForTeam(
  state: RuleAdjustmentsState | undefined,
  ruleId: string,
  teamId?: string
): boolean {
  if (!state || !state.rules || !state.rules[ruleId]) {
    // If no custom state saved, default rule enabled status applies
    return DEFAULT_RULES[ruleId]?.enabled ?? false;
  }
  const rule = state.rules[ruleId];
  if (teamId && rule.teamOverrides && rule.teamOverrides[teamId]?.enabled !== undefined) {
    return rule.teamOverrides[teamId].enabled!;
  }
  return rule.enabled;
}

/**
 * Gets the active requirement value for a rule for a team (taking team overrides into account).
 */
export function getRuleValueForTeam<T = any>(
  state: RuleAdjustmentsState | undefined,
  ruleId: string,
  teamId?: string,
  fallbackValue?: T
): T {
  const defaultVal = fallbackValue ?? (DEFAULT_RULES[ruleId]?.globalValue as unknown as T);
  if (!state || !state.rules || !state.rules[ruleId]) {
    return defaultVal;
  }
  const rule = state.rules[ruleId];
  if (teamId && rule.teamOverrides && rule.teamOverrides[teamId]?.value !== undefined) {
    return rule.teamOverrides[teamId].value as unknown as T;
  }
  return (rule.globalValue !== undefined ? rule.globalValue : defaultVal) as unknown as T;
}
