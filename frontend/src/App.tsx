import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { warmUpApi } from "./api/client";
import { AuthProvider, useAuth } from "./AuthContext";
import { NavBar } from "./components/NavBar";
import { Home } from "./pages/Home";
import { Conditions } from "./pages/Conditions";
import { ConditionDetail } from "./pages/ConditionDetail";
import { SafetyRules } from "./pages/SafetyRules";
import { ConditionPicker } from "./pages/ConditionPicker";
import { Authoring } from "./pages/Authoring";
import { Login } from "./pages/Login";
import { Cases } from "./pages/Cases";
import { CaseDetail } from "./pages/CaseDetail";
import { EvalDashboard } from "./pages/EvalDashboard";
import { Methodology } from "./pages/Methodology";
import { Spinner, PageContainer } from "./components/ui";

// Authoring and case editing are the only auth-gated routes (ADR-030) —
// browsing the corpus/conditions/safety rules stays open.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageContainer><Spinner /></PageContainer>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  // Start waking the free-tier backend the moment any page loads, so it's
  // usually warm by the time the user reaches a data page.
  useEffect(() => { warmUpApi(); }, []);
  return (
    <div className="min-h-screen">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/author" element={<RequireAuth><ConditionPicker /></RequireAuth>} />
          <Route path="/author/compose" element={<RequireAuth><Authoring /></RequireAuth>} />
          <Route path="/conditions" element={<Conditions />} />
          <Route path="/conditions/:conditionId" element={<ConditionDetail />} />
          <Route path="/safety-rules" element={<SafetyRules />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/:caseId" element={<CaseDetail />} />
          <Route path="/cases/:caseId/edit" element={<RequireAuth><Authoring /></RequireAuth>} />
          <Route path="/eval-dashboard" element={<EvalDashboard />} />
          <Route path="/methodology" element={<Methodology />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
