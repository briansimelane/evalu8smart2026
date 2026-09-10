import { describe, it, expect } from 'vitest';
import { getTeamCode, getTeamCompactCode, getTeamDisplayLabel } from '@/lib/multiworld/teamLabel';
import { Team } from '@/types/game';

describe('teamLabel', () => {
  const team: Team = { id: 't2', name: 'Blue Team', color: '#3b82f6', teamNumber: 2 };

  it('formats full team code with world key', () => {
    expect(getTeamCode(team, 'A')).toBe('T2WA');
    expect(getTeamCode(team, 'B')).toBe('T2WB');
  });

  it('formats compact team code', () => {
    expect(getTeamCompactCode(team, 'A')).toBe('2A');
  });

  it('respects display label mode', () => {
    expect(getTeamDisplayLabel(team, 'A', 'code')).toBe('T2WA');
    expect(getTeamDisplayLabel(team, 'A', 'name')).toBe('Blue Team');
  });
});
