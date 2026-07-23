import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { getControlPointsForTeamInRound, getTeamPatentPoints } from '@/types/game';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, FlaskConical,
  Cpu, BarChart2, RefreshCw, Scale, Info,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface InfoData {
  formula: string;
  description: string;
}

function InfoPill({ formula, description }: InfoData) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center p-0.5 ml-1 text-muted-foreground/60 hover:text-primary transition-colors focus:outline-none"
          title="View calculation breakdown"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-3 text-xs shadow-xl border-primary/30 bg-card z-50">
        <div className="space-y-2">
          <div className="font-bold text-foreground flex items-center gap-1.5 text-[11px]">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>Calculation Breakdown</span>
          </div>
          <div className="p-2 bg-primary/10 text-primary dark:text-blue-300 rounded-md font-mono text-[11px] border border-primary/20">
            Formula: {formula}
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            {description}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COGS_PER_UNIT = 1;
const STOCK_LOSS_PER_UNIT = 1;
const COST_PER_ICON = 1;
const SHARE_CAPITAL = 20;

// ─── Types ────────────────────────────────────────────────────────────────────
interface IncomeStatement {
  revenue: number; cogs: number; stockLoss: number;
  grossProfit: number; researchExpense: number;
  logisticsExpense: number; operatingProfit: number;
}
interface BalanceSheet {
  cash: number; techAssets: number; marketPresence: number; totalAssets: number;
  shareCapital: number; retainedEarnings: number; valuationReserve: number; totalEquity: number;
}

// ─── Builders ─────────────────────────────────────────────────────────────────
const emptyIS: IncomeStatement = { revenue: 0, cogs: 0, stockLoss: 0, grossProfit: 0, researchExpense: 0, logisticsExpense: 0, operatingProfit: 0 };

function buildIS(revenue: number, produced: number, sold: number, ri: number, li: number): IncomeStatement {
  const cogs = sold * COGS_PER_UNIT;
  const grossProfit = revenue - cogs;
  const stockLoss = Math.max(0, produced - sold) * STOCK_LOSS_PER_UNIT;
  const researchExpense = ri * COST_PER_ICON;
  const logisticsExpense = li * COST_PER_ICON;
  const operatingProfit = grossProfit - stockLoss - researchExpense - logisticsExpense;
  return { revenue, cogs, stockLoss, grossProfit, researchExpense, logisticsExpense, operatingProfit };
}

function buildBS(cash: number, techAssets: number, marketPresence: number, retainedEarnings: number): BalanceSheet {
  const valuationReserve = techAssets + marketPresence;
  return {
    cash, techAssets, marketPresence, totalAssets: cash + techAssets + marketPresence,
    shareCapital: SHARE_CAPITAL, retainedEarnings, valuationReserve,
    totalEquity: SHARE_CAPITAL + retainedEarnings + valuationReserve
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  const abs = Math.abs(n);
  return n < 0 ? `($${abs.toLocaleString()})` : `$${abs.toLocaleString()}`;
}
function pct(num: number, den: number) { return den === 0 ? '—' : `${((num / den) * 100).toFixed(1)}%`; }
function ratio(num: number, den: number) { return den === 0 ? '—' : `${(num / den).toFixed(2)}x`; }

// ─── Shared table components ──────────────────────────────────────────────────
type CellData = { value: number; bold?: boolean; highlight?: 'positive' | 'negative' | 'neutral' };

function TableSection({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={99} className="pt-4 pb-1 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      </td>
    </tr>
  );
}

function TableRow({
  label, cells, bold, indent, divider, info,
}: {
  label: string;
  cells: CellData[];
  bold?: boolean;
  indent?: boolean;
  divider?: boolean;
  info?: InfoData;
}) {
  return (
    <>
      {divider && <tr><td colSpan={99} className="px-3 py-0"><div className="h-px bg-border/50" /></td></tr>}
      <tr className={`${bold ? 'bg-secondary/25' : 'hover:bg-secondary/10'} transition-colors`}>
        <td className={`py-1.5 pl-3 pr-4 text-sm whitespace-nowrap ${indent ? 'pl-6 text-muted-foreground' : bold ? 'font-bold' : ''}`}>
          <div className="inline-flex items-center">
            <span>{label}</span>
            {info && <InfoPill formula={info.formula} description={info.description} />}
          </div>
        </td>
        {cells.map((cell, i) => {
          const colorClass =
            cell.highlight === 'positive' ? (cell.value >= 0 ? 'text-green-400' : 'text-destructive')
              : cell.highlight === 'negative' ? 'text-destructive/80' : '';
          return (
            <td key={i} className={`py-1.5 px-3 text-right font-mono text-sm whitespace-nowrap ${bold ? 'font-bold' : ''} ${colorClass}`}>
              {fmt(cell.value)}
            </td>
          );
        })}
      </tr>
    </>
  );
}

function RatioCard({ label, value, description, icon: Icon, positive }: {
  label: string; value: string; description: string;
  icon: React.ComponentType<{ className?: string }>; positive?: boolean;
}) {
  return (
    <Card className="bg-secondary/20 border-border/50">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className={`text-2xl font-bold ${positive === undefined ? '' : positive ? 'text-green-400' : 'text-destructive'}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const FinancialsPhase = () => {
  const { gameState } = useGame();
  const [viewRound, setViewRound] = useState<string>('all');
  const [activeView, setActiveView] = useState<'income' | 'balance'>('income');

  if (!gameState) return null;

  const teams = gameState.teams;
  const completedRounds = gameState.rounds
    .filter(r => Object.keys(r.teamData).length > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  if (completedRounds.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <span className="font-bold opacity-30 text-9xl">$</span>
          <p className="text-sm">No round data yet. Complete at least one round to view financials.</p>
        </CardContent>
      </Card>
    );
  }

  const latestRound = completedRounds[completedRounds.length - 1];

  function getSold(tId: string, rn: number): number {
    return gameState!.rounds.find(r => r.roundNumber === rn)?.teamData[tId]?.customersSold?.length ?? 0;
  }

  // ── Compute IS per team ───────────────────────────────────────────────────
  const teamData = teams.map(t => {
    // All rounds summed (YTD)
    const ytd = completedRounds.reduce((acc, r) => {
      const td = r.teamData[t.id];
      if (!td) return acc;
      const ri = gameState.researchAllocatedByRound[r.roundNumber]?.[t.id] || 0;
      const li = gameState.logisticsAllocatedByRound[r.roundNumber]?.[t.id] || 0;
      const s = buildIS(td.revenue, td.productsProduced, getSold(t.id, r.roundNumber), ri, li);
      return {
        revenue: acc.revenue + s.revenue, cogs: acc.cogs + s.cogs, stockLoss: acc.stockLoss + s.stockLoss,
        grossProfit: acc.grossProfit + s.grossProfit, researchExpense: acc.researchExpense + s.researchExpense,
        logisticsExpense: acc.logisticsExpense + s.logisticsExpense, operatingProfit: acc.operatingProfit + s.operatingProfit,
      };
    }, { ...emptyIS });

    // Per-round (selected round)
    const roundIS = (() => {
      if (viewRound === 'all') return ytd;
      const r = completedRounds.find(r => r.roundNumber === parseInt(viewRound));
      if (!r) return ytd;
      const td = r.teamData[t.id];
      if (!td) return { ...emptyIS };
      const ri = gameState.researchAllocatedByRound[r.roundNumber]?.[t.id] || 0;
      const li = gameState.logisticsAllocatedByRound[r.roundNumber]?.[t.id] || 0;
      return buildIS(td.revenue, td.productsProduced, getSold(t.id, r.roundNumber), ri, li);
    })();

    // Balance sheet (always YTD snapshot)
    const latestTd = latestRound.teamData[t.id];
    const cash = latestTd?.totalMoney ?? 0;
    const patentBonus = getTeamPatentPoints(t.id, gameState.patents, latestRound ? latestRound.roundNumber : gameState.currentRound);
    const researchInvestments = gameState.teamResearchProgress[t.id]
      ? Object.values(gameState.teamResearchProgress[t.id].technologyInvestments).reduce((s, v) => s + v, 0)
      : 0;
    const techAssets = researchInvestments + patentBonus;
    const marketPresence = completedRounds.reduce((s, r) => s + getControlPointsForTeamInRound(r, t.id, gameState), 0);
    const bs = buildBS(cash, techAssets, marketPresence, ytd.operatingProfit);

    return { team: t, ytd, roundIS, bs };
  });

  const totalRevenue = teamData.reduce((s, d) => s + d.roundIS.revenue, 0);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="font-bold text-base">$</span>
            Financials — All Teams
          </CardTitle>
          <CardDescription>
            COGS: ${COGS_PER_UNIT}/unit sold · Stock Loss: ${STOCK_LOSS_PER_UNIT}/unsold · Icons: ${COST_PER_ICON}/icon · Share Capital: ${SHARE_CAPITAL}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            {/* View toggle */}
            <div className="flex gap-2 flex-1">
              {(['income', 'balance'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setActiveView(v)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeView === v
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/40 hover:bg-secondary/60 text-muted-foreground'
                    }`}
                >
                  {v === 'income' ? 'Income Statement' : 'Balance Sheet'}
                </button>
              ))}
            </div>
            {/* Period — income only */}
            {activeView === 'income' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Period:</label>
                <Select value={viewRound} onValueChange={setViewRound}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📊 Year to Date (All Rounds)</SelectItem>
                    {completedRounds.map(r => (
                      <SelectItem key={r.roundNumber} value={String(r.roundNumber)}>Round {r.roundNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════ INCOME STATEMENT ══════════════ */}
      {activeView === 'income' && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Income Statement — {viewRound === 'all' ? 'Year to Date' : `Round ${viewRound}`}</CardTitle>
              <CardDescription>All figures in $. Negative values shown as (amount).</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Card View (<640px) */}
              <div className="space-y-3 block sm:hidden p-3">
                {teamData.map(d => (
                  <div key={d.team.id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0 border" style={{ backgroundColor: d.team.color }} />
                        <span className="font-bold text-sm">{d.team.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">EBIT</span>
                        <span className={`text-sm font-black ${d.roundIS.operatingProfit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                          {fmt(d.roundIS.operatingProfit)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-bold">{fmt(d.roundIS.revenue)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">COGS</span>
                        <span className="font-medium text-destructive">{fmt(-d.roundIS.cogs)}</span>
                      </div>
                      <div className="flex justify-between py-0.5 font-semibold border-t border-border/40 pt-1">
                        <span>Gross Profit</span>
                        <span className="text-green-500">{fmt(d.roundIS.grossProfit)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Stock Loss</span>
                        <span className="font-medium text-destructive">{fmt(-d.roundIS.stockLoss)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">R&D Expense</span>
                        <span className="font-medium text-destructive">{fmt(-d.roundIS.researchExpense)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Logistics Expense</span>
                        <span className="font-medium text-destructive">{fmt(-d.roundIS.logisticsExpense)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>=640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/10">
                      <th className="text-left py-3 pl-3 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-44">Line Item</th>
                      {teams.map(t => (
                        <th key={t.id} className="text-right py-3 px-3 font-semibold min-w-[100px]">
                          <div className="flex items-center justify-end gap-2">
                            <span>{t.name}</span>
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <TableRow label="Revenue" bold cells={teamData.map(d => ({ value: d.roundIS.revenue }))} info={{ formula: 'Units Sold × Unit Selling Price', description: 'Total sales revenue earned from products sold to customers in the period.' }} />
                    <TableRow label="Cost of Goods Sold" indent cells={teamData.map(d => ({ value: -d.roundIS.cogs, highlight: 'negative' as const }))} info={{ formula: 'Units Sold × $1.00', description: 'Direct unit production cost ($1.00 per unit sold).' }} />
                    <TableRow label="Gross Profit" bold divider cells={teamData.map(d => ({ value: d.roundIS.grossProfit, highlight: 'positive' as const }))} info={{ formula: 'Revenue - COGS', description: 'Gross profit earned from sales before deducting operating expenses.' }} />
                    <TableSection title="Operating Expenses" />
                    <TableRow label="Stock Loss (Unsold)" indent cells={teamData.map(d => ({ value: -d.roundIS.stockLoss, highlight: 'negative' as const }))} info={{ formula: 'Unsold Units × $1.00', description: 'Loss incurred on unsold inventory produced in this round ($1.00 per unsold unit).' }} />
                    <TableRow label="R&D Expense" indent cells={teamData.map(d => ({ value: -d.roundIS.researchExpense, highlight: 'negative' as const }))} info={{ formula: 'Research Icons Allocated × $1.00', description: 'Operating expense for research points invested in technologies ($1.00 per icon).' }} />
                    <TableRow label="Logistics Expense" indent cells={teamData.map(d => ({ value: -d.roundIS.logisticsExpense, highlight: 'negative' as const }))} info={{ formula: 'Logistics Icons Allocated × $1.00', description: 'Operating expense for logistics points invested in regional offices ($1.00 per icon).' }} />
                    <TableRow label="Operating Profit (EBIT)" bold divider cells={teamData.map(d => ({ value: d.roundIS.operatingProfit, highlight: 'positive' as const }))} info={{ formula: 'Gross Profit - Stock Loss - R&D Expense - Logistics Expense', description: 'Net operating earnings before interest and taxes (EBIT).' }} />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* IS Ratios — summary table below */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Income Ratios — {viewRound === 'all' ? 'Year to Date' : `Round ${viewRound}`}
            </h3>
            {/* Ratio comparison table */}
            <Card>
              <CardContent className="p-0">
                {/* Mobile Card View (<640px) */}
                <div className="space-y-3 block sm:hidden p-3">
                  {teamData.map(d => (
                    <div key={d.team.id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2">
                      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                        <span className="w-3 h-3 rounded-full shrink-0 border" style={{ backgroundColor: d.team.color }} />
                        <span className="font-bold text-sm">{d.team.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/40 p-2 rounded-lg">
                          <span className="text-[10px] text-muted-foreground block">Gross Margin</span>
                          <span className="font-bold text-sm">{pct(d.roundIS.grossProfit, d.roundIS.revenue)}</span>
                        </div>
                        <div className="bg-muted/40 p-2 rounded-lg">
                          <span className="text-[10px] text-muted-foreground block">EBIT %</span>
                          <span className="font-bold text-sm">{pct(d.roundIS.operatingProfit, d.roundIS.revenue)}</span>
                        </div>
                        <div className="bg-muted/40 p-2 rounded-lg">
                          <span className="text-[10px] text-muted-foreground block">R&D Intensity</span>
                          <span className="font-bold text-sm">{pct(d.roundIS.researchExpense, d.roundIS.revenue)}</span>
                        </div>
                        <div className="bg-muted/40 p-2 rounded-lg">
                          <span className="text-[10px] text-muted-foreground block">Market Share</span>
                          <span className="font-bold text-sm">{pct(d.roundIS.revenue, totalRevenue)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>=640px) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/10">
                        <th className="text-left py-3 pl-3 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-44">Ratio</th>
                        {teams.map(t => (
                          <th key={t.id} className="text-right py-3 px-3 font-semibold min-w-[100px]">
                            <div className="flex items-center justify-end gap-2">
                              <span>{t.name}</span>
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Gross Margin %', fn: (d: typeof teamData[0]) => pct(d.roundIS.grossProfit, d.roundIS.revenue), info: { formula: '(Gross Profit ÷ Revenue) × 100', description: 'Percentage of revenue retained after deducting direct production costs.' } },
                        { label: 'EBIT %', fn: (d: typeof teamData[0]) => pct(d.roundIS.operatingProfit, d.roundIS.revenue), info: { formula: '(EBIT ÷ Revenue) × 100', description: 'Operating margin: Earnings Before Interest & Tax generated per dollar of revenue.' } },
                        { label: 'R&D Intensity %', fn: (d: typeof teamData[0]) => pct(d.roundIS.researchExpense, d.roundIS.revenue), info: { formula: '(R&D Expense ÷ Revenue) × 100', description: 'Proportion of total revenue reinvested into research and development.' } },
                        { label: 'Market Share %', fn: (d: typeof teamData[0]) => pct(d.roundIS.revenue, totalRevenue), info: { formula: '(Team Revenue ÷ Total Market Revenue) × 100', description: 'Percentage of overall industry revenue captured by this team.' } },
                      ].map(({ label, fn, info }) => (
                        <tr key={label} className="hover:bg-secondary/10 border-b border-border/20 transition-colors">
                          <td className="py-2 pl-3 pr-4 text-sm font-medium">
                            <div className="inline-flex items-center">
                              <span>{label}</span>
                              <InfoPill formula={info.formula} description={info.description} />
                            </div>
                          </td>
                          {teamData.map(d => (
                            <td key={d.team.id} className="text-right py-2 px-3 font-mono">{fn(d)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ══════════════ BALANCE SHEET ══════════════ */}
      {activeView === 'balance' && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Balance Sheet — As at end of Round {latestRound.roundNumber}</CardTitle>
              <CardDescription>YTD snapshot. All figures in dollars.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Card View (<640px) */}
              <div className="space-y-3 block sm:hidden p-3">
                {teamData.map(d => (
                  <div key={d.team.id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0 border" style={{ backgroundColor: d.team.color }} />
                        <span className="font-bold text-sm">{d.team.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Assets</span>
                        <span className="text-sm font-black text-primary">{fmt(d.bs.totalAssets)}</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block pt-1">Assets</span>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Cash & Equivalents</span>
                        <span className="font-medium">{fmt(d.bs.cash)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Technology Assets</span>
                        <span className="font-medium">{fmt(d.bs.techAssets)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Market Presence</span>
                        <span className="font-medium">{fmt(d.bs.marketPresence)}</span>
                      </div>

                      <span className="text-[10px] font-bold text-muted-foreground uppercase block pt-2 border-t border-border/40">Equity</span>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Share Capital</span>
                        <span className="font-medium">{fmt(d.bs.shareCapital)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Retained Earnings</span>
                        <span className={`font-medium ${d.bs.retainedEarnings >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                          {fmt(d.bs.retainedEarnings)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 font-bold border-t border-border/40 pt-1">
                        <span>Total Equity</span>
                        <span className="text-primary">{fmt(d.bs.totalEquity)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>=640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/10">
                      <th className="text-left py-3 pl-3 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-52">Line Item</th>
                      {teams.map(t => (
                        <th key={t.id} className="text-right py-3 px-3 font-semibold min-w-[110px]">
                          <div className="flex items-center justify-end gap-2">
                            <span>{t.name}</span>
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Assets */}
                    <TableSection title="Assets" />
                    <tr><td colSpan={99} className="px-3 py-0 pl-6 text-[10px] text-muted-foreground pb-1">Current Assets</td></tr>
                    <TableRow label="Cash & Equivalents" indent cells={teamData.map(d => ({ value: d.bs.cash }))} info={{ formula: 'Starting Cash + Cumulative EBIT', description: 'Liquid funds remaining in cash at the end of the round.' }} />
                    <tr><td colSpan={99} className="px-3 py-0 pl-6 text-[10px] text-muted-foreground pt-2 pb-1">Non-Current Assets</td></tr>
                    <TableRow label="Technology Assets" indent cells={teamData.map(d => ({ value: d.bs.techAssets }))} info={{ formula: 'Cumulative R&D Investments + Patent Points', description: 'Capitalized value of research investments into developing technologies plus bonus points for held patents.' }} />
                    <TableRow label="Market Presence (Goodwill)" indent cells={teamData.map(d => ({ value: d.bs.marketPresence }))} info={{ formula: 'Cumulative Regional Control Points', description: 'Capitalized value of market presence and regional control acquired.' }} />
                    <TableRow label="Total Assets" bold divider cells={teamData.map(d => ({ value: d.bs.totalAssets }))} info={{ formula: 'Cash + Tech Assets + Market Presence', description: 'Total economic resources owned by the business.' }} />
                    {/* Equity */}
                    <TableSection title="Shareholders\' Equity" />
                    <TableRow label="Share Capital" indent cells={teamData.map(d => ({ value: d.bs.shareCapital }))} info={{ formula: '$20.00', description: 'Initial equity capital invested at company launch.' }} />
                    <TableRow label="Retained Earnings (EBIT)" indent cells={teamData.map(d => ({ value: d.bs.retainedEarnings, highlight: (d.bs.retainedEarnings >= 0 ? 'positive' : 'negative') as 'positive' | 'negative' }))} info={{ formula: 'Cumulative Operating Profit (EBIT)', description: 'Accumulated net operating profits retained in the business.' }} />
                    <TableRow label="Valuation Reserve (Intangibles)" indent cells={teamData.map(d => ({ value: d.bs.valuationReserve }))} info={{ formula: 'Technology Assets + Market Presence', description: 'Reserve capturing total capitalized value of intangible assets.' }} />
                    <TableRow label="Total Equity" bold divider cells={teamData.map(d => ({ value: d.bs.totalEquity, highlight: (d.bs.totalEquity >= 0 ? 'positive' : 'negative') as 'positive' | 'negative' }))} info={{ formula: 'Share Capital + Retained Earnings + Valuation Reserve', description: 'Total net worth of shareholders (equals Total Assets).' }} />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* BS Ratio comparison table */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Balance Sheet Ratios</h3>
            <Card>
              <CardContent className="p-0">
                {/* Mobile Card View (<640px) */}
                <div className="space-y-3 block sm:hidden p-3">
                  {teamData.map(d => (
                    <div key={d.team.id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2">
                      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                        <span className="w-3 h-3 rounded-full shrink-0 border" style={{ backgroundColor: d.team.color }} />
                        <span className="font-bold text-sm">{d.team.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/40 p-2 rounded-lg">
                          <span className="text-[10px] text-muted-foreground block">ROA %</span>
                          <span className="font-bold text-sm">{pct(d.ytd.operatingProfit, d.bs.totalAssets)}</span>
                        </div>
                        <div className="bg-muted/40 p-2 rounded-lg">
                          <span className="text-[10px] text-muted-foreground block">ROE %</span>
                          <span className="font-bold text-sm">{pct(d.ytd.operatingProfit, d.bs.totalEquity)}</span>
                        </div>
                        <div className="bg-muted/40 p-2 rounded-lg">
                          <span className="text-[10px] text-muted-foreground block">Asset Turnover</span>
                          <span className="font-bold text-sm">{ratio(d.ytd.revenue, d.bs.totalAssets)}</span>
                        </div>
                        <div className="bg-muted/40 p-2 rounded-lg">
                          <span className="text-[10px] text-muted-foreground block">Intangibles %</span>
                          <span className="font-bold text-sm">{pct(d.bs.techAssets + d.bs.marketPresence, d.bs.totalAssets)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>=640px) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/10">
                        <th className="text-left py-3 pl-3 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-52">Ratio</th>
                        {teams.map(t => (
                          <th key={t.id} className="text-right py-3 px-3 font-semibold min-w-[110px]">
                            <div className="flex items-center justify-end gap-2">
                              <span>{t.name}</span>
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Return on Assets %', fn: (d: typeof teamData[0]) => pct(d.ytd.operatingProfit, d.bs.totalAssets), info: { formula: '(YTD Operating Profit ÷ Total Assets) × 100', description: 'Efficiency of total asset utilization in generating net operating profit.' } },
                        { label: 'Return on Equity %', fn: (d: typeof teamData[0]) => pct(d.ytd.operatingProfit, d.bs.totalEquity), info: { formula: '(YTD Operating Profit ÷ Total Equity) × 100', description: 'Rate of return generated on total shareholders equity.' } },
                        { label: 'Asset Turnover', fn: (d: typeof teamData[0]) => ratio(d.ytd.revenue, d.bs.totalAssets), info: { formula: 'YTD Revenue ÷ Total Assets', description: 'Revenue generated per dollar of total enterprise assets.' } },
                        { label: 'Intangibles % of Assets', fn: (d: typeof teamData[0]) => pct(d.bs.techAssets + d.bs.marketPresence, d.bs.totalAssets), info: { formula: '((Tech Assets + Market Presence) ÷ Total Assets) × 100', description: 'Proportion of enterprise asset value represented by intangible assets.' } },
                      ].map(({ label, fn, info }) => (
                        <tr key={label} className="hover:bg-secondary/10 border-b border-border/20 transition-colors">
                          <td className="py-2 pl-3 pr-4 text-sm font-medium">
                            <div className="inline-flex items-center">
                              <span>{label}</span>
                              <InfoPill formula={info.formula} description={info.description} />
                            </div>
                          </td>
                          {teamData.map(d => (
                            <td key={d.team.id} className="text-right py-2 px-3 font-mono">{fn(d)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
