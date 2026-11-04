import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { GameState, SimulationClass } from '@/types/game';
import { ViewerScaler } from '../Viewer/ViewerScaler';
import { ViewerBoard } from '../Viewer/ViewerPage';
import { MotionProvider } from './motionAdapter';
import { BoardScene } from './scene/BoardScene';
import { TopBar3D } from './hud/TopBar3D';
import { PriceLadder3D } from './hud/PriceLadder3D';
import { TechStrip3D } from './hud/TechStrip3D';
import { RegionPlate3D } from './hud/RegionPlate3D';
import { LAYOUT_DATA } from './layoutData';
import { useSceneEvents } from './anim/useSceneEvents';
import { ImprovementModal } from './modals/ImprovementModal';
import { ScoreboardModal } from './modals/ScoreboardModal';

// WebGL & Runtime Error Boundary for robust fallback to classic viewer
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class Viewer3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Viewer3D error caught, falling back to classic viewer:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface Viewer3DPageProps {
  classData: SimulationClass;
  gameState: GameState;
  onToggleClassic?: () => void;
}

export function Viewer3DBoard({ classData, gameState, onToggleClassic }: Viewer3DPageProps) {
  return (
    <Viewer3DErrorBoundary fallback={<ViewerBoard classData={classData} gameState={gameState} />}>
      <ViewerScaler>
        <MotionProvider gameState={gameState}>
          <Viewer3DContent
            classData={classData}
            gameState={gameState}
            onToggleClassic={onToggleClassic}
          />
        </MotionProvider>
      </ViewerScaler>
    </Viewer3DErrorBoundary>
  );
}

function Viewer3DContent({ classData, gameState, onToggleClassic }: Viewer3DPageProps) {
  const quality = 'high' as const;
  const [hasWebGLError, setHasWebGLError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeModal, setActiveModal] = useState<'improvements' | 'scoreboard' | null>(null);
  const lastAutoOpenedPhaseKeyRef = React.useRef<string | null>(null);

  // Auto-open modals once per phase entry
  useEffect(() => {
    if (!gameState) return;
    const currentPhase = (gameState.currentPhase || 'planning').toLowerCase();
    const round = gameState.currentRound || 1;
    const phaseKey = `${round}_${currentPhase}`;

    if (lastAutoOpenedPhaseKeyRef.current !== phaseKey) {
      lastAutoOpenedPhaseKeyRef.current = phaseKey;

      if (currentPhase === 'improvement' && round <= 4) {
        setActiveModal('improvements');
      } else if (currentPhase === 'scoring') {
        setActiveModal('scoreboard');
      }
    }
  }, [gameState?.currentPhase, gameState?.currentRound]);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Fullscreen toggle ('F' key)
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  // Hook into scene motion events
  const { islandStates, connectorPulses, activeRegionKey } = useSceneEvents(gameState, reducedMotion);

  // If WebGL fails, automatically render classic viewer
  if (hasWebGLError) {
    return <ViewerBoard classData={classData} gameState={gameState} />;
  }

  return (
    <div
      className="relative w-[1920px] h-[1080px] bg-[#dbe6f4] text-slate-900 overflow-hidden font-sans select-none shadow-2xl"
      style={{ width: 1920, height: 1080 }}
    >
      {/* 1. Canvas / 3D Island Art Scene (Behind) */}
      <BoardScene
        islandStates={islandStates}
        connectorPulses={connectorPulses}
        activeRegionKey={activeRegionKey}
        reducedMotion={reducedMotion}
        quality={quality}
        onWebGLError={() => setHasWebGLError(true)}
      />

      {/* 2. Top Bar HUD (Height: 120px) */}
      <TopBar3D
        classData={classData}
        gameState={gameState}
        onToggleClassic={onToggleClassic || (() => {})}
        toggleFullscreen={toggleFullscreen}
        onOpenImprovements={() => setActiveModal('improvements')}
        onOpenScoreboard={() => setActiveModal('scoreboard')}
      />

      {/* 3. Price Ladder Rail (Width: 140px, Left side) */}
      <PriceLadder3D gameState={gameState} />

      {/* 4. DOM Region Info Plates (Positioned via layout.json) */}
      <div className="absolute inset-0 pointer-events-none">
        {Object.entries(LAYOUT_DATA.regions).map(([regionName, regLayout]) => (
          <div key={regionName} className="pointer-events-auto">
            <RegionPlate3D
              regionName={regionName}
              layout={regLayout}
              gameState={gameState}
            />
          </div>
        ))}
      </div>

      {/* 5. Technologies Strip (Height: 150px, Bottom) */}
      <TechStrip3D gameState={gameState} />

      {/* 6. Improvements Modal */}
      <ImprovementModal
        isOpen={activeModal === 'improvements'}
        onClose={() => setActiveModal(null)}
        classData={classData}
        gameState={gameState}
        quality={quality}
        reducedMotion={reducedMotion}
      />

      {/* 7. Scoreboard Modal */}
      <ScoreboardModal
        isOpen={activeModal === 'scoreboard'}
        onClose={() => setActiveModal(null)}
        classData={classData}
        gameState={gameState}
        quality={quality}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}

export default Viewer3DBoard;
