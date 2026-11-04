import { describe, it, expect } from 'vitest';
import {
  Anvil,
  Plug,
  BatteryCharging,
  Layers,
  Zap,
  Radar,
  MapPin,
  MapPinned,
  Wifi,
  Gamepad2,
  Battery,
  Radio,
  Signal,
  Nfc,
} from 'lucide-react';
import {
  getGameTheme,
  normaliseTechKey,
  regionLabel,
  techLabel,
  techIcon,
  TechKey,
} from '@/lib/gameTheme';
import { REGIONS } from '@/data/combinations';
import { REGION_CONFIGS } from '@/data/regions';
import { buildInitialGameState } from '@/lib/initialGameState';
import { normaliseSession } from '@/lib/multiworld/normaliseSession';
import { Team } from '@/types/game';

describe('gameTheme', () => {
  it('1. getGameTheme(undefined | null | "bogus") returns Smartphone Inc', () => {
    expect(getGameTheme(undefined).id).toBe('smartphone');
    expect(getGameTheme(null).id).toBe('smartphone');
    expect(getGameTheme('bogus').id).toBe('smartphone');
    expect(getGameTheme('smartphone').id).toBe('smartphone');
    expect(getGameTheme('evalu8').id).toBe('evalu8');
  });

  it('2. Smartphone Inc preserves all 12 region keys and all stored tech name variants unchanged', () => {
    const theme = getGameTheme('smartphone');
    expect(REGIONS.length).toBe(12);
    for (const key of REGIONS) {
      expect(regionLabel(theme, key)).toBe(key);
    }

    const techVariants = [
      'GPS',
      'Wifi',
      'WIFI',
      'Wi-Fi',
      'Wi-Fi Technology',
      'Gaming',
      'GAMING',
      'Battery',
      'BATTERY',
      'NFC',
      '4G',
    ];
    for (const variant of techVariants) {
      expect(normaliseTechKey(variant)).not.toBeNull();
      expect(techLabel(theme, variant)).toBe(variant);
    }
  });

  it('3. Evalu8 Inc provides 12 unique region labels and 6 unique tech labels, all <= 15 characters', () => {
    const theme = getGameTheme('evalu8');
    const expectedRegions: Record<string, string> = {
      'USA': 'North America',
      'Europe': 'Europe',
      'China': 'China',
      'India': 'South Asia',
      'North Africa': 'Central Europe',
      'South America': 'South America',
      'CIS': 'Southern Africa',
      'Australia': 'Northeast Asia',
      'Canada': 'Oceania',
      'Emirates': 'Gulf States',
      'RSA': 'Southeast Asia',
      'Caribbean': 'North Africa',
    };

    const labels = REGIONS.map(k => regionLabel(theme, k));
    expect(new Set(labels).size).toBe(12);
    for (const [key, expected] of Object.entries(expectedRegions)) {
      const actual = regionLabel(theme, key);
      expect(actual).toBe(expected);
      expect(actual.length).toBeLessThanOrEqual(15);
    }

    const expectedTechs: Record<TechKey, string> = {
      GPS: 'Gigacasting',
      WIFI: 'Charge Grid',
      BATTERY: 'Battery',
      GAMING: 'Platform',
      NFC: 'Rapid Charge',
      '4G': 'Self-Driving',
    };
    const techLabels = (Object.keys(expectedTechs) as TechKey[]).map(k => techLabel(theme, k));
    expect(new Set(techLabels).size).toBe(6);
    for (const [key, expected] of Object.entries(expectedTechs)) {
      const actual = techLabel(theme, key);
      expect(actual).toBe(expected);
      expect(actual.length).toBeLessThanOrEqual(15);
    }
  });

  it('4. Evalu8 connection fixture matches Appendix A (Evalu8_Details_new.xlsx)', () => {
    const theme = getGameTheme('evalu8');
    const appendixAConnections: Record<string, string[]> = {
      'USA': ['Europe', 'Oceania', 'North Africa', 'South America', 'Northeast Asia'],
      'Europe': ['North America', 'Southern Africa', 'Central Europe'],
      'China': ['Southern Africa', 'South Asia', 'Central Europe'],
      'India': ['Oceania', 'Gulf States', 'China', 'Northeast Asia'],
      'North Africa': ['Europe', 'China', 'Gulf States', 'South America'],
      'South America': ['North Africa', 'North America', 'Central Europe', 'Southeast Asia'],
      'CIS': ['Oceania', 'China', 'Europe'],
      'Australia': ['North America', 'North Africa', 'Southeast Asia', 'South Asia'],
      'Canada': ['Southern Africa', 'South Asia', 'North America'],
      'Emirates': ['South Asia', 'Southeast Asia', 'Central Europe'],
      'RSA': ['South America', 'Gulf States', 'Northeast Asia'],
      'Caribbean': ['North America', 'Northeast Asia', 'South America'],
    };

    expect(REGION_CONFIGS.length).toBe(12);
    for (const cfg of REGION_CONFIGS) {
      const mapped = cfg.connectedRegions.map(r => regionLabel(theme, r));
      expect(mapped).toEqual(appendixAConnections[cfg.name]);
    }
  });

  it('5. Icons resolve to defined components in both themes, with Evalu8 using Anvil, Plug, BatteryCharging, Layers, Zap, Radar', () => {
    const smartphone = getGameTheme('smartphone');
    const evalu8 = getGameTheme('evalu8');
    const keys: TechKey[] = ['GPS', 'WIFI', 'GAMING', 'BATTERY', 'NFC', '4G'];

    for (const k of keys) {
      expect(techIcon(smartphone, k)).toBeDefined();
      expect(techIcon(smartphone, k, 'report')).toBeDefined();
      expect(techIcon(evalu8, k)).toBeDefined();
      expect(techIcon(evalu8, k, 'report')).toBeDefined();
    }

    expect(techIcon(smartphone, 'GPS')).toBe(MapPin);
    expect(techIcon(smartphone, 'GPS', 'report')).toBe(MapPinned);
    expect(techIcon(smartphone, 'WIFI')).toBe(Wifi);
    expect(techIcon(smartphone, 'GAMING')).toBe(Gamepad2);
    expect(techIcon(smartphone, 'BATTERY')).toBe(Battery);
    expect(techIcon(smartphone, 'NFC')).toBe(Radio);
    expect(techIcon(smartphone, 'NFC', 'report')).toBe(Nfc);
    expect(techIcon(smartphone, '4G')).toBe(Signal);
    expect(techIcon(smartphone, '4G', 'report')).toBe(Radio);

    expect(techIcon(evalu8, 'GPS')).toBe(Anvil);
    expect(techIcon(evalu8, 'WIFI')).toBe(Plug);
    expect(techIcon(evalu8, 'BATTERY')).toBe(BatteryCharging);
    expect(techIcon(evalu8, 'GAMING')).toBe(Layers);
    expect(techIcon(evalu8, 'NFC')).toBe(Zap);
    expect(techIcon(evalu8, '4G')).toBe(Radar);
  });

  it('6. buildInitialGameState sets themeId properly and defaults to smartphone', () => {
    const teams: Team[] = [
      { id: 'team_1', name: 'Green', color: '#22c55e' },
      { id: 'team_2', name: 'Blue', color: '#3b82f6' },
    ];
    expect(buildInitialGameState(teams, 'evalu8').themeId).toBe('evalu8');
    expect(buildInitialGameState(teams).themeId).toBe('smartphone');
  });

  it('7. A legacy MultiWorldSession with no themeId resolves to Smartphone Inc', () => {
    const legacy = normaliseSession({
      id: 'mw_1',
      name: 'Legacy Cohort',
      sessionCode: 'MW-1234',
      worldAClassId: 'cls_a',
      worldBClassId: 'cls_b',
      advanceMode: 'lockstep',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(getGameTheme(legacy.themeId).id).toBe('smartphone');

    const evalu8Session = normaliseSession({
      id: 'mw_2',
      name: 'EV Cohort',
      sessionCode: 'MW-5678',
      themeId: 'evalu8',
      worlds: [
        { key: 'A', classId: 'cls_a', label: 'World A', teamCount: 5 },
        { key: 'B', classId: 'cls_b', label: 'World B', teamCount: 5 },
      ],
      advanceMode: 'lockstep',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(getGameTheme(evalu8Session.themeId).id).toBe('evalu8');
  });
});
