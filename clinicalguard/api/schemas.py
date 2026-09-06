"""
Pydantic request/response schemas for the ClinicalGuard API.

The POST /eval-cases body is the structurally important one: it defines the
contract the authoring UI produces. The form sends a clean, uniform payload
(situational items as {item, trigger} for both investigations and treatments);
the endpoint maps it into the richer nstg_derived-style JSON stored in
eval_cases.expected_response (see build_expected_response in routers/eval_cases.py).
"""

from typing import Optional

from pydantic import BaseModel, Field


# --- POST /eval-cases request -------------------------------------------------

class SituationalItem(BaseModel):
    item: str
    trigger: str


class TierGroup(BaseModel):
    required: list[str] = Field(default_factory=list)
    expected: list[str] = Field(default_factory=list)
    situational: list[SituationalItem] = Field(default_factory=list)


class Diagnoses(BaseModel):
    primary: str = ""
    critical_differentials: list[str] = Field(default_factory=list)
    other_considerations: list[str] = Field(default_factory=list)


class Monitoring(BaseModel):
    required_elements: list[str] = Field(default_factory=list)
    expected_elements: list[str] = Field(default_factory=list)


# Escalation is deliberately flat (ADR-028): a finding either warrants
# escalation or it does not — "expected escalation" is not a meaningful tier.


# v1.4: the author answers a single harm question (ADR-029) — no rule
# selection. `free_text` holds the danger-level constraints the author wrote;
# `none_declared` is the explicit "I considered harm and there is none"
# escape, distinct from an unanswered section. Exactly one of
# (free_text non-empty, none_declared) must hold — enforced in
# routers/eval_cases.py, the one deliberate exception to v1.3.1's
# "nothing is required at submission."
class SafetyFlags(BaseModel):
    free_text: list[str] = Field(default_factory=list)
    none_declared: bool = False


class ConditionRef(BaseModel):
    """One condition the case references, with its own optional subtype.
    A case may span multiple conditions (eval_cases.condition_ids is a JSON array)."""
    condition_id: int
    subtype: Optional[str] = None


class EvalCaseCreate(BaseModel):
    # The draft this case was written in, if any. Sent so a successful submit
    # can retire it server-side (ADR-034) — the author should not have to go
    # and discard the draft of a case they have already submitted.
    draft_id: Optional[str] = None
    # A case references one or more conditions; each carries its own subtype.
    conditions: list[ConditionRef] = Field(default_factory=list)
    # No authored_by field (ADR-030): identity comes from the authenticated
    # session (Depends(get_current_user)) in the router, never the client body.
    query: str
    what_this_evaluates: str = ""
    query_scope: str = ""
    # Graduated-provenance transparency: what parts of the ground truth are
    # guideline-grounded vs authored from clinical judgment (ADR-026).
    provenance_notes: str = ""
    # Case-level provenance tier (ADR-033): how much of the answer NSTG
    # covers. Required at submission; when it says another source or the
    # author's own judgment carried part of the answer, provenance_notes must
    # say which parts. Enforced in routers/eval_cases.py alongside the safety
    # check, not here, so both surface as the same structured error shape.
    guideline_provenance: Optional[str] = None
    diagnoses: Diagnoses = Field(default_factory=Diagnoses)
    investigations: TierGroup = Field(default_factory=TierGroup)
    treatments: TierGroup = Field(default_factory=TierGroup)
    complications: list[str] = Field(default_factory=list)
    monitoring: Monitoring = Field(default_factory=Monitoring)
    escalation: list[str] = Field(default_factory=list)
    safety: SafetyFlags = Field(default_factory=SafetyFlags)
    # Reasoning-pattern archetypes the case exercises (descriptive metadata, not
    # prescriptive). Canonical snake_case enums plus free-form "other" entries.
    reasoning_archetypes: list[str] = Field(default_factory=list)
    other_archetypes: list[str] = Field(default_factory=list)


# --- responses ----------------------------------------------------------------

class EvalCaseCreated(BaseModel):
    id: int
    case_id: str
    warnings: list[str] = Field(default_factory=list)
