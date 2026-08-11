import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { calculatePlanStats } from '@/lib/rules';
import { COMBINATIONS, Combination } from '@/data/combinations';
import { ICON_EFFECTS } from '@/data/improvements';
import { GameIcon } from './GameIcon';
import {
  Table as TableIcon,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RotateCcw,
  Sparkles,
  Check,
  Minus
} from 'lucide-react';

export type SortField =
  | 'combination'
  | 'position'
  | 'price'
  | 'calculatedPrice'
  | 'productsAvailable'
  | 'improvementPoints'
  | 'researchPoints'
  | 'logisticsPoints';

export interface CombinationsGuideModalProps {
  onSelectCombination?: (combination: number, position: number) => void;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  triggerClassName?: string;
  activeTeamId?: string;
}

export function CombinationsGuideModal({
  onSelectCombination,
  triggerLabel = 'Combinations Explorer',
  triggerVariant = 'outline',
  triggerClassName = '',
  activeTeamId,
}: CombinationsGuideModalProps) {
  const [open, setOpen] = useState(false);
  const { gameState, getCombinations } = useGame();
  const { currentTeamId } = useSession();

  const targetTeamId = activeTeamId || currentTeamId || gameState?.teams[0]?.id || '';

  const [comboFilter, setComboFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('combination');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [cardUsages, setCardUsages] = useState<Record<number, 'use' | 'product' | 'none'>>({});

  const combinationsData = useMemo(() => {
    const dynamicCombos = getCombinations ? getCombinations() : [];
    return dynamicCombos && dynamicCombos.length > 0 ? dynamicCombos : COMBINATIONS;
  }, [getCombinations]);

  // Identify usable improvement cards for this team
  const usableCards = useMemo(() => {
    if (!gameState || !targetTeamId) return [];
    const round = gameState.currentRound || 1;
    const allTeamCards = gameState.improvementCards.filter(
      card => card.availableForTeam === targetTeamId
    );
    const getAllocatedRound = (card: any) => {
      return card.isInitial || card.allocatedInRound == null
        ? 0
        : Number(card.allocatedInRound);
    };
    return allTeamCards.filter(card => getAllocatedRound(card) < round);
  }, [gameState, targetTeamId]);

  // Card summary calculation
  const cardBonusSummary = useMemo(() => {
    let priceEffect = 0;
    let productEffect = 0;
    let researchEffect = 0;
    let logisticsEffect = 0;

    usableCards.forEach(card => {
      const usage = cardUsages[card.id] || 'none';
      if (usage === 'use') {
        const icon1Effects = ICON_EFFECTS[card.icon1 as keyof typeof ICON_EFFECTS] || {
          priceEffect: 0,
          productEffect: 0,
          researchEffect: 0,
          logisticsEffect: 0,
        };
        const icon2Effects = ICON_EFFECTS[card.icon2 as keyof typeof ICON_EFFECTS] || {
          priceEffect: 0,
          productEffect: 0,
          researchEffect: 0,
          logisticsEffect: 0,
        };
        priceEffect += icon1Effects.priceEffect + icon2Effects.priceEffect;
        productEffect += icon1Effects.productEffect + icon2Effects.productEffect;
        researchEffect += icon1Effects.researchEffect + icon2Effects.researchEffect;
        logisticsEffect += icon1Effects.logisticsEffect + icon2Effects.logisticsEffect;
      } else if (usage === 'product') {
        productEffect += 1;
      }
    });

    return { priceEffect, productEffect, researchEffect, logisticsEffect };
  }, [usableCards, cardUsages]);

  // Compute calculated table data with real-time stats
  const tableData = useMemo(() => {
    return combinationsData.map((comboItem: Combination) => {
      let stats = {
        calculatedPrice: 5 + comboItem.price + cardBonusSummary.priceEffect,
        productsAvailable: (comboItem.products || 0) + cardBonusSummary.productEffect,
        improvementPoints: comboItem.improve || 0,
        researchPoints: (comboItem.research || 0) + cardBonusSummary.researchEffect,
        logisticsPoints: (comboItem.logistics || 0) + cardBonusSummary.logisticsEffect,
      };

      if (gameState && targetTeamId) {
        stats = calculatePlanStats(
          gameState,
          targetTeamId,
          comboItem.combination,
          comboItem.position,
          cardUsages,
          combinationsData
        );
      } else {
        stats.calculatedPrice = Math.max(2, Math.min(8, stats.calculatedPrice));
      }

      return {
        ...comboItem,
        calculatedPrice: stats.calculatedPrice,
        productsAvailable: stats.productsAvailable,
        improvementPoints: stats.improvementPoints,
        researchPoints: stats.researchPoints,
        logisticsPoints: stats.logisticsPoints,
      };
    });
  }, [combinationsData, gameState, targetTeamId, cardUsages, cardBonusSummary]);

  // Filter and sort
  const filteredAndSortedData = useMemo(() => {
    let list = [...tableData];

    if (comboFilter !== 'all') {
      list = list.filter(item => item.combination === parseInt(comboFilter));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        item =>
          `combo ${item.combination}`.includes(q) ||
          `position ${item.position}`.includes(q) ||
          `c${item.combination} p${item.position}`.includes(q) ||
          String(item.combination) === q ||
          String(item.position) === q
      );
    }

    list.sort((a: any, b: any) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return a.position - b.position;
    });

    return list;
  }, [tableData, comboFilter, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-purple-600 font-bold" />
    ) : (
      <ChevronDown className="w-4 h-4 text-purple-600 font-bold" />
    );
  };

  const handleCardUsageToggle = (cardId: number, usage: 'use' | 'product' | 'none') => {
    setCardUsages(prev => ({
      ...prev,
      [cardId]: usage,
    }));
  };

  const getIconElement = (iconType: string, size: 'xs' | 'sm' | 'md' | 'lg' = 'md') => {
    if (iconType === 'Price and Product') {
      return (
        <div className="flex items-center gap-1">
          <div className="relative inline-block" title="Price Decrease (-$1)">
            <GameIcon type="price" size={size} />
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-black border border-red-500 flex items-center justify-center">
              <Minus className="h-2.5 w-2.5 text-red-500 stroke-[3]" />
            </div>
          </div>
          <GameIcon type="production" size={size} />
        </div>
      );
    }
    return <GameIcon type={iconType} size={size} />;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className={`flex items-center gap-2 font-bold shadow-sm ${triggerClassName}`}
        >
          <TableIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>{triggerLabel}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
                <TableIcon className="w-6 h-6 text-purple-600" />
                <span>Combinations & Positions Guide</span>
                <Badge className="bg-purple-600 text-white font-mono text-xs">
                  112 Positions (8 Combos)
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm mt-1">
                Explore all 112 positions across 8 combinations. Test improvement card strategies in real-time and sort by any metric.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {/* Card Strategy Interactive Panel */}
          {usableCards.length > 0 && (
            <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-emerald-500/10 border border-purple-500/20 dark:border-purple-500/30 rounded-xl p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/10 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    Interactive Strategy Simulator: Available Cards ({usableCards.length})
                  </span>
                </div>
                {Object.keys(cardUsages).length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCardUsages({})}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset Cards
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {usableCards.map(card => {
                  const currentUsage = cardUsages[card.id] || 'none';
                  return (
                    <div
                      key={card.id}
                      className="bg-card border border-border rounded-xl p-3 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-center gap-2 py-1.5 bg-muted/60 rounded-lg">
                        {getIconElement(card.icon1, 'md')}
                        {!(card.id < 0) && getIconElement(card.icon2, 'md')}
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => handleCardUsageToggle(card.id, 'use')}
                          className={`py-1.5 px-1 rounded text-xs font-bold text-center transition-all cursor-pointer ${
                            currentUsage === 'use'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCardUsageToggle(card.id, 'product')}
                          className={`py-1.5 px-1 rounded text-xs font-bold text-center transition-all cursor-pointer ${
                            currentUsage === 'product'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        >
                          +1 Prod
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCardUsageToggle(card.id, 'none')}
                          className={`py-1.5 px-1 rounded text-xs font-semibold text-center transition-all cursor-pointer ${
                            currentUsage === 'none'
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        >
                          Dont use
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Active Effects Indicator */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <span className="text-muted-foreground font-semibold text-[11px]">
                  Active Card Effects:
                </span>
                <Badge
                  variant="outline"
                  className={
                    cardBonusSummary.priceEffect !== 0
                      ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 font-bold flex items-center gap-1'
                      : 'opacity-50 flex items-center gap-1'
                  }
                >
                  <GameIcon type="price" size="xs" />
                  <span>Price: {cardBonusSummary.priceEffect > 0 ? '+' : ''}{cardBonusSummary.priceEffect}</span>
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    cardBonusSummary.productEffect > 0
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold flex items-center gap-1'
                      : 'opacity-50 flex items-center gap-1'
                  }
                >
                  <GameIcon type="production" size="xs" />
                  <span>Products: +{cardBonusSummary.productEffect}</span>
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    cardBonusSummary.researchEffect > 0
                      ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 font-bold flex items-center gap-1'
                      : 'opacity-50 flex items-center gap-1'
                  }
                >
                  <GameIcon type="research" size="xs" />
                  <span>Research: +{cardBonusSummary.researchEffect}</span>
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    cardBonusSummary.logisticsEffect > 0
                      ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30 font-bold flex items-center gap-1'
                      : 'opacity-50 flex items-center gap-1'
                  }
                >
                  <GameIcon type="logistics" size="xs" />
                  <span>Logistics: +{cardBonusSummary.logisticsEffect}</span>
                </Badge>
              </div>
            </div>
          )}

          {/* Controls: Presets, Filter & Search */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-muted/40 p-2.5 rounded-xl border border-border">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search combo (e.g. Combo 1, Pos 5)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>

              <Select value={comboFilter} onValueChange={setComboFilter}>
                <SelectTrigger className="w-[150px] h-9 text-xs font-bold">
                  <SelectValue placeholder="All Combos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Combos (1-8)</SelectItem>
                  <SelectItem value="1">Combo 1</SelectItem>
                  <SelectItem value="2">Combo 2</SelectItem>
                  <SelectItem value="3">Combo 3</SelectItem>
                  <SelectItem value="4">Combo 4</SelectItem>
                  <SelectItem value="5">Combo 5</SelectItem>
                  <SelectItem value="6">Combo 6</SelectItem>
                  <SelectItem value="7">Combo 7</SelectItem>
                  <SelectItem value="8">Combo 8</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Sort Presets with Game Icons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-semibold mr-1">
                Sort Presets:
              </span>
              <Button
                variant={sortField === 'productsAvailable' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSortField('productsAvailable');
                  setSortDirection('desc');
                }}
                className="h-7 text-[11px] px-2 flex items-center gap-1 font-bold"
              >
                <GameIcon type="production" size="xs" />
                <span>Max Products</span>
              </Button>
              <Button
                variant={sortField === 'calculatedPrice' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSortField('calculatedPrice');
                  setSortDirection('asc');
                }}
                className="h-7 text-[11px] px-2 flex items-center gap-1 font-bold"
              >
                <GameIcon type="price" size="xs" />
                <span>Lowest Price</span>
              </Button>
              <Button
                variant={sortField === 'researchPoints' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSortField('researchPoints');
                  setSortDirection('desc');
                }}
                className="h-7 text-[11px] px-2 flex items-center gap-1 font-bold"
              >
                <GameIcon type="research" size="xs" />
                <span>Max Research</span>
              </Button>
              <Button
                variant={sortField === 'logisticsPoints' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSortField('logisticsPoints');
                  setSortDirection('desc');
                }}
                className="h-7 text-[11px] px-2 flex items-center gap-1 font-bold"
              >
                <GameIcon type="logistics" size="xs" />
                <span>Max Logistics</span>
              </Button>
            </div>
          </div>

          {/* Interactive Data Table */}
          <div className="border border-border rounded-xl overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/80 sticky top-0 z-20 backdrop-blur">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    onClick={() => handleSort('combination')}
                    className="cursor-pointer font-extrabold text-xs text-foreground hover:text-purple-600 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      Combo
                      {getSortIcon('combination')}
                    </div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('position')}
                    className="cursor-pointer font-extrabold text-xs text-foreground hover:text-purple-600 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      Pos #
                      {getSortIcon('position')}
                    </div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('price')}
                    className="cursor-pointer font-extrabold text-xs text-foreground hover:text-purple-600 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <GameIcon type="price" size="xs" />
                      <span>Price Adj</span>
                      {getSortIcon('price')}
                    </div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('calculatedPrice')}
                    className="cursor-pointer font-extrabold text-xs text-purple-700 dark:text-purple-400 hover:underline transition-colors select-none bg-purple-500/5"
                  >
                    <div className="flex items-center gap-1.5">
                      <GameIcon type="price" size="xs" />
                      <span>Calc Price</span>
                      {getSortIcon('calculatedPrice')}
                    </div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('productsAvailable')}
                    className="cursor-pointer font-extrabold text-xs text-foreground hover:text-purple-600 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <GameIcon type="production" size="xs" />
                      <span>Products</span>
                      {getSortIcon('productsAvailable')}
                    </div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('improvementPoints')}
                    className="cursor-pointer font-extrabold text-xs text-foreground hover:text-purple-600 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <GameIcon type="improvement" size="xs" />
                      <span>Improve</span>
                      {getSortIcon('improvementPoints')}
                    </div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('researchPoints')}
                    className="cursor-pointer font-extrabold text-xs text-foreground hover:text-purple-600 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <GameIcon type="research" size="xs" />
                      <span>Research</span>
                      {getSortIcon('researchPoints')}
                    </div>
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort('logisticsPoints')}
                    className="cursor-pointer font-extrabold text-xs text-foreground hover:text-purple-600 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <GameIcon type="logistics" size="xs" />
                      <span>Logistics</span>
                      {getSortIcon('logisticsPoints')}
                    </div>
                  </TableHead>
                  {onSelectCombination && (
                    <TableHead className="text-right font-extrabold text-xs text-foreground">
                      Action
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={onSelectCombination ? 9 : 8}
                      className="h-24 text-center text-xs text-muted-foreground"
                    >
                      No matching combinations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((row: any, idx: number) => {
                    const priceAdj = row.price;
                    const priceAdjFormatted =
                      priceAdj > 0 ? `+$${priceAdj}` : priceAdj < 0 ? `-$${Math.abs(priceAdj)}` : '$0';

                    return (
                      <TableRow
                        key={`${row.combination}-${row.position}`}
                        className={`hover:bg-muted/60 transition-colors text-xs font-mono ${
                          idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'
                        }`}
                      >
                        <TableCell className="font-bold font-sans">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold">
                            Combo {row.combination}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold">
                          Pos {row.position}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span
                              className={
                                priceAdj > 0
                                  ? 'text-emerald-600 font-bold'
                                  : priceAdj < 0
                                  ? 'text-red-500 font-bold'
                                  : 'text-muted-foreground font-semibold'
                              }
                            >
                              {priceAdjFormatted}
                            </span>
                            {cardBonusSummary.priceEffect !== 0 && (
                              <span className="text-[11px] text-purple-600 font-bold">
                                ({cardBonusSummary.priceEffect > 0 ? '+' : ''}${cardBonusSummary.priceEffect})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="bg-purple-500/5 font-extrabold text-purple-700 dark:text-purple-300">
                          ${row.calculatedPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-bold">
                          <div className="flex items-center gap-1">
                            <GameIcon type="production" size="xs" />
                            <span>{row.productsAvailable}</span>
                            {cardBonusSummary.productEffect > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                (+{cardBonusSummary.productEffect})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <GameIcon type="improvement" size="xs" />
                            <span>{row.improvementPoints}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <GameIcon type="research" size="xs" />
                            <span>{row.researchPoints}</span>
                            {cardBonusSummary.researchEffect > 0 && (
                              <span className="text-[10px] text-purple-600 font-bold">
                                (+{cardBonusSummary.researchEffect})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <GameIcon type="logistics" size="xs" />
                            <span>{row.logisticsPoints}</span>
                            {cardBonusSummary.logisticsEffect > 0 && (
                              <span className="text-[10px] text-cyan-600 font-bold">
                                (+{cardBonusSummary.logisticsEffect})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {onSelectCombination && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                onSelectCombination(row.combination, row.position);
                                setOpen(false);
                              }}
                              className="h-7 text-[11px] font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-xs"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Select
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
