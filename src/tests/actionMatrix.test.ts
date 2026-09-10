import { describe, it, expect } from 'vitest';
import { deriveTeamPhaseStatus } from '@/lib/multiworld/actionMatrix';
import { GameState } from '@/types/game';

describe('actionMatrix', () => {
  const mockState: GameState = {
    gameId: 'g1',
    currentRound: 1,
    currentPhase: 'planning',
    teams: [{ id: 't1', name: 'Alpha', color: '#10b981', isBot: false }],
    rounds: [
      {
        roundNumber: 1,
        teamData: {
          t1: {
            teamId: 't1',
            combination: 1,
            position: 1,
            price: 7,
            productsProduced: 3,
            improvementCards: 1,
            researchIcons: 2,
            logisticsIcons: 1,
            revenue: 10,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 10
          }
        }
      }
    ],
    technologies: {},
    regions: [],
    patents: {},
    improvementCards: [],
    improvementPoolByRound: {},
    teamResearchProgress: {},
    researchAllocatedByRound: { 1: { t1: 1 } },
    regionLogistics: {},
    teamLogisticsProgress: {},
    logisticsAllocatedByRound: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };

  it('derives planning phase status correctly', () => {
    const status = deriveTeamPhaseStatus(mockState, 't1', 'planning');
    expect(status.status).toBe('done');
    expect(status.label).toBe('✓ $7');
  });

  it('derives research (innovation) partial status correctly', () => {
    const status = deriveTeamPhaseStatus(mockState, 't1', 'innovation');
    expect(status.status).toBe('partial');
    expect(status.label).toBe('◐ 1/2');
  });
});
