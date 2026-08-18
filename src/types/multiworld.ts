export interface MultiWorldSession {
  id: string;                    // e.g. "mw_1700000000000"
  name: string;                  // e.g. "Cohort 12 — Championship"
  sessionCode: string;           // short human code for the combined viewer URL, e.g. "MW-8492"
  worldAClassId: string;         // -> classes/{id}
  worldBClassId: string;         // -> classes/{id}
  worldALabel: string;           // default "World A"
  worldBLabel: string;           // default "World B"
  advanceMode: 'lockstep' | 'independent'; // default 'lockstep'
  createdAt: string;
  createdByEmail?: string;
  createdByName?: string;
}
