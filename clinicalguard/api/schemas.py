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
    required_principle: str = ""
    required_elements: list[str] = Field(default_factory=list)
    expected_elements: list[str] = Field(default_factory=list)


class Escalation(BaseModel):
    required: list[str] = Field(default_factory=list)
    expected: list[str] = Field(default_factory=list)


class SafetyFlags(BaseModel):
    selected_rule_ids: list[int] = Field(default_factory=list)
    free_text: list[str] = Field(default_factory=list)


class EvalCaseCreate(BaseModel):
    condition_id: int
    subtype: Optional[str] = None
    authored_by: str
    query: str
    what_this_evaluates: str = ""
    query_scope: str = ""
    diagnoses: Diagnoses = Field(default_factory=Diagnoses)
    investigations: TierGroup = Field(default_factory=TierGroup)
    treatments: TierGroup = Field(default_factory=TierGroup)
    complications: list[str] = Field(default_factory=list)
    monitoring: Monitoring = Field(default_factory=Monitoring)
    escalation: Escalation = Field(default_factory=Escalation)
    safety: SafetyFlags = Field(default_factory=SafetyFlags)


# --- responses ----------------------------------------------------------------

class EvalCaseCreated(BaseModel):
    id: int
    case_id: str
    warnings: list[str] = Field(default_factory=list)
