# FIX BRIEF — Class Management, Team Codes & CEO Seat (evalu8smart2026)

**Audience:** Antigravity (AI dev partner)
**Repo:** `briansimelane/evalu8smart2026`
**Reference implementation:** `briansimelane/TechtabsOnlinev2` (working pattern)
**Goal:** Facilitator creates a class → each team gets a permanent access code → students log in with team code → one team member claims the CEO seat with a PIN and gains write access; everyone else is read-only. Codes must NEVER show `N/A`, and the CEO seat must never silently disappear.

---

## 1. Diagnosed Root Causes (do not skip — the fixes below map 1:1 to these)

### RC-1: Stale gameState "echo write" into the wrong class document
File: `src/contexts/GameContext.tsx`

The auto-save effect has `currentClassId` in its dependency array:

```ts
useEffect(() => {
  ...
  setDoc(doc(db, 'classes', currentClassId), { gameState: safeState }, { merge: true })
  ...
}, [gameState, isLoaded, currentClassId]);
```

When `currentClassId` changes (facilitator opens a Control Panel, switches classes, or the app transitions from the standalone `evalu8smart_sessions/default_game` mode into class mode), this effect fires **before** the new class's `onSnapshot` data arrives. It writes the *previous* session's `gameState` — with foreign team IDs — into the *new* class document. This corrupts `gameState.teams` so its IDs no longer match the keys of `teamCodes`.

### RC-2: Two competing team-ID schemes
- `FacilitatorHub.handleCreateClass` creates teams with ids `team_1 … team_5` and `SessionContext.createClass` keys `teamCodes` by those ids. ✅ canonical.
- `GameSetup.tsx` creates teams with ids `'1'` and `Date.now().toString()`; `GameContext.initializeGame(teams)` accepts whatever it's given. ❌ rogue.

`Index.tsx` renders `<GameSetup>` whenever `gameState` is null — **including while a class is selected** (e.g., during a loading gap or after RC-1 corruption). If the facilitator clicks "Start", the class's `gameState.teams` is rebuilt with rogue IDs. `teamCodes` on the class doc is untouched but orphaned → the Hub renders `N/A`.

Evidence already in the codebase: `FacilitatorHub.tsx` (~line 311) contains three fallback lookups (`team_${idx+1}`, `${idx+1}`, positional `Object.values(...)[idx]`) — these are symptom patches for this exact mismatch and must be removed once the root cause is fixed.

### RC-3: Whole-document read-modify-write with no transaction
`SessionContext.claimCeoSlot`, `releaseCeoSlot`, `facilitatorReleaseCeoSlot`, `facilitatorChangeCeoPin` all do:

```ts
const snap = await getDoc(classRef);      // read whole doc
team.ceoName = ...; team.ceoPin = ...;    // mutate in memory
await setDoc(classRef, classData);        // OVERWRITE whole doc (no merge, no transaction)
```

Meanwhile `GameContext` auto-saves `gameState` on every state change. Two independent whole-doc writers → last-writer-wins data loss: a CEO claim can revert a round advance; a gameState save can revert a CEO claim/PIN change. This is the source of "CEO functionality is just not great".

### RC-4: CEO UI fails silently when the team lookup fails
`CeoClaimBar.tsx`:

```ts
const team = activeClass?.gameState?.teams.find(t => t.id === currentTeamId);
if (!team) return null;   // bar disappears with no explanation
```

Combined with RC-1/RC-2 (regenerated team IDs), `currentTeamId` from localStorage no longer matches, so `isCeo` computes false, `isReadOnly` true, and the claim bar vanishes.

### RC-5: `merge: true` deep-merge leaves ghost data
`setDoc(docRef, { gameState }, { merge: true })` deep-merges maps. Keys for removed/renamed team IDs inside `teamResearchProgress`, `teamLogisticsProgress`, `regionLogistics.*.teamProgress`, etc. are never deleted, accumulating ghost entries.

---

## 2. Target Architecture (mirror the TechTabs pattern)

**Principle: separate immutable class identity from mutable game state. Identity is written once at class creation and never touched by game logic.**

### Firestore layout

```
classes/{classId}                     ← IDENTITY DOC (write-once + rare admin edits)
  id, name, createdAt
  facilitatorCode: string
  teamCodes: { team_1: "TM1-XXXX", ... }
  teamRegistry: [ { id: "team_1", name, color } ]   ← canonical team list

classes/{classId}/state/game          ← GAME STATE DOC (all game logic writes here)
  gameState: GameState                 (teams array inside uses the SAME ids as teamRegistry)

classes/{classId}/teams/{teamId}      ← PER-TEAM DOC (CEO seat lives here)
  id, name, color
  ceoName: string
  ceoPin: string
  updatedAt
```

Why: game-state writes can no longer clobber codes (different doc); CEO writes are tiny per-team documents (no whole-class overwrite); the identity doc is effectively immutable so `N/A` becomes impossible.

### Canonical team IDs
`team_1 … team_N`, assigned **only** in `createClass`. No other code path may mint team IDs while a class is active. `GameSetup` remains only for the legacy standalone mode (`currentClassId === null`) — or remove standalone mode entirely if not needed (preferred: remove it and delete the `evalu8smart_sessions/default_game` code path, see Step 7).

---

## 3. Implementation Steps

### Step 1 — Restructure `createClass` (SessionContext.tsx)
1. Keep code generation as-is (`FAC-####`, `TM{n}-AAAA`).
2. Write THREE things atomically with a `writeBatch`:
   - `classes/{classId}`: `{ id, name, facilitatorCode, teamCodes, teamRegistry, createdAt }` — **no `gameState` field**.
   - `classes/{classId}/state/game`: `{ gameState: buildInitialGameState(teams) }`.
   - `classes/{classId}/teams/{teamId}` for each team: `{ id, name, color, ceoName: '', ceoPin: '' }`.
3. `buildInitialGameState(teams)` must use the passed team ids verbatim (it already does — keep it that way).

### Step 2 — Kill the echo write (GameContext.tsx) — fixes RC-1
Replace the "write whole gameState on every change" effect with a guarded, debounced saver:

```ts
const loadedForClassId = useRef<string | null>(null);
const dirty = useRef(false);

// In the onSnapshot handler for classes/{id}/state/game:
loadedForClassId.current = currentClassId;
isIncomingSnapshot.current = true;
setGameState(data);

// All local mutators (advanceRound, allocateResearch, etc.) must set dirty.current = true
// (easiest: wrap setGameState in a helper `mutateGameState(fn)` that sets the flag).

// Save effect:
useEffect(() => {
  if (!isLoaded || !gameState || !currentClassId) return;
  if (isIncomingSnapshot.current) { isIncomingSnapshot.current = false; return; }
  if (loadedForClassId.current !== currentClassId) return;  // ← HARD GUARD: never write a state loaded from a different class
  if (!dirty.current) return;
  dirty.current = false;
  const t = setTimeout(() => {
    setDoc(doc(db, 'classes', currentClassId, 'state', 'game'),
           { gameState: serialize(gameState) });   // full set on the state doc — no merge, no ghosts (fixes RC-5)
  }, 400);
  return () => clearTimeout(t);
}, [gameState, isLoaded, currentClassId]);
```

Also: when `currentClassId` changes, immediately `setGameState(null)` and `setIsLoaded(false)` in the load effect **before** subscribing, so no stale state can ever be observed or written.

### Step 3 — Move the CEO seat to per-team docs with a transaction — fixes RC-3
In `SessionContext.tsx`, rewrite the four CEO functions to target `classes/{classId}/teams/{teamId}` and use `runTransaction`:

```ts
const claimCeoSlot = async (name: string, newPin?: string, currentPin?: string) => {
  const teamRef = doc(db, 'classes', currentClassId!, 'teams', currentTeamId!);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(teamRef);
    if (!snap.exists()) throw new Error('Team not found');
    const team = snap.data();
    if (team.ceoPin && team.ceoPin !== currentPin) return false;   // seat taken, wrong PIN
    const finalPin = newPin || team.ceoPin;
    if (!finalPin) return false;
    tx.update(teamRef, { ceoName: name, ceoPin: finalPin, updatedAt: serverTimestamp() });
    return finalPin;
  }).then(finalPin => {
    if (!finalPin) return false;
    localStorage.setItem('evalu8_ceo_pin', finalPin as string);
    localStorage.setItem('evalu8_ceo_name', name);
    setLocalCeoPin(finalPin as string);
    return true;
  });
};
```

`releaseCeoSlot`, `facilitatorReleaseCeoSlot`, `facilitatorChangeCeoPin` follow the same pattern (`tx.update` only `ceoName`/`ceoPin`). **Delete every `setDoc(classRef, classData)` whole-doc write.**

### Step 4 — Subscribe to team docs for CEO state (SessionContext.tsx)
Add an `onSnapshot` on `classes/{currentClassId}/teams` (or just the single `teams/{currentTeamId}` doc for students). Derive:

```ts
const isCeo = currentRole === 'STUDENT' && !!teamDoc?.ceoPin && localCeoPin === teamDoc.ceoPin;
const isReadOnly = currentRole === 'STUDENT' && !isCeo;
const ceoName = teamDoc?.ceoName || null;
```

If the facilitator changes/clears the PIN, the snapshot updates, `isCeo` flips to false, and the UI must show a toast: *"Your CEO access was changed by the facilitator."* — not silently degrade.

### Step 5 — Fix `CeoClaimBar` fail-silent behavior — fixes RC-4
Replace `if (!team) return null;` with an explicit error card: *"Your team could not be found in this class. Please log out and log in again with your team code, or ask your facilitator to check the class."* The bar must never simply vanish for a logged-in student.

### Step 6 — FacilitatorHub display — fixes N/A permanently
- Render the team table from `cls.teamRegistry` (identity doc), not from `gameState.teams`.
- Code lookup becomes exactly `cls.teamCodes[team.id]` — **delete the three fallback lookups**.
- CEO column reads from the `teams/{teamId}` subcollection snapshot.
- If `teamCodes[team.id]` is ever undefined, render a visible error badge ("code missing — data integrity issue") instead of `N/A`, and log the class doc to console. With this architecture it should be unreachable.

### Step 7 — Retire rogue team creation — fixes RC-2
- `Index.tsx`: when `currentClassId` is set and `gameState` is null, render a **loading spinner** (or "waiting for game state") — never `<GameSetup>`.
- `resetGame()` must rebuild state from `teamRegistry` (identity doc), preserving ids/names/colors: `initializeGame(teamRegistry)`. It must not touch `teamCodes` or the `teams/{teamId}` CEO docs.
- Preferred: delete standalone mode entirely (`evalu8smart_sessions/default_game` branch in GameContext, and `GameSetup` usage from Index). If standalone must stay, it may only run when `currentRole === null || currentClassId === null`, and its writes must be impossible to reach a `classes/*` path.

### Step 8 — Login flow (SessionContext.login)
- Team-code lookup stays as scan of `teamCodes` per class (fine at this scale).
- Guard: if `!classesLoaded`, return `{ success:false, message:'Still connecting — please try again in a moment.' }` instead of "Invalid Access Code".
- On successful student login, verify `teamRegistry` contains the teamId; store role/classId/teamId in localStorage as now.

### Step 9 — One-time migration for existing classes
Add a small admin-only utility (button in AdminHub or a script) that, for each legacy `classes/{id}` doc containing an embedded `gameState`:
1. Builds `teamRegistry` from `gameState.teams` **if** those ids match `teamCodes` keys; otherwise from `Object.keys(teamCodes)` (names `Team 1…N`, default colors), and remaps `gameState` team ids positionally to `team_1…team_N` (teams, rounds.teamData keys, teamResearchProgress, teamLogisticsProgress, regionLogistics.*.teamsPresent/teamProgress, patents values, improvementCards.availableForTeam/usedBy).
2. Writes `state/game` and `teams/{teamId}` docs (carrying over any existing `ceoName`/`ceoPin`).
3. Removes `gameState` from the identity doc (`updateDoc(..., { gameState: deleteField() })`).

### Step 10 — Firestore rules (minimum hardening)
Current rules are `allow read, write: if true`. At minimum, protect the identity doc from arbitrary writes:

```
match /classes/{classId} {
  allow read: if true;
  allow create: if true;
  allow update, delete: if false;      // identity is immutable from the client after creation
  match /state/{doc} { allow read, write: if true; }
  match /teams/{teamId} { allow read, write: if true; }
}
```

(True auth is out of scope for this brief, but this alone makes code loss structurally impossible.)

---

## 4. Acceptance Criteria (test all of these before declaring done)

1. Create a class with 5 teams → Hub shows 5 codes immediately; refresh browser → codes unchanged. **No `N/A` anywhere.**
2. Open Control Panel for Class A, go back, open Class B, go back to A — repeat 5×. Codes and team names in both classes remain intact (regression test for RC-1).
3. Log in as facilitator, play 2 rounds in Class A; simultaneously (second browser) a student in Class A claims the CEO seat mid-round. Both the round data AND the CEO claim persist (regression test for RC-3).
4. Student logs in with a team code → sees claim bar → claims CEO with name + PIN → gets write access. Second student on another device with the same team code is read-only and sees "CEO: {name}".
5. Second student enters the correct current PIN → can take over the seat; wrong PIN → clear error toast, no state change.
6. Facilitator resets the game → codes, team names/colors, and CEO seats all survive; only round/economy data resets.
7. Facilitator changes a CEO PIN → the sitting CEO's device downgrades to read-only within seconds **with a visible toast**, not silently.
8. Kill the network mid-claim → claim either fully succeeds or fully fails with an error toast; no partial state.
9. Student whose team genuinely can't be found sees the explicit error card from Step 5, never a blank/missing bar.
10. Grep check: zero occurrences of `setDoc(classRef, classData)` whole-doc writes; zero occurrences of the three fallback code lookups in FacilitatorHub; `GameSetup` is unreachable while a class is selected.

## 5. Out of Scope
- Real Firebase Auth / hashed PINs (classroom threat model accepted for now).
- Any change to game economy/phase logic beyond the state-doc relocation.
