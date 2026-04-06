export interface RegionConfig {
  name: string;
  logisticsCost: number;
  maxTeams: number;
  connectedRegions: string[];
}

export const REGION_CONFIGS: RegionConfig[] = [
  {
    name: 'Canada',
    logisticsCost: 2,
    maxTeams: 3,
    connectedRegions: ['CIS', 'India', 'USA']
  },
  {
    name: 'Europe',
    logisticsCost: 4,
    maxTeams: 5,
    connectedRegions: ['USA', 'CIS', 'North Africa']
  },
  {
    name: 'CIS',
    logisticsCost: 3,
    maxTeams: 4,
    connectedRegions: ['Canada', 'China', 'Europe']
  },
  {
    name: 'USA',
    logisticsCost: 4,
    maxTeams: 5,
    connectedRegions: ['Canada', 'Australia', 'Caribbean', 'South America']
  },
  {
    name: 'Emirates',
    logisticsCost: 2,
    maxTeams: 3,
    connectedRegions: ['India', 'RSA', 'North Africa']
  },
  {
    name: 'China',
    logisticsCost: 4,
    maxTeams: 5,
    connectedRegions: ['CIS', 'India', 'North Africa']
  },
  {
    name: 'Caribbean',
    logisticsCost: 2,
    maxTeams: 3,
    connectedRegions: ['USA', 'Australia', 'South America']
  },
  {
    name: 'North Africa',
    logisticsCost: 3,
    maxTeams: 4,
    connectedRegions: ['Europe', 'China', 'Emirates']
  },
  {
    name: 'India',
    logisticsCost: 3,
    maxTeams: 4,
    connectedRegions: ['Canada', 'Emirates', 'China']
  },
  {
    name: 'South America',
    logisticsCost: 3,
    maxTeams: 4,
    connectedRegions: ['Caribbean', 'USA', 'North Africa', 'RSA']
  },
  {
    name: 'RSA',
    logisticsCost: 2,
    maxTeams: 3,
    connectedRegions: ['South America', 'Emirates', 'Australia']
  },
  {
    name: 'Australia',
    logisticsCost: 3,
    maxTeams: 4,
    connectedRegions: ['USA', 'Caribbean', 'RSA']
  }
];

// Map team colors to their starting regions
export const INITIAL_TEAM_REGIONS: Record<string, string> = {
  'Green': 'North Africa',
  'Blue': 'South America',
  'Black': 'Australia',
  'Yellow': 'India',
  'Red': 'CIS'
};
