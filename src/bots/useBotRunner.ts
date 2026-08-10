import { useEffect, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { decidePlanning, decideResearch, decideLogistics, decideSales, decideImprovement } from './botEngine';
import { REGION_CUSTOMERS } from '@/data/customers';
import { toast } from 'sonner';
import { calculatePlanStats } from '@/lib/rules';

export function useBotRunner() {
  const { 
    gameState, 
    addRoundData, 
    allocateResearch, 
    allocateLogistics, 
    getCombinations, 
    calculatePlayOrder,
    claimImprovementCard,
    setBotThinking
  } = useGame();
  
  const { currentClassId, currentClassTeams } = useSession();

  const processedActions = useRef<Set<string>>(new Set());
  const activeTimers = useRef<Record<string, boolean>>({});
  const activeTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Maintain ref to latest gameState to avoid stale closure state in timeouts
  const latestGameState = useRef(gameState);
  useEffect(() => {
    latestGameState.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (!gameState || !currentClassId) return;
    if (gameState.botConfig?.enabled === false) return;

    const round = gameState.currentRound;
    const rawPhase = (gameState.currentPhase || 'planning').toLowerCase();
    
    // Normalize phase name
    const phase = rawPhase === 'innovation' ? 'research' : (rawPhase === 'expansion' ? 'logistics' : rawPhase);

    const roundData = gameState.rounds.find(r => r.roundNumber === round);
    const playOrder = calculatePlayOrder(round);

    const isTeamBot = (tId: string) => {
      const bTeam = gameState.teams?.find(t => t.id === tId);
      const rTeam = currentClassTeams?.[tId];
      return !!(
        bTeam?.isBot ||
        rTeam?.isBot ||
        (bTeam as any)?.accessCode === 'BOT' ||
        (rTeam as any)?.accessCode === 'BOT' ||
        (bTeam as any)?.code === 'BOT' ||
        (rTeam as any)?.code === 'BOT' ||
        bTeam?.name?.toLowerCase().includes('bot') ||
        rTeam?.name?.toLowerCase().includes('bot')
      );
    };

    // Identify active turn team based on normalized phase
    let activeTurnTeam = null;

    if (phase === 'planning') {
      // In planning phase, all bot teams without a submitted plan can submit concurrently
      activeTurnTeam = playOrder.find(t => !roundData?.teamData[t.id] && isTeamBot(t.id));
    } else if (phase === 'improvement') {
      activeTurnTeam = playOrder.find(t => {
        const count = roundData?.teamData[t.id]?.improvementCards || 0;
        const isDone = gameState.improvementCards.some(c => 
          (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === round
        );
        return count > 0 && !isDone;
      });
    } else if (phase === 'research') {
      activeTurnTeam = playOrder.find(t => {
        if (!isTeamBot(t.id)) return false;
        const icons = roundData?.teamData[t.id]?.researchIcons || 0;
        const spent = (gameState.researchAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'logistics') {
      activeTurnTeam = playOrder.find(t => {
        if (!isTeamBot(t.id)) return false;
        const icons = roundData?.teamData[t.id]?.logisticsIcons || 0;
        const spent = (gameState.logisticsAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'sales') {
      const activeSalesPlayOrder = playOrder.filter(team => {
        const tData = roundData?.teamData[team.id];
        return (tData?.productsProduced || 0) > 0 && isTeamBot(team.id);
      });
      activeTurnTeam = activeSalesPlayOrder.find(t => {
        const tData = roundData?.teamData[t.id];
        return !tData?.customersSold;
      });
    }

    // If there is no active turn team, or the active turn team is NOT a bot, do nothing!
    if (!activeTurnTeam) return;

    const teamId = activeTurnTeam.id;
    if (!isTeamBot(teamId)) return; // Wait for human player to make decision

    const actionKey = `${round}:${phase}:${teamId}`;

    // Skip if already processed or already has a running timer
    if (processedActions.current.has(actionKey)) return;
    if (activeTimers.current[actionKey]) return;

    const botTeam = gameState.teams?.find(t => t.id === teamId);

    // Trigger timer and set bot "thinking" status on Firestore
    activeTimers.current[actionKey] = true;
    setBotThinking(teamId, true);
    
    const delay = 1500 + Math.random() * 2000; // 1.5-3.5s thinking delay

    activeTimeouts.current[actionKey] = setTimeout(() => {
      try {
        // Re-read latest state inside timeout to prevent race conditions
        const currentState = latestGameState.current;
        if (!currentState) return;

        const currentBotTeam = currentState.teams?.find(t => t.id === teamId) || botTeam;
        const currentRoundData = currentState.rounds.find(r => r.roundNumber === round);
        const currentTeamData = currentRoundData?.teamData[teamId];
        const combinationsData = getCombinations();

        if (phase === 'planning') {
          if (currentTeamData) return;

          const profile = (currentBotTeam as any)?.botProfile || 'BALANCED';
          const difficulty = (currentBotTeam as any)?.botDifficulty || 'MEDIUM';
          const decision = decidePlanning(currentState, teamId, profile, difficulty, combinationsData);

          const mockStats = {
            teamId,
            combination: decision.combination,
            position: decision.position,
            price: 0,
            productsProduced: 0,
            improvementCards: 0,
            researchIcons: 0,
            logisticsIcons: 0,
            cardUsages: decision.cardUsages,
            revenue: 0,
            technologiesResearched: [],
            expansionLocations: [],
            salesByRegion: {},
            regionControlPoints: {},
            controlValue: 0,
            totalMoney: 0,
          };

          const stats = calculatePlanStats(currentState, teamId, decision.combination, decision.position, decision.cardUsages, combinationsData);
          mockStats.price = stats.calculatedPrice;
          mockStats.productsProduced = stats.productsAvailable;
          mockStats.improvementCards = stats.improvementPoints;
          mockStats.researchIcons = stats.researchPoints;
          mockStats.logisticsIcons = stats.logisticsPoints;

          addRoundData(round, teamId, mockStats);
          toast.info(`🤖 ${currentBotTeam?.name || 'Bot'} submitted its plan.`);

        } else if (phase === 'improvement') {
          const alreadyClaimed = currentState.improvementCards.some(c => 
            (c.availableForTeam === teamId || c.usedBy === teamId) && c.allocatedInRound === round
          );
          if (alreadyClaimed) return;

          const profile = (currentBotTeam as any)?.botProfile || 'BALANCED';
          const difficulty = (currentBotTeam as any)?.botDifficulty || 'MEDIUM';
          const cardIdToClaim = decideImprovement(currentState, teamId, profile, difficulty);

          if (cardIdToClaim !== null) {
            claimImprovementCard(cardIdToClaim, teamId);
            toast.info(`🤖 ${currentBotTeam?.name || 'Bot'} claimed an improvement card.`);
          } else {
            toast.info(`🤖 ${currentBotTeam?.name || 'Bot'} skipped improvement card selection.`);
          }

        } else if (phase === 'research') {
          if (!currentTeamData) return;

          const allocatedMap = currentState.researchAllocatedByRound[round] || {};
          const allocatedSpent = allocatedMap[teamId] || 0;
          const totalIcons = currentTeamData.researchIcons || 0;

          if (allocatedSpent >= totalIcons) return;

          const profile = (currentBotTeam as any)?.botProfile || 'BALANCED';
          const difficulty = (currentBotTeam as any)?.botDifficulty || 'MEDIUM';
          const neededPoints = totalIcons - allocatedSpent;
          const allocations = decideResearch(currentState, teamId, neededPoints, profile, difficulty);

          let sumAllocated = 0;
          Object.entries(allocations).forEach(([techName, points]) => {
            if (points > 0) {
              allocateResearch(teamId, techName, points);
              sumAllocated += points;
            }
          });

          // Fallback: If remaining points were unallocated, dump leftovers to clear spent count
          const leftoverPoints = neededPoints - sumAllocated;
          if (leftoverPoints > 0) {
            const allTechs = Object.keys(currentState.technologies);
            const fallbackTech = allTechs[0] || 'GPS';
            allocateResearch(teamId, fallbackTech, leftoverPoints);
          }

          toast.info(`🤖 ${currentBotTeam?.name || 'Bot'} allocated research points.`);

        } else if (phase === 'logistics') {
          if (!currentTeamData) return;

          const allocatedMap = currentState.logisticsAllocatedByRound[round] || {};
          const allocatedSpent = allocatedMap[teamId] || 0;
          const totalIcons = currentTeamData.logisticsIcons || 0;

          if (allocatedSpent >= totalIcons) return;

          const profile = (currentBotTeam as any)?.botProfile || 'BALANCED';
          const difficulty = (currentBotTeam as any)?.botDifficulty || 'MEDIUM';
          const neededPoints = totalIcons - allocatedSpent;
          const allocations = decideLogistics(currentState, teamId, neededPoints, profile, difficulty);

          let sumAllocated = 0;
          Object.entries(allocations).forEach(([regionName, points]) => {
            if (points > 0) {
              allocateLogistics(teamId, regionName, points);
              sumAllocated += points;
            }
          });

          // Fallback: If remaining points were unallocated, dump leftovers to clear spent count
          const leftoverPoints = neededPoints - sumAllocated;
          if (leftoverPoints > 0) {
            const allRegions = Object.keys(currentState.regionLogistics);
            const fallbackRegion = allRegions[0] || 'USA';
            allocateLogistics(teamId, fallbackRegion, leftoverPoints);
          }

          toast.info(`🤖 ${currentBotTeam?.name || 'Bot'} allocated logistics points.`);

        } else if (phase === 'sales') {
          if (!currentTeamData || currentTeamData.customersSold) return;

          const soldCustomers = new Set<string>();
          Object.values(currentRoundData?.teamData || {}).forEach(tData => {
            if (tData.customersSold) {
              tData.customersSold.forEach(cid => soldCustomers.add(cid));
            }
          });

          const profile = (currentBotTeam as any)?.botProfile || 'BALANCED';
          const difficulty = (currentBotTeam as any)?.botDifficulty || 'MEDIUM';
          const chosenCustomerIds = decideSales(currentState, teamId, profile, difficulty, soldCustomers);

          const teamPrice = currentTeamData.price;
          const revenue = teamPrice * chosenCustomerIds.length;
          const salesByRegion: Record<string, number> = {};
          
          chosenCustomerIds.forEach(cid => {
            const regObj = REGION_CUSTOMERS.find(r => r.customers.some(c => c.id === cid));
            if (regObj) {
              salesByRegion[regObj.region] = (salesByRegion[regObj.region] || 0) + 1;
            }
          });

          const finalSalesData = {
            ...currentTeamData,
            customersSold: chosenCustomerIds,
            salesByRegion,
            revenue,
            totalMoney: (currentTeamData.totalMoney || 0) + revenue
          };

          addRoundData(round, teamId, finalSalesData);
          toast.info(`🤖 ${currentBotTeam?.name || 'Bot'} completed customer sales.`);
        }
      } catch (err) {
        console.error(`Error executing bot action for ${teamId} in ${phase}:`, err);
      } finally {
        setBotThinking(teamId, false);
        processedActions.current.add(actionKey);
        delete activeTimers.current[actionKey];
        delete activeTimeouts.current[actionKey];
      }
    }, delay);

  }, [gameState, currentClassId, currentClassTeams]);
}
