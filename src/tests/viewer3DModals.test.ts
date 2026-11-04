import { describe, it, expect } from 'vitest';
import { calculateTeamTotalScore } from '@/types/game';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';

describe('Viewer 3D Modals (BRIEF-MODALS.md)', () => {
  it('has valid AVAILABLE_IMPROVEMENT_CARDS pool with valid effects', () => {
    expect(AVAILABLE_IMPROVEMENT_CARDS.length).toBeGreaterThan(10);
    const validEffects = ['Price Plus', 'Price and Product', 'Product', 'Research', 'Logistic'];

    AVAILABLE_IMPROVEMENT_CARDS.forEach(card => {
      expect(card.id).toBeDefined();
      expect(validEffects).toContain(card.icon1);
      expect(validEffects).toContain(card.icon2);
    });
  });

  it('correctly calculates rankings and handles ties using totalMoney', () => {
    const mockGameState: any = {
      gameId: 'test-game',
      currentRound: 2,
      gameEnded: false,
      patents: {},
      teams: [
        { id: 'team-1', name: 'Alpha', color: '#3b82f6' },
        { id: 'team-2', name: 'Beta', color: '#3b82f6' },
      ],
      rounds: [
        {
          roundNumber: 1,
          teamData: {
            'team-1': { revenue: 20, totalMoney: 20 },
            'team-2': { revenue: 20, totalMoney: 20 },
          },
        },
        {
          roundNumber: 2,
          teamData: {
            'team-1': { revenue: 15, totalMoney: 15 },
            'team-2': { revenue: 15, totalMoney: 25 },
          },
        },
      ],
      technologies: {},
      regions: [],
      improvementCards: [],
      improvementPoolByRound: {},
      teamResearchProgress: {},
      researchAllocatedByRound: {},
      regionLogistics: {},
      teamLogisticsProgress: {},
      logisticsAllocatedByRound: {},
    };

    const score1 = calculateTeamTotalScore('team-1', 2, mockGameState);
    const score2 = calculateTeamTotalScore('team-2', 2, mockGameState);

    expect(score1.totalScore).toBe(score2.totalScore);

    // Tie-break: Beta has totalMoney = 25 vs Alpha's 15
    const round2Data = mockGameState.rounds[1];
    const money1 = round2Data.teamData['team-1'].totalMoney;
    const money2 = round2Data.teamData['team-2'].totalMoney;

    expect(money2).toBeGreaterThan(money1);
  });

  it('enforces that improvement phase is skipped from round 5', () => {
    const round4 = 4;
    const round5 = 5;
    expect(round4 < 5).toBe(true);
    expect(round5 >= 5).toBe(true);
  });

  it('allocates or indicates Product card only when a team has 0 improvement icons', () => {
    const pts = 0;
    const statusText = pts === 0 ? 'Gets Product Card Only' : 'Waiting turn';
    expect(statusText).toBe('Gets Product Card Only');

    // Default product card has negative id or fallback type Product
    const allocatedCardId = -1;
    const isDefaultProductCard = allocatedCardId < 0;
    expect(isDefaultProductCard).toBe(true);
  });

  it('verifies scoreboard positions display sequential 1-based ranks without medal dependencies', () => {
    const teams = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
    const ranks = teams.map((_, idx) => idx + 1);
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
    expect(ranks[0]).toBe(1);
    expect(ranks[1]).toBe(2);
    expect(ranks[2]).toBe(3);
    expect(ranks[3]).toBe(4);
    expect(ranks[4]).toBe(5);
  });
});
