# Board Game Simulation Dashboard — Full Product & Code Documentation

## 1. Product Overview

This is a **React-based web application** that serves as a digital companion/dashboard for a **strategic business board game**. The game simulates competing companies (teams) that manufacture products, conduct research, expand logistics networks across global regions, sell to customers, and compete for regional market control over multiple rounds.

The app replaces manual tracking of complex game state — production planning, research investment, logistics expansion, sales, control point scoring, and financial performance — with an interactive, phase-by-phase dashboard.

### Target Users
- Board game facilitators/game masters who run the simulation
- Players/teams who need to track their performance

### Core Value Proposition
- Automates complex calculations (play order, revenue, control points, research costs)
- Provides real-time visibility into game state across all teams
- Generates analytics charts and downloadable PDF reports
- Enforces game rules (eligibility, capacity limits, patent effects)

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui component library |
| Charts | Recharts |
| State Management | React Context API (GameContext) |
| Routing | React Router DOM |
| Notifications | Sonner (toast) |
| PDF Export | react-to-print |
| Icons | Lucide React |

---

## 3. Game Rules & Mechanics

### 3.1 Teams
- Up to **5 teams**, each identified by a color: **Green, Blue, Black, Yellow, Red**
- Each team has a unique starting region and initial improvement card
- Teams compete over **5 rounds** (rounds 1–5)

### 3.2 Starting Regions (by team color)
| Team Color | Starting Region |
|-----------|----------------|
| Green | North Africa |
| Blue | South America |
| Black | Australia |
| Yellow | India |
| Red | CIS |

### 3.3 Round Phases
Each round proceeds through these phases in order:

1. **Planning Phase** — Teams select a combination + position, determining their price modifier, products produced, improvement cards earned, research icons, and logistics icons. They also choose how to use available improvement cards.
2. **Improvement Phase** — Random improvement cards are drawn from a pool and allocated to eligible teams. Teams that earned 0 improvement get an automatic "Product/Product" card.
3. **Research Phase** — Teams allocate research icons to technologies. Completing a technology first earns a patent (reducing cost for others by 1).
4. **Logistics Phase** — Teams allocate logistics icons to expand presence into new regions. Regions have capacity limits and connectivity constraints.
5. **Sales Phase** — Teams sell products to customers in regions where they have presence. Customers are either "price" type (team price must be ≤ customer price) or "value" type (team must have completed the required technology).
6. **Control Phase** — Control points are awarded based on sales volume per region. First and second place teams in each region earn points based on how many teams competed there.

### 3.4 Combinations & Positions
There are **8 combinations**, each with **14 positions**. Each combination+position yields:
- `price`: modifier to the team's base price (can be negative)
- `products`: number of products produced
- `improve`: improvement cards earned (0 or 1)
- `research`: research icons for the round
- `logistics`: logistics icons for the round

### 3.5 Improvement Cards
Each card has **two icons** from: `Price Plus`, `Price and Product`, `Product`, `Research`, `Logistic`

**Icon Effects:**
| Icon | Price Effect | Product Effect | Research Effect | Logistics Effect |
|------|-------------|----------------|-----------------|-----------------|
| Price Plus | +1 | 0 | 0 | 0 |
| Price and Product | -1 | +1 | 0 | 0 |
| Product | 0 | +1 | 0 | 0 |
| Research | 0 | 0 | +1 | 0 |
| Logistic | 0 | 0 | 0 | +1 |

**Card Usage Options:**
- **Use Effects**: Apply both icons' effects to the team's stats
- **As Product**: Convert the card into +1 product instead
- **Don't use**: Save for a future round

**Initial Cards (per team color):**
| Team | Icon 1 | Icon 2 |
|------|--------|--------|
| Green | Research | Price Plus |
| Blue | Logistic | Price Plus |
| Black | Product | Research |
| Yellow | Price and Product | Logistic |
| Red | Logistic | Product |

**Card Pool:** 32 additional improvement cards (IDs 1–32) with various icon combinations. Cards are drawn randomly each round and allocated to teams.

### 3.6 Technologies
Six technologies with varying research costs:

| Technology | Base Cost |
|-----------|-----------|
| GPS | 3 |
| Wifi | 3 |
| Gaming | 4 |
| Battery | 4 |
| NFC | 5 |
| 4G | 6 |

**Patent System:**
- The first team to complete a technology earns the **patent**
- All other teams get a **cost reduction of 1** for that technology
- Patents are permanent and tracked globally

### 3.7 Regions & Logistics
12 global regions with varying logistics costs (points needed to establish presence) and maximum team capacity:

| Region | Logistics Cost | Max Teams | Connected To |
|--------|---------------|-----------|-------------|
| Canada | 2 | 3 | CIS, India, USA |
| USA | 4 | 5 | Canada, Australia, Caribbean, South America |
| Caribbean | 2 | 3 | USA, Australia, South America |
| South America | 3 | 4 | Caribbean, USA, North Africa, RSA |
| Europe | 4 | 5 | USA, CIS, North Africa |
| Emirates | 2 | 3 | India, RSA, North Africa |
| North Africa | 3 | 4 | Europe, China, Emirates |
| RSA | 2 | 3 | South America, Emirates, Australia |
| CIS | 3 | 4 | Canada, China, Europe |
| China | 4 | 5 | CIS, India, North Africa |
| India | 3 | 4 | Canada, Emirates, China |
| Australia | 3 | 4 | USA, Caribbean, RSA |

**Expansion Rules:**
- Teams can only expand to regions **connected** to a region where they already have presence
- A region must not be **full** (at max team capacity)
- Logistics points accumulate across rounds until the cost is met

### 3.8 Customers & Sales
Each region has customers of two types:
- **Price Customers**: Team's price must be ≤ the customer's price threshold
- **Value Customers**: Team must have completed the customer's required technology

Each customer has a **position** (left-to-right order) used for tie-breaking in control calculations.

**Example — USA customers:**
| ID | Type | Requirement | Position |
|----|------|-------------|----------|
| usa-p1 | price | price ≤ 3 | 1 |
| usa-p2 | price | price ≤ 4 | 2 |
| usa-p3 | price | price ≤ 5 | 3 |
| usa-p4 | price | price ≤ 6 | 4 |
| usa-v1 | value | Wifi | 5 |
| usa-v2 | value | Gaming | 6 |
| usa-v3 | value | NFC | 7 |
| usa-v4 | value | 4G | 8 |

### 3.9 Control Points
Control points are awarded based on sales volume in each region. The number of points depends on:
1. The **region** (larger regions yield more points)
2. How many teams made sales in that region (`teamsWithSales`)
3. Whether the team placed **first** or **second**

**Control Points Table:**

| Region | 1 Team (1st) | 2 Teams (1st/2nd) | 3 Teams (1st/2nd) | 4 Teams (1st/2nd) | 5 Teams (1st/2nd) |
|--------|-------------|-------------------|-------------------|-------------------|-------------------|
| Canada | 1 / 0 | 2 / 0 | 4 / 2 | — | — |
| USA | 3 / 0 | 4 / 0 | 5 / 2 | 6 / 3 | 8 / 4 |
| Caribbean | 1 / 0 | 2 / 0 | 4 / 2 | — | — |
| South America | 2 / 0 | 3 / 0 | 5 / 2 | 6 / 3 | — |
| Europe | 3 / 0 | 4 / 0 | 5 / 2 | 6 / 3 | 8 / 4 |
| Emirates | 1 / 0 | 2 / 0 | 4 / 2 | — | — |
| North Africa | 2 / 0 | 3 / 0 | 5 / 2 | 6 / 3 | — |
| RSA | 1 / 0 | 2 / 0 | 4 / 2 | — | — |
| CIS | 2 / 0 | 3 / 0 | 5 / 2 | 6 / 3 | — |
| China | 3 / 0 | 4 / 0 | 5 / 2 | 6 / 3 | 8 / 4 |
| India | 2 / 0 | 3 / 0 | 5 / 2 | 6 / 3 | — |
| Australia | 2 / 0 | 3 / 0 | 5 / 2 | 6 / 3 | — |

**Tie-breaking:** When teams have equal sales in a region, the team whose leftmost customer position is lower ranks higher.

### 3.10 Play Order
Teams act in order determined by:
1. **Current price** (lowest first)
2. **Previous round's total money** (lowest first, as tiebreaker)
3. **Round 0 total money** (lowest first, as second tiebreaker)

### 3.11 Scoring
- **Revenue** = products sold × team price (calculated during sales)
- **Control Points** = awarded per region based on sales ranking
- **Total Money** = revenue + control points (accumulated across rounds)
- **Overall Value** = initial score (based on team color) + cumulative total money across all rounds

---

## 4. Architecture & Code Structure

### 4.1 File Structure

```
src/
├── App.tsx                          # Root: routing, providers
├── main.tsx                         # Entry point
├── index.css                        # Global styles, Tailwind config
├── pages/
│   ├── Index.tsx                     # Main page: GameSetup or Dashboard
│   └── NotFound.tsx                  # 404 page
├── contexts/
│   └── GameContext.tsx               # Central game state management (786 lines)
├── types/
│   └── game.ts                      # TypeScript interfaces for all game entities
├── data/
│   ├── combinations.ts              # 8×14 combination/position matrix, regions, technologies, team colors
│   ├── improvements.ts              # Improvement card definitions and icon effects
│   ├── regions.ts                   # Region configs (cost, capacity, connections, starting regions)
│   ├── control.ts                   # Control points lookup table and helper function
│   └── customers.ts                 # Customer data per region (price/value types)
├── components/
│   ├── GameSetup.tsx                 # Team configuration screen (name, color selection)
│   ├── Dashboard.tsx                 # Main tabbed dashboard with all game phases
│   ├── NavLink.tsx                   # Navigation link component
│   └── dashboard/
│       ├── PlanningPhase.tsx         # Combination/position selection + card usage
│       ├── ImprovementPhase.tsx      # Card drawing, allocation, and preview
│       ├── ResearchPhase.tsx         # Research point allocation + patent tracking
│       ├── LogisticsPhase.tsx        # Regional expansion management
│       ├── SalesPhase.tsx            # Customer selection and revenue calculation
│       ├── ControlPhase.tsx          # Control point calculation and application
│       ├── RoundInput.tsx            # Legacy/alternate round data input
│       ├── CurrentState.tsx          # Current round state overview table
│       ├── Scoreboard.tsx            # Team rankings and performance metrics
│       ├── PatentTracker.tsx         # Patent registration and tracking
│       ├── Analytics.tsx             # Charts (revenue, production, price, research)
│       └── SimulationReport.tsx      # Comprehensive PDF-exportable report
├── components/ui/                   # shadcn/ui component library (40+ components)
├── hooks/
│   ├── use-mobile.tsx               # Mobile detection hook
│   └── use-toast.ts                 # Toast notification hook
├── lib/
│   └── utils.ts                     # Utility functions (cn for classnames)
└── assets/
    └── gameboard.png                # Game board reference image
```

### 4.2 State Management — GameContext

The `GameContext` (`src/contexts/GameContext.tsx`, 786 lines) is the central brain of the application. It manages:

**State (`GameState`):**
- `teams` — Array of team objects (id, name, color)
- `currentRound` — Current round number (1–5)
- `rounds` — Array of `RoundData`, each containing per-team data
- `technologies` — Research progress and costs for all 6 technologies
- `patents` — Map of technology → patent-holding team
- `improvementCards` — All cards (initial + allocated), with usage status
- `improvementPoolByRound` — Which cards were drawn each round
- `teamResearchProgress` — Per-team research investments and completions
- `researchAllocatedByRound` — Research icons spent per team per round
- `regionLogistics` — Per-region presence, progress, and capacity
- `teamLogisticsProgress` — Per-team regional presence and investments
- `logisticsAllocatedByRound` — Logistics icons spent per team per round

**Key Functions:**
| Function | Purpose |
|----------|---------|
| `initializeGame(teams)` | Sets up fresh game state with teams, initial cards, starting regions |
| `addRoundData(round, teamId, data)` | Saves/updates a team's data for a round |
| `updatePatent(tech, teamId)` | Registers a patent; recalculates costs for all teams |
| `selectRandomCards()` | Draws random improvement cards for the current round |
| `reshuffleRoundCards()` | Re-draws the card pool for the current round |
| `allocateImprovementCards(allocations)` | Assigns drawn cards to teams; adds product cards for non-earners |
| `advanceRound()` | Increments the current round |
| `allocateResearch(teamId, tech, points)` | Invests research points; handles completion and patents |
| `allocateLogistics(teamId, region, points)` | Invests logistics points; handles presence establishment |
| `calculatePlayOrder(round)` | Determines team action order based on price and money |
| `getTechnologyCostForTeam(teamId, tech)` | Returns effective research cost (accounting for patents) |
| `canExpandToRegion(teamId, region)` | Checks connectivity and capacity constraints |
| `getAvailableRegionsForTeam(teamId)` | Returns all regions a team can currently expand to |
| `isRegionFull(region)` | Checks if a region has reached max team capacity |

### 4.3 Data Types (`src/types/game.ts`)

```typescript
Team { id, name, color }

Technology { name, researchPoints, maxPoints, patentHolder?, researchCost, teamProgress }

TeamResearchProgress { teamId, technologyInvestments, completedTechnologies }

RegionLogistics { name, logisticsCost, maxTeams, connectedRegions, teamsPresent, teamProgress }

TeamLogisticsProgress { teamId, regionsWithPresence, regionInvestments }

ImprovementCard { id, icon1, icon2, availableForTeam, used, usedBy?, isInitial?, allocatedInRound? }

RoundData { roundNumber, teamData, soldCustomers? }

TeamRoundData {
  teamId, combination, position, price, productsProduced,
  improvementCards, researchIcons, logisticsIcons, revenue,
  technologiesResearched, expansionLocations, salesByRegion,
  regionControlPoints, controlValue, totalMoney,
  improvementCardUsage?, improvementCardId?, cardUsages?,
  customersSold?
}

GameState {
  gameId, teams, currentRound, rounds, technologies, regions,
  patents, improvementCards, improvementPoolByRound,
  teamResearchProgress, researchAllocatedByRound,
  regionLogistics, teamLogisticsProgress, logisticsAllocatedByRound,
  createdAt, updatedAt
}
```

---

## 5. Component Details

### 5.1 GameSetup
- Allows adding 1–5 teams with custom names
- Team colors selected from predefined set (Green, Blue, Black, Yellow, Red)
- Validates all team names are filled before starting
- Passes teams to `initializeGame`

### 5.2 Dashboard
- Main tabbed interface with two tab groups:
  - **Game Phases**: Planning, Improvement, Research, Logistics, Sales, Control
  - **Data Views**: Current State, Scoreboard, Analytics, Patents, Report
- Header shows current round, team count
- "Advance Round" and "Reset Game" buttons
- `onEditTeamData` callback allows jumping back to planning for amendments

### 5.3 PlanningPhase
- Team selects combination (1–8) and position (1–14)
- Displays calculated metrics with animations: price, products, improvement, research, logistics
- Shows available improvement cards with usage options (Use Effects / As Product / Don't use)
- Separates "usable" cards (from previous rounds) from "newly allocated" cards (current round, not yet usable)
- Submit/Update plan functionality with edit support via `useImperativeHandle`

### 5.4 ImprovementPhase
- Draws random cards from the available pool (equal to team count)
- Facilitator allocates cards to teams that earned improvement (improvementCards > 0)
- Teams with 0 improvement automatically receive a Product/Product card
- Shows a preview of next round's cards after allocation
- Supports reshuffling the card pool
- Round 4 shows a warning (final improvement phase)

### 5.5 ResearchPhase
- Shows play order for research allocation
- Teams allocate research icons across 6 technologies
- Displays: technology cost, current investment, patent status, progress bars
- Handles patent awarding on first completion
- Auto-advances to next team when allocation is confirmed
- Shows detailed research history in accordion
- Summary view when all teams finish

### 5.6 LogisticsPhase
- Shows play order for logistics allocation
- Teams invest logistics icons into available regions
- Validates connectivity (must be adjacent to existing presence)
- Shows region capacity, cost, progress, and connected regions
- Handles presence establishment when cost is met
- Summary view showing all region statuses when complete

### 5.7 SalesPhase
- Follows play order (lowest price first)
- Teams select customers from regions where they have presence
- **Price customers**: eligible if team price ≤ customer price
- **Value customers**: eligible if team has completed required technology
- Each customer can only be sold to once per round (across all teams)
- Revenue = number of products sold × team price
- Products limited by production count
- Shows overview of all regional sales across teams

### 5.8 ControlPhase
- Auto-calculates when all teams have submitted sales
- Counts sales per team per region
- Awards first/second place control points based on `teamsWithSales` count
- Tie-breaking by leftmost customer position
- "Apply Control Points" adds points to team totals
- Displays results in a card grid

### 5.9 Scoreboard
- Ranks teams by overall value (initial score + cumulative total money)
- Shows per-round metrics: price, produced, improvements, research, logistics
- Performance badges: combo, sales, lost products, revenue, control, current money, overall value
- "Amend" button for editing past data

### 5.10 Analytics
- **Revenue Trends**: Line chart across rounds per team
- **Production Volume**: Bar chart per round
- **Price Strategy**: Line chart per round
- **Research Investment**: Bar chart per round
- All charts use team colors for series

### 5.11 SimulationReport
- Comprehensive per-team breakdown across all rounds
- Collapsible round details showing: customers sold, control points, improvement cards, regional presence, research progress
- PDF download via react-to-print (auto-expands all sections before printing)
- Calculates starting scores and overall values

### 5.12 PatentTracker
- Manual patent registration UI (select technology + team)
- Patent registry showing all technologies and their holders
- Scoreboard showing patent counts per team

### 5.13 CurrentState
- Collapsible table showing current round data for all teams
- Columns: price, produced, sold, revenue, control, total money
- Teams sorted by price then previous round value
- "Amend" button per team for editing

---

## 6. Key Business Logic

### 6.1 Price Calculation
```
finalPrice = basePriceFromCombination + Σ(cardEffects where usage = 'use')
```
Where card effects come from each icon's `priceEffect` value.

### 6.2 Product Calculation
```
productsAvailable = productsFromCombination 
  + Σ(cardEffects.productEffect where usage = 'use') 
  + count(cards where usage = 'product')
```

### 6.3 Research Cost with Patents
```
effectiveCost = baseCost - (1 if patentHolder exists AND patentHolder ≠ thisTeam, else 0)
```

### 6.4 Control Point Lookup
```
points = CONTROL_POINTS[region][`control${teamsWithSales}`]  // for 1st place
points = CONTROL_POINTS[region][`second${teamsWithSales}`]   // for 2nd place
```

### 6.5 Play Order Algorithm
```
Sort teams by:
  1. Current round price (ascending)
  2. Previous round total money (ascending)  
  3. Round 0 total money (ascending)
```

---

## 7. Data Files Reference

### 7.1 `combinations.ts`
- 8 combinations × 14 positions = 112 entries
- Each entry: `{ combination, position, price, products, improve, research, logistics }`
- Also exports: `REGIONS` (12 strings), `TECHNOLOGIES` (6 strings), `TEAM_COLORS` (5 objects)

### 7.2 `improvements.ts`
- `ICON_EFFECTS`: 5 icon types with their stat modifiers
- `INITIAL_IMPROVEMENT_CARDS`: 5 starting cards (one per team color)
- `AVAILABLE_IMPROVEMENT_CARDS`: 32 cards (IDs 1–32) for the draw pool

### 7.3 `regions.ts`
- `REGION_CONFIGS`: 12 regions with logistics cost, max teams, connections
- `INITIAL_TEAM_REGIONS`: Maps team colors to starting regions

### 7.4 `control.ts`
- `CONTROL_POINTS`: 12 regions with control1–5 and second1–5 values
- `getControlPointsForRegion(region, teamsPresent, position)`: Lookup function

### 7.5 `customers.ts`
- `REGION_CUSTOMERS`: 12 regions with 4–8 customers each
- Each customer: `{ id, type, price/technology, position }`

---

## 8. UI/UX Patterns

- **Phase-based workflow**: Tabs guide the facilitator through each game phase in order
- **Progressive disclosure**: Collapsible sections, accordions for detailed data
- **Visual feedback**: Animated value changes, color-coded team indicators, toast notifications
- **Validation**: Disabled buttons when data is incomplete, warning alerts for missing prerequisites
- **Edit support**: "Amend" buttons allow retroactive data correction
- **Responsive**: Mobile-aware with grid layouts adapting to screen size
- **PDF export**: Full simulation report downloadable as PDF

---

## 9. Current Limitations & Notes

- **No persistence**: Game state lives in React state only; refreshing loses all data
- **No authentication**: Single-user/facilitator model
- **No real-time multiplayer**: One person operates the dashboard for all teams
- **Client-side only**: No backend, no database
- **Round limit**: Game designed for 5 rounds (improvement phase ends at round 4)
- **Card pool**: 32 cards total; large games may exhaust the pool
