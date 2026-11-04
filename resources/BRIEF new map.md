# Brief: Viewer 3D ("Island Board") for Smartphone Inc / Evalu8Smart 2026

Audience: Antigravity (implementing developer). Owner: Brian Simelane.
Status: design approved as images; this brief turns it into an implementation with React Three Fiber (R3F) animation.

---

## 0. What you are given

| File | Purpose |
|---|---|
| `BRIEF.md` | This document. The source of truth for scope, rules and acceptance. |
| `layout.json` | Exact geometry on the 1920x1080 stage: island rectangles, info-plate rectangles, landmark anchors, 17 connector paths, camera constants, HUD zones. **Use it; do not measure from the PNGs.** |
| `reference-images/` | The approved visual targets (see section 2). |
| `reference-generator/gen15.py` (+ `gen.py`) | The Python script that drew the images. **Reference only**: it shows exact colours, sizes, glyph shapes, landmark drawings and sample data. Do not port it; read it when a number or colour is missing from this brief. It is a vector approximation of the intended look, not final art. |

The brief plus `layout.json` plus the reference images is enough to recreate every image. Anything not stated in the brief should be read from `reference-generator/gen15.py`.

---

## 1. Goal and hard constraints

Replace the look of the live board ("Viewer") with a landmark-topped island board, and add polished R3F animation. The classic viewer stays available.

**Hard constraints (from the project's architecture rules; confirm each in the code):**
1. **Display layer only.** Do not change game rules, Firestore data shape, or scoring logic. Do not rename internal region keys or tech keys.
2. **Same data source.** Read everything through the existing state hook (`useGameBoardState` and `GameState` types in `src/types/game.ts`; region data in `src/data/regions.ts`). Never invent values: if a value shown in a reference image is not in state, ask Brian.
3. **All teams' actions visible simultaneously.** No camera that follows one team. Animations are short, queued and non-blocking.
4. **Feature flag.** New viewer loads with `?viewer=3d` (or a settings flag). Classic viewer remains the default until Brian approves. If WebGL is unavailable or the canvas errors, fall back to the classic viewer automatically.
5. **Multi-world viewer** (`CombinedViewerPage`) is out of scope. Do not break it.
6. **Reuse the existing motion layer** (`useBoardMotion`, `MotionContext`, `tierFor`, `isRecent`, `mo-*` classes, `--mo-scale`) as the *event source* for animations. Do not write a second diffing system.

---

## 2. Reference images (what each one proves)

1. `01-planning-phase.png`: Planning phase. Teams are hidden on the price ladder ("PRICES HIDDEN" panel). Turn order reads "Determined in Production". No Unsold Products bar. Technologies are all untouched.
2. `02-final-layout-planning.png`: final geometry, connectors, bigger logistics badge.
3. `03-midgame-sales-patents.png`: Round 6, Sales phase, with sold customers, offices, in-progress expansions, control points, tech progress, patent owners and reduced tech costs. **This is the "everything on" target.**
4. `00-pre-sales-early-version.png`: earlier iteration; only for reference.

All sample data in the images is invented. Real values come from game state.

---

## 3. Architecture

### 3.1 Stage and scaling
- Design coordinate system is **1920 x 1080**. Everything in `layout.json` is in these units.
- Keep `ViewerScaler`: scale the whole stage uniformly, `scale = min(w/1920, h/1080)`. No maximum scale (must work on a big TV). Letterbox with the board background colour.
- The canvas backing size is `1920*scale*dpr` by `1080*scale*dpr`, **not** a 1080p canvas stretched by CSS. Cap `dpr` at 2 and cap total canvas pixels at about 8.3M (4K). Use drei `PerformanceMonitor` to step dpr down if frame rate drops.
- Minimum supported display is about 1280x720; text must stay readable there.

### 3.2 Hybrid rendering (important)
- **R3F `<Canvas>` (behind):** island bases, grass, landmark models, trees, water, hex background tiles, connectors, wrap arrows.
- **DOM (in front, absolutely positioned using `layout.json`):** top bar, price ladder, technologies strip, and the **info plate of each region** (logistics badge, name, office circles, customer chips, control badges). Reuse/restyle `RegionCard`, `TopBar`, `PriceLadder`, `TechPanel` logic. Text stays HTML so it is crisp and accessible.
- Layer order bottom to top: background, islands + landmarks + trees, **connectors**, plates (DOM), control badges, HUD.
  - Connectors must be drawn **over** island art and **under** plates (this fixed the "connectors hidden behind landmarks" bug).
  - Landmarks and trees are clipped to their own island's horizontal extent and must never render over any plate or customer chip.

### 3.3 Camera
- `OrthographicCamera`, fixed tilt. Elevation 50 degrees, no perspective. Mapping used by the reference generator: `screenX = ox + x*k`, `screenY = oy + (z*sin(e) - y*cos(e))*k`, constants in `layout.json -> camera`.
- Camera is fixed. Only subtle idle sway (<= 0.3 degrees) is allowed, and not when reduced motion is on.
- The orthographic frustum is tied to the 1920x1080 design size, never to window size, so DOM plates always line up with the art.

### 3.4 Suggested file layout
```
src/pages/Viewer3D/
  Viewer3DPage.tsx          // flag, fallback, scaler, layers
  scene/BoardScene.tsx      // <Canvas>, camera, lights, frameloop="demand"
  scene/Island.tsx          // base, grass, trees, landmark slot
  scene/landmarks/*.tsx     // 12 landmark components (GLB or primitives)
  scene/Connector.tsx       // tube/line along layout path + pulse shader
  scene/WrapArrow.tsx       // 8 Pacific arrows
  scene/Water.tsx Boat.tsx Clouds.tsx
  hud/*                     // DOM: TopBar, PriceLadder, TechStrip, RegionPlate
  anim/useSceneEvents.ts    // maps motion layer events to animation commands
  anim/queue.ts             // animation queue
  layout.json
```

---

## 4. Layout spec (see `layout.json`)

- `regions[name]`: `island {x0,x1,y0,y1,sideThickness}`, `plate {x,y,w,h}`, `logisticsCost`, `maxTeams`, `customerSlots`, `landmarkAnchor {x,y,scale}`.
- `connectors[]`: 17 links, each with `from`, `to`, `start`, `end`, and `path` (screen-space polyline, every 4th sample of a cubic Bezier). Rebuild as a smooth curve (CatmullRom) in the scene.
- Region keys: Canada, USA, Caribbean, South America, Europe, Emirates, North Africa, RSA, CIS, China, India, Australia. Use the repo's real keys for lookups.
- Connector topology must equal the classic `RegionLayer` link list: CIS-China, China-India, India-Australia, RSA-Australia, North Africa-Europe, Emirates-RSA, India-Emirates, Europe-CIS, South America-RSA, Caribbean-South America, Caribbean-USA, Canada-USA, USA-Europe, USA-South America, North Africa-South America, Emirates-North Africa, North Africa-China.
- Short vertical links (Canada-USA, USA-Caribbean, Caribbean-South America, CIS-China, China-India, India-Australia, Emirates-North Africa) are deliberately anchored at the island edge, away from the landmark, so they stay visible.
- **8 Pacific wrap arrows** (each its own lane, never overlapping, labels above the line): exits at the right edge: CIS "TO CANADA", India "TO CANADA", Australia "TO USA", Australia "TO CARIBBEAN". Entries at the left edge: Canada "FROM CIS", Canada "FROM INDIA", USA "FROM AUSTRALIA", Caribbean "FROM AUSTRALIA". Lane offsets are in `reference-generator/gen15.py` (`lane(...)` calls). Arrows have no trucks on them; no BLOCKED label anywhere.

---

## 5. Visual spec per element

### 5.1 Islands
Chamfered hex-ish tile: stone base (extruded side, gradient), pale lip, grass top, paved front band, soft drop shadow. Four edge-hugging trees (20-27px), regional extras (pines for Canada/CIS). Background: faint hex tiles on a pale blue-grey gradient.

### 5.2 Landmarks (one per region; anchor from `layout.json`)
Canada: CN Tower with mountains and pines. USA: Statue of Liberty with skyline. Caribbean: lagoon, palms, sailboat. South America: Christ the Redeemer on a green peak. Europe: Eiffel Tower with buildings. Emirates: Burj Khalifa with skyline. North Africa: pyramids, minaret, palms. RSA: Table Mountain. CIS: St Basil's Cathedral. China: pagoda with skyline. India: Taj Mahal. Australia: Opera House on water.
Deliver as low-poly GLB (< 150 KB each, Draco/meshopt) or stylised primitives. **Brian must approve landmark models; placeholders are acceptable for milestone 1.** Style: bright, soft, toy-like, glossy; match the reference palette.

### 5.3 Info plate (DOM)
Glossy white plate, 88px tall, width `max(customers*46+30, 316)`.
- **Title row:** logistics badge (grey-bordered pill, 80x34, cyan-500 `#06b6d4` rounded square with white Truck glyph, cost number at 21px bold), region name (17px; 14.5px if > 9 chars; 12px if > 11 chars), then office circles right-aligned (one per `maxTeams`).
- **Office circle states:** filled team colour with team number and gold ring = owned office; part-filled pie in team colour = expansion in progress; dashed empty circle = free slot.
- **Customer chips (36x36, rounded):** red `#e11d2e` with `$price` for price customers; purple `#7c3aed` with a white tech glyph (pin = GPS, wifi, gamepad = Gaming, battery, NFC waves, signal bars = 4G) for tech customers. When sold: ring in the buyer's team colour (3.5px) plus a small team token under the chip. Unsold: no ring, no token.
- **Control badges:** circles at the plate's top-right corner. Leader is larger with a gold ring; others smaller, stepping left. Show control points per team.

### 5.4 HUD (DOM)
- **Top bar (120px):** class name + "ROUND n", turn order chips (team colours, play order) or italic "Determined in Production" before Production phase; the 8-phase stepper; the Unsold Products pill (only Production phase or later).
- **Phase stepper:** Past = tinted pill with coloured check. Active = raised white pill, bold coloured border, filled number badge. Future = muted pill with grey number. Phase accent colours: Planning blue, Production slate, Improvements yellow, Research purple, Logistics cyan, Sales emerald, Control indigo, Scoring amber. Improvements is skipped from round 5 (keep existing rule). Phase keys: `planning, production, improvement, research/innovation, logistics/expansion, sales, control, scoring` (as in `TopBar.tsx`).
- **Price ladder (left, 140px):** red price chips $8..$2. Team markers beside each price **only once teams have set prices**. During **Planning** show the "PRICES HIDDEN" panel with the five team circles instead. Confirm the exact reveal moment against the game flow (planning/pricing) with Brian before wiring.
- **Technologies strip (bottom, 150px):** six cards (GPS 6 pts, WIFI 6, GAMING 8, BATTERY 8, NFC 10, 4G 12). Each card: icon, name, points chip, a status label, divider, five team circles.
  - Untouched: label "AVAILABLE"; each team's circle is divided into the tech's base number of segments (GPS 3, WiFi 3, Gaming 4, Battery 4, NFC 5, 4G 6) shown as spokes.
  - In progress: filled segments in the team colour.
  - Completed: filled circle with tick.
  - **Patent claimed (first team to complete):** the "AVAILABLE" label is replaced by a pill in that team's colour with its name (gold outline), that team's completed circle gets a gold ring, and **for every other team the tech costs 1 less**, so their circles are divided into one fewer segment (4 becomes 3).
  - Read ownership and cost from existing state/rules. Do **not** recompute patent logic in the view; if it is not in state, raise it with Brian.
- Improvements and Scoring panels are **not on the board**; they will be modals later (out of scope here, leave a hook/button placeholder in the top bar).

### 5.5 Colours
Teams: 1 green `#10b981`, 2 blue `#3b82f6`, 3 black `#1e293b`, 4 yellow `#eab308`, 5 red `#ef4444` (confirm against the real team colour field; the real viewer uses `team.color` and a contrast helper `getContrastTextColor`). Connector `#1b2748`, 10px with highlight. Everything else: read from `reference-generator/gen15.py`.

---

## 6. Animation spec (R3F)

Source events from the existing motion layer. Each animation is short, non-blocking, and queued so simultaneous team actions each get their moment (max 3 concurrent heavy animations, rest queue; if the queue is longer than 6 items, collapse to the final state).

| Trigger (state change) | Animation | Duration |
|---|---|---|
| Office opened (new office circle) | Island dips 6px and settles with a spring; expanding ring pulse in the team colour on the grass; confetti-free | 700 ms |
| Expansion progress | Plate office pie fills smoothly; small sparkle at the circle | 400 ms |
| Logistics used / link opened | Light pulse travels along the connector in the team colour | 900 ms |
| Customer sold | Chip flips (rotateX), ring draws in, team token drops in under it; tiny coin burst on the island | 600 ms |
| Control points change | Badge scales 1 to 1.25 to 1 with a count-up; if leader changes, a flag/banner rises on the island and the old leader's badge shrinks | 800 ms |
| Active turn team changes | Soft glow ring on the turn-order chip and a subtle lift on the region currently being acted on | continuous until change |
| Tech progress | Segment fills with a wipe; on completion the circle pops and fills with the tick | 500 ms |
| **Patent claimed** | Card flashes gold, "AVAILABLE" flips to the team pill, the other teams' circles re-divide (segments morph from n to n-1) | 1100 ms |
| Phase change | Active pill slides to the next phase; scene tint shifts slightly toward the phase colour (<= 6% opacity); no camera move | 600 ms |
| Round change | "ROUND n" count flip; ladder and chips reset | 600 ms |

**Ambient (low priority, off under reduced motion or Low quality):** clouds drifting slowly, Caribbean lagoon ripple, boat bobbing, flags waving, gentle grass shimmer.

Rules:
- Respect `prefers-reduced-motion`: replace transforms with simple fades; disable ambient motion.
- Never block interaction or hide plates.
- Use `frameloop="demand"`; call `invalidate()` on state change and while any animation runs, so the scene is idle (0 fps work) when nothing happens.
- Easing: spring/ease-out, no bounce overshoot beyond 8%.
- Provide a facilitator "Quality: Auto / High / Low" toggle (Low = no ambient, no particles, dpr 1).

---

## 7. Performance and robustness

- Target 60 fps on a mid laptop at 1080p, 30+ fps at 4K. Instance trees. Bake lighting; no real-time shadows. Compress textures (KTX2/basis if used). Landmark GLBs < 150 KB each, total scene < 3 MB.
- WebGL context loss: handle `webglcontextlost` by falling back to a static island layer or the classic viewer.
- No console errors; no memory growth after 100 simulated state updates (dispose geometries/materials).
- Works with the existing read-only / role handling (`useSession`); the viewer is read-only apart from the existing phase-click behaviour in `TopBar`, which must keep working.

---

## 8. Milestones and acceptance

**M1: Static match (placeholders OK).** `?viewer=3d` renders stage, HUD, 12 plates, 12 placeholder islands, 17 connectors, 8 wrap arrows from `layout.json` with real state. Visually overlay-compare to `02-final` and `03-midgame` (alignment within 2px at 1920x1080). Fallback and scaling work (test 1280x720, 1920x1080, 3840x2160, 16:10).
**M2: Real art.** Landmark models, trees, water, hex background. No landmark/tree covers any plate, chip or connector.
**M3: States.** Planning (hidden prices, no teams), Production, Sales, Control states render correctly from real data. Patent claimed UI and reduced segment counts match `03-midgame` logic.
**M4: Animation.** All animations in section 6, queue, reduced motion, quality toggle.
**M5: Hardening.** Perf budget, context loss, 100-update soak, test on the real classroom projector. Brian signs off, then flip the default.

**Acceptance checklist (Brian will verify):**
- [ ] Every label fully visible; no overlapping labels (especially the Pacific arrows).
- [ ] Logistics icon and cost clearly larger than the region title text and readable from the back of the room.
- [ ] All 17 connectors visible, each to the correct pair; no connector hidden behind a landmark.
- [ ] No red outline on any region; no BLOCKED label; no trucks on connectors.
- [ ] No right-side panel (Improvements/Scoring come later as modals).
- [ ] Planning phase hides team markers on the price ladder; turn order says "Determined in Production".
- [ ] Sold customers, offices, in-progress expansions, control badges, tech progress, patent owner pill and reduced segment counts all match the mid-game reference.
- [ ] Several teams acting at once are all visible; nothing is hidden by a moving camera.
- [ ] Classic viewer unchanged and still the default.

---

## 9. Open questions for Brian (do not guess)
1. Exact moment price markers appear on the ladder (end of Planning? start of Production?).
2. Where patent owner and per-team tech cost live in state, and whether other teams' cost can drop more than once per tech.
3. Where facilitators open Improvements and Scoring (modal triggered from a top-bar button?).
4. Landmark asset source (commissioned, Blender, CC0 pack, or AI-generated) and who approves.
5. Sales-phase unsold products bar: confirm its exact content and phase visibility rule.
