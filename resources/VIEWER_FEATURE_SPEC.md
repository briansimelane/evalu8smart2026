# Feature Brief: Facilitator "Viewer" — Live Digital Board

**Repo:** briansimelane/evalu8smart2026 (Vite + React + Firebase/Firestore)
**Audience:** Antigravity (AI dev partner). Implement exactly as specified; preserve ALL existing functionality (class codes, team codes, CEO role, bots, facilitator console, team views).

---

## 1. What we are building

A new **read-only, full-screen "Viewer" page** that the facilitator opens in a pop-up browser window and projects at the front of the class. It is a live digital replica of the Smartphone Inc board (see `Board_overall.png` reference image) and must let every team, **at a single glance**, see:

1. **Current phase** (phases 1–8, current one highlighted)
2. **Turn order** for the current round (team chips in team colours)
3. **Current price** each team has set (price ladder $2–$8)
4. **All 11 regions** — which teams are present, office/logistics progress, remaining demand slots
5. **All technologies** — per-team research progress, who has finished, who holds the patent
6. **Improvement cards** — which are still available, which have been taken (and by whom)

It is a **display, not a control surface**: zero buttons, zero inputs, no auth prompts beyond the class code in the URL. All state comes live from Firestore.

---

## 2. Route, access & opening flow

- New route: **`/viewer/:classCode`** (public read; same read rules as team pages — it only needs the game document for that class).
- On the **Facilitator console**, add an **"Open Viewer" button** (icon: projector/monitor). Behaviour:

```js
window.open(
  `/viewer/${classCode}`,
  'evalu8-viewer',
  'popup,width=1600,height=900'
);
```

- The Viewer subscribes with `onSnapshot` to the same game/class document(s) the facilitator console uses. **No polling.** Every phase advance, price change, region move, tech tick, or card claim by the facilitator or any team/bot appears on the projector within a second.
- If the class code is invalid or the game hasn't started, show a friendly full-screen state: class name + "Waiting for game to start…" with the Evalu8 logo.

---

## 3. The one-screen constraint — fixed canvas + scale-to-fit

**Do not build this responsively.** Build the whole board on a **fixed logical canvas of 1920 × 1080** and scale it to whatever window it's in:

```jsx
// ViewerScaler.jsx
const BOARD_W = 1920, BOARD_H = 1080;

function ViewerScaler({ children }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(
      window.innerWidth / BOARD_W,
      window.innerHeight / BOARD_H
    ));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden',
                  display: 'grid', placeItems: 'center', background: '#f4f6fa' }}>
      <div style={{ width: BOARD_W, height: BOARD_H,
                    transform: `scale(${scale})`, transformOrigin: 'center' }}>
        {children}
      </div>
    </div>
  );
}
```

This guarantees: **no scrolling, ever**, on any projector/laptop resolution, and the board composition never reflows. All child components use absolute px positions/sizes inside the 1920×1080 canvas.

---

## 4. Board layout (mirror the physical board / reference image)

Use a faded world-map SVG/PNG as the canvas background (blue continents on light background, matching the reference image). Layout zones:

```
┌────────────────────────────────────────────────────────────────────┐
│ TOP BAR (h≈120): Round & Turn order chips | Phase track 1–8       │
├──────┬─────────────────────────────────────────────────┬──────────┤
│ LEFT │              WORLD MAP + REGION CARDS           │  RIGHT   │
│ Price│   (11 region cards positioned geographically)   │  Tech    │
│ladder│                                                 │  panel   │
│ $8→$2│                                                 │ +patents │
├──────┴─────────────────────────────────────────────────┴──────────┤
│ BOTTOM STRIP (h≈150): Improvement cards — available / taken       │
└────────────────────────────────────────────────────────────────────┘
```

### 4.1 Top bar
- **Left:** "Round X" + turn-order chips: coloured rounded squares in the current turn order, each with team name (or bot icon 🤖 for bots). The team whose turn/priority is first is slightly larger with a subtle glow.
- **Right:** **Phase track** — 8 tiles matching the physical board's phase strip, using the existing phase icons already in the app:
  1. Pick pads (cards) · 2. Price (−$/+$) · 3. Production · 4. Improvements/HR · 5. Tech (gear) · 6. Logistics/Expansion (truck) · 7. Sales/Recycle · 8. Revenue ($)
  The **current phase tile is enlarged, saturated, and outlined**; past phases dimmed to ~40% opacity; future phases at ~70%.

### 4.2 Left rail — Price ladder
- Vertical ladder of price rows **$8 down to $2**, exactly like the board's left column (red outlined slot strips).
- On each price row, render a **coloured cube/marker per team** currently selling at that price. Multiple teams on one price stack horizontally.
- If prices are hidden until the reveal step of the Price phase, show "?" markers until revealed (respect existing game logic — if the current app reveals prices immediately, show immediately).

### 4.3 Centre — Region cards (the heart of the view)
Render all **11 regions** as compact cards absolutely positioned over their geography, matching the reference image positions: Canada, USA, Caribbean, South America, Europe, North Africa, RSA, Emirates, CIS, China, India, Australia (use whichever exact region list the app's data model has — do not invent regions).

Each region card (≈300×130 px) shows, reusing existing icons:
- **Region name** (bold, 20px+).
- **Logistics requirement badge** (truck icon + number, top-left, blue — as on the board).
- **Office slot ("sun" circle):** if a team has built the regional office, fill it with that team's colour + team initial; otherwise show the empty sunburst.
- **Demand row:** the blue demand slots with their red price tags. **Filled demand** = replace the blue slot with a cube in the selling team's colour (this is the "who is present and progressing" signal). Unfilled = plain blue slot.
- **Bonus/requirement row:** the red price tokens + tech requirement icons (Wi-Fi, battery, NFC, 4G, camera, call…) exactly as the physical card shows them — reuse the icon set already in the repo.

Keep cards semi-opaque white (like the reference) so the map reads behind them.

### 4.4 Right panel — Technologies & patents
A vertical panel listing every technology in the game (Wi-Fi, Battery, Camera, Call/mic, NFC, 4G, screen types — use the app's actual tech list). Per tech row:
- Tech icon (existing purple icon assets) + name.
- **Per-team progress dots**: one row of small dots per team in team colour — e.g. 2/3 filled = researching, all filled = **finished** (row gets a subtle checkmark and full-saturation icon).
- **Patent badge**: if a team holds the patent, show a patent/medal badge in that team's colour on the right of the row. Only one holder per tech.
- Teams not researching a tech simply show empty dots — the glanceable pattern is: dots = progressing, check = finished, badge = patent.

### 4.5 Bottom strip — Improvement cards
- Horizontal row of the improvement/HR card slots currently on offer this round (matching the bottom strip of the physical board: cost badge, effect icons, price).
- **Available card:** full colour.
- **Taken card:** desaturated/greyed with a **coloured corner ribbon + team initial** of the team that took it. During the improvement phase this updates live as teams claim cards.
- If the app cycles a market of N cards per round, render exactly that market; show empty slot placeholders where cards have run out.

---

## 5. Visual & UX rules

- **Reuse existing assets:** every icon (phase icons, tech icons, truck, office sunburst, price tags, card art) already exists in the repo — import from the existing components/asset folder. Do **not** introduce a second icon set.
- **Team colours:** use the existing team colour tokens everywhere (chips, cubes, dots, ribbons). Add team initial letters inside markers for colour-blind readability.
- **Projector-grade legibility:** minimum 16px effective text at 1080p; region names ≥20px; phase labels ≥18px. High contrast; avoid thin greys.
- **Live-update feedback:** when any value changes, flash the changed element briefly (CSS class toggle, e.g. 600ms yellow pulse) so the class notices movement on the board.
- **No interactivity:** no hover-dependent info (projectors have no cursor for the audience). Everything must be visible statically. The only permitted interaction: pressing `F` toggles fullscreen (`document.documentElement.requestFullscreen()`), and a tiny "⛶" button top-right for the same.
- **Header chrome:** none of the normal app nav/header. The Viewer route renders outside the standard layout shell.
- Keep the visual language consistent with the ongoing design refresh (tight spacing, deliberate colour system, mobile-first elsewhere — but this page is desktop/projector-only and exempt from small-phone requirements).

## 6. Data mapping (adapt to actual schema)

Read from the existing Firestore game state — **do not change the schema**. Expected mappings (adjust field names to what exists):

| Viewer element | Source |
|---|---|
| Round, phase | game doc: `currentRound`, `currentPhase` |
| Turn order | game doc: `turnOrder` / priority array |
| Team colours/names/bot flags | `teams` collection or array |
| Prices | per-team `price` for current round |
| Region presence/offices/demand fills | per-team region state / sales results |
| Tech progress & patents | per-team tech tracks + patent holder field |
| Improvement market | round's card market array + `takenBy` |

If any of these are currently derived only inside the facilitator console component, **extract that derivation into a shared hook** (e.g. `useGameBoardState(classCode)`) used by both the console and the Viewer — single source of truth, no duplicated logic.

## 7. File plan

```
src/
  pages/Viewer/
    ViewerPage.jsx        // route entry, snapshot subscription, ViewerScaler
    ViewerScaler.jsx
    TopBar.jsx            // round, turn order, phase track
    PriceLadder.jsx
    RegionCard.jsx        // one card; RegionLayer.jsx positions all 11
    TechPanel.jsx
    ImprovementStrip.jsx
    viewer.css            // fixed-canvas styles, pulse animation
  hooks/useGameBoardState.js   // shared derivation (console + viewer)
assets/ (reuse existing icons + add faded world map background if missing)
```

Add the route in the router, and the "Open Viewer" button on the facilitator console header.

## 8. Acceptance criteria

1. `/viewer/:classCode` renders the full board with **no scrollbars** at 1920×1080, 1366×768, and 1280×720, and inside a resized pop-up.
2. Facilitator's "Open Viewer" button opens the pop-up window pre-sized.
3. Changing phase on the console updates the projected phase tile within ~1s without refresh.
4. A team (or bot) setting a price moves their marker on the ladder live.
5. Selling into a region fills that region's demand slot with the team's colour live.
6. Tech research ticks, finished techs, and patent badges display correctly for every team, including bots.
7. Claiming an improvement card greys it and shows the claiming team's ribbon live.
8. Page is fully read-only; no writes to Firestore originate from the Viewer.
9. All icons match the existing in-app icon set; all team colours match existing tokens.
10. No regression to any existing page, class/team-code flow, CEO functionality, or bot behaviour.

## 9. Nice-to-haves (only if trivial)

- Subtle animated dotted "shipping lane" lines between regions (as on the physical board) — pure decoration.
- A small "LIVE" pulse dot top-left so the class knows the board is real-time.
- Query param `?theme=ev` to swap the logo/title for the future "Evalu8 Inc" EV re-theme.
