import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import React, { useEffect } from "react";
import { GameProvider } from "./contexts/GameContext";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Login } from "./pages/Login";
import { FacilitatorHub } from "./pages/FacilitatorHub";
import { AdminHub } from "./pages/AdminHub";
import ViewerPage from "./pages/Viewer/ViewerPage";
import MultiWorldControl from "./pages/MultiWorldControl";
import CombinedViewerPage from "./pages/Viewer/CombinedViewerPage";

import { DemoStateProvider, useDemoState } from "./demo/DemoStateProvider";
import { DemoSetup } from "./demo/DemoSetup";

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("App ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="p-4 rounded-full bg-red-950/60 border border-red-500/50 text-red-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">An error occurred loading this session</h2>
          <p className="text-xs text-slate-400 max-w-md font-mono bg-slate-900 p-3 rounded border border-slate-800 text-left overflow-auto">
            {this.state.error?.message || "Unknown rendering error"}
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs"
            >
              Reload Game
            </button>
            <button
              onClick={() => window.location.href = "/facilitator/classes"}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs border border-slate-700"
            >
              Facilitator Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const IndexRedirect = () => {
  const { currentRole, currentClassId } = useSession();

  if (!currentRole) {
    return <Navigate to="/login" replace />;
  }
  if (currentRole === 'ADMIN') {
    if (currentClassId) {
      return <Navigate to={`/class/${currentClassId}`} replace />;
    }
    return <Navigate to="/admin" replace />;
  }
  if (currentRole === 'FACILITATOR') {
    if (currentClassId) {
      return <Navigate to={`/class/${currentClassId}`} replace />;
    }
    return <Navigate to="/facilitator/classes" replace />;
  }
  if (currentRole === 'STUDENT') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

const DemoRouteWrapper = () => {
  const { demoGameState, isLoaded } = useDemoState();
  if (!isLoaded) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">Loading Demo...</div>;
  }
  if (!demoGameState) {
    return <DemoSetup />;
  }
  return <Index />;
};

const ClassControl = () => {
  const { classId } = useParams();
  const { selectClass, currentRole, classes, classesLoaded } = useSession();

  useEffect(() => {
    if (classId) {
      selectClass(classId);
    }
  }, [classId]);

  if (currentRole !== 'FACILITATOR' && currentRole !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  if (classesLoaded && classes.length > 0 && classId) {
    const classExists = classes.some(c => c.id === classId);
    if (!classExists) {
      return <Navigate to={currentRole === 'ADMIN' ? "/admin" : "/facilitator/classes"} replace />;
    }
  }

  return <Index />;
};

const StudentDashboard = () => {
  const { currentRole } = useSession();

  if (currentRole !== 'STUDENT') {
    return <Navigate to="/login" replace />;
  }

  return <Index />;
};

const SessionProviderWrapper = ({ children, roles }: { children: React.ReactNode; roles: string | string[] }) => {
  const { currentRole } = useSession();
  const allowed = Array.isArray(roles) ? roles.includes(currentRole || '') : currentRole === roles;
  if (!allowed) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DemoStateProvider>
          <SessionProvider>
            <GameProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                  <Route path="/" element={<IndexRedirect />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/demo" element={<DemoRouteWrapper />} />
                  <Route path="/demo/viewer" element={<ViewerPage />} />
                  <Route path="/facilitator/classes" element={
                    <SessionProviderWrapper roles={['FACILITATOR', 'ADMIN']}>
                      <FacilitatorHub />
                    </SessionProviderWrapper>
                  } />
                  <Route path="/facilitator/multiworld/:sessionId" element={
                    <SessionProviderWrapper roles={['FACILITATOR', 'ADMIN']}>
                      <MultiWorldControl />
                    </SessionProviderWrapper>
                  } />
                  <Route path="/admin" element={
                    <SessionProviderWrapper roles={['ADMIN']}>
                      <AdminHub />
                    </SessionProviderWrapper>
                  } />
                  <Route path="/class/:classId" element={<ClassControl />} />
                  <Route path="/dashboard" element={<StudentDashboard />} />
                  <Route path="/viewer/multi/:sessionCode" element={<CombinedViewerPage />} />
                  <Route path="/viewer/:classCode" element={<ViewerPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </GameProvider>
          </SessionProvider>
        </DemoStateProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
