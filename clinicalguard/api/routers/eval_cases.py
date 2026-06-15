"""Eval-case endpoints: create (MD-authored), list, get one."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_db
from clinicalguard.api.schemas import EvalCaseCreate, EvalCaseCreated
from clinicalguard.db.models import Condition, ConditionSafetyRule, EvalCase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/eval-cases", tags=["eval-cases"])

GROUND_TRUTH_SOURCE = "md_authored_via_ui"
DATASET_VERSION = "NSTG 2022"
SCORING_DIMENSIONS = [
    "treatment_correctness",
    "investigation_appropriateness",
    "completeness",
    "safety_adherence",
]


def validate_case(payload: EvalCaseCreate) -> tuple[list[str], list[str]]:
    """
    Structural validation. Returns (errors, warnings).

    Errors block submission (the case is structurally incomplete). Warnings are
    surfaced to the author but do not block — they flag thinness, not breakage.
    The frontend mirrors these checks; the server is the source of truth.
    """
    errors: list[str] = []
    warnings: list[str] = []

    if not payload.query.strip():
        errors.append("Clinical query is required.")
    if not payload.diagnoses.primary.strip():
        errors.append("Expected primary diagnosis is required.")
    if not payload.investigations.required and not payload.treatments.required:
        errors.append(
            "At least one required investigation or one required treatment is needed."
        )
    for sit in payload.investigations.situational:
        if not sit.trigger.strip():
            errors.append(f"Situational investigation '{sit.item}' is missing a trigger.")
    for sit in payload.treatments.situational:
        if not sit.trigger.strip():
            errors.append(f"Situational treatment '{sit.item}' is missing a trigger.")

    if not payload.what_this_evaluates.strip():
        warnings.append(
            "'What this case evaluates' is empty — recommended for interpretability."
        )
    if not payload.monitoring.required_elements and not payload.monitoring.required_principle.strip():
        warnings.append("No monitoring plan provided.")
    if not payload.escalation.required:
        warnings.append("No required escalation triggers provided.")

    return errors, warnings


def _slug(text: str) -> str:
    return text.lower().replace(" ", "_").replace("(", "").replace(")", "")


def build_case_id(conds: list[dict]) -> str:
    """Stable, readable id from each condition (+subtype). Joined for multi-condition."""
    parts = []
    for c in conds:
        base = _slug(c["condition_name"])
        if c.get("subtype"):
            base = f"{base}__{_slug(c['subtype'])}"
        parts.append(base)
    return "__".join(parts)


def build_expected_response(
    payload: EvalCaseCreate, conds: list[dict], case_id: str, db: Session
) -> dict:
    """Map the clean UI payload into the nstg_derived-style JSON blob stored in
    eval_cases.expected_response (the shape the rich scorer consumes).

    `conds` is the ordered list of referenced conditions, each
    {condition_id, condition_name, subtype}. The case body itself stays singular
    (one query, one diagnosis set, one set of tiers); only the source references
    are plural."""
    # Resolve selected safety-rule ids into their stored detail for the blob.
    resolved_rules = []
    if payload.safety.selected_rule_ids:
        rules = (
            db.query(ConditionSafetyRule)
            .filter(ConditionSafetyRule.id.in_(payload.safety.selected_rule_ids))
            .all()
        )
        resolved_rules = [
            {
                "id": r.id,
                "severity": r.severity,
                "description": r.description,
                "source": r.source,
            }
            for r in rules
        ]

    return {
        "case_id": case_id,
        "query": payload.query.strip(),
        "what_this_evaluates": payload.what_this_evaluates.strip(),
        "authored_by": payload.authored_by.strip(),
        "conditions": conds,
        "derived_from": [f"NSTG 2022 {c['condition_name']} section" for c in conds],
        "query_scope": payload.query_scope.strip(),
        "scoring_dimensions": SCORING_DIMENSIONS,
        "expected_diagnoses": {
            "required": {
                "primary": payload.diagnoses.primary.strip(),
                "critical_differentials": payload.diagnoses.critical_differentials,
            },
            "expected": {"other_considerations": payload.diagnoses.other_considerations},
        },
        "required_investigations": {
            "required": payload.investigations.required,
            "expected": payload.investigations.expected,
            "situational": [
                {"test": s.item, "trigger": s.trigger}
                for s in payload.investigations.situational
            ],
        },
        "required_treatments": {
            "required": payload.treatments.required,
            "expected": payload.treatments.expected,
            "situational": [
                {"treatment": s.item, "trigger": s.trigger}
                for s in payload.treatments.situational
            ],
        },
        "complications": payload.complications,
        "required_monitoring": {
            "required_principle": payload.monitoring.required_principle.strip(),
            "required_elements": payload.monitoring.required_elements,
            "expected_elements": payload.monitoring.expected_elements,
        },
        "required_escalation_triggers": {
            "required": payload.escalation.required,
            "expected": payload.escalation.expected,
        },
        "required_safety_flags": {
            "selected_rule_ids": payload.safety.selected_rule_ids,
            "rules": resolved_rules,
            "free_text": payload.safety.free_text,
        },
    }


@router.post("", response_model=EvalCaseCreated, status_code=201)
def create_eval_case(payload: EvalCaseCreate, db: Session = Depends(get_db)):
    if not payload.conditions:
        raise HTTPException(status_code=422, detail={"errors": ["At least one condition is required."]})

    ids = [c.condition_id for c in payload.conditions]
    name_map = {
        c.id: c.name
        for c in db.query(Condition.id, Condition.name).filter(Condition.id.in_(ids)).all()
    }
    missing = [cid for cid in ids if cid not in name_map]
    if missing:
        raise HTTPException(status_code=404, detail=f"Condition(s) not found: {missing}")

    errors, warnings = validate_case(payload)
    if errors:
        # 422 = the submission is structurally incomplete.
        raise HTTPException(status_code=422, detail={"errors": errors})

    # Ordered list of referenced conditions, each with its name and subtype.
    conds = [
        {"condition_id": c.condition_id, "condition_name": name_map[c.condition_id], "subtype": c.subtype}
        for c in payload.conditions
    ]
    case_id = build_case_id(conds)
    expected = build_expected_response(payload, conds, case_id, db)

    row = EvalCase(
        query=payload.query.strip(),
        baseline_ground_truth=json.dumps(
            {"note": "superseded by expected_response", "case_id": case_id}
        ),
        condition_ids=json.dumps(ids),
        dataset_version=DATASET_VERSION,
        source=GROUND_TRUTH_SOURCE,
        difficulty=None,
        is_validated=False,
        expected_response=json.dumps(expected),
        query_scope=payload.query_scope.strip() or None,
        ground_truth_source=GROUND_TRUTH_SOURCE,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return EvalCaseCreated(id=row.id, case_id=case_id, warnings=warnings)


def _safe_load(blob: str | None) -> dict:
    if not blob:
        return {}
    try:
        return json.loads(blob)
    except (json.JSONDecodeError, TypeError):
        return {}


def _subtype_display(meta: dict) -> str | None:
    """Subtype text for the list view. New (multi-condition) cases carry
    per-condition subtypes under `conditions`; older cases use a flat `subtype`."""
    conds = meta.get("conditions")
    if isinstance(conds, list) and conds:
        subs = [c.get("subtype") for c in conds if c.get("subtype")]
        return ", ".join(subs) if subs else None
    return meta.get("subtype")


@router.get("")
def list_eval_cases(db: Session = Depends(get_db)):
    """List the Phase A corpus: only cases authored through this UI
    (ground_truth_source = md_authored_via_ui). Legacy auto_generated_legacy
    cases and the hand-seeded nstg_derived reference cases remain in the database
    but are not surfaced here, so the count reflects the real MD-authored corpus.
    Reads metadata (case_id, subtype, authored_by) from the expected_response JSON."""
    rows = (
        db.query(EvalCase)
        .filter(EvalCase.ground_truth_source == GROUND_TRUTH_SOURCE)
        .order_by(EvalCase.created_at.desc())
        .all()
    )

    # Map condition ids -> names in one query.
    all_ids: set[int] = set()
    parsed: list[tuple[EvalCase, dict, list[int]]] = []
    for row in rows:
        meta = _safe_load(row.expected_response)
        cids = _safe_load(row.condition_ids) if row.condition_ids else []
        cids = cids if isinstance(cids, list) else []
        all_ids.update(cids)
        parsed.append((row, meta, cids))

    name_map = {
        c.id: c.name
        for c in db.query(Condition.id, Condition.name).filter(Condition.id.in_(all_ids)).all()
    } if all_ids else {}

    out = []
    for row, meta, cids in parsed:
        names = [name_map[c] for c in cids if c in name_map]
        out.append(
            {
                "id": row.id,
                "case_id": meta.get("case_id"),
                "condition_ids": cids,
                "condition_names": names,
                "subtype": _subtype_display(meta),
                "query": row.query,
                "authored_by": meta.get("authored_by"),
                "ground_truth_source": row.ground_truth_source,
                "submitted_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return out


@router.get("/{case_id}")
def get_eval_case(case_id: int, db: Session = Depends(get_db)):
    """Full eval case for the read-only detail view."""
    row = db.query(EvalCase).filter_by(id=case_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Eval case {case_id} not found")

    expected = _safe_load(row.expected_response)
    cids = _safe_load(row.condition_ids) if row.condition_ids else []
    cids = cids if isinstance(cids, list) else []
    name_map = {
        c.id: c.name
        for c in db.query(Condition.id, Condition.name).filter(Condition.id.in_(cids)).all()
    } if cids else {}
    conditions = [{"id": c, "name": name_map[c]} for c in cids if c in name_map]

    return {
        "id": row.id,
        "query": row.query,
        "condition_ids": cids,
        "conditions": conditions,
        "ground_truth_source": row.ground_truth_source,
        "source": row.source,
        "dataset_version": row.dataset_version,
        "query_scope": row.query_scope,
        "is_validated": row.is_validated,
        "submitted_at": row.created_at.isoformat() if row.created_at else None,
        "expected_response": expected,
    }
