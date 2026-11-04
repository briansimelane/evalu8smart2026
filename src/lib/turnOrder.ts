import {
  GameState,
  Team,
  TurnState,
  calculateTeamTotalScore,
  getInitialScore,
} from '@/types/game';

export function normalizePhaseName(phase?: string): string {
  const raw = (phase || 'planning').toLowerCase();
  if (raw === 'research') return 'innovation';
  if (raw === 'logistics') return 'expansion';
  return raw;
}

/**
 * Pure calculation of base play order for a round (sorted by lowest price, then lowest previous score).
 */
export function calculatePlayOrderForState(state: GameState, roundNumber: number): Team[] {
  if (!state || !state.teams) return [];

  const roundData = state.rounds.find((r) => r.roundNumber === roundNumber);
  if (!roundData) return [...state.teams];

  const teamsWithData = state.teams.map((team) => {
    const currentData = roundData.teamData[team.id];
    const previousScore =
      roundNumber > 1
        ? calculateTeamTotalScore(team.id, roundNumber - 1, state).totalScore
        : getInitialScore(team);

    return {
      team,
      currentPrice: currentData?.price ?? Infinity,
      previousScore,
    };
  });

  teamsWithData.sort((a, b) => {
    if (a.currentPrice !== b.currentPrice) {
      return a.currentPrice - b.currentPrice;
    }
    return a.previousScore - b.previousScore;
  });

  return teamsWithData.map((item) => item.team);
}

/**
 * Computes the turn order (`TurnState`) for a given phase and round.
 * Skips teams that have no plan or 0 allowance in the target phase.
 * Bots stay in the order.
 */
export function computeTurnOrder(state: GameState, targetPhase?: string): TurnState {
  const round = state.currentRound || 1;
  const phase = normalizePhaseName(targetPhase ?? state.currentPhase);
  const baseOrder = calculatePlayOrderForState(state, round);
  const roundData = state.rounds.find((r) => r.roundNumber === round);

  let eligibleTeams: Team[] = [];

  if (phase === 'planning') {
    eligibleTeams = [...baseOrder];
  } else if (phase === 'improvement') {
    if (round < 5) {
      eligibleTeams = baseOrder.filter((team) => {
        const td = roundData?.teamData[team.id];
        return !!td && (td.improvementCards || 0) > 0;
      });
    }
  } else if (phase === 'innovation') {
    eligibleTeams = baseOrder.filter((team) => {
      const td = roundData?.teamData[team.id];
      return !!td && (td.researchIcons || 0) > 0;
    });
  } else if (phase === 'expansion') {
    eligibleTeams = baseOrder.filter((team) => {
      const td = roundData?.teamData[team.id];
      return !!td && (td.logisticsIcons || 0) > 0;
    });
  } else if (phase === 'sales') {
    eligibleTeams = baseOrder.filter((team) => {
      const td = roundData?.teamData[team.id];
      return !!td && (td.productsProduced || 0) > 0;
    });
  }

  return {
    round,
    phase,
    order: eligibleTeams.map((t) => t.id),
    index: 0,
  };
}
