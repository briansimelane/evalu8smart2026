import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { GameProvider } from "./contexts/GameContext";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Login } from "./pages/Login";
import { FacilitatorHub } from "./pages/FacilitatorHub";
import { AdminHub } from "./pages/AdminHub";

const queryClient = new QueryClient();

const IndexRedirect = () => {
  const { currentRole, currentClassId } = useSession();

  if (!currentRole) {
    return <Navigate to="/login" replace />;
  }
  if (currentRole === 'ADMIN') {
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

  if (classesLoaded && classId) {
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SessionProvider>
        <GameProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/" element={<IndexRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/facilitator/classes" element={
                <SessionProviderWrapper role="FACILITATOR">
                  <FacilitatorHub />
                </SessionProviderWrapper>
              } />
              <Route path="/admin" element={
                <SessionProviderWrapper role="ADMIN">
                  <AdminHub />
                </SessionProviderWrapper>
              } />
              <Route path="/class/:classId" element={<ClassControl />} />
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </GameProvider>
      </SessionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

const SessionProviderWrapper = ({ children, role }: { children: React.ReactNode; role: string }) => {
  const { currentRole } = useSession();
  if (currentRole !== role) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default App;
