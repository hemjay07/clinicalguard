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


def build_ground_truth_context(cds_response: CDSResponse) -> str:
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