# Evalu8smart Viewer — Motion & Change-Highlighting Specification

**Target repo:** `briansimelane/evalu8smart2026`
**Scope:** `src/pages/Viewer/*` and the `@layer utilities` animation block in `src/index.css`
**Out of scope:** layout, icons, connectors, colour palette, data model, Firestore rules. The board's structure works — do not restructure it.

**Goal:** when something happens on the board, exactly one thing should move, everyone in the room should be able to tell *what* moved, and they should still be able to tell *what changed* for several seconds after the motion has finished.

---

## 0. Instruction for the implementing agent

Read sections 1–3 before writing any code. The current animations are not "too fast" or "wrong easing" — they fire on the wrong condition. Fixing the keyframes without fixing the trigger logic will not fix the problem. Implement in the order given in section 11; each step is independently shippable.

---

## 1. Diagnosis — why the board flashes everywhere

### 1.1 Animations are bound to *existence*, not to *change*

Throughout the viewer, animation classes are applied from a state predicate rather than from a state *transition*:

| File | Line (approx) | Current | Problem |
|---|---|---|---|
| `RegionCard.tsx` | 149 | `hasInvested ? 'animate-bubble-pop …' : …` | Fires for every team that has *ever* invested |
| `RegionCard.tsx` | 187, 194, 206 | `animate-bubble-pop` on control badges | Fires for every region that currently has a control leader |
| `RegionCard.tsx` | 236 | `animate-bubble-pop` on every present-team circle | Every established office animates |
| `RegionCard.tsx` | 292 | `animate-bubble-pop` on every sold-customer dot | Every sale ever made this round animates |
| `TechPanel.tsx` | 47, 63, 123 | `animate-bubble-pop` on every investor dot / invested tile / patent badge | Whole bottom strip animates |
| `ImprovementStrip.tsx` | 153, 201 | `animate-bubble-pop`, `opacity-0 animate-slow-score` | Every row in the list replays its entrance |
| `PriceLadder.tsx` | 120 | `animate-bubble-pop` on every price token | Whole left rail animates |
| `TopBar.tsx` | 211 | `isProductionPhase ? 'animate-bubble-pop …'` | Fires on phase, not on production |

Because a CSS animation restarts whenever the element mounts or the class is added, and because every Firestore `onSnapshot` re-render can remount keyed subtrees, **any update anywhere causes every element carrying one of these classes to replay simultaneously**. Twelve to forty elements animate at once. The one element that actually changed is indistinguishable from the thirty-nine that did not.

### 1.2 Multiple infinite animations run permanently

Currently on screen at all times: `animate-spin-slow`, `animate-marquee-slow`, `animate-attention` (`infinite`, applied per-row in `ImprovementStrip.tsx:203` and per-team in `TopBar.tsx:151`), `animate-pulse` (`PriceLadder.tsx:143`, `TechPanel.tsx:126`, `ImprovementStrip.tsx:219`), `animate-ping` (`TopBar.tsx:159`), `animate-bounce` (`ImprovementStrip.tsx:177`).

Ambient perpetual motion raises the noise floor. A one-off event animation has to compete with it, so it reads as "more flashing" rather than "something happened". **Perpetual motion is only ever acceptable for a single persistent status indicator (whose turn it is), and only one at a time.**

### 1.3 The flash keyframes strobe

`flashThreeSlow` (`src/index.css:203`) drops `opacity` to `0.35` and scales to `1.18`, three times, over 4.5 s total. Dropping opacity makes the content *harder* to read at exactly the moment the audience looks at it, and the repeated scale is read by the eye as an error state, not as an announcement. `animate-live-flash` in `viewer.css` is defined but never used.

### 1.4 Two real bugs

- **`TopBar.tsx:47–51`** — `setTimeout` is created inside a `forEach` callback and the cleanup function is returned from the `forEach` callback, not from the effect. The timeout is never cleared, and only the last team to change wins the single `animatingTeamId` slot. Multiple simultaneous changes are silently dropped.
- **`RegionCard.tsx:187 + 194`** — `animate-bubble-pop` is applied to the badge container *and* to its children, so the transforms compound (up to `scale(2.1)` at peak).

### 1.5 Structural point

`useGameBoardState` returns only the current snapshot. Nothing in the app knows what the previous snapshot was, so no component *can* animate on change even if it wanted to. That's the root cause, and section 5 fixes it.

---

## 2. Design principles

1. **Motion is earned by a delta.** An element animates if and only if its own value differs from the previous snapshot. No delta, no motion.
2. **Suppress, don't shout.** On a bright board, dimming the 95% that didn't change reads far more clearly than brightening the 5% that did. Contrast by subtraction.
3. **One announcement at a time.** Multiple simultaneous changes are staggered into a sequence, never fired in parallel.
4. **Bulk change is not an event.** Round rollover, phase change, first paint and reconnect change everything at once. Those get a single quiet board-level transition and zero per-element highlights.
5. **The afterglow outlasts the motion.** Motion is ~1 s; the "this changed" marker persists for 9 s. Someone who looked up late must still be able to see what happened.
6. **Words carry the meaning, motion carries the attention.** The animation says *look here*; a short caption says *what happened*. Neither does the other's job.
7. **Nothing ever becomes harder to read while it is being announced.** Never animate opacity downward, never blur, never reduce contrast on the thing being highlighted.

---

## 3. Motion token system — final values

Define once, in `src/pages/Viewer/viewer.css`, and reference everywhere. No magic durations in components.

These values are not placeholders. They are derived from the actual viewing condition: a 1920×1080 board projected or cast to a large screen, viewed from roughly 3–8 m by people who are mostly looking at their own team sheets and negotiating with each other. Implement them exactly. Section 3.3 lists the only two you should ever adjust, and how to tell when to.

```css
:root {
  /* ── durations ─────────────────────────────────────────────── */
  --mo-instant:   140ms;   /* spotlight engaging */
  --mo-quick:     240ms;   /* element arriving / leaving */
  --mo-ack:       500ms;   /* tier-2 tint sweep */
  --mo-announce: 1000ms;   /* tier-1 event */
  --mo-release:   420ms;   /* spotlight releasing */
  --mo-settle:    700ms;   /* board-level phase/round transition */
  --mo-afterglow: 9000ms;  /* how long "recently changed" persists */

  /* ── sequencing ────────────────────────────────────────────── */
  --mo-stagger:   140ms;   /* gap between queued announcements */
  --mo-coalesce:  250ms;   /* Firestore snapshot debounce (see 5.2) */

  /* ── easings ───────────────────────────────────────────────── */
  --mo-ease-out:    cubic-bezier(0.16, 1, 0.3, 1);     /* arrivals, halo bloom */
  --mo-ease-soft:   cubic-bezier(0.4, 0, 0.2, 1);      /* value & position moves */
  --mo-ease-pop:    cubic-bezier(0.34, 1.3, 0.64, 1);  /* one restrained overshoot */
  --mo-ease-dim-in: cubic-bezier(0.4, 0, 1, 1);        /* spotlight on — decisive */
  --mo-ease-dim-out:cubic-bezier(0, 0, 0.2, 1);        /* spotlight off — gentle */

  /* ── magnitudes ────────────────────────────────────────────── */
  --mo-lift-sm:   1.22;    /* elements under ~40px: dots, tokens, badges */
  --mo-lift-lg:   1.05;    /* cards, tiles, rows */
  --mo-halo-w:    4px;     /* ring thickness at scale 1 (see 3.2) */
  --mo-halo-grow: 1.55;    /* how far a small-element halo blooms */
  --mo-tint-alpha: 0.18;   /* peak alpha of the tier-2 wash */
  --mo-recent-w:  3px;     /* afterglow ring thickness */

  /* ── spotlight ─────────────────────────────────────────────── */
  --mo-dim-opacity:    0.55;
  --mo-dim-saturation: 0.65;

  /* ── ambient ───────────────────────────────────────────────── */
  --mo-breathe: 3200ms;    /* active-turn ring period */
}
```

### 3.1 Why each number is what it is

**`--mo-announce: 1000ms`** — the load-bearing number. A person whose attention is elsewhere needs roughly 200–250 ms to initiate a saccade toward peripheral motion, ~100 ms for the saccade itself, and another 150–250 ms to fixate and recognise what they are looking at. Call it 600 ms from motion onset to comprehension, and that assumes they were already primed. An announcement shorter than ~800 ms is frequently over before the room has arrived. 1000 ms gives comfortable margin without feeling slow. **Do not shorten this to make the board feel snappier — snappiness is not the goal, arrival is.** The current `animate-bubble-pop` is 3500 ms, which overshoots in the other direction: by the time it finishes the audience has moved on, and it overlaps the next event.

**`--mo-stagger: 140ms`** — below about 100 ms, separate onsets perceptually group into a single flash, which is exactly the failure mode being fixed. 140 ms is comfortably above that threshold, so four sales in one second read as *four things in sequence*. With the 5-event cap this yields a 560 ms onset window, and a worst-case burst of 560 + 1000 = 1.56 s from first motion to last settle.

**`--mo-lift-sm: 1.22` and `--mo-lift-lg: 1.05`** — magnitude must scale inversely with element size, which the original spec got wrong by proposing one value. A 28 px dot on a 1920-wide board projected to a 100" screen is about 32 mm across; at 5 m it subtends roughly 0.37°. Scaling it by 1.08 moves its edge ~1.3 mm, which is below reliable detection at that distance. 1.22 moves it ~3.5 mm and is clearly visible, while still being nothing like the current 1.45 lurch. A 300 px region card, by contrast, is already large enough that 1.05 is plainly visible, and anything more shoves its neighbours around.

**`--mo-halo-grow: 1.55`, small elements only** — on a dot, the ring is doing most of the work: blooming from a −6 px inset out to 1.55× turns a 28 px dot into a ~43 px expanding circle, which is far more detectable at distance than any scale change to the dot itself. On a large card the same growth would push the ring 80 px outside the card and overlap its neighbours, so large elements get a ring that *fades in place* with a small inset drift instead. See the two variants in 4.1.

**`--mo-tint-alpha: 0.18`** — the tier-2 wash sits on white cards. At the 0.55 originally proposed, an amber wash on white is a genuine flash — the very complaint being fixed — and tier-2 events (logistics and research investment) are the *most frequent* thing on the board. At 0.18 it reads as a brief glow. Just as important, the tint must **ramp in over ~15% of its duration rather than starting at peak**: a hard-edged onset is perceived as a flash, a ramped one as a glow. Same total energy, completely different feeling.

**`--mo-dim-opacity: 0.55` / `--mo-dim-saturation: 0.65`** — the spotlight is the largest single legibility win, but the board is *light* (slate-100 background, white cards), and contrast reduction is felt more strongly on light surfaces than on dark ones. Dimming to 0.45 crosses into looking broken, and facilitators will report it as a rendering fault. At 0.55 the un-changed cards are unmistakably recessed while their text stays legible, so a participant mid-way through reading their own region doesn't lose their place during someone else's turn. Desaturating as well as dimming does more work than dimming alone, because the board's meaning is carried by team colour.

**`--mo-instant: 140ms` in, `--mo-release: 420ms` out** — the spotlight must engage faster than it releases. If the dim ramps in slowly, the contrast moment is spread out and lost; if it snaps off, the board flinches. Asymmetric timing is deliberate, and the two easings above reinforce it.

**`--mo-afterglow: 9000ms`** — long enough that a facilitator who turns from the flipchart to the screen can still see what happened, short enough that rings don't accumulate into permanent clutter during a busy sales phase. Pair it with the cap in §7 (max 5 simultaneous rings, oldest dropped).

**`--mo-ease-pop: …1.3…`** — the current curve peaks at 1.56, which is a cartoon bounce. 1.3 keeps a single confident overshoot appropriate to a professional training tool. There is exactly one overshoot in the whole system; everything else decelerates cleanly.

**`--mo-breathe: 3200ms`** — resting human breath is roughly 4 s. An always-on indicator pulsing faster than about 3 s reads as urgent, and urgency that never resolves becomes noise. 3.2 s reads as "alive" rather than "alarm". The current `attentionPulse` is 3.5 s but with a 1.18 scale and a 14–18 px shadow spread, so it is far too loud for a permanent state; keep the period, drop the amplitude to the ring-only version in §6.5.

**`--mo-coalesce: 250ms`** — Firestore commonly delivers the local write and the server acknowledgement 100–400 ms apart for a single logical action. A debounce shorter than ~200 ms splits one action into two animations. 250 ms of added latency is imperceptible on a spectator board where nobody is waiting on input. Cap the debounce's maximum wait at 600 ms so a sustained write stream can't starve the queue.

### 3.2 Ring thickness must compensate for `ViewerScaler`

`ViewerScaler` fits the 1920×1080 board to the window, so on anything smaller than a native 1080p display every pixel value shrinks. At a 0.6 scale a 4 px ring renders at 2.4 px and the halo becomes weak on exactly the laptop previews used for checking the work.

Have `ViewerScaler` publish its computed scale as a CSS variable on the board root:

```tsx
<div style={{ transform: `scale(${scale})`, ['--mo-scale' as string]: String(scale) }}>
```

and make ring widths compensate:

```css
--mo-halo-w:   calc(4px / var(--mo-scale, 1));
--mo-recent-w: calc(3px / var(--mo-scale, 1));
```

Durations, easings and scale factors do **not** need compensating — only absolute pixel lengths do.

### 3.3 The only two dials to touch, and how to know

Everything above is fixed. If the motion still isn't landing in the actual training room, adjust these two and nothing else. Judge from the back of the room, not from a desk.

| Symptom in the room | Dial | Direction |
|---|---|---|
| Someone at the back can't tell which element changed within ~1 s | `--mo-lift-sm` | 1.22 → 1.30 (hard ceiling 1.35) |
| The pop looks jumpy or toy-like on the projector | `--mo-lift-sm` | 1.22 → 1.15 |
| The changed element still doesn't stand out from the busy board | `--mo-dim-opacity` | 0.55 → 0.48 (hard floor 0.42) |
| Participants complain the board "greys out" or looks broken | `--mo-dim-opacity` | 0.55 → 0.62 |

Two rules when adjusting: change one dial at a time and watch a full sales phase before changing the other, and if the fix seems to require going past a hard limit, the problem is not the number — it is that too many elements are animating at once, so re-check the event cap in §7.

Resist adding new numbers. Nine simultaneous animation utilities is what produced the original problem; the whole point of a token system is that there is one place to look and very little to argue about.

---

---

## 4. Visual language — three tiers

| Tier | Used for | Motion | Duration |
|---|---|---|---|
| **1 — Announce** | The thing that just happened: a customer sold, an office completed, a technology completed, a patent awarded, an improvement claimed | Halo ring blooms outward + `scale(1 → --mo-lift-sm/lg → 1)` + board spotlight dims everything else | `1000ms` |
| **2 — Acknowledge** | Supporting changes: partial logistics/research progress, price token moved, control badge value changed, money changed | Ramped colour-tint wash on the element's own background. No scale, no spotlight. | `500ms` |
| **3 — Afterglow** | Anything that changed within the last 9 s | Static team-coloured ring. No animation at all. | `9000ms` |

Tier 3 is the part that makes the board readable for latecomers, and it is currently missing entirely. It is not optional.

### 4.1 Replacement keyframes

Delete `flashThreeSlow`, `attentionPulse`, `bubbleGlow` and `.animate-live-flash`. Add:

```css
/* Tier 1: halo bloom for SMALL elements (dots, tokens, badges under ~40px).
   Drawn on a pseudo-element so nothing repaints a box-shadow per frame. */
@keyframes mo-halo-sm {
  0%   { opacity: 0;    transform: scale(0.82); }
  18%  { opacity: 0.95; }
  100% { opacity: 0;    transform: scale(var(--mo-halo-grow)); }
}

/* Tier 1: halo for LARGE elements (cards, tiles, rows).
   Fades in place with a small inset drift — must NOT scale, or it
   overlaps neighbouring cards. */
@keyframes mo-halo-lg {
  0%   { opacity: 0;    inset: -2px; }
  18%  { opacity: 0.85; }
  100% { opacity: 0;    inset: -12px; }
}

@keyframes mo-lift {
  0%   { transform: scale(1); }
  38%  { transform: scale(var(--mo-lift, 1.22)); }
  100% { transform: scale(1); }
}

/* Tier 2: tint wash. Ramps IN over the first 15% — a hard-edged onset
   is perceived as a flash, a ramped one as a glow. Never touches opacity. */
@keyframes mo-tint {
  0%   { background-color: transparent; }
  15%  { background-color: var(--mo-tint-color, rgba(245, 158, 11, 0.18)); }
  100% { background-color: transparent; }
}

/* Entry for genuinely new elements (first time a dot appears) */
@keyframes mo-arrive {
  0%   { opacity: 0; transform: scale(0.6) translateY(4px); }
  100% { opacity: 1; transform: scale(1)   translateY(0); }
}

/* Board-level settle for round/phase change — one cross-fade, no per-element motion */
@keyframes mo-settle {
  0%   { opacity: 0.35; transform: scale(0.995); }
  100% { opacity: 1;    transform: scale(1); }
}

/* Ambient: the single permitted infinite animation (active turn) */
@keyframes mo-breathe {
  0%, 100% { box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.55); }
  50%      { box-shadow: 0 0 0 7px rgba(16, 185, 129, 0.12); }
}

Utility classes:

```css
/* Base announce. Callers MUST also add --mo-lift and one halo variant. */
.mo-announce {
  position: relative;
  z-index: 30;
  animation: mo-lift var(--mo-announce) var(--mo-ease-pop) both;
  animation-delay: var(--mo-delay, 0ms);
  will-change: transform;
}
.mo-announce::after {
  content: '';
  position: absolute;
  border-radius: inherit;
  border: var(--mo-halo-w) solid var(--mo-accent, #f59e0b);
  pointer-events: none;
  animation-duration: var(--mo-announce);
  animation-timing-function: var(--mo-ease-out);
  animation-fill-mode: both;
  animation-delay: var(--mo-delay, 0ms);
}

/* Small elements: dots, price tokens, office circles, patent badges */
.mo-announce--sm          { --mo-lift: var(--mo-lift-sm); }
.mo-announce--sm::after   { inset: -6px; animation-name: mo-halo-sm; }

/* Large elements: region cards, tech tiles, improvement rows, team cards */
.mo-announce--lg          { --mo-lift: var(--mo-lift-lg); }
.mo-announce--lg::after   { inset: -2px; animation-name: mo-halo-lg; }

.mo-ack {
  animation: mo-tint var(--mo-ack) var(--mo-ease-soft) both;
  animation-delay: var(--mo-delay, 0ms);
}

.mo-arrive {
  animation: mo-arrive var(--mo-quick) var(--mo-ease-pop) both;
  animation-delay: var(--mo-delay, 0ms);
}

/* Tier 3 — pure state, no animation. Team-coloured so the audience learns
   "purple ring = Team C acted" without reading anything. */
.mo-recent {
  box-shadow: 0 0 0 var(--mo-recent-w) var(--mo-accent, #f59e0b),
              0 0 0 calc(var(--mo-recent-w) + 3px) rgb(from var(--mo-accent, #f59e0b) r g b / 0.18);
  transition: box-shadow var(--mo-release) var(--mo-ease-soft);
}

/* The one permitted infinite animation on the whole board */
.mo-turn { animation: mo-breathe var(--mo-breathe) var(--mo-ease-soft) infinite; }
```

`will-change: transform` appears only on `.mo-announce`, which is added and removed with the animation — never leave it on statically.

If `rgb(from …)` relative colour syntax is not acceptable for the browser target on the projector machine, have `useBoardMotion` supply a pre-computed `--mo-accent-soft` alongside `--mo-accent` instead.

### 4.2 The spotlight (highest-impact single change)

While a tier-1 announcement is playing, dim everything that did *not* change. Apply `.mo-dimmable` to **top-level panels and cards only** — each `RegionCard` root, each tech tile, each improvement row, the price ladder rail, each top-bar team card — never to leaf nodes. This keeps the compositing cheap.

```css
.mo-board { --mo-dim: 1; }

.mo-board[data-spotlight='on'] .mo-dimmable:not([data-changed='1']) {
  opacity: var(--mo-dim-opacity);
  filter: saturate(var(--mo-dim-saturation));
}

/* Asymmetric: engage fast so the contrast moment lands, release slowly
   so the board doesn't flinch. */
.mo-dimmable {
  transition: opacity var(--mo-release) var(--mo-ease-dim-out),
              filter  var(--mo-release) var(--mo-ease-dim-out);
}

.mo-board[data-spotlight='on'] .mo-dimmable {
  transition: opacity var(--mo-instant) var(--mo-ease-dim-in),
              filter  var(--mo-instant) var(--mo-ease-dim-in);
}
```

`data-spotlight` is set to `'on'` for the duration of a tier-1 burst plus 250 ms (so the last halo finishes before the room comes back up), then removed. Never engage the spotlight for tier-2 changes, and never for bulk changes.

---

## 5. Architecture — the diff layer

### 5.1 New file: `src/pages/Viewer/motion/boardDiff.ts`

Pure functions, no React, fully unit-testable.

```ts
import type { GameState } from '@/types/game';

export type BoardEventKind =
  | 'customer-sold'
  | 'office-established'
  | 'logistics-progress'
  | 'research-progress'
  | 'tech-completed'
  | 'patent-awarded'
  | 'improvement-claimed'
  | 'price-set'
  | 'control-changed'
  | 'money-changed';

export interface BoardEvent {
  /** stable identity of the DOM element that should react, e.g. `customer:EU-3` */
  key: string;
  kind: BoardEventKind;
  tier: 1 | 2;
  teamId?: string;
  teamName?: string;
  teamColor?: string;
  regionName?: string;
  /** short sentence for the ticker, e.g. "Team B took Customer 3 in Europe" */
  label: string;
}

/** Deterministic: same pair of snapshots always yields the same event list. */
export function diffGameState(prev: GameState, next: GameState): BoardEvent[];

/** True when the delta is structural rather than an in-play event. */
export function isBulkTransition(prev: GameState, next: GameState): boolean;
```

`isBulkTransition` returns `true` when any of the following differ: `currentRound`, `currentPhase`, `teams.length`. Also treat as bulk when `diffGameState` returns more than `MAX_EVENTS_PER_TICK` (8) events.

**Key naming convention** — components subscribe by these exact strings:

```
customer:{regionName}:{customerId}
office:{regionName}:{teamId}
logistics:{regionName}:{teamId}
research:{technology}:{teamId}
tech:{technology}
patent:{technology}
improvement:{cardId}
price:{teamId}
control:{regionName}
money:{teamId}
```

### 5.2 New file: `src/pages/Viewer/motion/useBoardMotion.ts`

```ts
export interface MotionState {
  /** tier for an element key, or 0 if it should not animate */
  tierFor(key: string): 0 | 1 | 2;
  /** ms to delay this element's animation (stagger) */
  delayFor(key: string): number;
  /** true while the element is inside its 8s afterglow window */
  isRecent(key: string): boolean;
  /** drives .mo-board[data-spotlight] */
  spotlight: boolean;
  /** true for one --mo-settle window after a round/phase change */
  settling: boolean;
  /** newest-first, capped at 6, for the ticker */
  ticker: { id: string; label: string; color?: string; at: number }[];
}

export function useBoardMotion(gameState: GameState | null): MotionState;
```

Implementation requirements:

- **Baseline on first snapshot.** The first `gameState` received sets the baseline and emits nothing. This alone kills the "everything flashes when the board loads" case.
- **Coalesce snapshot bursts.** Firestore often delivers 2–4 snapshots within a few hundred ms for one logical action. Buffer incoming states and diff against the last *settled* baseline on a `--mo-coalesce` (250 ms) trailing debounce, with a 600 ms maximum wait so a sustained write stream cannot starve the queue, so one logical action produces one animation.
- **Single rAF sweep, not N timeouts.** Maintain one `Map<string, { tier, startedAt, delay }>` and expire entries in a single `requestAnimationFrame` loop. Do not create a `setTimeout` per element (this is what `TopBar.tsx` does today, and it leaks).
- **Stagger.** Sort events by tier (1 before 2), then by board reading order (top bar → price ladder → regions left-to-right, top-to-bottom → improvements → tech strip). Assign `delay = index * 140ms`, capped at `560ms` total.
- **Cap.** At most 5 tier-1 highlights per tick. Excess events fall back to tier 3 (afterglow ring only) and still appear in the ticker.
- **Bulk path.** When `isBulkTransition` is true: clear the highlight map, set `settling = true` for `--mo-settle`, emit one ticker line ("Round 3 · Sales phase"), and reset the baseline. **No per-element animation at all.**
- **Tab visibility.** If `document.hidden`, skip animation and go straight to afterglow state, so the board doesn't replay a queue when a projector wakes.
- **Reduced motion.** If `matchMedia('(prefers-reduced-motion: reduce)').matches`, return tier `0` for everything but keep `isRecent` and the ticker fully functional. Motion is optional; comprehension is not.

### 5.3 Context, so components don't prop-drill

`ViewerPage.tsx` creates the motion state and provides it via a small `MotionContext`. Components consume with `useMotion()`. Do not thread it through props — the tree is five levels deep in places.

---

## 6. Component-by-component changes

Every change below follows the same shape: replace a *state* predicate with a *key subscription*.

### 6.1 `RegionCard.tsx`

- Add `data-changed` and `.mo-dimmable` to the card root:
  ```tsx
  const m = useMotion();
  const cardChanged = m.tierFor(`control:${regionName}`) > 0 ||
    customerStatus.some(({ customer }) => m.tierFor(`customer:${regionName}:${customer.id}`) > 0);
  // root: className={cn('… mo-dimmable', …)} data-changed={cardChanged ? '1' : undefined}
  ```
- **Sold-customer dot (line ~292):** replace unconditional `animate-bubble-pop` with `motionClass(m, \`customer:${regionName}:${customer.id}\`)`, which returns `mo-announce` / `mo-ack` / `''`, plus `mo-recent` when `m.isRecent(key)`.
- **Present-team circles (line ~236):** key `office:{region}:{teamId}`, tier 1, plus `mo-arrive` only when the circle is genuinely new in this snapshot.
- **In-progress pie (line ~149):** key `logistics:{region}:{teamId}`, tier 2 (`mo-ack`). Also animate the `conic-gradient` sweep: move the fraction into a CSS custom property and transition it, rather than snapping.
  ```tsx
  style={{ ['--pie' as string]: `${degrees}deg`, background: `conic-gradient(${team.color} 0deg var(--pie), #e2e8f0 var(--pie) 360deg)` }}
  ```
  Register `@property --pie { syntax: '<angle>'; inherits: false; initial-value: 0deg; }` so the gradient can be transitioned smoothly; fall back to a stepped update where `@property` is unsupported.
- **Control badges (line ~187/194/206):** remove `animate-bubble-pop` from the container — keep it on children only, and only via `control:{regionName}`. Fixes the compounded-scale bug (1.4).
- Set `--mo-accent` to the acting team's colour so the halo is team-coloured rather than always amber. This is a significant readability win: the audience learns "purple ring = Team C acted" without reading anything.

### 6.2 `TechPanel.tsx`

- Investor dot (47) → `research:{technology}:{teamId}`, tier 2.
- Tile `hasInvested` (63) → `research:{technology}:{teamId}`, tier 2; `tech:{technology}` tier 1 on completion.
- Patent badge (123) → `patent:{technology}`, tier 1, `mo-arrive` on first appearance.
- Remove `animate-pulse` from the `Award` icon (126). Replace with `mo-recent` while inside the afterglow window, then static.
- Tile root gets `.mo-dimmable`.

### 6.3 `ImprovementStrip.tsx`

- Remove `opacity-0 animate-slow-score` from every row (201). Rows are a list, not an event. Only newly-claimed rows animate, via `improvement:{cardId}`.
- Remove `animate-attention` from the winner row (203). Winner is a *status*: express it with a static gold ring and a single one-shot `mo-announce` at the moment the winner changes.
- Remove `animate-bounce` (177) and `animate-pulse` (219).
- Claimed badge (153) → `improvement:{cardId}`, tier 1.
- Row roots get `.mo-dimmable`.

### 6.4 `PriceLadder.tsx`

- Price tokens must **move**, not pop. Give each token a stable React key of `teamId` and position it with a transform on the rail rather than re-mounting it in a new row:
  ```tsx
  style={{ transform: `translateY(${rowIndex * ROW_H}px)`, transition: 'transform var(--mo-announce) var(--mo-ease-pop)' }}
  ```
  A token sliding from \$5 to \$3 communicates "Team B undercut" far better than a token disappearing and a different one popping in. This is the single biggest legibility upgrade in the rail.
- Keep the existing "reveal from \$5" choreography — it's good — but drive it with the transform above so it reads as a race rather than a set of independent pops.
- Remove `animate-pulse` (143). Use `mo-recent` instead.
- Stagger token reveals by turn order, not simultaneously: `--mo-delay: {orderIndex * 140}ms` (one `--mo-stagger` step each). The audience should see the ladder resolve in play order.
- Rail root gets `.mo-dimmable`.

### 6.5 `TopBar.tsx`

- **Delete the broken effect at lines 36–54 entirely.** Its job is now done by `useBoardMotion`.
- Unsold-count bubble (235) → `money:{teamId}` / production key, tier 2.
- Active-turn card (151): this is the *one* place perpetual motion is allowed. Replace `animate-attention` (infinite, aggressive) with a slow, low-amplitude breathing ring:
  Use the `.mo-turn` class from §4.1 — period `--mo-breathe` (3.2 s), ring only. No scale, no opacity change. Enforce that at most one element on the board carries `.mo-turn`.
- Remove `animate-ping` (159) — it is redundant with the breathing ring.
- Remove `animate-flash-three-slow` (180). Replace with `mo-announce` fired once when that team's status actually changes.
- Team cards get `.mo-dimmable`.

### 6.6 `ViewerPage.tsx`

- Add `className="mo-board"` and `data-spotlight={m.spotlight ? 'on' : undefined}` to the 1920×1080 root.
- Wrap the board content in `<MotionProvider gameState={gameState}>`.
- When `m.settling`, apply `mo-settle` to the main board section so a round change reads as one clean transition.

### 6.7 New component: `src/pages/Viewer/EventTicker.tsx`

A single-line caption strip, 34 px tall, sitting directly under the top bar (reduce the main board section's `top` from `120px` to `154px`).

- Shows the most recent event label, in team colour, e.g. **"Team C established an office in Asia"**.
- Cross-fades to the next label; never scrolls, never marquees.
- Holds the last label indefinitely once the queue empties, so the board always says what most recently happened.
- On bulk transition, shows **"Round 4 · Planning"**.

This is what actually guarantees "everyone can see the effects of what just occurred" — motion alone cannot survive someone looking away for two seconds. Build it in the same pass as the diff layer, not later.

---

## 7. Choreography rules (must hold)

1. Never more than **5** concurrently animating elements.
2. Never more than **1** tier-1 announcement at the same instant — stagger them by `--mo-stagger` (140 ms).
3. Total burst length ≤ **1.6 s** from first motion to last settle (560 ms of onsets + 1000 ms announce).
4. Spotlight engages only for tier 1, and for no longer than `--mo-announce + 250ms`.
5. Afterglow rings persist **9 s**, capped at **5 simultaneous rings** — oldest dropped first, then fade over `--mo-release`.
6. No animation on: first paint, reconnect, round change, phase change, tab regain.
7. Only one infinite animation may exist on the board at any time (the active-turn ring). Delete every other infinite/looping animation from the viewer, including `animate-spin-slow` and `animate-marquee-slow` unless a specific product reason survives review.

---

## 8. Accessibility & performance

- Animate only `transform`, `opacity`, `filter` and `background-color`. Do not animate `box-shadow`, `width`, `height`, `top` or `left`. The current `attentionPulse` and `flashThreeSlow` animate `box-shadow`, which forces repaint on every frame across dozens of elements — a real contributor to the janky feel on projector hardware.
- Apply `will-change: transform` only to elements currently animating (via the utility class), never statically.
- Never exceed 3 flashes per second anywhere on screen (WCAG 2.3.1). The tier system already satisfies this; keep it that way.
- The existing `@media (prefers-reduced-motion: reduce)` block in `src/index.css` stays. Additionally, `useBoardMotion` must return tier `0` under reduced motion while keeping afterglow rings and the ticker — a reduced-motion viewer should lose the animation, not the information.
- Target 60 fps on a 1920×1080 projector on integrated graphics. Verify with a Performance recording during a full sales phase; no frame over 16 ms.

---

## 9. Acceptance criteria

Each is a scenario a reviewer can run against a live class.

| # | Scenario | Expected |
|---|---|---|
| 1 | Open the viewer on a game already in round 3 | Board renders completely static. Zero animations. Ticker shows the current round/phase. |
| 2 | One team sells to one customer | Exactly one dot announces. Everything else dims to 55% opacity for ~1.2 s. Ticker names the team, customer and region. Ring persists 9 s. |
| 3 | Four teams sell within one second | Four announcements play in sequence ~140 ms apart, in board reading order. Never simultaneously. |
| 4 | A team invests 1 of 3 logistics icons | Pie sweeps smoothly to 33%. Tier-2 tint only. No spotlight, no scale, no other element moves. |
| 5 | Facilitator advances the round | One board-level settle. Zero per-element animation. Ticker reads "Round 4 · Planning". |
| 6 | Prices revealed leaving planning | Tokens slide down the rail in play order, staggered. No pops, no remounts. |
| 7 | Someone looks up 7 s after a sale | The changed dot still carries a visible ring and the ticker still names the event. |
| 8 | Idle board, nothing happening for 60 s | Exactly one element is in motion (the active-turn ring). Everything else is completely still. |
| 9 | `prefers-reduced-motion: reduce` | No motion. Rings and ticker still work. |
| 10 | Network hiccup / reconnect | No animation replay burst. |

Scenario 8 is the acid test for the original complaint. If anything else moves, an infinite animation was missed.

---

## 10. Files touched

```
src/pages/Viewer/motion/boardDiff.ts          NEW
src/pages/Viewer/motion/useBoardMotion.ts     NEW
src/pages/Viewer/motion/MotionContext.tsx     NEW
src/pages/Viewer/motion/motionClass.ts        NEW  (small cn() helper)
src/pages/Viewer/EventTicker.tsx              NEW
src/pages/Viewer/viewer.css                   REWRITE animation section (tokens + tiers)
src/index.css                                 DELETE attentionPulse / bubbleGlow / flashThreeSlow / slowScoreReveal utilities
src/pages/Viewer/ViewerPage.tsx               provider, mo-board, spotlight attr, ticker slot
src/pages/Viewer/RegionCard.tsx               key subscriptions, remove blanket classes
src/pages/Viewer/RegionLayer.tsx              pass region name context if needed
src/pages/Viewer/TechPanel.tsx                key subscriptions
src/pages/Viewer/ImprovementStrip.tsx         key subscriptions, remove list-entry animation
src/pages/Viewer/PriceLadder.tsx              transform-based token movement
src/pages/Viewer/TopBar.tsx                   delete broken effect, single breathing ring
src/tests/boardDiff.test.ts                   NEW
```

`src/index.css` utilities are also referenced outside the viewer — grep for `animate-attention`, `animate-bubble-pop`, `animate-slow-score`, `animate-flash-three-slow` across `src/components/` before deleting, and either migrate those call sites or scope the deletions to the viewer.

No new dependencies. Everything here is CSS + React state. If a later pass wants FLIP layout animation for the price ladder, `framer-motion` would be the choice, but it is not required for this spec and should not be added in this pass.

---

## 11. Implementation order

Ship each step separately; each is independently verifiable.

1. **Stop the bleeding.** Delete every infinite animation in `src/pages/Viewer/*` except one active-turn indicator. Verify scenario 8. *(~30 min, immediately visible improvement.)*
2. **Motion tokens.** Add the token block and the new keyframes/utilities to `viewer.css`. Swap `animate-bubble-pop` → `mo-announce` one-for-one, still on the old triggers. Board becomes calmer but still over-fires.
3. **Diff layer.** Build `boardDiff.ts` with unit tests against two fixture `GameState` objects. No UI changes yet.
4. **Motion hook + context.** Wire `useBoardMotion` into `ViewerPage`. Log events to console only. Watch a real class and confirm the event stream matches what a human observer would call "what just happened".
5. **Subscribe components.** Convert `RegionCard` first (highest event volume), verify scenarios 2–4, then `TechPanel`, `ImprovementStrip`, `PriceLadder`, `TopBar`.
6. **Spotlight.** Add `.mo-dimmable` and the `data-spotlight` rule. Verify scenario 2.
7. **Afterglow.** Add `mo-recent`. Verify scenario 7.
8. **Ticker.** Build `EventTicker`. Verify scenarios 2 and 5.
9. **Price ladder movement.** Convert to transform-based positioning. Verify scenario 6.
10. **Performance & a11y pass.** Profile a full sales phase, verify scenario 9 and the WCAG flash limit.

---

## 12. Notes for the implementer

- Do not "improve" the layout, spacing, icon set or connector rendering while in here. Those are working and the client is happy with them. Every diff in this work should be traceable to a line in this spec.
- If a change genuinely has no sensible key (nothing in the data model identifies it uniquely), add the key to the data rather than falling back to animating on existence. Animating on existence is the bug.
- Prefer deleting an animation over tuning it. The board had roughly nine distinct animation utilities in simultaneous use; the target is four.
- Every number is already decided in §3. Do not re-derive them, and do not introduce new ones. If the motion isn't landing in the room, §3.3 lists the only two dials to touch.
