import { useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GameState, Team, TeamActionDoc } from '@/types/game';
import {
  decidePlanning,
  decideResearch,
  decideLogistics,
  decideSales,
  decideImprovement,
} from '@/bots/botEngine';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { COMBINATIONS } from '@/data/combinations';
import { calculatePlanStats, hasTech } from '@/lib/rules';
import { calculatePlayOrderForState, computeTurnOrder, normalizePhaseName } from '@/lib/turnOrder';
import {
  resolvePlan,
  resolveImprovement,
  resolveResearch,
  resolveLogistics,
  resolveSales,
} from '@/lib/referee/resolvers';
import { applyRefereeActionTransaction, submitStudentPlanV2 } from '@/lib/referee/refereeEngine';
import { WorldSubState } from './useMultiWorldSession';
import { mutateWorldState } from '@/lib/multiworld/worldWrite';

export function useMultiWorldBotRunners(worlds: WorldSubState[], options?: { paused?: boolean }) {
  const processedActions = useRef<Set<string>>(new Set());
  const refereeUnsubscribes = useRef<Record<string, () => void>>({});
  const inFlightReferee = useRef<Set<string>>(new Set());

  // 1. Mount referee listeners for all v2 child worlds so human actions in Multi-World resolve automatically
  useEffect(() => {
    if (!worlds || worlds.length === 0) return;

    const currentIds = new Set(worlds.map((w) => w.classId).filter(Boolean));
    Object.keys(refereeUnsubscribes.current).forEach((cid) => {
      if (!currentIds.has(cid)) {
        refereeUnsubscribes.current[cid]();
        delete refereeUnsubscribes.current[cid];
      }
    });

    worlds.forEach((world) => {
      const { classId, classData, gameState } = world;
      if (!classId || classData?.schemaVersion !== 2) return;
      if (refereeUnsubscribes.current[classId]) return;

      refereeUnsubscribes.current[classId] = onSnapshot(
        collection(db, 'classes', classId, 'actions'),
        (snap) => {
          snap.forEach((docSnap) => {
            const actionId = docSnap.id;
            const data = docSnap.data() as TeamActionDoc;
            if (data.status === 'applied' || data.status === 'rejected') return;

            const flightKey = `${classId}:${actionId}:${data.submittedAt || ''}`;
            if (inFlightReferee.current.has(flightKey)) return;
            inFlightReferee.current.add(flightKey);

            const teams = gameState?.teams || (classData?.teams as Team[]) || [];
            applyRefereeActionTransaction(classId, actionId, teams, classData?.themeId)
              .catch((err) => {
                console.warn(`MultiWorld referee warning for ${classId}/${actionId}:`, err);
              })
              .finally(() => {
                inFlightReferee.current.delete(flightKey);
              });
          });
        },
        () => {}
      );
    });

    return () => {
      Object.values(refereeUnsubscribes.current).forEach((u) => u());
      refereeUnsubscribes.current = {};
    };
  }, [worlds]);

  // 2. Execute bot turns for all child worlds through the canonical referee resolvers
  useEffect(() => {
    if (options?.paused) return;
    if (!worlds || worlds.length === 0) return;

    const timers: NodeJS.Timeout[] = [];

    worlds.forEach((world, wIdx) => {
      const { classId, gameState } = world;
      if (!classId || !gameState) return;
      if (gameState.botConfig?.enabled === false) return;

      const round = gameState.currentRound;
      const normPhase = normalizePhaseName(gameState.currentPhase);
      const roundData = gameState.rounds.find((r) => r.roundNumber === round);
      const playOrder = calculatePlayOrderForState(gameState, round);

      const isBotTeam = (t?: Team) => {
        if (!t) return false;
        return !!(
          t.isBot ||
          (t as any).accessCode === 'BOT' ||
          (t as any).code === 'BOT' ||
          t.name?.toLowerCase().includes('bot')
        );
      };

      let activeBotTeam: Team | undefined = undefined;

      if (normPhase === 'planning') {
        activeBotTeam = playOrder.find(
          (t) =>
            isBotTeam(t) &&
            !roundData?.teamData[t.id] &&
            !gameState.planSubmittedByRound?.[round]?.[t.id]
        );
      } else if (
        normPhase === 'improvement' ||
        normPhase === 'innovation' ||
        normPhase === 'expansion' ||
        normPhase === 'sales'
      ) {
        if (
          gameState.turn &&
          gameState.turn.round === round &&
          normalizePhaseName(gameState.turn.phase) === normPhase
        ) {
          const turnTeamId = gameState.turn.order[gameState.turn.index];
          const candidate = gameState.teams.find((t) => t.id === turnTeamId);
          if (isBotTeam(candidate)) {
            activeBotTeam = candidate;
          }
        } else {
          const computed = computeTurnOrder(gameState, normPhase);
          const candidateId = computed.order.find((tid) => {
            if (normPhase === 'improvement') {
              return !gameState.improvementCards?.some(
                (c) => (c.availableForTeam === tid || c.usedBy === tid) && c.allocatedInRound === round
              );
            }
            if (normPhase === 'innovation') {
              const icons = roundData?.teamData[tid]?.researchIcons || 0;
              const spent = (gameState.researchAllocatedByRound || {})[round]?.[tid] || 0;
              return spent < icons;
            }
            if (normPhase === 'expansion') {
              const icons = roundData?.teamData[tid]?.logisticsIcons || 0;
              const spent = (gameState.logisticsAllocatedByRound || {})[round]?.[tid] || 0;
              return spent < icons;
            }
            if (normPhase === 'sales') {
              return !roundData?.teamData[tid]?.customersSold;
            }
            return false;
          });
          const candidate = gameState.teams.find((t) => t.id === candidateId);
          if (isBotTeam(candidate)) {
            activeBotTeam = candidate;
          }
        }
      }

      if (!activeBotTeam) return;

      const actionKey = `${classId}:${round}:${normPhase}:${activeBotTeam.id}`;
      if (processedActions.current.has(actionKey)) return;
      processedActions.current.add(actionKey);

      const delay = 800 + wIdx * 150 + Math.random() * 600;

      const timerId = setTimeout(async () => {
        if (options?.paused) return;

        try {
          const teamId = activeBotTeam!.id;
          const profile = activeBotTeam!.botProfile || 'BALANCED';
          const difficulty = activeBotTeam!.botDifficulty || 'MEDIUM';

          if (normPhase === 'planning' && world.classData?.schemaVersion === 2) {
            const combinations = gameState.combinationsData || COMBINATIONS;
            const decision = decidePlanning(gameState, teamId, profile, difficulty, combinations);
            const stats = calculatePlanStats(
              gameState,
              teamId,
              decision.combination,
              decision.position,
              decision.cardUsages,
              combinations
            );
            await submitStudentPlanV2(classId, round, teamId, {
              teamId,
              combination: decision.combination,
              position: decision.position,
              price: stats.calculatedPrice,
              productsProduced: stats.productsAvailable,
              improvementCards: stats.improvementPoints,
              researchIcons: stats.researchPoints,
              logisticsIcons: stats.logisticsPoints,
              cardUsages: decision.cardUsages,
              revenue: 0,
              technologiesResearched: [],
              expansionLocations: [],
              salesByRegion: {},
              regionControlPoints: {},
              controlValue: 0,
              totalMoney: 0,
            });
            return;
          }

          await mutateWorldState(
            classId,
            (fresh) => {
              let working = JSON.parse(JSON.stringify(fresh)) as GameState;
              const combinations = working.combinationsData || COMBINATIONS;

              if (normPhase === 'planning') {
                const decision = decidePlanning(working, teamId, profile, difficulty, combinations);
                const stats = calculatePlanStats(
                  working,
                  teamId,
                  decision.combination,
                  decision.position,
                  decision.cardUsages,
                  combinations
                );
                const res = resolvePlan(working, round, teamId, {
                  teamId,
                  combination: decision.combination,
                  position: decision.position,
                  price: stats.calculatedPrice,
                  productsProduced: stats.productsAvailable,
                  improvementCards: stats.improvementPoints,
                  researchIcons: stats.researchPoints,
                  logisticsIcons: stats.logisticsPoints,
                  cardUsages: decision.cardUsages,
                  revenue: 0,
                  technologiesResearched: [],
                  expansionLocations: [],
                  salesByRegion: {},
                  regionControlPoints: {},
                  controlValue: 0,
                  totalMoney: 0,
                });
                return res.valid ? res.nextState : null;
              }

              if (normPhase === 'improvement') {
                if (!working.improvementPoolByRound) working.improvementPoolByRound = {};
                if (
                  !working.improvementPoolByRound[round] ||
                  working.improvementPoolByRound[round].length === 0
                ) {
                  const usedCardIds = (working.improvementCards || [])
                    .filter((c) => c.used)
                    .map((c) => c.id);
                  const availablePool = AVAILABLE_IMPROVEMENT_CARDS.filter(
                    (c) => !usedCardIds.includes(c.id)
                  );
                  working.improvementPoolByRound[round] = availablePool
                    .slice(0, working.teams.length)
                    .map((c) => c.id);
                }

                let cardIdToClaim = decideImprovement(working, teamId, profile, difficulty);
                if (cardIdToClaim === null) {
                  const poolIds = working.improvementPoolByRound[round] || [];
                  const claimedInRound = (working.improvementCards || [])
                    .filter((c) => c.allocatedInRound === round && c.availableForTeam)
                    .map((c) => c.id);
                  const availableCardId = poolIds.find((id) => !claimedInRound.includes(id));
                  cardIdToClaim = availableCardId !== undefined ? availableCardId : -100;
                }

                const res = resolveImprovement(working, teamId, cardIdToClaim);
                if (!res.valid) return null;
                working = res.nextState;
              } else if (normPhase === 'innovation') {
                const rData = working.rounds.find((r) => r.roundNumber === round);
                const tData = rData?.teamData[teamId];
                const maxIcons = tData?.researchIcons || 0;
                const alreadySpent = (working.researchAllocatedByRound || {})[round]?.[teamId] || 0;
                const neededPoints = Math.max(0, maxIcons - alreadySpent);
                const allocations = decideResearch(
                  working,
                  teamId,
                  neededPoints,
                  profile,
                  difficulty
                );
                const res = resolveResearch(working, teamId, allocations, true);
                if (!res.valid) return null;
                working = res.nextState;
              } else if (normPhase === 'expansion') {
                const rData = working.rounds.find((r) => r.roundNumber === round);
                const tData = rData?.teamData[teamId];
                const maxIcons = tData?.logisticsIcons || 0;
                const alreadySpent =
                  (working.logisticsAllocatedByRound || {})[round]?.[teamId] || 0;
                const neededPoints = Math.max(0, maxIcons - alreadySpent);
                const allocations = decideLogistics(
                  working,
                  teamId,
                  neededPoints,
                  profile,
                  difficulty
                );
                const res = resolveLogistics(working, teamId, allocations, true);
                if (!res.valid) return null;
                working = res.nextState;
              } else if (normPhase === 'sales') {
                const rData = working.rounds.find((r) => r.roundNumber === round);
                const tData = rData?.teamData[teamId];
                if (!tData || tData.customersSold) return null;

                const soldCustomers = new Set<string>();
                Object.values(rData?.teamData || {}).forEach((td) => {
                  if (td.customersSold) {
                    td.customersSold.forEach((cid) => soldCustomers.add(cid));
                  }
                });

                const chosenCustomerIds = decideSales(
                  working,
                  teamId,
                  profile,
                  difficulty,
                  soldCustomers
                );
                const hasNfc = hasTech(working, teamId, 'NFC');
                const produced = tData.productsProduced || 0;
                const remainingForNfc = Math.max(0, produced - chosenCustomerIds.length);
                const nfcSalesUnits = hasNfc ? Math.min(3, remainingForNfc) : 0;

                const res = resolveSales(working, teamId, {
                  customersSold: chosenCustomerIds,
                  nfcSalesUnits,
                });
                if (!res.valid) return null;
                working = res.nextState;
              }

              // Advance turn.index if in a turn-based phase
              const baseTurn = working.turn || computeTurnOrder(working, normPhase);
              working.turn = {
                ...baseTurn,
                index: baseTurn.index + 1,
              };

              return working;
            },
            { expectPhase: gameState.currentPhase, expectRound: gameState.currentRound }
          );
        } catch (err) {
          console.error(`Error executing bot turn for ${classId}:`, err);
        }
      }, delay);

      timers.push(timerId);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [worlds, options?.paused]);
}
