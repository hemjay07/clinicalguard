// The one place a field is named for an author. The review screen, the case
// page, the thank-you line and the full form all read from here, so a field
// cannot be called three different things on three surfaces — which is what
// physician testers kept tripping over.
//
// Register (v1.6): the author works in clinical terms. "Query" is a scenario,
// "ground truth" is the answer, "provenance" is where the answer comes from,
// "reasoning patterns" are what the case should catch, and nothing is
// "graded" or "scored" — it is checked. The sweep deliberately stops at the
// "?" help modals and at non-author-facing pages, which keep the framework's
// own vocabulary.

import type { ScreenKind } from "./flow";

export const LABELS: Record<Exclude<ScreenKind, "review">, string> = {
  archetypes: "What the case should catch",
  query: "Clinical scenario",
  evaluates: "What it tests",
  scope: "How far the answer should go",
  provenance: "Where the answer comes from",
  primary: "Primary diagnosis",
  critical_differentials: "Differentials the AI must consider",
  other_considerations: "Other considerations",
  inv_required: "Investigations the AI must recommend",
  inv_expected: "Expected investigations",
  inv_situational: "Situational investigations",
  tx_required: "Treatments the AI must recommend",
  tx_expected: "Expected treatments",
  tx_situational: "Situational treatments",
  complications: "Complications",
  monitoring: "Monitoring",
  escalation: "Escalation triggers",
  safety_harm: "What would harm this patient",
};

export const labelFor = (kind: ScreenKind): string =>
  kind === "review" ? "Review" : LABELS[kind];
