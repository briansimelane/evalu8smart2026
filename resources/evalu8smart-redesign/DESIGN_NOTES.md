# Evalu8Smart redesign — "Boardroom Ink"

## What changed (8 files, cascades to every page)

**Design direction.** Deep indigo-navy primary (`--primary`), cool porcelain background, and one
signal-coral accent (`--accent`) reserved for *live* things only: the current round number and the
active phase badge. This echoes Smartphone Inc's navy-and-coral energy without copying it, and the
restraint (one accent, used for one meaning) is what makes the palette read as designed.

**Typography.** Space Grotesk for headings and big numerals (`font-display`), IBM Plex Sans for body
(`font-sans`), IBM Plex Mono for access codes (`font-mono`). Base body size dropped to 15px and all
tables get tabular numerals so figures align in columns.

**Density.** Card padding `p-6` → `p-4 sm:p-5`; card titles `text-2xl` → `text-base sm:text-lg`;
table headers `h-12 px-4` → `h-9 px-3` uppercase micro-labels; table cells `p-4` → `px-3 py-2.5`;
container padding now responsive (`0.75rem` on phones, up to `2rem` on desktop). This alone removes
most of the "too much spacing" feel everywhere, because every page is built from these primitives.

**Mobile (down to 320px).**
- Container padding no longer eats 64px of the screen.
- Dashboard header stacks vertically below `md`; the controls row wraps.
- Both tab strips are now horizontally scrollable on phones **with labels visible** (icon-only tabs
  were unguessable). Utility class: `.tabstrip`.
- New `.table-scroll` utility for wrapping wide tables edge-to-edge on phones.
- `prefers-reduced-motion` respected globally.

**New semantic tokens** available in Tailwind: `success`, `warning` (plus existing `accent`,
`destructive`, `primary`). Chart palette (`--chart-1..5`) updated to match.

## The remaining sweep (per-phase pages)

There are ~500 hardcoded Tailwind colours across the phase components. Replace by *meaning*, not 1:1:

| Hardcoded pattern | Replace with | Meaning |
|---|---|---|
| `emerald-*` (positive states, success, "done") | `success` / `success/10` bg | good outcome |
| `amber-*`, `yellow-*` (warnings, pending) | `warning` / `warning/10` bg | caution/pending |
| `red-*` (errors, negative variance) | `destructive` | bad outcome |
| `blue-*`, `cyan-*` (buttons, links, info) | `primary` | brand/action |
| `purple-*`, decorative icon tints | drop the tint → `text-muted-foreground` or inherit | noise |
| Team colours (from team data) | **keep as-is** | team identity |

Rules of thumb while sweeping:
1. If a colour encodes a state (good/bad/pending), map to the semantic token.
2. If a colour is decoration (random icon tints), remove it — icons inherit text colour.
3. Never touch team colours; they're data.
4. Wrap any table wider than ~4 columns in `<div className="table-scroll">…</div>`.
5. Reduce ad-hoc `space-y-6` → `space-y-4`, `p-6` → `p-4` inside phase pages where they double up
   with the new card padding.
6. Keep `accent` (coral) scarce — current round, active phase, "live" markers only.

Recommended workflow: run `npm run dev`, do one phase component at a time at 360px and 1280px widths,
commit per component.

## Apply

From repo root: `git apply redesign.patch` — or copy the `files/` tree over the repo.
