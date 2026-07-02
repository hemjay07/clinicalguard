// Shared authoring form model. One FormState drives both the guided flow and
// the full form view — edits in either are the same state, so they never
// diverge. toPayload maps the editable strings into the API payload;
// validateCase mirrors the server's structural checks and tags each issue with
// the guided-flow screen that fixes it.

import type { EvalCasePayload, SituationalItem, ConditionRef } from "./types";

export interface FormState {
  authored_by: string;
  query: string;
  what_this_evaluates: string;
  query_scope: string;
  provenance_notes: string;
  primary: string;
  critical_differentials: string;
  other_considerations: string;
  inv_required: string; inv_expected: string; inv_situational: string;
  tx_required: string; tx_expected: string; tx_situational: string;
  complications: string;
  mon_required: string; mon_expected: string;
  esc_required: string; esc_expected: string;
  selected_rule_ids: number[];
  safety_free_text: string;
  archetypes: string[];
  other_checked: boolean;
  other_text: string;
}

export const EMPTY: FormState = {
  authored_by: "", query: "", what_this_evaluates: "", query_scope: "", provenance_notes: "",
  primary: "", critical_differentials: "", other_considerations: "",
  inv_required: "", inv_expected: "", inv_situational: "",
  tx_required: "", tx_expected: "", tx_situational: "",
  complications: "", mon_required: "", mon_expected: "",
  esc_required: "", esc_expected: "", selected_rule_ids: [], safety_free_text: "",
  archetypes: [], other_checked: false, other_text: "",
};

export const lines = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);
export const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

export function parseSituational(s: string): SituationalItem[] {
  return lines(s).map((line) => {
    const m = line.split(/\s*[—-]\s*trigger:\s*/i);
    if (m.length >= 2) return { item: m[0].trim(), trigger: m.slice(1).join(" ").trim() };
    return { item: line, trigger: "" };
  });
}

export function toPayload(f: FormState, conditions: ConditionRef[]): EvalCasePayload {
  return {
    conditions,
    authored_by: f.authored_by.trim(),
    query: f.query.trim(),
    what_this_evaluates: f.what_this_evaluates.trim(),
    query_scope: f.query_scope.trim(),
    provenance_notes: f.provenance_notes.trim(),
    diagnoses: { primary: f.primary.trim(), critical_differentials: lines(f.critical_differentials), other_considerations: lines(f.other_considerations) },
    investigations: { required: lines(f.inv_required), expected: lines(f.inv_expected), situational: parseSituational(f.inv_situational) },
    treatments: { required: lines(f.tx_required), expected: lines(f.tx_expected), situational: parseSituational(f.tx_situational) },
    complications: lines(f.complications),
    monitoring: { required_elements: lines(f.mon_required), expected_elements: lines(f.mon_expected) },
    escalation: { required: lines(f.esc_required), expected: lines(f.esc_expected) },
    safety: { selected_rule_ids: f.selected_rule_ids, free_text: lines(f.safety_free_text) },
    reasoning_archetypes: f.archetypes,
    other_archetypes: f.other_checked && f.other_text.trim() ? [f.other_text.trim()] : [],
  };
}

// A validation issue knows which guided-flow screen fixes it, so the review
// screen can offer a direct jump. screenId is null for server-side errors that
// don't map to one screen.
export interface ValidationIssue {
  message: string;
  screenId: string | null;
}

export function validateCase(p: EvalCasePayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!p.authored_by) issues.push({ message: "Your name (authored by) is required.", screenId: "1.1" });
  if (!p.query) issues.push({ message: "Clinical query is required.", screenId: "1.3" });
  if (!p.diagnoses.primary) issues.push({ message: "Expected primary diagnosis is required.", screenId: "2.1" });
  if (p.investigations.required.length === 0 && p.treatments.required.length === 0)
    issues.push({ message: "At least one required investigation or one required treatment is needed.", screenId: "2.4" });
  for (const s of p.investigations.situational)
    if (!s.trigger) issues.push({ message: `Situational investigation "${s.item}" is missing a trigger (use: item — trigger: …).`, screenId: "2.6" });
  for (const s of p.treatments.situational)
    if (!s.trigger) issues.push({ message: `Situational treatment "${s.item}" is missing a trigger (use: item — trigger: …).`, screenId: "2.9" });
  return issues;
}

// Verified safety rule as flattened for the authoring UI (deduped across the
// selected conditions).
export interface RuleInfo {
  id: number;
  severity: string;
  description: string;
  source: string | null;
}
