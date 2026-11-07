import { useEffect, useRef } from 'react';
import { GameState, Team } from '@/types/game';
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
import { computeTurnOrder, normalizePhaseName } from '@/lib/turnOrder';
import {
  resolvePlan,
  resolveImprovement,
  resolveResearch,
  resolveLogistics,
  resolveSales,
} from '@/lib/referee/resolvers';
import { submitStudentPlanV2 } from '@/lib/referee/refereeEngine';
import { WorldSubState } from './useMultiWorldSession';
import { mutateWorldState } from '@/lib/multiworld/worldWrite';
import { mutateControl } from '@/lib/v2State';

/**
 * MultiWorld Bot Runners Hook.
 * Executes bot decisions across all child worlds in a MultiWorld session.
 * Works seamlessly alongside ChildWorldReferee (`useReferee`), which manages
 * action resolution, heartbeats, and plan submission tracking.
 */
export function useMultiWorldBotRunners(worlds: WorldSubState[], options?: { paused?: boolean }) {
  const processedActions = useRef<Set<string>>(new Set());

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

      const isBotTeam = (t?: Team) => {
        if (!t) return false;
        const regTeam = (world.classData?.teamRegistry || []).find((rt: any) => rt.id === t.id);
        const wTeam = ((world.gameState as any)?.teams || []).find((wt: any) => wt.id === t.id);
        const cTeam = (world.classData?.teams || []).find((ct: any) => ct.id === t.id);
        return !!(
          t.isBot ||
          regTeam?.isBot ||
          wTeam?.isBot ||
          cTeam?.isBot ||
          (t as any).accessCode === 'BOT' ||
          (regTeam as any)?.accessCode === 'BOT' ||
          (t as any).code === 'BOT' ||
          (regTeam as any)?.code === 'BOT' ||
          t.name?.toLowerCase().includes('bot') ||
          regTeam?.name?.toLowerCase().includes('bot')
        );
      };

      // Auto-clear stale botThinking flags for teams that have already submitted
      if (gameState.botThinking && Object.keys(gameState.botThinking).length > 0) {
        const staleThinkingIds = Object.keys(gameState.botThinking).filter((tid) => {
          if (!gameState.botThinking?.[tid]) return false;
          if (normPhase === 'planning') {
            return (
              Boolean(roundData?.teamData?.[tid]?.price) ||
              Boolean(gameState.planSubmittedByRound?.[round]?.[tid])
            );
          }
          if (['improvement', 'innovation', 'expansion', 'sales'].includes(normPhase)) {
            const turn = gameState.turn;
            if (turn && Array.isArray(turn.order)) {
              const idx = turn.order.indexOf(tid);
              return idx !== -1 && idx < turn.index;
            }
          }
          return false;
        });

        if (staleThinkingIds.length > 0) {
          mutateControl(classId, (ctl) => {
            let changed = false;
            const updated = { ...(ctl.botThinking || {}) };
            staleThinkingIds.forEach((tid) => {
              if (updated[tid]) {
                delete updated[tid];
                changed = true;
              }
            });
            return changed ? { ...ctl, botThinking: updated } : null;
          }).catch(() => {});
        }
      }

      // 1. Planning Phase: Schedule all pending bots in parallel with staggered delays
      if (normPhase === 'planning') {
        const pendingBots = (gameState.teams || []).filter(
          (t) =>
            isBotTeam(t) &&
            !roundData?.teamData[t.id] &&
            !gameState.planSubmittedByRound?.[round]?.[t.id]
        );

        pendingBots.forEach((bot, bIdx) => {
          const actionKey = `${classId}:${round}:planning:${bot.id}`;
          if (processedActions.current.has(actionKey)) return;
          processedActions.current.add(actionKey);

          const delay = 400 + wIdx * 150 + bIdx * 350 + Math.random() * 400;
          const timerId = setTimeout(async () => {
            if (options?.paused) {
              processedActions.current.delete(actionKey);
              return;
            }
            try {
              const teamId = bot.id;
              const profile = bot.botProfile || 'BALANCED';
              const difficulty = bot.botDifficulty || 'MEDIUM';
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

              const planPayload = {
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
              };

              if (world.classData?.schemaVersion === 2 || gameState.schemaVersion === 2) {
                await submitStudentPlanV2(classId, round, teamId, planPayload);
                mutateControl(classId, (ctl) => {
                  if (!ctl.botThinking?.[teamId]) return null;
                  const updated = { ...(ctl.botThinking || {}) };
                  delete updated[teamId];
                  return { ...ctl, botThinking: updated };
                }).catch(() => {});
              } else {
                await mutateWorldState(classId, (fresh) => {
                  const res = resolvePlan(fresh, round, teamId, planPayload);
                  return res.valid ? res.nextState : null;
                });
              }
            } catch (err) {
              console.error(`Error submitting bot plan for ${classId}/${bot.id}:`, err);
              processedActions.current.delete(actionKey);
            }
          }, delay);

          timers.push(timerId);
        });
        return;
      }

      // 2. Turn-based Phases: Execute turn for active bot team and advance turn.index
      if (
        normPhase === 'improvement' ||
        normPhase === 'innovation' ||
        normPhase === 'expansion' ||
        normPhase === 'sales'
      ) {
        let turnTeamId: string | undefined = undefined;
        let turnIndex = 0;

        if (
          gameState.turn &&
          gameState.turn.round === round &&
          normalizePhaseName(gameState.turn.phase) === normPhase
        ) {
          turnIndex = gameState.turn.index ?? 0;
          turnTeamId = gameState.turn.order[turnIndex];
        } else {
          const computed = computeTurnOrder(gameState, normPhase);
          turnTeamId = computed.order[0];
          turnIndex = 0;
        }

        if (!turnTeamId) return;

        const activeBotTeam = (gameState.teams || []).find((t) => t.id === turnTeamId);
        if (!activeBotTeam || !isBotTeam(activeBotTeam)) {
          return;
        }

        const actionKey = `${classId}:${round}:${normPhase}:${turnTeamId}:${turnIndex}`;
        if (processedActions.current.has(actionKey)) return;
        processedActions.current.add(actionKey);

        const delay = 600 + wIdx * 150 + Math.random() * 500;
        const timerId = setTimeout(async () => {
          if (options?.paused) {
            processedActions.current.delete(actionKey);
            return;
          }

          try {
            const teamId = activeBotTeam.id;
            const profile = activeBotTeam.botProfile || 'BALANCED';
            const difficulty = activeBotTeam.botDifficulty || 'MEDIUM';

            const res = await mutateWorldState(
              classId,
              (fresh) => {
                let working = JSON.parse(JSON.stringify(fresh)) as GameState;

                const currentTurn =
                  working.turn &&
                  working.turn.round === round &&
                  normalizePhaseName(working.turn.phase) === normPhase
                    ? working.turn
                    : computeTurnOrder(working, normPhase);

                const expectedTeamId = currentTurn.order[currentTurn.index];
                if (expectedTeamId && expectedTeamId !== teamId) {
                  return null;
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

                  const alreadyClaimed = (working.improvementCards || []).some(
                    (c) =>
                      (c.availableForTeam === teamId || c.usedBy === teamId) &&
                      c.allocatedInRound === round
                  );

                  if (!alreadyClaimed) {
                    let cardIdToClaim = decideImprovement(working, teamId, profile, difficulty);
                    if (cardIdToClaim === null) {
                      const poolIds = working.improvementPoolByRound[round] || [];
                      const claimedInRound = (working.improvementCards || [])
                        .filter((c) => c.allocatedInRound === round && c.availableForTeam)
                        .map((c) => c.id);
                      const availableCardId = poolIds.find((id) => !claimedInRound.includes(id));
                      cardIdToClaim = availableCardId !== undefined ? availableCardId : -100;
                    }

                    const imprRes = resolveImprovement(working, teamId, cardIdToClaim);
                    if (imprRes.valid) {
                      working = imprRes.nextState;
                    }
                  }
                } else if (normPhase === 'innovation') {
                  const rData = working.rounds.find((r) => r.roundNumber === round);
                  const tData = rData?.teamData[teamId];
                  const maxIcons = tData?.researchIcons || 0;
                  const alreadySpent =
                    (working.researchAllocatedByRound || {})[round]?.[teamId] || 0;
                  const neededPoints = Math.max(0, maxIcons - alreadySpent);

                  if (neededPoints > 0) {
                    const allocations = decideResearch(
                      working,
                      teamId,
                      neededPoints,
                      profile,
                      difficulty
                    );
                    const resResearch = resolveResearch(working, teamId, allocations, true);
                    if (resResearch.valid) {
                      working = resResearch.nextState;
                    }
                  }
                } else if (normPhase === 'expansion') {
                  const rData = working.rounds.find((r) => r.roundNumber === round);
                  const tData = rData?.teamData[teamId];
                  const maxIcons = tData?.logisticsIcons || 0;
                  const alreadySpent =
                    (working.logisticsAllocatedByRound || {})[round]?.[teamId] || 0;
                  const neededPoints = Math.max(0, maxIcons - alreadySpent);

                  if (neededPoints > 0) {
                    const allocations = decideLogistics(
                      working,
                      teamId,
                      neededPoints,
                      profile,
                      difficulty
                    );
                    const resLogistics = resolveLogistics(working, teamId, allocations, true);
                    if (resLogistics.valid) {
                      working = resLogistics.nextState;
                    }
                  }
                } else if (normPhase === 'sales') {
                  const rData = working.rounds.find((r) => r.roundNumber === round);
                  const tData = rData?.teamData[teamId];

                  if (tData && !tData.customersSold) {
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

                    const resSales = resolveSales(working, teamId, {
                      customersSold: chosenCustomerIds,
                      nfcSalesUnits,
                    });
                    if (resSales.valid) {
                      working = resSales.nextState;
                    }
                  }
                }

                // Clear thinking flag for this bot
                if (working.botThinking?.[teamId]) {
                  const updated = { ...(working.botThinking || {}) };
                  delete updated[teamId];
                  working.botThinking = updated;
                }

                // Advance turn.index so the next team in the turn sequence takes their action
                working.turn = {
                  ...currentTurn,
                  index: Math.min(currentTurn.index + 1, currentTurn.order.length),
                };

                return working;
              },
              { expectPhase: gameState.currentPhase, expectRound: gameState.currentRound }
            );

            if (res.skipped) {
              processedActions.current.delete(actionKey);
            }
          } catch (err) {
            console.error(`Error executing bot turn for ${classId}:`, err);
            processedActions.current.delete(actionKey);
          }
        }, delay);

        timers.push(timerId);
      }
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [worlds, options?.paused]);
}
