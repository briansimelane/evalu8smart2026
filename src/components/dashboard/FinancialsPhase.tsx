import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, FlaskConical,
  Cpu, BarChart2, RefreshCw, Scale,
} from 'lucide-react';

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
  label, cells, bold, indent, divider,
}: {
  label: string;
  cells: CellData[];
  bold?: boolean;
  indent?: boolean;
  divider?: boolean;
}) {
  return (
    <>
      {divider && <tr><td colSpan={99} className="px-3 py-0"><div className="h-px bg-border/50" /></td></tr>}
      <tr className={`${bold ? 'bg-secondary/25' : 'hover:bg-secondary/10'} transition-colors`}>
        <td className={`py-1.5 pl-3 pr-4 text-sm whitespace-nowrap ${indent ? 'pl-6 text-muted-foreground' : bold ? 'font-bold' : ''}`}>
          {label}
        </td>
        {cells.map((cell, i) => {
          const colorClass =
            cell.highlight === 'positive' ? (cell.value >= 0 ? 'text-green-400' : 'text-red-400')
              : cell.highlight === 'negative' ? 'text-red-400/80' : '';
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
        <p className={`text-2xl font-bold ${positive === undefined ? '' : positive ? 'text-green-400' : 'text-red-400'}`}>{value}</p>
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
    const techAssets = gameState.teamResearchProgress[t.id]
      ? Object.values(gameState.teamResearchProgress[t.id].technologyInvestments).reduce((s, v) => s + v, 0)
      : 0;
    const marketPresence = completedRounds.reduce((s, r) => s + (r.teamData[t.id]?.controlValue ?? 0), 0);
    const bs = buildBS(cash, techAssets, marketPresence, ytd.operatingProfit);

    return { team: t, ytd, roundIS, bs };
  });

  const totalRevenue = teamData.reduce((s, d) => s + d.roundIS.revenue, 0);

  return (
    <div className="space-y-6">
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
              <div className="overflow-x-auto">
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
                    <TableRow label="Revenue" bold cells={teamData.map(d => ({ value: d.roundIS.revenue }))} />
                    <TableRow label="Cost of Goods Sold" indent cells={teamData.map(d => ({ value: -d.roundIS.cogs, highlight: 'negative' as const }))} />
                    <TableRow label="Gross Profit" bold divider cells={teamData.map(d => ({ value: d.roundIS.grossProfit, highlight: 'positive' as const }))} />
                    <TableSection title="Operating Expenses" />
                    <TableRow label="Stock Loss (Unsold)" indent cells={teamData.map(d => ({ value: -d.roundIS.stockLoss, highlight: 'negative' as const }))} />
                    <TableRow label="R&D Expense" indent cells={teamData.map(d => ({ value: -d.roundIS.researchExpense, highlight: 'negative' as const }))} />
                    <TableRow label="Logistics Expense" indent cells={teamData.map(d => ({ value: -d.roundIS.logisticsExpense, highlight: 'negative' as const }))} />
                    <TableRow label="Operating Profit (EBIT)" bold divider cells={teamData.map(d => ({ value: d.roundIS.operatingProfit, highlight: 'positive' as const }))} />
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...teamData]
                .sort((a, b) => b.ytd.operatingProfit - a.ytd.operatingProfit)
                .slice(0, 1)
                .map(({ team: t, ytd }) => (
                  // left intact for future extensions, using non-mutating sort via spread
                  null
                ))}
            </div>
            {/* Ratio comparison table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
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
                        { label: 'Gross Margin %', fn: (d: typeof teamData[0]) => pct(d.roundIS.grossProfit, d.roundIS.revenue) },
                        { label: 'Return on Sales %', fn: (d: typeof teamData[0]) => pct(d.roundIS.operatingProfit, d.roundIS.revenue) },
                        { label: 'R&D Intensity %', fn: (d: typeof teamData[0]) => pct(d.roundIS.researchExpense, d.roundIS.revenue) },
                        { label: 'Market Share %', fn: (d: typeof teamData[0]) => pct(d.roundIS.revenue, totalRevenue) },
                      ].map(({ label, fn }) => (
                        <tr key={label} className="hover:bg-secondary/10 border-b border-border/20 transition-colors">
                          <td className="py-2 pl-3 pr-4 text-sm font-medium">{label}</td>
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
              <div className="overflow-x-auto">
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
                    <TableRow label="Cash & Equivalents" indent cells={teamData.map(d => ({ value: d.bs.cash }))} />
                    <tr><td colSpan={99} className="px-3 py-0 pl-6 text-[10px] text-muted-foreground pt-2 pb-1">Non-Current Assets</td></tr>
                    <TableRow label="Technology Assets" indent cells={teamData.map(d => ({ value: d.bs.techAssets }))} />
                    <TableRow label="Market Presence (Goodwill)" indent cells={teamData.map(d => ({ value: d.bs.marketPresence }))} />
                    <TableRow label="Total Assets" bold divider cells={teamData.map(d => ({ value: d.bs.totalAssets }))} />
                    {/* Equity */}
                    <TableSection title="Shareholders' Equity" />
                    <TableRow label="Share Capital" indent cells={teamData.map(d => ({ value: d.bs.shareCapital }))} />
                    <TableRow label="Retained Earnings (EBIT)" indent cells={teamData.map(d => ({ value: d.bs.retainedEarnings, highlight: (d.bs.retainedEarnings >= 0 ? 'positive' : 'negative') as 'positive' | 'negative' }))} />
                    <TableRow label="Valuation Reserve (Intangibles)" indent cells={teamData.map(d => ({ value: d.bs.valuationReserve }))} />
                    <TableRow label="Total Equity" bold divider cells={teamData.map(d => ({ value: d.bs.totalEquity, highlight: (d.bs.totalEquity >= 0 ? 'positive' : 'negative') as 'positive' | 'negative' }))} />
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
                <div className="overflow-x-auto">
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
                        { label: 'Return on Assets %', fn: (d: typeof teamData[0]) => pct(d.ytd.operatingProfit, d.bs.totalAssets) },
                        { label: 'Return on Equity %', fn: (d: typeof teamData[0]) => pct(d.ytd.operatingProfit, d.bs.totalEquity) },
                        { label: 'Asset Turnover', fn: (d: typeof teamData[0]) => ratio(d.ytd.revenue, d.bs.totalAssets) },
                        { label: 'Intangibles % of Assets', fn: (d: typeof teamData[0]) => pct(d.bs.techAssets + d.bs.marketPresence, d.bs.totalAssets) },
                      ].map(({ label, fn }) => (
                        <tr key={label} className="hover:bg-secondary/10 border-b border-border/20 transition-colors">
                          <td className="py-2 pl-3 pr-4 text-sm font-medium">{label}</td>
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
