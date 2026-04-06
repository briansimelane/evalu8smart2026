import { useState } from 'react';
import { GameProvider, useGame } from '@/contexts/GameContext';
import { GameSetup } from '@/components/GameSetup';
import { Dashboard } from '@/components/Dashboard';
import { Team } from '@/types/game';

const IndexContent = () => {
  const { gameState, initializeGame } = useGame();

  const handleStartGame = (teams: Team[]) => {
    initializeGame(teams);
  };

  if (!gameState) {
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
