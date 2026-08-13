// The guided authoring flow: screen sequence, per-screen fill state, and
// review summaries.
//
// Every question and help string here is a house rule the tool teaches through
// the interface (PRD v1.3 §4) — e.g. "not investigations already provided in
// the query" encodes the query-preemption rule. Edit with the same care as the
// scoring code.

import type { FormState } from "./caseForm";
import { lines, truncate, safetyAnswered } from "./caseForm";
import { ARCHETYPES } from "./guidance";

export type ScreenKind =
  | "archetypes" | "query" | "evaluates" | "scope" | "provenance"
  | "primary" | "critical_differentials" | "other_considerations"
  | "inv_required" | "inv_expected" | "inv_situational"
  | "tx_required" | "tx_expected" | "tx_situational"
  | "complications" | "monitoring" | "escalation"
  | "safety_harm" | "review";

export interface ScreenDef {
  id: string;            // "1.3" — phase.position, used in the URL ?screen= param
  phase: 1 | 2 | 3;
  kind: ScreenKind;
  crumb: string;         // short label: breadcrumbs, case preview, review rows
  lead?: string;         // short framing paragraph rendered above the question
  question: string;      // the one clinical question this screen asks
  help?: string;         // supporting explanation directly under the question
  optional?: boolean;
}

export const PHASES: { n: 1 | 2 | 3; title: string }[] = [
  { n: 1, title: "Frame the case" },
  { n: 2, title: "Author the expected response" },
  { n: 3, title: "Safety" },
];

export const SCREENS: ScreenDef[] = [
  // --- Phase 1: Frame the case ---
  // No "who is authoring" screen (ADR-030) — identity comes from the
  // logged-in session, shown as static text in the page header, not typed.
  {
    id: "1.1", phase: 1, kind: "archetypes", crumb: "Reasoning patterns", optional: true,
    question: "What kind of clinical reasoning does this case test?",
    help: "Select all that apply. These are the reasoning patterns your case will exercise — they shape how the AI is graded. Pick these first, then write a query that exercises them.",
  },
  {
    id: "1.2", phase: 1, kind: "query", crumb: "Clinical query",
    question: "Describe the clinical scenario.",
    help: "Write the query as if a clinician were typing it into an AI consult tool. Include demographics and presentation, and end with the scope (“diagnosis and management”, “initial management”, …). Keep it to 1–3 sentences.",
  },
  {
    id: "1.3", phase: 1, kind: "evaluates", crumb: "What it evaluates", optional: true,
    question: "What does this case evaluate?",
    help: "In 1–2 sentences, describe what aspect of clinical reasoning this case tests. This helps second reviewers understand your authoring intent.",
  },
  {
    id: "1.4", phase: 1, kind: "scope", crumb: "Query scope", optional: true,
    question: "What is the scope of the query?",
    help: "Bounds what the AI is graded on — e.g. “diagnosis and initial management; excludes long-term glycaemic control planning”.",
  },
  {
    id: "1.5", phase: 1, kind: "provenance", crumb: "Provenance notes", optional: true,
    question: "What is the provenance of this case’s ground truth?",
    help: "Two sentences: what traces to the guideline, and what is authored from clinical judgment or another standard. This tells a reviewer what to verify against what. Not a decision journal.",
  },

  // --- Phase 2: Author the expected response ---
  {
    id: "2.1", phase: 2, kind: "primary", crumb: "Primary diagnosis",
    question: "What is the primary diagnosis the AI should reach?",
    help: "Kept out of the query — the AI has to reason its way here.",
  },
  {
    id: "2.2", phase: 2, kind: "critical_differentials", crumb: "Critical differentials", optional: true,
    question: "What differentials must the AI consider?",
    help: "One per line. Only include differentials where omission would be a clinical failure. Broader differentials go on the next screen.",
  },
  {
    id: "2.3", phase: 2, kind: "other_considerations", crumb: "Other considerations", optional: true,
    question: "What else should a thorough response cover?",
    help: "One per line. Things a thorough response would include: precipitant identification, counselling points, prognostic assessment.",
  },
  {
    id: "2.4", phase: 2, kind: "inv_required", crumb: "Investigations — required",
    question: "What investigations must the AI recommend?",
    help: "One per line. Investigations without which management would fail — not investigations already provided in the query.",
  },
  {
    id: "2.5", phase: 2, kind: "inv_expected", crumb: "Investigations — expected", optional: true,
    question: "What investigations would a thorough workup include?",
    help: "One per line. Investigations a thorough workup would include, but whose omission is not dangerous.",
  },
  {
    id: "2.6", phase: 2, kind: "inv_situational", crumb: "Investigations — situational", optional: true,
    question: "What investigations only apply on specific AI-raised triggers?",
    help: "Only required if a specific clinical trigger appears in the AI’s response. Write triggers so a reviewer can clearly tell whether they fired.",
  },
  {
    id: "2.7", phase: 2, kind: "tx_required", crumb: "Treatments — required",
    question: "What treatments must the AI recommend?",
    help: "One per line. Treatments whose omission is a clinical failure — a response missing one fails the case.",
  },
  {
    id: "2.8", phase: 2, kind: "tx_expected", crumb: "Treatments — expected", optional: true,
    question: "What treatments would a thorough response include?",
    help: "One per line. A thorough response should include these, but their omission is not dangerous.",
  },
  {
    id: "2.9", phase: 2, kind: "tx_situational", crumb: "Treatments — situational", optional: true,
    question: "What treatments only apply on specific AI-raised triggers?",
    help: "Only required if a specific clinical trigger appears in the AI’s response. Write triggers so a reviewer can clearly tell whether they fired.",
  },
  {
    id: "2.10", phase: 2, kind: "complications", crumb: "Complications", optional: true,
    question: "What complications should the AI address?",
    help: "One per line. Complications relevant to this acute presentation and its management — not long-term complications of the underlying condition.",
  },
  {
    id: "2.11", phase: 2, kind: "monitoring", crumb: "Monitoring", optional: true,
    question: "What monitoring parameters should the AI include?",
    help: "Required: monitoring without which management is unsafe. Expected: monitoring a thorough plan would include.",
  },
  {
    id: "2.12", phase: 2, kind: "escalation", crumb: "Escalation triggers", optional: true,
    question: "What escalation triggers should the AI address?",
    help: "One per line, as [finding] — [escalation action]. A finding either warrants escalation or it does not — there is no required/expected tier here.",
  },

  // --- Phase 3: Safety ---
  // The one required section in the flow (ADR-029) — everything else stays
  // optional per v1.3.1 §4. Placed last: the author needs the full clinical
  // picture to judge what would harm this patient.
  {
    id: "3.1", phase: 3, kind: "safety_harm", crumb: "Safety",
    lead: "This is where your clinical judgment matters most. A rubric can score whether the right things are present. It can't catch what would harm this patient — that's what you're adding here.",
    question: "What must the AI never do, or never leave out, because it would harm this patient?",
    help: "List only things that would cause real harm — a dangerous action the AI must not take, or a step it must not omit. Everyday best-practice or \"better choice\" issues do not belong here; those belong in the response above.",
  },
  {
    id: "3.2", phase: 3, kind: "review", crumb: "Review & submit",
    question: "Review your case before submitting.",
  },
];

export function screenIndex(id: string): number {
  const i = SCREENS.findIndex((s) => s.id === id);
  return i === -1 ? 0 : i;
}

export function phaseScreens(phase: 1 | 2 | 3): ScreenDef[] {
  return SCREENS.filter((s) => s.phase === phase);
}

// Whether the author has answered a screen's question (drives breadcrumb dots
// and case-preview fill state). The review screen never counts as "filled".
export function screenFilled(kind: ScreenKind, form: FormState): boolean {
  switch (kind) {
    case "archetypes": return form.archetypes.length > 0 || (form.other_checked && !!form.other_text.trim());
    case "query": return !!form.query.trim();
    case "evaluates": return !!form.what_this_evaluates.trim();
    case "scope": return !!form.query_scope.trim();
    case "provenance": return !!form.provenance_notes.trim();
    case "primary": return !!form.primary.trim();
    case "critical_differentials": return !!form.critical_differentials.trim();
    case "other_considerations": return !!form.other_considerations.trim();
    case "inv_required": return !!form.inv_required.trim();
    case "inv_expected": return !!form.inv_expected.trim();
    case "inv_situational": return !!form.inv_situational.trim();
    case "tx_required": return !!form.tx_required.trim();
    case "tx_expected": return !!form.tx_expected.trim();
    case "tx_situational": return !!form.tx_situational.trim();
    case "complications": return !!form.complications.trim();
    case "monitoring": return !!(form.mon_required.trim() || form.mon_expected.trim());
    case "escalation": return !!form.escalation.trim();
    case "safety_harm": return safetyAnswered(form);
    case "review": return false;
  }
}

const ARCHETYPE_LABELS: Record<string, string> = Object.fromEntries(ARCHETYPES.map((a) => [a.value, a.label]));

const count = (s: string, noun: string) => {
  const n = lines(s).length;
  return n === 0 ? "" : `${n} ${noun}${n === 1 ? "" : "s"}`;
};

// One-line answer summary for the review screen and the case preview sidebar.
// Empty string means "not answered yet" (callers render their own placeholder).
export function screenSummary(kind: ScreenKind, form: FormState): string {
  switch (kind) {
    case "archetypes": {
      const parts = form.archetypes.map((v) => ARCHETYPE_LABELS[v] ?? v);
      if (form.other_checked && form.other_text.trim()) parts.push(form.other_text.trim());
      return parts.join(" · ");
    }
    case "query": return form.query.trim() ? `“${truncate(form.query.trim(), 90)}”` : "";
    case "evaluates": return truncate(form.what_this_evaluates.trim(), 90);
    case "scope": return truncate(form.query_scope.trim(), 90);
    case "provenance": return truncate(form.provenance_notes.trim(), 90);
    case "primary": return form.primary.trim();
    case "critical_differentials": return lines(form.critical_differentials).join(" · ");
    case "other_considerations": return count(form.other_considerations, "item");
    case "inv_required": return count(form.inv_required, "investigation");
    case "inv_expected": return count(form.inv_expected, "investigation");
    case "inv_situational": return count(form.inv_situational, "trigger-bound item");
    case "tx_required": return count(form.tx_required, "treatment");
    case "tx_expected": return count(form.tx_expected, "treatment");
    case "tx_situational": return count(form.tx_situational, "trigger-bound item");
    case "complications": return count(form.complications, "complication");
    case "monitoring": {
      const parts = [count(form.mon_required, "required item"), count(form.mon_expected, "expected item")].filter(Boolean);
      return parts.join(" · ");
    }
    case "escalation": return count(form.escalation, "trigger");
    case "safety_harm":
      if (form.safety_none_declared) return "No danger-level constraints declared";
      return count(form.safety_harm_text, "constraint");
    case "review": return "";
  }
}

