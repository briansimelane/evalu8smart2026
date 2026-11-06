import React, { useState, useMemo } from 'react';
import type { GamePhase } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Package,
  Wrench,
  Microscope,
  Truck,
  Store,
  CheckSquare,
  Trophy,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export interface PhaseMeta {
  id: GamePhase;
  label: string;
  shortLabel: string;
  stepNumber: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  bgLight: string;
}

export const ALL_PHASES: PhaseMeta[] = [
  {
    id: 'planning',
    label: 'Planning Phase',
    shortLabel: 'Planning',
    stepNumber: 1,
    description: 'Arrange plan sheets, set product prices, calculate production and logistics points.',
    icon: ClipboardList,
    accentColor: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30',
  },
  {
    id: 'production',
    label: 'Production Phase',
    shortLabel: 'Production',
    stepNumber: 2,
    description: 'Manufacture goods based on plan sheets, improvements, and one-time GPS bonuses.',
    icon: Package,
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30',
  },
  {
    id: 'improvement',
    label: 'Improvement Phase',
    shortLabel: 'Improvement',
    stepNumber: 3,
    description: 'Draft development tiles, technology tiles, and research improvements (skipped in Round 5).',
    icon: Wrench,
    accentColor: 'text-amber-600 dark:text-amber-400',
    bgLight: 'border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/30',
  },
  {
    id: 'innovation',
    label: 'Research Phase',
    shortLabel: 'Research',
    stepNumber: 4,
    description: 'Allocate research points into technologies to discover perks and claim exclusive patents.',
    icon: Microscope,
    accentColor: 'text-purple-600 dark:text-purple-400',
    bgLight: 'border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/30',
  },
  {
    id: 'expansion',
    label: 'Logistics Phase',
    shortLabel: 'Logistics',
    stepNumber: 5,
    description: 'Expand retail footprint by establishing regional offices and placing logistics cubes.',
    icon: Truck,
    accentColor: 'text-rose-600 dark:text-rose-400',
    bgLight: 'border-rose-200 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/30',
  },
  {
    id: 'sales',
    label: 'Sales Phase',
    shortLabel: 'Sales',
    stepNumber: 6,
    description: 'Sell products to customers in market regions following price priority and tech demand.',
    icon: Store,
    accentColor: 'text-sky-600 dark:text-sky-400',
    bgLight: 'border-sky-200 dark:border-sky-800/60 bg-sky-50/50 dark:bg-sky-950/30',
  },
  {
    id: 'control',
    label: 'Control Phase',
    shortLabel: 'Control',
    stepNumber: 7,
    description: 'Award regional dominance points, evaluate market majorities, and handle unsold inventory.',
    icon: CheckSquare,
    accentColor: 'text-slate-600 dark:text-slate-400',
    bgLight: 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60',
  },
  {
    id: 'scoring',
    label: 'Scoring Phase',
    shortLabel: 'Scoring',
    stepNumber: 8,
    description: 'Review total revenue, victory point gains, and updated simulation standings.',
    icon: Trophy,
    accentColor: 'text-yellow-600 dark:text-yellow-400',
    bgLight: 'border-yellow-200 dark:border-yellow-800/60 bg-yellow-50/50 dark:bg-yellow-950/30',
  },
];

export interface PhaseControllerProps {
  currentPhase: string;
  currentRound: number;
  onPhaseChange: (phase: GamePhase) => void;
  disabled?: boolean;
}

export const PhaseController: React.FC<PhaseControllerProps> = ({
  currentPhase,
  currentRound,
  onPhaseChange,
  disabled = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingBackwardPhase, setPendingBackwardPhase] = useState<PhaseMeta | null>(null);

  // In Round 5, improvement phase is skipped
  const activePhases = useMemo(() => {
    if (currentRound >= 5) {
      return ALL_PHASES.filter(p => p.id !== 'improvement');
    }
    return ALL_PHASES;
  }, [currentRound]);

  const normalizedCurrent = (currentPhase || 'planning').toLowerCase();
  const currentIndex = activePhases.findIndex(p => p.id === normalizedCurrent);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentMeta = activePhases[safeIndex] || ALL_PHASES[0];

  const canGoPrev = safeIndex > 0;
  const prevMeta = canGoPrev ? activePhases[safeIndex - 1] : null;

  const canGoNext = safeIndex < activePhases.length - 1;
  const nextMeta = canGoNext ? activePhases[safeIndex + 1] : null;

  const handleSelectPhase = (target: PhaseMeta) => {
    if (target.id === currentMeta.id) {
      setModalOpen(false);
      return;
    }

    const targetIndex = activePhases.findIndex(p => p.id === target.id);
    // If moving backward, ask for confirmation to prevent accidental loss of submitted actions
    if (targetIndex >= 0 && targetIndex < safeIndex) {
      setPendingBackwardPhase(target);
      return;
    }

    onPhaseChange(target.id);
    setModalOpen(false);
  };

  const confirmBackwardJump = () => {
    if (pendingBackwardPhase) {
      onPhaseChange(pendingBackwardPhase.id);
      setPendingBackwardPhase(null);
      setModalOpen(false);
    }
  };

  const CurrentIcon = currentMeta.icon;

  return (
    <>
      <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-card/80 border border-border shadow-sm">
        {/* Step Backward Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || !canGoPrev}
          onClick={() => prevMeta && onPhaseChange(prevMeta.id)}
          className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 gap-1"
          title={prevMeta ? `Go back to ${prevMeta.shortLabel} Phase` : 'Already at first phase'}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        {/* Current Phase Badge / Modal Trigger (Touch-safe) */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setModalOpen(true)}
          disabled={disabled}
          className="h-7 px-2.5 text-xs font-bold border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary gap-1.5 transition-all shadow-none"
          title="Click to open Phase Navigator and jump to any phase"
        >
          <CurrentIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="font-extrabold">{currentMeta.shortLabel}</span>
          <span className="text-[10px] opacity-75 font-normal hidden sm:inline">
            ({safeIndex + 1}/{activePhases.length})
          </span>
          <SlidersHorizontal className="h-3 w-3 opacity-60 ml-0.5" />
        </Button>

        {/* Advance to Next Phase Button (Primary Action) */}
        {canGoNext && nextMeta ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={disabled}
            onClick={() => onPhaseChange(nextMeta.id)}
            className="h-7 px-2.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-1 transition-all"
            title={`Advance game to ${nextMeta.label}`}
          >
            <span>Advance: {nextMeta.shortLabel}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Badge
            variant="outline"
            className="h-7 px-2.5 text-[11px] font-semibold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            Round Complete
          </Badge>
        )}
      </div>

      {/* Centered Touch-Safe Phase Navigator Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) setPendingBackwardPhase(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                <span>Simulation Phase Navigator</span>
              </DialogTitle>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs font-bold">
                  Round {currentRound} of 5
                </Badge>
                <Badge className="bg-primary text-primary-foreground text-xs font-bold">
                  Active: {currentMeta.shortLabel}
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              Select any phase to update the active simulation phase for all connected teams and viewers.
            </DialogDescription>
          </DialogHeader>

          {/* Backward Jump Warning Confirmation Prompt */}
          {pendingBackwardPhase ? (
            <div className="py-6 space-y-4">
              <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-base">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <span>Confirm Step Back to {pendingBackwardPhase.label}?</span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-amber-800 dark:text-amber-300">
                  You are currently in <strong>{currentMeta.label}</strong>. Stepping back to{' '}
                  <strong>{pendingBackwardPhase.label}</strong> will switch the live view for all teams.
                  Any player actions already submitted for subsequent phases will remain saved unless modified.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPendingBackwardPhase(null)}
                  className="font-semibold text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmBackwardJump}
                  className="font-bold text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Switch to {pendingBackwardPhase.shortLabel} Phase</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
              {/* Grid of Large Touch-Friendly Phase Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ALL_PHASES.map((phase) => {
                  const isCurrent = phase.id === currentMeta.id;
                  const isSkippedInR5 = phase.id === 'improvement' && currentRound >= 5;
                  const Icon = phase.icon;

                  return (
                    <Card
                      key={phase.id}
                      onClick={() => !isSkippedInR5 && handleSelectPhase(phase)}
                      className={`p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between border cursor-pointer select-none rounded-xl ${
                        isCurrent
                          ? 'ring-2 ring-primary border-primary bg-primary/10 shadow-sm'
                          : isSkippedInR5
                          ? 'opacity-40 cursor-not-allowed border-dashed bg-muted/40'
                          : 'hover:border-primary/50 hover:bg-accent/40 bg-card/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg border ${phase.bgLight}`}>
                            <Icon className={`h-4 w-4 ${phase.accentColor}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Step {phase.stepNumber}
                              </span>
                              {isCurrent && (
                                <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 font-extrabold">
                                  CURRENT
                                </Badge>
                              )}
                              {isSkippedInR5 && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
                                  Skipped in R5
                                </Badge>
                              )}
                            </div>
                            <span className="font-bold text-sm text-foreground block">
                              {phase.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-normal mt-1">
                        {phase.description}
                      </p>
                    </Card>
                  );
                })}
              </div>

              <div className="p-2.5 rounded-lg bg-secondary/40 border border-border text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-bold text-foreground shrink-0">Tip:</span>
                <span>
                  Advancing sequentially with the <strong>Advance ▶</strong> button is the fastest way during live facilitation. Use this navigator when you need to step back or skip directly to a phase.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-between sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Touch any phase card to jump directly.
            </span>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
