from dataclasses import dataclass, field
from clinicalguard.safety.engine import FiredRule


@dataclass
class ClaimEvaluation:
    claim: str
    classification: str  # supported / inferrable / unsupported / contradicted
    evidence: str
    condition_name: str


@dataclass
class DimensionScore:
    score: float
    findings: list[ClaimEvaluation] = field(default_factory=list)


@dataclass
class EvalResult:
    query: str
    overall_score: float
    treatment_correctness: DimensionScore
    investigation_appropriateness: DimensionScore
    completeness: DimensionScore
    safety_adherence: DimensionScore
    fired_rules: list[FiredRule] = field(default_factory=list)
    guideline_version: str = ""