# Feature Brief — Solo Demo Mode ("Play the Demo": 1 human vs 4 bots, self-expiring after 7 days)

**Repo:** `briansimelane/evalu8smart2026` (Vite + React 18 + TypeScript + Firebase Firestore, shadcn/ui, `SessionContext` / `GameContext` architecture)

**Audience:** Antigravity (AI dev partner). Implement exactly as specified. Where a detail is unspecified, follow the existing patterns in the codebase.

**Depends on:** `resources/FEATURE_BRIEF_Bot_Players.md` (bot engine — already implemented in `src/bots/`) and `resources/VIEWER_FEATURE_SPEC.md` (projector Viewer — already implemented in `src/pages/Viewer/`).

**Revision note (v2):** v1 of this brief specified a browser-only demo with zero Firestore involvement. This revision adds **persistence via Firebase anonymous auth with a 7-day Firestore TTL policy**, so a participant can close the tab and come back to their game, while demo data self-deletes and cannot accumulate. §5 and §6 are new/rewritten; §14 documents the simpler no-auth alternative if you'd rather not take on anonymous accounts.

---

## 1. Goal

Let a single visitor play a **complete solo game of Smartphone Inc against 4 bots** with no login, no class, no team code and no CEO PIN — and have that game **still be there when they return, for up to a week**.

The demo participant:

1. Controls **one human team** and plays it exactly as a delegate/CEO does today (Planning, Improvement claim, Research, Logistics, Sales).
2. Plays against **4 bot teams** driven by the existing `src/bots/botEngine.ts` + `useBotRunner`.
3. **Advances the phase and the round themselves** — there is no facilitator in the room, so the participant gets the flow controls a facilitator would normally hold.
4. Can **open the Viewer** (the projector board) and see the live game.
5. Sees **only open (public) information about the bot teams** — never their hidden plan. Full detail is visible for their own team only.
6. Can **leave and resume** on the same browser for 7 days, after which the game deletes itself automatically.

**Why:** a shareable "try it before you book it" link for prospects and new facilitators, and a training sandbox for delegates before a live session. Persistence matters because a prospect rarely finishes 5 rounds in one sitting.

---

## 2. Hard Constraints — read first

1. **Zero regression.** Nothing about the existing authenticated flows (Login, AdminHub, FacilitatorHub, class creation, team codes, CEO claim, live class play, Viewer) may change behaviour. Every edit to a shared file must be **additive and behind an `isDemo` check**.
2. **Demo writes touch exactly one place: `demo_games/{demoId}`.** A demo must never read or write `classes/*`, `facilitators/*`, or `evalu8smart_sessions/default_game`. See §6 — this is the highest-risk area in the feature.
3. **Demo data must be self-expiring.** Every demo document carries an `expiresAt` timestamp and is deleted by a Firestore TTL policy. No demo data may live indefinitely. No Cloud Functions or schedulers.
4. **No new npm dependencies.** `firebase` (already present) covers anonymous auth and TTL-eligible writes; TTL itself is a database-level config, not code.
5. **Reuse, do not fork.** The demo runs the **same** `Dashboard`, the **same** phase components, the **same** `GameContext` functions, and the **same** bot engine. Do **not** create a parallel demo Dashboard or duplicate any rules logic. The demo is a *persistence swap plus a visibility filter*, not a second app.
6. **Rule-identical.** A demo game must produce exactly the scores a real game with the same inputs would.
7. **No credentials required.** `/demo` must be reachable while signed out. The only auth call permitted is `signInAnonymously`, and only under the guard in §5.2.

---

## 3. Definition of "Open Information"

The participant must see bot teams the way a player at the physical table sees opponents: whatever is **face-up on the board**, and nothing else.

> **The canonical rule: open information = exactly what the projector Viewer (`src/pages/Viewer/*`) renders.** If the Viewer shows it, the demo participant may see it for bot teams. If the Viewer does not show it, it is hidden until the phase in which the board reveals it.

### 3.1 Visibility matrix

| Field (per bot team) | Visible to demo participant? | Revealed when |
|---|---|---|
| Team name, colour, bot badge | ✅ Always | — |
| Turn order position | ✅ Always | — |
| `price` | ✅ Once that bot has submitted its plan for the round | Planning submission (price ladder is public) |
| Region presence, `regionInvestments`, logistics progress | ✅ Always | — |
| Technology progress (`teamProgress`), completed techs, patent holders | ✅ Always | — |
| Improvement cards taken / still in the pool / holder | ✅ Always | — |
| `customersSold`, `salesByRegion` | ✅ As sold | Sales phase, live |
| `revenue`, control points, total score | ✅ Once the round's Control/Scoring is calculated | Control phase |
| `combination` and `position` | ❌ **Hidden** | Only at end of game (§12) |
| `productsProduced` (inventory) | ❌ Hidden before Sales | Becomes derivable during Sales; show only the count already sold |
| `cardUsages` / `improvementCardUsage` | ❌ Hidden | Effects are visible via price/products; the choice itself is not |
| `researchIcons` / `logisticsIcons` totals for the round | ❌ Hidden | Only the *allocations* they make are public |
| Anything for a phase the bot has not yet acted in | ❌ Hidden | On bot action |

### 3.2 Where this must be enforced

The demo participant runs with `currentRole === 'STUDENT'`, so the existing per-team edit gating in `PlanningPhase`, `LogisticsPhase`, `ResearchPhase`, `SalesPhase` and `ImprovementPhase` already prevents them from *selecting* or *editing* another team. Those gates are sufficient for **write** protection. What is **not** yet protected is **read** leakage in the data-view tabs. Audit and mask at minimum:

- `src/components/dashboard/Scoreboard.tsx` — line ~140 renders `Combo {combination}-{position}`. Must render `—` for bot teams in demo.
- `src/components/dashboard/CurrentState.tsx` — `productsProduced` cells (~line 118, ~line 217) and the combination columns.
- `src/components/dashboard/Analytics.tsx`, `FinancialsPhase.tsx`, `SimulationReport.tsx` — any per-team combination/position/production breakdown.
- `src/components/dashboard/PlanningPhase.tsx` turn-order strip — keep the `$price` badge (public), keep "Pending"/"Thinking…", hide nothing else there.
- `src/components/dashboard/TeamSubmissionStatus.tsx` and `PhaseLockCard.tsx` — submitted/not-submitted is public; leave as is.

**Implementation:** a single pure helper, not scattered conditionals.

```ts
// src/demo/demoVisibility.ts
export const DEMO_HIDDEN_FIELDS = [
  'combination', 'position', 'cardUsages', 'improvementCardUsage',
  'improvementCardId', 'improvementCards', 'researchIcons', 'logisticsIcons',
] as const;

/** Returns a copy of gameState with hidden fields stripped from every team
 *  that is NOT `humanTeamId`. Pure; never mutates. No-op when isDemo is false. */
export function maskGameStateForDemo(
  gameState: GameState,
  humanTeamId: string,
  opts?: { revealAll?: boolean }   // used by the post-game reveal, §12
): GameState;
```

**Mask on read, never on write.** The masked state is what feeds the React tree; the **unmasked** state is what persists to Firestore. If you mask before persisting, you will permanently destroy the bots' plans and break both scoring and the end-of-game reveal. Apply `maskGameStateForDemo` at the boundary where `GameProvider` hands `gameState` to consumers, downstream of the persistence layer.

Components then only need to handle `undefined` gracefully (render `—`). Where a component would crash on `undefined`, mask to a sentinel (`0` / `''`) rather than deleting the key, and render the sentinel as `—` when `isDemo && !isMyTeam`.

> This is a local demo with no secrets, so best-effort UI masking is the correct level of effort. Do not over-engineer it.

---

## 4. Routes, entry point and shape

| Route | Public? | Renders |
|---|---|---|
| `/demo` | ✅ | `DemoSetup` if no resumable demo, otherwise the demo `Dashboard` |
| `/demo/viewer` | ✅ | The existing Viewer board, fed from demo state (§10) |

- Add both routes in `src/App.tsx` **outside** `SessionProviderWrapper` — no role guard, no redirect to `/login`.
- On `src/pages/Login.tsx`, below the Student/Staff tabs, add a quiet tertiary link/button: **"Just exploring? Play the demo →"** navigating to `/demo`. Style it as a text button so it never competes with real login.
- `NotFound` and `IndexRedirect` must be untouched.

---

## 5. Persistence Model — anonymous auth + 7-day TTL

### 5.1 Data shape — one flat document

```
demo_games/{demoId}
  {
    demoId:     string,
    ownerUid:   string,          // Firebase anonymous (or existing) auth uid
    humanTeamId:'team_1',
    gameState:  GameState,       // the entire unmasked state, as one blob
    createdAt:  Timestamp,
    updatedAt:  Timestamp,
    expiresAt:  Timestamp        // TTL field — always now + 7 days
  }
```

Two non-negotiable properties of this shape:

**(a) A separate top-level collection, not under `classes`.** `SessionContext` runs `onSnapshot(collection(db, 'classes'))` with no filter (~line 120), so every facilitator's browser downloads every class document. Demo games inside `classes` would be pulled down by every real user on every session, and would appear in `FacilitatorHub`.

**(b) A single flat document, no subcollections.** **Firestore TTL does not delete subcollections under a deleted document.** Mirroring the live schema (`demo_games/{id}/state/game`, `.../teams/{id}`) would leave orphaned subcollection documents behind permanently — the exact accumulation problem this design exists to prevent. The whole `GameState` goes in one field. This is already proven to fit: `classes/{classId}/state/game` stores the identical blob today, well inside the 1 MiB document limit for a 5-team, 5-round game.

### 5.2 Anonymous auth

Enable **Anonymous** sign-in in Firebase console → Authentication → Sign-in Methods.

```ts
// src/demo/demoAuth.ts
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function ensureDemoUid(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;   // ← see warning below
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}
```

⚠️ **`signInAnonymously` replaces `auth.currentUser`.** If a signed-in facilitator opens `/demo`, calling it unconditionally destroys their session and logs them out of their real class. The `if (auth.currentUser) return ...` guard above is mandatory — a signed-in facilitator simply owns the demo under their real uid, which is harmless.

`SessionContext`'s `onAuthStateChanged` handler (~line 78) writes `user.email` into state and localStorage. An anonymous user has `email === null`, so it would write `''` and corrupt the stored identity. Add an early return:

```ts
onAuthStateChanged(auth, (user) => {
  if (user?.isAnonymous) return;   // demo users are not app identities
  // ...existing logic unchanged
});
```

### 5.3 TTL policy — the 7-day expiry

TTL is a **database-level configuration**, not code, so it satisfies the no-backend constraint. Declare it in the existing `firestore.indexes.json` so it deploys through your normal `firebase deploy` flow:

```json
{
  "fieldOverrides": [
    {
      "collectionGroup": "demo_games",
      "fieldPath": "expiresAt",
      "ttl": true,
      "indexes": []
    }
  ]
}
```

Behaviours to design around:

- Data is typically deleted **within 24 hours after** the expiry time, not at the instant. A 7-day TTL means "gone in 7–8 days". Say "7 days" in the UI and don't promise precision.
- The field **must be a Firestore `Timestamp`** — a string or number silently disables TTL for that document. Write `Timestamp.fromDate(new Date(Date.now() + 7 * 864e5))`, never an ISO string. (Your `removeUndefined` helper in `src/lib/utils.ts` returns non-plain objects untouched, so a `Timestamp` passes through it safely — verified.)
- **Sliding expiry:** Firestore always honours the *latest* value of the TTL field, so re-stamping `expiresAt` on every write gives you "7 days from last activity" for free. An active player is never deleted mid-game; an abandoned game clears a week after it was dropped. Do this — it costs nothing since you are writing anyway.
- TTL deletes are billed as normal document deletes. At demo volumes this is negligible.

### 5.4 Anonymous account accumulation

Anonymous *auth accounts* accumulate independently of Firestore documents, and TTL does not touch them. Mitigation, done once in the console:

- Upgrade the project to **Firebase Authentication with Identity Platform**, then enable **automatic clean-up** under Authentication → Settings. This deletes anonymous accounts older than 30 days, and — usefully — anonymous auth then stops counting toward usage limits and billing quotas.
- The mismatch between the 30-day account sweep and the 7-day game TTL is harmless: the game data vanishes first and an empty uid lingers briefly before being swept.

### 5.5 Write volume — the real cost driver

`mutateGameState` serialises the **entire** `GameState` on **every** mutation via `setTimeout(..., 0)`. With four bots acting each phase, a full 5-round demo is several hundred full-document writes.

Nothing else reads a demo game live (the Viewer is in-page, §10), so in demo mode replace the immediate write with a **~2 second trailing debounce**, plus a forced flush on `visibilitychange`/`pagehide` so a closing tab doesn't lose the last move. This cuts writes by roughly an order of magnitude. Do **not** change the write timing for live class games — there, immediacy is the product.

### 5.6 Serialisation hazard

`RoundData.soldCustomers?: Set<string>` is a `Set`. Firestore cannot store a `Set`, and `removeUndefined` passes non-plain objects through untouched — so this will throw on write rather than fail quietly. Either convert `Set` ↔ array at the persistence boundary, or confirm the field is unused at runtime before relying on the round-trip. Also re-hydrate `createdAt`/`updatedAt` through the existing `toValidDate` helper in `GameContext` on load.

### 5.7 Security rules

Add to `firestore.rules`. The `expiresAt` ceiling is the important half — without it a client can set the year 3000 and TTL never fires:

```js
match /demo_games/{demoId} {
  allow read: if request.auth != null
    && resource.data.ownerUid == request.auth.uid;

  allow create, update: if request.auth != null
    && request.resource.data.ownerUid == request.auth.uid
    && request.resource.data.expiresAt is timestamp
    && request.resource.data.expiresAt <= request.time + duration.value(8, 'd');

  allow delete: if request.auth != null
    && resource.data.ownerUid == request.auth.uid;
}
```

> **Context worth knowing:** `firestore.rules` today is `allow read, write: if true` on every path, including the catch-all `match /{document=**}`. That catch-all will match `demo_games` first and make the block above cosmetic. Tightening the whole ruleset is out of scope for this brief, but **the demo is the first genuinely public, unauthenticated write surface in the app**, so at minimum move the `demo_games` match above the catch-all and raise the wider question separately. Flag this to Brian rather than silently deciding it.

### 5.8 Resume flow

- On `/demo`, read `localStorage['evalu8_demo_id']`. **`localStorage`, not `sessionStorage`** — v1 of this brief specified `sessionStorage`; persistence across tab close now requires `localStorage`.
- If present: `ensureDemoUid()`, then `getDoc(doc(db, 'demo_games', demoId))`. If it exists and `ownerUid` matches, hydrate and render the `Dashboard`. If it's missing (expired, or a cleared anonymous account), clear the key and fall through to `DemoSetup` with a gentle toast: *"Your previous demo has expired — starting a new one."*
- Keep a **localStorage mirror of the last known state** for instant first paint and offline resilience; Firestore remains the source of truth and overwrites it on load.
- **Read once with `getDoc`, do not attach `onSnapshot`.** There is no second writer, so a live subscription only adds cost.
- **Multi-tab guard:** on load, stamp `activeClientId` (a random per-tab id) into the document. If a tab's subsequent write finds `activeClientId` no longer its own, it must go read-only and show *"This demo was opened in another tab."* Without this, two tabs both run `useBotRunner` and duplicate bot actions — the in-memory `processedActions` guard is per-tab and will not save you.

---

## 6. Firestore Isolation — what the demo must *not* touch

Persistence being allowed makes isolation *more* important, not less: the demo now has a live Firestore connection and could plausibly reach the wrong collection.

### 6.1 `GameContext.mutateGameState` — the dangerous one

`src/contexts/GameContext.tsx` (~line 76). Today, when `currentClassId` is `null`, **every** state mutation writes to the shared singleton document `evalu8smart_sessions/default_game`:

```ts
} else {
  const docRef = doc(db, 'evalu8smart_sessions', 'default_game');
  setDoc(docRef, removeUndefined(safeState))...
}
```

⚠️ Demo mode has no `currentClassId`, so it falls into exactly this branch. **Without a guard, every demo visitor overwrites that one shared document and stamps on each other.** This is the single biggest risk in the feature — implement and verify this guard *first*.

```ts
const { currentClassId, activeClass, isDemo } = useSession();
...
setTimeout(() => {
  if (isDemo) { persistDemoState(safeState); return; }   // ← demo_games only
  if (currentClassId) { /* class write, unchanged */ }
  else { /* legacy default_game write, unchanged */ }
}, 0);
```

### 6.2 `GameContext` load effect

Same file, ~line 100. The `useEffect` keyed on `currentClassId` either `getDoc`s `default_game` or attaches an `onSnapshot`. In demo mode it must do **neither** — hydrate from `demo_games/{demoId}` (§5.8) and `setIsLoaded(true)`.

### 6.3 `SessionContext` boot listeners

`src/contexts/SessionContext.tsx` attaches, unconditionally on mount:

- `onSnapshot(collection(db, 'facilitators'), …)` (~line 90)
- `onSnapshot(collection(db, 'classes'), …)` (~line 120)
- `onSnapshot(collection(db, 'classes', currentClassId, 'teams'), …)` (~line 138)

Gate all three on `if (isDemoRoute) return;`. These are full-collection downloads of other people's data — a demo visitor has no business receiving them, and under a tightened ruleset they would fail anyway. Detect the demo route *before* the provider mounts: read `window.location.pathname.startsWith('/demo')` in the provider body, or lift a `<DemoBoundary>` above `SessionProvider` in `App.tsx`. Do **not** use `useParams`/`useLocation` inside `SessionProvider` — it currently sits **above** `BrowserRouter` in the tree.

Set `classesLoaded = true` immediately in demo so nothing renders a permanent spinner.

The `onAuthStateChanged` listener (~line 78) stays attached but skips anonymous users, per §5.2.

### 6.4 `useGameBoardState`

`src/hooks/useGameBoardState.ts` is class-only and its fallback path calls `getDocs(collection(db, 'classes'))` — a full-collection scan. The Viewer must not use it in demo. See §10.

### 6.5 Verification (make this an explicit acceptance test)

Play a full demo round with the Network tab filtered to `firestore.googleapis.com`, and the Firebase console open on `evalu8smart_sessions/default_game`. Expected: writes **only** to `demo_games/{demoId}`, no reads of `classes` or `facilitators`, and the `default_game` document's `updatedAt` unchanged.

---

## 7. Architecture — how the demo supplies state

```
<DemoBoundary>                      ← detects /demo*, sets isDemo
  <SessionProvider>                 ← Firestore listeners short-circuited (§6.3)
    <DemoStateProvider>             ← owns demo GameState + demo_games persistence
      <GameProvider>                ← reads/writes the demo store instead of classes
        <BrowserRouter> … </BrowserRouter>
```

### 7.1 `src/demo/DemoStateProvider.tsx`

- Holds `GameState | null` in `useState`; exposes `{ demoGameState, setDemoGameState, demoId, humanTeamId, resetDemo, isReadOnlyTab }`.
- On mount: resolve uid → resolve `demoId` → hydrate (§5.8).
- On change: debounced write to `demo_games/{demoId}` with a re-stamped `expiresAt` (§5.3, §5.5), plus a localStorage mirror.
- On write failure (offline, rules denial, quota): toast once, keep playing from memory, retry on next mutation. **A demo must never become unplayable because a write failed.**

### 7.2 `GameProvider` changes

Minimal and surgical:

- `mutateGameState`: when `isDemo`, `setDemoGameState(next)` and route persistence to `demo_games` (§6.1). Everything else — the updater, timestamps, `removeUndefined` — stays identical.
- Load effect: when `isDemo`, hydrate from the demo store and return (§6.2).
- `resetGame()`: currently reads `activeClass.teamRegistry`; in demo it falls back to `gameState.teams`, which the existing code already does when `activeClass` is null. Verify, don't rewrite.
- **Do not touch** `initializeGame`, `addRoundData`, `advanceRound`, `updatePhase`, `allocateResearch`, `allocateLogistics`, `claimImprovementCard`, `recalculateControlPoints`, `endGame`, or any scoring function. They all flow through `mutateGameState` and therefore work unmodified.

### 7.3 `SessionContext` additions (additive only)

Do **not** add a `'DEMO'` value to `UserRole`. Roughly 60 call sites branch on `currentRole !== 'STUDENT'`, and a new role value would silently grant the demo participant full facilitator visibility — defeating §3. Instead:

```ts
interface SessionContextType {
  // ...existing, unchanged
  isDemo: boolean;              // true only on /demo*
  isDemoHost: boolean;          // true when isDemo — unlocks flow controls only
  startDemo: (config: DemoConfig) => Promise<void>;
  exitDemo: () => void;
}
```

In demo mode the provider reports:

| Field | Value | Reason |
|---|---|---|
| `currentRole` | `'STUDENT'` | Inherits all existing per-team read/write gating for free |
| `currentClassId` | `null` | No class exists |
| `currentTeamId` | `'team_1'` | The human seat |
| `isCeo` | `true` | Participant must be able to submit |
| `isReadOnly` | `false` | " |
| `activeClass` | a synthetic in-memory object `{ id: 'demo', name: 'Demo Game', teamCodes: {}, teamRegistry: [...] }` | Dashboard reads `activeClass?.name` and `activeClass?.facilitatorCode` |
| `currentClassTeams` | derived from `gameState.teams` | `useBotRunner` and several components read it |

`login`, `loginWithEmail`, `createClass`, `claimCeoSlot`, `convertTeamSeat`, etc. must be **no-ops that reject** when `isDemo` — never let a demo path reach `writeBatch`/`runTransaction`.

---

## 8. `DemoSetup` screen (`src/demo/DemoSetup.tsx`)

Reuse the look of `src/components/GameSetup.tsx` — do not restyle from scratch.

- **Your team:** name (default "Your Company") + colour picker from `TEAM_COLORS`.
- **Four bot opponents**, pre-filled and editable: name, colour (auto-assigned distinct from the human's), `botProfile`, `botDifficulty`. Defaults: `BALANCED/MEDIUM`, `RESEARCHER/MEDIUM`, `EXPANDER/MEDIUM`, `PRICE_FIGHTER/EASY` — a spread that makes the bot personalities legible in one game.
- One-line explainer: *"Runs in your browser and is saved on this device for 7 days. No sign-up needed."*
- **Start Demo** button.

On start:

1. `ensureDemoUid()` (§5.2), generate `demoId`, write it to `localStorage['evalu8_demo_id']`.
2. Build 5 `Team[]` with canonical ids `team_1` … `team_5`. **`team_1` is always the human** — hard-code this; several components assume stable ids.
3. Set `isBot: true` + profile/difficulty on `team_2` … `team_5`.
4. Call the **same** `buildInitialGameState` logic used by `createClass` in `SessionContext` (~line 433). **Extract it to `src/lib/initialGameState.ts` as a pure function first** and have both `createClass` and the demo import it. This refactor must be behaviour-preserving — the demo must not get a second, drifting copy of the initial-state builder.
5. Set `botConfig: { enabled: true, seed: Date.now() }`, `currentPhase: 'planning'`, `currentRound: 1`.
6. Write the initial `demo_games/{demoId}` document and render the `Dashboard`.

Colour matters: `getTeamColorName()` drives `INITIAL_IMPROVEMENT_CARDS`, `INITIAL_TEAM_REGIONS` and `COLOR_SCORES` (start value 3–7 by colour). Enforce **5 distinct colours** from `TEAM_COLORS` and surface the starting value next to each colour so the participant understands the handicap.

---

## 9. Flow control — advancing phase and round

### 9.1 `DemoControlBar` (`src/demo/DemoControlBar.tsx`)

Rendered by `Dashboard` **only when `isDemo`**, as a slim sticky bar directly under the header. Because `currentRole === 'STUDENT'`, the existing facilitator control cluster stays hidden — this bar replaces it, deliberately smaller:

- **Active Phase** `<Select>` → `updatePhase(value)`. Same option list as `Dashboard.tsx` (~line 395): Planning, Production, Improvement *(disabled at round 5)*, Research (`innovation`), Logistics (`expansion`), Sales, Control, Scoring.
- **Next Phase →** button — advances to the next phase in that order, skipping Improvement in round 5. This is the primary control; the dropdown is the escape hatch.
- **Advance to Round N+1** → `advanceRound()`, disabled at round 5, with the existing `AlertDialog` confirmation.
- **Open Viewer** → §10.
- **End Game** → `endGame()`; **Restart Demo** → deletes `demo_games/{demoId}`, clears `localStorage['evalu8_demo_id']`, returns to `DemoSetup`.

Add a **soft** warning (not a block) if the participant advances while a bot is mid-`botThinking` or a team has no submission for the phase: *"Some teams haven't acted yet — advance anyway?"* Never hard-block; the demo participant is the facilitator and may want to skip.

### 9.2 `useDemoHost` (`src/demo/useDemoHost.ts`)

Several housekeeping steps are facilitator-gated today and would otherwise deadlock a solo player. Rather than adding `|| isDemo` to ~15 UI gates, automate them in one hook mounted alongside `useBotRunner` in `Dashboard`:

| Housekeeping | Currently gated at | Demo behaviour |
|---|---|---|
| Draw the round's improvement pool | `ImprovementPhase.tsx` ~line 37 (`currentRole !== 'STUDENT'`) | On entering Improvement phase, if `improvementPoolByRound[currentRound]` is empty, call `selectRandomCards()` |
| Calculate control points | `ControlPhase.tsx` ~line 241 | When every team has `customersSold` for the round, call `recalculateControlPoints()` once |
| Unlock student "waiting for facilitator" cards | `ControlPhase.tsx` ~line 42, `ImprovementPhase.tsx` ~line 84, `LogisticsPhase.tsx` ~line 48, `ResearchPhase.tsx` ~line 49 — all `PhaseLockCard` | Leave as is. Bots submit in 1.5–3.5 s, so these clear on their own and correctly teach the real-game rhythm. |

The hook must be **idempotent** — guard each action with a `useRef` keyed `${round}:${action}`, exactly as `useBotRunner` does with `processedActions`.

Improvement-card *claiming* stays manual: the participant claims their own card through the existing student claim UI (`ImprovementPhase.tsx` ~line 453) and bots auto-claim via `decideImprovement`. Do not automate the human's claim.

### 9.3 `useBotRunner` change — one line

`src/bots/useBotRunner.ts` line 33 currently early-returns without a class:

```ts
if (!gameState || !currentClassId) return;
```

Change to:

```ts
const { currentClassId, currentClassTeams, isDemo } = useSession();
...
if (!gameState) return;
if (!currentClassId && !isDemo) return;
if (isReadOnlyTab) return;              // multi-tab guard, §5.8
```

and add `isDemo` to the effect's dependency array. Everything else works unchanged: `isTeamBot` already falls back to `gameState.teams[].isBot` when `currentClassTeams` is empty, and `setBotThinking` flows through `mutateGameState`.

Keep the existing 1.5–3.5 s thinking delay and the `🤖 {name} …` toasts — in a solo demo they are the main signal that opponents are alive.

**Resume hazard:** on reload mid-phase, the in-memory `processedActions` set is empty, so the runner re-evaluates every pending bot action. Its existing "re-read latest state before writing" checks should prevent duplicate submissions — **verify this explicitly**, because persistence makes mid-phase reloads common where they were previously rare.

---

## 10. The Viewer in demo mode

The Viewer is the participant's window onto open information, so it must work — but `useGameBoardState` is class-only (§6.4).

### 10.1 Route and data source

- New route `/demo/viewer` rendering the existing Viewer board with an injected state source.
- Refactor `ViewerPage` minimally: extract the body into `<ViewerBoard classData gameState />` (it is already structured this way internally as `BoardContent`) and add sibling wrappers `LiveViewerPage` / `DemoViewerPage` that choose the source. **Do not call hooks conditionally** — use two sibling components, not an `isDemo ? useA() : useB()` expression.
- `TopBar`, `PriceLadder`, `RegionLayer`, `TechPanel`, `ImprovementStrip`, `MotionProvider`, `ViewerScaler` and `viewer.css` are reused **unchanged**. The Viewer already shows only public information, which is precisely §3's definition — **do not mask the Viewer**. It is the reference implementation of "open".

### 10.2 Cross-window sync

`Dashboard`'s `handleOpenViewer` uses `window.open(..., 'popup')`. A popup is a separate JS context and cannot read the demo React state directly.

**Ship the in-page Viewer.** The **Open Viewer** button in `DemoControlBar` opens the board in a full-screen overlay `Dialog`/`Sheet` over the demo Dashboard, rendering `ViewerBoard` with the live demo `gameState`. Zero sync problem, works on mobile — and mobile browsers are a stated requirement for this app. Keep the existing `F` fullscreen key handler.

*(Optional stretch:* a real popup at `/demo/viewer` could hydrate from `demo_games/{demoId}` and subscribe with `onSnapshot`. Note this conflicts with §5.8's "no subscription" rule and with the multi-tab guard, so it needs its own read-only carve-out. Skip unless there's demand.)

---

## 11. UI treatment — make it obviously a demo

1. **Persistent banner** across the top of the demo Dashboard: `DEMO MODE — playing as {TeamName} vs 4 bots · saved on this device until {date}.` Reuse the styling of the existing `gameEnded` banner in `Dashboard.tsx` (~line 216), in a neutral/indigo tone rather than gold. Compute the date from `expiresAt` so it's honest and visibly refreshes as they play.
2. **Bot rows** carry the existing 🤖 badge. Where a value is masked, render a muted `—` with `title="Hidden — opponent's private plan"` rather than a blank cell, so the participant understands it is deliberate.
3. **Hide from the demo Dashboard:** `CeoClaimBar`, "All Games", "Return to Hub", "Log Out", `GameSettingsDialog` (or reduce it to bot pause/resume), and team-code displays. Guard each with `!isDemo`.
4. **Keep:** `CombinationsGuideModal` — it is the participant's rulebook and matters more here than in a facilitated session.
5. **Mobile:** the demo is the most likely thing to be opened on a phone from a link. The control bar must wrap to two rows and stay usable at 360 px.

---

## 12. End of game

When the participant clicks **End Game**, or advances past round 5:

1. `endGame()` runs unchanged — patent bonuses apply via the existing `getTeamPatentPoints` logic.
2. Show a demo-specific summary card above the Scoreboard: final placings, the participant's rank, and one line per bot naming its profile (*"Researcher — chased patents, finished 2nd"*).
3. **Reveal masking after final scoring only** — `maskGameStateForDemo(state, humanTeamId, { revealAll: true })` so the participant can inspect what the bots were actually doing. Strong teaching moment, costs nothing once the game is over, and only works because §3.2 mandates masking on read rather than on write.
4. Offer **Play Again** (back to `DemoSetup`, same team config pre-filled — this creates a **new** `demoId` and lets the old document expire naturally) and a **"Run this with your team"** CTA linking to `/login`.

---

## 13. Edge Cases

- **Refresh mid-game** → hydrate from `demo_games`; verify `useBotRunner` catch-up doesn't duplicate (§9.3).
- **Return after 8 days** → document gone; clear the localStorage key, toast, fall through to `DemoSetup`.
- **Return after anonymous account cleanup (30+ days)** → new uid, so the old document is unreadable under the rules even if it somehow survived. Same handling as expiry.
- **Two demo tabs** → `activeClientId` guard makes the second read-only (§5.8).
- **Offline / write failure** → keep playing from memory, toast once, retry on next mutation. Never block gameplay on a write.
- **Private browsing / localStorage disabled** → no `demoId` can be stored; fall back to a pure in-memory game and tell the participant it won't be saved.
- **Participant advances phase while a bot timer is pending** → the pending `setTimeout` fires against the new phase. Guard: capture `round`/`phase` when scheduling and abort inside the timeout if either changed. **Fix this in `useBotRunner` for all modes** — it is a latent bug in live classes too, just harder to hit there.
- **Participant sets phase backwards** (Sales → Planning) → allow it; existing components tolerate re-entry, and their own plan stays editable via Edit Plan.
- **Bot has no legal action** → existing engine behaviour; `useDemoHost` only ever *offers* to advance, never blocks.
- **Signed-in facilitator visits `/demo`** → reuse their uid, never call `signInAnonymously` (§5.2). Leaving `/demo` must restore normal `SessionProvider` behaviour including the Firestore listeners skipped in §6.3. Test both directions.

---

## 14. Alternative: no anonymous auth

If you'd rather not take on anonymous accounts at all, the same 7-day TTL design works with a client-generated `demoId` (`crypto.randomUUID()`) in localStorage and **no auth call**. You lose exactly one thing: the ability to scope rules by `ownerUid`, so `demo_games` becomes world-readable and world-writable by anyone who guesses a UUID.

Trade-off: a UUID is unguessable in practice and demo games contain nothing sensitive, so the practical risk is low — but it means the collection has no integrity guarantee at all, and a bad actor who obtains an id could corrupt or inflate a document. Anonymous auth is the recommended path; this alternative is here so the choice stays visible. **Everything else in this brief is unchanged either way** — TTL, flat document shape, isolation rules, masking, control bar.

---

## 15. Acceptance Criteria

1. `/demo` loads while signed out. The only auth call is `signInAnonymously`; the only Firestore path touched is `demo_games/{demoId}` (verified in the Network tab).
2. A full 5-round demo game completes: participant plans, claims an improvement card, allocates research and logistics, sells to customers; 4 bots act automatically with visible thinking delays.
3. Closing the tab and reopening `/demo` **resumes the same game** at the same round and phase.
4. Every `demo_games` document has an `expiresAt` of type `Timestamp`, set ~7 days ahead, and re-stamped on each write. A document with `expiresAt` in the past disappears within 24 hours of the TTL policy being active.
5. The `evalu8smart_sessions/default_game` document and all `classes/*` documents are **byte-identical before and after** a complete demo game.
6. No `classes` or `facilitators` collection read occurs on `/demo`.
7. The participant can change phase and advance rounds from `DemoControlBar`; phase tabs, `PhaseLockCard` and turn-order strips respond exactly as in a live class.
8. For bot teams the participant can see price (post-submission), region presence, research/patent progress, improvement cards taken, customers sold, control points and scores — and **cannot** see any bot's combination, position, card usages or unspent icon counts anywhere, checked specifically on Scoreboard, Current State, Analytics, Financials and Simulation Report. After End Game, the reveal shows them.
9. Bot plans survive a save/reload round-trip intact (proving masking is read-side only).
10. The Viewer opens from the demo and renders the same board a facilitator sees.
11. Final scores match what the same decisions would produce in a live class game (spot-check one round against `calculateTeamTotalScore`).
12. **Regression:** a normal facilitator class game with 2 humans + 3 bots is behaviourally identical to `main` — Firestore writes, CEO claim, team codes, Viewer, Analytics and Simulation Report unchanged. A signed-in facilitator who visits `/demo` and returns is **still signed in**.
13. Usable end-to-end on a 360 px phone browser.

---

## 16. Firebase Console Checklist (Brian — not code)

These cannot be done from the repo and must be in place before the feature ships:

- [ ] Authentication → Sign-in Methods → enable **Anonymous**.
- [ ] Upgrade project to **Firebase Authentication with Identity Platform**.
- [ ] Authentication → Settings → enable **automatic clean-up** of anonymous accounts (30 days).
- [ ] Deploy the TTL field override (`firebase deploy --only firestore:indexes`) and confirm the policy shows as **Active** under Firestore → Time-to-live. TTL is inert until the policy finishes setup.
- [ ] Optional: add a Cloud Monitoring widget for `firestore.googleapis.com/document/ttl_deletion_count` to confirm deletions are actually happening.
- [ ] Decide on the `firestore.rules` catch-all question raised in §5.7.

---

## 17. File Plan

**New**

- `src/demo/DemoStateProvider.tsx` — demo state + `demo_games` persistence, debounce, expiry stamping, multi-tab guard.
- `src/demo/demoAuth.ts` — `ensureDemoUid()` with the signed-in-facilitator guard.
- `src/demo/DemoSetup.tsx` — team/bot configuration screen.
- `src/demo/DemoControlBar.tsx` — phase select, next phase, advance round, viewer, end/restart.
- `src/demo/useDemoHost.ts` — automated facilitator housekeeping.
- `src/demo/demoVisibility.ts` — `maskGameStateForDemo` + hidden-field list.
- `src/demo/useIsDemoRoute.ts` — pathname detection usable above `BrowserRouter`.
- `src/lib/initialGameState.ts` — `buildInitialGameState` extracted from `SessionContext`.

**Modified (all edits additive / behind `isDemo`)**

- `src/App.tsx` — `/demo` and `/demo/viewer` routes, `DemoBoundary`.
- `src/contexts/SessionContext.tsx` — `isDemo`/`isDemoHost`/`startDemo`/`exitDemo`; skip the three collection listeners; skip anonymous users in `onAuthStateChanged`; synthetic `activeClass`/`currentClassTeams`; import extracted initial-state builder.
- `src/contexts/GameContext.tsx` — route demo persistence to `demo_games`; skip `default_game` and class paths.
- `src/bots/useBotRunner.ts` — allow demo; read-only-tab guard; capture round/phase in the timeout guard.
- `src/components/Dashboard.tsx` — mount `DemoControlBar` + `useDemoHost`; hide CEO bar/hub/logout/settings when `isDemo`; demo banner with expiry date.
- `src/pages/Viewer/ViewerPage.tsx` — extract `ViewerBoard`; add `DemoViewerPage`.
- `src/pages/Login.tsx` — "Play the demo" link.
- `src/components/dashboard/Scoreboard.tsx`, `CurrentState.tsx`, `Analytics.tsx`, `FinancialsPhase.tsx`, `SimulationReport.tsx` — render `—` for masked fields.
- `firestore.rules` — `demo_games` block (§5.7).
- `firestore.indexes.json` — TTL field override (§5.3).

**Untouched:** `src/lib/rules.ts`, `src/bots/botEngine.ts`, `src/data/*`, `src/types/game.ts` scoring functions, `firebase.json`.

---

## 18. Implementation Order

1. Extract `buildInitialGameState` into `src/lib/initialGameState.ts`; confirm live class creation is unchanged.
2. Console setup (§16) — TTL policy **Active** before any demo code writes data.
3. `useIsDemoRoute` + `DemoBoundary` + `isDemo` on `SessionContext`; skip the three collection listeners and anonymous auth-state writes. **Verify no `classes`/`facilitators` reads on `/demo` before writing any game logic.**
4. `GameContext` persistence routing (§6.1, §6.2). Re-verify `default_game` is untouched.
5. `demoAuth` + `DemoStateProvider` + `DemoSetup`; render a `Dashboard` with 5 teams, and confirm a `demo_games` document appears with a correct `Timestamp` `expiresAt`.
6. Reload test — resume works, `Set` serialisation handled (§5.6).
7. Enable `useBotRunner` in demo; play one full round manually driving phases.
8. `DemoControlBar` + `useDemoHost`; play a full 5-round game; add write debouncing (§5.5).
9. `maskGameStateForDemo` + component `—` rendering; audit every tab against §3.1; confirm persisted bot plans are unmasked.
10. Demo Viewer overlay.
11. End-game summary, reveal, Play Again.
12. Multi-tab guard, offline handling, mobile pass, full regression against criterion 12.
13. Backdate one document's `expiresAt` and confirm it disappears within 24 hours.

---

## 19. Open Questions for Brian

1. **Number of bots:** fixed at 4 (5 teams total, matching a full table), or should the participant choose 1–4? This brief assumes fixed at 4 with configurable profiles.
2. **Round count:** full 5 rounds, or a shortened 3-round demo to keep a prospect's session under ~15 minutes? This brief assumes 5.
3. **7 days — right number?** Sliding expiry means an engaged prospect is never cut off mid-game; 7 days only bites on abandoned games. 14 or 30 is equally cheap now that TTL is doing the work.
4. **The `firestore.rules` catch-all** (§5.7) — tighten now, or ship the demo and handle it separately?
5. Should `/demo` be excluded from `public/robots.txt`, or is it a page you want indexed?
6. Any interest in a lightweight admin view listing live demos (count, created date, rounds reached)? Cheap to add as a single query, and useful as a sales signal — but it does mean reading the collection, which the per-uid rules in §5.7 would block for anyone but a facilitator.
