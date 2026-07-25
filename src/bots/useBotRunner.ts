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
  
  const { currentRole, currentClassId, currentClassTeams } = useSession();

  const processedActions = useRef<Set<string>>(new Set());
  const activeTimers = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!gameState || !currentClassId) return;
    if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') return;
    if (gameState.botConfig?.enabled === false) return;

    const round = gameState.currentRound;
    const rawPhase = (gameState.currentPhase || 'planning').toLowerCase();
    
    // Normalize phase name
    const phase = rawPhase === 'innovation' ? 'research' : (rawPhase === 'expansion' ? 'logistics' : rawPhase);

    const roundData = gameState.rounds.find(r => r.roundNumber === round);
    const playOrder = calculatePlayOrder(round);

    // Identify active turn team based on normalized phase
    let activeTurnTeam = null;

    if (phase === 'planning') {
      activeTurnTeam = playOrder.find(t => !roundData?.teamData[t.id]);
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
        const icons = roundData?.teamData[t.id]?.researchIcons || 0;
        const spent = (gameState.researchAllocatedByRound || {})[round]?.[t.id] || 0;
        return icons > 0 && spent < icons;
      });
    } else if (phase === 'logistics') {
      activeTurnTeam = playOrder.find(t => {
        const icons = roundData?.teamData[t.id]?.logisticsIcons || 0;
        const spent = (gameState.logisticsAllocatedByRound || {})[round]?.[t.id] || 0;
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
    const regTeam = currentClassTeams[teamId];
    const botTeam = gameState.teams.find(t => t.id === teamId);
    const isBot = botTeam?.isBot || regTeam?.isBot;

    if (!isBot) return; // Wait for human player to make decision

    const actionKey = `${round}:${phase}:${teamId}`;

    // Skip if already processed or already has a running timer
    if (processedActions.current.has(actionKey)) return;
    if (activeTimers.current[actionKey]) return;

    const teamData = roundData?.teamData[teamId];
    const combinationsData = getCombinations();

    // Trigger timer and set bot "thinking" status on Firestore
    activeTimers.current[actionKey] = true;
    setBotThinking(teamId, true);
    
    const delay = 2000 + Math.random() * 3000; // 2-5s thinking delay

    setTimeout(() => {
      // Re-read latest state inside timeout to prevent race conditions
      const currentRoundData = gameState.rounds.find(r => r.roundNumber === round);
      const currentTeamData = currentRoundData?.teamData[teamId];

      if (phase === 'planning') {
        if (currentTeamData) {
          setBotThinking(teamId, false);
          processedActions.current.add(actionKey);
          delete activeTimers.current[actionKey];
          return;
        }

        const profile = botTeam.botProfile || 'BALANCED';
        const difficulty = botTeam.botDifficulty || 'MEDIUM';
        const decision = decidePlanning(gameState, teamId, profile, difficulty, combinationsData);

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

        const stats = calculatePlanStats(gameState, teamId, decision.combination, decision.position, decision.cardUsages, combinationsData);
        mockStats.price = stats.calculatedPrice;
        mockStats.productsProduced = stats.productsAvailable;
        mockStats.improvementCards = stats.improvementPoints;
        mockStats.researchIcons = stats.researchPoints;
        mockStats.logisticsIcons = stats.logisticsPoints;

        addRoundData(round, teamId, mockStats);
        toast.info(`🤖 ${botTeam.name} submitted its plan.`);

      } else if (phase === 'improvement') {
        const alreadyClaimed = gameState.improvementCards.some(c => 
          (c.availableForTeam === teamId || c.usedBy === teamId) && c.allocatedInRound === round
        );
        if (alreadyClaimed) {
          setBotThinking(teamId, false);
          processedActions.current.add(actionKey);
          delete activeTimers.current[actionKey];
          return;
        }

        const profile = botTeam.botProfile || 'BALANCED';
        const difficulty = botTeam.botDifficulty || 'MEDIUM';
        const cardIdToClaim = decideImprovement(gameState, teamId, profile, difficulty);

        if (cardIdToClaim !== null) {
          claimImprovementCard(cardIdToClaim, teamId);
          toast.info(`🤖 ${botTeam.name} claimed an improvement card.`);
        } else {
          // If no cards left or skip, do nothing/advance
          toast.info(`🤖 ${botTeam.name} skipped improvement card selection.`);
        }

      } else if (phase === 'research') {
        if (!teamData) {
          setBotThinking(teamId, false);
          delete activeTimers.current[actionKey];
          return;
        }

        const allocatedMap = gameState.researchAllocatedByRound[round] || {};
        const allocatedSpent = allocatedMap[teamId] || 0;
        const totalIcons = teamData.researchIcons || 0;

        if (allocatedSpent >= totalIcons) {
          setBotThinking(teamId, false);
          processedActions.current.add(actionKey);
          delete activeTimers.current[actionKey];
          return;
        }

        const profile = botTeam.botProfile || 'BALANCED';
        const difficulty = botTeam.botDifficulty || 'MEDIUM';
        const allocations = decideResearch(gameState, teamId, totalIcons - allocatedSpent, profile, difficulty);

        Object.entries(allocations).forEach(([techName, points]) => {
          allocateResearch(teamId, techName, points);
        });

        toast.info(`🤖 ${botTeam.name} allocated research points.`);

      } else if (phase === 'logistics') {
        if (!teamData) {
          setBotThinking(teamId, false);
          delete activeTimers.current[actionKey];
          return;
        }

        const allocatedMap = gameState.logisticsAllocatedByRound[round] || {};
        const allocatedSpent = allocatedMap[teamId] || 0;
        const totalIcons = teamData.logisticsIcons || 0;

        if (allocatedSpent >= totalIcons) {
          setBotThinking(teamId, false);
          processedActions.current.add(actionKey);
          delete activeTimers.current[actionKey];
          return;
        }

        const profile = botTeam.botProfile || 'BALANCED';
        const difficulty = botTeam.botDifficulty || 'MEDIUM';
        const allocations = decideLogistics(gameState, teamId, totalIcons - allocatedSpent, profile, difficulty);

        Object.entries(allocations).forEach(([regionName, points]) => {
          allocateLogistics(teamId, regionName, points);
        });

        toast.info(`🤖 ${botTeam.name} allocated logistics points.`);

      } else if (phase === 'sales') {
        if (!teamData || teamData.customersSold) {
          setBotThinking(teamId, false);
          processedActions.current.add(actionKey);
          delete activeTimers.current[actionKey];
          return;
        }

        const soldCustomers = new Set<string>();
        Object.values(currentRoundData?.teamData || {}).forEach(tData => {
          if (tData.customersSold) {
            tData.customersSold.forEach(cid => soldCustomers.add(cid));
          }
        });

        const profile = botTeam.botProfile || 'BALANCED';
        const difficulty = botTeam.botDifficulty || 'MEDIUM';
        const chosenCustomerIds = decideSales(gameState, teamId, profile, difficulty, soldCustomers);

        const teamPrice = teamData.price;
        const revenue = teamPrice * chosenCustomerIds.length;
        const salesByRegion: Record<string, number> = {};
        
        chosenCustomerIds.forEach(cid => {
          const regObj = REGION_CUSTOMERS.find(r => r.customers.some(c => c.id === cid));
          if (regObj) {
            salesByRegion[regObj.region] = (salesByRegion[regObj.region] || 0) + 1;
          }
        });

        const finalSalesData = {
          ...teamData,
          customersSold: chosenCustomerIds,
          salesByRegion,
          revenue,
          totalMoney: (teamData.totalMoney || 0) + revenue
        };

        addRoundData(round, teamId, finalSalesData);
        toast.info(`🤖 ${botTeam.name} completed customer sales.`);
      }

      setBotThinking(teamId, false);
      processedActions.current.add(actionKey);
      delete activeTimers.current[actionKey];
    }, delay);

  }, [gameState, currentClassId, currentRole, currentClassTeams]);
}
