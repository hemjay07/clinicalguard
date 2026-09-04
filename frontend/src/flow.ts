// The guided authoring flow: screen sequence, per-screen fill state, and
// review summaries.
//
// Every question and help string here is a house rule the tool teaches through
// the interface (PRD v1.3 §4) — e.g. "not investigations already provided in
// the query" encodes the query-preemption rule. Edit with the same care as the
// scoring code.

import type { FormState } from "./caseForm";
import { lines, truncate, safetyAnswered } from "./caseForm";
import { ARCHETYPES, PROVENANCE_TIERS } from "./guidance";
import { labelFor } from "./labels";

export type ScreenKind =
  | "archetypes" | "query" | "evaluates" | "scope" | "provenance"
  | "primary" | "critical_differentials" | "other_considerations"
  | "inv_required" | "inv_expected" | "inv_situational"
  | "tx_required" | "tx_expected" | "tx_situational"
  | "complications" | "monitoring" | "escalation"
  | "safety_harm" | "review";

export interface ScreenDef {
  // Internal and stable. Drafts, feedback notes and analytics events key on
  // it, so a screen keeps its id even when it moves phase — 1.5 (provenance)
  // is the standing example. The number an author sees is derived from
  // position (see displayNumber), never from this.
  id: string;
  phase: 1 | 2 | 3;
  kind: ScreenKind;
  crumb: string;         // short label: breadcrumbs, case preview, review rows
  lead?: string;         // short framing paragraph rendered above the question
  question: string;      // the one clinical question this screen asks
  help?: string;         // supporting explanation directly under the question
  optional?: boolean;
}

export const PHASES: { n: 1 | 2 | 3; title: string; short: string }[] = [
  // `short` is the phone label: on a narrow screen the full phase titles
  // truncated into noise, and three one-word labels fit.
  { n: 1, title: "Frame the case", short: "Frame" },
  { n: 2, title: "Author the expected response", short: "Answer" },
  { n: 3, title: "Safety", short: "Safety" },
];

export const SCREENS: ScreenDef[] = [
  // --- Phase 1: Frame the case ---
  // No "who is authoring" screen (ADR-030) — identity comes from the
  // logged-in session, shown as static text in the page header, not typed.
  //
  // No lead paragraph on 1.1 either (v1.6): the one-time intro modal carries
  // the orientation now, so the first question is the first thing on screen.
  {
    id: "1.1", phase: 1, kind: "archetypes", crumb: "What the case should catch", optional: true,
    question: "What should a good answer get right that a weak one would miss?",
    help: "Pick everything that applies. You'll write the scenario next.",
  },
  {
    id: "1.2", phase: 1, kind: "query", crumb: "Clinical scenario",
    question: "Describe the clinical scenario.",
    help: "Write it the way a clinician would type it into an AI tool: who the patient is, what they present with, and what you're asking for (diagnosis and management, initial management, …). 1 to 3 sentences.",
  },

  // --- Phase 2: Author the expected response ---
  {
    id: "2.1", phase: 2, kind: "primary", crumb: "Primary diagnosis",
    question: "What is the primary diagnosis the AI should reach?",
    // Rule-bearing (query preemption): the diagnosis must not appear in the
    // query. Stated as an instruction now, not as design rationale.
    help: "Don't name it in the scenario; the AI has to reach it on its own.",
  },
  {
    id: "2.2", phase: 2, kind: "critical_differentials", crumb: "Differentials the AI must consider", optional: true,
    question: "What differentials must the AI consider?",
    help: "One per line. Only differentials where missing one would be a clinical failure. Broader ones can go under Other considerations in the optional section.",
  },
  {
    id: "2.4", phase: 2, kind: "inv_required", crumb: "Investigations the AI must recommend",
    question: "What investigations must the AI recommend?",
    help: "One per line. Investigations without which management would fail, not investigations already given in the scenario.",
  },
  {
    id: "2.7", phase: 2, kind: "tx_required", crumb: "Treatments the AI must recommend",
    question: "What treatments must the AI recommend?",
    help: "One per line. Treatments whose omission is a clinical failure — a response missing one fails the case.",
  },
  // Provenance keeps id 1.5 from when it sat in Phase 1 (ADR-033 moved it
  // here, to the point where the author has just finished the answer and can
  // actually say where it came from). Its id is load-bearing for in-progress
  // drafts and analytics; its phase and displayed position are not.
  {
    id: "1.5", phase: 2, kind: "provenance", crumb: "Where the answer comes from",
    question: "Where did this answer come from?",
    help: "So a reviewer knows what to check against what.",
  },

  // Phase 2, optional — reachable through the "+" step, grouped by §4.6.
  {
    id: "2.5", phase: 2, kind: "inv_expected", crumb: "Expected investigations", optional: true,
    question: "What investigations would a thorough workup include?",
    help: "One per line. Investigations a thorough workup would include, but whose omission is not dangerous.",
  },
  {
    id: "2.8", phase: 2, kind: "tx_expected", crumb: "Expected treatments", optional: true,
    question: "What treatments would a thorough response include?",
    help: "One per line. A thorough response should include these, but their omission is not dangerous.",
  },
  {
    id: "2.6", phase: 2, kind: "inv_situational", crumb: "Situational investigations", optional: true,
    question: "What investigations only apply on specific AI-raised triggers?",
    help: "Only required if a specific clinical trigger appears in the AI's response. Write triggers so a reviewer can clearly tell whether they fired.",
  },
  {
    id: "2.9", phase: 2, kind: "tx_situational", crumb: "Situational treatments", optional: true,
    question: "What treatments only apply on specific AI-raised triggers?",
    help: "Only required if a specific clinical trigger appears in the AI's response. Write triggers so a reviewer can clearly tell whether they fired.",
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
  {
    id: "2.3", phase: 2, kind: "other_considerations", crumb: "Other considerations", optional: true,
    question: "What else should a thorough response cover?",
    help: "One per line. Things a thorough response would include: precipitant identification, counselling points, prognostic assessment.",
  },
  // 1.3 and 1.4 also keep their Phase 1 ids: they describe the case rather
  // than answer it, so v1.6 moved them out of the opening two questions and
  // into "About this case" at the bottom of the optional menu.
  {
    id: "1.3", phase: 2, kind: "evaluates", crumb: "What it tests", optional: true,
    question: "What does this case evaluate?",
    help: "In 1–2 sentences, describe what aspect of clinical reasoning this case tests. This helps second reviewers understand your authoring intent.",
  },
  {
    id: "1.4", phase: 2, kind: "scope", crumb: "How far the answer should go", optional: true,
    question: "What is the scope of the scenario?",
    help: "Bounds what the AI is checked on — e.g. “diagnosis and initial management; excludes long-term glycaemic control planning”.",
  },

  // --- Phase 3: Safety ---
  // The one required section in the flow (ADR-029) — everything else stays
  // optional per v1.3.1 §4, plus provenance (ADR-033). Placed last: the
  // author needs the full clinical picture to judge what would harm this
  // patient.
  {
    id: "3.1", phase: 3, kind: "safety_harm", crumb: "What would harm this patient",
    lead: "This is where your clinical judgment matters most. A marking scheme can check whether the right things are present. It can't catch what would harm this patient. That's what you're adding here.",
    question: "What must the AI never do, or never leave out, because it would harm this patient?",
    help: "List only things that would cause real harm — a dangerous action the AI must not take, or a step it must not omit. Everyday best-practice or \"better choice\" issues do not belong here; those belong in the response above.",
  },
  {
    id: "3.2", phase: 3, kind: "review", crumb: "Review & submit",
    question: "Review your case before submitting.",
  },
];

const BY_ID = new Map(SCREENS.map((s) => [s.id, s]));
export const screenById = (id: string): ScreenDef | undefined => BY_ID.get(id);

// --- the optional menu ---------------------------------------------------------
// D13 sorted screens into a spine the physician walks and enrichment that is
// high value for the corpus but low value for the author in the moment. v1.6
// keeps that split and adds a second one: the enrichment screens are grouped
// into five named things an author can recognise, rather than nine questions
// they have to read. Everything stays one tap away, nothing is removed, and
// every screen keeps its own id so deep links and drafts still resolve.

export interface OptionalGroup {
  key: string;
  title: string;
  blurb?: string;
  screenIds: string[];
}

export const OPTIONAL_GROUPS: OptionalGroup[] = [
  {
    key: "expected",
    title: "Expected items",
    blurb: "Investigations and treatments a good answer would include, where missing one isn't a failure",
    screenIds: ["2.5", "2.8"],
  },
  {
    key: "situational",
    title: "Situational items",
    blurb: "Only apply when a stated condition holds",
    screenIds: ["2.6", "2.9"],
  },
  {
    key: "complications",
    title: "Complications and monitoring",
    screenIds: ["2.10", "2.11"],
  },
  {
    key: "escalation",
    title: "Escalation and other considerations",
    screenIds: ["2.12", "2.3"],
  },
  {
    key: "about",
    title: "About this case",
    blurb: "What it tests, and how far the answer should go",
    screenIds: ["1.3", "1.4"],
  },
];

export const groupScreens = (g: OptionalGroup): ScreenDef[] =>
  g.screenIds.map((id) => BY_ID.get(id)!).filter(Boolean);

const GROUP_OF_SCREEN = new Map<string, OptionalGroup>(
  OPTIONAL_GROUPS.flatMap((g) => g.screenIds.map((id) => [id, g] as const))
);

const OPTIONAL_IDS = new Set(GROUP_OF_SCREEN.keys());

export type Tier = "core" | "enrichment";
export const tierOf = (id: string): Tier => (OPTIONAL_IDS.has(id) ? "enrichment" : "core");

export function screenIndex(id: string): number {
  const i = SCREENS.findIndex((s) => s.id === id);
  return i === -1 ? 0 : i;
}

export function phaseScreens(phase: 1 | 2 | 3): ScreenDef[] {
  return SCREENS.filter((s) => s.phase === phase);
}

export function coreScreens(phase: 1 | 2 | 3): ScreenDef[] {
  return phaseScreens(phase).filter((s) => tierOf(s.id) === "core");
}

export function enrichmentScreens(phase: 1 | 2 | 3): ScreenDef[] {
  return phaseScreens(phase).filter((s) => tierOf(s.id) === "enrichment");
}

// --- the walked sequence -------------------------------------------------------
// What the guided flow actually steps through: each core screen on its own,
// and one grouped "Add more detail" step holding the optional menu. Every
// screen stays reachable — an optional question is two taps inside its group,
// and its ?screen= deep link still resolves (see stepIndexForScreen).

export type FlowStep =
  | { kind: "screen"; id: string; phase: 1 | 2 | 3; screen: ScreenDef }
  | { kind: "enrichment"; id: string; phase: 1 | 2 | 3; groups: OptionalGroup[] };

export const ENRICHMENT_STEP_ID = (phase: number) => `${phase}.more`;

export const FLOW_STEPS: FlowStep[] = (() => {
  const steps: FlowStep[] = [];
  for (const p of PHASES) {
    for (const s of coreScreens(p.n)) {
      steps.push({ kind: "screen", id: s.id, phase: p.n, screen: s });
    }
    if (enrichmentScreens(p.n).length) {
      // Placed at the end of its phase so the core spine reads uninterrupted.
      steps.push({ kind: "enrichment", id: ENRICHMENT_STEP_ID(p.n), phase: p.n, groups: OPTIONAL_GROUPS });
    }
  }
  // Review is authored last: pull it to the very end regardless of tiering.
  const review = steps.findIndex((st) => st.kind === "screen" && st.screen.kind === "review");
  if (review !== -1) steps.push(...steps.splice(review, 1));
  return steps;
})();

export function phaseSteps(phase: 1 | 2 | 3): FlowStep[] {
  return FLOW_STEPS.filter((st) => st.phase === phase);
}

// What the author sees on a pill. Derived from position within the phase, so
// the numbers always read 1 2 3 … with no gaps even though the underlying
// screen ids are stable and out of order (1.5 sits fifth in Phase 2).
export function displayNumber(step: FlowStep): string {
  if (step.kind === "enrichment") return "+";
  return String(phaseSteps(step.phase).indexOf(step) + 1);
}

// Resolve any ?screen= value to a step index. A core screen id maps to its own
// step; an optional screen id maps to the grouped step (the caller opens that
// group). Unknown ids fall back to the first step.
export function stepIndexForScreen(id: string): number {
  const direct = FLOW_STEPS.findIndex((st) => st.id === id);
  if (direct !== -1) return direct;
  const screen = BY_ID.get(id);
  if (screen) {
    const grouped = FLOW_STEPS.findIndex(
      (st) => st.kind === "enrichment" && st.phase === screen.phase
    );
    if (grouped !== -1) return grouped;
  }
  return 0;
}

// True when ?screen= names an optional question: the menu opens with that
// question's group already expanded, so per-question review links still land
// on the field they promised.
export function enrichmentTarget(id: string): OptionalGroup | null {
  return GROUP_OF_SCREEN.get(id) ?? null;
}

export function isValidFlowParam(id: string): boolean {
  return BY_ID.has(id) || FLOW_STEPS.some((st) => st.id === id);
}

// Whether the author has answered a screen's question (drives breadcrumb dots
// and case-preview fill state). The review screen never counts as "filled".
export function screenFilled(kind: ScreenKind, form: FormState): boolean {
  switch (kind) {
    case "archetypes": return form.archetypes.length > 0 || (form.other_checked && !!form.other_text.trim());
    case "query": return !!form.query.trim();
    case "evaluates": return !!form.what_this_evaluates.trim();
    case "scope": return !!form.query_scope.trim();
    // The tier is the answer here; the notes are its follow-up, required only
    // for the two tiers that claim something came from outside NSTG.
    case "provenance": return !!form.guideline_provenance;
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

// Empty optional questions, for the "N optional sections not added" rows on
// the review screen and the one grey line on the thank-you card.
export function emptyOptional(form: FormState, phase?: 1 | 2 | 3): ScreenDef[] {
  return SCREENS.filter(
    (s) => s.optional && s.kind !== "review" && (!phase || s.phase === phase) && !screenFilled(s.kind, form)
  );
}

const ARCHETYPE_PLAIN: Record<string, string> = Object.fromEntries(ARCHETYPES.map((a) => [a.value, a.plain]));
const PROVENANCE_LABELS: Record<string, string> = Object.fromEntries(PROVENANCE_TIERS.map((t) => [t.value, t.label]));

const count = (s: string, noun: string) => {
  const n = lines(s).length;
  return n === 0 ? "" : `${n} ${noun}${n === 1 ? "" : "s"}`;
};

// One-line answer summary for the review screen and the case preview sidebar.
// Empty string means "not answered yet" (callers render their own placeholder).
export function screenSummary(kind: ScreenKind, form: FormState): string {
  switch (kind) {
    case "archetypes": {
      // The plain sentences, never the short archetype names — those exist
      // for the corpus, not for the author (v1.6 §3).
      const parts = form.archetypes.map((v) => ARCHETYPE_PLAIN[v] ?? v);
      if (form.other_checked && form.other_text.trim()) parts.push(form.other_text.trim());
      return parts.join("\n");
    }
    case "query": return form.query.trim() ? `“${truncate(form.query.trim(), 90)}”` : "";
    case "evaluates": return truncate(form.what_this_evaluates.trim(), 90);
    case "scope": return truncate(form.query_scope.trim(), 90);
    case "provenance": {
      if (!form.guideline_provenance) return "";
      const tier = PROVENANCE_LABELS[form.guideline_provenance] ?? form.guideline_provenance;
      const notes = form.provenance_notes.trim();
      return notes ? `${tier} — ${truncate(notes, 70)}` : tier;
    }
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
      if (form.safety_none_declared) return "Nothing rises to that level for this patient";
      return count(form.safety_harm_text, "constraint");
    case "review": return "";
  }
}

// The author-facing name of a screen's field. One map, shared with the case
// page and the full form (see labels.ts).
export const screenLabel = (kind: ScreenKind): string => labelFor(kind);
