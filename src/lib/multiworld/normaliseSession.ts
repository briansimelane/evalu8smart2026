import { MultiWorldSession, MultiWorldWorld } from '@/types/multiworld';

export function normaliseSession(raw: any): MultiWorldSession {
  if (!raw) {
    return {
      id: '',
      name: '',
      sessionCode: '',
      worlds: [],
      advanceMode: 'lockstep',
      teamLabelMode: 'code',
      createdAt: new Date().toISOString()
    };
  }

  if (Array.isArray(raw.worlds) && raw.worlds.length > 0) {
    return {
      ...raw,
      teamLabelMode: raw.teamLabelMode ?? (raw.worlds.length > 2 ? 'code' : 'name')
    } as MultiWorldSession;
  }

  const worlds: MultiWorldWorld[] = [];
  if (raw.worldAClassId) {
    worlds.push({
      key: 'A',
      classId: raw.worldAClassId,
      label: raw.worldALabel || 'World A',
      teamCount: 5
    });
  }
  if (raw.worldBClassId) {
    worlds.push({
      key: 'B',
      classId: raw.worldBClassId,
      label: raw.worldBLabel || 'World B',
      teamCount: 5
    });
  }

  return {
    ...raw,
    worlds,
    teamLabelMode: raw.teamLabelMode ?? 'name'
  } as MultiWorldSession;
}
