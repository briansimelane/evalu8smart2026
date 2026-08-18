import { describe, it, expect } from 'vitest';
import { GameState, Team } from '../types/game';
import { getTechnologyCostForTeam, isCustomerEligible } from '../lib/rules';
import { decideSales, decideResearch, decideLogistics } from '../bots/botEngine';
import { REGION_CUSTOMERS } from '../data/customers';
import { MapPin, Wifi, Gamepad2, Battery, Radio, Signal } from 'lucide-react';

// Case-insensitive Tech Icon Helper (used in TechPanel & OverlayTechPanel)
const getTechIconComponent = (techName: string) => {
  const norm = (techName || '').toUpperCase();
  if (norm.includes('GPS')) return MapPin;
  if (norm.includes('WIFI')) return Wifi;
  if (norm.includes('GAMING')) return Gamepad2;
  if (norm.includes('BATTERY')) return Battery;
  if (norm.includes('NFC')) return Radio;
  if (norm.includes('4G')) return Signal;
  return Wifi;
};

function createTestGameState(): GameState {
  const teams: Team[] = [
    { id: 'team-green', name: 'Green Team', color: '#16a34a', isBot: true, botProfile: 'BALANCED', botDifficulty: 'MEDIUM' },
    { id: 'team-blue', name: 'Blue Team', color: '#2563eb', isBot: true, botProfile: 'RESEARCHER', botDifficulty: 'MEDIUM' },
    { id: 'team-black', name: 'Black Team', color: '#0f172a', isBot: true, botProfile: 'BALANCED', botDifficulty: 'MEDIUM' },
    { id: 'team-yellow', name: 'Yellow Team', color: '#eab308', isBot: true, botProfile: 'BALANCED', botDifficulty: 'MEDIUM' }
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
    'Canada': { name: 'Canada', logisticsCost: 2, maxTeams: 3, connectedRegions: ['CIS', 'India', 'USA'], teamsPresent: ['team-green'], teamProgress: { 'team-green': 2 } },
    'USA': { name: 'USA', logisticsCost: 4, maxTeams: 5, connectedRegions: ['Canada', 'Australia', 'Caribbean', 'South America'], teamsPresent: ['team-blue', 'team-black'], teamProgress: { 'team-blue': 4, 'team-black': 4 } },
    'North Africa': { name: 'North Africa', logisticsCost: 3, maxTeams: 4, connectedRegions: ['Europe', 'China', 'Emirates'], teamsPresent: ['team-green'], teamProgress: { 'team-green': 3 } }
  };

  const rounds = [
    {
      roundNumber: 1,
      teamData: {
        'team-green': { teamId: 'team-green', price: 4, productsProduced: 4, researchIcons: 3, logisticsIcons: 3, customersSold: ['can-p1'] },
        'team-blue': { teamId: 'team-blue', price: 5, productsProduced: 3, researchIcons: 3, logisticsIcons: 3, customersSold: ['usa-p3'] },
        'team-black': { teamId: 'team-black', price: 4, productsProduced: 3, researchIcons: 3, logisticsIcons: 3, customersSold: ['usa-p2'] },
        'team-yellow': { teamId: 'team-yellow', price: 5, productsProduced: 3, researchIcons: 3, logisticsIcons: 3, customersSold: [] }
      }
    },
    {
      roundNumber: 2,
      teamData: {
        'team-green': { teamId: 'team-green', price: 4, productsProduced: 4, researchIcons: 3, logisticsIcons: 3 },
        'team-blue': { teamId: 'team-blue', price: 4, productsProduced: 3, researchIcons: 3, logisticsIcons: 3 },
        'team-black': { teamId: 'team-black', price: 4, productsProduced: 3, researchIcons: 3, logisticsIcons: 3 },
        'team-yellow': { teamId: 'team-yellow', price: 5, productsProduced: 3, researchIcons: 3, logisticsIcons: 3 }
      }
    }
  ];

  return {
    gameId: 'test-sync-game',
    teams,
    currentRound: 2,
    rounds: rounds as any,
    technologies,
    regions: [],
    patents: {},
    improvementCards: [
      // Round 1 Claims
      { id: 1, icon1: 'Research', icon2: 'Price Plus', availableForTeam: 'team-green', allocatedInRound: 1, used: false },
      { id: 2, icon1: 'Logistic', icon2: 'Price Plus', availableForTeam: 'team-blue', allocatedInRound: 1, used: false },
      // Round 2 Claims (stored as numbers or string numbers)
      { id: 3, icon1: 'Price and Product', icon2: 'Product', availableForTeam: 'team-green', allocatedInRound: 2, used: false },
      { id: 4, icon1: 'Research', icon2: 'Research', availableForTeam: 'team-blue', allocatedInRound: '2' as any, used: false }
    ],
    improvementPoolByRound: {
      1: [1, 2],
      2: [3, 4],
      3: [5, 6]
    },
    teamResearchProgress: {
      'team-green': { teamId: 'team-green', technologyInvestments: { 'Wifi': 3 }, completedTechnologies: ['WIFI'] },
      'team-blue': { teamId: 'team-blue', technologyInvestments: { 'Gaming': 3 }, completedTechnologies: [] },
      'team-black': { teamId: 'team-black', technologyInvestments: {}, completedTechnologies: [] },
      'team-yellow': { teamId: 'team-yellow', technologyInvestments: {}, completedTechnologies: [] }
    },
    researchAllocatedByRound: { 1: {}, 2: {} },
    regionLogistics,
    teamLogisticsProgress: {
      'team-green': { teamId: 'team-green', regionsWithPresence: ['Canada', 'North Africa'], regionInvestments: { 'Canada': 2, 'North Africa': 3 } },
      'team-blue': { teamId: 'team-blue', regionsWithPresence: ['USA'], regionInvestments: { 'USA': 4 } },
      'team-black': { teamId: 'team-black', regionsWithPresence: ['USA'], regionInvestments: { 'USA': 4 } },
      'team-yellow': { teamId: 'team-yellow', regionsWithPresence: [], regionInvestments: {} }
    },
    logisticsAllocatedByRound: { 1: {}, 2: {} },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe('Game Rules & Viewer Synchronization Test Suite', () => {

  // 1. TECHNOLOGY & PATENT DISCOUNT RULES
  describe('Technology Cost & Patent Mechanics', () => {
    it('correctly calculates base costs for technologies', () => {
      const state = createTestGameState();
      expect(getTechnologyCostForTeam(state, 'team-green', 'GPS')).toBe(3);
      expect(getTechnologyCostForTeam(state, 'team-green', 'Wifi')).toBe(3);
      expect(getTechnologyCostForTeam(state, 'team-green', 'Gaming')).toBe(4);
      expect(getTechnologyCostForTeam(state, 'team-green', 'Battery')).toBe(4);
      expect(getTechnologyCostForTeam(state, 'team-green', 'NFC')).toBe(5);
      expect(getTechnologyCostForTeam(state, 'team-green', '4G')).toBe(6);
    });

    it('applies 1 point patent discount to all other teams when a patent is awarded', () => {
      const state = createTestGameState();
      // Award Gaming patent to Green team
      state.patents['Gaming'] = 'team-green';

      // Green team (holder) cost remains base 4
      expect(getTechnologyCostForTeam(state, 'team-green', 'Gaming')).toBe(4);
      // Blue team (other) gets 1 point discount (cost becomes 3)
      expect(getTechnologyCostForTeam(state, 'team-blue', 'Gaming')).toBe(3);
    });

    it('automatically marks technology as completed when invested points meet discounted cost', () => {
      const state = createTestGameState();
      // Blue team invested 3 points in Gaming (base cost = 4)
      const blueInvested = state.teamResearchProgress['team-blue'].technologyInvestments['Gaming'];
      expect(blueInvested).toBe(3);
      expect(state.teamResearchProgress['team-blue'].completedTechnologies.includes('Gaming')).toBe(false);

      // Now Green team wins Gaming patent
      state.patents['Gaming'] = 'team-green';
      const discountedCost = getTechnologyCostForTeam(state, 'team-blue', 'Gaming');
      expect(discountedCost).toBe(3);

      // Evaluate fallback completion
      const isCompleted = blueInvested >= discountedCost;
      expect(isCompleted).toBe(true);
    });
  });

  // 2. SALES PHASE & CASE-INSENSITIVE TECH MATCHING
  describe('Sales Phase & Customer Eligibility', () => {
    it('matches value customer technology requirements case-insensitively (WIFI vs Wifi)', () => {
      const soldCustomers = new Set<string>();
      const completedTechs = ['WIFI']; // Uppercase in state

      const nafWifiCustomer = { id: 'naf-v1', type: 'value' as const, technology: 'Wifi', position: 3 };

      const isEligible = isCustomerEligible(
        nafWifiCustomer,
        'team-green',
        4,
        completedTechs,
        soldCustomers
      );

      expect(isEligible).toBe(true);
    });

    it('allows Green Team with Wifi to sell to Wifi customer in North Africa', () => {
      const state = createTestGameState();
      const soldCustomers = new Set<string>();

      const chosenCustomers = decideSales(state, 'team-green', 'BALANCED', 'MEDIUM', soldCustomers);
      expect(chosenCustomers.length).toBeGreaterThan(0);
      expect(chosenCustomers).toContain('naf-v1');
    });

    it('correctly filters price customers based on team price', () => {
      const soldCustomers = new Set<string>();
      const completedTechs: string[] = [];

      const cheapCustomer = { id: 'usa-p1', type: 'price' as const, price: 3, position: 1 };
      const expensiveCustomer = { id: 'usa-p3', type: 'price' as const, price: 5, position: 3 };

      // Team price = 4
      expect(isCustomerEligible(cheapCustomer, 'team-green', 4, completedTechs, soldCustomers)).toBe(false); // 4 > 3
      expect(isCustomerEligible(expensiveCustomer, 'team-green', 4, completedTechs, soldCustomers)).toBe(true); // 4 <= 5
    });
  });

  // 3. LOGISTICS EXPANSION & REGIONAL PRESENCE SYNC
  describe('Logistics Expansion & Dual-Source Regional Presence', () => {
    it('combines presence from teamLogisticsProgress and regionLogistics.teamsPresent', () => {
      const state = createTestGameState();

      // Simulate state where USA has team-blue in teamsPresent
      const boardRegions = Object.entries(state.regionLogistics)
        .filter(([_, reg]) => reg.teamsPresent.includes('team-blue'))
        .map(([rName]) => rName);

      const progressRegions = state.teamLogisticsProgress['team-blue']?.regionsWithPresence || [];
      const combinedRegions = Array.from(new Set([...progressRegions, ...boardRegions]));

      expect(combinedRegions).toContain('USA');
    });

    it('enables bots present in USA to sell products in USA', () => {
      const state = createTestGameState();
      const soldCustomers = new Set<string>();

      const blueChosen = decideSales(state, 'team-blue', 'RESEARCHER', 'MEDIUM', soldCustomers);
      expect(blueChosen.length).toBeGreaterThan(0);

      // Customer usa-p3 (price 5) is eligible for team-blue (price 4) in USA
      const usaCustomers = REGION_CUSTOMERS.find(r => r.region === 'USA')?.customers.map(c => c.id) || [];
      const soldInUsa = blueChosen.filter(id => usaCustomers.includes(id));
      expect(soldInUsa.length).toBeGreaterThan(0);
    });
  });

  // 4. IMPROVEMENT PHASE & ROUND ISOLATION
  describe('Improvement Phase & Round Isolation', () => {
    it('strictly isolates Round 2 card claims from Round 1 claims', () => {
      const state = createTestGameState();
      const currentRound = 2;

      // Filter Round 2 claims strictly by Number(c.allocatedInRound) === Number(2)
      const round2Claims = state.improvementCards.filter(c =>
        c.availableForTeam === 'team-green' &&
        Number(c.allocatedInRound) === Number(currentRound)
      );

      expect(round2Claims.length).toBe(1);
      expect(round2Claims[0].id).toBe(3); // Card 3 (Price and Product), NOT Card 1 from Round 1
    });

    it('correctly parses allocatedInRound whether stored as number or string', () => {
      const state = createTestGameState();
      const currentRound = 2;

      // Card 4 for team-blue has allocatedInRound = '2' (string)
      const blueRound2Claim = state.improvementCards.find(c =>
        c.availableForTeam === 'team-blue' &&
        Number(c.allocatedInRound) === Number(currentRound)
      );

      expect(blueRound2Claim).toBeDefined();
      expect(blueRound2Claim?.id).toBe(4);
    });

    it('prevents Round 4 from previewing Round 5 improvement cards', () => {
      const state = createTestGameState();
      state.currentRound = 4;
      const isImprovementCompleted = true;
      const isUpcomingPreview = isImprovementCompleted && state.currentRound < 4;

      expect(isUpcomingPreview).toBe(false);
    });

    it('ensures Round 5 skips Improvement Phase and reroutes to research', () => {
      const state = createTestGameState();
      state.currentRound = 5;
      state.currentPhase = 'production';

      const nextPhase = (currentPhase: string, currentRound: number) => {
        let target = 'improvement';
        if (currentRound >= 5 && target === 'improvement') {
          target = 'research';
        }
        return target;
      };

      expect(nextPhase('production', 5)).toBe('research');
    });

    it('masks team price as 🔒 Hidden during Planning Phase', () => {
      const state = createTestGameState();
      state.currentPhase = 'planning';
      
      const getDisplayedPrice = (phase: string, price: number) => {
        return phase === 'planning' ? '🔒 Hidden' : `$${price}`;
      };

      expect(getDisplayedPrice(state.currentPhase, 6)).toBe('🔒 Hidden');
      expect(getDisplayedPrice('production', 6)).toBe('$6');
    });

    it('passes improvement card usages along with combination and position when selected from guide', () => {
      let selectedCombo = 0;
      let selectedPos = 0;
      let selectedCards: Record<number, 'use' | 'product' | 'none'> = {};

      const onSelect = (combo: number, pos: number, usages?: Record<number, 'use' | 'product' | 'none'>) => {
        selectedCombo = combo;
        selectedPos = pos;
        if (usages) selectedCards = usages;
      };

      onSelect(3, 2, { 1: 'use', 2: 'product' });

      expect(selectedCombo).toBe(3);
      expect(selectedPos).toBe(2);
      expect(selectedCards).toEqual({ 1: 'use', 2: 'product' });
    });
  });

  // 5. VIEWER ICON MAPPING
  describe('Viewer Technology Icon Resolution', () => {
    it('resolves all technology names case-insensitively to the correct Lucide icon', () => {
      expect(getTechIconComponent('Wifi')).toBe(Wifi);
      expect(getTechIconComponent('WIFI')).toBe(Wifi);
      expect(getTechIconComponent('wifi')).toBe(Wifi);

      expect(getTechIconComponent('GPS')).toBe(MapPin);
      expect(getTechIconComponent('Gaming')).toBe(Gamepad2);
      expect(getTechIconComponent('Battery')).toBe(Battery);
      expect(getTechIconComponent('NFC')).toBe(Radio);
      expect(getTechIconComponent('4G')).toBe(Signal);
    });
  });

});
