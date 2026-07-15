// Shared authoring form model. One FormState drives both the guided flow and
// the full form view — edits in either are the same state, so they never
// diverge. toPayload maps the editable strings into the API payload;
// validateCase mirrors the server's structural checks and tags each issue with
// the guided-flow screen that fixes it.

import type { EvalCasePayload, SituationalItem, ConditionRef, EvalCaseDetail } from "./types";

export interface FormState {
  // No authored_by (ADR-030) — identity comes from the logged-in session.
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
  safety_harm_text: string;
  safety_none_declared: boolean;
  archetypes: string[];
  other_checked: boolean;
  other_text: string;
}

export const EMPTY: FormState = {
  query: "", what_this_evaluates: "", query_scope: "", provenance_notes: "",
  primary: "", critical_differentials: "", other_considerations: "",
  inv_required: "", inv_expected: "", inv_situational: "",
  tx_required: "", tx_expected: "", tx_situational: "",
  complications: "", mon_required: "", mon_expected: "",
  escalation: "", safety_harm_text: "", safety_none_declared: false,
  archetypes: [], other_checked: false, other_text: "",
};

export const lines = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);
export const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

// Exactly one of (constraints listed, none declared) must hold — the one
// deliberate exception to v1.3.1's "nothing is required at submission"
// (ADR-029). Both empty (skipped) and both filled (contradictory) are
// invalid; only these two states count as a resolved answer.
export function safetyAnswered(f: FormState): boolean {
  const hasText = lines(f.safety_harm_text).length > 0;
  return hasText !== f.safety_none_declared;
}

// Quiet copy for the one required section — shown inline on the safety
// screen (not a red server-error box) and reused as the server-error message
// if the check is somehow bypassed client-side.
export const SAFETY_PROMPT = "Answer the safety question to finish — either list the dangers, or confirm there are none.";

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
    safety: { free_text: lines(f.safety_harm_text), none_declared: f.safety_none_declared },
    reasoning_archetypes: f.archetypes,
    other_archetypes: f.other_checked && f.other_text.trim() ? [f.other_text.trim()] : [],
  };
}

// Inverse of parseSituational, for prefilling the edit form from a stored case.
function formatSituational(items: SituationalItem[]): string {
  return items.map((s) => (s.trigger ? `${s.item} — trigger: ${s.trigger}` : s.item)).join("\n");
}

// Prefills a FormState from a previously-submitted case's expected_response
// blob, for the edit flow (case editing reuses the authoring form — the
// point of building the safety redesign first). Inverse of toPayload.
export function fromExpectedResponse(detail: EvalCaseDetail): FormState {
  const e = detail.expected_response ?? {};
  const diag = e.expected_diagnoses ?? {};
  const inv = e.required_investigations ?? {};
  const tx = e.required_treatments ?? {};
  const mon = e.required_monitoring ?? {};
  const safety = e.required_safety_flags ?? {};
  const otherArchetypes: string[] = e.other_archetypes ?? [];

  return {
    ...EMPTY,
    query: e.query ?? detail.query ?? "",
    what_this_evaluates: e.what_this_evaluates ?? "",
    query_scope: e.query_scope ?? detail.query_scope ?? "",
    provenance_notes: e.provenance_notes ?? "",
    primary: diag.required?.primary ?? "",
    critical_differentials: (diag.required?.critical_differentials ?? []).join("\n"),
    other_considerations: (diag.expected?.other_considerations ?? []).join("\n"),
    inv_required: (inv.required ?? []).join("\n"),
    inv_expected: (inv.expected ?? []).join("\n"),
    inv_situational: formatSituational(
      (inv.situational ?? []).map((s: { test: string; trigger: string }) => ({ item: s.test, trigger: s.trigger }))
    ),
    tx_required: (tx.required ?? []).join("\n"),
    tx_expected: (tx.expected ?? []).join("\n"),
    tx_situational: formatSituational(
      (tx.situational ?? []).map((s: { treatment: string; trigger: string }) => ({ item: s.treatment, trigger: s.trigger }))
    ),
    complications: (e.complications ?? []).join("\n"),
    mon_required: (mon.required_elements ?? []).join("\n"),
    mon_expected: (mon.expected_elements ?? []).join("\n"),
    escalation: (e.escalation_triggers ?? []).join("\n"),
    safety_harm_text: (safety.free_text ?? []).join("\n"),
    safety_none_declared: !!safety.none_declared,
    archetypes: e.reasoning_archetypes ?? [],
    other_checked: otherArchetypes.length > 0,
    other_text: otherArchetypes[0] ?? "",
  };
}

// A validation issue knows which guided-flow screen fixes it, so the review
// screen (or a per-screen inline prompt) can offer a direct jump. screenId is
// null for server-side errors that don't map to one screen.
//
// No field is required at submission (v1.3.1 §4) except safety (ADR-029, the
// one deliberate exception — see safetyAnswered above).
export interface ValidationIssue {
  message: string;
  screenId: string | null;
}
