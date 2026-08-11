import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { useDemoState } from './DemoStateProvider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GameIcon } from '@/components/dashboard/GameIcon';
import { Play, FastForward, RotateCcw, Monitor, CheckCircle, AlertTriangle } from 'lucide-react';
import { GamePhase } from '@/types/game';
import { ViewerBoard } from '@/pages/Viewer/ViewerPage';

export function DemoControlBar() {
  const { gameState, updatePhase, advanceRound, endGame } = useGame();
  const { isDemo } = useSession();
  const { resetDemo, isReadOnlyTab, revealAllScores } = useDemoState();

  const [confirmRoundAdvance, setConfirmRoundAdvance] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [showViewerModal, setShowViewerModal] = useState(false);

  if (!isDemo || !gameState) return null;

  const currentRound = gameState.currentRound;
  const currentPhase = (gameState.currentPhase || 'planning').toLowerCase() as GamePhase;

  const phaseOrder: { key: GamePhase; label: string }[] = [
    { key: 'planning', label: '1. Planning' },
    { key: 'production', label: '2. Production' },
    { key: 'improvement', label: '3. Improvements' },
    { key: 'innovation', label: '4. Research' },
    { key: 'expansion', label: '5. Logistics' },
    { key: 'sales', label: '6. Sales' },
    { key: 'control', label: '7. Control' },
    { key: 'scoring', label: '8. Scoring' },
  ];

  const filteredPhases = phaseOrder.filter(p => !(p.key === 'improvement' && currentRound >= 5));

  const getCurrentIndex = () => {
    return filteredPhases.findIndex(p => p.key === currentPhase || (currentPhase === 'research' && p.key === 'innovation') || (currentPhase === 'logistics' && p.key === 'expansion'));
  };

  const currentIndex = getCurrentIndex();
  const nextPhaseObj = currentIndex >= 0 && currentIndex < filteredPhases.length - 1 ? filteredPhases[currentIndex + 1] : null;

  const handleNextPhase = () => {
    if (nextPhaseObj) {
      updatePhase(nextPhaseObj.key);
    }
  };

  const handlePhaseSelect = (val: string) => {
    updatePhase(val as GamePhase);
  };

  const handleEndGameClick = () => {
    endGame();
    revealAllScores();
  };

  return (
    <>
      <div className="sticky top-0 z-40 bg-card text-card-foreground border-b border-border shadow-xs px-4 py-2 flex items-center justify-between gap-3 flex-wrap text-sm">
        {/* Left: Current Status Badge & Phase Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
            <GameIcon type="planning" size="xs" showLabel={false} />
            <span>Round {currentRound}</span>
          </div>

          {/* Phase Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Phase:</span>
            <Select value={currentPhase} onValueChange={handlePhaseSelect} disabled={isReadOnlyTab}>
              <SelectTrigger className="h-8 bg-background border-border text-foreground text-xs font-bold w-[160px]">
                <SelectValue placeholder="Select Phase" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {filteredPhases.map(p => (
                  <SelectItem key={p.key} value={p.key} className="text-xs font-medium">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Next Phase Button */}
          {nextPhaseObj && (
            <Button
              size="sm"
              onClick={handleNextPhase}
              disabled={isReadOnlyTab}
              className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1 px-3 shadow-xs"
            >
              <span>Next Phase ({nextPhaseObj.label.split('.')[1].trim()})</span>
              <Play className="w-3.5 h-3.5 fill-white" />
            </Button>
          )}
        </div>

        {/* Right: Round Advance, Viewer, & Demo Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Viewer Overlay Modal Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowViewerModal(true)}
            className="h-8 bg-background border-border text-foreground hover:bg-accent text-xs font-bold flex items-center gap-1.5"
          >
            <Monitor className="w-3.5 h-3.5 text-sky-500" />
            <span>Open Board Viewer</span>
          </Button>

          {/* Advance Round Button */}
          {currentRound < 5 ? (
            <Button
              size="sm"
              onClick={() => setConfirmRoundAdvance(true)}
              disabled={isReadOnlyTab}
              className="h-8 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1 px-3 shadow-xs"
            >
              <FastForward className="w-3.5 h-3.5 fill-white" />
              <span>Advance Round {currentRound + 1}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleEndGameClick}
              disabled={isReadOnlyTab}
              className="h-8 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>End Demo Game</span>
            </Button>
          )}

          {/* Restart Demo */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmRestart(true)}
            className="h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Restart Demo
          </Button>
        </div>
      </div>

      {/* Confirm Round Advance Dialog */}
      <AlertDialog open={confirmRoundAdvance} onOpenChange={setConfirmRoundAdvance}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Advance to Round {currentRound + 1}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will lock Round {currentRound} scores and initialize Round {currentRound + 1}. All bot choices for Round {currentRound + 1} will automatically generate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                advanceRound();
                setConfirmRoundAdvance(false);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              Yes, Start Round {currentRound + 1}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Restart Dialog */}
      <AlertDialog open={confirmRestart} onOpenChange={setConfirmRestart}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="w-5 h-5 text-destructive" />
              Restart Demo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will delete your current solo demo game and return you to the Demo Setup screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetDemo();
                setConfirmRestart(false);
              }}
              className="bg-destructive hover:bg-destructive/90 text-white font-bold"
            >
              Restart Demo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* In-Page Viewer Fullscreen Modal */}
      <Dialog open={showViewerModal} onOpenChange={setShowViewerModal}>
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[96vh] h-[96vh] p-0 bg-slate-950 border-slate-800 overflow-hidden flex flex-col sm:max-w-[98vw]">
          <DialogHeader className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-row shrink-0">
            <DialogTitle className="text-white text-sm font-black flex items-center gap-2">
              <Monitor className="w-4 h-4 text-sky-400" />
              Live Projector Board Viewer (Demo Mode)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-950 min-h-0 flex flex-col">
            {gameState && (
              <ViewerBoard 
                classData={{ id: 'demo', name: 'Demo Game', code: 'DEMO', facilitatorCode: '', teamCodes: {} }}
                gameState={gameState} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
