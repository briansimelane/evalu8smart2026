import React, { useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { GameSetup } from '@/components/GameSetup';
import { Dashboard } from '@/components/Dashboard';
import { Team } from '@/types/game';

const IndexContent = () => {
  const { gameState, isLoaded, initializeGame } = useGame();
  const { currentClassId, isAuthReady, logout } = useSession();

  const handleStartGame = (teams: Team[]) => {
    initializeGame(teams);
  };

  // If auth and Firestore listeners have finished loading and no game state exists for
  // the stored classId (e.g., a stale localStorage session or unauthenticated browser),
  // automatically return to /login after a brief grace period.
  useEffect(() => {
    if (!currentClassId || gameState || !isAuthReady || !isLoaded) return;
    const timer = setTimeout(() => {
      logout();
      window.location.href = '/login';
    }, 3500);
    return () => clearTimeout(timer);
  }, [currentClassId, gameState, isAuthReady, isLoaded, logout]);

  if (!gameState) {
    if (currentClassId) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm font-medium text-slate-400">Loading session game state...</p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  logout();
                  window.location.href = '/login';
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
              >
                Switch Session / Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <GameSetup onStartGame={handleStartGame} />;
  }

  return <Dashboard />;
};

const Index = () => {
  return (
    <IndexContent />
  );
};

export default Index;
