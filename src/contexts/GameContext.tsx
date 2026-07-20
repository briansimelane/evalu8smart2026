import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { GameState, Team, RoundData, TeamRoundData, TeamResearchProgress, RegionLogistics, TeamLogisticsProgress } from '@/types/game';
import { REGIONS, TECHNOLOGIES, TEAM_COLORS, COMBINATIONS, Combination, getTeamColorName } from '@/data/combinations';
import { INITIAL_IMPROVEMENT_CARDS, AVAILABLE_IMPROVEMENT_CARDS, ImprovementCardData } from '@/data/improvements';
import { REGION_CONFIGS, INITIAL_TEAM_REGIONS } from '@/data/regions';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSession } from '@/contexts/SessionContext';
import { SimulationClass } from '@/types/game';

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
  updatePhase: (phase: string) => void;
  claimImprovementCard: (cardId: number, teamId: string) => void;
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
}

export const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { currentClassId } = useSession();
  
  // Tracks if the state update was initiated from the Firestore snapshot listener
  const isIncomingSnapshot = useRef(false);

  useEffect(() => {
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
      const docRef = doc(db, 'classes', currentClassId);
      const unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const classData = snap.data() as SimulationClass;
          const data = classData.gameState;
          if (data) {
            if (data.createdAt) data.createdAt = new Date(data.createdAt as any);
            if (data.updatedAt) data.updatedAt = new Date(data.updatedAt as any);
            
            // Mark as server update to bypass the local write useEffect trigger
            isIncomingSnapshot.current = true;
            setGameState(data);
          } else {
            setGameState(null);
          }
        } else {
          setGameState(null);
        }
        setIsLoaded(true);
      }, (error) => {
        console.error("Error listening to class gameState:", error);
      });
      return () => unsubscribe();
    }
  }, [currentClassId]);

  useEffect(() => {
    if (!isLoaded) return;
    
    // Bypass writing back if this update originated from the database snapshot
    if (isIncomingSnapshot.current) {
      isIncomingSnapshot.current = false;
      return;
    }

    if (!currentClassId) {
      const docRef = doc(db, 'evalu8smart_sessions', 'default_game');
      if (gameState) {
        const safeState = { ...gameState };
        if (safeState.createdAt instanceof Date) safeState.createdAt = safeState.createdAt.toISOString() as any;
        safeState.updatedAt = new Date().toISOString() as any;
        
        setDoc(docRef, safeState)
          .catch(e => console.error("Failed to save game to Firebase:", e));
      } else {
        deleteDoc(docRef).catch(e => console.error("Failed to delete game from Firebase:", e));
      }
    } else {
      const docRef = doc(db, 'classes', currentClassId);
      if (gameState) {
        const safeState = { ...gameState };
        if (safeState.createdAt instanceof Date) safeState.createdAt = safeState.createdAt.toISOString() as any;
        safeState.updatedAt = new Date().toISOString() as any;
        
        setDoc(docRef, { gameState: safeState }, { merge: true })
          .catch(e => console.error("Failed to save class game to Firebase:", e));
      }
    }
  }, [gameState, isLoaded, currentClassId]);

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
      'Gaming': 4,
      'Battery': 4,
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
          researchCost: techCosts[tech] || 4,
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
    setGameState(newGame);
  };

  const addRoundData = (roundNumber: number, teamId: string, data: TeamRoundData) => {
    if (!gameState) return;

    setGameState(prev => {
      if (!prev) return prev;

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
    if (!gameState) return;

    setGameState(prev => {
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
    return gameState?.currentRound || 1;
  };

  const getTeamData = (teamId: string): TeamRoundData[] => {
    if (!gameState) return [];

    return gameState.rounds
      .map(round => round.teamData[teamId])
      .filter(Boolean);
  };

  const resetGame = () => {
    if (gameState?.teams) {
      initializeGame(gameState.teams);
    } else {
      setGameState(null);
    }
  };

  const selectRandomCards = (): ImprovementCardData[] => {
    if (!gameState) return [];

    const currentRound = gameState.currentRound;

    // If pool already exists for this round, return it
    const existingIds = gameState.improvementPoolByRound?.[currentRound];
    if (existingIds && existingIds.length > 0) {
      return existingIds
        .map(id => AVAILABLE_IMPROVEMENT_CARDS.find(c => c.id === id))
        .filter(Boolean) as ImprovementCardData[];
    }

    // Always select cards equal to the number of teams
    const numEligibleTeams = gameState.teams.length;

    const usedCardIds = gameState.improvementCards
      .filter(card => card.used)
      .map(card => card.id);

    const availablePool = AVAILABLE_IMPROVEMENT_CARDS.filter(
      card => !usedCardIds.includes(card.id)
    );

    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(0, numEligibleTeams));

    // Persist pool for this round
    const selectedIds = selected.map(c => c.id);
    setGameState(prev => {
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
    if (!gameState) return [];

    const currentRound = gameState.currentRound;

    // Always select as many cards as there are teams
    const numEligibleTeams = gameState.teams.length;

    const usedCardIds = gameState.improvementCards
      .filter(card => card.used)
      .map(card => card.id);

    const availablePool = AVAILABLE_IMPROVEMENT_CARDS.filter(
      card => !usedCardIds.includes(card.id)
    );

    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(0, numEligibleTeams));
    const selectedIds = selected.map(c => c.id);

    setGameState(prev => {
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
    if (!gameState) return;

    setGameState(prev => {
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
              icon2: 'Product',
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
    if (!gameState) return;

    setGameState(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        currentRound: prev.currentRound + 1,
        currentPhase: 'planning',
        updatedAt: new Date()
      };
    });
  };

  const updatePhase = (phase: string) => {
    if (!gameState) return;

    setGameState(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        currentPhase: phase,
        updatedAt: new Date()
      };
    });
  };

  const claimImprovementCard = (cardId: number, teamId: string) => {
    if (!gameState) return;

    setGameState(prev => {
      if (!prev) return prev;

      // Check if this team already claimed a card this round
      const alreadyClaimed = prev.improvementCards.some(c => 
        c.availableForTeam === teamId && c.allocatedInRound === prev.currentRound
      );
      if (alreadyClaimed) return prev;

      const newCards = [...prev.improvementCards];
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
              icon2: 'None',
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

  const markImprovementCardUsed = (cardId: number) => {
    if (!gameState) return;

    setGameState(prev => {
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
    if (!gameState) return;

    setGameState(prev => {
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
    if (!gameState) return [];

    const nextRound = gameState.currentRound + 1;

    // Check if cards already exist for next round
    if (gameState.improvementPoolByRound?.[nextRound]) {
      const cardIds = gameState.improvementPoolByRound[nextRound];
      return AVAILABLE_IMPROVEMENT_CARDS.filter(card => cardIds.includes(card.id));
    }

    // Find teams that will have improvement in next round (if round data exists)
    const nextRoundData = gameState.rounds.find(r => r.roundNumber === nextRound);
    const numEligibleTeams = nextRoundData 
      ? Object.values(nextRoundData.teamData).filter(td => td.improvementCards > 0).length
      : gameState.teams.length; // Default to all teams if no data yet

    if (numEligibleTeams === 0) return [];

    const usedCardIds = gameState.improvementCards
      .filter(card => card.used)
      .map(card => card.id);

    const availablePool = AVAILABLE_IMPROVEMENT_CARDS.filter(
      card => !usedCardIds.includes(card.id)
    );

    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(0, numEligibleTeams));
    const selectedIds = selected.map(c => c.id);

    // Store the preview for next round
    setGameState(prev => {
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
    if (!gameState) return;

    setGameState(prev => {
      if (!prev) return prev;

      const tech = prev.technologies[technology];
      const baseCost = tech.researchCost;

      // Clone current state pieces
      const currentTPAll = { ...prev.teamResearchProgress };
      const teamProgress = currentTPAll[teamId] || {
        teamId,
        technologyInvestments: {},
        completedTechnologies: [],
      };

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
      const currentRound = prev.currentRound;
      const roundAllocations = prev.researchAllocatedByRound[currentRound] || {};
      const prevSpent = roundAllocations[teamId] || 0;
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
    if (!gameState) return undefined;
    return gameState.teamResearchProgress[teamId];
  }, [gameState]);

  const getTechnologyCostForTeam = useCallback((teamId: string, technology: string) => {
    if (!gameState) return 0;
    
    const tech = gameState.technologies[technology];
    if (!tech) return 0;

    const patentHolder = gameState.patents[technology];
    
    // If patent exists and it's not this team, reduce cost by 1
    if (patentHolder && patentHolder !== teamId) {
      return tech.researchCost - 1;
    }
    
    return tech.researchCost;
  }, [gameState]);

  const calculatePlayOrder = (roundNumber: number): Team[] => {
    if (!gameState) return [];

    const roundData = gameState.rounds.find(r => r.roundNumber === roundNumber);
    const previousRoundData = gameState.rounds.find(r => r.roundNumber === roundNumber - 1);
    const round0Data = gameState.rounds.find(r => r.roundNumber === 0);

    if (!roundData) return gameState.teams;

    const teamsWithData = gameState.teams.map(team => {
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
    if (!gameState) return;

    setGameState(prev => {
      if (!prev) return prev;

      const region = prev.regionLogistics[regionName];
      if (!region) return prev;

      const teamProgress = prev.teamLogisticsProgress[teamId];
      if (!teamProgress) return prev;

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
      const currentRound = prev.currentRound;
      const roundAllocations = prev.logisticsAllocatedByRound[currentRound] || {};
      const prevSpent = roundAllocations[teamId] || 0;
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
  }, [gameState]);

  const getTeamLogisticsProgress = useCallback((teamId: string) => {
    if (!gameState) return undefined;
    return gameState.teamLogisticsProgress[teamId];
  }, [gameState]);

  const canExpandToRegion = useCallback((teamId: string, regionName: string): boolean => {
    if (!gameState) return false;

    const region = gameState.regionLogistics[regionName];
    if (!region) return false;

    // Check if region is full
    if (region.teamsPresent.length >= region.maxTeams) return false;

    const teamProgress = gameState.teamLogisticsProgress[teamId];
    if (!teamProgress) return false;

    // Check if team already has presence
    if (teamProgress.regionsWithPresence.includes(regionName)) return true;

    // Check if region is connected to any region where team has presence
    const hasConnectedPresence = region.connectedRegions.some(connectedRegion =>
      teamProgress.regionsWithPresence.includes(connectedRegion)
    );

    return hasConnectedPresence;
  }, [gameState]);

  const getAvailableRegionsForTeam = useCallback((teamId: string): RegionLogistics[] => {
    if (!gameState) return [];

    return Object.values(gameState.regionLogistics).filter(region =>
      canExpandToRegion(teamId, region.name)
    );
  }, [gameState, canExpandToRegion]);

  const isRegionFull = useCallback((regionName: string): boolean => {
    if (!gameState) return false;

    const region = gameState.regionLogistics[regionName];
    if (!region) return false;

    return region.teamsPresent.length >= region.maxTeams;
  }, [gameState]);

  const getCombinations = useCallback((): Combination[] => {
    return gameState?.combinationsData || COMBINATIONS;
  }, [gameState]);

  const updateCombinations = useCallback((data: Combination[] | null) => {
    if (!gameState) return;
    setGameState(prev => {
      if (!prev) return prev;
      const newState = { ...prev };
      if (data) {
        newState.combinationsData = data;
      } else {
        delete newState.combinationsData;
      }
      return newState;
    });
  }, [gameState]);

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-white">Loading Game State...</div>;
  }

  return (
    <GameContext.Provider
      value={{
        gameState,
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
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
