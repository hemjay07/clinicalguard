import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { warmUpApi } from "./api/client";
import { NavBar } from "./components/NavBar";
import { Home } from "./pages/Home";
import { Conditions } from "./pages/Conditions";
import { ConditionDetail } from "./pages/ConditionDetail";
import { SafetyRules } from "./pages/SafetyRules";
import { ConditionPicker } from "./pages/ConditionPicker";
import { Authoring } from "./pages/Authoring";
import { Cases } from "./pages/Cases";
import { CaseDetail } from "./pages/CaseDetail";
import { EvalDashboard } from "./pages/EvalDashboard";
import { Methodology } from "./pages/Methodology";

export default function App() {
  // Start waking the free-tier backend the moment any page loads, so it's
  // usually warm by the time the user reaches a data page.
  useEffect(() => { warmUpApi(); }, []);
  return (
    <div className="min-h-screen">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/author" element={<ConditionPicker />} />
          <Route path="/author/compose" element={<Authoring />} />
          <Route path="/conditions" element={<Conditions />} />
          <Route path="/conditions/:conditionId" element={<ConditionDetail />} />
          <Route path="/safety-rules" element={<SafetyRules />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/:caseId" element={<CaseDetail />} />
          <Route path="/eval-dashboard" element={<EvalDashboard />} />
          <Route path="/methodology" element={<Methodology />} />
        </Routes>
      </main>
    </div>
  );
}
