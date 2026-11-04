# FEATURE BRIEF — Evalu8 Inc / Smartphone Inc Simulation Option

**Version:** 1.0  **Date:** 19 Oct 2026  **Owner:** Brian Simelane  **Implementer:** Antigravity
**Repo:** `briansimelane/evalu8smart2026` (read against `main` @ `b3a1dae`)
**Type:** Display-layer feature. **No game-mechanic, scoring, rules or data-file changes.**

> Read sections 1–3 before writing any code. Section 6 lists every file to touch; section 8 is the acceptance checklist. Section 9 lists decisions that are still Brian's — do not assume them away.

---

## 1. Goal and scope

When a facilitator creates a simulation, they choose **Smartphone Inc** (today's game) or **Evalu8 Inc** (same game, selling electric vehicles). Everything works identically. Only the following change for Evalu8 Inc:

1. **Region names** (12 regions, display only).
2. **Technology names and icons** (6 technologies, display only), including the short "perk" wording that mentions a technology by name.
3. **Product branding** (app/product name and logo shown in headers and on the demo setup screen).
4. **A colour-scheme hook** so Brian can supply an Evalu8 colour scheme later. For now Evalu8 Inc renders with **exactly the same colours as Smartphone Inc**.

**In scope:** class creation, multi-world session creation, solo demo creation, the facilitator/participant dashboards, the single-world Viewer, the Combined (multi-world) Viewer, the Simulation Report, and Syndicate Marks text/PDF.

**Out of scope (do not touch):** core mechanics, rules engine, scoring, control points, customers, bots, Firestore security rules, the Product/Improvement/phase icons (a separate re-theme package covers those), Viewer board geometry, and any internal key or data file.

---

## 2. Decision records

| # | Decision | Why |
|---|---|---|
| D1 | The chosen theme is stored as `themeId: 'smartphone' \| 'evalu8'` on **`GameState`** (authoritative) and copied to the **class document** (for list badges only). Missing = `'smartphone'`. | Viewer, Combined Viewer, Demo and the dashboards all already hold a `GameState`; the class doc is not available in `demo_games`. Defaulting a missing value means every existing class, demo and multi-world session keeps working with no migration. |
| D2 | **Multi-world:** one theme per session, chosen once in the creation modal and applied to every world's class. Also stored on `MultiWorldSession.themeId`. Mixed-theme worlds are not allowed. | The Combined Viewer shows worlds together; mixed region names on one board would be confusing. |
| D3 | The theme layer is **pure functions plus a small hook**, not a React context provider. `getGameTheme(themeId)` returns a static config object. | Viewer components receive `gameState` as a prop and sit outside the participant `GameContext`; a provider would need re-plumbing and could re-render the Viewer. |
| D4 | **Internal keys are never renamed.** Region keys (`'Canada'`, `'USA'`, …) and technology keys (`'GPS'`, `'Wifi'`/`'WIFI'`, …) stay as stored. The theme only maps **key → display label** at render time. | Existing hard architecture constraint; all data files, Firestore documents, bots and tests depend on these keys. |
| D5 | Evalu8 region labels are assigned **by slot**: each Smartphone Inc region slot keeps its logistics cost, cheapest customer, capacity, customers, control points and connections, and only gets a new label. | The Evalu8 sheet is a re-skin of the Smartphone Inc board. A cross-check of the colleague's sheet against `regions.ts` and `customers.ts` confirmed the structure (see Appendix A). |
| D6 | One **tech registry** replaces the six duplicated tech→icon maps in the codebase (section 6.3). | The same map is copy-pasted per file today; any theme would otherwise need six edits and six places to drift. |
| D7 | The theme is **fixed at creation** in v1 (no switching mid-game). | Switching would be technically safe because it is display-only, but it is not requested and would surprise participants watching a Viewer. |
| D8 | Colour is applied through a `data-game-theme` attribute on `<html>` plus CSS variables. Evalu8 Inc's override block is **empty** for now. | Gives Brian a single place to add a scheme later with no further code changes. |

---

## 3. Hard constraints

1. **Do not rename or edit** `src/data/regions.ts`, `customers.ts`, `control.ts`, `combinations.ts`, `improvements.ts`, or any stored key.
2. **Never compare display labels.** Compare keys only. Note the trap: in Evalu8 Inc the key `'North Africa'` displays as **Central Europe**, and the label "North Africa" belongs to the key `'Caribbean'`. Any code that reads a label back as a key will silently break.
3. **Smartphone Inc must look and behave exactly as it does today.** Its labels are pass-through (label = key / stored tech name) and its icons are the icons currently used at each site.
4. Existing games, classes, demos and multi-world sessions with no `themeId` must load as Smartphone Inc.
5. Do not change game logic, scoring, marks maths, or any `hasTech(...)` behaviour.
6. Do not widen Firestore rules. (The existing catch-all rule is a known separate issue.)
7. Region labels must fit the existing region cards (see acceptance AC-8). The longest Evalu8 label is "Southern Africa" (15 characters).
8. Tests that exist today must still pass unchanged.

---

## 4. Theme data

### 4.1 Region labels (key → Evalu8 display)

Capacity, logistics, cheapest customer and connections are copied from the current code and are shown for reference only; they are **not** changed.

| Internal key (unchanged) | Evalu8 label | Teams (cap) | Logistics | Lowest price | Connects to (Evalu8 labels) |
|---|---|---|---|---|---|
| `USA` | **North America** | 5 | 4 | 3 | Europe, Oceania, North Africa, South America, Northeast Asia |
| `Europe` | **Europe** | 5 | 4 | 4 | North America, Southern Africa, Central Europe |
| `China` | **China** | 5 | 4 | 2 | Southern Africa, South Asia, Central Europe |
| `India` | **South Asia** | 4 | 3 | 3 | Oceania, Gulf States, China, Northeast Asia |
| `North Africa` | **Central Europe** | 4 | 3 | 3 | Europe, China, Gulf States, South America |
| `South America` | **South America** | 4 | 3 | 2 | North Africa, North America, Central Europe, Southeast Asia |
| `CIS` | **Southern Africa** | 4 | 3 | 3 | Oceania, China, Europe |
| `Australia` | **Northeast Asia** | 4 | 3 | 4 | North America, North Africa, Southeast Asia, South Asia |
| `Canada` | **Oceania** | 3 | 2 | 4 | Southern Africa, South Asia, North America |
| `Emirates` | **Gulf States** | 3 | 2 | 6 | South Asia, Southeast Asia, Central Europe |
| `RSA` | **Southeast Asia** | 3 | 2 | 2 | South America, Gulf States, Northeast Asia |
| `Caribbean` | **North Africa** | 3 | 2 | 3 | North America, Northeast Asia, South America |

Round-1 starting regions follow the same keys: Green `North Africa` → **Central Europe**, Blue `South America` → **South America**, Black `Australia` → **Northeast Asia**, Yellow `India` → **South Asia**, Red `CIS` → **Southern Africa**.

### 4.2 Technologies

| Stored key (unchanged) | Cost | Evalu8 label | Lucide icon (lucide-react ^0.462.0) | Game effect (unchanged, verified in code) | Perk wording for Evalu8 (see open decision O1) |
|---|---|---|---|---|---|
| `GPS` | 3 | **Gigacasting** | `Anvil` | +5 products once per game | +5 vehicles, once per game |
| `Wifi` / `WIFI` | 3 | **Charge Grid** | `Plug` | Unsold products carry over | Unsold vehicles carry over |
| `Battery` | 4 | **Battery** | `BatteryCharging` | +1 logistics when product price is above $5 | +1 logistics when vehicle price is above $5 |
| `Gaming` | 4 | **Platform** | `Layers` | −$1 research/patent cost | −$1 research/patent cost |
| `NFC` | 5 | **Rapid Charge** | `Zap` | Direct sales: up to 3 products per round without placing them in a region | Rapid-charge hubs double as pop-up showrooms: sell up to 3 vehicles per round without a regional office |
| `4G` | 6 | **Self-Driving** | `Radar` | Remote sales: 1 sale per region where the team has no office (needs the Permanent Tech Benefits rule) | Cars deliver themselves: 1 remote sale per region without an office |

Icon notes: Brian approved these icons on 19 Oct 2026 and chose `Anvil` for Gigacasting. `Plug` (not `PlugZap`) is used for Charge Grid so that the lightning bolt belongs only to Rapid Charge, which sits next to it on the research board. Display order on boards stays as today (GPS, Wifi, Gaming, Battery, NFC, 4G).

### 4.3 Branding

| | Smartphone Inc | Evalu8 Inc |
|---|---|---|
| Product name | `Smartphone Inc` | `Evalu8 Inc` |
| Logo | `/smartphone-inc-logo.svg` | `/evalu8-inc-logo.svg` |
| One-line description (selector) | Sell smartphones across 12 regions. | Sell electric vehicles across 12 regions. |

Both logo files already exist in `public/` (used today on `Login.tsx`).

### 4.4 Rule text that names regions or technologies

Two default rule descriptions in `src/lib/defaultRules.ts` contain theme-specific names. Add an optional per-theme override, keyed by rule id, and render the override when present:

- `tech_permanent_benefits` (line 154): lists GPS, Wifi, Gaming, Battery. Evalu8 text: *"Grants permanent perks on full research: Gigacasting (+5 vehicles bonus once per game), Charge Grid (unsold vehicle carry-over), Platform (−$1 research/patent cost), Battery (+1 logistics when vehicle price is > $5)."* (Keep the same four perks as the Smartphone text; do not add NFC/4G here, see observations in section 10.)
- `standard_starting_points_and_regions` (line 115): *"Standard starting allocations: Green (3 pts, Central Europe), Blue (4 pts, South America), Black (5 pts, Northeast Asia), Yellow (6 pts, South Asia), Red (7 pts, Southern Africa)."*

### 4.5 Proposed module (new file `src/lib/gameTheme.ts`)

```ts
import type { LucideIcon } from 'lucide-react';
import { Anvil, Plug, BatteryCharging, Layers, Zap, Radar,
         MapPin, MapPinned, Wifi, Gamepad2, Battery, Radio, Signal, Nfc } from 'lucide-react';

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

export function getGameTheme(id?: string | null): GameTheme;           // unknown/missing => smartphone
export function normaliseTechKey(name: string): TechKey | null;        // see below
export function regionLabel(theme: GameTheme, key: string): string;    // regionLabels[key] ?? key
export function techLabel(theme: GameTheme, name: string): string;     // theme.techs[k].label ?? name
export function techIcon(theme: GameTheme, name: string, ctx?: 'report'): LucideIcon;
export function useGameTheme(explicit?: { themeId?: string | null } | null): GameTheme; // uses useGame() when no arg
export function useApplyGameThemeAttribute(themeId?: string | null): void; // see section 7
```

`normaliseTechKey` must match the tolerance already used by `hasTech` and `TechPanel`: upper-case the name, strip non-alphanumerics (so `Wi-Fi`, `WIFI`, `Wifi` and `Wi-Fi Technology` all resolve to `WIFI`), then match with `includes`. It returns `null` for unknown names, and `techIcon` then falls back to `Wifi` (today's fallback in `TechPanel`).

Smartphone Inc theme: `regionLabels = {}`, every `label` undefined, and icons exactly as today (`GPS: MapPin`, `WIFI: Wifi`, `GAMING: Gamepad2`, `BATTERY: Battery`, `NFC: Radio`, `4G: Signal`) with `reportIcon` = what `SimulationReport` uses today (`MapPinned`, `Wifi`, `Gamepad2`, `Battery`, `Nfc`, `Radio`).

Evalu8 Inc `regionLabels`:

```ts
{
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
}
```

---

## 5. Creation flow

### 5.1 Class creation — `src/pages/FacilitatorHub.tsx` + `src/contexts/SessionContext.tsx`

- Add state `const [themeId, setThemeId] = useState<GameThemeId>('smartphone');`.
- In the **Create New Class** card, directly under **Class Name**, add a **Simulation** selector using the same visual pattern as the *Number of Teams* buttons (lines ~549–566), but as two larger selectable tiles. Each tile shows the logo (`logoSrc`), the product name and the one-line description from 4.3. Default: Smartphone Inc.
- `createClass` signature (`SessionContext.tsx` line 51 and 653): `createClass: (name: string, teams: Team[], themeId?: GameThemeId) => Promise<string>`. The default stays `'smartphone'` so every other caller still compiles.
- In `createClass`, pass the theme into the initial state and write it to both documents:

```ts
// before (line ~702)
const initialGameState = buildInitialGameState(canonicalTeams);
// after
const initialGameState = buildInitialGameState(canonicalTeams, themeId);

// class identity doc (line ~708): add
themeId,
```

- `src/lib/initialGameState.ts`: `buildInitialGameState(teams: Team[], themeId: GameThemeId = DEFAULT_GAME_THEME_ID)` sets `themeId` on the returned `GameState`.
- `src/types/game.ts`: add `themeId?: GameThemeId` to **`GameState`** and **`SimulationClass`**.
- `handleCreateClass` passes the chosen id: `await createClass(className, teams, themeId);`.

### 5.2 `GameContext` initialisers — `src/contexts/GameContext.tsx`

`initializeGame(teams)` (line 216) builds a second `GameState` and is called from two places: the first-load path when the state document is missing (line ~191) and `resetGame` (line ~533). Both must **preserve** the theme or a reset would silently turn an Evalu8 class into Smartphone Inc:

- Change to `initializeGame(teams: Team[], themeId?: GameThemeId)` and set `themeId` on `newGame`.
- Line ~191: pass `classData.themeId`.
- `resetGame`: pass `activeClass?.themeId ?? effectiveGameState?.themeId`.
- Update the `initializeGame` signature in the context interface (line 21).

### 5.3 Multi-world — `src/components/multiworld/MultiWorldCreationModal.tsx`

- Add the same **Simulation** selector to the *Basic Details* grid (session level, not per world). Default Smartphone Inc.
- Pass `themeId` to every `createClass(className, teams, themeId)` call (line ~126).
- Add `themeId` to the `sessionDoc` (line ~143) and to `MultiWorldSession` in `src/types/multiworld.ts` as `themeId?: GameThemeId`. `normaliseSession.ts` already spreads unknown fields, so no change is needed there, but add a test that a legacy session without the field resolves to Smartphone Inc.

### 5.4 Solo demo — `src/demo/DemoSetup.tsx` + `src/demo/DemoStateProvider.tsx`

- Add the selector to the demo setup screen and pass `themeId` into `buildInitialGameState(allTeams, themeId)` (provider line ~232).
- The demo setup title (`DemoSetup.tsx` line 86, "Smartphone Inc. Solo Demo Sandbox") becomes `${theme.productName} Solo Demo Sandbox`.
- `maskGameStateForDemo` is read-side only and does not touch `themeId`; confirm it passes the field through.

### 5.5 Class list badges (small)

In `FacilitatorHub.tsx` (class and multi-world tables) and `AdminHub.tsx`, show a small "Evalu8 Inc" badge beside the name when `themeId === 'evalu8'`. Show nothing for Smartphone Inc.

---

## 6. Display remap — work list

Antigravity must re-run the greps in the last column before finishing; the line numbers below are from `b3a1dae` and will drift.

### 6.1 Region labels (key → `regionLabel(theme, key)`)

| File | What to change |
|---|---|
| `components/dashboard/LogisticsPhase.tsx` | `{region.name}` at ~527, ~806; badge `{region}` ~441; "Steve is blocking expansion into …" ~657; customer tooltips |
| `components/dashboard/SalesPhase.tsx` | `{regionName}` ~717, ~758, ~895; toast at ~246 ("…maximum of 1 product sale in …") |
| `components/dashboard/SummaryMap.tsx` | `{region}` ~294 |
| `components/dashboard/SimulationReport.tsx` | `{region}` ~626, ~646. Leave the `regionCode === 'naf' && r.region === 'North Africa'` key comparisons (~91–102) alone: they compare keys |
| `components/dashboard/SteveControlModal.tsx` | region `<SelectItem>` text ~133 (keep `value={r}` as the key; default state `'Canada'` is a key) |
| `components/dashboard/ControlPhase.tsx`, `RoundInput.tsx` | any displayed region name (value stays the key) |
| `pages/Viewer/RegionCard.tsx` | title ~296 `{regionName.toUpperCase()}` and tooltips |
| `pages/Viewer/overlay/OverlayRegionCard.tsx` | title ~296 |
| `pages/Viewer/CombinedViewerPage.tsx`, `MultiWorldSingleBoard.tsx` | any displayed region text. **Do not** change the position tables keyed by region key (`MultiWorldSingleBoard.tsx` ~28–39, `RegionLayer.tsx` ~16–31) |
| `lib/defaultRules.ts` | rule description override (section 4.4) |
| `contexts/GameContext.tsx` | console messages need no change |

Check: `grep -rnE "regionName|region\.name|\{region\}|r\.region" src --include=*.tsx`

### 6.2 Technology labels (stored name → `techLabel(theme, name)`)

| File | What to change |
|---|---|
| `components/dashboard/ResearchPhase.tsx` | titles ~563, ~822; lists ~678, ~733; toasts ~173, ~178; tooltip ~314 |
| `components/dashboard/SalesPhase.tsx` | badges ~592, ~964, ~973; "Value Customer - Requires {customer.technology}" ~789, ~1003; the NFC and 4G explanatory text (~612–655, toast ~246) |
| `components/dashboard/LogisticsPhase.tsx` | "Requires {customer.technology}" ~701, ~912 |
| `components/dashboard/PatentTracker.tsx` | `<SelectItem>` text ~54 and tracker rows ~118 (values stay stored names) |
| `components/dashboard/TeamPerksBanner.tsx` | the five perk badges ~193–213 (use `perkText` from the theme; keep the dynamic numbers such as "+{carriedOver}") |
| `components/dashboard/DirectivesClaimModal.tsx` | description ~56 and status ~115 ("Wifi active") |
| `components/dashboard/PlanningPhase.tsx` | perk hints ~696, ~707 |
| `components/dashboard/SimulationReport.tsx` | `{tech.name}` ~720 and icon switch ~66–82 |
| `components/dashboard/SyndicateMarks.tsx` (~886) and `lib/marks/marksPdf.ts` (~197) | the methodology sentence mentions "Wifi carry-over"; build it from `techLabel` (non-React: call `getGameTheme(gameState.themeId)`) |
| `pages/Viewer/TechPanel.tsx`, `overlay/OverlayTechPanel.tsx` | tech row names, tooltips ~65 |
| `pages/Viewer/RegionCard.tsx`, `overlay/OverlayRegionCard.tsx` | customer tooltips ("Requires …", ~360) |
| `pages/Viewer/CombinedViewerPage.tsx` | patent badges ~426–427 |

Check: `grep -rEn "GPS|Wi-?[Ff]i|Gaming|NFC|4G" src --include=*.tsx --include=*.ts` and inspect every hit that is **display text** (ignore key lookups such as `hasTech(state, team, 'GPS')`).

### 6.3 Tech icons — replace six duplicated maps with `techIcon(theme, name)`

| File | Current map |
|---|---|
| `components/dashboard/ResearchPhase.tsx` | `TECHNOLOGY_ICONS` lines 16–24 |
| `components/dashboard/LogisticsPhase.tsx` | map at lines 21–28 |
| `components/dashboard/SalesPhase.tsx` | map at lines 15–22 |
| `pages/Viewer/RegionCard.tsx` | `TECHNOLOGY_ICONS` lines 15–22 |
| `pages/Viewer/overlay/OverlayRegionCard.tsx` | map at lines 16–23 |
| `pages/Viewer/TechPanel.tsx` | `getTechIconComponent` lines 10–19 |
| `pages/Viewer/overlay/OverlayTechPanel.tsx` | `getTechIconComponent` lines 8–16 |
| `components/dashboard/SimulationReport.tsx` | icon switch lines 66–82 (uses a **different** set, hence `reportIcon`) |

After the refactor, `grep -rn "TECHNOLOGY_ICONS\|getTechIconComponent" src` must return nothing, and these files must no longer import `MapPin, Wifi, Gamepad2, Battery, Radio, Signal` for technology purposes (other uses of `MapPin` etc. stay).

### 6.4 Product branding

| File | Change |
|---|---|
| `components/Dashboard.tsx` ~258 | "Smartphone Inc Tracker" → `${theme.productName} Tracker` |
| `components/GameSetup.tsx` ~66 | same |
| `demo/DemoSetup.tsx` ~86 | see 5.4 |
| `pages/Login.tsx`, `pages/AdminHub.tsx` ~571 | already name both products; leave |
| `index.html` | static `<title>`/meta; leave |

---

## 7. Colour-scheme hook (no visible change today)

1. In `gameTheme.ts`, implement `useApplyGameThemeAttribute(themeId)`: set `document.documentElement.setAttribute('data-game-theme', id)` in an effect and remove it on unmount. It goes on `<html>` (not a wrapper) so Radix portals, dialogs and toasts rendered into `<body>` inherit it.
2. Call it from: the participant/class dashboards (read `useGame().gameState?.themeId`), `ViewerPage`, `CombinedViewerPage` (use the first loaded world's `gameState.themeId`, falling back to `session.themeId`), and `MultiWorldControl`. The facilitator hub and login do **not** call it (default look).
3. In `src/index.css`, after the `:root` and `.dark` blocks, add an **empty, documented** override block:

```css
/* Per-simulation colour scheme. Smartphone Inc uses the :root / .dark values above.
   Evalu8 Inc intentionally has no overrides yet. To add a scheme, override any token
   here (e.g. --primary, --accent, --ring, --viewer-board-bg) and, if needed, add a
   matching dark block under `.dark[data-game-theme="evalu8"]`. */
:root[data-game-theme="evalu8"] {
}
```

4. Introduce three Viewer tokens with defaults equal to today's hard-coded values, so the Viewer background can be re-coloured by theme later:

```css
:root {
  --viewer-board-bg: 241 245 249;      /* Tailwind slate-100, used by ViewerPage at lines 112 and 116 */
  --viewer-grid-dot: rgba(0, 0, 0, 0.08); /* currently hard-coded in viewer.css .bg-grid-pattern */
}
```

   - `viewer.css` `.bg-grid-pattern`: `radial-gradient(var(--viewer-grid-dot) 1px, transparent 0)`.
   - Add `.viewer-board-bg { background-color: rgb(var(--viewer-board-bg)); }` and use it instead of `bg-slate-100` on the board container and its background layer (`ViewerPage.tsx` ~112, ~116).
   - The change-highlight colour is already a variable (`--mo-accent`, `#f59e0b` by default) and needs no work.
5. **Known limit, not in scope:** much of the Viewer and Combined Viewer uses hard-coded Tailwind colour classes (`bg-slate-*`, `bg-purple-600`, `border-slate-300`, …). The hook above only re-colours what goes through CSS variables. Converting those classes to tokens is a follow-up to schedule once Brian supplies the Evalu8 scheme.

---

## 8. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | Class creation shows a **Simulation** selector (Smartphone Inc default); the multi-world modal and the demo setup show the same selector. |
| AC-2 | A class created as Evalu8 Inc has `themeId: 'evalu8'` on both `classes/{id}` and `classes/{id}/state/game`; Smartphone Inc classes have `'smartphone'`. |
| AC-3 | A class, demo or multi-world session **without** `themeId` loads and renders as Smartphone Inc, with no errors and no data written on load. |
| AC-4 | In Evalu8 Inc, every region name shown in the participant dashboard, facilitator dashboard, Viewer, Combined Viewer (single, grid, per-world), Simulation Report and Marks output uses the labels in 4.1. No Smartphone Inc region name appears. |
| AC-5 | In Evalu8 Inc, every technology name, icon, perk badge and "Requires …" tooltip uses 4.2. No Smartphone Inc technology name appears (including toasts and the Marks methodology text). |
| AC-6 | In Smartphone Inc, a before/after comparison of every screen in AC-4/AC-5 shows **no difference** (names and icons), including the Simulation Report's own icon set. |
| AC-7 | **Resetting a game** (`resetGame`) and the first-load initialiser keep the class's theme. |
| AC-8 | Region titles fit their cards in the Viewer at 1920×1080 and in the Combined Viewer overlay, in upper case ("SOUTHERN AFRICA", "NORTHEAST ASIA", "SOUTHEAST ASIA" are the longest). Provide screenshots. |
| AC-9 | Game results are unchanged: replaying the same inputs under both themes yields identical scores, control points, sales and marks. |
| AC-10 | `data-game-theme="evalu8"` is present on `<html>` while viewing an Evalu8 class, viewer or demo, and absent/`smartphone` otherwise. Evalu8 and Smartphone Inc look identical in colour. |
| AC-11 | `grep -rn "TECHNOLOGY_ICONS\|getTechIconComponent" src` returns no hits. |
| AC-12 | All existing tests pass unchanged. |

### Tests to add (`src/tests/gameTheme.test.ts`)

1. `getGameTheme(undefined | null | 'bogus')` returns Smartphone Inc.
2. Smartphone Inc: for all 12 region keys, `regionLabel === key`; for every stored tech name variant (`'GPS','Wifi','WIFI','Wi-Fi','Wi-Fi Technology','Gaming','GAMING','Battery','BATTERY','NFC','4G'`), `techLabel === name` and `normaliseTechKey` resolves.
3. Evalu8: the 12 labels are **unique** and equal to 4.1; the 6 tech labels are unique and equal to 4.2; every label is ≤ 15 characters.
4. Evalu8 **connection fixture**: map each `REGION_CONFIGS[k].connectedRegions` through `regionLabel` and assert it equals the "Connects to" column in Appendix A. This proves the Evalu8 board is the same graph as Smartphone Inc.
5. Icons: every `TechKey` resolves to a defined component in both themes; Evalu8 uses `Anvil, Plug, BatteryCharging, Layers, Zap, Radar`.
6. `buildInitialGameState(teams, 'evalu8').themeId === 'evalu8'`; `buildInitialGameState(teams).themeId === 'smartphone'`.
7. A legacy `MultiWorldSession` with no `themeId` normalises to Smartphone Inc.

---

## 9. Open decisions (Brian)

| # | Question | Recommendation |
|---|---|---|
| O1 | **Perk stories for NFC and 4G.** NFC's effect is "direct sales without a region" and 4G's is "remote sales without an office". The Evalu8 names (Rapid Charge, Self-Driving) need a story. Proposed: *Rapid Charge = charging hubs double as pop-up showrooms*; *Self-Driving = cars deliver themselves to remote buyers.* Self-Driving fits well; Rapid Charge is a stretch. | Accept for v1; revisit Rapid Charge wording after a facilitator reads it aloud. Alternative: keep the neutral mechanic wording ("Direct sales") and drop the story. |
| O2 | Allow a facilitator to **switch theme** after creation? | No (D7). Revisit only if requested. |
| O3 | `SimulationReport` uses a different tech icon set from the rest of the app. Preserve it for Smartphone Inc, or normalise it to the main set? | Preserve (this brief assumes preserve, via `reportIcon`). |
| O4 | **Product wording.** Text such as "products", "Product" icons and "Package" stays generic in v1. Rename to "vehicles"? | Keep generic in v1; the separate Evalu8 icon package covers Product/Improvement icons. |
| O5 | Include the **demo** in the selector (section 5.4) and the **list badge** (5.5)? | Yes to both; they are small. |
| O6 | Dark mode: when the Evalu8 scheme arrives, does it need its own dark variant? | Decide when the scheme is supplied. |

---

## 10. Observations while reading the code (not part of this work — report, do not fix here)

1. Technology names are stored with inconsistent casing: `TECHNOLOGIES` in `data/combinations.ts` uses `'WIFI'`; `initialGameState.ts` and `types/game.ts` carry `'Wifi'`, `'WIFI'` and `'Wi-Fi'` variants; `hasTech` matches with `includes`. The theme layer deliberately uses the same tolerant matching.
2. `lib/phaseEngine.ts` line 121 checks `completedTechs.includes('Wi-Fi Technology')` (an exact match). The stored name appears to be `'WIFI'`, so this check may never match. Confirm whether that carry-over path is live and whether it duplicates the rule applied elsewhere. Do not change it as part of this brief.
3. The description of the "Permanent Technological Benefits" rule lists four perks. NFC and 4G also have effects in the code (NFC direct sales in `SalesPhase`; 4G remote sales gated by the same rule). Consider updating that description for both themes in a separate change.
4. The earlier Evalu8 re-theme package (`gameThemes.ts`, `ThemeProvider`, `evalu8Icons.tsx`) is **not in the repo**. If Antigravity already has those files locally, treat this brief as the replacement for their theme-selection part and reuse their Product/Improvement icons separately.

---

## 11. Suggested implementation order

1. `src/lib/gameTheme.ts` + `gameTheme.test.ts` (labels, tech registry, resolvers). Nothing else changes yet.
2. Types and persistence: `themeId` on `GameState`, `SimulationClass`, `MultiWorldSession`; `buildInitialGameState`, `createClass`, `initializeGame`, `resetGame`.
3. Selector UI in the three creation flows; list badges.
4. Icon registry: replace the eight maps (6.3). Smartphone regression check immediately after.
5. Label remap, file by file (6.1, 6.2, 6.4, 4.4).
6. Colour hook (section 7).
7. QA matrix: 2 themes × {participant dashboard, facilitator dashboard, Viewer, Combined Viewer (single/grid/per-world), Simulation Report, Marks PDF, demo}; attach before/after screenshots for Smartphone Inc and screenshots for Evalu8 Inc.

### Read-only files (do not modify)

`src/data/regions.ts`, `src/data/customers.ts`, `src/data/control.ts`, `src/data/combinations.ts`, `src/data/improvements.ts`, `src/lib/rules.ts`, `src/lib/phaseEngine.ts`, `src/bots/*`, `firestore.rules`.

---

## Appendix A — Region reference (connection fixture for test 4)

Source: `Evalu8_Details_v2.xlsx` (Regions tab), generated from the Smartphone Inc graph. Every link is two-way.

| Internal key | Evalu8 label | Teams (cap) | Logistics | Lowest price | Connects to |
|---|---|---|---|---|---|
| `USA` | **North America** | 5 | 4 | 3 | Europe, Oceania, North Africa, South America, Northeast Asia |
| `Europe` | **Europe** | 5 | 4 | 4 | North America, Southern Africa, Central Europe |
| `China` | **China** | 5 | 4 | 2 | Southern Africa, South Asia, Central Europe |
| `India` | **South Asia** | 4 | 3 | 3 | Oceania, Gulf States, China, Northeast Asia |
| `North Africa` | **Central Europe** | 4 | 3 | 3 | Europe, China, Gulf States, South America |
| `South America` | **South America** | 4 | 3 | 2 | North Africa, North America, Central Europe, Southeast Asia |
| `CIS` | **Southern Africa** | 4 | 3 | 3 | Oceania, China, Europe |
| `Australia` | **Northeast Asia** | 4 | 3 | 4 | North America, North Africa, Southeast Asia, South Asia |
| `Canada` | **Oceania** | 3 | 2 | 4 | Southern Africa, South Asia, North America |
| `Emirates` | **Gulf States** | 3 | 2 | 6 | South Asia, Southeast Asia, Central Europe |
| `RSA` | **Southeast Asia** | 3 | 2 | 2 | South America, Gulf States, Northeast Asia |
| `Caribbean` | **North Africa** | 3 | 2 | 3 | North America, Northeast Asia, South America |

## Appendix B — Where the colleague's original sheet differed (for context only)

The colleague's `Evalu8_Details.xlsx` was matched to Smartphone Inc by logistics cost, cheapest customer and connections. It matched on every region except: Northern Africa/Canada logistics was 3 (code: 2); the connection lists of Southeast Asia and South Asia were in each other's rows; Western Europe and South Asia each had one wrong link; and 14 links were one-way. None of this affects the app, because the app keeps the Smartphone Inc graph. The v2 workbook is the corrected reference.
