"""Conditions endpoints: list, subtypes, source-material (Step 1+2), details."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_db
from clinicalguard.db.models import (
    Condition,
    ConditionAdverseReaction,
    ConditionComplication,
    ConditionDifferential,
    ConditionFinding,
    ConditionInvestigation,
    ConditionSafetyRule,
    ConditionTreatment,
)
from clinicalguard.generation.template_extractor import extract_skeleton

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conditions", tags=["conditions"])

# The conditions list + counts are static for a deployment (ingested data does
# not change at runtime), so the result is cached in-process after the first
# build. This keeps the picker/overview snappy without re-running the grouped
# count queries on every load. Subtypes and source-material are static for the
# same reason and get keyed caches below.
_conditions_cache: list[dict] | None = None
_subtypes_cache: dict[int, list[str]] = {}
_source_material_cache: dict[tuple[int, str | None], dict] = {}


def _counts_by_condition(db: Session, model, col_label: str) -> dict[int, int]:
    rows = (
        db.query(model.condition_id, func.count())
        .group_by(model.condition_id)
        .all()
    )
    return {cid: n for cid, n in rows}


@router.get("")
def list_conditions(db: Session = Depends(get_db)):
    """All conditions with per-table data counts (powers both the picker and
    the read-only conditions overview). Counts come from grouped aggregates so
    this is a handful of queries, not one-per-condition. Cached in-process."""
    global _conditions_cache
    if _conditions_cache is not None:
        return _conditions_cache

    conditions = db.query(Condition.id, Condition.name).order_by(Condition.name).all()

    findings = _counts_by_condition(db, ConditionFinding, "findings")
    investigations = _counts_by_condition(db, ConditionInvestigation, "investigations")
    treatments = _counts_by_condition(db, ConditionTreatment, "treatments")
    differentials = _counts_by_condition(db, ConditionDifferential, "differentials")
    complications = _counts_by_condition(db, ConditionComplication, "complications")
    safety_rules = _counts_by_condition(db, ConditionSafetyRule, "safety_rules")

    _conditions_cache = [
        {
            "id": c.id,
            "name": c.name,
            "counts": {
                "findings": findings.get(c.id, 0),
                "investigations": investigations.get(c.id, 0),
                "treatments": treatments.get(c.id, 0),
                "differentials": differentials.get(c.id, 0),
                "complications": complications.get(c.id, 0),
                "safety_rules": safety_rules.get(c.id, 0),
            },
        }
        for c in conditions
    ]
    return _conditions_cache


def _require_condition(condition_id: int, db: Session) -> Condition:
    condition = db.query(Condition).filter_by(id=condition_id).first()
    if not condition:
        raise HTTPException(status_code=404, detail=f"Condition {condition_id} not found")
    return condition


@router.get("/{condition_id}/subtypes")
def get_subtypes(condition_id: int, db: Session = Depends(get_db)):
    """Distinct findings.subtype values available for this condition."""
    if condition_id in _subtypes_cache:
        return _subtypes_cache[condition_id]
    _require_condition(condition_id, db)
    rows = (
        db.query(ConditionFinding.subtype)
        .filter(ConditionFinding.condition_id == condition_id)
        .distinct()
        .all()
    )
    _subtypes_cache[condition_id] = sorted({r.subtype for r in rows if r.subtype})
    return _subtypes_cache[condition_id]


@router.get("/{condition_id}/source-material")
def get_source_material(
    condition_id: int,
    subtype: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Deterministic source material for authoring: the structured NSTG data for
    this condition/subtype, exactly as extract_skeleton returns it. No LLM is
    involved — the MD authors directly from the raw structured data (ADR-019).
    The frontend SourcePanel renders this shape directly (findings by subtype,
    investigations, treatments by type, differentials, complications, safety
    signals).
    """
    key = (condition_id, subtype)
    if key in _source_material_cache:
        return _source_material_cache[key]
    _require_condition(condition_id, db)
    try:
        _source_material_cache[key] = extract_skeleton(condition_id, subtype, db)
        return _source_material_cache[key]
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{condition_id}/details")
def get_condition_details(condition_id: int, db: Session = Depends(get_db)):
    """Full structured data for read-only display on the conditions overview."""
    condition = _require_condition(condition_id, db)

    findings = db.query(ConditionFinding).filter_by(condition_id=condition_id).all()
    investigations = db.query(ConditionInvestigation).filter_by(condition_id=condition_id).all()
    treatments = db.query(ConditionTreatment).filter_by(condition_id=condition_id).all()
    differentials = db.query(ConditionDifferential).filter_by(condition_id=condition_id).all()
    complications = db.query(ConditionComplication).filter_by(condition_id=condition_id).all()
    adverse = db.query(ConditionAdverseReaction).filter_by(condition_id=condition_id).all()
    safety_rules = db.query(ConditionSafetyRule).filter_by(condition_id=condition_id).all()

    return {
        "id": condition.id,
        "name": condition.name,
        "introduction": condition.introduction,
        "category": condition.category,
        "is_emergency": condition.is_emergency,
        "icd10_code": condition.icd10_code,
        "age_group": condition.age_group,
        "counts": {
            "findings": len(findings),
            "investigations": len(investigations),
            "treatments": len(treatments),
            "differentials": len(differentials),
            "complications": len(complications),
            "adverse_reactions": len(adverse),
            "safety_rules": len(safety_rules),
        },
        "findings": [
            {
                "text": f.finding_text,
                "finding_type": f.finding_type,
                "subtype": f.subtype,
                "severity_tier": f.severity_tier,
                "is_required": f.is_required,
            }
            for f in findings
        ],
        "investigations": [
            {"text": i.investigation_text, "is_required": i.is_required}
            for i in investigations
        ],
        "treatments": [
            {
                "treatment_type": t.treatment_type,
                "drug_name": t.drug_name,
                "dose": t.dose,
                "route": t.route,
                "duration": t.duration,
                "subtype": t.subtype,
                "notes": t.notes,
            }
            for t in treatments
        ],
        "differentials": [
            {
                "differential_condition": d.differential_condition,
                "distinguishing_features": d.distinguishing_features,
            }
            for d in differentials
        ],
        "complications": [
            {"complication": c.complication, "severity": c.severity, "subtype": c.subtype}
            for c in complications
        ],
        "adverse_reactions": [
            {"reaction": a.reaction, "severity": a.severity} for a in adverse
        ],
        "safety_rules": [
            {
                "id": r.id,
                "rule_type": r.rule_type,
                "description": r.description,
                "severity": r.severity,
                "action": r.action,
                "source": r.source,
                "is_active": r.is_active,
                "is_verified": r.is_verified,
            }
            for r in safety_rules
        ],
    }
