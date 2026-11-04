import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameBoardState } from '@/hooks/useGameBoardState';
import { useGame } from '@/contexts/GameContext';
import { useSession } from '@/contexts/SessionContext';
import { ViewerScaler } from './ViewerScaler';
import { TopBar } from './TopBar';
import { PriceLadder } from './PriceLadder';
import { RegionLayer } from './RegionLayer';
import { TechPanel } from './TechPanel';
import { ImprovementStrip } from './ImprovementStrip';
import { MotionProvider, useMotion } from './motion/MotionContext';
import { Viewer3DBoard } from '../Viewer3D/Viewer3DPage';
import { cn } from '@/lib/utils';
import { useApplyGameThemeAttribute } from '@/lib/gameTheme';
import './viewer.css';
import { Maximize2, Monitor, Sparkles } from 'lucide-react';

export function ViewerRouter({ classData, gameState }: { classData: any; gameState: any }) {
  useApplyGameThemeAttribute(gameState?.themeId ?? classData?.themeId);
  const [mode, setMode] = useState<'classic' | '3d'>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('viewer') === '3d') {
      return '3d';
    }
    const saved = localStorage.getItem('evalu8smart_viewer_mode');
    if (saved === '3d') {
      return '3d';
    }
    return 'classic';
  });

  const switchMode = (newMode: 'classic' | '3d') => {
    setMode(newMode);
    localStorage.setItem('evalu8smart_viewer_mode', newMode);
    const url = new URL(window.location.href);
    if (newMode === '3d') {
      url.searchParams.set('viewer', '3d');
    } else {
      url.searchParams.delete('viewer');
    }
    window.history.replaceState({}, '', url.toString());
  };

  if (mode === '3d') {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950">
        <Viewer3DBoard
          classData={classData}
          gameState={gameState}
          onToggleClassic={() => switchMode('classic')}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950">
      <ViewerBoard
        classData={classData}
        gameState={gameState}
        onToggle3D={() => switchMode('3d')}
      />
    </div>
  );
}

export function ViewerBoard({
  classData,
  gameState,
  onToggle3D,
}: {
  classData: any;
  gameState: any;
  onToggle3D?: () => void;
}) {
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ViewerScaler>
      <MotionProvider gameState={gameState}>
        <BoardContent
          classData={classData}
          gameState={gameState}
          toggleFullscreen={toggleFullscreen}
          onToggle3D={onToggle3D}
        />
      </MotionProvider>
    </ViewerScaler>
  );
}

export function DemoViewerPage() {
  const { gameState } = useGame();
  const { activeClass } = useSession();

  const classData = activeClass || { id: 'demo', name: 'Solo Demo Game', code: 'DEMO', facilitatorCode: '' };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-lg font-bold">Loading Demo Board...</p>
      </div>
    );
  }

  return <ViewerRouter classData={classData} gameState={gameState} />;
}

export function LiveViewerPage() {
  const { classCode } = useParams<{ classCode: string }>();
  const { classData, gameState, loading, error } = useGameBoardState(classCode || '');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <p className="text-lg font-semibold animate-pulse text-purple-700">Loading Digital Board...</p>
      </div>
    );
  }

  if (error || !classData || !gameState) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mb-2">
          <Monitor className="w-8 h-8 text-purple-600" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{classData?.name || 'Evalu8smart Board'}</h1>
        <p className="text-lg text-slate-600 max-w-md">{error || 'Waiting for game to start…'}</p>
        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-2">Access Code: {classCode?.toUpperCase()}</p>
      </div>
    );
  }

  return <ViewerRouter classData={classData} gameState={gameState} />;
}

export default function ViewerPage() {
  const isDemoPath = window.location.pathname.startsWith('/demo');
  if (isDemoPath) {
    return <DemoViewerPage />;
  }
  return <LiveViewerPage />;
}

interface BoardContentProps {
  classData: any;
  gameState: any;
  toggleFullscreen: () => void;
  onToggle3D?: () => void;
}

function BoardContent({ classData, gameState, toggleFullscreen, onToggle3D }: BoardContentProps) {
  const m = useMotion();

  return (
    <div 
      className="relative w-[1920px] h-[1080px] viewer-board-bg text-slate-900 overflow-hidden font-sans select-none border border-slate-300 shadow-2xl mo-board"
      data-spotlight={m.spotlight ? 'on' : undefined}
    >
      {/* Solid Very Light Grey Background behind regions */}
      <div className="absolute inset-0 viewer-board-bg pointer-events-none" />

      {/* Top Bar (Height: 120px) */}
      <TopBar classData={classData} gameState={gameState} />

      {/* Main Board Section (Between TopBar 120px and Bottom Research Strip 150px) */}
      <div className={cn("absolute top-[120px] bottom-[150px] left-0 right-0 transition-all duration-700", m.settling && "mo-settle")}>
        {/* Price Ladder Left Rail (Width: 140px) */}
        <PriceLadder gameState={gameState} />

        {/* Geographical Region Layer */}
        <RegionLayer gameState={gameState} />

        {/* Improvements Marketplace Right Panel (Width: 300px) */}
        <ImprovementStrip gameState={gameState} />
      </div>

      {/* Research & Development Technologies Bottom Strip (Height: 150px) */}
      <TechPanel gameState={gameState} />

      {/* Top-Right Corner Controls: 2D/3D Viewer Toggle & Fullscreen */}
      <div className="absolute top-1.5 right-6 z-50 flex items-center gap-2">
        {onToggle3D && (
          <button
            onClick={onToggle3D}
            className="bg-indigo-50/95 border border-indigo-300 hover:border-indigo-500 text-indigo-700 hover:text-indigo-900 px-3 py-1 rounded-lg backdrop-blur shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-black"
            title="Switch to 3D Island Board Viewer"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>3D Viewer</span>
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          className="bg-white/95 border border-slate-200 hover:border-slate-400 text-slate-600 hover:text-slate-900 p-1.5 rounded-lg backdrop-blur shadow-sm transition-all active:scale-95 cursor-pointer"
          title="Toggle Fullscreen (F)"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
