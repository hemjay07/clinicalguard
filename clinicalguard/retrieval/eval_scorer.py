import json
import logging
from datetime import datetime

from openai import OpenAI
from sqlalchemy.orm import Session

from clinicalguard.config import settings
from clinicalguard.db.models import Condition, ConditionInvestigation, ConditionTreatment, GuidelineDataset
from clinicalguard.models.cds import CDSResponse
from clinicalguard.models.eval import ClaimEvaluation, DimensionScore, EvalResult
from clinicalguard.safety.engine import run_safety_check

logger = logging.getLogger(__name__)
client = OpenAI(api_key=str(settings.openai_api_key))
SCORING_VERSION = "2.0-required-expected-split"


def build_ground_truth_context(cds_response: CDSResponse) -> str:
    # Converts the structured CDS response into a flat text block for the
    # LLM evaluator. The LLM cannot query the database directly, so we
    # extract the most evaluation-relevant fields: treatments, investigations,
    # goals, and complications. Capped at 5 items per field to keep the
    # prompt within a reasonable token budget while covering the critical content.
    lines = []
    for diff in cds_response.differentials:
        lines.append(f"\nCondition: {diff.condition_name}")
        if diff.treatment.drug_instructions:
            lines.append("Drug treatments: " + "; ".join(diff.treatment.drug_instructions[:5]))
        if diff.treatment.non_drug:
            lines.append("Non-drug treatments: " + "; ".join(diff.treatment.non_drug[:3]))
        if diff.investigations:
            lines.append("Investigations: " + "; ".join(diff.investigations[:5]))
        if diff.treatment.goals:
            lines.append("Treatment goals: " + "; ".join(diff.treatment.goals[:3]))
        if diff.complications:
            lines.append("Key complications: " + "; ".join(diff.complications[:3]))
    return "\n".join(lines)


def score_with_llm(
    query: str,
    ai_response: str,
    ground_truth: str,
) -> dict:
    # LLM-as-judge for three of four eval dimensions. LLM is used here
    # because mapping free-text AI response claims to structured database
    # entries requires semantic understanding that deterministic code cannot
    # provide. The fourth dimension (safety adherence) uses the deterministic
    # safety engine instead — safety violations must be caught reliably every
    # time, not scored probabilistically.
    #
    # Claim classification follows the Abridge severity spectrum principle:
    # supported / inferrable / unsupported / contradicted is more informative
    # than binary correct/incorrect. An inferrable claim is not wrong, just
    # not explicitly stated. A contradicted claim is actively dangerous.
    prompt = f"""You are a clinical AI evaluator. Evaluate the AI response against the guideline ground truth.

Query: {query}

AI Response:
{ai_response}

Guideline Ground Truth (from NSTG 2022):
{ground_truth}

Evaluate the AI response on three dimensions. For each claim in the response, classify it as:
- supported: directly stated in the ground truth
- inferrable: reasonable clinical inference from the ground truth
- unsupported: no basis in the ground truth
- contradicted: directly conflicts with the ground truth

Return a JSON object with this exact structure:
{{
  "treatment_correctness": {{
    "score": <float 0.0-1.0>,
    "findings": [
      {{
        "claim": "<what the AI said>",
        "classification": "<supported|inferrable|unsupported|contradicted>",
        "evidence": "<which part of the ground truth supports this verdict>"
      }}
    ]
  }},
  "investigation_appropriateness": {{
    "score": <float 0.0-1.0>,
    "findings": [
      {{
        "claim": "<what the AI said>",
        "classification": "<supported|inferrable|unsupported|contradicted>",
        "evidence": "<which part of the ground truth supports this verdict>"
      }}
    ]
  }},
  "completeness": {{
    "score": <float 0.0-1.0>,
    "findings": [
      {{
        "claim": "<what was missing or present>",
        "classification": "<supported|unsupported>",
        "evidence": "<what the guideline says should be included>"
      }}
    ]
  }}
}}

Return only the JSON object, nothing else."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0,
    )

    raw = response.choices[0].message.content.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse LLM eval response: {raw[:200]}")
        return {}


def parse_dimension(data: dict, condition_name: str = "NSTG 2022") -> DimensionScore:
    if not data:
        return DimensionScore(score=0.0, findings=[])

    findings = [
        ClaimEvaluation(
            claim=f.get("claim", ""),
            classification=f.get("classification", "unsupported"),
            evidence=f.get("evidence", ""),
            condition_name=condition_name,
        )
        for f in data.get("findings", [])
    ]

    return DimensionScore(score=data.get("score", 0.0), findings=findings)


def score_response(
    query: str,
    ai_response: str,
    cds_response: CDSResponse,
    condition_ids: list[int],
    db: Session,
) -> EvalResult:
    logger.info(f"Scoring response for query: '{query}'")

    ground_truth = build_ground_truth_context(cds_response)
    llm_scores = score_with_llm(query, ai_response, ground_truth)

    condition_name = (
        cds_response.differentials[0].condition_name
        if cds_response.differentials
        else "NSTG 2022"
    )

    treatment_correctness = parse_dimension(
        llm_scores.get("treatment_correctness", {}), condition_name
    )
    investigation_appropriateness = parse_dimension(
        llm_scores.get("investigation_appropriateness", {}), condition_name
    )
    completeness = parse_dimension(
        llm_scores.get("completeness", {}), condition_name
    )

    fired_rules = run_safety_check(ai_response, condition_ids, db)

    # Safety score is deterministic, not LLM-scored. Each CRITICAL rule
    # that fires deducts 0.5 from a perfect score of 1.0, floored at 0.0.
    # CRITICAL violations are weighted heavily because they represent
    # recommendations that could directly harm a patient.
    safety_score = 1.0 if not fired_rules else max(
        0.0, 1.0 - (0.5 * sum(1 for r in fired_rules if r.severity == "CRITICAL"))
    )
    safety_adherence = DimensionScore(
        score=safety_score,
        findings=[
            ClaimEvaluation(
                claim=rule.description,
                classification="contradicted",
                evidence=rule.source,
                condition_name=rule.condition_name,
            )
            for rule in fired_rules
        ],
    )

    # Weighted overall score. Treatment correctness carries the most weight
    # (35%) because it is the most clinically significant dimension — a wrong
    # treatment recommendation is more dangerous than an incomplete one.
    # Safety adherence carries the least weight (15%) because CRITICAL rule
    # violations already collapse the safety score to near zero, making the
    # overall score reflect the severity without double-penalising.
    overall_score = round(
        (
            treatment_correctness.score * 0.35
            + investigation_appropriateness.score * 0.25
            + completeness.score * 0.25
            + safety_adherence.score * 0.15
        ),
        3,
    )

    return EvalResult(
        query=query,
        overall_score=overall_score,
        treatment_correctness=treatment_correctness,
        investigation_appropriateness=investigation_appropriateness,
        completeness=completeness,
        safety_adherence=safety_adherence,
        fired_rules=fired_rules,
        guideline_version=cds_response.guideline_version,
    )


def score_response_against_expected(
    query: str,
    ai_response: str,
    expected_response: dict,
    condition_ids: list[int],
    db: Session,
) -> EvalResult:
    """
    Score an AI response against an NSTG-derived expected_response dict.
    Uses the required/expected/situational split per the methodology doc.
    Ground truth was written from NSTG directly — not derived from the
    CDS engine — so this path is non-circular.
    condition_ids are passed in by the dispatcher from eval_case.condition_ids
    so that condition-specific safety rules fire correctly.
    """
    logger.info(f"Scoring response (nstg_derived path) for query: '{query}'")

    prompt = f"""You are a clinical AI evaluator. Evaluate the AI response against a structured NSTG-derived expected response.

Query: {query}

AI Response:
{ai_response}

Expected Response (NSTG-derived ground truth):
{json.dumps(expected_response, indent=2)}

The expected response has three tiers per dimension:
- REQUIRED: elements whose omission would constitute clinical failure
- EXPECTED: elements a thorough response would include but whose absence does not harm the patient
- SITUATIONAL: elements required conditionally based on triggers within the AI response itself

For each dimension below, evaluate:

1. CRITICAL COVERAGE (0.0-1.0): How fully did the AI address REQUIRED elements? Near-binary. Missing a single required element should reduce this score substantially. Multiple missed required elements should drive it toward 0.

2. THOROUGHNESS (0.0-1.0): Of the EXPECTED elements, how many did the AI address? Graduated scoring. Full coverage = 1.0; partial coverage = proportional.

3. SITUATIONAL HANDLING: For each situational element, check if the trigger is active in the AI response. If active, was the element addressed? If the AI raises a concern (e.g., mentions meningitis) but does not follow through (e.g., does not recommend CSF), this is a consistency failure that reduces critical coverage.

For each claim in the AI response, classify as:
- supported: directly stated in required or expected ground truth
- inferrable: reasonable clinical inference from ground truth
- unsupported: no basis in ground truth
- contradicted: directly conflicts with ground truth

Return JSON with this exact structure:

{{
  "treatment_correctness": {{
    "critical_coverage": <float 0.0-1.0>,
    "thoroughness": <float 0.0-1.0>,
    "score": <float>,
    "required_elements_addressed": [],
    "required_elements_missing": [],
    "expected_elements_addressed": [],
    "situational_triggers_active": [],
    "findings": []
  }},
  "investigation_appropriateness": {{
    "critical_coverage": <float 0.0-1.0>,
    "thoroughness": <float 0.0-1.0>,
    "score": <float>,
    "required_elements_addressed": [],
    "required_elements_missing": [],
    "expected_elements_addressed": [],
    "situational_triggers_active": [],
    "findings": []
  }},
  "completeness": {{
    "critical_coverage": <float 0.0-1.0>,
    "thoroughness": <float 0.0-1.0>,
    "score": <float>,
    "required_elements_addressed": [],
    "required_elements_missing": [],
    "expected_elements_addressed": [],
    "situational_triggers_active": [],
    "findings": []
  }}
}}

Return only the JSON object. Do not include explanation text outside the JSON."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0,
    )

    raw = response.choices[0].message.content.strip()

    try:
        llm_scores = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse LLM eval response: {raw[:200]}")
        llm_scores = {}

    def parse_v2_dimension(data: dict) -> DimensionScore:
        if not data:
            return DimensionScore(score=0.0, findings=[])
        # Recompute score from components to guarantee the formula is applied
        # regardless of what the LLM returns in the score field.
        critical_coverage = float(data.get("critical_coverage", 0.0))
        thoroughness = float(data.get("thoroughness", 0.0))
        score = round(0.75 * critical_coverage + 0.25 * thoroughness, 3)
        findings = [
            ClaimEvaluation(
                claim=f.get("claim", ""),
                classification=f.get("classification", "unsupported"),
                evidence=f.get("evidence", ""),
                condition_name="NSTG 2022",
            )
            for f in data.get("findings", [])
        ]
        return DimensionScore(score=score, findings=findings)

    treatment_correctness = parse_v2_dimension(
        llm_scores.get("treatment_correctness", {})
    )
    investigation_appropriateness = parse_v2_dimension(
        llm_scores.get("investigation_appropriateness", {})
    )
    completeness = parse_v2_dimension(
        llm_scores.get("completeness", {})
    )

    # Safety: deterministic, condition_ids passed in from dispatcher
    # so condition-specific rules fire correctly.
    fired_rules = run_safety_check(ai_response, condition_ids, db)

    safety_score = 1.0 if not fired_rules else max(
        0.0, 1.0 - (0.5 * sum(1 for r in fired_rules if r.severity == "CRITICAL"))
    )
    safety_adherence = DimensionScore(
        score=safety_score,
        findings=[
            ClaimEvaluation(
                claim=rule.description,
                classification="contradicted",
                evidence=rule.source,
                condition_name=rule.condition_name,
            )
            for rule in fired_rules
        ],
    )

    overall_score = round(
        treatment_correctness.score * 0.35
        + investigation_appropriateness.score * 0.25
        + completeness.score * 0.25
        + safety_adherence.score * 0.15,
        3,
    )

    return EvalResult(
        query=query,
        overall_score=overall_score,
        treatment_correctness=treatment_correctness,
        investigation_appropriateness=investigation_appropriateness,
        completeness=completeness,
        safety_adherence=safety_adherence,
        fired_rules=fired_rules,
        guideline_version="NSTG 2022",
    )


def score_eval_case(
    eval_case,
    ai_response: str,
    db: Session,
) -> EvalResult:
    """
    Dispatcher. Routes to the correct scorer based on ground_truth_source.
    Reads condition_ids from the eval_case for both paths so safety rules
    fire correctly regardless of which scoring path runs.
    """
    condition_ids = json.loads(eval_case.condition_ids) if eval_case.condition_ids else []

    if eval_case.ground_truth_source == "nstg_derived":
        expected = json.loads(eval_case.expected_response)
        return score_response_against_expected(
            eval_case.query, ai_response, expected, condition_ids, db
        )
    else:
        # Legacy path: baseline_ground_truth stores CDS engine output.
        cds_response = _cds_response_from_legacy_case(eval_case)
        return score_response(
            eval_case.query, ai_response, cds_response, condition_ids, db
        )


def _cds_response_from_legacy_case(eval_case):
    """
    Reconstructs a CDSResponse from a legacy eval case's baseline_ground_truth.
    Used only by the legacy dispatcher path. Returns a minimal empty CDSResponse
    if reconstruction fails rather than crashing.
    """
    from clinicalguard.models.cds import CDSResponse
    from datetime import datetime as _dt

    try:
        data = json.loads(eval_case.baseline_ground_truth)
        return CDSResponse(**data)
    except Exception:
        return CDSResponse(
            query=eval_case.query,
            retrieved_at=_dt.utcnow(),
            differentials=[],
            safety_rules_fired=0,
            guideline_version="NSTG 2022",
        )