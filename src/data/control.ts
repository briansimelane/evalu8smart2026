export interface ControlPoints {
  region: string;
  control1: number;
  control2: number;
  control3: number;
  control4: number;
  control5: number;
  second1: number;
  second2: number;
  second3: number;
  second4: number;
  second5: number;
}

export const CONTROL_POINTS: ControlPoints[] = [
  {
    region: 'USA',
    control1: 3,
    control2: 4,
    control3: 5,
    control4: 6,
    control5: 8,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 3,
    second5: 4,
  },
  {
    region: 'Canada',
    control1: 1,
    control2: 2,
    control3: 4,
    control4: 0,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 0,
    second5: 0,
  },
  {
    region: 'Europe',
    control1: 3,
    control2: 4,
    control3: 5,
    control4: 6,
    control5: 8,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 3,
    second5: 4,
  },
  {
    region: 'CIS',
    control1: 2,
    control2: 3,
    control3: 5,
    control4: 6,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 3,
    second5: 0,
  },
  {
    region: 'China',
    control1: 3,
    control2: 4,
    control3: 5,
    control4: 6,
    control5: 8,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 3,
    second5: 4,
  },
  {
    region: 'India',
    control1: 2,
    control2: 3,
    control3: 5,
    control4: 6,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 3,
    second5: 0,
  },
  {
    region: 'Emirates',
    control1: 1,
    control2: 2,
    control3: 4,
    control4: 0,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 0,
    second5: 0,
  },
  {
    region: 'North Africa',
    control1: 2,
    control2: 3,
    control3: 5,
    control4: 6,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 3,
    second5: 0,
  },
  {
    region: 'RSA',
    control1: 1,
    control2: 2,
    control3: 4,
    control4: 0,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 0,
    second5: 0,
  },
  {
    region: 'Australia',
    control1: 2,
    control2: 3,
    control3: 5,
    control4: 6,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 3,
    second5: 0,
  },
  {
    region: 'Caribbean',
    control1: 1,
    control2: 2,
    control3: 4,
    control4: 0,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 0,
    second5: 0,
  },
  {
    region: 'South America',
    control1: 2,
    control2: 3,
    control3: 5,
    control4: 6,
    control5: 0,
    second1: 0,
    second2: 0,
    second3: 2,
    second4: 3,
    second5: 0,
  },
];

export const getControlPointsForRegion = (region: string, teamsPresent: number, position: 'first' | 'second'): number => {
  const controlData = CONTROL_POINTS.find(c => c.region === region);
  if (!controlData) return 0;

  if (position === 'first') {
    switch (teamsPresent) {
      case 1: return controlData.control1;
      case 2: return controlData.control2;
      case 3: return controlData.control3;
      case 4: return controlData.control4;
      case 5: return controlData.control5;
      default: return 0;
    }
  } else {
    switch (teamsPresent) {
      case 1: return controlData.second1;
      case 2: return controlData.second2;
      case 3: return controlData.second3;
      case 4: return controlData.second4;
      case 5: return controlData.second5;
      default: return 0;
    }
  }
};
