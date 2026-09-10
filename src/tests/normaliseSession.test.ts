import { describe, it, expect } from 'vitest';
import { normaliseSession } from '@/lib/multiworld/normaliseSession';

describe('normaliseSession', () => {
  it('migrates legacy 2-world session on read', () => {
    const raw = {
      id: 'mw_123',
      name: 'Legacy Session',
      sessionCode: 'MW-1234',
      worldAClassId: 'class_a',
      worldBClassId: 'class_b',
      worldALabel: 'Alpha World',
      worldBLabel: 'Beta World',
      advanceMode: 'lockstep'
    };

    const session = normaliseSession(raw);
    expect(session.worlds).toHaveLength(2);
    expect(session.worlds[0]).toEqual({ key: 'A', classId: 'class_a', label: 'Alpha World', teamCount: 5 });
    expect(session.worlds[1]).toEqual({ key: 'B', classId: 'class_b', label: 'Beta World', teamCount: 5 });
    expect(session.teamLabelMode).toBe('name');
  });

  it('preserves N-world session data', () => {
    const raw = {
      id: 'mw_456',
      name: 'N-World Session',
      sessionCode: 'MW-5678',
      worlds: [
        { key: 'A', classId: 'c1', label: 'World A', teamCount: 5 },
        { key: 'B', classId: 'c2', label: 'World B', teamCount: 4 },
        { key: 'C', classId: 'c3', label: 'World C', teamCount: 3 },
      ],
      advanceMode: 'lockstep'
    };

    const session = normaliseSession(raw);
    expect(session.worlds).toHaveLength(3);
    expect(session.teamLabelMode).toBe('code');
  });
});
