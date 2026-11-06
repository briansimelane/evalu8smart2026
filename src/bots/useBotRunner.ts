import { useEffect, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { useDemoState } from '@/demo/DemoStateProvider';
import { decidePlanning, decideResearch, decideLogistics, decideSales, decideImprovement } from './botEngine';
import { REGION_CUSTOMERS } from '@/data/customers';
import { toast } from 'sonner';
import { calculatePlanStats, hasTech } from '@/lib/rules';

export function useBotRunner() {
  const { 
    gameState, 
    addRoundData, 
    allocateResearch, 
    submitResearchTurn,
    allocateLogistics, 
    submitLogisticsTurn,
    getCombinations, 
    calculatePlayOrder,
    claimImprovementCard,
    setBotThinking
  } = useGame();
  
  const { currentClassId, currentClassTeams, currentRole, isDemo } = useSession();
  const demoState = isDemo ? useDemoState() : null;
  const isReadOnlyTab = demoState?.isReadOnlyTab || false;

  const processedActions = useRef<Set<string>>(new Set());
  const activeTimers = useRef<Record<string, boolean>>({});
  const activeTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const effectiveState = isDemo ? demoState?.demoGameState : gameState;

  // Maintain ref to latest gameState to avoid stale closure state in timeouts
  const latestGameState = useRef(effectiveState);
  useEffect(() => {
    latestGameState.current = effectiveState;
  }, [effectiveState]);

  useEffect(() => {
    if (!effectiveState) return;
    if (!currentClassId && !isDemo) return;
    if (!isDemo && currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') return;
    if (isReadOnlyTab) return;
    if (effectiveState.botConfig?.enabled === false) return;

    const round = effectiveState.currentRound;
    const rawPhase = (effectiveState.currentPhase || 'planning').toLowerCase();
    
    // Normalize phase name
    const phase = rawPhase === 'innovation' ? 'research' : (rawPhase === 'expansion' ? 'logistics' : rawPhase);

    const roundData = effectiveState.rounds.find(r => r.roundNumber === round);
    const playOrder = calculatePlayOrder(round);

    const isTeamBot = (tId: string) => {
      const bTeam = effectiveState.teams?.find(t => t.id === tId);
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
      activeTurnTeam = playOrder.find(
        t =>
          !roundData?.teamData[t.id] &&
          !effectiveState.planSubmittedByRound?.[round]?.[t.id] &&
          isTeamBot(t.id)
      );
    } else if (
      effectiveState.schemaVersion === 2 &&
      effectiveState.turn &&
      effectiveState.turn.round === round &&
      normalizePhaseName(effectiveState.turn.phase) === normalizePhaseName(phase)
    ) {
      const activeId = effectiveState.turn.order[effectiveState.turn.index];
      activeTurnTeam = activeId ? (effectiveState.teams?.find(t => t.id === activeId) || null) : null;
    } else if (effectiveState.schemaVersion === 2) {
      // In v2 classes, turns are strictly governed by state/control.turn
      activeTurnTeam = null;
    } else if (phase === 'improvement') {
      activeTurnTeam = playOrder.find(t => {
        const count = roundData?.teamData[t.id]?.improvementCards || 0;
        const isDone = effectiveState.improvementCards.some(c => 
          (c.availableForTeam === t.id || c.usedBy === t.id) && c.allocatedInRound === round
        );
        return count > 0 && !isDone;
      });
    } else if (phase === 'research') {
      activeTurnTeam = playOrder.find(t => {
        const icons = roundData?.teamData[t.id]?.researchIcons || 0;
        const spent = (effectiveState.researchAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'logistics') {
      activeTurnTeam = playOrder.find(t => {
        const icons = roundData?.teamData[t.id]?.logisticsIcons || 0;
        const spent = (effectiveState.logisticsAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'sales') {
      const activeSalesPlayOrder = playOrder.filter(team => {
        const tData = roundData?.teamData[team.id];
        return (tData?.productsProduced || 0) > 0;
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

    const botTeam = effectiveState.teams?.find(t => t.id === teamId);

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
          if (currentTeamData || currentState.planSubmittedByRound?.[round]?.[teamId]) return;

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
          let cardIdToClaim = decideImprovement(currentState, teamId, profile, difficulty);

          if (cardIdToClaim === null) {
            const poolIds = currentState.improvementPoolByRound?.[round] || [];
            const claimedInRound = currentState.improvementCards
              .filter(c => c.allocatedInRound === round && c.availableForTeam)
              .map(c => c.id);
            const availableCardId = poolIds.find(id => !claimedInRound.includes(id));
            if (availableCardId !== undefined) {
              cardIdToClaim = availableCardId;
            } else {
              cardIdToClaim = -100;
            }
          }

          if (cardIdToClaim !== null) {
            claimImprovementCard(cardIdToClaim, teamId);
            toast.info(`🤖 ${currentBotTeam?.name || 'Bot'} claimed an improvement card.`);
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
          const mergedAllocations: Record<string, number> = {};
          let sumAllocated = 0;
          Object.entries(allocations).forEach(([techName, points]) => {
            if (points > 0) {
              mergedAllocations[techName] = (mergedAllocations[techName] || 0) + points;
              sumAllocated += points;
            }
          });

          // Fallback: If remaining points were unallocated, dump leftovers to clear spent count
          const leftoverPoints = neededPoints - sumAllocated;
          if (leftoverPoints > 0) {
            const allTechs = Object.keys(currentState.technologies);
            const fallbackTech = allTechs[0] || 'GPS';
            mergedAllocations[fallbackTech] = (mergedAllocations[fallbackTech] || 0) + leftoverPoints;
          }

          submitResearchTurn(teamId, mergedAllocations).catch((e) =>
            console.error('Bot research turn error:', e)
          );

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
          const mergedAllocations: Record<string, number> = {};
          let sumAllocated = 0;
          Object.entries(allocations).forEach(([regionName, points]) => {
            if (points > 0) {
              mergedAllocations[regionName] = (mergedAllocations[regionName] || 0) + points;
              sumAllocated += points;
            }
          });

          // Fallback: If remaining points were unallocated, dump leftovers to clear spent count
          const leftoverPoints = neededPoints - sumAllocated;
          if (leftoverPoints > 0) {
            const allRegions = Object.keys(currentState.regionLogistics);
            const fallbackRegion = allRegions[0] || 'USA';
            mergedAllocations[fallbackRegion] = (mergedAllocations[fallbackRegion] || 0) + leftoverPoints;
          }

          submitLogisticsTurn(teamId, mergedAllocations).catch((e) =>
            console.error('Bot logistics turn error:', e)
          );

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

          const hasNfc = hasTech(currentState, teamId, 'NFC');
          const productsProduced = currentTeamData.productsProduced || 0;
          const regionalCount = chosenCustomerIds.length;
          const remainingForNfc = Math.max(0, productsProduced - regionalCount);
          const nfcSalesUnits = hasNfc ? Math.min(3, remainingForNfc) : 0;
          const totalUnitsSold = regionalCount + nfcSalesUnits;

          const teamPrice = currentTeamData.price;
          const revenue = teamPrice * totalUnitsSold;
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
            nfcSalesUnits,
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

  }, [effectiveState, currentClassId, currentClassTeams, currentRole, isDemo]);
}
