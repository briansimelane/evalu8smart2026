export const TECHNOLOGIES = ['GPS', 'WIFI', 'Gaming', 'Battery', 'NFC', '4G'];

export const REGIONS = [
  'Canada', 'Europe', 'CIS', 'USA', 'Emirates', 'China', 
  'Caribbean', 'North Africa', 'India', 'South America', 'RSA', 'Australia'
];

export interface Combination {
  combination: number;
  position: number;
  price: number;
  products: number;
  improve: number;
  research: number;
  logistics: number;
}

export const COMBINATIONS: Combination[] = [
  { combination: 1, position: 1, price: -2, products: 4, improve: 1, research: 2, logistics: 2 },
  { combination: 1, position: 2, price: -2, products: 4, improve: 1, research: 2, logistics: 2 },
  { combination: 1, position: 3, price: -2, products: 5, improve: 1, research: 1, logistics: 2 },
  { combination: 1, position: 4, price: -2, products: 4, improve: 1, research: 1, logistics: 2 },
  { combination: 1, position: 5, price: -2, products: 5, improve: 0, research: 2, logistics: 2 },
  { combination: 1, position: 6, price: -2, products: 6, improve: 0, research: 1, logistics: 2 },
  { combination: 1, position: 7, price: -2, products: 5, improve: 1, research: 1, logistics: 2 },
  { combination: 1, position: 8, price: -1, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 1, position: 9, price: -2, products: 4, improve: 1, research: 2, logistics: 2 },
  { combination: 1, position: 10, price: -1, products: 4, improve: 1, research: 2, logistics: 2 },
  { combination: 1, position: 11, price: -1, products: 4, improve: 0, research: 2, logistics: 2 },
  { combination: 1, position: 12, price: -2, products: 4, improve: 1, research: 2, logistics: 2 },
  { combination: 1, position: 13, price: -1, products: 5, improve: 0, research: 2, logistics: 2 },
  { combination: 1, position: 14, price: -1, products: 5, improve: 0, research: 2, logistics: 2 },
  { combination: 2, position: 1, price: -1, products: 3, improve: 1, research: 1, logistics: 3 },
  { combination: 2, position: 2, price: 0, products: 3, improve: 1, research: 1, logistics: 3 },
  { combination: 2, position: 3, price: -1, products: 4, improve: 1, research: 1, logistics: 3 },
  { combination: 2, position: 4, price: -1, products: 3, improve: 1, research: 1, logistics: 3 },
  { combination: 2, position: 5, price: 0, products: 4, improve: 0, research: 1, logistics: 3 },
  { combination: 2, position: 6, price: -1, products: 5, improve: 0, research: 1, logistics: 3 },
  { combination: 2, position: 7, price: -1, products: 4, improve: 1, research: 1, logistics: 2 },
  { combination: 2, position: 8, price: 0, products: 3, improve: 1, research: 1, logistics: 3 },
  { combination: 2, position: 9, price: 0, products: 3, improve: 1, research: 1, logistics: 2 },
  { combination: 2, position: 10, price: 0, products: 4, improve: 1, research: 1, logistics: 2 },
  { combination: 2, position: 11, price: 0, products: 4, improve: 0, research: 1, logistics: 3 },
  { combination: 2, position: 12, price: 0, products: 3, improve: 1, research: 1, logistics: 2 },
  { combination: 2, position: 13, price: 0, products: 5, improve: 0, research: 1, logistics: 2 },
  { combination: 2, position: 14, price: 0, products: 5, improve: 0, research: 1, logistics: 3 },
  { combination: 3, position: 1, price: -1, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 3, position: 2, price: -1, products: 4, improve: 1, research: 3, logistics: 1 },
  { combination: 3, position: 3, price: -1, products: 5, improve: 1, research: 2, logistics: 1 },
  { combination: 3, position: 4, price: -1, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 3, position: 5, price: -1, products: 5, improve: 0, research: 3, logistics: 1 },
  { combination: 3, position: 6, price: -1, products: 6, improve: 0, research: 2, logistics: 1 },
  { combination: 3, position: 7, price: -1, products: 5, improve: 1, research: 2, logistics: 1 },
  { combination: 3, position: 8, price: 0, products: 3, improve: 1, research: 3, logistics: 1 },
  { combination: 3, position: 9, price: -1, products: 4, improve: 1, research: 3, logistics: 1 },
  { combination: 3, position: 10, price: 0, products: 4, improve: 1, research: 3, logistics: 1 },
  { combination: 3, position: 11, price: 0, products: 4, improve: 0, research: 3, logistics: 1 },
  { combination: 3, position: 12, price: -1, products: 4, improve: 1, research: 3, logistics: 1 },
  { combination: 3, position: 13, price: 0, products: 5, improve: 0, research: 3, logistics: 1 },
  { combination: 3, position: 14, price: 0, products: 5, improve: 0, research: 3, logistics: 1 },
  { combination: 4, position: 1, price: 0, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 4, position: 2, price: 1, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 4, position: 3, price: 0, products: 4, improve: 1, research: 2, logistics: 2 },
  { combination: 4, position: 4, price: 0, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 4, position: 5, price: 1, products: 4, improve: 0, research: 2, logistics: 2 },
  { combination: 4, position: 6, price: 0, products: 5, improve: 0, research: 2, logistics: 2 },
  { combination: 4, position: 7, price: 0, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 4, position: 8, price: 1, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 4, position: 9, price: 1, products: 3, improve: 1, research: 2, logistics: 1 },
  { combination: 4, position: 10, price: 1, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 4, position: 11, price: 1, products: 4, improve: 0, research: 2, logistics: 2 },
  { combination: 4, position: 12, price: 1, products: 3, improve: 1, research: 2, logistics: 1 },
  { combination: 4, position: 13, price: 1, products: 5, improve: 0, research: 2, logistics: 1 },
  { combination: 4, position: 14, price: 1, products: 5, improve: 0, research: 2, logistics: 2 },
  { combination: 5, position: 1, price: -2, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 5, position: 2, price: -2, products: 4, improve: 1, research: 2, logistics: 2 },
  { combination: 5, position: 3, price: -2, products: 5, improve: 1, research: 2, logistics: 1 },
  { combination: 5, position: 4, price: -2, products: 5, improve: 1, research: 2, logistics: 0 },
  { combination: 5, position: 5, price: -2, products: 5, improve: 1, research: 1, logistics: 2 },
  { combination: 5, position: 6, price: -2, products: 7, improve: 1, research: 1, logistics: 0 },
  { combination: 5, position: 7, price: -2, products: 6, improve: 1, research: 2, logistics: 0 },
  { combination: 5, position: 8, price: -1, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 5, position: 9, price: -2, products: 4, improve: 1, research: 2, logistics: 2 },
  { combination: 5, position: 10, price: -1, products: 4, improve: 1, research: 1, logistics: 2 },
  { combination: 5, position: 11, price: -1, products: 4, improve: 1, research: 1, logistics: 2 },
  { combination: 5, position: 12, price: -2, products: 5, improve: 1, research: 2, logistics: 1 },
  { combination: 5, position: 13, price: -1, products: 6, improve: 1, research: 1, logistics: 1 },
  { combination: 5, position: 14, price: -1, products: 5, improve: 1, research: 1, logistics: 2 },
  { combination: 6, position: 1, price: 0, products: 3, improve: 1, research: 1, logistics: 2 },
  { combination: 6, position: 2, price: 0, products: 3, improve: 1, research: 1, logistics: 3 },
  { combination: 6, position: 3, price: 0, products: 4, improve: 1, research: 1, logistics: 2 },
  { combination: 6, position: 4, price: 0, products: 4, improve: 1, research: 1, logistics: 1 },
  { combination: 6, position: 5, price: 0, products: 4, improve: 1, research: 0, logistics: 3 },
  { combination: 6, position: 6, price: 0, products: 6, improve: 1, research: 0, logistics: 1 },
  { combination: 6, position: 7, price: 0, products: 5, improve: 1, research: 1, logistics: 1 },
  { combination: 6, position: 8, price: 1, products: 2, improve: 1, research: 1, logistics: 3 },
  { combination: 6, position: 9, price: 0, products: 3, improve: 1, research: 1, logistics: 3 },
  { combination: 6, position: 10, price: 1, products: 3, improve: 1, research: 1, logistics: 3 },
  { combination: 6, position: 11, price: 1, products: 3, improve: 1, research: 0, logistics: 3 },
  { combination: 6, position: 12, price: 0, products: 1, improve: 1, research: 1, logistics: 2 },
  { combination: 6, position: 13, price: 1, products: 5, improve: 1, research: 0, logistics: 2 },
  { combination: 6, position: 14, price: 1, products: 4, improve: 1, research: 0, logistics: 3 },
  { combination: 7, position: 1, price: -1, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 7, position: 2, price: -1, products: 4, improve: 1, research: 3, logistics: 1 },
  { combination: 7, position: 3, price: -1, products: 5, improve: 1, research: 2, logistics: 1 },
  { combination: 7, position: 4, price: -1, products: 5, improve: 1, research: 1, logistics: 1 },
  { combination: 7, position: 5, price: -1, products: 5, improve: 1, research: 3, logistics: 0 },
  { combination: 7, position: 6, price: -1, products: 7, improve: 1, research: 1, logistics: 0 },
  { combination: 7, position: 7, price: -1, products: 5, improve: 1, research: 1, logistics: 1 },
  { combination: 7, position: 8, price: -1, products: 4, improve: 1, research: 3, logistics: 1 },
  { combination: 7, position: 9, price: -1, products: 3, improve: 1, research: 3, logistics: 1 },
  { combination: 7, position: 10, price: -1, products: 4, improve: 1, research: 3, logistics: 1 },
  { combination: 7, position: 11, price: -1, products: 5, improve: 1, research: 3, logistics: 0 },
  { combination: 7, position: 12, price: -1, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 7, position: 13, price: -1, products: 6, improve: 1, research: 2, logistics: 0 },
  { combination: 7, position: 14, price: -1, products: 6, improve: 1, research: 3, logistics: 0 },
  { combination: 8, position: 1, price: 1, products: 3, improve: 1, research: 1, logistics: 2 },
  { combination: 8, position: 2, price: 1, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 8, position: 3, price: 1, products: 4, improve: 1, research: 1, logistics: 2 },
  { combination: 8, position: 4, price: 1, products: 4, improve: 1, research: 0, logistics: 2 },
  { combination: 8, position: 5, price: 1, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 8, position: 6, price: 1, products: 4, improve: 1, research: 0, logistics: 1 },
  { combination: 8, position: 7, price: 1, products: 4, improve: 1, research: 0, logistics: 2 },
  { combination: 8, position: 8, price: 1, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 8, position: 9, price: 1, products: 2, improve: 1, research: 2, logistics: 2 },
  { combination: 8, position: 10, price: 1, products: 3, improve: 1, research: 2, logistics: 2 },
  { combination: 8, position: 11, price: 1, products: 4, improve: 1, research: 2, logistics: 1 },
  { combination: 8, position: 12, price: 1, products: 3, improve: 1, research: 1, logistics: 2 },
  { combination: 8, position: 13, price: 1, products: 5, improve: 1, research: 1, logistics: 1 },
  { combination: 8, position: 14, price: 1, products: 5, improve: 1, research: 1, logistics: 2 },
];

export const TEAM_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Black', value: '#1f2937' }
];

export const getTeamColorName = (teamColorHex: string, teamName: string = ''): string => {
  const hex = (teamColorHex || '').toLowerCase();
  
  // Try exact hex match (case-insensitive)
  const exactMatch = TEAM_COLORS.find(c => c.value.toLowerCase() === hex);
  if (exactMatch) return exactMatch.name;

  // Backwards compatibility/fallback for known hex mismatches from FacilitatorHub.tsx
  if (hex === '#0f172a') return 'Black';
  if (hex === '#10b981') return 'Green';

  // Try matching by team name if it contains one of our known color names
  const nameLower = teamName.toLowerCase();
  for (const c of TEAM_COLORS) {
    if (nameLower.includes(c.name.toLowerCase())) {
      return c.name;
    }
  }

  // Default fallback
  return 'Green';
};