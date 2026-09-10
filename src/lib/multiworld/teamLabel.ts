import { Team } from '@/types/game';
import { WorldKey } from '@/types/multiworld';

export function getTeamNumber(team: Team | null | undefined, indexHint?: number): number {
  if (team?.teamNumber && team.teamNumber >= 1) {
    return team.teamNumber;
  }
  if (team?.name) {
    const match = team.name.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
  }
  if (team?.color) {
    const colorNumMap: Record<string, number> = {
      '#10b981': 1, 'green': 1,
      '#3b82f6': 2, 'blue': 2,
      '#1e293b': 3, 'black': 3,
      '#eab308': 4, 'yellow': 4,
      '#ef4444': 5, 'red': 5,
    };
    const lowerColor = (team.color || '').toLowerCase();
    if (colorNumMap[lowerColor]) return colorNumMap[lowerColor];
  }
  return indexHint !== undefined ? indexHint + 1 : 1;
}

export function getTeamBubbleText(
  teamOrName: Team | string | null | undefined,
  indexHint?: number
): string {
  if (!teamOrName) {
    return indexHint !== undefined ? `${indexHint + 1}` : '?';
  }

  let name = '';
  let teamNumber: number | undefined = undefined;

  if (typeof teamOrName === 'string') {
    name = teamOrName;
  } else {
    name = teamOrName.name || '';
    teamNumber = teamOrName.teamNumber;
  }

  if (teamNumber !== undefined && teamNumber !== null && teamNumber > 0) {
    return `${teamNumber}`;
  }

  const numberMatch = name.match(/\d+/);
  if (numberMatch) {
    return numberMatch[0];
  }

  const trimmed = name.trim();
  if (trimmed.length > 0) {
    return trimmed.charAt(0).toUpperCase();
  }

  if (indexHint !== undefined) {
    return `${indexHint + 1}`;
  }

  return '?';
}

export function getTeamCode(
  team: Team | null | undefined,
  worldKey?: WorldKey | null,
  indexHint?: number
): string {
  const num = getTeamNumber(team, indexHint);
  const wKey = worldKey || '';
  return `T${num}${wKey ? 'W' + wKey : ''}`;
}

export function getTeamCompactCode(
  team: Team | null | undefined,
  worldKey?: WorldKey | null,
  indexHint?: number
): string {
  const num = getTeamNumber(team, indexHint);
  const wKey = worldKey || '';
  return `${num}${wKey}`;
}

export function getTeamDisplayLabel(
  team: Team | null | undefined,
  worldKey?: WorldKey | null,
  mode: 'name' | 'code' = 'name',
  indexHint?: number
): string {
  if (mode === 'code') {
    return getTeamCode(team, worldKey, indexHint);
  }
  if (team?.name) {
    return team.name;
  }
  return indexHint !== undefined ? `Team ${indexHint + 1}` : '?';
}
