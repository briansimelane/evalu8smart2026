# Evalu8 Smart — Security Model & Referee Architecture

This document explains how authorization, secret isolation, and turn-based game integrity are enforced in `schemaVersion: 2` classes without requiring Cloud Functions on Day 1, and how the referee can later be migrated to Cloud Functions with zero client or rule changes.

---

## 1. Threat Model & Trust Boundaries

| Role / Actor | Firebase Auth Identity | Trust Level | Capabilities |
| :--- | :--- | :--- | :--- |
| **Facilitator (Class Owner)** | Email/Password (`email_verified == true` and `classes/{classId}.ownerId == request.auth.uid`) | Trusted Referee | Full read/write access to their class tree; runs the client-side Referee hook (`useReferee`) that validates and applies student actions. |
| **Student — Active CEO** | Anonymous Auth (`members/{uid}.role == 'student'` and `seats/{teamId}.ceoUid == request.auth.uid`) | Untrusted Client | Can write only their own team's sealed plan (`plans/{round}_{teamId}`) during `planning` and their own team's turn action (`actions/{round}_{phase}_{teamId}`) when `state/control.turn` points to their `teamId`. Cannot write to `state/*`, `rounds/*`, or any other team's documents. |
| **Student — Viewing Director** | Anonymous Auth (`members/{uid}.role == 'student'`, not `ceoUid`) | Untrusted Client | Read-only access to public class state (`state/control`, `state/world`, `rounds/*`, `teams/*`, `seats/*`) and their own team's `plans` / `actions`. Cannot submit plans or actions unless they claim or take over the CEO seat. |
| **Projector / Viewer** | Anonymous Auth (`members/{uid}.role == 'viewer'`) | Untrusted Client | Read-only access to public board state (`state/control`, `state/world`, `rounds/*`, `teams/*`, `seats/*`). Cannot read `plans/*` before reveal, cannot read `secrets/codes`, and cannot write any game documents. |
| **Unenrolled / Stranger** | Any UID without `members/{uid}` (and not class owner) | Untrusted | Can only `get` a single `joinCodes/{code}` document when they know the exact code string (`list` is denied). Cannot read or write any `classes/{classId}` document or subcollection. |

---

## 2. What Firestore Security Rules Enforce vs. Facilitator-as-Referee

### Enforced by `firestore.rules` (Server-Side, Cryptographic / Structural)

1. **No Collection Scans or Code Leaks**
   - `joinCodes/{code}` allows `get` (point lookup by exact code) and denies `list`.
   - `classes/{classId}/secrets/codes` (containing team codes and the viewer code for the facilitator UI) is readable and writable **only** by the class owner (`isClassOwner(classId)`).
   - `classes/{classId}/teams/{teamId}` is forbidden from containing `accessCode`, `ceoPin`, `ceoPinHash`, or `pinSalt`.

2. **Facilitator Spoofing Prevention**
   - `localStorage` is never trusted for authorization.
   - Facilitators must authenticate with Firebase Email/Password (`request.auth.token.email_verified == true`), and `isClassOwner(classId)` checks `classes/{classId}.ownerId == request.auth.uid`.
   - Hardcoded master passwords and client-side admin bypasses have been removed.

3. **Sealed Planning Phase**
   - During `planning`, a team's CEO writes `classes/{classId}/plans/{round}_{teamId}`.
   - Security rules allow reading `plans/{planId}` **only** if the requester is the class owner or a member of `resource.data.teamId`. Opponents and the projector viewer cannot read other teams' plans until the facilitator closes `planning` and reveals them into `rounds/{round}`.

4. **CEO Seat & PIN Protection**
   - CEO seat ownership is tracked in `classes/{classId}/seats/{teamId}` (`ceoUid`, `ceoName`, `pinHash`, `pinSalt`).
   - Plaintext PINs are never stored; clients store `pinSalt` + `SHA-256(pinSalt + ":" + pin)`.
   - Only a member of `teamId` can claim/release/take over `seats/{teamId}`, and when claiming they must set `ceoUid == request.auth.uid`.

5. **Turn-Gated Action Submissions**
   - Students cannot write to `state/control`, `state/world`, or `rounds/{roundNumber}`.
   - A student can `create` `classes/{classId}/actions/{actionId}` only when:
     - They are the active CEO of `teamId` (`isTeamCeo(classId, teamId)`).
     - `actionId == round + "_" + phase + "_" + teamId`.
     - `state/control.currentRound == round` and `state/control.currentPhase == phase`.
     - For turn-based phases (`improvement`, `innovation`, `expansion`, `sales`), `state/control.turn.order[state/control.turn.index] == teamId` (it is strictly their turn).
     - `total >= 0` and no `status` field is set on creation.

### Enforced by Facilitator-as-Referee (`useReferee` + `src/lib/referee/resolvers.ts`)

Because Firestore rules cannot easily loop over region adjacency graphs or recalculate multi-team control point tie-breakers, domain-specific game math is enforced by the Facilitator client acting as Referee:

1. **Domain Validation (`resolvePlan`, `resolveImprovement`, `resolveResearch`, `resolveLogistics`, `resolveSales`, `resolveWildcard`)**
   - Recomputes plan outputs (`price`, `productsProduced`, `researchIcons`, `logisticsIcons`, `improvementCards`) from `combinationsData`, active rule adjustments, improvement card usages, wildcard tokens, and tech bonuses (GPS, Wi-Fi, Battery) rather than trusting client-supplied numbers.
   - Validates research point budgets, patent discounts (`-1` when another team holds the patent), and GPS `+5` one-time product bonus.
   - Validates logistics point budgets, region adjacency (`canExpandToRegion`), region office capacity (`maxTeams`), Steve blocking, and multi-office discounts.
   - Validates sales customer eligibility (price ceiling vs. technology requirement), regional presence or 4G remote-sale limits (max 1 per non-office region), NFC direct sales (max 3), inventory limits (`<= productsProduced`), and recalculates regional control points and revenue.

2. **Idempotent Transactional Resolution (`applyRefereeActionTransaction`)**
   - Reads `actions/{actionId}`, `state/control`, `state/world`, and `rounds/1..5` inside a single Firestore `runTransaction`.
   - If `action.status` is already `'applied'` or `'rejected'`, the transaction exits immediately as a no-op (`already-resolved`), making it safe even if a facilitator has multiple browser tabs open simultaneously.
   - If valid, writes the updated `state/control` (incrementing `turn.index` and `stateVersion`), `state/world`, and `rounds/{round}`, and marks `actions/{actionId}.status = 'applied'`.
   - If invalid, leaves game state untouched and marks `actions/{actionId}.status = 'rejected'` with an `error` message displayed to the submitting student CEO.

3. **Trade-Offs of Client-Side Referee**
   - **Pros:** Zero Cloud Functions cost or deployment complexity; works on the standard Firebase Spark/Blaze client setup; reuses 100% of existing TypeScript rules (`src/lib/rules.ts`) and Vitest suites.
   - **Operational Requirement:** At least one facilitator tab (`Dashboard`, `FacilitatorHub`, or `MultiWorldControl`) must be online to process student actions and advance turns. `useReferee` writes `refereeHeartbeatAt` to `state/control` every 20 seconds; if stale (`> 45s`), student UIs display a non-blocking *"Waiting for facilitator connection..."* banner.

---

## 3. Migrating the Referee to Cloud Functions Later

Because student clients only write to `plans/{planId}` and `actions/{actionId}` and read from `state/control`, `state/world`, and `rounds/{round}`, moving the referee off the facilitator's browser to a Cloud Function requires **zero changes** to student UI code, data schemas, or `firestore.rules`:

1. Create a 2nd-gen Firestore trigger:
   ```ts
   export const onTeamActionCreated = onDocumentCreated(
     "classes/{classId}/actions/{actionId}",
     async (event) => {
       const { classId, actionId } = event.params;
       // Run the exact same pure resolver logic (src/lib/referee/resolvers.ts)
       // inside db.runTransaction(...) using firebase-admin
     }
   );
   ```
2. Disable `useReferee` on the facilitator client (or leave it enabled as a fallback — `applyRefereeActionTransaction` is idempotent on `action.status`, so client and server referees will never double-apply an action).
