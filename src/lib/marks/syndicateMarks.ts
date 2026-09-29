import { GameState, MarksCriterionKey, SyndicateMarksConfig } from '@/types/game';
import { captureRoundMarksSnapshot } from '@/lib/marks/marksSnapshot';
import { getCompletedOffices, hasTech } from '@/lib/rules';
import { isRuleActiveForTeam } from '@/lib/defaultRules';
import { getTeamNumber } from '@/lib/multiworld/teamLabel';

export const MARKS_CRITERIA = [
  { key: 'revenue',           label: 'Revenue (P × V)',            format: 'currency' },
  { key: 'controlledRegions', label: '# Controlled Regions',        format: 'int' },
  { key: 'offices',           label: '# Offices',                   format: 'int' },
  { key: 'technologies',      label: '# Technologies researched',   format: 'int' },
  { key: 'patents',           label: '# Patents',                   format: 'int' },
] as const;

export const DEFAULT_SYNDICATE_MARKS_CONFIG: SyndicateMarksConfig = {
  weights: { revenue: 0.2, controlledRegions: 0.2, offices: 0.2, technologies: 0.2, patents: 0.2 },
  lostProductsPenalty: 0.1,
  adjustments: {},
  excludedTeamIds: [],
  averageMark: 65,
  marksPerSigma: 10,
};

export interface RoundTeamMetrics {
  revenue: number;
  controlledRegions: number;
  offices: number;
  technologies: number;
  patents: number;
  unsold: number;
  carriedOver: number;
  lostProducts: number;
  source: 'snapshot' | 'live' | 'legacy';
  estimated: Partial<Record<MarksCriterionKey | 'lostProducts', string>>; // key -> reason
  excludedCriteria: MarksCriterionKey[];   // legacy rounds (§4.6)
}

export interface TeamMarksResult {
  teamId: string;
  teamName: string;
  teamNumber: number;
  isBot: boolean;
  excluded: boolean;
  totals: Record<MarksCriterionKey | 'lostProducts', number>;
  zScores: Record<MarksCriterionKey, number>;
  contributions: Record<MarksCriterionKey, number>;   // marks contribution
  weightedZ: number;
  lostPoints: number;                               // marks, ≥ 0
  lostShare: number;                               // 0–1 of worst
  averageMark: number;
  subtotal: number;                               // marks
  adjustmentPoints: number;
  adjustmentReason?: string;
  totalRaw: number;                               // marks
  totalClamped: number;                               // marks
  perRound: Record<number, RoundTeamMetrics>;
}

export interface WorldMarksResult {
  asAtRound: number;
  latestScorableRound: number;
  isFinal: boolean;
  teams: TeamMarksResult[];
  means: Record<MarksCriterionKey, number>;
  sds: Record<MarksCriterionKey, number>;
  warnings: string[];
  positiveWeightSum: number;
}

export function getLatestScorableRound(state: GameState): number {
  if (!state) return 0;
  let maxScorable = 0;
  for (let r = 1; r <= 5; r++) {
    const hasSnapshot = !!(state.marksSnapshots?.[String(r)]);
    const isCurrentScoring = (r === state.currentRound && (state.currentPhase === 'scoring' || !!state.gameEnded));
    const isPast = r < (state.currentRound || 1);
    if (hasSnapshot || isCurrentScoring || isPast) {
      maxScorable = r;
    }
  }
  return maxScorable;
}

/** roundNumber -> teamId -> metrics, for rounds 1..uptoRound. Implements §3.3, §4.6. */
export function collectRoundMetrics(state: GameState, uptoRound: number): Record<number, Record<string, RoundTeamMetrics>> {
  const result: Record<number, Record<string, RoundTeamMetrics>> = {};
  const teams = state.teams || [];

  for (let r = 1; r <= uptoRound; r++) {
    result[r] = {};
    const roundObj = state.rounds?.find(rd => rd.roundNumber === r);
    const snapMap = state.marksSnapshots?.[String(r)];
    const isCurrentScoringOrEnd = r === state.currentRound && (state.currentPhase === 'scoring' || !!state.gameEnded);

    let currentLiveSnap: Record<string, ReturnType<typeof captureRoundMarksSnapshot>[string]> | null = null;
    if (!snapMap && isCurrentScoringOrEnd) {
      currentLiveSnap = captureRoundMarksSnapshot(state, r);
    }

    teams.forEach(team => {
      const td = roundObj?.teamData?.[team.id];
      const revenue = td?.revenue ?? 0;

      // Lost products computation (§3.3)
      const produced = td?.productsProduced ?? 0;
      const sold = (td?.customersSold?.length ?? 0) + (td?.nfcSalesUnits ?? 0);
      const unsold = Math.max(0, produced - sold);

      if (snapMap && snapMap[team.id]) {
        const snap = snapMap[team.id];
        const carriedOver = snap.wifiCarryOverActive ? unsold : 0;
        const lostProducts = unsold - carriedOver;
        result[r][team.id] = {
          revenue,
          controlledRegions: snap.controlledRegions,
          offices: snap.offices,
          technologies: snap.technologies,
          patents: snap.patents,
          unsold,
          carriedOver,
          lostProducts,
          source: 'snapshot',
          estimated: {},
          excludedCriteria: [],
        };
      } else if (currentLiveSnap && currentLiveSnap[team.id]) {
        const snap = currentLiveSnap[team.id];
        const carriedOver = snap.wifiCarryOverActive ? unsold : 0;
        const lostProducts = unsold - carriedOver;
        result[r][team.id] = {
          revenue,
          controlledRegions: snap.controlledRegions,
          offices: snap.offices,
          technologies: snap.technologies,
          patents: snap.patents,
          unsold,
          carriedOver,
          lostProducts,
          source: 'live',
          estimated: {},
          excludedCriteria: [],
        };
      } else {
        // Legacy round without snapshot (§4.6)
        const wifiActive = isRuleActiveForTeam(state.ruleAdjustments, 'tech_permanent_benefits', team.id) &&
          hasTech(state, team.id, 'WIFI');
        const carriedOver = wifiActive ? unsold : 0;
        const lostProducts = unsold - carriedOver;

        result[r][team.id] = {
          revenue,
          controlledRegions: 0,
          offices: 0,
          technologies: 0,
          patents: 0,
          unsold,
          carriedOver,
          lostProducts,
          source: 'legacy',
          estimated: {
            lostProducts: 'Estimated from current WIFI state',
            controlledRegions: 'Legacy round (no snapshot): excluded',
            offices: 'Legacy round (no snapshot): excluded',
            technologies: 'Legacy round (no snapshot): excluded',
            patents: 'Legacy round (no snapshot): excluded',
          },
          excludedCriteria: ['controlledRegions', 'offices', 'technologies', 'patents'],
        };
      }
    });
  }

  return result;
}

/** Pure core used by the golden fixture: takes metrics directly. */
export function computeSyndicateMarks(
  teams: Array<{ id: string; name: string; isBot?: boolean; teamNumber?: number }>,
  metrics: Record<number, Record<string, Pick<RoundTeamMetrics, MarksCriterionKey | 'lostProducts'>>>,
  configInput: SyndicateMarksConfig | undefined,
  asAtRound: number,
): WorldMarksResult {
  const config: SyndicateMarksConfig = {
    weights: {
      revenue: configInput?.weights?.revenue ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.revenue,
      controlledRegions: configInput?.weights?.controlledRegions ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.controlledRegions,
      offices: configInput?.weights?.offices ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.offices,
      technologies: configInput?.weights?.technologies ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.technologies,
      patents: configInput?.weights?.patents ?? DEFAULT_SYNDICATE_MARKS_CONFIG.weights.patents,
    },
    lostProductsPenalty: configInput?.lostProductsPenalty ?? DEFAULT_SYNDICATE_MARKS_CONFIG.lostProductsPenalty,
    adjustments: configInput?.adjustments ?? {},
    excludedTeamIds: configInput?.excludedTeamIds ?? [],
    averageMark: configInput?.averageMark ?? DEFAULT_SYNDICATE_MARKS_CONFIG.averageMark ?? 65,
    marksPerSigma: configInput?.marksPerSigma ?? DEFAULT_SYNDICATE_MARKS_CONFIG.marksPerSigma ?? 10,
  };

  const averageMark = config.averageMark!;
  const marksPerSigma = config.marksPerSigma!;

  const positiveKeys: MarksCriterionKey[] = ['revenue', 'controlledRegions', 'offices', 'technologies', 'patents'];
  const positiveWeightSum = positiveKeys.reduce((sum, k) => sum + (config.weights[k] || 0), 0);

  // Normalisation of weights (D17)
  let zeroWeightsWarning = false;
  const normWeights: Record<MarksCriterionKey, number> = {
    revenue: 0.2, controlledRegions: 0.2, offices: 0.2, technologies: 0.2, patents: 0.2
  };

  if (positiveWeightSum > 0) {
    positiveKeys.forEach(k => {
      normWeights[k] = config.weights[k] / positiveWeightSum;
    });
  } else {
    zeroWeightsWarning = true;
  }

  const teamList = teams.map((t, idx) => ({
    id: t.id,
    name: t.name,
    isBot: !!t.isBot,
    teamNumber: getTeamNumber(t as any, idx),
    excluded: config.excludedTeamIds.includes(t.id),
  }));

  const scoredTeams = teamList.filter(t => !t.excluded);

  // 1. Calculate cumulative totals for each team
  const teamTotals: Record<string, Record<MarksCriterionKey | 'lostProducts', number>> = {};
  teamList.forEach(t => {
    teamTotals[t.id] = {
      revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0, lostProducts: 0,
    };
    for (let r = 1; r <= asAtRound; r++) {
      const rm = metrics[r]?.[t.id];
      if (rm) {
        positiveKeys.forEach(k => {
          teamTotals[t.id][k] += rm[k] || 0;
        });
        teamTotals[t.id].lostProducts += rm.lostProducts || 0;
      }
    }
  });

  // 2. Calculate world mean and population standard deviation (sd) for each criterion over scored set S
  const means: Record<MarksCriterionKey, number> = { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0 };
  const sds: Record<MarksCriterionKey, number> = { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0 };

  const n = scoredTeams.length;
  if (n > 0) {
    positiveKeys.forEach(k => {
      const sum = scoredTeams.reduce((acc, t) => acc + teamTotals[t.id][k], 0);
      const mean = sum / n;
      means[k] = mean;
      const variance = scoredTeams.reduce((acc, t) => acc + Math.pow(teamTotals[t.id][k] - mean, 2), 0) / n;
      sds[k] = Math.sqrt(variance);
    });
  }

  // 3. Lost products worst total over S
  const worstLost = n > 0 ? Math.max(0, ...scoredTeams.map(t => teamTotals[t.id].lostProducts)) : 0;

  // 4. Compute z-scores, contributions, lost points, subtotals and totals for each team
  const resultTeams: TeamMarksResult[] = teamList.map(t => {
    const totals = teamTotals[t.id];
    const zScores: Record<MarksCriterionKey, number> = { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0 };
    const contributions: Record<MarksCriterionKey, number> = { revenue: 0, controlledRegions: 0, offices: 0, technologies: 0, patents: 0 };
    let weightedZ = 0;
    let lostShare = 0;
    let lostPoints = 0;

    if (!t.excluded && n > 0) {
      positiveKeys.forEach(k => {
        const sd = sds[k];
        const z = sd > 0 ? (totals[k] - means[k]) / sd : 0;
        zScores[k] = z;
        const contrib = marksPerSigma * normWeights[k] * z;
        contributions[k] = contrib;
        weightedZ += normWeights[k] * z;
      });

      lostShare = worstLost > 0 ? totals.lostProducts / worstLost : 0;
      lostPoints = 100 * config.lostProductsPenalty * lostShare;
    }

    const totalContrib = positiveKeys.reduce((s, k) => s + contributions[k], 0);
    const subtotal = t.excluded ? 0 : averageMark + totalContrib - lostPoints;
    const adj = config.adjustments[t.id];
    const adjustmentPoints = adj?.points ?? 0;
    const adjustmentReason = adj?.reason;

    const totalRaw = t.excluded ? 0 : subtotal + adjustmentPoints;
    const totalClamped = Math.min(100, Math.max(0, totalRaw));

    // Map perRound metrics back
    const perRound: Record<number, RoundTeamMetrics> = {};
    for (let r = 1; r <= asAtRound; r++) {
      const rm = metrics[r]?.[t.id];
      if (rm) {
        perRound[r] = {
          revenue: rm.revenue || 0,
          controlledRegions: rm.controlledRegions || 0,
          offices: rm.offices || 0,
          technologies: rm.technologies || 0,
          patents: rm.patents || 0,
          unsold: (rm as RoundTeamMetrics).unsold || 0,
          carriedOver: (rm as RoundTeamMetrics).carriedOver || 0,
          lostProducts: rm.lostProducts || 0,
          source: (rm as RoundTeamMetrics).source || 'snapshot',
          estimated: (rm as RoundTeamMetrics).estimated || {},
          excludedCriteria: (rm as RoundTeamMetrics).excludedCriteria || [],
        };
      }
    }

    return {
      teamId: t.id,
      teamName: t.name,
      teamNumber: t.teamNumber,
      isBot: t.isBot,
      excluded: t.excluded,
      totals,
      zScores,
      contributions,
      weightedZ,
      lostPoints,
      lostShare,
      averageMark,
      subtotal,
      adjustmentPoints,
      adjustmentReason,
      totalRaw,
      totalClamped,
      perRound,
    };
  });

  // 5. Construct warnings
  const warnings: string[] = [];
  if (scoredTeams.length < 2) {
    warnings.push(`Only ${scoredTeams.length} team scored in this world.`);
  }
  if (zeroWeightsWarning) {
    warnings.push('All criterion weights are zero — using equal weights.');
  }
  if (config.excludedTeamIds.length > 0) {
    const excludedNames = teamList.filter(t => t.excluded).map(t => t.name).join(', ');
    warnings.push(`Teams excluded: ${excludedNames}.`);
  }

  return {
    asAtRound,
    latestScorableRound: asAtRound,
    isFinal: false,
    teams: resultTeams,
    means,
    sds,
    warnings,
    positiveWeightSum,
  };
}

/** Convenience wrapper for the UI: collectRoundMetrics + computeSyndicateMarks. */
export function computeWorldMarks(
  state: GameState,
  config: SyndicateMarksConfig | undefined,
  asAtRoundInput?: number,
): WorldMarksResult {
  const latestScorable = getLatestScorableRound(state);
  const asAtRound = Math.max(1, Math.min(asAtRoundInput ?? (latestScorable || 1), 5));
  const metrics = collectRoundMetrics(state, asAtRound);

  const res = computeSyndicateMarks(
    state.teams || [],
    metrics,
    config,
    asAtRound,
  );

  res.latestScorableRound = latestScorable;
  res.isFinal = !!state.gameEnded;

  // Add warning for legacy rounds if any
  const legacyRounds: number[] = [];
  for (let r = 1; r <= asAtRound; r++) {
    const hasLegacy = Object.values(metrics[r] || {}).some(m => m.source === 'legacy');
    if (hasLegacy) legacyRounds.push(r);
  }
  if (legacyRounds.length > 0) {
    res.warnings.push(`Round ${legacyRounds.join(', ')} has no snapshot; stock criteria (offices, tech, patents, control) excluded for that round.`);
  }

  return res;
}
