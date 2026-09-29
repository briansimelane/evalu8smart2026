# FEATURE BRIEF — Syndicate Marks (Facilitator Only) · v1.0

**Target repo:** `briansimelane/evalu8smart2026` (branch `main`)
**Store at:** `/resources/FEATURE_BRIEF_Syndicate_Marks.md`
**Source of truth for the algorithm:** `Syndicate_Marks_-_Smartphone_Inc_-_One_Year.xlsm`, sheet **`Syndicate Marks Year 2`** (rows 13–72). Every formula below has been re-implemented and reproduces that sheet's cached values exactly (§11).
**Pattern reference:** `briansimelane/TechtabsOnlinev2` — `utils/marksEngine.ts`, `utils/marksPdf.ts`, `resources/FEATURE_Group_Marks_Facilitator.md`. Reuse the *shape* (pure engine, facilitator page, per-team PDF, batch export, per-team adjustment). **Do not reuse the TechTabs maths**: TechTabs is rank-based; this feature is proportional-to-best.

---

## 0. SCOPE GUARD — READ FIRST

1. **Facilitator only.** No student-visible change of any kind. The Marks tab renders only when `currentRole !== 'STUDENT' && !isDemo`. Demo sessions use `currentRole === 'STUDENT'` (see architecture principles), so they are excluded automatically. Do **not** add a new role.
2. **The VP/scoring engine is immutable.** Do not modify `calculateTeamTotalScore`, `getControlPointsForTeamInRound`, `getRegionalControlBreakdownForTeamInRound`, `getTeamPatentPoints`, or anything in `SalesPhase.tsx`, `ControlPhase.tsx`, `SimulationReport.tsx`, `Scoreboard.tsx`. Marks are a **read-only consumer**, with one exception (item 3).
3. **The only new game-state write is the round-close marks snapshot** (§4). It is written inside the existing pure `advanceOnePhase` and inside `endGame`, so it rides the existing transactional write path. There are no new write paths and no new Firestore listeners.
4. **Marks config lives on the class identity document** (`classes/{classId}.syndicateMarksConfig`). It must never go on the game-state document (`classes/{id}/state/game`), which students and viewers read on every tick.
5. **Stable internal keys.** Use `'WIFI'`, region keys and rule IDs exactly as they exist. Nothing is renamed; the theme layer stays display-only.
6. **Do not "improve" the algorithm.** Replicate the workbook. The only permitted deviations are listed in §3.4 and §12 (open decisions).

---

## 1. WHAT THIS FEATURE DOES

Adds a **Marks** tab to each world's facilitator dashboard (`/class/:classId`). It:

- Scores every team in **that world only** against the other teams in the same world. Every world is compared to itself, and multi-world sessions need nothing extra because each world is its own class.
- Works **as at the end of any completed round**, live, including after the game ends.
- Applies the six syndicate criteria with **editable weights** (defaults 20/20/20/20/20 and −10).
- Lets the facilitator enter a **per-team adjustment** (percentage points, with an optional reason) and **exclude a team** (the workbook's `Active = No`).
- Exports a **per-team PDF showing only that team's own results**, a batch export of all teams, and a facilitator-only world summary PDF.

---

## 2. DECISION RECORD (confirmed by Brian)

| # | Decision |
|---|---|
| D1 | The algorithm follows the **workbook** (`Syndicate Marks Year 2`), not the standard-deviation wording in the syndicate brief document. |
| D2 | Each world is compared **to itself**; there is no cross-world pooling. |
| D3 | Lost products are a **penalty only**. The team that lost the most products in the world loses the full penalty weight (default 10%); others lose pro rata; teams with zero losses lose nothing. |
| D4 | Wifi carry-over removes lost products **only if the `tech_permanent_benefits` advanced rule was active for that team in that round** *and* the team held WIFI at the end of that round. It is never retroactive. |
| D5 | Controlled regions = **region-rounds controlled (1st place), summed over rounds**. |
| D6 | Offices = **number of office spaces the company occupies**, summing every region, including multiple offices in one region. Recorded each round and summed over rounds, as in the workbook. |
| D7 | Each patent counts as **1**, regardless of its VP value. |
| D8 | **Bot teams are scored** like any other team when they are part of the world. |
| D9 | Marks are available **at the end of every round** and after the game ends. |
| D10 | Team PDFs show **only that team's own results and performance**, with no other team's names, values or marks (as in TechTabs). |
| D11 | Facilitator-only **Marks** tab, with a per-team **adjustment**. |
| D12 | PDFs use **jsPDF + jspdf-autotable** (rationale in §8.1). |

---

## 3. THE ALGORITHM (authoritative)

### 3.1 Criteria and per-round inputs

`r` = round number, `t` = team. Each criterion has a per-round value; the **cumulative value** is the sum over rounds `1..N`, where `N` is the round the marks are "as at".

| Key | Label | Default weight | Per-round value for team `t` in round `r` | Workbook row (round block / total) |
|---|---|---|---|---|
| `revenue` | Revenue (P × V) | 20% | `rounds[r].teamData[t].revenue` (written by SalesPhase as `price × totalProductsToSell`) | 23 / 60 |
| `controlledRegions` | # Controlled Regions | 20% | Count of regions where `t` ranked **first** at round close (snapshot, §4) | 24 / 61 |
| `offices` | # Offices | 20% | Total completed office spaces held at round close (snapshot) | 25 / 62 |
| `technologies` | # Technologies researched | 20% | Distinct completed technologies held at round close (snapshot) | 26 / 63 |
| `patents` | # Patents | 20% | Count of `gameState.patents` entries held by `t` at round close (snapshot) | 27 / 64 |
| `lostProducts` | Less: Lost products | −10% | `unsold − carriedOver` for round `r` (§3.3) | 28 / 65 |

> **Note (D6):** offices, technologies and patents are **stock** values, recorded every round and then summed. A team that holds 2, 3, 4, 6, 6 offices across five rounds scores 21 ("office-rounds"). This rewards early expansion and is exactly what the workbook does (`round1Offices + … + round5Offices`).

### 3.2 Score and marks

For criteria 1–5, over the **scored set** `S` (§3.5):

```
total_t    = Σ_{r=1..N} value_{t,r}
best       = max_{s∈S} total_s
score_t    = best > 0 ? total_t / best : ZERO_BEST_SCORE      // see §3.4, default 0
marks_t,k  = weight_k × score_t,k
```

For lost products (penalty only, D3):

```
lostTotal_t = Σ_{r=1..N} lost_{t,r}
worst       = max_{s∈S} lostTotal_s
penalty_t   = worst > 0 ? lostTotal_t / worst : 0
marks_t,lost = −lostPenaltyWeight × penalty_t                 // default −0.10
```

Final:

```
subtotal_t = Σ_{k=1..5} marks_t,k + marks_t,lost
total_t    = subtotal_t + adjustment_t / 100                   // adjustment in percentage points
```

Workbook provenance: rows 67–71 `=IF(active, total/MAX(range), 0)`; row 72 `=IF(AND(active, SUM(unsold)<0), unsold/MIN(unsold), 0)` (the workbook stores lost units as negatives, hence MIN; we store positives and use MAX, which is equivalent); rows 14–19 `=weight × score`; row 20 `=SUM(14:19)`.

Compute in full precision. Round **only for display** (1 decimal place for percentages on screen and in PDFs).

### 3.3 Lost products (D3, D4)

For team `t` in round `r` with `td = rounds[r].teamData[t]`:

```
produced = td.productsProduced ?? 0          // already includes Wifi carry-in from the previous round
sold     = (td.customersSold?.length ?? 0) + (td.nfcSalesUnits ?? 0)
unsold   = max(0, produced − sold)
carried  = wifiCarryOverActive(t, r) ? unsold : 0
lost     = unsold − carried
```

`wifiCarryOverActive(t, r)` comes from the round-`r` snapshot (§4): `isRuleActiveForTeam(ruleAdjustments, 'tech_permanent_benefits', t) && hasTech(state, t, 'WIFI')`, both evaluated **at the close of round `r`**. Turning the rule on later does not erase earlier losses, and holding WIFI while the rule is off does not erase losses.

> Why a new calculation: lost products are currently computed three different ways. `Scoreboard.tsx:84` ignores NFC and Wifi; `SimulationReport.tsx:197` ignores Wifi; `SimulationReport.tsx:411` uses the *current* Wifi state, which is retroactive. Do **not** modify those files. The marks engine owns its own helper.

### 3.4 Edge cases

| Case | Rule |
|---|---|
| `best === 0` for a criterion (e.g. nobody has a patent after round 1) | `score = ZERO_BEST_SCORE`, a module constant defaulting to **`0`**. **Deviation from workbook, flagged as open decision O1.** The workbook uses `IFERROR(...,1)` for offices, technologies and patents, which gives every team a free 20% per empty criterion (a team that did nothing would score 40% as at Round 1). Setting the constant to `1` reproduces the workbook exactly. |
| `worst === 0` (nobody lost products) | Penalty 0 for everyone (workbook `SUM(unsold)<0` guard). |
| Team has no `teamData` for a round | Revenue 0, regions 0, lost 0 for that round; snapshot values still count, since the team still holds its offices. |
| Only one team in the scored set | Compute normally (it scores 100% of every non-zero criterion) and show an amber warning. |
| Positive weights don't sum to 100% | Compute anyway; show an amber warning with the actual sum. |
| Total outside 0–100 after adjustment | Display and export clamped to [0, 100]; show the unclamped value in a tooltip (open decision O3). |

### 3.5 Scored set

`S = gameState.teams.filter(t => !config.excludedTeamIds.includes(t.id))`. Bots are included (D8). Excluded teams are omitted from `best`/`worst`, receive no marks and no PDF, and appear greyed out in the table with a "Excluded" chip.

Team order and number: `getTeamNumber(team, index)` from `lib/multiworld/teamLabel.ts`.

---

## 4. ROUND-CLOSE MARKS SNAPSHOT (new data)

### 4.1 Why

Offices, technologies, patents, first-place regions and Wifi-rule status are only available as **current** state. The per-round fields meant to hold history are never written:

- `TeamRoundData.technologiesResearched` and `expansionLocations` are initialised to `[]` in `PlanningPhase.tsx:263`, `RoundInput.tsx:111`, `phaseEngine.ts:61`, `useBotRunner.ts:154` and `useMultiWorldBotRunner.ts:122`, and are never populated.
- `getRegionalControlBreakdownForTeamInRound` uses *current* `regionLogistics.teamsPresent`, so recomputing a past round's control uses today's presence.

Without a snapshot, Round-1 offices cannot be told apart from Round-5 offices, and D4 and D6 cannot be implemented.

### 4.2 Type — append to `src/types/game.ts` (additive only)

```ts
/** Captured once per round at round close. Facts only — never marks. */
export interface RoundMarksSnapshot {
  offices: number;              // Σ_regions getCompletedOffices(region, teamId)
  technologies: number;         // distinct completedTechnologies
  patents: number;              // count of gameState.patents entries held
  controlledRegions: number;    // regions ranked 'first' in this round
  wifiCarryOverActive: boolean; // tech_permanent_benefits active for team AND WIFI held, at round close
  capturedAt: string;           // ISO
}
```

Add **one** optional field to `GameState` (do not reorder existing fields):

```ts
  /** roundNumber (as string key) -> teamId -> snapshot. Written by advanceOnePhase / endGame. */
  marksSnapshots?: Record<string, Record<string, RoundMarksSnapshot>>;
```

Use **string** round keys (`'1'`…`'5'`); Firestore map keys are strings. Read with `String(r)`.

### 4.3 Capture function — new file `src/lib/marks/marksSnapshot.ts`

```ts
import { GameState, RoundMarksSnapshot, getRegionalControlBreakdownForTeamInRound } from '@/types/game';
import { getCompletedOffices, hasTech } from '@/lib/rules';
import { isRuleActiveForTeam } from '@/lib/defaultRules';

/** Pure. Computes the snapshot for every team (bots included) for `roundNumber` from `state` as it stands now. */
export function captureRoundMarksSnapshot(
  state: GameState,
  roundNumber: number,
  now: Date = new Date(),
): Record<string, RoundMarksSnapshot> {
  const roundObj = state.rounds?.find(r => r.roundNumber === roundNumber);
  const out: Record<string, RoundMarksSnapshot> = {};
  (state.teams || []).forEach(team => {
    const offices = Object.values(state.regionLogistics || {})
      .reduce((sum, region) => sum + getCompletedOffices(region, team.id), 0);
    const technologies = new Set(state.teamResearchProgress?.[team.id]?.completedTechnologies || []).size;
    const patents = Object.values(state.patents || {}).filter(h => h === team.id).length;
    const controlledRegions = roundObj
      ? getRegionalControlBreakdownForTeamInRound(roundObj, team.id, state).filter(d => d.rank === 'first').length
      : 0;
    const wifiCarryOverActive =
      isRuleActiveForTeam(state.ruleAdjustments, 'tech_permanent_benefits', team.id) &&
      hasTech(state, team.id, 'WIFI');
    out[team.id] = { offices, technologies, patents, controlledRegions, wifiCarryOverActive, capturedAt: now.toISOString() };
  });
  return out;
}

export function withMarksSnapshot(state: GameState, roundNumber: number, now: Date = new Date()): GameState {
  return {
    ...state,
    marksSnapshots: {
      ...(state.marksSnapshots || {}),
      [String(roundNumber)]: captureRoundMarksSnapshot(state, roundNumber, now),
    },
  };
}
```

`getCompletedOffices` already falls back to `teamsPresent` when `officeCounts` is absent (rule OFF, starting office), and it excludes in-progress builds (see open decision O4).

### 4.4 Integration — `src/lib/phaseEngine.ts`

Both round-close branches of `advanceOnePhase`. Because `MultiWorldControl.tsx` (lines 171, 222) also calls `advanceOnePhase`, lockstep and independent multi-world advances are covered automatically.

**Before (game-end branch, ~line 79):**
```ts
  if (isGameEnd) {
    nextState.gameEnded = true;
    nextState.currentPhase = 'scoring';
    nextState.updatedAt = now;
    return nextState;
  }
```
**After:**
```ts
  if (isGameEnd) {
    const snapped = withMarksSnapshot(nextState, state.currentRound || 5, now);
    snapped.gameEnded = true;
    snapped.currentPhase = 'scoring';
    snapped.updatedAt = now;
    return snapped;
  }
```

**Before (round transition, ~line 107):**
```ts
  if (nextRound > state.currentRound) {
    nextState.currentRound = nextRound;
    nextState.currentPhase = 'planning';
```
**After:**
```ts
  if (nextRound > state.currentRound) {
    // Capture round-close facts BEFORE any transition side effects.
    nextState.marksSnapshots = withMarksSnapshot(nextState, state.currentRound, now).marksSnapshots;
    nextState.currentRound = nextRound;
    nextState.currentPhase = 'planning';
```

Add `import { withMarksSnapshot } from '@/lib/marks/marksSnapshot';`. Change nothing else in this file.

### 4.5 Integration — `src/contexts/GameContext.tsx` `endGame` (~line 759)

`endGame` is called from `Dashboard.tsx:351, 501`, `ControlPhase.tsx:456` and `DemoControlBar.tsx:61`, and bypasses `advanceOnePhase`.

**Before:**
```ts
      return {
        ...prev,
        gameEnded: true,
        updatedAt: new Date()
      };
```
**After:**
```ts
      const now = new Date();
      const snapped = prev.gameEnded ? prev : withMarksSnapshot(prev, prev.currentRound || 1, now);
      return {
        ...snapped,
        gameEnded: true,
        updatedAt: now
      };
```

### 4.6 Snapshot vs live data — what reads from where

| Criterion | Closed round with snapshot | Current round (phase `scoring` / game ended, not yet snapshotted) | Closed round **without** snapshot (game started before this ships) |
|---|---|---|---|
| Revenue | `teamData.revenue` (live; reflects facilitator corrections) | live | live |
| Lost products: unsold | `teamData` (live) | live | live |
| Lost products: Wifi flag | snapshot | `captureRoundMarksSnapshot` (live) | live current state, **flagged "estimated"** |
| Controlled regions / Offices / Technologies / Patents | snapshot | `captureRoundMarksSnapshot` (live) | **excluded for all teams**, amber banner (open decision O2) |

The live path calls the *same* `captureRoundMarksSnapshot`, so a round's numbers do not change at the moment it is snapshotted.

---

## 5. WHICH ROUNDS ARE SCORABLE (D9)

```
isScorable(r) = marksSnapshots[String(r)] exists
             || (r === currentRound && (currentPhase === 'scoring' || gameEnded))
             || r < currentRound                    // legacy rounds (§4.6)
latestScorableRound = max r such that isScorable(r)
```

The header shows a **"Marks as at end of Round N"** select (1..`latestScorableRound`, default = latest). Choosing an earlier round recomputes with `N` = that round. A status badge shows **"Final"** when `gameEnded`, otherwise **"Live — end of Round N"**. If `latestScorableRound === 0`, show the empty state: *"Marks become available when Round 1 reaches the Scoring phase."*

---

## 6. DATA MODEL — CONFIG

### 6.1 Types — append to `src/types/game.ts`

```ts
export type MarksCriterionKey = 'revenue' | 'controlledRegions' | 'offices' | 'technologies' | 'patents';

export interface SyndicateMarksConfig {
  /** Fractions 0–1. Workbook B14:B18. */
  weights: Record<MarksCriterionKey, number>;
  /** Fraction 0–1, applied negatively. Workbook B19 (−0.1). */
  lostProductsPenalty: number;
  /** teamId -> adjustment in percentage points (may be negative). */
  adjustments: Record<string, { points: number; reason?: string }>;
  /** Workbook row 4 'Active = No'. */
  excludedTeamIds: string[];
  updatedAt?: string;
}
```

Add to `SimulationClass` (additive, optional): `syndicateMarksConfig?: SyndicateMarksConfig;`

### 6.2 Defaults — in `src/lib/marks/syndicateMarks.ts`

```ts
export const DEFAULT_SYNDICATE_MARKS_CONFIG: SyndicateMarksConfig = {
  weights: { revenue: 0.2, controlledRegions: 0.2, offices: 0.2, technologies: 0.2, patents: 0.2 },
  lostProductsPenalty: 0.1,
  adjustments: {},
  excludedTeamIds: [],
};
/** §3.4 / O1. 0 = no marks when nobody achieved the criterion. 1 = workbook IFERROR behaviour. */
export const ZERO_BEST_SCORE = 0;
```

Always resolve as `{ ...DEFAULT, ...cfg, weights: { ...DEFAULT.weights, ...cfg?.weights } }`.

### 6.3 Persistence — `src/contexts/SessionContext.tsx`

Add to `SessionContextType` and the provider value:

```ts
updateClassMarksConfig: (classId: string, config: SyndicateMarksConfig) => Promise<void>;
```
```ts
const updateClassMarksConfig = async (classId: string, config: SyndicateMarksConfig) => {
  await updateDoc(doc(db, 'classes', classId), {
    syndicateMarksConfig: { ...config, updatedAt: new Date().toISOString() },
  });
};
```

This follows the existing `archiveClass` pattern. The class doc already has a listener (`SessionContext.tsx:192`), so `activeClass.syndicateMarksConfig` updates without a new listener. In the component, keep a local draft for optimistic UI, **debounce numeric persistence at 600 ms**, and persist immediately on blur and on toggle/select change. Revert out-of-range or `NaN` input to the last valid value.

---

## 7. UI — `src/components/dashboard/SyndicateMarks.tsx`

Use shadcn/ui (`Card`, `Table`, `Input`, `Switch`, `Select`, `Badge`, `Collapsible`, `Tooltip`) and lucide icons, matching `SimulationReport.tsx`. Read `gameState` from `useGame()` (the **unrestricted** context, not `restrictedGameContextValue`) and `activeClass` / `updateClassMarksConfig` from `useSession()`.

### 7.1 Header
World/class name · "Marks as at end of Round [select]" · status badge (§5) · actions: **Export all team PDFs**, **World summary PDF (facilitator)**.

Amber banners, as applicable: legacy rounds without snapshots (§4.6); weights ≠ 100%; fewer than 2 scored teams; excluded teams listed.

### 7.2 Settings (collapsible, closed by default)
- Five weight inputs and the lost-products penalty input, **shown as %**, stored as fractions. Readout: *"Positive weights: 100% · Penalty: −10% · Max attainable: 100%"*.
- Per-team **Include** switches (excluded = workbook `Active = No`). Bots show a small "Bot" badge.
- **Reset to workbook defaults** button (`Undo2` icon).

### 7.3 Marks table
Columns = teams (sticky first column with labels, horizontal scroll). For each of the six criteria, one row per team cell showing, stacked:
`cumulative value` · `score % of best` (muted) · **marks earned** (bold; lost-products marks shown in red, e.g. −5.0%).

Then:
- **Subtotal**
- **Adjustment (pp)**: bordered numeric input (accepts negatives, blank = 0) plus an optional reason text input
- **TOTAL MARK**: large, bold, blue tint; tooltip with the unclamped value if clamped

Footer row per team: **Report (PDF)** button (`FileText`).

### 7.4 Round breakdown (collapsible)
Per criterion, a table of rounds × teams showing the per-round value. Cells from the live path show a small "live" dot; estimated cells (§4.6) show an amber `AlertTriangle` with a tooltip. This is the audit trail if a team queries its mark.

### 7.5 Methodology note (collapsible)
Plain-language statement: cumulative totals over rounds; score = team total ÷ best total in this world; marks = weight × score; lost products penalty = team losses ÷ highest losses in this world × penalty weight; Wifi carry-over only when the Permanent Tech Benefits rule was on in that round; adjustment added last.

### 7.6 Dashboard integration — `src/components/Dashboard.tsx`

Define once near the other role flags: `const isFacilitatorView = currentRole !== 'STUDENT' && !isDemo;`

**Bottom TabsList (~line 653). Before:**
```tsx
<TabsList className="flex sm:grid sm:grid-cols-6 gap-1 h-auto w-full border border-border p-1 sm:p-1.5 rounded-xl overflow-x-auto scrollbar-none snap-x touch-pan-x">
```
**After:**
```tsx
<TabsList className={`flex sm:grid ${isFacilitatorView ? 'sm:grid-cols-7' : 'sm:grid-cols-6'} gap-1 h-auto w-full border border-border p-1 sm:p-1.5 rounded-xl overflow-x-auto scrollbar-none snap-x touch-pan-x`}>
```

Immediately after the `report` `TabsTrigger`:
```tsx
{isFacilitatorView && (
  <TabsTrigger value="marks" className="flex-1 shrink-0 flex-col sm:flex-row gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2">
    <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
    <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">Marks</span>
  </TabsTrigger>
)}
```

Immediately after the `report` `TabsContent` (~line 845), inside the same fragment:
```tsx
{isFacilitatorView && (
  <TabsContent value="marks" className="space-y-4">
    <SyndicateMarks />
  </TabsContent>
)}
```

Add `GraduationCap` to the lucide import and `import { SyndicateMarks } from './dashboard/SyndicateMarks';`. The student tab bar must be byte-identical in rendered output.

---

## 8. PDF EXPORT — `src/lib/marks/marksPdf.ts`

### 8.1 Library choice (D12)
**jsPDF + jspdf-autotable.** `react-to-print` only opens the browser print dialog for a rendered DOM node. The facilitator would have to click "Save as PDF" once per team, the file name and layout would depend on the browser, and batch export would be impossible. jsPDF builds the file in code: consistent A4 layout, automatic file names, one-click batch export of every team, and the same library and structure already proven in TechTabs (`utils/marksPdf.ts`).

`package.json` → `dependencies` (the only dependency change):
```json
"jspdf": "^4.2.1",
"jspdf-autotable": "^5.0.8"
```
Import at the top of `marksPdf.ts` only. Load it from the component with `await import('@/lib/marks/marksPdf')` so jsPDF stays out of the main bundle. Leave `react-to-print` untouched.

### 8.2 Per-team PDF (D10: own results only)
A4 portrait, 14 mm margins. Filename: `SyndicateMarks_{className}_{teamName}_R{N}.pdf` (non-alphanumerics → `_`).

**Header:** `Syndicate Assignment — Business Simulation Results` (bold 13pt) · `{class name}` · `Team {number}: {team name}` · `Marks as at end of Round {N}` (or `Final — Round {N}`) · `Generated {DD MMM YYYY}` (8pt muted).

**Table 1 — Mark summary**: `Criterion | Weight | Your result | Score (% of best in your world) | Marks`
Six rows in §3.1 order (lost products: weight shown as −10%, result = units lost, score = % of highest loss, marks negative). Then `Subtotal`, `Facilitator adjustment` (with reason in a smaller line beneath, if present), `TOTAL MARK` (bold, larger, light-blue fill, clamped per §3.4).

**Table 2 — Your round-by-round performance**: rows = six criteria, columns = `R1 … RN | Total`. Own team only.

**Methodology** (short paragraph, 8pt): the §7.5 text.

**Footer every page:** `{class name} · {team name} · Page X of Y`.

**Must not appear:** any other team's name, number, values, scores or marks; the world's best or worst absolute values. (A team can infer the best value from its own % of best, which is intended and matches the workbook's "Score %".)

Styling: `theme: 'grid'`, head fill `#1e293b` white text, body 9pt, alternate rows `#f8fafc`, numeric columns right-aligned. Revenue formatted as `$` with thousands separators, matching `SalesPhase.tsx`.

### 8.3 Batch export
**Export all team PDFs** loops the scored set and saves one file per team, sequentially, with an `await new Promise(r => setTimeout(r, 250))` between saves so the browser doesn't drop downloads. The button is disabled during the run with progress text `Generating 3 of 5…`. Excluded teams are skipped. No zip dependency.

### 8.4 World summary PDF (facilitator copy)
A4 landscape. Title suffix **"FACILITATOR COPY — contains all teams"** in red. Contents: the §7.3 grid (all teams, values / score % / marks, adjustments with reasons, totals) plus the current weights. Filename `SyndicateMarks_{className}_R{N}_FACILITATOR.pdf`.

---

## 9. MODULE API — `src/lib/marks/syndicateMarks.ts`

Pure functions only: no React, no Firebase, no DOM.

```ts
export const MARKS_CRITERIA = [
  { key: 'revenue',           label: 'Revenue (P × V)',            format: 'currency' },
  { key: 'controlledRegions', label: '# Controlled Regions',        format: 'int' },
  { key: 'offices',           label: '# Offices',                   format: 'int' },
  { key: 'technologies',      label: '# Technologies researched',   format: 'int' },
  { key: 'patents',           label: '# Patents',                   format: 'int' },
] as const;

export interface RoundTeamMetrics {
  revenue: number; controlledRegions: number; offices: number;
  technologies: number; patents: number;
  unsold: number; carriedOver: number; lostProducts: number;
  source: 'snapshot' | 'live' | 'legacy';
  estimated: Partial<Record<MarksCriterionKey | 'lostProducts', string>>; // key -> reason
  excludedCriteria: MarksCriterionKey[];   // legacy rounds (§4.6)
}

/** roundNumber -> teamId -> metrics, for rounds 1..uptoRound. Implements §3.3, §4.6. */
export function collectRoundMetrics(state: GameState, uptoRound: number): Record<number, Record<string, RoundTeamMetrics>>;

export interface TeamMarksResult {
  teamId: string; teamName: string; teamNumber: number; isBot: boolean; excluded: boolean;
  totals: Record<MarksCriterionKey | 'lostProducts', number>;
  scores: Record<MarksCriterionKey | 'lostProducts', number>;   // 0–1
  marks:  Record<MarksCriterionKey | 'lostProducts', number>;   // fractions; lost ≤ 0
  subtotal: number; adjustmentPoints: number; adjustmentReason?: string;
  totalRaw: number; totalClamped: number;                       // fractions
  perRound: Record<number, RoundTeamMetrics>;
}

export interface WorldMarksResult {
  asAtRound: number; latestScorableRound: number; isFinal: boolean;
  teams: TeamMarksResult[]; warnings: string[];
  positiveWeightSum: number;
}

/** Pure core used by the golden fixture: takes metrics directly. */
export function computeSyndicateMarks(
  teams: Array<{ id: string; name: string; isBot?: boolean; teamNumber: number }>,
  metrics: Record<number, Record<string, Pick<RoundTeamMetrics, MarksCriterionKey | 'lostProducts'>>>,
  config: SyndicateMarksConfig,
  asAtRound: number,
): WorldMarksResult;

/** Convenience wrapper for the UI: collectRoundMetrics + computeSyndicateMarks. */
export function computeWorldMarks(state: GameState, config: SyndicateMarksConfig | undefined, asAtRound?: number): WorldMarksResult;
export function getLatestScorableRound(state: GameState): number;
```

Deterministic and side-effect free.

---

## 10. FILE PLAN

**New**
- `src/lib/marks/marksSnapshot.ts`: capture (§4.3)
- `src/lib/marks/syndicateMarks.ts`: engine (§3, §9)
- `src/lib/marks/marksPdf.ts`: PDFs (§8)
- `src/components/dashboard/SyndicateMarks.tsx`: UI (§7)
- `src/tests/syndicateMarks.test.ts`: golden fixture and unit tests (§11)

**Modified (exactly these)**
- `src/types/game.ts`: `RoundMarksSnapshot`, `GameState.marksSnapshots?`, `MarksCriterionKey`, `SyndicateMarksConfig`, `SimulationClass.syndicateMarksConfig?`
- `src/lib/phaseEngine.ts`: two snapshot captures (§4.4)
- `src/contexts/GameContext.tsx`: `endGame` capture only (§4.5)
- `src/contexts/SessionContext.tsx`: `updateClassMarksConfig` (§6.3)
- `src/components/Dashboard.tsx`: facilitator tab trigger and content (§7.6)
- `package.json`: jsPDF deps (§8.1)

**Read-only (must not change)**
`SalesPhase.tsx`, `ControlPhase.tsx`, `SimulationReport.tsx`, `Scoreboard.tsx`, `FinancialsPhase.tsx`, `lib/rules.ts`, `lib/defaultRules.ts`, `lib/roundSnapshot.ts`, `data/*`, `pages/Viewer/**`, `bots/**`, `hooks/useMultiWorldBotRunner.ts`, `pages/MultiWorldControl.tsx`, `demo/**`, `firestore.rules`, and every `calculateTeamTotalScore` / control-point function in `types/game.ts`.

---

## 11. GOLDEN FIXTURE — ACCEPTANCE TESTS

Encode in `src/tests/syndicateMarks.test.ts` (vitest) against `computeSyndicateMarks`. Inputs are the workbook's `Syndicate Marks Year 2` rows 23–57 (team 3 played no rounds; it is *included* with zeros, as in the workbook where Active = Yes). Weights: defaults. Tolerance `1e-9`.

**Per-round inputs** (T1, T2, T3, T4, T5)

| Round | Revenue | Ctrl regions | Offices | Techs | Patents | Lost |
|---|---|---|---|---|---|---|
| 1 | 6, 12, 0, 10, 25 | 1, 2, 0, 2, 2 | 2, 2, 0, 2, 2 | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 | 1, 0, 0, 0, 1 |
| 2 | 15, 12, 0, 12, 30 | 1, 2, 0, 1, 2 | 2, 3, 0, 3, 3 | 1, 1, 0, 1, 0 | 1, 1, 0, 0, 0 | 0, 0, 0, 0, 1 |
| 3 | 30, 20, 0, 14, 21 | 2, 2, 0, 2, 3 | 3, 4, 0, 4, 3 | 2, 2, 0, 1, 1 | 1, 2, 0, 0, 1 | 0, 0, 0, 0, 0 |
| 4 | 48, 40, 0, 30, 36 | 1, 4, 0, 4, 2 | 4, 6, 0, 5, 3 | 4, 3, 0, 2, 2 | 2, 2, 0, 0, 2 | 0, 0, 0, 0, 0 |
| 5 | 56, 39, 0, 32, 48 | 3, 5, 0, 2, 3 | 5, 6, 0, 6, 5 | 5, 3, 0, 3, 3 | 2, 2, 0, 0, 2 | 0, 0, 0, 0, 0 |

**Test 1 — as at Round 5 (must equal workbook rows 14–20 and 60–72 exactly)**

| | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| Totals: Rev / Reg / Off / Tech / Pat / Lost | 155 / 8 / 16 / 12 / 6 / 1 | 123 / 15 / 21 / 9 / 7 / 0 | 0 / 0 / 0 / 0 / 0 / 0 | 98 / 11 / 20 / 7 / 0 / 0 | 160 / 12 / 16 / 6 / 5 / 2 |
| Revenue marks | 0.19375 | 0.15375 | 0 | 0.1225 | 0.2 |
| Regions marks | 0.1066667 | 0.2 | 0 | 0.1466667 | 0.16 |
| Offices marks | 0.1523810 | 0.2 | 0 | 0.1904762 | 0.1523810 |
| Technologies marks | 0.2 | 0.15 | 0 | 0.1166667 | 0.1 |
| Patents marks | 0.1714286 | 0.2 | 0 | 0 | 0.1428571 |
| Lost marks | −0.05 | 0 | 0 | 0 | −0.1 |
| **Total** | **0.7742261905** | **0.90375** | **0** | **0.5763095238** | **0.6552380952** |

Displayed: **77.4%, 90.4%, 0.0%, 57.6%, 65.5%**.

**Test 2 — as at Round 2:** totals `0.6863636364, 0.8872727273, 0, 0.63, 0.5`.

**Test 3 — as at Round 1 (`ZERO_BEST_SCORE = 0`, default):** technologies and patents have `best = 0` → score 0. Totals `0.248, 0.496, 0, 0.48, 0.5`.
**Test 3b — same with `ZERO_BEST_SCORE = 1`:** totals `0.648, 0.896, 0.4, 0.88, 0.9` (workbook `IFERROR` behaviour).

**Further required assertions**

4. **Penalty only / worst loses full weight:** in Test 1, T5 (2 lost, the most) marks = −0.10 exactly; T1 (1 lost) = −0.05; zero-loss teams = 0 (never positive).
5. **No losses anywhere:** set all lost to 0 → every lost mark is 0.
6. **Weights editable:** weights 30/10/20/20/20, penalty 15% → T2 total = 0.3×0.76875 + 0.1×1 + 0.2×1 + 0.2×0.75 + 0.2×1 − 0 = **0.880625**.
7. **Adjustment:** T4 adjustment +5 pp → `totalRaw = 0.6263095238`; adjustment −70 pp on T3 → `totalRaw = −0.7`, `totalClamped = 0`.
8. **Exclusion:** exclude T5 → revenue best becomes 155, so T1 revenue marks = 0.2; T5 absent from `teams` results' scored set and gets no PDF.
9. **Lost products and Wifi (D4)**, via `collectRoundMetrics` on a synthetic `GameState`: produced 5, `customersSold` 3, `nfcSalesUnits` 1 → unsold 1.
   - snapshot `wifiCarryOverActive: false` → lost 1
   - snapshot `wifiCarryOverActive: true` → lost 0, carriedOver 1
   - team holds WIFI but `tech_permanent_benefits` **off** at capture → snapshot false → lost 1
   - rule switched **on** in round 3: rounds 1–2 snapshots stay false, and their losses still count.
10. **Snapshot capture:** `advanceOnePhase` from `currentPhase: 'scoring'`, round 1 → result has `marksSnapshots['1']` for **every** team including bots; from scoring round 5 → `marksSnapshots['5']` and `gameEnded: true`. `endGame` mid-round 3 → `marksSnapshots['3']`. Calling `endGame` twice does not overwrite.
11. **Offices count occupied spaces (D6):** region with `officeCounts: { t1: 3 }` plus a starting region in `teamsPresent` → `offices = 4`.
12. **Existing tests still pass:** `phaseEngine.test.ts`, `gameRules.test.ts`, `gameRulesAndViewerSync.test.ts`, `actionMatrix.test.ts`, `archiveLifecycle.test.ts`.
13. `computeSyndicateMarks` called twice with identical inputs returns deeply equal results.

---

## 12. OPEN DECISIONS (defaults applied; Brian to confirm)

| # | Question | Default implemented | Alternative |
|---|---|---|---|
| O1 | When nobody in the world has achieved a criterion (e.g. no patents after Round 1), what score does everyone get? | **0**: nobody earns marks for something nobody did. Only affects early-round marks; Round 5 results are identical to the workbook. | **1**: workbook `IFERROR` behaviour (every team gets the full weight; a team that did nothing scores 40% at Round 1). Flip `ZERO_BEST_SCORE`. |
| O2 | Games that started before this feature shipped have no snapshots for earlier rounds. | Those rounds are **excluded for all teams** from regions, offices, technologies and patents; revenue and lost products still count; amber banner. | Estimate from current state (overstates early rounds). Only affects games already in progress; the 6–7 Nov sessions will have full snapshots. |
| O3 | Totals outside 0–100% after adjustment | **Clamp** on screen and in the PDF; unclamped value shown in a tooltip. | Show unclamped. |
| O4 | Do offices still being built (in progress, slot reserved) count as occupied spaces? | **No**: completed offices only, consistent with control-point scoring. | Count in-progress builds via `isTeamBuildingOffice`. |
| O5 | Should the team PDF show the **% of best** column? | **Yes**: it explains the mark (as the workbook's "Score %" does) without naming other teams. | Show only own values and marks. |

---

## 13. DEFINITION OF DONE

- [ ] Marks tab visible to FACILITATOR/ADMIN only. The student and demo tab bars are unchanged (6 tabs, `sm:grid-cols-6`).
- [ ] All §11 tests pass (`npx vitest run`); all pre-existing tests pass.
- [ ] Advancing a round (single world, and lockstep multi-world via `MultiWorldControl`) writes `marksSnapshots` for that round; `endGame` writes the current round.
- [ ] Marks are available at the end of every round (phase `scoring`) and after the game ends; the round selector recomputes correctly.
- [ ] Weights, penalty, exclusions and adjustments persist on `classes/{id}.syndicateMarksConfig`, survive reload and switching class away and back, and debounce at 600 ms.
- [ ] Per-team PDF contains no other team's name, values or marks (manually verify one export).
- [ ] Batch export produces one file per included team with no dropped downloads.
- [ ] Zero new Firestore listeners: grep the diff for `onSnapshot`, `getDoc(`, `getDocs(`; expect none.
- [ ] `git diff --stat` touches only the §10 files; `package.json` changes only by the two jsPDF entries.
- [ ] `npm run build` succeeds with no new TypeScript errors.

---

## 14. OBSERVED, NOT IN SCOPE (log for follow-up briefs)

1. `phaseEngine.ts` round transition checks `completedTechs.includes('Wi-Fi Technology')`, but the tech key is `'WIFI'` (`data/combinations.ts`). `advancedState.carriedOverProducts` is therefore never written. Live carry-over works through `getCarriedOverProductsForTeam` instead.
2. `TeamRoundData.technologiesResearched` / `expansionLocations` are never populated, so `buildGameStateForRound` (used by `ParticipantWorldMap` round replay) rebuilds presence and patents from empty arrays.
3. `roundSnapshot.ts:13` looks up `INITIAL_TEAM_REGIONS[team.color]`, but the map is keyed by colour *name* (`'Green'`…), while `initialGameState.ts` correctly uses `getTeamColorName`.
4. Lost products are calculated inconsistently in `Scoreboard.tsx:84` (no NFC, no Wifi) and `SimulationReport.tsx:197` (no Wifi) versus `:411` (retroactive Wifi).
5. The `firestore.rules` catch-all (`allow read, write: if true`) is still open. `syndicateMarksConfig` is hidden in the UI but readable by anyone who can read `classes/{id}`.
6. **Student-facing brief wording:** the *2026 Simulation Syndicate Assignment Brief* "Evaluation Methodology" section describes standard-deviation scoring, but marks are calculated as a percentage of the best team per world (D1). Update the document before 6 November 2026.
