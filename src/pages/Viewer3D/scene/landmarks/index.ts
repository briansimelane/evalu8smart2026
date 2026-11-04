import React from 'react';
import { CanadaLandmark } from './CanadaLandmark';
import { UsaLandmark } from './UsaLandmark';
import { CaribbeanLandmark } from './CaribbeanLandmark';
import { SouthAmericaLandmark } from './SouthAmericaLandmark';
import { EuropeLandmark } from './EuropeLandmark';
import { EmiratesLandmark } from './EmiratesLandmark';
import { NorthAfricaLandmark } from './NorthAfricaLandmark';
import { RsaLandmark } from './RsaLandmark';
import { CisLandmark } from './CisLandmark';
import { ChinaLandmark } from './ChinaLandmark';
import { IndiaLandmark } from './IndiaLandmark';
import { AustraliaLandmark } from './AustraliaLandmark';

export {
  CanadaLandmark,
  UsaLandmark,
  CaribbeanLandmark,
  SouthAmericaLandmark,
  EuropeLandmark,
  EmiratesLandmark,
  NorthAfricaLandmark,
  RsaLandmark,
  CisLandmark,
  ChinaLandmark,
  IndiaLandmark,
  AustraliaLandmark,
};

export const REGION_LANDMARKS: Record<string, React.ComponentType<{ scale?: number; className?: string }>> = {
  'Canada': CanadaLandmark,
  'USA': UsaLandmark,
  'Caribbean': CaribbeanLandmark,
  'South America': SouthAmericaLandmark,
  'Europe': EuropeLandmark,
  'Emirates': EmiratesLandmark,
  'North Africa': NorthAfricaLandmark,
  'RSA': RsaLandmark,
  'CIS': CisLandmark,
  'China': ChinaLandmark,
  'India': IndiaLandmark,
  'Australia': AustraliaLandmark,
};
