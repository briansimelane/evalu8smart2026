import { GameState } from '@/types/game';

export const DEMO_HIDDEN_FIELDS = [
  'combination', 'position', 'cardUsages', 'improvementCardUsage',
  'improvementCardId', 'improvementCards', 'researchIcons', 'logisticsIcons',
] as const;

/**
 * Returns a copy of gameState with hidden fields masked for every team
 * that is NOT `humanTeamId`. Pure function, never mutates original.
 * No-op when isDemo is false or revealAll is true.
 */
export function maskGameStateForDemo(
  gameState: GameState | null,
  humanTeamId: string,
  opts?: { revealAll?: boolean; isDemo?: boolean }
): GameState | null {
  if (!gameState) return null;
  if (opts?.isDemo === false || opts?.revealAll) return gameState;

  const numTeams = gameState.teams.length;

  const maskedRounds = gameState.rounds.map(rd => {
    // Reveal decisions once all teams have submitted plans for this round
    const submittedTeamsCount = Object.keys(rd.teamData || {}).length;
    const allPlansIn = numTeams > 0 && submittedTeamsCount >= numTeams;

    if (allPlansIn) {
      return rd;
    }

    const maskedTeamData = { ...rd.teamData };
    Object.keys(maskedTeamData).forEach(teamId => {
      if (teamId !== humanTeamId) {
        const td = { ...maskedTeamData[teamId] };
        td.combination = 0;
        td.position = 0;
        td.cardUsages = [];
        td.researchIcons = 0;
        td.logisticsIcons = 0;
        maskedTeamData[teamId] = td;
      }
    });
    return {
      ...rd,
      teamData: maskedTeamData,
    };
  });

  return {
    ...gameState,
    rounds: maskedRounds,
  };
}
