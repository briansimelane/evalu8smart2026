import React, { createContext, useContext, ReactNode } from 'react';
import { useBoardMotion, MotionState } from './useBoardMotion';
import type { GameState } from '@/types/game';

const MotionContext = createContext<MotionState | undefined>(undefined);

export function useMotion(): MotionState {
  const context = useContext(MotionContext);
  if (!context) {
    throw new Error('useMotion must be used within a MotionProvider');
  }
  return context;
}

export function useOptionalMotion(): MotionState | undefined {
  return useContext(MotionContext);
}

interface MotionProviderProps {
  gameState: GameState | null;
  children: ReactNode;
}

export function MotionProvider({ gameState, children }: MotionProviderProps) {
  const motionState = useBoardMotion(gameState);
  return (
    <MotionContext.Provider value={motionState}>
      {children}
    </MotionContext.Provider>
  );
}
