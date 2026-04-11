from datetime import datetime
from pydantic import BaseModel


class Citation(BaseModel):
    source: str
    country: str
    condition_slug: str


class SafetyFlag(BaseModel):
    rule_type: str
    description: str
    severity: str
    verified: bool


class TreatmentDetail(BaseModel):
    goals: list[str]
    non_drug: list[str]
    drug_instructions: list[str]
    adverse_reactions: list[str]


class DifferentialResult(BaseModel):
    condition_name: str
    condition_id: int
    relevance_score: float
    citation: Citation
    investigations: list[str]
    treatment: TreatmentDetail
    complications: list[str]
    prevention: list[str]
    safety_flags: list[SafetyFlag]


class CDSResponse(BaseModel):
    query: str
    retrieved_at: datetime
    differentials: list[DifferentialResult]
    safety_rules_fired: int
    guideline_version: str