import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { GameState, Team, RoundData, TeamRoundData, TeamResearchProgress, RegionLogistics, TeamLogisticsProgress, GamePhase, RuleAdjustmentsState, AdvancedRulesState, calculateTeamTotalScore, getInitialScore } from '@/types/game';
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
import { calculatePlanStats, canExpandToRegion as canExpandToRegionRule, hasTech, isSteveBlocking, getLogisticsCostForTeam, getRegionOccupancy, getCompletedOffices, isTeamBuildingOffice, getTechnologyCostForTeam as getTechnologyCostForTeamRule } from '@/lib/rules';
import { getDefaultRuleAdjustments, isRuleActiveForTeam, getRuleValueForTeam } from '@/lib/defaultRules';
import { advanceOnePhase } from '@/lib/phaseEngine';
import { withMarksSnapshot } from '@/lib/marks/marksSnapshot';
import { DEFAULT_GAME_THEME_ID, GameThemeId } from '@/lib/gameTheme';
import { TeamActionDoc } from '@/types/game';
import { useAssembledGameState } from '@/hooks/useAssembledGameState';
import { useReferee } from '@/hooks/useReferee';
import { mutateV2GameState, mutateWorld, mutateControl } from '@/lib/v2State';
import {
  submitStudentPlanV2,
  submitStudentActionV2,
  revealPlanningAndAdvanceV2,
  skipTurnV2,
  reopenTeamActionV2,
  rejectTeamActionV2,
} from '@/lib/referee/refereeEngine';
import {
  resolvePlan,
  resolveImprovement,
  resolveResearch,
  resolveLogistics,
  resolveSales,
} from '@/lib/referee/resolvers';
import { normalizePhaseName } from '@/lib/turnOrder';

export interface GameContextType {
  gameState: GameState | null;
  isLoaded: boolean;
  actionsMap: Record<string, TeamActionDoc>;
  initializeGame: (teams: Team[], themeId?: GameThemeId) => void;
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
  submitResearchTurn: (teamId: string, allocations: Record<string, number>) => Promise<void>;
  getTeamResearchProgress: (teamId: string) => import('@/types/game').TeamResearchProgress | undefined;
  getTechnologyCostForTeam: (teamId: string, technology: string) => number;
  calculatePlayOrder: (roundNumber: number) => import('@/types/game').Team[];
  allocateLogistics: (teamId: string, regionName: string, points: number) => void;
  finishLogisticsTurn: (teamId: string) => void;
  submitLogisticsTurn: (teamId: string, allocations: Record<string, number>) => Promise<void>;
  getTeamLogisticsProgress: (teamId: string) => TeamLogisticsProgress | undefined;
  canExpandToRegion: (teamId: string, regionName: string) => boolean;
  getAvailableRegionsForTeam: (teamId: string) => RegionLogistics[];
  isRegionFull: (regionName: string) => boolean;
  updateCombinations: (data: Combination[] | null) => void;
  getCombinations: () => Combination[];
  getRuleAdjustments: () => RuleAdjustmentsState;
  updateRuleAdjustments: (rulesState: RuleAdjustmentsState | null) => void;
  allocateDirective: (teamId: string, directiveId: string) => void;
  revokeDirective: (directiveId: string) => void;
  moveSteve: (regionName: string | null) => void;
  contributeWildcardsToSteve: (teamId: string, delta?: number) => void;
  adjustTeamWildcardTotal: (teamId: string, delta: number) => void;
  transferWildcardTokens: (fromTeamId: string, toTeamId: string, amount: number) => void;
  allocateWildcardToken: (teamId: string, conversionType: 'product' | 'research' | 'logistics' | 'improvement', delta?: number) => void;
  recalculateControlPoints: () => void;
  updatePhase: (phase: GamePhase) => void;
  updateTeamLabelMode: (mode: 'name' | 'code') => void;
  endGame: () => void;
  skipTurn: () => Promise<void>;
  reopenTeamAction: (phase: string, teamId: string) => Promise<void>;
  rejectTeamAction: (phase: string, teamId: string, reason: string) => Promise<void>;
}

export const GameContext: React.Context<GameContextType | undefined> =
  (globalThis as any).__EVALU8_GAME_CONTEXT__ ||
  ((globalThis as any).__EVALU8_GAME_CONTEXT__ = createContext<GameContextType | undefined>(undefined));

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

function normalizeLoadedGameState(raw: any): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate =
    raw.gameState && typeof raw.gameState === 'object' && !Array.isArray(raw.rounds)
      ? raw.gameState
      : raw;
  if (!candidate || typeof candidate !== 'object') return null;
  if (!Array.isArray(candidate.teams) && !Array.isArray(candidate.rounds)) return null;

  return {
    ...candidate,
    teams: Array.isArray(candidate.teams) ? candidate.teams : [],
    rounds: Array.isArray(candidate.rounds) ? candidate.rounds : [],
    currentRound: typeof candidate.currentRound === 'number' ? candidate.currentRound : 1,
    currentPhase: candidate.currentPhase || 'planning',
    improvementCards: Array.isArray(candidate.improvementCards) ? candidate.improvementCards : [],
    regions: Array.isArray(candidate.regions) ? candidate.regions : [],
    technologies:
      candidate.technologies && typeof candidate.technologies === 'object'
        ? candidate.technologies
        : {},
    patents:
      candidate.patents && typeof candidate.patents === 'object' ? candidate.patents : {},
    teamResearchProgress:
      candidate.teamResearchProgress && typeof candidate.teamResearchProgress === 'object'
        ? candidate.teamResearchProgress
        : {},
    regionLogistics:
      candidate.regionLogistics && typeof candidate.regionLogistics === 'object'
        ? candidate.regionLogistics
        : {},
    teamLogisticsProgress:
      candidate.teamLogisticsProgress && typeof candidate.teamLogisticsProgress === 'object'
        ? candidate.teamLogisticsProgress
        : {},
    createdAt: toValidDate(candidate.createdAt),
    updatedAt: toValidDate(candidate.updatedAt),
  } as GameState;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loadedClassId, setLoadedClassId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { currentClassId, activeClass, currentRole, currentTeamId, authUid, isAuthReady, isDemo } = useSession();
  const demoContext = useDemoState();

  const isV2 = !isDemo && (activeClass ? activeClass.schemaVersion !== 1 : true);
  const fallbackTeams: Team[] = React.useMemo(
    () => activeClass?.teams || (activeClass?.teamRegistry as any) || [],
    [activeClass?.teams, activeClass?.teamRegistry]
  );
  const v2Assembled = useAssembledGameState({
    classId: currentClassId,
    enabled: isV2 && isAuthReady,
    teams: fallbackTeams,
    themeId: activeClass?.themeId,
    role: currentRole,
    teamId: currentTeamId,
    authUid,
  });

  // Mount facilitator referee loop whenever a facilitator/admin has an active v2 class selected
  const isRefereeEnabled = isV2 && isAuthReady && (currentRole === 'FACILITATOR' || currentRole === 'ADMIN');
  useReferee({
    classId: currentClassId,
    enabled: isRefereeEnabled,
    teams: fallbackTeams,
    themeId: activeClass?.themeId,
  });
  
  const mutateGameState = useCallback((updater: (prev: GameState | null) => GameState | null) => {
    if (isDemo) {
      demoContext.setDemoGameState(updater);
      return;
    }

    if (isV2 && currentClassId) {
      if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') {
        return;
      }
      mutateV2GameState(
        currentClassId,
        fallbackTeams,
        activeClass?.themeId,
        (freshState) => updater(freshState) || freshState
      ).catch((e) => console.error("Failed to mutate v2 game state:", e));
      return;
    }

    setGameState(prev => {
      const next = normalizeLoadedGameState(updater(prev));
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
  }, [currentClassId, isDemo, isV2, currentRole, fallbackTeams, activeClass?.themeId, demoContext]);

  useEffect(() => {
    if (isDemo || isV2) {
      setGameState(null);
      setLoadedClassId(currentClassId);
      setIsLoaded(true);
      return;
    }

    if (!isAuthReady) {
      return;
    }

    setGameState(null);
    setLoadedClassId(currentClassId);
    setIsLoaded(false);

    if (!currentClassId) {
      if (!currentRole) {
        setIsLoaded(true);
        return;
      }
      let isMounted = true;
      const loadState = async () => {
        try {
          const docRef = doc(db, 'evalu8smart_sessions', 'default_game');
          const snap = await getDoc(docRef);
          if (snap.exists() && isMounted) {
            setGameState(normalizeLoadedGameState(snap.data()));
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
          const normalized = normalizeLoadedGameState(stateData?.gameState ?? stateData);
          setGameState(normalized);
        } else {
          // Fallback check on legacy root gameState or teamRegistry for new classes
          getDoc(doc(db, 'classes', currentClassId)).then(classSnap => {
            if (classSnap.exists()) {
              const classData = classSnap.data() as SimulationClass;
              if (classData.schemaVersion === 2) {
                setIsLoaded(true);
                return;
              }
              if (classData.gameState) {
                setGameState(normalizeLoadedGameState(classData.gameState));
              } else {
                const teamsToInit: Team[] = (classData.teamRegistry && classData.teamRegistry.length > 0)
                  ? classData.teamRegistry.map((t, idx) => ({
                      id: t.id || `team_${idx + 1}`,
                      name: t.name,
                      color: t.color,
                      isBot: !!t.isBot,
                      botProfile: t.botProfile,
                      botDifficulty: t.botDifficulty
                    }))
                  : [];
                if (teamsToInit.length > 0) {
                  initializeGame(teamsToInit, classData.themeId);
                } else {
                  setGameState(null);
                }
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
  }, [currentClassId, currentRole, isDemo, isV2, isAuthReady, authUid]);

  const [optimisticAdvancedState, setOptimisticAdvancedState] = useState<AdvancedRulesState | null>(null);

  useEffect(() => {
    setOptimisticAdvancedState(null);
  }, [currentClassId]);

  const legacyMatchedState = loadedClassId === currentClassId ? gameState : null;

  const rawEffectiveGameState = isDemo
    ? demoContext.demoGameState
    : isV2
    ? v2Assembled.gameState
    : legacyMatchedState;
  const rawActiveGameState = isDemo
    ? (demoContext.maskedDemoState || demoContext.demoGameState)
    : isV2
    ? v2Assembled.gameState
    : legacyMatchedState;

  // Clear optimistic state when raw incoming server state catches up with optimistic values
  useEffect(() => {
    if (!optimisticAdvancedState || !rawEffectiveGameState?.advancedState) return;

    let allCaughtUp = true;
    const serverAdvanced = rawEffectiveGameState.advancedState;

    if (optimisticAdvancedState.wildcards) {
      for (const [tId, optWc] of Object.entries(optimisticAdvancedState.wildcards)) {
        const sWc = serverAdvanced.wildcards?.[tId];
        if (!sWc) {
          allCaughtUp = false;
          break;
        }
        for (const [rNum, optConvs] of Object.entries(optWc.conversionsByRound || {})) {
          const sConvs = sWc.conversionsByRound?.[Number(rNum)] || {};
          for (const [type, val] of Object.entries(optConvs || {})) {
            if ((sConvs as any)[type] !== val) {
              allCaughtUp = false;
              break;
            }
          }
          if (!allCaughtUp) break;
        }
        if (!allCaughtUp) break;
      }
    }

    if (optimisticAdvancedState.steve) {
      const sSteve = serverAdvanced.steve;
      for (const [rNum, tMap] of Object.entries(optimisticAdvancedState.steve.wildcardsContributedByRound || {})) {
        const sMap = sSteve?.wildcardsContributedByRound?.[Number(rNum)] || {};
        for (const [tId, val] of Object.entries(tMap || {})) {
          if ((sMap as any)[tId] !== val) {
            allCaughtUp = false;
            break;
          }
        }
        if (!allCaughtUp) break;
      }
    }

    if (allCaughtUp) {
      setOptimisticAdvancedState(null);
    }
  }, [rawEffectiveGameState, optimisticAdvancedState]);

  // Safety fallback timeout to clear stale optimistic state after 6s
  useEffect(() => {
    if (!optimisticAdvancedState) return;
    const timer = setTimeout(() => {
      setOptimisticAdvancedState(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [optimisticAdvancedState]);

  const effectiveGameState = useMemo(() => {
    if (!rawEffectiveGameState) return null;
    if (!optimisticAdvancedState) return rawEffectiveGameState;

    const baseAdvanced = rawEffectiveGameState.advancedState || {};
    const mergedWildcards = { ...(baseAdvanced.wildcards || {}) };

    if (optimisticAdvancedState.wildcards) {
      for (const [tId, optWc] of Object.entries(optimisticAdvancedState.wildcards)) {
        const baseWc = baseAdvanced.wildcards?.[tId] || {
          teamId: tId,
          totalTokens: optWc.totalTokens ?? 10,
          usedInRound: {},
          conversionsByRound: {},
        };
        mergedWildcards[tId] = {
          ...baseWc,
          ...optWc,
          conversionsByRound: {
            ...(baseWc.conversionsByRound || {}),
            ...(optWc.conversionsByRound || {}),
          },
          usedInRound: {
            ...(baseWc.usedInRound || {}),
            ...(optWc.usedInRound || {}),
          },
        };
      }
    }

    const mergedSteve = optimisticAdvancedState.steve
      ? {
          ...(baseAdvanced.steve || { activeRegion: null }),
          ...optimisticAdvancedState.steve,
          wildcardsContributed: {
            ...(baseAdvanced.steve?.wildcardsContributed || {}),
            ...(optimisticAdvancedState.steve.wildcardsContributed || {}),
          },
          wildcardsContributedByRound: {
            ...(baseAdvanced.steve?.wildcardsContributedByRound || {}),
            ...(optimisticAdvancedState.steve.wildcardsContributedByRound || {}),
          },
        }
      : baseAdvanced.steve;

    const mergedAdvanced: AdvancedRulesState = {
      ...baseAdvanced,
      ...optimisticAdvancedState,
      wildcards: mergedWildcards,
      steve: mergedSteve,
    };

    let mergedRounds = rawEffectiveGameState.rounds;
    const currentRound = rawEffectiveGameState.currentRound;
    const roundIndex = rawEffectiveGameState.rounds.findIndex(r => r.roundNumber === currentRound);
    if (roundIndex !== -1 && rawEffectiveGameState.rounds[roundIndex]?.teamData) {
      const roundData = rawEffectiveGameState.rounds[roundIndex];
      let updatedTeamData = { ...roundData.teamData };
      let hasChanges = false;

      if (optimisticAdvancedState.wildcards) {
        for (const tId of Object.keys(optimisticAdvancedState.wildcards)) {
          const existingTeamData = updatedTeamData[tId];
          if (existingTeamData && existingTeamData.combination && existingTeamData.position) {
            const tempState = { ...rawEffectiveGameState, advancedState: mergedAdvanced };
            const newStats = calculatePlanStats(
              tempState,
              tId,
              existingTeamData.combination,
              existingTeamData.position,
              existingTeamData.cardUsages || {},
              rawEffectiveGameState.combinationsData || COMBINATIONS
            );
            const targetProducts = Math.max(existingTeamData.productsProduced || 0, newStats.productsAvailable);
            updatedTeamData[tId] = {
              ...existingTeamData,
              price: newStats.calculatedPrice,
              productsProduced: targetProducts,
              researchIcons: newStats.researchPoints,
              logisticsIcons: newStats.logisticsPoints,
              improvementCards: newStats.improvementPoints,
            };
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        mergedRounds = [...rawEffectiveGameState.rounds];
        mergedRounds[roundIndex] = {
          ...roundData,
          teamData: updatedTeamData,
        };
      }
    }

    return {
      ...rawEffectiveGameState,
      advancedState: mergedAdvanced,
      rounds: mergedRounds,
    };
  }, [rawEffectiveGameState, optimisticAdvancedState]);

  const activeGameState = useMemo(() => {
    if (!rawActiveGameState) return null;
    if (!optimisticAdvancedState) return rawActiveGameState;

    const baseAdvanced = rawActiveGameState.advancedState || {};
    const mergedWildcards = { ...(baseAdvanced.wildcards || {}) };

    if (optimisticAdvancedState.wildcards) {
      for (const [tId, optWc] of Object.entries(optimisticAdvancedState.wildcards)) {
        const baseWc = baseAdvanced.wildcards?.[tId] || {
          teamId: tId,
          totalTokens: optWc.totalTokens ?? 10,
          usedInRound: {},
          conversionsByRound: {},
        };
        mergedWildcards[tId] = {
          ...baseWc,
          ...optWc,
          conversionsByRound: {
            ...(baseWc.conversionsByRound || {}),
            ...(optWc.conversionsByRound || {}),
          },
          usedInRound: {
            ...(baseWc.usedInRound || {}),
            ...(optWc.usedInRound || {}),
          },
        };
      }
    }

    const mergedSteve = optimisticAdvancedState.steve
      ? {
          ...(baseAdvanced.steve || { activeRegion: null }),
          ...optimisticAdvancedState.steve,
          wildcardsContributed: {
            ...(baseAdvanced.steve?.wildcardsContributed || {}),
            ...(optimisticAdvancedState.steve.wildcardsContributed || {}),
          },
          wildcardsContributedByRound: {
            ...(baseAdvanced.steve?.wildcardsContributedByRound || {}),
            ...(optimisticAdvancedState.steve.wildcardsContributedByRound || {}),
          },
        }
      : baseAdvanced.steve;

    const mergedAdvanced: AdvancedRulesState = {
      ...baseAdvanced,
      ...optimisticAdvancedState,
      wildcards: mergedWildcards,
      steve: mergedSteve,
    };

    let mergedRounds = rawActiveGameState.rounds;
    const currentRound = rawActiveGameState.currentRound;
    const roundIndex = rawActiveGameState.rounds.findIndex(r => r.roundNumber === currentRound);
    if (roundIndex !== -1 && rawActiveGameState.rounds[roundIndex]?.teamData) {
      const roundData = rawActiveGameState.rounds[roundIndex];
      let updatedTeamData = { ...roundData.teamData };
      let hasChanges = false;

      if (optimisticAdvancedState.wildcards) {
        for (const tId of Object.keys(optimisticAdvancedState.wildcards)) {
          const existingTeamData = updatedTeamData[tId];
          if (existingTeamData && existingTeamData.combination && existingTeamData.position) {
            const tempState = { ...rawActiveGameState, advancedState: mergedAdvanced };
            const newStats = calculatePlanStats(
              tempState,
              tId,
              existingTeamData.combination,
              existingTeamData.position,
              existingTeamData.cardUsages || {},
              rawActiveGameState.combinationsData || COMBINATIONS
            );
            const targetProducts = Math.max(existingTeamData.productsProduced || 0, newStats.productsAvailable);
            updatedTeamData[tId] = {
              ...existingTeamData,
              price: newStats.calculatedPrice,
              productsProduced: targetProducts,
              researchIcons: newStats.researchPoints,
              logisticsIcons: newStats.logisticsPoints,
              improvementCards: newStats.improvementPoints,
            };
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        mergedRounds = [...rawActiveGameState.rounds];
        mergedRounds[roundIndex] = {
          ...roundData,
          teamData: updatedTeamData,
        };
      }
    }

    return {
      ...rawActiveGameState,
      advancedState: mergedAdvanced,
      rounds: mergedRounds,
    };
  }, [rawActiveGameState, optimisticAdvancedState]);
  const activeIsLoaded = isDemo
    ? demoContext.isLoaded
    : isV2
    ? v2Assembled.isLoaded
    : isLoaded;

  const initializeGame = (teams: Team[], themeId?: GameThemeId) => {
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
      themeId: themeId ?? activeClass?.themeId ?? effectiveGameState?.themeId ?? DEFAULT_GAME_THEME_ID,
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

    if (isV2 && currentClassId) {
      const currentPhaseNorm = normalizePhaseName(effectiveGameState.currentPhase || 'planning');
      const isSalesSubmission =
        currentPhaseNorm === 'sales' ||
        (data.customersSold !== undefined && currentPhaseNorm !== 'planning');

      if (currentRole === 'STUDENT') {
        if (!isSalesSubmission) {
          submitStudentPlanV2(currentClassId, roundNumber, teamId, data).catch((err) => {
            console.error('Failed to submit student plan v2:', err);
          });
        } else {
          const customersSold = data.customersSold || [];
          const nfcSalesUnits = data.nfcSalesUnits || 0;
          submitStudentActionV2(
            currentClassId,
            roundNumber,
            'sales',
            teamId,
            { customersSold, nfcSalesUnits },
            customersSold.length + nfcSalesUnits
          ).catch((err) => {
            console.error('Failed to submit student sales action v2:', err);
          });
        }
        return;
      }

      // Facilitator or Bot on v2 class
      if (!isSalesSubmission) {
        if (currentPhaseNorm === 'planning') {
          submitStudentPlanV2(currentClassId, roundNumber, teamId, data).catch((err) => {
            console.error('Failed to submit sealed plan v2:', err);
          });
        } else {
          mutateV2GameState(
            currentClassId,
            fallbackTeams,
            activeClass?.themeId,
            (freshState) => {
              const res = resolvePlan(freshState, roundNumber, teamId, data);
              return res.valid ? res.nextState : freshState;
            }
          ).catch((err) => console.error('Failed to apply plan v2:', err));
        }
      } else {
        mutateV2GameState(
          currentClassId,
          fallbackTeams,
          activeClass?.themeId,
          (freshState) => {
            const res = resolveSales(freshState, teamId, {
              customersSold: data.customersSold || [],
              nfcSalesUnits: data.nfcSalesUnits || 0,
            });
            if (!res.valid) return freshState;
            const nextState = res.nextState;
            if (nextState.turn && nextState.turn.order[nextState.turn.index] === teamId) {
              nextState.turn = {
                ...nextState.turn,
                index: Math.min(nextState.turn.index + 1, nextState.turn.order.length),
              };
            }
            return nextState;
          }
        ).catch((err) => console.error('Failed to apply sales v2:', err));
      }
      return;
    }

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

      const existingTeamData = prev.rounds.find(r => r.roundNumber === roundNumber)?.teamData?.[teamId];
      const minExpectedProducts = existingTeamData?.productsProduced ?? stats.productsAvailable;

      if (
        data.price !== stats.calculatedPrice ||
        data.productsProduced < minExpectedProducts ||
        data.researchIcons !== stats.researchPoints ||
        data.logisticsIcons !== stats.logisticsPoints
      ) {
        console.error(`Planning stats mismatch for team ${teamId}. Given: price=${data.price}, produced=${data.productsProduced}, research=${data.researchIcons}, logistics=${data.logisticsIcons}. Expected min produced=${minExpectedProducts}, price=${stats.calculatedPrice}, research=${stats.researchPoints}, logistics=${stats.logisticsPoints}.`);
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

      // Stamp GPS bonus claimed once per game when submitting a production plan (DR-1)
      const currentPhaseNorm = (prev.currentPhase || 'planning').toLowerCase();
      const isPlanningSubmission = currentPhaseNorm === 'planning' || (data.productsProduced !== undefined && data.customersSold === undefined);
      const hasGPS = hasTech(prev, teamId, 'GPS');
      const alreadyClaimedGPS = Boolean(prev.advancedState?.gpsBonusClaimed?.[teamId]);
      let updatedAdvanced = prev.advancedState || {};
      if (isPlanningSubmission && hasGPS && !alreadyClaimedGPS) {
        updatedAdvanced = {
          ...updatedAdvanced,
          gpsBonusClaimed: {
            ...(updatedAdvanced.gpsBonusClaimed || {}),
            [teamId]: true,
          }
        };
      }

      return {
        ...prev,
        rounds,
        currentRound: Math.max(prev.currentRound, roundNumber),
        advancedState: updatedAdvanced,
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
        if ((t.id === teamId || invested >= cost) && !tp.completedTechnologies.includes(techName)) {
          tp.completedTechnologies = [...tp.completedTechnologies, techName];
        }
        updatedTeamResearchProgress[t.id] = tp;
      });

      let updatedRounds = prev.rounds;
      const currentRound = prev.currentRound;
      const roundIndex = prev.rounds.findIndex(r => r.roundNumber === currentRound);
      if (roundIndex !== -1) {
        const roundData = prev.rounds[roundIndex];
        const updatedTeamDataMap = { ...roundData.teamData };
        let hasChanges = false;

        const tempState = {
          ...prev,
          teamResearchProgress: updatedTeamResearchProgress,
          patents: newPatents,
        };

        prev.teams.forEach(t => {
          const existingTeamData = roundData.teamData[t.id];
          if (existingTeamData && existingTeamData.combination && existingTeamData.position) {
            const newStats = calculatePlanStats(
              tempState,
              t.id,
              existingTeamData.combination,
              existingTeamData.position,
              existingTeamData.cardUsages || {},
              prev.combinationsData || COMBINATIONS
            );

            const targetProducts = Math.max(existingTeamData.productsProduced || 0, newStats.productsAvailable);

            if (
              existingTeamData.productsProduced !== targetProducts ||
              existingTeamData.logisticsIcons !== newStats.logisticsPoints ||
              existingTeamData.researchIcons !== newStats.researchPoints ||
              existingTeamData.price !== newStats.calculatedPrice
            ) {
              hasChanges = true;
              updatedTeamDataMap[t.id] = {
                ...existingTeamData,
                price: newStats.calculatedPrice,
                productsProduced: targetProducts,
                researchIcons: newStats.researchPoints,
                logisticsIcons: newStats.logisticsPoints,
                improvementCards: newStats.improvementPoints,
              };
            }
          }
        });

        if (hasChanges) {
          updatedRounds = [...prev.rounds];
          updatedRounds[roundIndex] = {
            ...roundData,
            teamData: updatedTeamDataMap
          };
        }
      }

      return {
        ...prev,
        rounds: updatedRounds,
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
      initializeGame(teamsToUse, activeClass?.themeId ?? effectiveGameState?.themeId);
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
      return advanceOnePhase({ ...prev, currentPhase: 'scoring' });
    });
  };

  const updatePhase = (phase: GamePhase) => {
    if (!effectiveGameState) return;

    if (isV2 && currentClassId) {
      if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') return;
      revealPlanningAndAdvanceV2(currentClassId, fallbackTeams, activeClass?.themeId, {
        targetPhase: phase,
      }).catch((err) => console.error('Failed to update phase v2:', err));
      return;
    }

    mutateGameState(prev => {
      if (!prev) return prev;

      let targetPhase = phase;
      if (prev.currentRound >= 5 && (targetPhase === 'improvement' || targetPhase === 'IMPROVEMENT')) {
        targetPhase = 'innovation';
      }

      const rawTarget = (targetPhase || 'planning').toLowerCase();
      const normTarget = rawTarget === 'research' ? 'innovation' : (rawTarget === 'logistics' ? 'expansion' : rawTarget) as GamePhase;

      const newCards = [...(prev.improvementCards || [])];
      if (normTarget === 'improvement') {
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
        currentPhase: normTarget,
        improvementCards: newCards,
        updatedAt: new Date()
      };
    });
  };

  const updateTeamLabelMode = (mode: 'name' | 'code') => {
    if (!effectiveGameState) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        teamLabelMode: mode,
        updatedAt: new Date()
      };
    });
  };

  const endGame = () => {
    if (!effectiveGameState) return;

    mutateGameState(prev => {
      if (!prev) return prev;

      const now = new Date();
      const snapped = prev.gameEnded ? prev : withMarksSnapshot(prev, prev.currentRound || 1, now);
      return {
        ...snapped,
        gameEnded: true,
        updatedAt: now
      };
    });
  };

  const setBotThinking = (teamId: string, thinking: boolean) => {
    if (!effectiveGameState) return;
    if (isV2 && currentClassId) {
      if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') return;
      mutateControl(currentClassId, (ctl) => {
        const currentVal = Boolean(ctl.botThinking?.[teamId]);
        if (currentVal === thinking) return null;
        return {
          ...ctl,
          botThinking: {
            ...(ctl.botThinking || {}),
            [teamId]: thinking,
          },
        };
      }).catch(() => {});
      return;
    }
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

    if (isV2 && currentClassId) {
      if (currentRole === 'STUDENT') {
        submitStudentActionV2(
          currentClassId,
          effectiveGameState.currentRound || 1,
          'improvement',
          teamId,
          { cardId },
          1
        ).catch((err) => console.error('Failed to submit student improvement action v2:', err));
        return;
      }

      mutateV2GameState(
        currentClassId,
        fallbackTeams,
        activeClass?.themeId,
        (freshState) => {
          const res = resolveImprovement(freshState, teamId, cardId);
          if (!res.valid) return freshState;
          const nextState = res.nextState;
          if (nextState.turn && nextState.turn.order[nextState.turn.index] === teamId) {
            nextState.turn = {
              ...nextState.turn,
              index: Math.min(nextState.turn.index + 1, nextState.turn.order.length),
            };
          }
          return nextState;
        }
      ).catch((err) => console.error('Failed to apply improvement v2:', err));
      return;
    }

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
    if (isV2 && currentRole === 'STUDENT') {
      // On v2 classes, cardUsages are stored in plans/{round}_{teamId} and marked used by the referee upon reveal.
      return;
    }

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

  const submitResearchTurn = useCallback(async (teamId: string, allocations: Record<string, number>) => {
    if (!effectiveGameState) return;

    if (isV2 && currentClassId) {
      const roundNumber = effectiveGameState.currentRound || 1;
      const totalSpent = Object.values(allocations).reduce((acc, v) => acc + Math.max(0, Number(v || 0)), 0);

      if (currentRole === 'STUDENT') {
        await submitStudentActionV2(
          currentClassId,
          roundNumber,
          'innovation',
          teamId,
          { allocations },
          totalSpent
        );
        return;
      }

      await mutateV2GameState(
        currentClassId,
        fallbackTeams,
        activeClass?.themeId,
        (freshState) => {
          const res = resolveResearch(freshState, teamId, allocations);
          if (!res.valid) return freshState;
          const nextState = res.nextState;
          if (nextState.turn && nextState.turn.order[nextState.turn.index] === teamId) {
            nextState.turn = {
              ...nextState.turn,
              index: Math.min(nextState.turn.index + 1, nextState.turn.order.length),
            };
          }
          return nextState;
        }
      );
      return;
    }

    let sumAllocated = 0;
    Object.entries(allocations).forEach(([tech, pts]) => {
      if (pts > 0) {
        allocateResearch(teamId, tech, pts);
        sumAllocated += pts;
      }
    });
    const roundData = effectiveGameState.rounds.find(r => r.roundNumber === effectiveGameState.currentRound);
    const allowedIcons = roundData?.teamData[teamId]?.researchIcons || 0;
    const prevSpent = (effectiveGameState.researchAllocatedByRound?.[effectiveGameState.currentRound] || {})[teamId] || 0;
    if (prevSpent + sumAllocated < allowedIcons) {
      mutateGameState(prev => {
        if (!prev) return prev;
        const rNum = prev.currentRound;
        const rData = prev.rounds.find(r => r.roundNumber === rNum);
        const finalAllowed = rData?.teamData[teamId]?.researchIcons ?? allowedIcons;
        return {
          ...prev,
          researchAllocatedByRound: {
            ...prev.researchAllocatedByRound,
            [rNum]: {
              ...(prev.researchAllocatedByRound?.[rNum] || {}),
              [teamId]: finalAllowed,
            },
          },
          updatedAt: new Date(),
        };
      });
    }
  }, [effectiveGameState, isV2, currentClassId, currentRole, fallbackTeams, activeClass?.themeId, mutateGameState]);

  const allocateResearch = (teamId: string, technology: string, points: number) => {
    if (!effectiveGameState) return;

    if (isV2 && currentClassId) {
      submitResearchTurn(teamId, { [technology]: points }).catch((err) =>
        console.error('Failed to allocate research v2:', err)
      );
      return;
    }

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
      const costForActingTeam = getTechnologyCostForTeamRule(prev, teamId, technology);

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

        // GPS Perk: Add +5 products immediately to current round's production plan and stamp claimed (DR-1)
        const isTechPerksActive = isRuleActiveForTeam(prev.ruleAdjustments, 'tech_permanent_benefits', teamId);
        const isGpsTech = technology.toUpperCase().includes('GPS');
        const alreadyClaimedGps = Boolean(prev.advancedState?.gpsBonusClaimed?.[teamId]);

        if (isTechPerksActive && isGpsTech && !alreadyClaimedGps) {
          const rounds = [...prev.rounds];
          const rIndex = rounds.findIndex(r => r.roundNumber === currentRound);
          if (rIndex !== -1 && rounds[rIndex].teamData[teamId]) {
            const rData = { ...rounds[rIndex] };
            const existingTeamData = rData.teamData[teamId];
            const tData: TeamRoundData = {
              ...existingTeamData,
              productsProduced: (existingTeamData.productsProduced || 0) + 5,
            };
            rData.teamData = { ...rData.teamData, [teamId]: tData };
            rounds[rIndex] = rData;
            prev.rounds = rounds;
          }

          prev.advancedState = {
            ...(prev.advancedState || {}),
            gpsBonusClaimed: {
              ...(prev.advancedState?.gpsBonusClaimed || {}),
              [teamId]: true,
            }
          };
        }
      }

      // After confirming patents (possibly newly awarded), re-evaluate completion for all teams
      const finalPatents = newPatents;
      const stateWithPatents = { ...prev, patents: finalPatents, teamResearchProgress: currentTPAll };

      prev.teams.forEach(t => {
        const tp = currentTPAll[t.id] || {
          teamId: t.id,
          technologyInvestments: {},
          completedTechnologies: [],
        };
        const invested = tp.technologyInvestments[technology] || 0;
        const cost = getTechnologyCostForTeamRule(stateWithPatents, t.id, technology);
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

      // Recalculate teamData stats in current round for all teams whose tech perks or completed technologies changed
      let updatedRounds = prev.rounds;
      const roundIndex = prev.rounds.findIndex(r => r.roundNumber === currentRound);
      if (roundIndex !== -1) {
        const roundData = prev.rounds[roundIndex];
        const updatedTeamDataMap = { ...roundData.teamData };
        let hasChanges = false;

        const tempState = {
          ...prev,
          teamResearchProgress: currentTPAll,
          patents: finalPatents,
        };

        prev.teams.forEach(t => {
          const existingTeamData = roundData.teamData[t.id];
          if (existingTeamData && existingTeamData.combination && existingTeamData.position) {
            const newStats = calculatePlanStats(
              tempState,
              t.id,
              existingTeamData.combination,
              existingTeamData.position,
              existingTeamData.cardUsages || {},
              prev.combinationsData || COMBINATIONS
            );

            const targetProducts = Math.max(existingTeamData.productsProduced || 0, newStats.productsAvailable);

            if (
              existingTeamData.productsProduced !== targetProducts ||
              existingTeamData.logisticsIcons !== newStats.logisticsPoints ||
              existingTeamData.researchIcons !== newStats.researchPoints ||
              existingTeamData.price !== newStats.calculatedPrice
            ) {
              hasChanges = true;
              updatedTeamDataMap[t.id] = {
                ...existingTeamData,
                price: newStats.calculatedPrice,
                productsProduced: targetProducts,
                researchIcons: newStats.researchPoints,
                logisticsIcons: newStats.logisticsPoints,
                improvementCards: newStats.improvementPoints,
              };
            }
          }
        });

        if (hasChanges) {
          updatedRounds = [...prev.rounds];
          updatedRounds[roundIndex] = {
            ...roundData,
            teamData: updatedTeamDataMap
          };
        }
      }

      return {
        ...prev,
        rounds: updatedRounds,
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
    return getTechnologyCostForTeamRule(effectiveGameState, teamId, technology);
  }, [effectiveGameState]);

  const calculatePlayOrder = (roundNumber: number): Team[] => {
    if (!effectiveGameState) return [];

    const roundData = effectiveGameState.rounds.find(r => r.roundNumber === roundNumber);
    if (!roundData) return effectiveGameState.teams;

    const isCurrentRound = roundNumber === effectiveGameState.currentRound;
    const isPlanningPhase =
      (effectiveGameState.currentPhase || 'planning').toLowerCase() === 'planning';
    const allTeamsSubmitted =
      effectiveGameState.teams.length > 0 &&
      effectiveGameState.teams.every(t =>
        Boolean(
          roundData.teamData[t.id] ||
            effectiveGameState.planSubmittedByRound?.[roundNumber]?.[t.id]
        )
      );
    const hideCurrentRoundPrices = isCurrentRound && (isPlanningPhase || !allTeamsSubmitted);

    const teamsWithData = effectiveGameState.teams.map(team => {
      const currentData = roundData.teamData[team.id];
      const previousScore = roundNumber > 1
        ? calculateTeamTotalScore(team.id, roundNumber - 1, effectiveGameState).totalScore
        : getInitialScore(team);

      return {
        team,
        currentPrice: hideCurrentRoundPrices ? Infinity : (currentData?.price ?? Infinity),
        previousScore,
      };
    });

    // Sort by: lowest price first, then lowest points from previous round first
    teamsWithData.sort((a, b) => {
      if (a.currentPrice !== b.currentPrice) {
        return a.currentPrice - b.currentPrice;
      }
      return a.previousScore - b.previousScore;
    });

    return teamsWithData.map(item => item.team);
  };

  const submitLogisticsTurn = useCallback(async (teamId: string, allocations: Record<string, number>) => {
    if (!effectiveGameState) return;

    if (isV2 && currentClassId) {
      const roundNumber = effectiveGameState.currentRound || 1;
      const totalSpent = Object.values(allocations).reduce((acc, v) => acc + Math.max(0, Number(v || 0)), 0);

      if (currentRole === 'STUDENT') {
        await submitStudentActionV2(
          currentClassId,
          roundNumber,
          'expansion',
          teamId,
          { allocations },
          totalSpent
        );
        return;
      }

      await mutateV2GameState(
        currentClassId,
        fallbackTeams,
        activeClass?.themeId,
        (freshState) => {
          const res = resolveLogistics(freshState, teamId, allocations);
          if (!res.valid) return freshState;
          const nextState = res.nextState;
          if (nextState.turn && nextState.turn.order[nextState.turn.index] === teamId) {
            nextState.turn = {
              ...nextState.turn,
              index: Math.min(nextState.turn.index + 1, nextState.turn.order.length),
            };
          }
          return nextState;
        }
      );
      return;
    }

    let sumAllocated = 0;
    Object.entries(allocations).forEach(([regionName, pts]) => {
      if (pts > 0) {
        allocateLogistics(teamId, regionName, pts);
        sumAllocated += pts;
      }
    });
    const roundData = effectiveGameState.rounds.find(r => r.roundNumber === effectiveGameState.currentRound);
    const allowedIcons = roundData?.teamData[teamId]?.logisticsIcons || 0;
    const prevSpent = (effectiveGameState.logisticsAllocatedByRound?.[effectiveGameState.currentRound] || {})[teamId] || 0;
    if (prevSpent + sumAllocated < allowedIcons) {
      finishLogisticsTurn(teamId);
    }
  }, [effectiveGameState, isV2, currentClassId, currentRole, fallbackTeams, activeClass?.themeId]);

  const allocateLogistics = useCallback((teamId: string, regionName: string, points: number) => {
    if (!effectiveGameState) return;

    if (isV2 && currentClassId) {
      submitLogisticsTurn(teamId, { [regionName]: points }).catch((err) =>
        console.error('Failed to allocate logistics v2:', err)
      );
      return;
    }

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
      if (!canExpandToRegionRule(prev, teamId, regionName)) {
        console.error(`Expansion into ${regionName} not allowed for team ${teamId}`);
        return prev;
      }

      const baseCost = region.logisticsCost || 2;
      const discountedCost = Math.max(1, baseCost - 1);
      const alreadyHasPresence = region.teamsPresent.includes(teamId) || ((region.officeCounts?.[teamId] || 0) > 0);
      const currentOffices = region.officeCounts?.[teamId] || (alreadyHasPresence ? 1 : 0);

      const rawCurrentInvestment = teamProgress.regionInvestments[regionName] || region.teamProgress?.[teamId] || 0;
      const effectiveCurrentInvestment = Math.max(rawCurrentInvestment, alreadyHasPresence ? baseCost : 0);
      const newInvestment = effectiveCurrentInvestment + points;

      const updatedRegionProgress = {
        ...region.teamProgress,
        [teamId]: newInvestment
      };

      const isMultiOfficeActive = isRuleActiveForTeam(prev.ruleAdjustments, 'multiple_offices_per_region', teamId);

      let officesEarnedRaw = 0;
      if (isMultiOfficeActive) {
        if (newInvestment >= baseCost) {
          const extraInvest = newInvestment - baseCost;
          officesEarnedRaw = 1 + Math.floor(extraInvest / discountedCost);
        } else {
          officesEarnedRaw = 0;
        }
      } else {
        officesEarnedRaw = Math.floor(newInvestment / baseCost);
      }

      let updatedOfficeCount: number;
      if (isMultiOfficeActive) {
        // Slots occupied by OTHER teams (completed + in-progress building) in this region
        const baseCostForClamp = region.logisticsCost || 2;
        let otherOccupancy = 0;
        const otherTeamIds = new Set<string>([
          ...Object.keys(region.officeCounts || {}),
          ...Object.keys(region.teamProgress || {}),
          ...(region.teamsPresent || []),
        ]);
        otherTeamIds.forEach(tid => {
          if (tid === teamId) return;
          const completedOther = getCompletedOffices(region, tid);
          const buildingOther = isTeamBuildingOffice(region, tid, baseCostForClamp) ? 1 : 0;
          otherOccupancy += completedOther + buildingOther;
        });
        const maxForThisTeam = Math.max(0, region.maxTeams - otherOccupancy);
        // Never exceed available slots; never drop below what the team already holds.
        updatedOfficeCount = Math.min(Math.max(currentOffices, officesEarnedRaw), maxForThisTeam);
      } else {
        // Rule OFF: presence is boolean — at most one office, no multi-office tracking.
        updatedOfficeCount = officesEarnedRaw >= 1 ? 1 : currentOffices;
      }

      const hasPresence = updatedOfficeCount >= 1;

      const updatedRegion = {
        ...region,
        teamProgress: updatedRegionProgress,
        officeCounts: {
          ...(region.officeCounts || {}),
          [teamId]: updatedOfficeCount
        },
        teamsPresent: (hasPresence && !alreadyHasPresence)
          ? [...region.teamsPresent, teamId]
          : region.teamsPresent
      };

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
      };
    });
  }, [effectiveGameState]);

  const finishLogisticsTurn = useCallback((teamId: string) => {
    if (!effectiveGameState) return;

    if (isV2 && currentClassId) {
      submitLogisticsTurn(teamId, {}).catch((err) =>
        console.error('Failed to finish logistics turn v2:', err)
      );
      return;
    }

    mutateGameState(prev => {
      if (!prev) return prev;

      const currentRound = prev.currentRound;
      const roundData = prev.rounds.find(r => r.roundNumber === currentRound);
      const teamRoundData = roundData?.teamData[teamId];
      const allowedIcons = teamRoundData?.logisticsIcons || 0;

      const roundAllocations = { ...(prev.logisticsAllocatedByRound[currentRound] || {}) };
      roundAllocations[teamId] = allowedIcons;

      return {
        ...prev,
        logisticsAllocatedByRound: {
          ...prev.logisticsAllocatedByRound,
          [currentRound]: roundAllocations,
        },
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
    return canExpandToRegionRule(effectiveGameState, teamId, regionName);
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

    return getRegionOccupancy(effectiveGameState, regionName) >= region.maxTeams;
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

  const getRuleAdjustments = useCallback((): RuleAdjustmentsState => {
    if (effectiveGameState?.ruleAdjustments) {
      return effectiveGameState.ruleAdjustments;
    }
    return getDefaultRuleAdjustments();
  }, [effectiveGameState]);

  const updateRuleAdjustments = useCallback((rulesState: RuleAdjustmentsState | null) => {
    if (!effectiveGameState) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      const newState = { ...prev };
      if (rulesState) {
        newState.ruleAdjustments = {
          ...rulesState,
          lastUpdated: new Date().toISOString(),
        };
        const isSteveActive = isRuleActiveForTeam(newState.ruleAdjustments, 'steve_event_blocker');
        if (!isSteveActive && newState.advancedState?.steve?.activeRegion) {
          newState.advancedState = {
            ...newState.advancedState,
            steve: {
              ...newState.advancedState.steve,
              activeRegion: null,
            }
          };
        }
      } else {
        delete newState.ruleAdjustments;
      }
      return newState;
    });
  }, [effectiveGameState]);

  const allocateDirective = useCallback((teamId: string, directiveId: string) => {
    if (!effectiveGameState) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      if (!isRuleActiveForTeam(prev.ruleAdjustments, 'directives_bonus_points', teamId)) {
        return prev;
      }
      const pointsVal = Number(getRuleValueForTeam(prev.ruleAdjustments, 'directives_bonus_points', teamId, 12));
      const currentAdvanced = prev.advancedState || {};
      const claimedList = currentAdvanced.directives || [];

      if (claimedList.some(d => d.id === directiveId)) return prev;
      if (claimedList.some(d => d.teamId === teamId && d.roundNumber === prev.currentRound)) return prev;

      const newClaim = {
        id: directiveId,
        teamId,
        roundNumber: prev.currentRound,
        points: pointsVal,
        claimedAt: new Date().toISOString(),
      };

      return {
        ...prev,
        advancedState: {
          ...currentAdvanced,
          directives: [...claimedList, newClaim],
        },
        updatedAt: new Date(),
      };
    });
  }, [effectiveGameState]);

  const revokeDirective = useCallback((directiveId: string) => {
    if (!effectiveGameState) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      const currentAdvanced = prev.advancedState || {};
      const claimedList = currentAdvanced.directives || [];
      return {
        ...prev,
        advancedState: {
          ...currentAdvanced,
          directives: claimedList.filter(d => d.id !== directiveId),
        },
        updatedAt: new Date(),
      };
    });
  }, [effectiveGameState]);

  const moveSteve = useCallback((regionName: string | null) => {
    if (!effectiveGameState) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      const currentAdvanced = prev.advancedState || {};
      return {
        ...prev,
        advancedState: {
          ...currentAdvanced,
          steve: {
            activeRegion: regionName,
            roundIntroduced: prev.currentRound,
            wildcardsContributed: {},
            wildcardsContributedByRound: {},
          },
        },
        updatedAt: new Date(),
      };
    });
  }, [effectiveGameState]);

  const contributeWildcardsToSteve = useCallback((teamId: string, delta: number = 1) => {
    if (!effectiveGameState) return;
    if (!isRuleActiveForTeam(effectiveGameState.ruleAdjustments, 'wildcard_tokens_system', teamId)) return;

    const currentRound = effectiveGameState.currentRound || 1;
    const currentAdvanced = effectiveGameState.advancedState || {};
    const steve = currentAdvanced.steve || { activeRegion: null, wildcardsContributed: {}, wildcardsContributedByRound: {} };
    const wildcardsMap = { ...(currentAdvanced.wildcards || {}) };
    const tWildcard = wildcardsMap[teamId] || { teamId, totalTokens: 10, usedInRound: {}, conversionsByRound: {} };

    const usedInR = { ...(tWildcard.usedInRound || {}) };
    const totalUsed = Object.values(usedInR).reduce((a, b) => Number(a) + Number(b), 0);
    const remaining = Math.max(0, (tWildcard.totalTokens || 10) - totalUsed);

    const steveContribs = { ...(steve.wildcardsContributed || {}) };
    const currentTotalSteve = Object.values(steveContribs).reduce((a, b) => Number(a) + Number(b), 0);
    const newTotalSteve = currentTotalSteve + delta;

    // Joint total unblocking cap across all teams is 5
    if (newTotalSteve < 0 || newTotalSteve > 5) return;

    const currentTeamSteve = steveContribs[teamId] || 0;
    const newTeamSteve = currentTeamSteve + delta;
    if (newTeamSteve < 0) return;
    if (delta > 0 && remaining < delta) return;

    const convsByR = { ...(tWildcard.conversionsByRound || {}) };
    const rConvs = { ...(convsByR[currentRound] || {}) };
    const roundConvsTotal = Object.values(rConvs).reduce((a, b) => Number(a) + Number(b), 0);

    const steveByRoundMap = { ...(steve.wildcardsContributedByRound || {}) };
    const roundSteveMap = { ...(steveByRoundMap[currentRound] || {}) };
    const currentSteveInRound = roundSteveMap[teamId] || 0;
    const newSteveInRound = currentSteveInRound + delta;
    if (newSteveInRound < 0) return;

    steveContribs[teamId] = newTeamSteve;
    roundSteveMap[teamId] = newSteveInRound;
    steveByRoundMap[currentRound] = roundSteveMap;

    const roundUsedTotal = roundConvsTotal + newSteveInRound;
    usedInR[currentRound] = roundUsedTotal;
    const newTeamWildcard = { ...tWildcard, usedInRound: usedInR };

    const newSteve = {
      ...steve,
      activeRegion: steve.activeRegion,
      wildcardsContributed: steveContribs,
      wildcardsContributedByRound: steveByRoundMap,
    };

    // 1. Instant optimistic local update
    setOptimisticAdvancedState(prevOpt => {
      const baseAdv = prevOpt || currentAdvanced;
      return {
        ...baseAdv,
        wildcards: {
          ...(baseAdv.wildcards || {}),
          [teamId]: newTeamWildcard,
        },
        steve: newSteve,
      };
    });

    // 2. Dispatch to backend
    if (isV2 && currentClassId && currentRole === 'STUDENT') {
      submitStudentActionV2(
        currentClassId,
        currentRound,
        'wildcard',
        teamId,
        { wildcardConversions: rConvs, steveContribution: newSteveInRound },
        roundUsedTotal
      ).catch((err) => {
        console.error('Failed to submit student wildcard steve action v2:', err);
        setOptimisticAdvancedState(null);
      });
      return;
    }

    mutateGameState(prev => {
      if (!prev) return prev;
      if (!isRuleActiveForTeam(prev.ruleAdjustments, 'wildcard_tokens_system', teamId)) return prev;
      const prevAdv = prev.advancedState || {};
      const prevSteve = prevAdv.steve || { activeRegion: null, wildcardsContributed: {}, wildcardsContributedByRound: {} };
      const prevWcMap = { ...(prevAdv.wildcards || {}) };
      const prevTWc = prevWcMap[teamId] || { teamId, totalTokens: 10, usedInRound: {}, conversionsByRound: {} };

      const prevUsedInR = { ...(prevTWc.usedInRound || {}) };
      const prevTotalUsed = Object.values(prevUsedInR).reduce((a, b) => Number(a) + Number(b), 0);
      const prevRem = Math.max(0, (prevTWc.totalTokens || 10) - prevTotalUsed);

      const prevSteveContribs = { ...(prevSteve.wildcardsContributed || {}) };
      const prevCurrTot = Object.values(prevSteveContribs).reduce((a, b) => Number(a) + Number(b), 0);
      const prevNewTot = prevCurrTot + delta;
      if (prevNewTot < 0 || prevNewTot > 5) return prev;

      const prevTeamSt = prevSteveContribs[teamId] || 0;
      const prevNewTeamSt = prevTeamSt + delta;
      if (prevNewTeamSt < 0) return prev;
      if (delta > 0 && prevRem < delta) return prev;

      const prevConvsByR = { ...(prevTWc.conversionsByRound || {}) };
      const prevRConvs = { ...(prevConvsByR[currentRound] || {}) };
      const prevRoundConvsTotal = Object.values(prevRConvs).reduce((a, b) => Number(a) + Number(b), 0);

      const prevSteveByRoundMap = { ...(prevSteve.wildcardsContributedByRound || {}) };
      const prevRoundSteveMap = { ...(prevSteveByRoundMap[currentRound] || {}) };
      const prevCurrSteveInR = prevRoundSteveMap[teamId] || 0;
      const prevNewSteveInR = prevCurrSteveInR + delta;
      if (prevNewSteveInR < 0) return prev;

      prevSteveContribs[teamId] = prevNewTeamSt;
      prevRoundSteveMap[teamId] = prevNewSteveInR;
      prevSteveByRoundMap[currentRound] = prevRoundSteveMap;

      const prevRoundUsedTotal = prevRoundConvsTotal + prevNewSteveInR;
      prevUsedInR[currentRound] = prevRoundUsedTotal;
      prevWcMap[teamId] = { ...prevTWc, usedInRound: prevUsedInR };

      return {
        ...prev,
        advancedState: {
          ...prevAdv,
          wildcards: prevWcMap,
          steve: {
            ...prevSteve,
            activeRegion: prevSteve.activeRegion,
            wildcardsContributed: prevSteveContribs,
            wildcardsContributedByRound: prevSteveByRoundMap,
          },
        },
        updatedAt: new Date(),
      };
    });
  }, [effectiveGameState, isV2, currentClassId, currentRole, mutateGameState]);

  const adjustTeamWildcardTotal = useCallback((teamId: string, delta: number) => {
    if (!effectiveGameState || !teamId) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      const currentAdvanced = prev.advancedState || {};
      const wildcardsMap = { ...(currentAdvanced.wildcards || {}) };
      const tWildcard = wildcardsMap[teamId] || { teamId, totalTokens: 10, usedInRound: {}, conversionsByRound: {} };
      
      const newTotal = Math.max(0, (tWildcard.totalTokens || 10) + delta);
      wildcardsMap[teamId] = {
        ...tWildcard,
        totalTokens: newTotal
      };

      return {
        ...prev,
        advancedState: {
          ...currentAdvanced,
          wildcards: wildcardsMap
        },
        updatedAt: new Date()
      };
    });
  }, [effectiveGameState]);

  const transferWildcardTokens = useCallback((fromTeamId: string, toTeamId: string, amount: number) => {
    if (!effectiveGameState || !fromTeamId || !toTeamId || amount <= 0 || fromTeamId === toTeamId) return;
    mutateGameState(prev => {
      if (!prev) return prev;
      const currentAdvanced = prev.advancedState || {};
      const wildcardsMap = { ...(currentAdvanced.wildcards || {}) };

      const fromWc = wildcardsMap[fromTeamId] || { teamId: fromTeamId, totalTokens: 10, usedInRound: {}, conversionsByRound: {} };
      const toWc = wildcardsMap[toTeamId] || { teamId: toTeamId, totalTokens: 10, usedInRound: {}, conversionsByRound: {} };

      const fromUsed = Object.values(fromWc.usedInRound || {}).reduce((a: number, b: any) => a + Number(b || 0), 0);
      const fromRemaining = Math.max(0, (fromWc.totalTokens || 10) - fromUsed);

      if (amount > fromRemaining) return prev;

      wildcardsMap[fromTeamId] = {
        ...fromWc,
        totalTokens: Math.max(0, (fromWc.totalTokens || 10) - amount)
      };

      wildcardsMap[toTeamId] = {
        ...toWc,
        totalTokens: (toWc.totalTokens || 10) + amount
      };

      return {
        ...prev,
        advancedState: {
          ...currentAdvanced,
          wildcards: wildcardsMap
        },
        updatedAt: new Date()
      };
    });
  }, [effectiveGameState]);

  const allocateWildcardToken = useCallback((
    teamId: string,
    conversionType: 'product' | 'research' | 'logistics' | 'improvement',
    delta: number = 1
  ) => {
    if (!effectiveGameState) return;
    if (!isRuleActiveForTeam(effectiveGameState.ruleAdjustments, 'wildcard_tokens_system', teamId)) return;

    const currentRound = effectiveGameState.currentRound || 1;
    const currentAdvanced = effectiveGameState.advancedState || {};
    const wildcardsMap = { ...(currentAdvanced.wildcards || {}) };
    const tWildcard = wildcardsMap[teamId] || { teamId, totalTokens: 10, usedInRound: {}, conversionsByRound: {} };

    const usedInR = { ...(tWildcard.usedInRound || {}) };
    const totalUsed = Object.values(usedInR).reduce((a, b) => Number(a) + Number(b), 0);

    const convsByR = { ...(tWildcard.conversionsByRound || {}) };
    const rConvs = { ...(convsByR[currentRound] || {}) };
    const currentPhaseVal = rConvs[conversionType] || 0;

    // Per-action cap: up to 2 for product/research/logistics, up to 1 for improvement
    const maxForAction = conversionType === 'improvement' ? 1 : 2;
    const newPhaseVal = currentPhaseVal + delta;
    if (newPhaseVal < 0 || newPhaseVal > maxForAction) return;

    if (delta > 0 && totalUsed + delta > (tWildcard.totalTokens || 10)) return;

    rConvs[conversionType] = newPhaseVal;
    convsByR[currentRound] = rConvs;

    const roundConvsTotal = Object.values(rConvs).reduce((a, b) => Number(a) + Number(b), 0);
    const steveInRound = (effectiveGameState.advancedState?.steve?.wildcardsContributedByRound?.[currentRound]?.[teamId]) || 0;
    const roundUsedTotal = roundConvsTotal + steveInRound;

    usedInR[currentRound] = roundUsedTotal;

    const newTeamWildcard = {
      ...tWildcard,
      usedInRound: usedInR,
      conversionsByRound: convsByR,
    };

    // 1. Instant optimistic local update: updates React state in 0ms!
    setOptimisticAdvancedState(prevOpt => {
      const baseAdv = prevOpt || currentAdvanced;
      const nextWildcards = {
        ...(baseAdv.wildcards || {}),
        [teamId]: newTeamWildcard,
      };
      return {
        ...baseAdv,
        wildcards: nextWildcards,
      };
    });

    // 2. Dispatch to backend
    if (isV2 && currentClassId && currentRole === 'STUDENT') {
      submitStudentActionV2(
        currentClassId,
        currentRound,
        'wildcard',
        teamId,
        { wildcardConversions: rConvs, steveContribution: steveInRound },
        roundUsedTotal
      ).catch((err) => {
        console.error('Failed to submit student wildcard convert action v2:', err);
        setOptimisticAdvancedState(null);
      });
      return;
    }

    mutateGameState(prev => {
      if (!prev) return prev;
      if (!isRuleActiveForTeam(prev.ruleAdjustments, 'wildcard_tokens_system', teamId)) return prev;
      const prevAdv = prev.advancedState || {};
      const prevWcMap = { ...(prevAdv.wildcards || {}) };
      const prevTWc = prevWcMap[teamId] || { teamId, totalTokens: 10, usedInRound: {}, conversionsByRound: {} };

      const prevUsedInR = { ...(prevTWc.usedInRound || {}) };
      const prevTotalUsed = Object.values(prevUsedInR).reduce((a, b) => Number(a) + Number(b), 0);

      const prevConvsByR = { ...(prevTWc.conversionsByRound || {}) };
      const prevRConvs = { ...(prevConvsByR[currentRound] || {}) };
      const prevVal = prevRConvs[conversionType] || 0;

      const pNewVal = prevVal + delta;
      if (pNewVal < 0 || pNewVal > maxForAction) return prev;
      if (delta > 0 && prevTotalUsed + delta > (prevTWc.totalTokens || 10)) return prev;

      prevRConvs[conversionType] = pNewVal;
      prevConvsByR[currentRound] = prevRConvs;

      const pConvsTotal = Object.values(prevRConvs).reduce((a, b) => Number(a) + Number(b), 0);
      const pSteveInR = (prevAdv.steve?.wildcardsContributedByRound?.[currentRound]?.[teamId]) || 0;
      prevUsedInR[currentRound] = pConvsTotal + pSteveInR;

      prevWcMap[teamId] = {
        ...prevTWc,
        usedInRound: prevUsedInR,
        conversionsByRound: prevConvsByR,
      };

      const updatedAdvanced = {
        ...prevAdv,
        wildcards: prevWcMap,
      };

      let updatedRounds = prev.rounds;
      const roundIndex = prev.rounds.findIndex(r => r.roundNumber === currentRound);
      if (roundIndex !== -1 && prev.rounds[roundIndex].teamData?.[teamId]) {
        const roundData = prev.rounds[roundIndex];
        const existingTeamData = roundData.teamData[teamId];
        if (existingTeamData.combination && existingTeamData.position) {
          const tempState = { ...prev, advancedState: updatedAdvanced };
          const newStats = calculatePlanStats(
            tempState,
            teamId,
            existingTeamData.combination,
            existingTeamData.position,
            existingTeamData.cardUsages || {},
            prev.combinationsData || COMBINATIONS
          );

          const targetProducts = Math.max(existingTeamData.productsProduced || 0, newStats.productsAvailable);

          updatedRounds = [...prev.rounds];
          updatedRounds[roundIndex] = {
            ...roundData,
            teamData: {
              ...roundData.teamData,
              [teamId]: {
                ...existingTeamData,
                price: newStats.calculatedPrice,
                productsProduced: targetProducts,
                researchIcons: newStats.researchPoints,
                logisticsIcons: newStats.logisticsPoints,
                improvementCards: newStats.improvementPoints,
              }
            }
          };
        }
      }

      return {
        ...prev,
        rounds: updatedRounds,
        advancedState: updatedAdvanced,
        updatedAt: new Date(),
      };
    });
  }, [effectiveGameState, isV2, currentClassId, currentRole, mutateGameState]);

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
          if (isSteveBlocking(prev, region)) return;

          const regionData = REGION_CUSTOMERS.find(r => r.region === region);
          if (!regionData) return;

          const teamSales: Array<{ teamId: string; salesCount: number; leftmostPosition: number }> = [];

          prev.teams.forEach(team => {
            const teamData = round.teamData[team.id];
            if (!teamData || !teamData.customersSold || teamData.customersSold.length === 0) return;

            const regionLogisticsData = prev.regionLogistics[region];
            const teamsPresent = regionLogisticsData?.teamsPresent || [];
            const hasOfficeInRegion = (teamsPresent.includes(team.id)) || ((regionLogisticsData?.officeCounts?.[team.id] || 0) > 0);
            if (!hasOfficeInRegion) return;

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
          const isMultiOfficeActive = isRuleActiveForTeam(prev.ruleAdjustments, 'multiple_offices_per_region');
          const totalOffices = Object.values(regionLogisticsData?.officeCounts || {}).reduce((a, b) => a + Number(b), 0);
          const occupiedSlots = isMultiOfficeActive
            ? (totalOffices || regionLogisticsData?.teamsPresent.length || 0)
            : (regionLogisticsData?.teamsPresent.length || 0);
          const scaleCount = Math.min(5, Math.max(1, occupiedSlots));

          if (teamSales.length > 0) {
            const firstTeamId = teamSales[0].teamId;
            const firstPoints = getControlPointsForRegion(region, scaleCount, 'first');
            teamControlPoints[firstTeamId][region] = firstPoints;
            teamControlTotals[firstTeamId] += firstPoints;
          }

          if (teamSales.length > 1) {
            const secondTeamId = teamSales[1].teamId;
            const secondPoints = getControlPointsForRegion(region, scaleCount, 'second');
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

  const skipTurn = useCallback(async () => {
    if (!isV2 || !currentClassId) return;
    if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') return;
    await skipTurnV2(currentClassId, fallbackTeams, activeClass?.themeId);
  }, [isV2, currentClassId, currentRole, fallbackTeams, activeClass?.themeId]);

  const reopenTeamAction = useCallback(async (phase: string, teamId: string) => {
    if (!isV2 || !currentClassId || !effectiveGameState) return;
    if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') return;
    await reopenTeamActionV2(currentClassId, effectiveGameState.currentRound || 1, phase, teamId);
  }, [isV2, currentClassId, effectiveGameState, currentRole]);

  const rejectTeamAction = useCallback(async (phase: string, teamId: string, reason: string) => {
    if (!isV2 || !currentClassId || !effectiveGameState) return;
    if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') return;
    const round = effectiveGameState.currentRound || 1;
    const normPhase = normalizePhaseName(phase);
    const actionId = `${round}_${normPhase}_${teamId}`;
    await rejectTeamActionV2(currentClassId, actionId, reason);
  }, [isV2, currentClassId, effectiveGameState, currentRole]);

  return (
    <GameContext.Provider
      value={{
        gameState: activeGameState,
        isLoaded: activeIsLoaded,
        actionsMap: isV2 ? v2Assembled.actionsMap : {},
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
        updateTeamLabelMode,
        claimImprovementCard,
        unclaimImprovementCard,
        setBotThinking,
        markImprovementCardUsed,
        clearNonInitialCards,
        previewNextRoundCards,
        allocateResearch,
        submitResearchTurn,
        getTeamResearchProgress,
        getTechnologyCostForTeam,
        calculatePlayOrder,
        allocateLogistics,
        finishLogisticsTurn,
        submitLogisticsTurn,
        getTeamLogisticsProgress,
        canExpandToRegion,
        getAvailableRegionsForTeam,
        isRegionFull,
        getCombinations,
        updateCombinations,
        getRuleAdjustments,
        updateRuleAdjustments,
        allocateDirective,
        revokeDirective,
        moveSteve,
        contributeWildcardsToSteve,
        adjustTeamWildcardTotal,
        transferWildcardTokens,
        allocateWildcardToken,
        recalculateControlPoints,
        endGame,
        skipTurn,
        reopenTeamAction,
        rejectTeamAction,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
