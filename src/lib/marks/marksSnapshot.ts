import { GameState, RoundMarksSnapshot, getRegionalControlBreakdownForTeamInRound } from '@/types/game';
import { getCompletedOffices, hasTech } from '@/lib/rules';
import { isRuleActiveForTeam } from '@/lib/defaultRules';

/** Pure. Computes the snapshot for every team (bots included) for `roundNumber` from `state` as it stands now. */
export function captureRoundMarksSnapshot(
  state: GameState,
  roundNumber: number,
  now: Date = new Date(),
): Record<string, RoundMarksSnapshot> {
  const roundObj = state.rounds?.find(r => r.roundNumber === roundNumber);
  const out: Record<string, RoundMarksSnapshot> = {};
  (state.teams || []).forEach(team => {
    const offices = Object.values(state.regionLogistics || {})
      .reduce((sum, region) => sum + getCompletedOffices(region, team.id), 0);
    const technologies = new Set(state.teamResearchProgress?.[team.id]?.completedTechnologies || []).size;
    const patents = Object.values(state.patents || {}).filter(h => h === team.id).length;
    const controlledRegions = roundObj
      ? getRegionalControlBreakdownForTeamInRound(roundObj, team.id, state).filter(d => d.rank === 'first').length
      : 0;
    const wifiCarryOverActive =
      isRuleActiveForTeam(state.ruleAdjustments, 'tech_permanent_benefits', team.id) &&
      hasTech(state, team.id, 'WIFI');
    out[team.id] = { offices, technologies, patents, controlledRegions, wifiCarryOverActive, capturedAt: now.toISOString() };
  });
  return out;
}

export function withMarksSnapshot(state: GameState, roundNumber: number, now: Date = new Date()): GameState {
  return {
    ...state,
    marksSnapshots: {
      ...(state.marksSnapshots || {}),
      [String(roundNumber)]: captureRoundMarksSnapshot(state, roundNumber, now),
    },
  };
}
