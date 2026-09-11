import { describe, it, expect } from 'vitest';
import { SimulationClass } from '@/types/game';
import { MultiWorldSession } from '@/types/multiworld';
import { normaliseSession } from '@/lib/multiworld/normaliseSession';

describe('Archive & Restoration Lifecycle', () => {
  const sampleClasses: SimulationClass[] = [
    {
      id: 'cls_1',
      name: 'Active Class Alpha',
      facilitatorCode: 'FAC-1001',
      teamCodes: { team_1: 'TM1-AAAA', team_2: 'TM2-BBBB' },
      teamRegistry: [
        { id: 'team_1', name: 'Alpha 1', color: '#22c55e', ceoName: 'Alice', ceoPin: '1111', isBot: false },
        { id: 'team_2', name: 'Alpha 2', color: '#3b82f6', ceoName: 'Bob', ceoPin: '2222', isBot: false }
      ],
      createdAt: '2026-09-01T10:00:00Z',
      isArchived: false
    },
    {
      id: 'cls_2',
      name: 'Archived Class Beta',
      facilitatorCode: 'FAC-2002',
      teamCodes: { team_1: 'TM1-CCCC', team_2: 'TM2-DDDD' },
      teamRegistry: [
        { id: 'team_1', name: 'Beta 1', color: '#22c55e', ceoName: 'Charlie', ceoPin: '3333', isBot: false },
        { id: 'team_2', name: 'Beta 2', color: '#3b82f6', ceoName: 'David', ceoPin: '4444', isBot: false }
      ],
      createdAt: '2026-08-20T10:00:00Z',
      isArchived: true,
      archivedAt: '2026-09-10T14:30:00Z'
    },
    {
      id: 'cls_3',
      name: 'Legacy Class (unspecified isArchived)',
      facilitatorCode: 'FAC-3003',
      teamCodes: { team_1: 'TM1-EEEE' },
      teamRegistry: [
        { id: 'team_1', name: 'Legacy 1', color: '#22c55e', ceoName: 'Eve', ceoPin: '5555', isBot: false }
      ],
      createdAt: '2026-08-15T10:00:00Z'
    }
  ];

  it('correctly partitions classes into active and archived lists', () => {
    const active = sampleClasses.filter(c => !c.isArchived);
    const archived = sampleClasses.filter(c => !!c.isArchived);

    expect(active.map(c => c.id)).toEqual(['cls_1', 'cls_3']);
    expect(archived.map(c => c.id)).toEqual(['cls_2']);
  });

  it('prevents students from accessing archived classes via team code', () => {
    const findTeam = (code: string) => {
      for (const cls of sampleClasses) {
        if (cls.isArchived) continue;
        for (const [teamId, tCode] of Object.entries(cls.teamCodes || {})) {
          if (tCode === code) {
            return { classId: cls.id, teamId };
          }
        }
      }
      return null;
    };

    // Active class code succeeds
    expect(findTeam('TM1-AAAA')).toEqual({ classId: 'cls_1', teamId: 'team_1' });

    // Archived class code is blocked
    expect(findTeam('TM1-CCCC')).toBeNull();
  });

  it('prevents facilitator code login into archived classes', () => {
    const findFacilitator = (code: string) => {
      return sampleClasses.find(c => !c.isArchived && c.facilitatorCode === code);
    };

    // Active facilitator code succeeds
    expect(findFacilitator('FAC-1001')).toBeDefined();
    expect(findFacilitator('FAC-1001')?.id).toBe('cls_1');

    // Archived facilitator code is blocked
    expect(findFacilitator('FAC-2002')).toBeUndefined();
  });

  it('preserves multiworld session properties with archive flag', () => {
    const mwSession: MultiWorldSession = {
      id: 'mw_test_1',
      name: 'Test Tournament',
      sessionCode: 'MW-TEST',
      worlds: [
        { key: 'A', classId: 'cls_1', label: 'World A', teamCount: 2 },
        { key: 'B', classId: 'cls_2', label: 'World B', teamCount: 2 }
      ],
      advanceMode: 'lockstep',
      createdAt: '2026-09-01T12:00:00Z',
      isArchived: true,
      archivedAt: '2026-09-11T09:00:00Z'
    };

    const normalised = normaliseSession(mwSession);
    expect(normalised.isArchived).toBe(true);
    expect(normalised.archivedAt).toBe('2026-09-11T09:00:00Z');
    expect(normalised.worlds.length).toBe(2);
  });
});
