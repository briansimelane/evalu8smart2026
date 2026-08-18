import { useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GameState, Team } from '@/types/game';
import { decidePlanning, decideResearch, decideLogistics, decideSales, decideImprovement } from '@/bots/botEngine';
import { calculatePlanStats, getTechnologyCostForTeam } from '@/lib/rules';
import { COMBINATIONS } from '@/data/combinations';
import { REGION_CUSTOMERS } from '@/data/customers';
import { removeUndefined, safeIsoString } from '@/lib/utils';
import { calculatePlayOrderForState } from '@/hooks/useGameBoardState';

export function useMultiWorldBotRunner(classId: string | undefined, gameState: GameState | null) {
  const processedActions = useRef<Set<string>>(new Set());

  useEffect(() => {
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

    // Find active turn bot team
    let activeBotTeam: Team | undefined = undefined;

    if (phase === 'planning') {
      activeBotTeam = playOrder.find(t => isBotTeam(t) && !roundData?.teamData[t.id]);
    } else if (phase === 'improvement') {
      activeBotTeam = playOrder.find(t => {
        if (!isBotTeam(t)) return false;
        const count = roundData?.teamData[t.id]?.improvementCards || 0;
        const isDone = gameState.improvementCards?.some(c =>
          (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === round
        );
        return count > 0 && !isDone;
      });
    } else if (phase === 'research') {
      activeBotTeam = playOrder.find(t => {
        if (!isBotTeam(t)) return false;
        const icons = roundData?.teamData[t.id]?.researchIcons || 0;
        const spent = (gameState.researchAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'logistics') {
      activeBotTeam = playOrder.find(t => {
        if (!isBotTeam(t)) return false;
        const icons = roundData?.teamData[t.id]?.logisticsIcons || 0;
        const spent = (gameState.logisticsAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'sales') {
      const activeSalesPlayOrder = playOrder.filter(team => {
        const tData = roundData?.teamData[team.id];
        return (tData?.productsProduced || 0) > 0;
      });
      activeBotTeam = activeSalesPlayOrder.find(t => {
        if (!isBotTeam(t)) return false;
        const tData = roundData?.teamData[t.id];
        return !tData?.customersSold;
      });
    }

    if (!activeBotTeam) return;

    const actionKey = `${classId}:${round}:${phase}:${activeBotTeam.id}`;
    if (processedActions.current.has(actionKey)) return;
    processedActions.current.add(actionKey);

    const executeBotTurn = async () => {
      try {
        const teamId = activeBotTeam!.id;
        const profile = (activeBotTeam as any).botProfile || 'BALANCED';
        const difficulty = (activeBotTeam as any).botDifficulty || 'MEDIUM';

        let nextState = JSON.parse(JSON.stringify(gameState)) as GameState;
        let rIdx = nextState.rounds.findIndex(r => r.roundNumber === round);
        if (rIdx === -1) {
          nextState.rounds.push({ roundNumber: round, teamData: {} });
          rIdx = nextState.rounds.length - 1;
        }

        const currentTeamData = nextState.rounds[rIdx].teamData[teamId];

        if (phase === 'planning') {
          if (currentTeamData) return;

          const decision = decidePlanning(nextState, teamId, profile, difficulty, COMBINATIONS);
          const stats = calculatePlanStats(nextState, teamId, decision.combination, decision.position, decision.cardUsages, COMBINATIONS);

          nextState.rounds[rIdx].teamData[teamId] = {
            teamId,
            combination: decision.combination,
            position: decision.position,
            price: stats.calculatedPrice || 5,
            productsProduced: stats.productsAvailable || 2,
            improvementCards: stats.improvementPoints || 0,
            researchIcons: stats.researchPoints || 0,
            logisticsIcons: stats.logisticsPoints || 1,
            cardUsages: decision.cardUsages,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0,
          };
        } else if (phase === 'improvement') {
          const cardIdToClaim = decideImprovement(nextState, teamId, profile, difficulty);
          if (cardIdToClaim !== null) {
            nextState.improvementCards = nextState.improvementCards.map(c => {
              if (c.id === cardIdToClaim) {
                return { ...c, availableForTeam: teamId, allocatedInRound: round };
              }
              return c;
            });
          }
        } else if (phase === 'research') {
          const allocatedMap = nextState.researchAllocatedByRound[round] || {};
          const allocatedSpent = allocatedMap[teamId] || 0;
          const totalIcons = currentTeamData?.researchIcons || 0;
          const neededPoints = totalIcons - allocatedSpent;

          if (neededPoints > 0) {
            const allocations = decideResearch(nextState, teamId, neededPoints, profile, difficulty);
            let sumAllocated = 0;

            Object.entries(allocations).forEach(([techName, points]) => {
              if (points > 0) {
                sumAllocated += points;
                const prog = nextState.teamResearchProgress[teamId] || { teamId, technologyInvestments: {}, completedTechnologies: [] };
                const currentInvested = prog.technologyInvestments[techName] || 0;
                const newInvested = currentInvested + points;
                prog.technologyInvestments[techName] = newInvested;

                const cost = getTechnologyCostForTeam(nextState, teamId, techName);
                if (newInvested >= cost && !prog.completedTechnologies.includes(techName)) {
                  prog.completedTechnologies.push(techName);
                  if (!nextState.patents[techName]) {
                    nextState.patents[techName] = teamId;
                  }
                }
                nextState.teamResearchProgress[teamId] = prog;
              }
            });

            nextState.researchAllocatedByRound[round] = {
              ...(nextState.researchAllocatedByRound[round] || {}),
              [teamId]: (allocatedSpent + neededPoints)
            };
          }
        } else if (phase === 'logistics') {
          const allocatedMap = nextState.logisticsAllocatedByRound[round] || {};
          const allocatedSpent = allocatedMap[teamId] || 0;
          const totalIcons = currentTeamData?.logisticsIcons || 0;
          const neededPoints = totalIcons - allocatedSpent;

          if (neededPoints > 0) {
            const allocations = decideLogistics(nextState, teamId, neededPoints, profile, difficulty);
            let sumAllocated = 0;

            Object.entries(allocations).forEach(([regionName, points]) => {
              if (points > 0) {
                sumAllocated += points;
                const reg = nextState.regionLogistics[regionName] || { name: regionName, logisticsCost: 2, maxTeams: 3, connectedRegions: [], teamsPresent: [], teamProgress: {} };
                const currentInvested = reg.teamProgress[teamId] || 0;
                const newInvested = currentInvested + points;
                reg.teamProgress[teamId] = newInvested;

                if (newInvested >= reg.logisticsCost && !reg.teamsPresent.includes(teamId)) {
                  reg.teamsPresent.push(teamId);
                }
                nextState.regionLogistics[regionName] = reg;
              }
            });

            nextState.logisticsAllocatedByRound[round] = {
              ...(nextState.logisticsAllocatedByRound[round] || {}),
              [teamId]: (allocatedSpent + neededPoints)
            };
          }
        } else if (phase === 'sales') {
          if (!currentTeamData || currentTeamData.customersSold) return;

          const soldCustomers = new Set<string>();
          Object.values(nextState.rounds[rIdx].teamData || {}).forEach((td: any) => {
            if (td?.customersSold) {
              td.customersSold.forEach((cid: string) => soldCustomers.add(cid));
            }
          });

          const chosenCustomerIds = decideSales(nextState, teamId, profile, difficulty, soldCustomers);
          const teamPrice = currentTeamData.price || 5;
          const revenue = teamPrice * chosenCustomerIds.length;
          const salesByRegion: Record<string, number> = {};

          chosenCustomerIds.forEach(cid => {
            const regObj = REGION_CUSTOMERS.find(r => r.customers.some(c => c.id === cid));
            if (regObj) {
              salesByRegion[regObj.region] = (salesByRegion[regObj.region] || 0) + 1;
            }
          });

          nextState.rounds[rIdx].teamData[teamId] = {
            ...currentTeamData,
            customersSold: chosenCustomerIds,
            salesByRegion,
            revenue,
            totalMoney: (currentTeamData.totalMoney || 0) + revenue
          };
        }

        nextState.createdAt = safeIsoString(nextState.createdAt) as any;
        nextState.updatedAt = safeIsoString(new Date()) as any;

        const stateRef = doc(db, 'classes', classId, 'state', 'game');
        await setDoc(stateRef, removeUndefined({ gameState: nextState }));
      } catch (err) {
        console.error(`Error running bot turn in class ${classId}:`, err);
      }
    };

    const timer = setTimeout(executeBotTurn, 800);
    return () => clearTimeout(timer);
  }, [classId, gameState]);
}
