# Handoff index: Smartphone Inc 3D Viewer

Give Antigravity this whole folder (zip). Suggested order of work:

1. `BRIEF.md`: the board (islands, connectors, HUD, tech strip, animations, scaling).
2. `BRIEF-MODALS.md`: Improvements and Scoreboard modals.

| File or folder | What it is |
|---|---|
| `BRIEF.md` | Brief 1: board, HUD, technologies, animation, performance, milestones |
| `BRIEF-MODALS.md` | Brief 2: Improvements modal and Scoreboard modal, 3D graphics and animation |
| `layout.json` | Exact board geometry on the 1920x1080 stage (islands, plates, landmarks, 17 connectors, camera) |
| `reference-images/` | Approved board images: planning phase, final layout, mid-game with sales, patents and control points |
| `modals/` | Approved modal images (Improvements, Scoreboard) and the map background used behind them |
| `reference-generator/` | Python scripts that drew every image. Reference only for exact colours, sizes, glyphs and sample data |

All numbers and team data in the images are sample data.

## Still needed from Brian before or during build
- 3D landmark models for the 12 regions, and 3D effect icons, medals and a trophy (source or approve).
- Answers to the open questions at the end of both briefs (patent values, region naming "Australia" vs "Sub-Saharan Africa", pool size and others).
- A design for the game-end podium, if wanted.

## Message to paste to Antigravity
> Read `HANDOFF-INDEX.md`, then `BRIEF.md`, then `BRIEF-MODALS.md`. Implement the 3D viewer behind the `?viewer=3d` flag, milestone by milestone, starting with M1 (static match) of `BRIEF.md`. Do not change game rules, data shape or the classic viewer. Use `layout.json` for geometry and the images as visual targets. Ask me about anything listed under "Open questions" before building that part. After each milestone, summarise what changed and what to test.
