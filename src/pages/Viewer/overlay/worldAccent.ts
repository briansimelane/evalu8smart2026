export type WorldId = 'A' | 'B';

export interface WorldAccent {
  ring: string;    // ring / border colour around a team marker
  bg: string;      // panel/lane background
  text: string;    // label text colour
  border: string;  // panel border colour
  label: string;   // 'A' | 'B'
  name: string;    // resolved from session.worldALabel / worldBLabel at call site
}

// World A = Purple, World B = Slate/Grey (disjoint from team colors Red, Blue, Green, Yellow, Purple, Black)
export const WORLD_ACCENT: Record<WorldId, Omit<WorldAccent, 'name'>> = {
  A: { ring: '#7c3aed', bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe', label: 'A' },
  B: { ring: '#475569', bg: '#f8fafc', text: '#1e293b', border: '#cbd5e1', label: 'B' },
};
