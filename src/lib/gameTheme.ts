import { useContext, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
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
import { GameContext } from '@/contexts/GameContext';

export type GameThemeId = 'smartphone' | 'evalu8';
export const DEFAULT_GAME_THEME_ID: GameThemeId = 'smartphone';
export type TechKey = 'GPS' | 'WIFI' | 'GAMING' | 'BATTERY' | 'NFC' | '4G';

export interface ThemeTech {
  label?: string;          // undefined => show the stored tech name unchanged (Smartphone Inc)
  icon: LucideIcon;        // default icon used on boards, phases, viewer
  reportIcon?: LucideIcon; // SimulationReport uses a different icon set today; falls back to icon
  perkText?: string;       // short perk wording used by TeamPerksBanner etc.
}

export interface GameTheme {
  id: GameThemeId;
  productName: string;
  description: string;
  logoSrc: string;
  regionLabels: Record<string, string>;   // key -> label; missing key => the key itself
  techs: Record<TechKey, ThemeTech>;
  ruleDescriptions?: Record<string, string>;
}

export const SMARTPHONE_THEME: GameTheme = {
  id: 'smartphone',
  productName: 'Smartphone Inc',
  description: 'Sell smartphones across 12 regions.',
  logoSrc: '/smartphone-inc-logo.svg',
  regionLabels: {},
  techs: {
    GPS: {
      icon: MapPin,
      reportIcon: MapPinned,
      perkText: '+5 products once per game',
    },
    WIFI: {
      icon: Wifi,
      reportIcon: Wifi,
      perkText: 'Unsold products carry over',
    },
    GAMING: {
      icon: Gamepad2,
      reportIcon: Gamepad2,
      perkText: '−$1 research/patent cost',
    },
    BATTERY: {
      icon: Battery,
      reportIcon: Battery,
      perkText: '+1 logistics when product price is above $5',
    },
    NFC: {
      icon: Radio,
      reportIcon: Nfc,
      perkText: 'Direct sales: up to 3 products per round without placing them in a region',
    },
    '4G': {
      icon: Signal,
      reportIcon: Radio,
      perkText: 'Remote sales: 1 sale per region where the team has no office (needs the Permanent Tech Benefits rule)',
    },
  },
};

export const EVALU8_THEME: GameTheme = {
  id: 'evalu8',
  productName: 'Evalu8 Inc',
  description: 'Sell electric vehicles across 12 regions.',
  logoSrc: '/evalu8-inc-logo.svg',
  regionLabels: {
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
  },
  techs: {
    GPS: {
      label: 'Gigacasting',
      icon: Anvil,
      perkText: '+5 vehicles, once per game',
    },
    WIFI: {
      label: 'Charge Grid',
      icon: Plug,
      perkText: 'Unsold vehicles carry over',
    },
    GAMING: {
      label: 'Platform',
      icon: Layers,
      perkText: '−$1 research/patent cost',
    },
    BATTERY: {
      label: 'Battery',
      icon: BatteryCharging,
      perkText: '+1 logistics when vehicle price is above $5',
    },
    NFC: {
      label: 'Rapid Charge',
      icon: Zap,
      perkText: 'Rapid-charge hubs double as pop-up showrooms: sell up to 3 vehicles per round without a regional office',
    },
    '4G': {
      label: 'Self-Driving',
      icon: Radar,
      perkText: 'Cars deliver themselves: 1 remote sale per region without an office',
    },
  },
  ruleDescriptions: {
    standard_starting_points_and_regions:
      'Standard starting allocations: Green (3 pts, Central Europe), Blue (4 pts, South America), Black (5 pts, Northeast Asia), Yellow (6 pts, South Asia), Red (7 pts, Southern Africa).',
    tech_permanent_benefits:
      'Grants permanent perks on full research: Gigacasting (+5 vehicles bonus once per game), Charge Grid (unsold vehicle carry-over), Platform (−$1 research/patent cost), Battery (+1 logistics when vehicle price is > $5).',
  },
};

export const GAME_THEMES: Record<GameThemeId, GameTheme> = {
  smartphone: SMARTPHONE_THEME,
  evalu8: EVALU8_THEME,
};

export const GAME_THEME_LIST: GameTheme[] = [SMARTPHONE_THEME, EVALU8_THEME];

export function getGameTheme(id?: string | null): GameTheme {
  if (id === 'evalu8') return EVALU8_THEME;
  return SMARTPHONE_THEME;
}

export function normaliseTechKey(name: string): TechKey | null {
  if (!name) return null;
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return null;
  if (cleaned.includes('GPS')) return 'GPS';
  if (cleaned.includes('WIFI')) return 'WIFI';
  if (cleaned.includes('GAMING')) return 'GAMING';
  if (cleaned.includes('BATTERY')) return 'BATTERY';
  if (cleaned.includes('NFC')) return 'NFC';
  if (cleaned.includes('4G')) return '4G';
  return null;
}

export function regionLabel(theme: GameTheme, key: string): string {
  if (!key) return key;
  return theme.regionLabels[key] ?? key;
}

export function techLabel(theme: GameTheme, name: string): string {
  if (!name) return name;
  const key = normaliseTechKey(name);
  if (!key) return name;
  return theme.techs[key]?.label ?? name;
}

export function techIcon(theme: GameTheme, name: string, ctx?: 'report'): LucideIcon {
  const key = normaliseTechKey(name);
  if (!key) return Wifi;
  const entry = theme.techs[key];
  if (!entry) return Wifi;
  if (ctx === 'report' && entry.reportIcon) {
    return entry.reportIcon;
  }
  return entry.icon;
}

export function useGameTheme(explicit?: { themeId?: string | null } | null): GameTheme {
  const gameCtx = useContext(GameContext);
  const resolvedId = explicit !== undefined ? explicit?.themeId : gameCtx?.gameState?.themeId;
  return getGameTheme(resolvedId);
}

export function useApplyGameThemeAttribute(themeId?: string | null): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resolved = getGameTheme(themeId).id;
    document.documentElement.setAttribute('data-game-theme', resolved);
    return () => {
      document.documentElement.removeAttribute('data-game-theme');
    };
  }, [themeId]);
}
