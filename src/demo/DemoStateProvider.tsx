import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GameState, Team, BotProfile, BotDifficulty } from '@/types/game';
import { ensureDemoUid } from './demoAuth';
import { buildInitialGameState } from '@/lib/initialGameState';
import { removeUndefined } from '@/lib/utils';
import { maskGameStateForDemo } from './demoVisibility';
import { toast } from 'sonner';

export interface DemoBotSetup {
  name: string;
  color: string;
  botProfile: BotProfile;
  botDifficulty: BotDifficulty;
}

export interface DemoConfig {
  humanTeamName: string;
  humanTeamColor: string;
  bots: DemoBotSetup[];
}

interface DemoStateContextType {
  demoGameState: GameState | null;
  maskedDemoState: GameState | null;
  demoId: string | null;
  humanTeamId: string;
  isLoaded: boolean;
  isReadOnlyTab: boolean;
  isRevealed: boolean;
  startDemo: (config: DemoConfig) => Promise<void>;
  resetDemo: () => Promise<void>;
  setDemoGameState: (updater: GameState | null | ((prev: GameState | null) => GameState | null)) => void;
  revealAllScores: () => void;
}

const DemoStateContext = createContext<DemoStateContextType | null>(null);

export function useDemoState() {
  const context = useContext(DemoStateContext);
  if (!context) {
    throw new Error('useDemoState must be used within DemoStateProvider');
  }
  return context;
}

const TAB_CLIENT_ID = Math.random().toString(36).substring(2, 9);
const HUMAN_TEAM_ID = 'team_1';
const EXPIRY_DAYS = 7;

function toValidDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function DemoStateProvider({ children }: { children: ReactNode }) {
  const [demoGameState, setRawDemoGameState] = useState<GameState | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isReadOnlyTab, setIsReadOnlyTab] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestStateRef = useRef<GameState | null>(null);
  const latestDemoIdRef = useRef<string | null>(null);

  latestStateRef.current = demoGameState;
  latestDemoIdRef.current = demoId;

  // Hydrate on mount
  useEffect(() => {
    let isMounted = true;

    async function hydrateDemo() {
      const storedDemoId = localStorage.getItem('evalu8_demo_id');
      if (!storedDemoId) {
        if (isMounted) setIsLoaded(true);
        return;
      }

      try {
        const uid = await ensureDemoUid();
        const docRef = doc(db, 'demo_games', storedDemoId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();
          // Check multi-tab activeClientId
          if (data.activeClientId && data.activeClientId !== TAB_CLIENT_ID) {
            // Check if document belongs to this owner
            if (data.ownerUid && data.ownerUid !== uid) {
              console.warn("Demo game belongs to another user/expired");
              localStorage.removeItem('evalu8_demo_id');
              if (isMounted) setIsLoaded(true);
              return;
            }
          }

          if (data.gameState) {
            const loadedState = data.gameState as GameState;
            loadedState.createdAt = toValidDate(loadedState.createdAt) as any;
            loadedState.updatedAt = toValidDate(loadedState.updatedAt) as any;

            if (isMounted) {
              setDemoId(storedDemoId);
              setRawDemoGameState(loadedState);
              setIsLoaded(true);
            }
            return;
          }
        }

        // Expired or missing
        toast.info("Your previous demo has expired — starting a new one.");
        localStorage.removeItem('evalu8_demo_id');
        localStorage.removeItem('evalu8_demo_state_mirror');
      } catch (err) {
        console.error("Failed to load demo from Firestore:", err);
        // Offline fallback to localStorage mirror
        const mirror = localStorage.getItem('evalu8_demo_state_mirror');
        if (mirror) {
          try {
            const parsed = JSON.parse(mirror);
            if (isMounted) {
              setDemoId(storedDemoId);
              setRawDemoGameState(parsed);
            }
          } catch (_) {}
        }
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }

    hydrateDemo();
  }, []);

  // Persist helper (debounced)
  const persistStateNow = useCallback(async (state: GameState, currentDemoId: string) => {
    if (!state || !currentDemoId || isReadOnlyTab) return;
    try {
      const uid = await ensureDemoUid();
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + EXPIRY_DAYS * 864e5));

      const safeState = { ...state };
      safeState.createdAt = toValidDate(safeState.createdAt).toISOString() as any;
      safeState.updatedAt = new Date().toISOString() as any;

      // LocalStorage mirror
      try {
        localStorage.setItem('evalu8_demo_state_mirror', JSON.stringify(safeState));
      } catch (_) {}

      const docRef = doc(db, 'demo_games', currentDemoId);
      await setDoc(docRef, removeUndefined({
        demoId: currentDemoId,
        ownerUid: uid,
        humanTeamId: HUMAN_TEAM_ID,
        activeClientId: TAB_CLIENT_ID,
        gameState: safeState,
        createdAt: Timestamp.fromDate(toValidDate(state.createdAt)),
        updatedAt: Timestamp.now(),
        expiresAt,
      }));
    } catch (err) {
      console.warn("Failed to persist demo_games to Firestore:", err);
    }
  }, [isReadOnlyTab]);

  // Flush on visibilitychange / pagehide
  useEffect(() => {
    const handleFlush = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (latestStateRef.current && latestDemoIdRef.current) {
        persistStateNow(latestStateRef.current, latestDemoIdRef.current);
      }
    };

    window.addEventListener('visibilitychange', handleFlush);
    window.addEventListener('pagehide', handleFlush);
    return () => {
      window.removeEventListener('visibilitychange', handleFlush);
      window.removeEventListener('pagehide', handleFlush);
    };
  }, [persistStateNow]);

  const setDemoGameState = useCallback((updater: GameState | null | ((prev: GameState | null) => GameState | null)) => {
    setRawDemoGameState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next && latestDemoIdRef.current && !isReadOnlyTab) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        const curDemoId = latestDemoIdRef.current;
        debounceTimerRef.current = setTimeout(() => {
          persistStateNow(next, curDemoId);
        }, 2000);
      }
      return next;
    });
  }, [isReadOnlyTab, persistStateNow]);

  const startDemo = useCallback(async (config: DemoConfig) => {
    const newDemoId = `demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const uid = await ensureDemoUid();

    const humanTeam: Team = {
      id: HUMAN_TEAM_ID,
      name: config.humanTeamName || 'Your Company',
      color: config.humanTeamColor || '#10b981',
      isBot: false,
    };

    const botTeams: Team[] = config.bots.map((b, idx) => ({
      id: `team_${idx + 2}`,
      name: b.name,
      color: b.color,
      isBot: true,
      botProfile: b.botProfile,
      botDifficulty: b.botDifficulty,
    }));

    const allTeams = [humanTeam, ...botTeams];
    const initialState = buildInitialGameState(allTeams);

    localStorage.setItem('evalu8_demo_id', newDemoId);
    setDemoId(newDemoId);
    setIsRevealed(false);
    setIsReadOnlyTab(false);
    setRawDemoGameState(initialState);

    // Initial immediate persist
    await persistStateNow(initialState, newDemoId);
  }, [persistStateNow]);

  const resetDemo = useCallback(async () => {
    if (demoId) {
      try {
        await deleteDoc(doc(db, 'demo_games', demoId));
      } catch (_) {}
    }
    localStorage.removeItem('evalu8_demo_id');
    localStorage.removeItem('evalu8_demo_state_mirror');
    setDemoId(null);
    setRawDemoGameState(null);
    setIsRevealed(false);
    setIsReadOnlyTab(false);
  }, [demoId]);

  const revealAllScores = useCallback(() => {
    setIsRevealed(true);
  }, []);

  const maskedDemoState = useMemo(() => {
    return maskGameStateForDemo(demoGameState, HUMAN_TEAM_ID, { revealAll: isRevealed, isDemo: true });
  }, [demoGameState, isRevealed]);

  return (
    <DemoStateContext.Provider
      value={{
        demoGameState,
        maskedDemoState,
        demoId,
        humanTeamId: HUMAN_TEAM_ID,
        isLoaded,
        isReadOnlyTab,
        isRevealed,
        startDemo,
        resetDemo,
        setDemoGameState,
        revealAllScores,
      }}
    >
      {children}
    </DemoStateContext.Provider>
  );
}
