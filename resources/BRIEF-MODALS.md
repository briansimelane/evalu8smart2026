# Brief 2: Improvement and Scoring modals (3D graphics and animation)

Audience: Antigravity. Owner: Brian Simelane.
Read `BRIEF.md` first. Everything in its section 1 (hard constraints), section 3 (architecture, stage scaling) and section 6 (animation rules, queue, reduced motion) applies here too. This brief only adds the two modals.

Targets: `modals/improvement-modal.png` and `modals/scoring-modal.png` (shown over `modals/background-map-for-modals.png`). All numbers and team data in the images are **sample data**.

---

## 1. Purpose and behaviour

The Improvements and Scoring panels no longer live on the board (they were removed from the right side). They become **modals above the map**, opened over a dimmed, blurred map.

| Modal | Opens automatically | Also opens |
|---|---|---|
| **Improvements** | When the game enters the improvement phase (rounds 1 to 4 only) | Top-bar "Improvements" button, any time |
| **Scoreboard** | When the game enters the scoring phase | Top-bar "Scoreboard" button, any time (live standings) |

Rules:
1. Auto-open **once per phase entry**. If the facilitator closes it, do not reopen it until the phase changes again.
2. Improvement phase is skipped from **round 5** (`TopBar.tsx` already enforces this). In round 5+, the Improvements button opens a short "No Improvement Phase in Round 5" notice, as `OverlayImprovementPanel` does today.
3. Close with the X button, `Esc`, or a click on the backdrop. Focus trap while open; restore focus to the opener on close. `role="dialog"`, `aria-modal`, labelled by the title.
4. Only one modal at a time. Opening one closes the other.
5. The modal is read-only. Phase switching stays in the top bar.
6. The board keeps updating behind the modal. Heavy board animations are **queued while a modal is open and played when it closes**, light ones (pulses, counters) keep running. All state is always correct on close. Never drop an event, because every team's action must remain visible (hard constraint 3).
7. Stage scaling: modal is part of the 1920x1080 stage and scales with it (same rules as `BRIEF.md` section 3.1).

---

## 2. Rendering approach

- **Modal shell, text, tables and chips: DOM/CSS**, so text stays crisp and accessible.
- **3D elements inside the modal: one small R3F `<Canvas>` that is mounted only while a modal is open** and disposed on close. Use `frameloop="demand"`, the same dpr rules as the board, and a transparent background so it composites over the DOM.
  - Improvements: 3D effect icons on the cards, card flip/lift and the claim fly-out effects.
  - Scoreboard: 3D rank medals, a leader trophy/crown, podium mode and confetti.
- Alternative for the card flips only: CSS 3D transforms (`rotateY`, `perspective`) are acceptable if simpler. Use R3F for icons, particles, trophy and anything with depth or lighting.
- Backdrop: board stays rendered underneath; apply `backdrop-filter: blur(6px)` plus a dark navy overlay at 55% (as in the images). If `backdrop-filter` performance is poor on the projector machine, fall back to a static 55% overlay without blur (Quality = Low).
- Modal container: x=150, y=70, w=1620, h=940, radius 28, shadow `0 18px 48px rgba(11,18,38,.45)`. Header band 112px tall.

Suggested files:
```
src/pages/Viewer3D/modals/
  ModalShell.tsx            // backdrop, focus trap, open/close, auto-open rules
  ImprovementModal.tsx
  ScoreboardModal.tsx
  three/EffectIcon.tsx      // 3D price / product / research / logistics icons
  three/CardMesh.tsx        // rounded card, flip, lift
  three/Medal.tsx Trophy.tsx Confetti.tsx
  anim/modalSequences.ts
```

---

## 3. Improvements modal

### 3.1 Data (read from existing state; do not invent)
- Pool of cards for the round: `gameState.improvementPoolByRound[round]`; if empty, derive as `OverlayImprovementPanel` does (unused cards from `AVAILABLE_IMPROVEMENT_CARDS`, sliced to the number of teams). Card = `{ id, icon1, icon2 }` from `src/data/improvements.ts`.
- Claims: `gameState.improvementCards` where `allocatedInRound === round`; claimer is `availableForTeam || usedBy`.
- Per-team improvement points to spend this round: `rounds[round].teamData[teamId].improvementCards`.
- Turn order: `calculatePlayOrderForState(gameState, round)`.
- "Choosing now" team: the same logic as `activeTurnTeam` for `phase === 'improvement'` in `TopBar.tsx` (first team in play order with points > 0 and no claim yet).
- Effects (from `ICON_EFFECTS`): Price Plus = price +1; Price and Product = price -1 and product +1; Product = +1 product; Research = +1 research icon; Logistic = +1 logistics icon.
- Claim moment: reuse the motion layer key `improvement:{cardId}` (`tierFor(key) === 1` means a new claim), as `OverlayImprovementPanel` already does.

### 3.2 Layout (from `modals/improvement-modal.png`)
- Header: amber gradient `#d97706` to `#facc15`, "CLASS: SMARTPHONE INC" label, title **IMPROVEMENTS**, a "ROUND n" pill, sub-line "Teams claim one card each, in turn order", close button.
- **Card pool** (left, x=190, y=240): cards 172x520, gap 16, in a row. Each has "CARD id" label, two effect slots (172-28 wide, 152 tall, `#f1f5f9`), a label under each icon, and a footer band.
  - Available: green outline, footer "AVAILABLE" (green tint, green border).
  - Claimed: outline and footer in the claiming team's colour, footer text "CLAIMED · TEAM n", content dimmed to 50%.
  - If the pool has more than 5 cards, shrink card width to fit (min 140) and keep one row; if more than 8, wrap to two rows.
- **Turn order** (right, x=1150, w=580): one row per team in play order, 88px tall: order number, team pill, points chip ("1 pt"), then status: tick + "Claimed Card n", or amber "Choosing now…" with a ring, or italic grey "No improvement points". The active row has an amber 4px border and a soft shadow.
- **Legend strip** (bottom): what each icon does, with the same icons as the cards.
- Team colours come from `team.color` with the contrast helper; the reference uses green `#10b981`, blue `#3b82f6`, black `#1e293b`, yellow `#eab308`, red `#ef4444`.

### 3.3 Effect icons (also needed as 3D models)
Rounded-square tiles with a glossy highlight and a white glyph:
- **Price**: red `#e11d2e` tile, white "$", small circular badge bottom-right with + (green) or - (red).
- **Product**: slate `#475569` tile, package/box glyph.
- **Research**: purple `#7c3aed` tile, flask glyph.
- **Logistics**: cyan `#06b6d4` tile, truck glyph (same icon as on the board plates).
Provide as GLB or generated geometry (rounded box + extruded glyph, emissive-free, soft lighting). The glyph paths are in `reference-generator/gen_improve.py` (`PACK`, `FLASK`, `TRUCK`).

### 3.4 Animation sequence
| Moment | Animation | Time |
|---|---|---|
| Modal opens | Backdrop fades in; shell scales 0.94 to 1 with a soft spring; header text slides up | 350 ms |
| Cards deal in | Cards drop from above, staggered 80 ms, land face-down then flip face-up (rotateY 180 to 0) | 600 ms each |
| Idle | Effect icons bob gently (+/- 3px) and rotate +/- 6 degrees, offset per card; the active turn row pulses its ring | continuous |
| Active team changes | Ring and highlight slide from the previous row to the new one; available cards get a brief shimmer sweep | 450 ms |
| **Card claimed** | Chosen card lifts 24px and scales 1.05, glows in the claimer's colour; footer band wipes from AVAILABLE to the team colour; card content dims; a team token stamps onto the card; the turn row gets a tick that draws in | 900 ms |
| Claim effect fly-out | A small icon of each effect (e.g. +1 Research) arcs from the card to that team's row, then fades; the row's points chip counts down to 0 | 700 ms |
| All claimed | Short success pulse on the header; auto-dismiss is **off** (facilitator closes it) | 500 ms |
| Round 5+ notice | Simple fade, no cards | 250 ms |

Queue claim animations so two teams claiming close together each get a full moment (max 2 concurrent in this modal). Under reduced motion: no flips, lifts or fly-outs, only opacity changes and the state updates.

---

## 4. Scoreboard modal

### 4.1 Data (read from existing code; do not recompute rules in the view)
Use `calculateTeamTotalScore(teamId, round, gameState)` from `src/types/game.ts`. It returns `startValue, cumulativeRevenue, cumulativeControl, patentBonus, wildcardBonus, directiveBonus, totalScore`.
- Rank by `totalScore` descending, as `src/components/dashboard/Scoreboard.tsx` does (check its tie-break, which uses money; match it).
- Patent chips: the technologies the team holds the patent for. Read ownership from existing patent state (`gameState.patents`, `getTeamPatentPoints`). Do not invent patent point values: the reference's "+4" is a placeholder.
- Wildcard and directive bonuses are only added at game end (see `calculateTeamTotalScore`). Mid-game the columns are absent and the footer note reads "Wildcard and directive bonuses are added at game end". At game end (`gameState.gameEnded`), add **Wildcards** and **Directives** columns and bar segments.
- "THIS ROUND" gain: **new derived value**, `totalScore(round) - totalScore(round - 1)`. Not in the current Scoreboard. Brian to confirm whether to keep it (see open questions).
- Start values come from `getInitialScore` (colour based).

### 4.2 Layout (from `modals/scoring-modal.png`)
- Header: blue gradient `#1e3a8a` to `#3b5bdb`, title **SCOREBOARD**, "ROUND n" pill, close button.
- Legend row with colour keys: Start value `#94a3b8`, Revenue `#38bdf8`, Control points `#8b5cf6`, Patents `#f59e0b` (and later Wildcards, Directives when shown); note on the right.
- Column headers: RANK / TEAM, START, REVENUE, CONTROL, PATENTS, THIS ROUND, TOTAL.
- One row per team, 112px tall, 12px gap: rank medal (1 gold `#fbbf24`, 2 silver `#cbd5e1`, 3 bronze `#d6a36b`, rest pale), team pill in team colour, the numbers, patent pills with the bonus, a gain chip with an up arrow, the big total with "POINTS", and a **stacked bar** under the team name showing the composition of the total. Bar scale: the leader's total is the full length.
- Leader row: pale gold fill and a gold 3px border.

### 4.3 Animation sequence
| Moment | Animation | Time |
|---|---|---|
| Modal opens | Same shell animation as Improvements | 350 ms |
| Rows enter | Rows slide in from the left, staggered 70 ms | 500 ms |
| Numbers | Count up from 0 (or from the previous round's value if reopened mid-game) with ease-out | 800 ms |
| Stacked bars | Segments grow left to right in order: start, revenue, control, patents (then wildcards, directives at game end), each 250 ms | 1000 ms |
| Rank changes | When the order changes (live or round change), rows reorder with a FLIP move; a small up/down arrow appears next to the medal for 3 s | 600 ms |
| Leader | A small 3D trophy or crown on the leader's medal, slowly rotating (R3F); medals have a gentle shine sweep | continuous |
| Score changes live | The changed number flashes in its colour and the bar segment extends smoothly | 500 ms |
| **Game end** (`gameEnded`) | **Podium mode** (new design, see section 6): top three on 3D podium blocks, confetti burst once, then the full table below | 4 s sequence |

Under reduced motion: no confetti, no count-up (show final values), no FLIP (instant reorder with a highlight).

---

## 5. Hand-over checklist (what Antigravity needs for this brief)

| # | Item | Where |
|---|---|---|
| 1 | This brief and `BRIEF.md` | `BRIEF-MODALS.md`, `BRIEF.md` |
| 2 | Target images (modals over the map) | `modals/*.png` |
| 3 | Board layout JSON and board reference images | `layout.json`, `reference-images/` |
| 4 | Exact sizes, colours and glyph paths | `reference-generator/gen_improve.py`, `gen_score.py` (reference only, not to be ported; run from a folder containing `22_midgame-v11.png`, or edit the path to `modals/background-map-for-modals.png`) |
| 5 | Existing code to read | `src/data/improvements.ts`, `src/pages/Viewer/overlay/OverlayImprovementPanel.tsx`, `src/pages/Viewer/ImprovementStrip.tsx`, `src/components/dashboard/Scoreboard.tsx`, `src/types/game.ts` (`calculateTeamTotalScore`, `getInitialScore`, `getControlPointsForTeamInRound`, `getTeamPatentPoints`), `src/pages/Viewer/TopBar.tsx` (active turn logic), `src/pages/Viewer/motion/*` |
| 6 | 3D assets still to be sourced or made | Effect icons (price, product, research, logistics), rank medals, trophy or crown, podium blocks, confetti sprite. Low-poly, under 100 KB each |
| 7 | Decisions from Brian (section 7) | Ask before building the affected part |

---

## 6. Not yet designed (needs a design from Brian/Claude before building)
- **Game-end podium** variant of the Scoreboard.
- Scoreboard columns for **wildcards and directives** at game end.
- The top-bar "Improvements" and "Scoreboard" buttons (placeholder pills are fine for now).
- Sound effects (not in scope unless Brian asks; default off).

---

## 7. Open questions for Brian (do not guess)
1. Should the pool show **all** cards (one per team) or only four like the current overlay?
2. Should each team's **starting card** (`INITIAL_IMPROVEMENT_CARDS`) appear in this modal?
3. Keep the **"THIS ROUND" gain** column (new derived value), or drop it?
4. What are the real **patent point values** in the score? The reference "+4" is a placeholder.
5. Naming: the 12th region's internal key is `Australia` but the display name is **"Sub-Saharan Africa"**. The board images and `BRIEF.md` still say "Australia" with an Opera House landmark, and need updating. Confirm the display name and landmark before art is built.

---

## 8. Milestones and acceptance

- **M1 (static):** both modals open from the top-bar buttons, correct layout and real data, shell open/close, `Esc`/backdrop/focus trap, auto-open rules.
- **M2 (3D elements):** effect icons, medals, trophy rendered in the in-modal canvas; canvas created on open and fully disposed on close (no leak after 50 open/close cycles).
- **M3 (animation):** all sequences in sections 3.4 and 4.3, queue, reduced motion, Quality toggle.
- **M4 (game end):** podium mode once designed.

Acceptance (Brian will verify):
- [ ] Improvements modal auto-opens on entering the improvement phase (rounds 1 to 4), not in round 5+, and does not reopen after being closed.
- [ ] Claimed cards, the "choosing now" team and the "no improvement points" state all match the game state.
- [ ] Scoreboard totals equal `calculateTeamTotalScore` for every team and match the classic scoreboard.
- [ ] Nothing is lost while a modal is open: board events queued during it play on close.
- [ ] Reduced motion and Low quality both work; no console errors; stage scaling works at 1280x720 and 3840x2160.
- [ ] Classic viewer unchanged.
