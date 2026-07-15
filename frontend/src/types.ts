// Shared API types. Mirrors the JSON the FastAPI backend returns.

export interface ConditionCounts {
  findings: number;
  investigations: number;
  treatments: number;
  differentials: number;
  complications: number;
  safety_rules: number;
}

export interface ConditionListItem {
  id: number;
  name: string;
  counts: ConditionCounts;
}

export interface ConditionDetails {
  id: number;
  name: string;
  introduction: string | null;
  category: string | null;
  is_emergency: boolean;
  icd10_code: string | null;
  age_group: string | null;
  counts: ConditionCounts & { adverse_reactions: number };
  findings: { text: string; finding_type: string; subtype: string | null; severity_tier: string | null; is_required: boolean }[];
  investigations: { text: string; is_required: boolean }[];
  treatments: { treatment_type: string; drug_name: string | null; dose: string | null; route: string | null; duration: string | null; subtype: string | null; notes: string | null }[];
  differentials: { differential_condition: string; distinguishing_features: string | null }[];
  complications: { complication: string; severity: string | null; subtype: string | null }[];
  adverse_reactions: { reaction: string; severity: string | null }[];
  safety_rules: SafetyRule[];
}

export interface SafetyRule {
  id: number;
  condition_id: number | null;
  condition_name?: string;
  description: string;
  source: string | null;
  is_universal?: boolean;
  is_active: boolean;
  is_verified: boolean;
}

// Deterministic structured source material from extract_skeleton (no LLM).
// The SourcePanel renders this shape directly.
export interface SourceMaterial {
  condition: { id: number; name: string; introduction: string | null; source_field: string };
  scoped_to_subtype: string | null;
  all_available_subtypes: string[];
  findings: { by_subtype: Record<string, string[]>; source_field: string };
  investigations_pool: { items: string[]; source_field: string };
  treatments_pool: { by_type: Record<string, string[]>; source_field: string };
  differentials_pool: { items: string[]; source_field: string };
  complications_pool: { items: string[]; source_field: string };
  safety_signals: {
    adverse_reactions_from_nstg: string[];
    verified_safety_rules: { rule_id: number; description: string; source: string | null }[];
    source_fields: string;
  };
  extraction_metadata: { generated_by: string; step: number; deterministic: boolean; llm_involved: boolean };
}

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
}

export interface EvalCaseListItem {
  id: number;
  case_id: string | null;
  condition_ids: number[];
  condition_names: string[];
  subtype: string | null;
  query: string;
  authored_by: string | null;
  ground_truth_source: string;
  submitted_at: string | null;
}

export interface EvalCaseDetail {
  id: number;
  query: string;
  condition_ids: number[];
  conditions: { id: number; name: string }[];
  ground_truth_source: string;
  source: string;
  dataset_version: string;
  query_scope: string | null;
  is_validated: boolean;
  submitted_at: string | null;
  updated_at: string | null;
  author_user_id: number | null;
  expected_response: any;
}

// --- authoring form payload ---

export interface SituationalItem {
  item: string;
  trigger: string;
}

export interface TierGroup {
  required: string[];
  expected: string[];
  situational: SituationalItem[];
}

export interface ConditionRef {
  condition_id: number;
  subtype: string | null;
}

export interface SelectedCondition extends ConditionRef {
  name: string;
}

export interface EvalCasePayload {
  conditions: ConditionRef[];
  // No authored_by (ADR-030): identity comes from the authenticated session.
  query: string;
  what_this_evaluates: string;
  query_scope: string;
  provenance_notes: string;
  diagnoses: { primary: string; critical_differentials: string[]; other_considerations: string[] };
  investigations: TierGroup;
  treatments: TierGroup;
  complications: string[];
  monitoring: { required_elements: string[]; expected_elements: string[] };
  // Flat by design (ADR-028): a finding either warrants escalation or not.
  escalation: string[];
  safety: { free_text: string[]; none_declared: boolean };
  reasoning_archetypes: string[];
  other_archetypes: string[];
}

export interface CreatedCase {
  id: number;
  case_id: string;
  warnings: string[];
}
