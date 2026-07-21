import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { GameSetup } from '@/components/GameSetup';
import { Dashboard } from '@/components/Dashboard';
import { Team } from '@/types/game';

const IndexContent = () => {
  const { gameState, initializeGame } = useGame();
  const { currentClassId } = useSession();

  const handleStartGame = (teams: Team[]) => {
    initializeGame(teams);
  };

  if (!gameState) {
    if (currentClassId) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm font-medium text-slate-400">Loading session game state...</p>
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
