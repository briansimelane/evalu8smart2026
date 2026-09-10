import { GameState, GamePhase, TeamRoundData } from '@/types/game';
import { calculatePlanStats } from '@/lib/rules';
import { COMBINATIONS } from '@/data/combinations';

export const PHASE_SEQUENCE: GamePhase[] = [
  'planning',
  'production',
  'improvement',
  'innovation',
  'expansion',
  'sales',
  'control',
  'scoring'
];

export const PHASE_LABELS: Record<string, string> = {
  planning: '1. Planning',
  production: '2. Production',
  improvement: '3. Improvement Cards',
  innovation: '4. Research & Dev',
  expansion: '5. Logistics & Expansion',
  sales: '6. Sales Resolution',
  control: '7. Control Phase',
  scoring: '8. Scoring Phase'
};

export function getNextPhase(state: GameState): { nextPhase: GamePhase; nextRound: number; isGameEnd: boolean } {
  const rawPhase = (state.currentPhase || 'planning').toLowerCase();
  const currentPhase = rawPhase === 'research' ? 'innovation' : (rawPhase === 'logistics' ? 'expansion' : rawPhase) as GamePhase;
  const currentRound = state.currentRound || 1;

  const currentIndex = PHASE_SEQUENCE.indexOf(currentPhase);
  if (currentIndex >= 0 && currentIndex < PHASE_SEQUENCE.length - 1) {
    let nextPhase = PHASE_SEQUENCE[currentIndex + 1];
    // In Round 5, skip Improvement phase and go directly to Innovation (Research)
    if (currentRound >= 5 && nextPhase === 'improvement') {
      nextPhase = 'innovation';
    }
    return { nextPhase, nextRound: currentRound, isGameEnd: false };
  } else {
    if (currentRound >= 5) {
      return { nextPhase: 'scoring', nextRound: 5, isGameEnd: true };
    }
    return { nextPhase: 'planning', nextRound: currentRound + 1, isGameEnd: false };
  }
}

/** Pure helper to create the facilitator default $5 plan (Combination 2, Position 2) */
export function createFacilitatorDefaultPlan(state: GameState, teamId: string): TeamRoundData {
  const stats = calculatePlanStats(state, teamId, 2, 2, {}, COMBINATIONS);
  return {
    teamId,
    combination: 2,
    position: 2,
    price: stats.calculatedPrice ?? 5,
    productsProduced: stats.productsAvailable ?? 3,
    improvementCards: stats.improvementPoints ?? 1,
    researchIcons: stats.researchPoints ?? 1,
    logisticsIcons: stats.logisticsPoints ?? 3,
    revenue: 0,
    technologiesResearched: [],
    expansionLocations: [],
    salesByRegion: {},
    regionControlPoints: {},
    controlValue: 0,
    totalMoney: 0,
    facilitatorDefault: true
  };
}

/** Pure phase advancing engine.
 * Moves state exactly one phase forward. Does NOT plan for human teams unless forced. */
export function advanceOnePhase(state: GameState, now: Date = new Date(), options?: { force?: boolean }): GameState {
  if (state.gameEnded) return state;

  const { nextPhase, nextRound, isGameEnd } = getNextPhase(state);
  const nextState: GameState = JSON.parse(JSON.stringify(state));

  if (isGameEnd) {
    nextState.gameEnded = true;
    nextState.currentPhase = 'scoring';
    nextState.updatedAt = now;
    return nextState;
  }

  // Handle Force advance in Planning: apply $5 facilitator default plan to unsubmitted human teams
  if (options?.force && (state.currentPhase || 'planning').toLowerCase() === 'planning') {
    let roundIdx = nextState.rounds.findIndex(r => r.roundNumber === state.currentRound);
    if (roundIdx === -1) {
      nextState.rounds.push({ roundNumber: state.currentRound, teamData: {} });
      roundIdx = nextState.rounds.length - 1;
    }
    const currentRoundData = nextState.rounds[roundIdx];
    nextState.teams.forEach(team => {
      if (!team.isBot) {
        const td = currentRoundData.teamData[team.id];
        if (!td || td.price === undefined || td.price === null || td.price === 0) {
          currentRoundData.teamData[team.id] = createFacilitatorDefaultPlan(nextState, team.id);
        }
      }
    });
  }

  // Handle round transition (scoring -> planning)
  if (nextRound > state.currentRound) {
    nextState.currentRound = nextRound;
    nextState.currentPhase = 'planning';

    // Handle Permanent Tech Benefits: Wi-Fi carried over products
    if (!nextState.advancedState) nextState.advancedState = {};
    if (!nextState.advancedState.carriedOverProducts) nextState.advancedState.carriedOverProducts = {};

    const prevRoundData = nextState.rounds.find(r => r.roundNumber === state.currentRound);
    if (prevRoundData) {
      nextState.teams.forEach(team => {
        const completedTechs = nextState.teamResearchProgress?.[team.id]?.completedTechnologies || [];
        const hasWifi = completedTechs.includes('Wi-Fi Technology');
        if (hasWifi) {
          const tData = prevRoundData.teamData[team.id];
          if (tData) {
            const produced = tData.productsProduced || 0;
            const sold = tData.customersSold?.length || 0;
            const unsold = Math.max(0, produced - sold);
            nextState.advancedState!.carriedOverProducts![team.id] = unsold;
          }
        }
      });
    }

    // Ensure roundData exists for new round
    if (!nextState.rounds.some(r => r.roundNumber === nextRound)) {
      nextState.rounds.push({ roundNumber: nextRound, teamData: {} });
    }
  } else {
    nextState.currentPhase = nextPhase;

    // Side effect on entering improvement phase: auto-assign product cards for teams with 0 improvement
    if (nextPhase === 'improvement') {
      const currentRoundData = nextState.rounds.find(r => r.roundNumber === nextState.currentRound);
      if (currentRoundData) {
        if (!nextState.improvementCards) nextState.improvementCards = [];
        nextState.teams.forEach(team => {
          const tData = currentRoundData.teamData[team.id];
          const hasCard = nextState.improvementCards.some(c =>
            (c.availableForTeam === team.id || c.usedBy === team.id) && c.allocatedInRound === nextState.currentRound
          );
          if (tData && tData.improvementCards === 0 && !hasCard) {
            const productCardId = -(nextState.improvementCards.filter(c => c.id < 0).length + 1);
            nextState.improvementCards.push({
              id: productCardId,
              icon1: 'Product',
              icon2: 'None' as any,
              availableForTeam: team.id,
              used: false,
              isInitial: false,
              allocatedInRound: nextState.currentRound,
            });
          }
        });
      }
    }
  }

  nextState.updatedAt = now;
  return nextState;
}

/** Pure helper to identify teams that have not finished their action in the current phase */
export function getBlockingTeams(state: GameState): { teamId: string; name: string; reason: string }[] {
  if (!state || state.gameEnded) return [];

  const round = state.currentRound || 1;
  const rawPhase = (state.currentPhase || 'planning').toLowerCase();
  const phase = rawPhase === 'research' ? 'innovation' : (rawPhase === 'logistics' ? 'expansion' : rawPhase);
  const roundData = state.rounds.find(r => r.roundNumber === round);

  const blocking: { teamId: string; name: string; reason: string }[] = [];

  state.teams.forEach(team => {
    const tData = roundData?.teamData[team.id];

    if (phase === 'planning') {
      if (!tData || tData.price === undefined || tData.price === null || tData.price === 0) {
        blocking.push({ teamId: team.id, name: team.name, reason: 'Plan not submitted' });
      }
    } else if (phase === 'improvement') {
      if (round < 5) {
        const count = tData?.improvementCards || 0;
        if (count > 0) {
          const isDone = (state.improvementCards || []).some(c =>
            (c.availableForTeam === team.id || c.usedBy === team.id) && c.allocatedInRound === round
          );
          if (!isDone) {
            blocking.push({ teamId: team.id, name: team.name, reason: 'Improvement card pending' });
          }
        }
      }
    } else if (phase === 'innovation') {
      const icons = tData?.researchIcons || 0;
      if (icons > 0) {
        const spent = (state.researchAllocatedByRound || {})[round]?.[team.id] || 0;
        if (spent < icons) {
          blocking.push({ teamId: team.id, name: team.name, reason: `Research icons pending (${spent}/${icons})` });
        }
      }
    } else if (phase === 'expansion') {
      const icons = tData?.logisticsIcons || 0;
      if (icons > 0) {
        const spent = (state.logisticsAllocatedByRound || {})[round]?.[team.id] || 0;
        if (spent < icons) {
          blocking.push({ teamId: team.id, name: team.name, reason: `Logistics icons pending (${spent}/${icons})` });
        }
      }
    } else if (phase === 'sales') {
      const produced = tData?.productsProduced || 0;
      if (produced > 0 && !tData?.customersSold) {
        blocking.push({ teamId: team.id, name: team.name, reason: 'Sales resolution pending' });
      }
    }
  });

  return blocking;
}
