import { useEffect, useRef } from 'react';
import { GameState, Team } from '@/types/game';
import { decidePlanning, decideResearch, decideLogistics, decideSales, decideImprovement } from '@/bots/botEngine';
import { AVAILABLE_IMPROVEMENT_CARDS } from '@/data/improvements';
import { calculatePlayOrderForState } from '@/hooks/useGameBoardState';
import { WorldSubState } from './useMultiWorldSession';
import { mutateWorldState } from '@/lib/multiworld/worldWrite';

export function useMultiWorldBotRunners(worlds: WorldSubState[], options?: { paused?: boolean }) {
  const processedActions = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (options?.paused) return;
    if (!worlds || worlds.length === 0) return;

    worlds.forEach((world, wIdx) => {
      const { classId, gameState } = world;
      if (!classId || !gameState) return;
      if (gameState.botConfig?.enabled === false) return;

      const round = gameState.currentRound;
      const rawPhase = (gameState.currentPhase || 'planning').toLowerCase();
      const phase = rawPhase === 'innovation' ? 'research' : (rawPhase === 'expansion' ? 'logistics' : rawPhase);

      const roundData = gameState.rounds.find(r => r.roundNumber === round);
      const playOrder = calculatePlayOrderForState(gameState, round);

      const isBotTeam = (t: Team) => {
        return !!(
          t.isBot ||
          (t as any).accessCode === 'BOT' ||
          (t as any).code === 'BOT' ||
          t.name?.toLowerCase().includes('bot')
        );
      };

      let activeBotTeam: Team | undefined = undefined;

      if (phase === 'planning') {
        activeBotTeam = playOrder.find(t => isBotTeam(t) && !roundData?.teamData[t.id]);
      } else if (phase === 'improvement') {
        const activeTeam = playOrder.find(t => {
          const count = roundData?.teamData[t.id]?.improvementCards || 0;
          const isDone = gameState.improvementCards?.some(c =>
            (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === round
          );
          return count > 0 && !isDone;
        });
        if (activeTeam && isBotTeam(activeTeam)) {
          activeBotTeam = activeTeam;
        }
      } else if (phase === 'research') {
        const activeTeam = playOrder.find(t => {
          const icons = roundData?.teamData[t.id]?.researchIcons || 0;
          const spent = (gameState.researchAllocatedByRound || {})[round]?.[t.id] || 0;
          return icons > 0 && spent < icons;
        });
        if (activeTeam && isBotTeam(activeTeam)) {
          activeBotTeam = activeTeam;
        }
      } else if (phase === 'logistics') {
        const activeTeam = playOrder.find(t => {
          const icons = roundData?.teamData[t.id]?.logisticsIcons || 0;
          const spent = (gameState.logisticsAllocatedByRound || {})[round]?.[t.id] || 0;
          return icons > 0 && spent < icons;
        });
        if (activeTeam && isBotTeam(activeTeam)) {
          activeBotTeam = activeTeam;
        }
      } else if (phase === 'sales') {
        const activeSalesPlayOrder = playOrder.filter(team => {
          const tData = roundData?.teamData[team.id];
          return (tData?.productsProduced || 0) > 0;
        });
        const activeTeam = activeSalesPlayOrder.find(t => {
          const tData = roundData?.teamData[t.id];
          return !tData?.customersSold;
        });
        if (activeTeam && isBotTeam(activeTeam)) {
          activeBotTeam = activeTeam;
        }
      }

      if (!activeBotTeam) return;

      const actionKey = `${classId}:${round}:${phase}:${activeBotTeam.id}`;
      if (processedActions.current.has(actionKey)) return;
      processedActions.current.add(actionKey);

      const delay = 800 + wIdx * 150 + Math.random() * 600;

      const timerId = setTimeout(async () => {
        if (options?.paused) return;

        try {
          const teamId = activeBotTeam!.id;
          const profile = (activeBotTeam as any).botProfile || 'BALANCED';
          const difficulty = (activeBotTeam as any).botDifficulty || 'MEDIUM';

          await mutateWorldState(classId, (fresh) => {
            let nextState = JSON.parse(JSON.stringify(fresh)) as GameState;
            let rIdx = nextState.rounds.findIndex(r => r.roundNumber === round);
            if (rIdx === -1) {
              nextState.rounds.push({ roundNumber: round, teamData: {} });
              rIdx = nextState.rounds.length - 1;
            }

            if (phase === 'planning') {
              const botPlan = decidePlanning(nextState, teamId, profile, difficulty);
              nextState.rounds[rIdx].teamData[teamId] = botPlan;
            } else if (phase === 'improvement') {
              if (!nextState.improvementPoolByRound) nextState.improvementPoolByRound = {};
              if (!nextState.improvementPoolByRound[round] || nextState.improvementPoolByRound[round].length === 0) {
                const usedCardIds = (nextState.improvementCards || []).filter(c => c.used).map(c => c.id);
                const availablePool = AVAILABLE_IMPROVEMENT_CARDS.filter(c => !usedCardIds.includes(c.id));
                nextState.improvementPoolByRound[round] = availablePool.slice(0, nextState.teams.length).map(c => c.id);
              }

              let cardIdToClaim = decideImprovement(nextState, teamId, profile, difficulty);

              if (cardIdToClaim === null) {
                const poolIds = nextState.improvementPoolByRound[round] || [];
                const claimedInRound = (nextState.improvementCards || [])
                  .filter(c => c.allocatedInRound === round && c.availableForTeam)
                  .map(c => c.id);
                const availableCardId = poolIds.find(id => !claimedInRound.includes(id));
                if (availableCardId !== undefined) {
                  cardIdToClaim = availableCardId;
                } else {
                  cardIdToClaim = -(Math.floor(Math.random() * 1000) + 1);
                }
              }

              if (!nextState.improvementCards) nextState.improvementCards = [];

              if (cardIdToClaim !== null) {
                const existingIdx = nextState.improvementCards.findIndex(c => c.id === cardIdToClaim);
                if (existingIdx !== -1) {
                  nextState.improvementCards[existingIdx] = {
                    ...nextState.improvementCards[existingIdx],
                    availableForTeam: teamId,
                    allocatedInRound: round
                  };
                } else {
                  const cardData = AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === cardIdToClaim);
                  nextState.improvementCards.push({
                    id: cardIdToClaim,
                    icon1: cardData?.icon1 || 'Research',
                    icon2: cardData?.icon2 || 'Product',
                    availableForTeam: teamId,
                    used: false,
                    isInitial: false,
                    allocatedInRound: round
                  });
                }
              }
            } else if (phase === 'research') {
              const currentTeamData = nextState.rounds[rIdx].teamData[teamId];
              const maxIcons = currentTeamData?.researchIcons || 0;
              const alreadySpent = (nextState.researchAllocatedByRound || {})[round]?.[teamId] || 0;
              const neededPoints = maxIcons - alreadySpent;

              if (neededPoints > 0) {
                const resDecision = decideResearch(nextState, teamId, profile, difficulty);
                if (resDecision) {
                  if (!nextState.teamResearchProgress[teamId]) {
                    nextState.teamResearchProgress[teamId] = { teamId, technologyInvestments: {}, completedTechnologies: [] };
                  }

                  const techName = resDecision.techName;
                  const currentPoints = nextState.teamResearchProgress[teamId].technologyInvestments[techName] || 0;
                  const newPoints = currentPoints + neededPoints;
                  nextState.teamResearchProgress[teamId].technologyInvestments[techName] = newPoints;

                  const reqPoints = nextState.technologies[techName]?.researchPoints || 4;
                  if (newPoints >= reqPoints && !nextState.teamResearchProgress[teamId].completedTechnologies.includes(techName)) {
                    nextState.teamResearchProgress[teamId].completedTechnologies.push(techName);
                    if (!nextState.patents[techName]) {
                      nextState.patents[techName] = teamId;
                    }
                  }

                  if (!nextState.researchAllocatedByRound) nextState.researchAllocatedByRound = {};
                  if (!nextState.researchAllocatedByRound[round]) nextState.researchAllocatedByRound[round] = {};
                  nextState.researchAllocatedByRound[round][teamId] = maxIcons;
                }
              }
            } else if (phase === 'logistics') {
              const currentTeamData = nextState.rounds[rIdx].teamData[teamId];
              const maxIcons = currentTeamData?.logisticsIcons || 0;
              const allocatedSpent = (nextState.logisticsAllocatedByRound || {})[round]?.[teamId] || 0;
              const neededPoints = maxIcons - allocatedSpent;

              if (neededPoints > 0) {
                const logDecision = decideLogistics(nextState, teamId, profile, difficulty);
                if (logDecision) {
                  const regionName = logDecision.regionName;
                  const reg = nextState.regionLogistics[regionName];

                  if (reg) {
                    const currentInvested = reg.teamProgress[teamId] || 0;
                    const newInvested = currentInvested + neededPoints;
                    reg.teamProgress[teamId] = newInvested;

                    if (newInvested >= reg.logisticsCost && !reg.teamsPresent.includes(teamId)) {
                      reg.teamsPresent.push(teamId);
                    }
                    nextState.regionLogistics[regionName] = reg;

                    const teamLog = nextState.teamLogisticsProgress[teamId] || { teamId, regionsWithPresence: [], regionInvestments: {} };
                    if (newInvested >= reg.logisticsCost && !teamLog.regionsWithPresence.includes(regionName)) {
                      teamLog.regionsWithPresence = [...teamLog.regionsWithPresence, regionName];
                    }
                    teamLog.regionInvestments = teamLog.regionInvestments || {};
                    teamLog.regionInvestments[regionName] = newInvested;
                    nextState.teamLogisticsProgress[teamId] = teamLog;
                  }
                }

                if (!nextState.logisticsAllocatedByRound) nextState.logisticsAllocatedByRound = {};
                if (!nextState.logisticsAllocatedByRound[round]) nextState.logisticsAllocatedByRound[round] = {};
                nextState.logisticsAllocatedByRound[round][teamId] = maxIcons;
              }
            } else if (phase === 'sales') {
              const currentTeamData = nextState.rounds[rIdx].teamData[teamId];
              if (currentTeamData && !currentTeamData.customersSold) {
                const soldCustomers = new Set<string>();
                Object.values(nextState.rounds[rIdx].teamData || {}).forEach((td: any) => {
                  if (td?.customersSold) {
                    td.customersSold.forEach((cid: string) => soldCustomers.add(cid));
                  }
                });

                const soldIds = decideSales(nextState, teamId, soldCustomers);
                nextState.rounds[rIdx].teamData[teamId].customersSold = soldIds;
              }
            }

            return nextState;
          }, { expectPhase: gameState.currentPhase, expectRound: gameState.currentRound });

        } catch (err) {
          console.error(`Error executing bot turn for ${classId}:`, err);
        }
      }, delay);

      return () => clearTimeout(timerId);
    });
  }, [worlds, options?.paused]);
}
