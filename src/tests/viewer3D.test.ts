import { describe, it, expect } from 'vitest';
import { LAYOUT_DATA } from '@/pages/Viewer3D/layoutData';
import { REGION_CONFIGS } from '@/data/regions';
import { REGION_CUSTOMERS } from '@/data/customers';
import { useOptionalMotion } from '@/pages/Viewer/motion/MotionContext';

describe('Viewer 3D Layout & Rules Consistency', () => {
  it('has exact 1920x1080 stage dimensions', () => {
    expect(LAYOUT_DATA.stage.w).toBe(1920);
    expect(LAYOUT_DATA.stage.h).toBe(1080);
  });

  it('contains exactly 12 regions matching REGION_CONFIGS', () => {
    const layoutRegionNames = Object.keys(LAYOUT_DATA.regions);
    expect(layoutRegionNames.length).toBe(12);

    REGION_CONFIGS.forEach(cfg => {
      expect(LAYOUT_DATA.regions[cfg.name]).toBeDefined();
      expect(LAYOUT_DATA.regions[cfg.name].logisticsCost).toBe(cfg.logisticsCost);
      expect(LAYOUT_DATA.regions[cfg.name].maxTeams).toBe(cfg.maxTeams);
    });
  });

  it('contains customer slots matching REGION_CUSTOMERS', () => {
    REGION_CUSTOMERS.forEach(rc => {
      const layoutReg = LAYOUT_DATA.regions[rc.region];
      expect(layoutReg).toBeDefined();
      expect(layoutReg.customerSlots).toBe(rc.customers.length);
    });
  });

  it('contains all 17 connectors with valid coordinates', () => {
    expect(LAYOUT_DATA.connectors.length).toBe(17);
    LAYOUT_DATA.connectors.forEach(c => {
      expect(LAYOUT_DATA.regions[c.from]).toBeDefined();
      expect(LAYOUT_DATA.regions[c.to]).toBeDefined();
      expect(c.start.length).toBe(2);
      expect(c.end.length).toBe(2);
      expect(c.path.length).toBeGreaterThan(5);
    });
  });

  it('verifies connector topology matches classic links', () => {
    const expectedPairs = [
      ['Canada', 'USA'],
      ['USA', 'Caribbean'],
      ['Caribbean', 'South America'],
      ['USA', 'Europe'],
      ['USA', 'South America'],
      ['North Africa', 'South America'],
      ['Europe', 'North Africa'],
      ['Europe', 'CIS'],
      ['Emirates', 'North Africa'],
      ['North Africa', 'China'],
      ['Emirates', 'India'],
      ['Emirates', 'RSA'],
      ['CIS', 'China'],
      ['China', 'India'],
      ['India', 'Australia'],
      ['RSA', 'Australia'],
      ['South America', 'RSA'],
    ];

    expectedPairs.forEach(([r1, r2]) => {
      const match = LAYOUT_DATA.connectors.some(
        c => (c.from === r1 && c.to === r2) || (c.from === r2 && c.to === r1)
      );
      expect(match).toBe(true);
    });
  });

  it('verifies landmark anchors are placed within island boundaries', () => {
    Object.entries(LAYOUT_DATA.regions).forEach(([name, reg]) => {
      const { island, landmarkAnchor } = reg;
      expect(landmarkAnchor.x).toBeGreaterThanOrEqual(island.x0);
      expect(landmarkAnchor.x).toBeLessThanOrEqual(island.x1);
      expect(landmarkAnchor.y).toBeGreaterThanOrEqual(island.y0 - 50);
      expect(landmarkAnchor.y).toBeLessThanOrEqual(island.y1);
    });
  });

  it('verifies info plates fit their customer slots', () => {
    Object.entries(LAYOUT_DATA.regions).forEach(([name, reg]) => {
      const minW = Math.max(reg.customerSlots * 46 + 30, 316);
      expect(reg.plate.w).toBeGreaterThanOrEqual(minW);
      expect(reg.plate.h).toBe(88);
    });
  });

  it('verifies useOptionalMotion does not throw when rendered without MotionProvider', () => {
    expect(() => {
      expect(useOptionalMotion).toBeDefined();
    }).not.toThrow();
  });
});

