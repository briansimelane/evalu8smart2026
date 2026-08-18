import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { GameState, Team, RoundData, TeamRoundData, TeamResearchProgress, RegionLogistics, TeamLogisticsProgress, GamePhase } from '@/types/game';
import { REGIONS, TECHNOLOGIES, TEAM_COLORS, COMBINATIONS, Combination, getTeamColorName } from '@/data/combinations';
import { INITIAL_IMPROVEMENT_CARDS, AVAILABLE_IMPROVEMENT_CARDS, ImprovementCardData } from '@/data/improvements';
import { REGION_CONFIGS, INITIAL_TEAM_REGIONS } from '@/data/regions';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSession } from '@/contexts/SessionContext';
import { useDemoState } from '@/demo/DemoStateProvider';
import { REGION_CUSTOMERS } from '@/data/customers';
import { getControlPointsForRegion } from '@/data/control';
import { SimulationClass } from '@/types/game';
import { removeUndefined } from '@/lib/utils';
import { calculatePlanStats, canExpandToRegion as canExpandToRegionRule } from '@/lib/rules';

export interface GameContextType {
  gameState: GameState | null;
  initializeGame: (teams: Team[]) => void;
  addRoundData: (roundNumber: number, teamId: string, data: TeamRoundData) => void;
  updatePatent: (techName: string, teamId: string) => void;
  getCurrentRound: () => number;
  getTeamData: (teamId: string) => TeamRoundData[];
  resetGame: () => void;
  selectRandomCards: () => import('@/data/improvements').ImprovementCardData[];
  reshuffleRoundCards: () => import('@/data/improvements').ImprovementCardData[];
  allocateImprovementCards: (allocations: Record<number, string>) => void;
  advanceRound: () => void;
  claimImprovementCard: (cardId: number, teamId: string) => void;
  unclaimImprovementCard: (teamId: string, roundNumber?: number) => void;
  setBotThinking: (teamId: string, thinking: boolean) => void;
  markImprovementCardUsed: (cardId: number) => void;
  clearNonInitialCards: () => void;
  previewNextRoundCards: () => import('@/data/improvements').ImprovementCardData[];
  allocateResearch: (teamId: string, technology: string, points: number) => void;
  getTeamResearchProgress: (teamId: string) => import('@/types/game').TeamResearchProgress | undefined;
  getTechnologyCostForTeam: (teamId: string, technology: string) => number;
  calculatePlayOrder: (roundNumber: number) => import('@/types/game').Team[];
  allocateLogistics: (teamId: string, regionName: string, points: number) => void;
  getTeamLogisticsProgress: (teamId: string) => TeamLogisticsProgress | undefined;
  canExpandToRegion: (teamId: string, regionName: string) => boolean;
  getAvailableRegionsForTeam: (teamId: string) => RegionLogistics[];
  isRegionFull: (regionName: string) => boolean;
  updateCombinations: (data: Combination[] | null) => void;
  getCombinations: () => Combination[];
  recalculateControlPoints: () => void;
  updatePhase: (phase: GamePhase) => void;
  endGame: () => void;
}

export const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

function toValidDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : val;
  }
  if (typeof val?.toDate === 'function') {
    return val.toDate();
  }
  if (typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { currentClassId, activeClass, isDemo } = useSession();
  const demoContext = useDemoState();
  
  const mutateGameState = useCallback((updater: (prev: GameState | null) => GameState | null) => {
    if (isDemo) {
      demoContext.setDemoGameState(updater);
      return;
    }

    setGameState(prev => {
      const next = updater(prev);
      if (next) {
        const safeState = { ...next };
        const createdDate = safeState.createdAt ? toValidDate(safeState.createdAt) : new Date();
        const updatedDate = new Date();
        safeState.createdAt = createdDate.toISOString() as any;
        safeState.updatedAt = updatedDate.toISOString() as any;

        setTimeout(() => {
          if (currentClassId) {
            const stateDocRef = doc(db, 'classes', currentClassId, 'state', 'game');
            setDoc(stateDocRef, removeUndefined({ gameState: safeState }))
              .catch(e => console.error("Failed to save class game to Firebase:", e));
          } else {
            const docRef = doc(db, 'evalu8smart_sessions', 'default_game');
            setDoc(docRef, removeUndefined(safeState))
              .catch(e => console.error("Failed to save game to Firebase:", e));
          }
        }, 0);
      }
      return next;
    });
  }, [currentClassId, isDemo, demoContext]);

  useEffect(() => {
    if (isDemo) {
      setGameState(null);
      setIsLoaded(true);
      return;
    }

    setGameState(null);
    setIsLoaded(false);

    if (!currentClassId) {
      let isMounted = true;
      const loadState = async () => {
        try {
          const docRef = doc(db, 'evalu8smart_sessions', 'default_game');
          const snap = await getDoc(docRef);
          if (snap.exists() && isMounted) {
            const data = snap.data() as GameState;
            if (data.createdAt) data.createdAt = new Date(data.createdAt as any);
            if (data.updatedAt) data.updatedAt = new Date(data.updatedAt as any);
            setGameState(data);
          } else {
            setGameState(null);
          }
        } catch (e) {
          console.error("Failed to load game from Firebase:", e);
        } finally {
          if (isMounted) setIsLoaded(true);
        }
      };
      loadState();
      return () => { isMounted = false; };
    } else {
      const stateDocRef = doc(db, 'classes', currentClassId, 'state', 'game');
      const unsubscribe = onSnapshot(stateDocRef, (snap) => {
        if (snap.exists()) {
          const stateData = snap.data();
          const data = stateData?.gameState as GameState;
          if (data) {
            if (data.createdAt) data.createdAt = new Date(data.createdAt as any);
            if (data.updatedAt) data.updatedAt = new Date(data.updatedAt as any);
            setGameState(data);
          } else {
            setGameState(null);
          }
        } else {
          // Fallback check on legacy root gameState for unmigrated classes
          getDoc(doc(db, 'classes', currentClassId)).then(classSnap => {
            if (classSnap.exists()) {
              const legacyData = classSnap.data() as SimulationClass;
              if (legacyData.gameState) {
                setGameState(legacyData.gameState);
              } else {
                setGameState(null);
              }
            } else {
              setGameState(null);
            }
          });
        }
        setIsLoaded(true);
      }, (e) => {
        console.error("Failed to subscribe to game state:", e);
        setIsLoaded(true);
      });

      setIsLoaded(true);
      return () => unsubscribe();
    }
  }, [currentClassId, isDemo]);

  const effectiveGameState = isDemo ? demoContext.demoGameState : gameState;
  const activeGameState = isDemo ? (demoContext.maskedDemoState || demoContext.demoGameState) : gameState;
  const activeIsLoaded = isDemo ? demoContext.isLoaded : isLoaded;

  const initializeGame = (teams: Team[]) => {
    // Create initial improvement cards for each team with UNIQUE IDs
    const baseId = Date.now();
    const initialCards = teams.map((team, idx) => {
      // Find color name from hex value
      const colorName = getTeamColorName(team.color, team.name);
      const cardData = INITIAL_IMPROVEMENT_CARDS[colorName];
      
      return {
        id: baseId + idx + 1, // unique id per team
        icon1: cardData.icon1,
        icon2: cardData.icon2,
        availableForTeam: team.id,
        used: false,
        isInitial: true,
      };
    });

    // Technology costs: GPS(3), Wifi(3), Gaming(4), Battery(4), NFC(5), 4G(6)
    const techCosts: Record<string, number> = {
      'GPS': 3,
      'Wifi': 3,
      'WIFI': 3,
      'Wi-Fi': 3,
      'Gaming': 4,
      'GAMING': 4,
      'Battery': 4,
      'BATTERY': 4,
      'NFC': 5,
      '4G': 6,
    };

    // Initialize team research progress
    const teamResearchProgress: Record<string, TeamResearchProgress> = {};
    teams.forEach(team => {
      teamResearchProgress[team.id] = {
        teamId: team.id,
        technologyInvestments: {},
        completedTechnologies: [],
      };
    });

    // Initialize region logistics from config
    const regionLogistics: Record<string, RegionLogistics> = {};
    REGION_CONFIGS.forEach(config => {
      regionLogistics[config.name] = {
        name: config.name,
        logisticsCost: config.logisticsCost,
        maxTeams: config.maxTeams,
        connectedRegions: config.connectedRegions,
        teamsPresent: [],
        teamProgress: {}
      };
    });

    // Initialize team logistics progress with starting regions
    const teamLogisticsProgress: Record<string, TeamLogisticsProgress> = {};
    teams.forEach(team => {
      // Find team color name from hex value
      const colorName = getTeamColorName(team.color, team.name);
      const startingRegion = INITIAL_TEAM_REGIONS[colorName];
      
      if (startingRegion) {
        // Mark team as having presence in starting region
        regionLogistics[startingRegion].teamsPresent.push(team.id);
        
        teamLogisticsProgress[team.id] = {
          teamId: team.id,
          regionsWithPresence: [startingRegion],
          regionInvestments: {}
        };
      } else {
        teamLogisticsProgress[team.id] = {
          teamId: team.id,
          regionsWithPresence: [],
          regionInvestments: {}
        };
      }
    });

    const newGame: GameState = {
      gameId: Date.now().toString(),
      teams,
      currentRound: 1,
      currentPhase: 'planning',
      rounds: [],
      technologies: TECHNOLOGIES.reduce((acc, tech) => ({
        ...acc,
        [tech]: { 
          name: tech, 
          researchPoints: 0, 
          maxPoints: 6,
          researchCost: tech.toUpperCase().includes('WIFI') ? 3 : (techCosts[tech] || 4),
          teamProgress: {}
        }
      }), {}),
      regions: REGIONS.map(region => ({
        name: region,
        sales: {},
        controlPoints: {}
      })),
      patents: {},
      improvementCards: initialCards,
      improvementPoolByRound: {},
      teamResearchProgress,
      researchAllocatedByRound: {},
      regionLogistics,
      teamLogisticsProgress,
      logisticsAllocatedByRound: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mutateGameState(() => newGame);
  };

  const addRoundData = (roundNumber: number, teamId: string, data: TeamRoundData) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      // 1. Basic combination/position check
      const combinations = prev.combinationsData || COMBINATIONS;
      const selectedCombo = combinations.find(
        c => c.combination === data.combination && c.position === data.position
      );
      if (!selectedCombo) {
        console.error(`Invalid combination ${data.combination} or position ${data.position}`);
        return prev;
      }

      // 2. Validate planning stats consistency (price, productsProduced, researchIcons, logisticsIcons)
      const stats = calculatePlanStats(
        prev,
        teamId,
        data.combination,
        data.position,
        data.cardUsages || {},
        combinations
      );

      if (
        data.price !== stats.calculatedPrice ||
        data.productsProduced !== stats.productsAvailable ||
        data.researchIcons !== stats.researchPoints ||
        data.logisticsIcons !== stats.logisticsPoints
      ) {
        console.error(`Planning stats mismatch for team ${teamId}. Given: price=${data.price}, produced=${data.productsProduced}, research=${data.researchIcons}, logistics=${data.logisticsIcons}. Expected: price=${stats.calculatedPrice}, produced=${stats.productsAvailable}, research=${stats.researchPoints}, logistics=${stats.logisticsPoints}.`);
        return prev;
      }

      // 3. Sales quantity check
      if (data.customersSold && data.customersSold.length > data.productsProduced) {
        console.error(`Sales count (${data.customersSold.length}) exceeds products produced (${data.productsProduced})`);
        return prev;
      }

      const rounds = [...prev.rounds];
      const roundIndex = rounds.findIndex(r => r.roundNumber === roundNumber);

      if (roundIndex === -1) {
        rounds.push({
          roundNumber,
          teamData: { [teamId]: data }
        });
      } else {
        rounds[roundIndex] = {
          ...rounds[roundIndex],
          teamData: {
            ...rounds[roundIndex].teamData,
            [teamId]: data
          }
        };
      }

      return {
        ...prev,
        rounds,
        currentRound: Math.max(prev.currentRound, roundNumber),
        updatedAt: new Date()
      };
    });
  };

  const updatePatent = (techName: string, teamId: string) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      const newPatents = {
        ...prev.patents,
        [techName]: teamId,
      };

      // Recalculate completions for all teams based on new cost
      const updatedTeamResearchProgress = { ...prev.teamResearchProgress };
      const baseCost = prev.technologies[techName]?.researchCost || 0;

      prev.teams.forEach(t => {
        const tp = updatedTeamResearchProgress[t.id] || {
          teamId: t.id,
          technologyInvestments: {},
          completedTechnologies: [],
        };
        const invested = tp.technologyInvestments[techName] || 0;
        const cost = newPatents[techName] && newPatents[techName] !== t.id ? Math.max(0, baseCost - 1) : baseCost;
        if (invested >= cost && !tp.completedTechnologies.includes(techName)) {
          tp.completedTechnologies = [...tp.completedTechnologies, techName];
        }
        updatedTeamResearchProgress[t.id] = tp;
      });

      return {
        ...prev,
        patents: newPatents,
        teamResearchProgress: updatedTeamResearchProgress,
        updatedAt: new Date(),
      };
    });
  };

  const getCurrentRound = () => {
    return effectiveGameState?.currentRound || 1;
  };

  const getTeamData = (teamId: string): TeamRoundData[] => {
    if (!effectiveGameState) return [];

    return effectiveGameState.rounds
      .map(round => round.teamData[teamId])
      .filter(Boolean);
  };

  const resetGame = () => {
    const teamsToUse: Team[] = (activeClass?.teamRegistry && activeClass.teamRegistry.length > 0)
      ? activeClass.teamRegistry.map(t => ({ id: t.id, name: t.name, color: t.color }))
      : (effectiveGameState?.teams || []);

    if (teamsToUse.length > 0) {
      initializeGame(teamsToUse);
    } else {
      mutateGameState(() => null);
    }
  };

  const selectRandomCards = (): ImprovementCardData[] => {
    if (!effectiveGameState) return [];

    const currentRound = effectiveGameState.currentRound;
    if (currentRound >= 5) return [];

    // If pool already exists for this round, return it
    const existingIds = effectiveGameState.improvementPoolByRound?.[currentRound];
    if (existingIds && existingIds.length > 0) {
      return existingIds
        .map(id => AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === id))
        .filter(Boolean) as ImprovementCardData[];
    }

    // Always select cards equal to the number of teams
    const numEligibleTeams = effectiveGameState.teams.length;

    const usedCardIds = effectiveGameState.improvementCards
      .filter(card => card.used)
      .map(card => card.id);

    const availablePool = AVAILABLE_IMPROVEMENT_CARDS.filter(
      card => !usedCardIds.includes(card.id)
    );

    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(0, numEligibleTeams));
    const hasPriceDecrease = selected.some(c => c.icon1 === 'Price and Product' || c.icon2 === 'Price and Product');
    if (!hasPriceDecrease) {
      const priceDecreaseCard = availablePool.find(c => c.icon1 === 'Price and Product' || c.icon2 === 'Price and Product');
      if (priceDecreaseCard && selected.length > 0) {
        selected[0] = priceDecreaseCard;
      }
    }

    // Persist pool for this round
    const selectedIds = selected.map(c => c.id);
    mutateGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        improvementPoolByRound: {
          ...(prev.improvementPoolByRound || {}),
          [currentRound]: selectedIds,
        },
        updatedAt: new Date(),
      };
    });

    return selected;
  };

  const reshuffleRoundCards = (): ImprovementCardData[] => {
    if (!effectiveGameState) return [];

    const currentRound = effectiveGameState.currentRound;

    // Always select as many cards as there are teams
    const numEligibleTeams = effectiveGameState.teams.length;

    const usedCardIds = effectiveGameState.improvementCards
      .filter(card => card.used)
      .map(card => card.id);

    const availablePool = AVAILABLE_IMPROVEMENT_CARDS.filter(
      card => !usedCardIds.includes(card.id)
    );

    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(0, numEligibleTeams));
    const hasPriceDecrease = selected.some(c => c.icon1 === 'Price and Product' || c.icon2 === 'Price and Product');
    if (!hasPriceDecrease) {
      const priceDecreaseCard = availablePool.find(c => c.icon1 === 'Price and Product' || c.icon2 === 'Price and Product');
      if (priceDecreaseCard && selected.length > 0) {
        selected[0] = priceDecreaseCard;
      }
    }
    const selectedIds = selected.map(c => c.id);

    mutateGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        improvementPoolByRound: {
          ...(prev.improvementPoolByRound || {}),
          [currentRound]: selectedIds,
        },
        updatedAt: new Date(),
      };
    });

    return selected;
  };

  const allocateImprovementCards = (allocations: Record<number, string>) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      const newCards = [...prev.improvementCards];
      
      // Add allocated cards
      Object.entries(allocations).forEach(([cardIdStr, teamId]) => {
        const cardId = parseInt(cardIdStr);
        const cardData = AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === cardId);
        
          if (cardData) {
            newCards.push({
              id: cardData.id,
              icon1: cardData.icon1,
              icon2: cardData.icon2,
              availableForTeam: teamId,
              used: false,
              isInitial: false,
              allocatedInRound: prev.currentRound,
            });
          }
      });

      // Add product-only cards for teams with 0 improvement
      const currentRoundData = prev.rounds.find(r => r.roundNumber === prev.currentRound);
      if (currentRoundData) {
        prev.teams.forEach(team => {
          const teamData = currentRoundData.teamData[team.id];
          // Only add product card if team has 0 improvement AND doesn't already have a card allocated this round
          const hasCardThisRound = newCards.some(c => 
            c.availableForTeam === team.id && c.allocatedInRound === prev.currentRound
          );
          if (teamData && teamData.improvementCards === 0 && !hasCardThisRound) {
            // Find next available ID for product-only cards (use negative IDs)
            const productCardId = -(newCards.filter(c => c.id < 0).length + 1);
            newCards.push({
              id: productCardId,
              icon1: 'Product',
              icon2: 'None' as any,
              availableForTeam: team.id,
              used: false,
              isInitial: false,
              allocatedInRound: prev.currentRound,
            });
          }
        });
      }

      return {
        ...prev,
        improvementCards: newCards,
        updatedAt: new Date()
      };
    });
  };

  const advanceRound = () => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        currentRound: prev.currentRound + 1,
        currentPhase: 'planning',
        updatedAt: new Date()
      };
    });
  };

  const updatePhase = (phase: GamePhase) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      let targetPhase = phase;
      if (prev.currentRound >= 5 && targetPhase === 'improvement') {
        targetPhase = 'research';
      }

      const newCards = [...(prev.improvementCards || [])];
      if (targetPhase === 'improvement') {
        const currentRoundData = prev.rounds.find(r => r.roundNumber === prev.currentRound);
        if (currentRoundData) {
          prev.teams.forEach(t => {
            const tData = currentRoundData.teamData[t.id];
            const hasCard = newCards.some(c => 
              c.availableForTeam === t.id && c.allocatedInRound === prev.currentRound
            );
            if (tData && tData.improvementCards === 0 && !hasCard) {
              const productCardId = -(newCards.filter(c => c.id < 0).length + 1);
              newCards.push({
                id: productCardId,
                icon1: 'Product',
                icon2: 'None' as any,
                availableForTeam: t.id,
                used: false,
                isInitial: false,
                allocatedInRound: prev.currentRound,
              });
            }
          });
        }
      }

      return {
        ...prev,
        improvementCards: newCards,
        currentPhase: targetPhase,
        updatedAt: new Date()
      };
    });
  };

  const endGame = () => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        gameEnded: true,
        updatedAt: new Date()
      };
    });
  };

  const setBotThinking = (teamId: string, thinking: boolean) => {
    if (!effectiveGameState) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        botThinking: {
          ...(prev.botThinking || {}),
          [teamId]: thinking
        },
        updatedAt: new Date()
      };
    });
  };

  const claimImprovementCard = (cardId: number, teamId: string) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      // Check if this team already claimed a card this round
      const alreadyClaimed = prev.improvementCards.some(c => 
        c.availableForTeam === teamId && c.allocatedInRound === prev.currentRound
      );
      if (alreadyClaimed) return prev;

      // Prevent double claiming of unique cards (cardId >= 0)
      const cardAlreadyTaken = prev.improvementCards.some(c =>
        c.id === cardId && c.allocatedInRound === prev.currentRound
      );
      if (cardAlreadyTaken && cardId >= 0) return prev;

      const newCards = [...prev.improvementCards];
      if (cardId < 0) {
        // Direct product card claim fallback
        newCards.push({
          id: cardId,
          icon1: 'Product',
          icon2: 'None' as any,
          availableForTeam: teamId,
          used: false,
          isInitial: false,
          allocatedInRound: prev.currentRound,
        });
      } else {
        const cardData = AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === cardId);
        if (cardData) {
          newCards.push({
            id: cardData.id,
            icon1: cardData.icon1,
            icon2: cardData.icon2,
            availableForTeam: teamId,
            used: false,
            isInitial: false,
            allocatedInRound: prev.currentRound,
          });
        }
      }

      // Automatically add product-only cards for teams with 0 improvement
      const currentRoundData = prev.rounds.find(r => r.roundNumber === prev.currentRound);
      if (currentRoundData) {
        prev.teams.forEach(t => {
          const tData = currentRoundData.teamData[t.id];
          const hasCard = newCards.some(c => 
            c.availableForTeam === t.id && c.allocatedInRound === prev.currentRound
          );
          if (tData && tData.improvementCards === 0 && !hasCard) {
            const productCardId = -(newCards.filter(c => c.id < 0).length + 1);
            newCards.push({
              id: productCardId,
              icon1: 'Product',
              icon2: 'None' as any,
              availableForTeam: t.id,
              used: false,
              isInitial: false,
              allocatedInRound: prev.currentRound,
            });
          }
        });
      }

      return {
        ...prev,
        improvementCards: newCards,
        updatedAt: new Date()
      };
    });
  };

  const unclaimImprovementCard = (teamId: string, roundNumber?: number) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;
      const targetRound = roundNumber || prev.currentRound;

      const updatedCards = prev.improvementCards.filter(c =>
        !(c.availableForTeam === teamId && c.allocatedInRound === targetRound)
      );

      return {
        ...prev,
        improvementCards: updatedCards,
        updatedAt: new Date()
      };
    });
  };

  const markImprovementCardUsed = (cardId: number) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      const updatedCards = prev.improvementCards.map(card =>
        card.id === cardId ? { ...card, used: true, usedBy: card.availableForTeam } : card
      );

      return {
        ...prev,
        improvementCards: updatedCards,
        updatedAt: new Date()
      };
    });
  };

  const clearNonInitialCards = () => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      // Keep only initial cards
      const initialCards = prev.improvementCards.filter(card => card.isInitial);

      return {
        ...prev,
        improvementCards: initialCards,
        updatedAt: new Date()
      };
    });
  };

  const previewNextRoundCards = (): ImprovementCardData[] => {
    if (!effectiveGameState) return [];

    const nextRound = effectiveGameState.currentRound + 1;

    // Check if cards already exist for next round
    if (effectiveGameState.improvementPoolByRound?.[nextRound]) {
      const cardIds = effectiveGameState.improvementPoolByRound[nextRound];
      return AVAILABLE_IMPROVEMENT_CARDS.filter(card => cardIds.includes(card.id));
    }

    // Find teams that will have improvement in next round (if round data exists)
    const nextRoundData = effectiveGameState.rounds.find(r => r.roundNumber === nextRound);
    const numEligibleTeams = nextRoundData 
      ? Object.values(nextRoundData.teamData).filter(td => td.improvementCards > 0).length
      : effectiveGameState.teams.length; // Default to all teams if no data yet

    if (numEligibleTeams === 0) return [];

    const usedCardIds = effectiveGameState.improvementCards
      .filter(card => card.used)
      .map(card => card.id);

    const availablePool = AVAILABLE_IMPROVEMENT_CARDS.filter(
      card => !usedCardIds.includes(card.id)
    );

    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(0, numEligibleTeams));
    const hasPriceDecrease = selected.some(c => c.icon1 === 'Price and Product' || c.icon2 === 'Price and Product');
    if (!hasPriceDecrease) {
      const priceDecreaseCard = availablePool.find(c => c.icon1 === 'Price and Product' || c.icon2 === 'Price and Product');
      if (priceDecreaseCard && selected.length > 0) {
        selected[0] = priceDecreaseCard;
      }
    }
    const selectedIds = selected.map(c => c.id);

    // Store the preview for next round
    mutateGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        improvementPoolByRound: {
          ...(prev.improvementPoolByRound || {}),
          [nextRound]: selectedIds,
        },
        updatedAt: new Date(),
      };
    });

    return selected;
  };

  const allocateResearch = (teamId: string, technology: string, points: number) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      const tech = prev.technologies[technology];
      if (!tech) return prev;
      const baseCost = tech.researchCost;

      // Validate research allocation limits
      const currentRound = prev.currentRound;
      const roundData = prev.rounds.find(r => r.roundNumber === currentRound);
      const teamRoundData = roundData?.teamData[teamId];
      if (!teamRoundData) {
        console.error(`No plan submitted for team ${teamId} in round ${currentRound}`);
        return prev;
      }

      const allowedIcons = teamRoundData.researchIcons || 0;
      const roundAllocations = prev.researchAllocatedByRound[currentRound] || {};
      const prevSpent = roundAllocations[teamId] || 0;

      if (prevSpent + points > allowedIcons) {
        console.error(`Allocating ${points} research points would exceed allowed limit of ${allowedIcons} (already spent ${prevSpent}) for team ${teamId}`);
        return prev;
      }

      // Clone current state pieces
      const currentTPAll = { ...prev.teamResearchProgress };
      const teamProgress = currentTPAll[teamId] || {
        teamId,
        technologyInvestments: {},
        completedTechnologies: [],
      };

      // Check if technology is already completed (only block if they have other uncompleted technologies)
      if (teamProgress.completedTechnologies.includes(technology)) {
        const totalTechs = Object.keys(prev.technologies).length;
        if (teamProgress.completedTechnologies.length < totalTechs) {
          console.error(`Technology ${technology} is already completed by team ${teamId}`);
          return prev;
        }
      }

      // Update investment for the acting team
      const currentInvestment = teamProgress.technologyInvestments[technology] || 0;
      const newInvestment = currentInvestment + points;

      const newTeamProgress = {
        ...teamProgress,
        technologyInvestments: {
          ...teamProgress.technologyInvestments,
          [technology]: newInvestment,
        },
      };
      currentTPAll[teamId] = newTeamProgress;

      // Determine patents after potential completion by acting team
      const currentPatentHolder = prev.patents[technology];
      const costForActingTeam = currentPatentHolder && currentPatentHolder !== teamId ? Math.max(0, baseCost - 1) : baseCost;

      const newPatents = { ...prev.patents };
      const completedByActingTeam = newInvestment >= costForActingTeam;

      if (completedByActingTeam && !newTeamProgress.completedTechnologies.includes(technology)) {
        newTeamProgress.completedTechnologies = [
          ...newTeamProgress.completedTechnologies,
          technology,
        ];
        currentTPAll[teamId] = newTeamProgress;

        // Award patent if none exists yet
        if (!currentPatentHolder) {
          newPatents[technology] = teamId;
        }
      }

      // After confirming patents (possibly newly awarded), re-evaluate completion for all teams
      const finalPatents = newPatents;

      prev.teams.forEach(t => {
        const tp = currentTPAll[t.id] || {
          teamId: t.id,
          technologyInvestments: {},
          completedTechnologies: [],
        };
        const invested = tp.technologyInvestments[technology] || 0;
        const cost = finalPatents[technology] && finalPatents[technology] !== t.id ? Math.max(0, baseCost - 1) : baseCost;
        if (invested >= cost && !tp.completedTechnologies.includes(technology)) {
          tp.completedTechnologies = [...tp.completedTechnologies, technology];
        }
        currentTPAll[t.id] = tp;
      });

      // Update technology team progress for the acting team only (invested points)
      const updatedTech = {
        ...tech,
        teamProgress: {
          ...tech.teamProgress,
          [teamId]: newInvestment,
        },
      };

      // Track research allocation for this round
      const newRoundAllocations = {
        ...prev.researchAllocatedByRound,
        [currentRound]: {
          ...roundAllocations,
          [teamId]: prevSpent + points,
        },
      };

      return {
        ...prev,
        teamResearchProgress: currentTPAll,
        technologies: {
          ...prev.technologies,
          [technology]: updatedTech,
        },
        patents: finalPatents,
        researchAllocatedByRound: newRoundAllocations,
        updatedAt: new Date(),
      };
    });
  };

  const getTeamResearchProgress = useCallback((teamId: string) => {
    if (!effectiveGameState) return undefined;
    return effectiveGameState.teamResearchProgress[teamId];
  }, [effectiveGameState]);

  const getTechnologyCostForTeam = useCallback((teamId: string, technology: string) => {
    if (!effectiveGameState) return 0;
    
    const tech = effectiveGameState.technologies[technology];
    let baseCost = tech ? tech.researchCost : 4;
    
    if (technology.toUpperCase().includes('WIFI')) {
      baseCost = 3;
    } else if (technology.toUpperCase().includes('GPS')) {
      baseCost = 3;
    }

    const patentHolder = effectiveGameState.patents[technology];
    
    // If patent exists and it's not this team, reduce cost by 1
    if (patentHolder && patentHolder !== teamId) {
      return Math.max(0, baseCost - 1);
    }
    
    return baseCost;
  }, [effectiveGameState]);

  const calculatePlayOrder = (roundNumber: number): Team[] => {
    if (!effectiveGameState) return [];

    const roundData = effectiveGameState.rounds.find(r => r.roundNumber === roundNumber);
    const previousRoundData = effectiveGameState.rounds.find(r => r.roundNumber === roundNumber - 1);
    const round0Data = effectiveGameState.rounds.find(r => r.roundNumber === 0);

    if (!roundData) return effectiveGameState.teams;

    const teamsWithData = effectiveGameState.teams.map(team => {
      const currentData = roundData.teamData[team.id];
      const previousData = previousRoundData?.teamData[team.id];
      const round0Value = round0Data?.teamData[team.id];

      return {
        team,
        currentPrice: currentData?.price ?? Infinity,
        previousTotalMoney: previousData?.totalMoney ?? Infinity,
        round0TotalMoney: round0Value?.totalMoney ?? Infinity,
      };
    });

    // Sort by: current price (lowest first), then previous round total money (lowest first), then round 0 total money (lowest first)
    teamsWithData.sort((a, b) => {
      if (a.currentPrice !== b.currentPrice) {
        return a.currentPrice - b.currentPrice;
      }
      if (a.previousTotalMoney !== b.previousTotalMoney) {
        return a.previousTotalMoney - b.previousTotalMoney;
      }
      return a.round0TotalMoney - b.round0TotalMoney;
    });

    return teamsWithData.map(item => item.team);
  };

  const allocateLogistics = useCallback((teamId: string, regionName: string, points: number) => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      const region = prev.regionLogistics[regionName];
      if (!region) return prev;

      const teamProgress = prev.teamLogisticsProgress[teamId];
      if (!teamProgress) return prev;

      // Validate logistics allocation limits
      const currentRound = prev.currentRound;
      const roundData = prev.rounds.find(r => r.roundNumber === currentRound);
      const teamRoundData = roundData?.teamData[teamId];
      if (!teamRoundData) {
        console.error(`No plan submitted for team ${teamId} in round ${currentRound}`);
        return prev;
      }

      const allowedIcons = teamRoundData.logisticsIcons || 0;
      const roundAllocations = prev.logisticsAllocatedByRound[currentRound] || {};
      const prevSpent = roundAllocations[teamId] || 0;

      if (prevSpent + points > allowedIcons) {
        console.error(`Allocating ${points} logistics points would exceed allowed limit of ${allowedIcons} (already spent ${prevSpent}) for team ${teamId}`);
        return prev;
      }

      // Validate expansion constraints (must be connected and not full)
      const isAlreadyPresent = teamProgress.regionsWithPresence.includes(regionName);
      if (!isAlreadyPresent) {
        if (region.teamsPresent.length >= region.maxTeams) {
          console.error(`Region ${regionName} is full (${region.teamsPresent.length}/${region.maxTeams} teams)`);
          return prev;
        }

        if (!canExpandToRegionRule(prev, teamId, regionName)) {
          console.error(`Region ${regionName} is not connected to any region with team presence for team ${teamId}`);
          return prev;
        }
      }

      const currentInvestment = teamProgress.regionInvestments[regionName] || 0;
      const newInvestment = currentInvestment + points;

      const updatedRegionProgress = {
        ...region.teamProgress,
        [teamId]: newInvestment
      };

      const updatedRegion = {
        ...region,
        teamProgress: updatedRegionProgress
      };

      // Check if team has completed the region
      const hasPresence = newInvestment >= region.logisticsCost;
      const alreadyHasPresence = region.teamsPresent.includes(teamId);

      if (hasPresence && !alreadyHasPresence) {
        updatedRegion.teamsPresent = [...region.teamsPresent, teamId];
      }

      const updatedTeamProgress: TeamLogisticsProgress = {
        ...teamProgress,
        regionInvestments: {
          ...teamProgress.regionInvestments,
          [regionName]: newInvestment
        },
        regionsWithPresence: hasPresence && !alreadyHasPresence
          ? [...teamProgress.regionsWithPresence, regionName]
          : teamProgress.regionsWithPresence
      };

      // Track logistics allocation for this round
      const newRoundAllocations = {
        ...prev.logisticsAllocatedByRound,
        [currentRound]: {
          ...roundAllocations,
          [teamId]: prevSpent + points,
        },
      };

      return {
        ...prev,
        regionLogistics: {
          ...prev.regionLogistics,
          [regionName]: updatedRegion
        },
        teamLogisticsProgress: {
          ...prev.teamLogisticsProgress,
          [teamId]: updatedTeamProgress
        },
        logisticsAllocatedByRound: newRoundAllocations,
        updatedAt: new Date()
      };
    });
  }, [effectiveGameState]);

  const getTeamLogisticsProgress = useCallback((teamId: string) => {
    if (!effectiveGameState) return undefined;
    const progress = effectiveGameState.teamLogisticsProgress[teamId];
    const boardRegions = Object.entries(effectiveGameState.regionLogistics || {})
      .filter(([_, reg]) => reg.teamsPresent && reg.teamsPresent.includes(teamId))
      .map(([rName]) => rName);

    const mergedPresence = Array.from(new Set([...(progress?.regionsWithPresence || []), ...boardRegions]));

    return {
      ...(progress || { teamId, regionInvestments: {}, regionsWithPresence: [] }),
      regionsWithPresence: mergedPresence
    };
  }, [effectiveGameState]);

  const canExpandToRegion = useCallback((teamId: string, regionName: string): boolean => {
    if (!effectiveGameState) return false;

    const region = effectiveGameState.regionLogistics[regionName];
    if (!region) return false;

    // Check if region is full
    if (region.teamsPresent.length >= region.maxTeams) return false;

    const teamProgress = effectiveGameState.teamLogisticsProgress[teamId];
    if (!teamProgress) return false;

    // Check if team already has presence
    if (teamProgress.regionsWithPresence.includes(regionName)) return true;

    // Check if region is connected to any region where team has presence
    const hasConnectedPresence = region.connectedRegions.some(connectedRegion =>
      teamProgress.regionsWithPresence.includes(connectedRegion)
    );

    return hasConnectedPresence;
  }, [effectiveGameState]);

  const getAvailableRegionsForTeam = useCallback((teamId: string): RegionLogistics[] => {
    if (!effectiveGameState) return [];

    return Object.values(effectiveGameState.regionLogistics).filter(region =>
      canExpandToRegion(teamId, region.name)
    );
  }, [effectiveGameState, canExpandToRegion]);

  const isRegionFull = useCallback((regionName: string): boolean => {
    if (!effectiveGameState) return false;

    const region = effectiveGameState.regionLogistics[regionName];
    if (!region) return false;

    return region.teamsPresent.length >= region.maxTeams;
  }, [effectiveGameState]);

  const getCombinations = useCallback((): Combination[] => {
    return effectiveGameState?.combinationsData || COMBINATIONS;
  }, [effectiveGameState]);

  const updateCombinations = useCallback((data: Combination[] | null) => {
    if (!effectiveGameState) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      const newState = { ...prev };
      if (data) {
        newState.combinationsData = data;
      } else {
        delete newState.combinationsData;
      }
      return newState;
    });
  }, [effectiveGameState]);

  const recalculateControlPoints = useCallback(() => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      const updatedRounds = prev.rounds.map(round => {
        const teamControlPoints: Record<string, Record<string, number>> = {};
        const teamControlTotals: Record<string, number> = {};

        prev.teams.forEach(t => {
          teamControlPoints[t.id] = {};
          teamControlTotals[t.id] = 0;
        });

        REGIONS.forEach(region => {
          const regionData = REGION_CUSTOMERS.find(r => r.region === region);
          if (!regionData) return;

          const teamSales: Array<{ teamId: string; salesCount: number; leftmostPosition: number }> = [];

          prev.teams.forEach(team => {
            const teamData = round.teamData[team.id];
            if (!teamData || !teamData.customersSold || teamData.customersSold.length === 0) return;

            const soldInRegion = teamData.customersSold.filter(customerId =>
              regionData.customers.some(c => c.id === customerId)
            );

            if (soldInRegion.length > 0) {
              let leftmostPosition = Infinity;
              soldInRegion.forEach(customerId => {
                const customer = regionData.customers.find(c => c.id === customerId);
                if (customer && customer.position < leftmostPosition) {
                  leftmostPosition = customer.position;
                }
              });

              teamSales.push({
                teamId: team.id,
                salesCount: soldInRegion.length,
                leftmostPosition: leftmostPosition === Infinity ? 999 : leftmostPosition
              });
            }
          });

          if (teamSales.length === 0) return;

          teamSales.sort((a, b) => {
            if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
            return a.leftmostPosition - b.leftmostPosition;
          });

          const regionLogisticsData = prev.regionLogistics[region];
          const teamsPresentCount = regionLogisticsData?.teamsPresent.length || 0;

          if (teamSales.length > 0) {
            const firstTeamId = teamSales[0].teamId;
            const firstPoints = getControlPointsForRegion(region, teamsPresentCount, 'first');
            teamControlPoints[firstTeamId][region] = firstPoints;
            teamControlTotals[firstTeamId] += firstPoints;
          }

          if (teamSales.length > 1) {
            const secondTeamId = teamSales[1].teamId;
            const secondPoints = getControlPointsForRegion(region, teamsPresentCount, 'second');
            teamControlPoints[secondTeamId][region] = secondPoints;
            teamControlTotals[secondTeamId] += secondPoints;
          }
        });

        const newTeamData = { ...round.teamData };
        prev.teams.forEach(team => {
          const td = newTeamData[team.id];
          if (!td) return;

          const newControlValue = teamControlTotals[team.id] || 0;
          const newRegionControl = teamControlPoints[team.id] || {};

          newTeamData[team.id] = {
            ...td,
            regionControlPoints: newRegionControl,
            controlValue: newControlValue,
            totalMoney: (td.revenue || 0) + newControlValue
          };
        });

        return {
          ...round,
          teamData: newTeamData
        };
      });

      return {
        ...prev,
        rounds: updatedRounds,
        updatedAt: new Date()
      };
    });
  }, [effectiveGameState]);

  if (!activeIsLoaded) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-white">Loading Game State...</div>;
  }

  return (
    <GameContext.Provider
      value={{
        gameState: activeGameState,
        initializeGame,
        addRoundData,
        updatePatent,
        getCurrentRound,
        getTeamData,
        resetGame,
        selectRandomCards,
        reshuffleRoundCards,
        allocateImprovementCards,
        advanceRound,
        updatePhase,
        claimImprovementCard,
        unclaimImprovementCard,
        setBotThinking,
        markImprovementCardUsed,
        clearNonInitialCards,
        previewNextRoundCards,
        allocateResearch,
        getTeamResearchProgress,
        getTechnologyCostForTeam,
        calculatePlayOrder,
        allocateLogistics,
        getTeamLogisticsProgress,
        canExpandToRegion,
        getAvailableRegionsForTeam,
        isRegionFull,
        getCombinations,
        updateCombinations,
        recalculateControlPoints,
        endGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
