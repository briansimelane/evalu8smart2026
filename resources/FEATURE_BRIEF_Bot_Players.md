# Feature Brief — Automated Bot Players ("Play vs Bots")

**Repo:** `briansimelane/evalu8smart2026` (Vite + React + TypeScript + Firebase Firestore, shadcn/ui, GameContext/SessionContext architecture)

**Audience:** Antigravity (AI dev partner). Implement exactly as specified. Where a detail is unspecified, follow the existing patterns in the codebase.

---

## 1. Goal

Allow a facilitator to create a game/class with **up to 5 teams**, where **each team is individually marked as either a HUMAN team or a BOT team**:

- **Human teams** work exactly as today: delegates join via team code, one member claims CEO with a PIN, and they submit decisions each phase.
- **Bot teams** act autonomously. They submit a Planning plan, use improvement cards, allocate research icons, allocate logistics icons, and sell to customers — all without any human input, respecting all existing game rules.

Reference product: **colonist.io** — in Colonist you create a lobby, set the player count, and toggle individual seats between human and bot; bots act with a short "thinking" delay and play a competent, rule-legal game. We want the same feel: mixed human/bot lobbies, bots that act automatically with a visible short delay, and bot seats clearly badged in the UI.

## 2. Hard Constraints — read first

1. **Zero regression.** A game with 0 bots must behave *identically* to the current app. Do not change any existing calculation, phase flow, Firestore document shape semantics (only additive fields), CEO logic, class/team-code logic, analytics, or report output for human teams.
2. **No new backend.** This app has no server or Cloud Functions. Bot logic runs **client-side in the facilitator's session** (see §4). Do not introduce Cloud Functions, schedulers, or external services.
3. **Bots submit through the existing pipeline.** Bot decisions must be written using the same context functions and data shapes humans use (`addRoundData`, `allocateResearch`, `allocateLogistics`, card usage fields, `customersSold`, etc.). Never write bespoke/parallel state for bots. This guarantees PhaseLockCard, TeamSubmissionStatus, play order, control points, Scoreboard, Analytics, and SimulationReport all work unchanged.
4. **Rule-legal only.** Every bot decision must pass the same eligibility checks the UI enforces (combination/position validity, card usage options, research cost incl. patent discounts, region connectivity + `maxTeams` capacity, customer price/value eligibility, sold-customer exclusivity within a round, product/inventory limits).
5. **Additive types only.** New fields on existing interfaces must be optional so old Firestore documents load without migration.

## 3. Data Model Changes (additive)

In `src/types/game.ts`:

```ts
export type BotProfile = 'BALANCED' | 'RESEARCHER' | 'EXPANDER' | 'PRICE_FIGHTER';
export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface Team {
  // ...existing fields unchanged
  isBot?: boolean;            // default false/undefined = human
  botProfile?: BotProfile;    // default 'BALANCED'
  botDifficulty?: BotDifficulty; // default 'MEDIUM'
}
```

Mirror the same optional fields on `ClassTeam`.

In `GameState` add (optional):

```ts
botConfig?: {
  enabled: boolean;          // master switch; facilitator can pause all bots
  seed: number;              // RNG seed set at game creation for reproducible-ish behaviour
};
botActionsLog?: Array<{      // lightweight audit trail, capped at last 200 entries
  round: number;
  phase: string;
  teamId: string;
  summary: string;           // e.g. "Combo 3 / Pos 7, card 12 as product"
  at: string;                // ISO timestamp
}>;
```

**Class creation:** for bot teams, do **not** generate a team code. In `teamCodes`, store the literal string `"BOT"` (or omit the entry — pick whichever is safer against the existing N/A code-loss bug fix; the UI must render a BOT badge, never "N/A"). Login with the string "BOT" must always fail. CEO claim (`claimCeoSlot`) must reject bot teams.

## 4. Execution Model — Facilitator-Hosted Bot Engine

Because there is no server, bots run in the **facilitator's (or admin's) client**:

1. Create a new module `src/bots/botEngine.ts` (pure decision logic, no React, no Firestore) and a hook `src/bots/useBotRunner.ts` (side effects).
2. `useBotRunner` is mounted once (e.g. inside Dashboard or GameProvider) and is **active only when `currentRole` is `FACILITATOR` or `ADMIN`**, the active class has ≥1 bot team, and `botConfig.enabled !== false`. Students never run bot code.
3. The runner watches `gameState` (already live via the Firestore `onSnapshot` in GameContext). Whenever the current phase has bot teams that have **not yet acted**, it queues those bot actions.
4. **Thinking delay (Colonist-style):** each bot action executes after a randomized delay of **2–6 seconds** (configurable constant), staggered per bot so submissions arrive one at a time. Show a subtle toast: "🤖 {TeamName} submitted its plan".
5. **Idempotency guards (critical):**
   - Before writing, re-check current state: if the bot's submission for that round/phase already exists, abort silently.
   - Keep an in-memory `processedActions` Set keyed by `${round}:${phase}:${teamId}` so snapshot re-fires don't double-run.
   - Bots must **never overwrite** an existing submission (human takeover or a second facilitator tab may have written first).
   - Guard against two facilitator tabs: before executing, write a short-lived claim field (e.g. `botClaims.{round}_{phase}_{teamId} = clientInstanceId` on the state doc) and only proceed if the claim readback matches. Keep this simple; a rare duplicate-claim race that results in one write winning is acceptable because writes never overwrite.
6. **Facilitator offline:** bots simply wait; nothing breaks. When the facilitator reopens the app mid-round, the runner catches up on all pending bot actions for the current phase (with delays). Document this behaviour in the UI (small note on the class screen: "Bots act while the facilitator dashboard is open").

## 5. Bot Decision Logic per Phase

All functions live in `botEngine.ts` and are pure: `(gameState, teamId, rng, profile, difficulty) → decision`. Use a small seeded PRNG (e.g. mulberry32) seeded from `botConfig.seed + round*31 + teamIndex`.

Reuse/refactor existing rule logic rather than duplicating it: where eligibility/cost logic currently lives inside components (e.g. customer eligibility in SalesPhase, connectivity in GameContext), extract it into shared pure helpers (e.g. `src/lib/rules.ts`) used by BOTH the UI and the bot engine. This refactor must not change behaviour.

### 5.1 Planning Phase
Bot must produce a full `TeamRoundData` planning submission: combination, position, resulting price/products/improve/research/logistics icons, and card usage decisions (`cardUsages` per available card: `'use' | 'product' | 'none'`).

Selection heuristic:
1. Enumerate all valid (combination, position) pairs from the active combinations data (respect `combinationsData` overrides).
2. Score each pair with profile weights over the yielded stats:
   - BALANCED: even weights on products, research, logistics, mild price preference.
   - RESEARCHER: heavy weight on research icons; wants at least steady product output.
   - EXPANDER: heavy weight on logistics icons.
   - PRICE_FIGHTER: prefers low/negative price with high product counts (volume seller for price customers).
3. Difficulty: HARD picks argmax; MEDIUM picks randomly among the top 3 scores; EASY picks randomly among the top 6.
4. Card usage: for each held card, evaluate `use` vs `product` vs `none` against the profile (e.g. RESEARCHER uses Research-icon cards, PRICE_FIGHTER converts to product or uses Price Plus). EASY bots occasionally (20%) choose `none` (save the card).
5. Submit via the exact same path/handler shape as `PlanningPhase.tsx`'s `handleSubmitPlan` (extract that submission-building logic into a shared helper if needed).

### 5.2 Improvement Phase
The random draw/allocation is a **facilitator action today — keep it that way** (facilitator still clicks draw/reshuffle/allocate). Bots only decide *usage* of cards they receive, which happens in the next Planning phase via `cardUsages`. No bot automation needed here beyond that. (If the current flow requires a per-team claim step, auto-claim for bot teams after the facilitator allocates.)

### 5.3 Research Phase
Given the team's research icons for the round:
1. Determine per-tech remaining cost for this team (base cost, minus patent discount via `getTechnologyCostForTeam`).
2. Target selection: prefer the tech that (a) is closest to completion for this team, (b) has no patent holder yet (patent race), weighted by profile — RESEARCHER aggressively chases the most valuable unpatented tech (use `PATENT_POINTS`); others prefer cheap completions (GPS/Wifi) for sales eligibility.
3. Allocate icons one at a time via `allocateResearch(teamId, tech, points)` respecting caps. Spend all icons unless nothing is legally allocatable.

### 5.4 Logistics Phase
Given logistics icons:
1. Candidate regions = `getAvailableRegionsForTeam(teamId)` (connectivity + capacity already enforced there — reuse it).
2. Score candidates: (customer revenue potential in region for this bot's price/tech position) ÷ (remaining logistics cost), minus a crowding penalty per team already present. EXPANDER ignores the crowding penalty.
3. Prefer finishing a region already partially invested before starting a new one. Allocate via `allocateLogistics`. Spend all icons where legal.

### 5.5 Sales Phase
Sales are sequential in **play order** (`calculatePlayOrder`) and customers are exclusive within a round (`soldCustomers`). The bot runner must act **only when it is the bot's turn** in play order (same rule the UI shows for humans) and must interleave correctly with human teams:
1. When the active team in play order is a bot, wait the thinking delay, then compute its sales.
2. Eligible customers = same eligibility function as the UI (region presence, price customers: team price ≤ customer price; value customers: required tech completed; not already sold this round).
3. Pick up to `productsProduced` (+ card conversions) customers, greedily by revenue; tie-break by leftmost position (control-point tie-break advantage). PRICE_FIGHTER prefers volume in fewer regions to win control; EXPANDER spreads across regions. EASY bots pick randomly among eligible instead of greedily.
4. Submit through the same `addRoundData` path as `SalesPhase.tsx`, including `customersSold`, `salesByRegion`, `revenue`, and eligibility metadata fields, using the same calculation helpers.

### 5.6 Control Phase / Round Advance
Control points are already computed from sales — no bot action. **Round advancement stays a facilitator action** (do not auto-advance).

## 6. UI Changes

1. **GameSetup / class creation (`GameSetup.tsx` + FacilitatorHub class creation):** per team row, add a Human/Bot toggle (Switch with a 🤖 Bot icon). When Bot is on, show two compact selects: Profile (Balanced/Researcher/Expander/Price Fighter) and Difficulty (Easy/Medium/Hard). At least **1 team must be human OR the facilitator confirms an all-bot demo game** (allowed — useful for solo demos, exactly like Colonist's bot games).
2. **Team code display:** bot teams show a `BOT` badge where the team code would be; never a code, never "N/A".
3. **Badges everywhere teams render** (Scoreboard, TeamSubmissionStatus, PhaseLockCard, SummaryMap, phase team selectors): show a small bot icon/badge next to bot team names. In submission status, bot teams show "🤖 Auto" instead of a CEO name.
4. **Facilitator controls** (in GameSettingsDialog or the dashboard header):
   - **Pause/Resume bots** toggle (`botConfig.enabled`).
   - **Take over team:** facilitator can select a bot team and manually enter/edit its decisions using the normal UI (this already works for facilitators — just ensure the bot runner's never-overwrite guard respects it).
   - **Convert seat:** convert a bot team → human (generates a team code on the spot) or human → bot mid-game. Additive field flips only; no state migration.
5. **CEO bar:** hidden/disabled for bot teams.
6. Keep the design consistent with the existing shadcn/Tailwind styling and mobile-friendly (small phone browsers are a key requirement for this app).

## 7. Firestore Rules

Update `firestore.rules` only if the new fields require it. Do not loosen any existing constraint. Bot writes come from the facilitator's authenticated/role context, so they should already be permitted wherever facilitator writes are.

## 8. Edge Cases to Handle

- Facilitator refreshes mid-phase → runner catches up, no duplicate submissions (idempotency guards §4.5).
- Human submits while a bot's delay timer is pending → bot still submits its own team only; never blocked by humans.
- Bot has 0 icons/products in a phase → submit a valid empty/zero action so submission counters complete and the phase can unlock.
- Sales: eligible customers < products → sell to all eligible, remainder unsold (matches human rules).
- Region candidates all full/unreachable → bot banks nothing, logs "no legal expansion".
- Mid-game seat conversion (bot↔human) → next phase onward uses the new mode; prior submissions untouched.
- Legacy classes (no `isBot` fields) → load and behave exactly as today.

## 9. Acceptance Criteria

1. Create a class with 2 human + 3 bot teams: humans get codes, bots show BOT badge and cannot be logged into or CEO-claimed.
2. With the facilitator dashboard open, bots submit Planning within ~2–6s each (staggered), and PhaseLockCard progresses 3/5 → 5/5 as humans submit — using the existing components unmodified.
3. Bots complete Research, Logistics, and Sales legally every round; Sales respects play order and customer exclusivity with humans interleaved.
4. Full 5-round game with 1 human + 4 bots completes; Scoreboard, Analytics, and SimulationReport render correctly with no code changes to those components beyond badges.
5. A 5-human game (0 bots) is behaviourally identical to the current main branch.
6. Pause bots works; take-over works (bot never overwrites the facilitator's manual entry).
7. Two facilitator tabs open simultaneously → no duplicate/conflicting bot submissions.
8. Works on a small phone browser without layout breakage on the setup screen.

## 10. Suggested File Plan

- `src/bots/botEngine.ts` — pure decision functions per phase + scoring + seeded RNG.
- `src/bots/useBotRunner.ts` — watcher, scheduling, delays, idempotency, claims, toasts.
- `src/lib/rules.ts` — extracted shared eligibility/cost helpers (used by UI and bots; behaviour-preserving refactor).
- Types: additive edits in `src/types/game.ts`.
- UI: edits to `GameSetup.tsx`, FacilitatorHub class creation, `TeamSubmissionStatus.tsx`, `PhaseLockCard.tsx`, `Scoreboard.tsx`, `CeoClaimBar.tsx`, `GameSettingsDialog.tsx` (badges/toggles only).

Implement in this order: (1) types + setup UI, (2) rules extraction refactor with zero behaviour change, (3) bot engine for Planning only, (4) runner + idempotency, (5) Research/Logistics, (6) Sales with play-order interleaving, (7) facilitator controls + badges, (8) acceptance test pass.
