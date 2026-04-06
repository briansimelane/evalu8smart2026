export type IconType = 'Price Plus' | 'Price and Product' | 'Product' | 'Research' | 'Logistic';

export interface ImprovementIcon {
  type: IconType;
  priceEffect: number;
  productEffect: number;
  researchEffect: number;
  logisticsEffect: number;
}

export const ICON_EFFECTS: Record<IconType, ImprovementIcon> = {
  'Price Plus': {
    type: 'Price Plus',
    priceEffect: 1,
    productEffect: 0,
    researchEffect: 0,
    logisticsEffect: 0
  },
  'Price and Product': {
    type: 'Price and Product',
    priceEffect: -1,
    productEffect: 1,
    researchEffect: 0,
    logisticsEffect: 0
  },
  'Product': {
    type: 'Product',
    priceEffect: 0,
    productEffect: 1,
    researchEffect: 0,
    logisticsEffect: 0
  },
  'Research': {
    type: 'Research',
    priceEffect: 0,
    productEffect: 0,
    researchEffect: 1,
    logisticsEffect: 0
  },
  'Logistic': {
    type: 'Logistic',
    priceEffect: 0,
    productEffect: 0,
    researchEffect: 0,
    logisticsEffect: 1
  }
};

export interface ImprovementCardData {
  id: number;
  icon1: IconType;
  icon2: IconType;
}

export const INITIAL_IMPROVEMENT_CARDS: Record<string, ImprovementCardData> = {
  'Green': { id: 0, icon1: 'Research', icon2: 'Price Plus' },
  'Blue': { id: 0, icon1: 'Logistic', icon2: 'Price Plus' },
  'Black': { id: 0, icon1: 'Product', icon2: 'Research' },
  'Yellow': { id: 0, icon1: 'Price and Product', icon2: 'Logistic' },
  'Red': { id: 0, icon1: 'Logistic', icon2: 'Product' }
};

export const AVAILABLE_IMPROVEMENT_CARDS: ImprovementCardData[] = [
  { id: 1, icon1: 'Research', icon2: 'Research' },
  { id: 2, icon1: 'Logistic', icon2: 'Price Plus' },
  { id: 3, icon1: 'Research', icon2: 'Price Plus' },
  { id: 4, icon1: 'Logistic', icon2: 'Research' },
  { id: 5, icon1: 'Price and Product', icon2: 'Product' },
  { id: 6, icon1: 'Price and Product', icon2: 'Product' },
  { id: 7, icon1: 'Logistic', icon2: 'Price Plus' },
  { id: 8, icon1: 'Research', icon2: 'Price Plus' },
  { id: 9, icon1: 'Logistic', icon2: 'Logistic' },
  { id: 10, icon1: 'Product', icon2: 'Product' },
  { id: 11, icon1: 'Price and Product', icon2: 'Research' },
  { id: 12, icon1: 'Product', icon2: 'Price Plus' },
  { id: 13, icon1: 'Logistic', icon2: 'Price Plus' },
  { id: 14, icon1: 'Logistic', icon2: 'Price Plus' },
  { id: 15, icon1: 'Price and Product', icon2: 'Logistic' },
  { id: 16, icon1: 'Product', icon2: 'Price Plus' },
  { id: 17, icon1: 'Product', icon2: 'Price Plus' },
  { id: 18, icon1: 'Product', icon2: 'Product' },
  { id: 19, icon1: 'Product', icon2: 'Price Plus' },
  { id: 20, icon1: 'Price and Product', icon2: 'Research' },
  { id: 21, icon1: 'Research', icon2: 'Research' },
  { id: 22, icon1: 'Price and Product', icon2: 'Logistic' },
  { id: 23, icon1: 'Price and Product', icon2: 'Research' },
  { id: 24, icon1: 'Price and Product', icon2: 'Logistic' },
  { id: 25, icon1: 'Logistic', icon2: 'Logistic' },
  { id: 26, icon1: 'Logistic', icon2: 'Product' },
  { id: 27, icon1: 'Research', icon2: 'Price Plus' },
  { id: 28, icon1: 'Logistic', icon2: 'Research' },
  { id: 29, icon1: 'Product', icon2: 'Product' },
  { id: 30, icon1: 'Price and Product', icon2: 'Logistic' },
  { id: 31, icon1: 'Product', icon2: 'Research' },
  { id: 32, icon1: 'Logistic', icon2: 'Price Plus' }
];
