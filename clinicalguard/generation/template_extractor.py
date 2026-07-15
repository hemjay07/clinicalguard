"""
Step 1 of the auto-generation pipeline: deterministic template extraction.

Takes a condition_id and an optional subtype filter, queries the structured
NSTG data, and returns a skeleton JSON with full traceability to source fields.

No LLM involvement. No clinical inference. Just structured extraction.

The output is the input to Step 2 (LLM tier assignment) and ultimately
Step 3 (MD clinical reasonableness review).
"""

import logging

from typing import Optional

from sqlalchemy.orm import Session

from clinicalguard.db.models import (
    Condition,
    ConditionFinding,
    ConditionTreatment,
    ConditionInvestigation,
    ConditionDifferential,
    ConditionComplication,
    ConditionAdverseReaction,
    ConditionSafetyRule,
)

logger = logging.getLogger(__name__)


def extract_skeleton(
    condition_id: int,
    subtype: Optional[str],
    db: Session,
) -> dict:
    """
    Extract the deterministic raw material from structured NSTG data for one condition.

    This is Step 1 of the auto-generation pipeline. The output is not a clinical
    case — it is the source material from which a case will be constructed in Step 2.
    No clinical inference happens here. No query is constructed. No tier assignment.
    Step 1 is intentionally narrow: faithfully serialize what NSTG structured data
    contains for the specified condition and subtype.

    Args:
        condition_id: The condition to extract from (e.g., 149 for Malaria)
        subtype: Optional findings subtype to scope by (e.g., "Severe (Complicated) malaria").
                 If None, all findings subtypes are included.
        db: SQLAlchemy session

    Returns:
        A dict containing raw material with full source traceability.

    Raises:
        ValueError if condition_id does not exist.
    """
    condition = db.query(Condition).filter_by(id=condition_id).first()
    if not condition:
        raise ValueError(f"Condition with id={condition_id} not found")

    logger.info(f"Extracting raw material for condition_id={condition_id} ({condition.name}), subtype={subtype}")

    # Findings: filter by subtype if specified
    findings_query = db.query(ConditionFinding).filter_by(condition_id=condition_id)
    if subtype:
        findings_query = findings_query.filter_by(subtype=subtype)
    findings = findings_query.all()

    # Group findings by subtype so consumers can see the structure
    findings_by_subtype: dict[str, list[str]] = {}
    for f in findings:
        key = f.subtype or "uncategorised"
        findings_by_subtype.setdefault(key, []).append(f.finding_text)

    # Get all findings subtypes available for this condition (not just the filtered set)
    # so Step 2 knows what scopes are possible
    all_subtypes_query = db.query(ConditionFinding).filter_by(condition_id=condition_id).all()
    all_subtypes = sorted(set(f.subtype for f in all_subtypes_query if f.subtype))

    # Treatments: full pool, grouped by treatment_type
    treatments = db.query(ConditionTreatment).filter_by(condition_id=condition_id).all()
    treatments_by_type: dict[str, list[str]] = {}
    for t in treatments:
        key = t.treatment_type or "uncategorised"
        text = t.notes if t.notes else (t.drug_name or "")
        if text:
            treatments_by_type.setdefault(key, []).append(text)

    # Investigations: full pool, no tier assignment
    investigations = db.query(ConditionInvestigation).filter_by(condition_id=condition_id).all()
    investigations_pool = [i.investigation_text for i in investigations]

    # Differentials
    differentials = db.query(ConditionDifferential).filter_by(condition_id=condition_id).all()
    differentials_pool = [d.differential_condition for d in differentials]

    # Complications
    complications = db.query(ConditionComplication).filter_by(condition_id=condition_id).all()
    complications_pool = [c.complication for c in complications]

    # Safety signals: both adverse reactions (raw NSTG text) and verified safety rules
    adverse = db.query(ConditionAdverseReaction).filter_by(condition_id=condition_id).all()
    safety_rules = db.query(ConditionSafetyRule).filter_by(
        condition_id=condition_id, is_active=True, is_verified=True
    ).all()

    safety_signals = {
        "adverse_reactions_from_nstg": [a.reaction for a in adverse],
        "verified_safety_rules": [
            {
                "rule_id": r.id,
                "description": r.description,
                "source": r.source,
            }
            for r in safety_rules
        ],
    }

    raw_material = {
        "condition": {
            "id": condition.id,
            "name": condition.name,
            "introduction": condition.introduction,
            "source_field": "conditions.name + conditions.introduction",
        },
        "scoped_to_subtype": subtype,
        "all_available_subtypes": all_subtypes,
        "findings": {
            "by_subtype": findings_by_subtype,
            "source_field": "condition_findings.finding_text grouped by subtype",
        },
        "investigations_pool": {
            "items": investigations_pool,
            "source_field": "condition_investigations.investigation_text",
        },
        "treatments_pool": {
            "by_type": treatments_by_type,
            "source_field": "condition_treatments.notes grouped by treatment_type",
        },
        "differentials_pool": {
            "items": differentials_pool,
            "source_field": "condition_differentials.differential_condition",
        },
        "complications_pool": {
            "items": complications_pool,
            "source_field": "condition_complications.complication",
        },
        "safety_signals": {
            **safety_signals,
            "source_fields": "condition_adverse_reactions.reaction; condition_safety_rules.description",
        },
        "extraction_metadata": {
            "generated_by": "template_extractor.extract_skeleton",
            "step": 1,
            "deterministic": True,
            "llm_involved": False,
        },
    }

    return raw_material

def _generate_case_id(condition_name: str, subtype: Optional[str]) -> str:
    """Generate a stable case_id from condition and subtype."""
    base = condition_name.lower().replace(" ", "_")
    if subtype:
        subtype_part = subtype.lower().replace(" ", "_").replace("(", "").replace(")", "")
        return f"{base}__{subtype_part}__adult"
    return f"{base}__adult"


if __name__ == "__main__":
    """Run on severe malaria as the canonical test case."""
    import json
    from clinicalguard.db.session import SessionLocal

    logging.basicConfig(level=logging.INFO)

    db = SessionLocal()
    try:
        skeleton = extract_skeleton(
            condition_id=149,
            subtype="Severe (Complicated) malaria",
            db=db,
        )
        print(json.dumps(skeleton, indent=2))
    finally:
        db.close()