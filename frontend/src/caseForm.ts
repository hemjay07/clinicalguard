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
  escalation: string;
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
  escalation: "", selected_rule_ids: [], safety_free_text: "",
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
    escalation: lines(f.escalation),
    safety: { selected_rule_ids: f.selected_rule_ids, free_text: lines(f.safety_free_text) },
    reasoning_archetypes: f.archetypes,
    other_archetypes: f.other_checked && f.other_text.trim() ? [f.other_text.trim()] : [],
  };
}

// A validation issue knows which guided-flow screen fixes it, so the review
// screen can offer a direct jump. screenId is null for server-side errors that
// don't map to one screen.
//
// No field is required at submission (v1.3.1 §4): the author decides what a
// case needs, the tool does not enforce. Issues now only carry server-side
// errors (e.g. unknown condition); there is no client-side gating.
export interface ValidationIssue {
  message: string;
  screenId: string | null;
}

// Verified safety rule as flattened for the authoring UI (deduped across the
// selected conditions).
export interface RuleInfo {
  id: number;
  severity: string;
  description: string;
  source: string | null;
}
