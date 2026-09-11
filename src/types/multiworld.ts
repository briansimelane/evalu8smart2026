export type WorldKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
export const WORLD_KEYS: WorldKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const MAX_WORLDS = 10;
export const MAX_TEAMS_PER_WORLD = 5;

export interface MultiWorldWorld {
  key: WorldKey;          // stable; drives the TnWx label and accent
  classId: string;        // -> classes/{id}
  label: string;          // display, e.g. "World A"
  teamCount: number;      // 1..5
}

export interface MultiWorldSession {
  id: string;                    // e.g. "mw_1700000000000"
  name: string;                  // e.g. "Cohort 12 — Championship"
  sessionCode: string;           // short human code for combined viewer URL, e.g. "MW-8492"
  worlds: MultiWorldWorld[];     // ordered by key
  advanceMode: 'lockstep' | 'independent';
  teamLabelMode?: 'name' | 'code'; // default 'code' for >2 worlds, else 'name'
  createdAt: string;
  createdByEmail?: string;
  createdByName?: string;
  isArchived?: boolean;
  archivedAt?: string;

  /** @deprecated legacy 2-world fields — read for migration only */
  worldAClassId?: string;
  worldBClassId?: string;
  worldALabel?: string;
  worldBLabel?: string;
}
