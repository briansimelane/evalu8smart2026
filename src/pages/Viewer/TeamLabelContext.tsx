import React, { createContext, useContext } from 'react';
import { WorldKey } from '@/types/multiworld';
import { Team } from '@/types/game';
import { getTeamDisplayLabel, getTeamCode, getTeamCompactCode } from '@/lib/multiworld/teamLabel';

interface TeamLabelContextType {
  labelMode: 'name' | 'code';
  worldKey?: WorldKey;
  formatTeamLabel: (team: Team | null | undefined, indexHint?: number) => string;
  formatTeamCode: (team: Team | null | undefined, indexHint?: number) => string;
  formatTeamCompactCode: (team: Team | null | undefined, indexHint?: number) => string;
}

const TeamLabelContext = createContext<TeamLabelContextType>({
  labelMode: 'name',
  formatTeamLabel: (team, indexHint) => team?.name || `Team ${(indexHint || 0) + 1}`,
  formatTeamCode: (team, indexHint) => getTeamCode(team, undefined, indexHint),
  formatTeamCompactCode: (team, indexHint) => getTeamCompactCode(team, undefined, indexHint),
});

export const useTeamLabel = () => useContext(TeamLabelContext);

interface TeamLabelProviderProps {
  labelMode?: 'name' | 'code';
  worldKey?: WorldKey;
  children: React.ReactNode;
}

export const TeamLabelProvider: React.FC<TeamLabelProviderProps> = ({
  labelMode = 'name',
  worldKey,
  children
}) => {
  const formatTeamLabel = (team: Team | null | undefined, indexHint?: number) => {
    return getTeamDisplayLabel(team, worldKey, labelMode, indexHint);
  };

  const formatTeamCode = (team: Team | null | undefined, indexHint?: number) => {
    return getTeamCode(team, worldKey, indexHint);
  };

  const formatTeamCompactCode = (team: Team | null | undefined, indexHint?: number) => {
    return getTeamCompactCode(team, worldKey, indexHint);
  };

  return (
    <TeamLabelContext.Provider
      value={{
        labelMode,
        worldKey,
        formatTeamLabel,
        formatTeamCode,
        formatTeamCompactCode
      }}
    >
      {children}
    </TeamLabelContext.Provider>
  );
};
