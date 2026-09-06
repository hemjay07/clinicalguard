"""Eval-case endpoints: create (MD-authored), list, get one."""

import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_current_user, get_db, is_owner
from clinicalguard.api.schemas import EvalCaseCreate, EvalCaseCreated
from clinicalguard.db.models import (
    CandidateSafetyRule,
    CaseDraft,
    Condition,
    EvalCase,
    User,
)
from clinicalguard.safety.engine import get_relevant_rules

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/eval-cases", tags=["eval-cases"])

GROUND_TRUTH_SOURCE = "md_authored_via_ui"
# Case-level provenance tiers (ADR-033). Ordered from "the guideline covers
# all of it" to "the guideline barely covers this".
GUIDELINE_PROVENANCE_TIERS = ("nstg_only", "nstg_plus_other", "judgment_primary")
# The two tiers that assert something came from outside NSTG — those are the
# ones a reviewer cannot check without being told which parts, and from where.
TIERS_REQUIRING_NOTES = ("nstg_plus_other", "judgment_primary")
DATASET_VERSION = "NSTG 2022"
SCORING_DIMENSIONS = [
    "treatment_correctness",
    "investigation_appropriateness",
    "completeness",
    "safety_adherence",
]


def validate_case(payload: EvalCaseCreate) -> list[str]:
    """
    Advisory validation only. Returns warnings; nothing blocks submission.

    Per the v1.3.1 decision: no field is required at submission — the author
    decides what a case needs, the tool does not enforce. Empty safety layer,
    empty differentials, and skipped enrichment fields are all valid states.
    Warnings flag formatting or thinness the author may want to know about.
    """
    warnings: list[str] = []

    for sit in payload.investigations.situational:
        if not sit.trigger.strip():
            warnings.append(f"Situational investigation '{sit.item}' has no trigger.")
    for sit in payload.treatments.situational:
        if not sit.trigger.strip():
            warnings.append(f"Situational treatment '{sit.item}' has no trigger.")

    if not payload.what_this_evaluates.strip():
        warnings.append(
            "'What this case evaluates' is empty — recommended for interpretability."
        )
    if not payload.monitoring.required_elements:
        warnings.append("No monitoring plan provided.")
    if not payload.escalation:
        warnings.append("No escalation triggers provided.")

    return warnings


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
    payload: EvalCaseCreate, conds: list[dict], case_id: str, db: Session, authored_by: str
) -> dict:
    """Map the clean UI payload into the nstg_derived-style JSON blob stored in
    eval_cases.expected_response (the shape the rich scorer consumes).

    `conds` is the ordered list of referenced conditions, each
    {condition_id, condition_name, subtype}. The case body itself stays singular
    (one query, one diagnosis set, one set of tiers); only the source references
    are plural. `authored_by` is the authenticated user's display name (ADR-030)
    — never client-supplied."""
    # Verified rules auto-attach by condition (ADR-029) — the author is never
    # asked to pick them. Reuses the same filter the safety engine applies at
    # scoring time, so this list is always exactly what would fire against
    # these conditions.
    condition_ids = [c["condition_id"] for c in conds]
    resolved_rules = [
        {
            "id": r.id,
            "description": r.description,
            "source": r.source,
        }
        for r in get_relevant_rules(condition_ids, db)
    ]

    return {
        "case_id": case_id,
        "query": payload.query.strip(),
        "what_this_evaluates": payload.what_this_evaluates.strip(),
        "authored_by": authored_by,
        "conditions": conds,
        "derived_from": [f"NSTG 2022 {c['condition_name']} section" for c in conds],
        "query_scope": payload.query_scope.strip(),
        "provenance_notes": payload.provenance_notes.strip(),
        # Descriptive metadata, like provenance_notes: carried in the exported
        # case JSON for stratified reporting, never read by the scorer.
        "guideline_provenance": payload.guideline_provenance,
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
            "required_elements": payload.monitoring.required_elements,
            "expected_elements": payload.monitoring.expected_elements,
        },
        # Flat list (ADR-028): a finding either warrants escalation or it
        # does not. Format per line: "[finding] — [escalation action]".
        "escalation_triggers": payload.escalation,
        "reasoning_archetypes": payload.reasoning_archetypes,
        "other_archetypes": payload.other_archetypes,
        "required_safety_flags": {
            "rules": resolved_rules,
            "free_text": payload.safety.free_text,
            "none_declared": payload.safety.none_declared,
        },
    }


def _validate_and_build(
    payload: EvalCaseCreate, db: Session, authored_by: str
) -> tuple[list[int], str, dict, list[str]]:
    """Shared by create and update: condition/safety validation plus the
    case_id + expected_response blob. Raises the same HTTPExceptions either
    way. Returns (condition_ids, case_id, expected_response, warnings)."""
    if not payload.conditions:
        raise HTTPException(status_code=422, detail={"errors": ["At least one condition is required."]})

    # The one deliberate exception to v1.3.1's "nothing is required at
    # submission" (ADR-029): the safety harm question must be actively
    # resolved, either with constraints or an explicit declared-empty.
    # Both empty and both-filled are invalid — exactly one must hold.
    if bool(payload.safety.free_text) == payload.safety.none_declared:
        raise HTTPException(
            status_code=422,
            detail={"errors": ["Answer the safety question to finish — either list the dangers, or confirm there are none."]},
        )

    # Provenance tier (ADR-033), the second required answer. A reviewer can
    # only check the answer if they know what to check it against; the two
    # mixed tiers additionally have to say which parts came from where.
    if payload.guideline_provenance not in GUIDELINE_PROVENANCE_TIERS:
        raise HTTPException(
            status_code=422,
            detail={"errors": ["Say where this answer came from before submitting."]},
        )
    if payload.guideline_provenance in TIERS_REQUIRING_NOTES and not payload.provenance_notes.strip():
        raise HTTPException(
            status_code=422,
            detail={"errors": ["Say which parts came from where, in a sentence or two."]},
        )

    ids = [c.condition_id for c in payload.conditions]
    name_map = {
        c.id: c.name
        for c in db.query(Condition.id, Condition.name).filter(Condition.id.in_(ids)).all()
    }
    missing = [cid for cid in ids if cid not in name_map]
    if missing:
        raise HTTPException(status_code=404, detail=f"Condition(s) not found: {missing}")

    warnings = validate_case(payload)

    # Ordered list of referenced conditions, each with its name and subtype.
    conds = [
        {"condition_id": c.condition_id, "condition_name": name_map[c.condition_id], "subtype": c.subtype}
        for c in payload.conditions
    ]
    case_id = build_case_id(conds)
    expected = build_expected_response(payload, conds, case_id, db, authored_by)
    return ids, case_id, expected, warnings


def _retire_draft(payload: EvalCaseCreate, db: Session, current_user: User) -> None:
    """Drop the draft a submitted case came from (ADR-034). Best-effort: the
    case is already committed, and failing the request because a draft could
    not be cleaned up would be the wrong trade. A draft belonging to someone
    else is simply not touched."""
    if not payload.draft_id:
        return
    try:
        row = (
            db.query(CaseDraft)
            .filter_by(id=uuid.UUID(payload.draft_id), user_id=current_user.id)
            .first()
        )
        if row:
            db.delete(row)
            db.commit()
    except (ValueError, TypeError):
        # Malformed id from an older client — nothing to retire.
        pass
    except Exception:
        db.rollback()
        logger.warning("Failed to retire draft %s", payload.draft_id, exc_info=True)


def _collect_candidate_safety_rules(
    payload: EvalCaseCreate, db: Session, eval_case_id: int, condition_ids: list[int], proposed_by: str
) -> None:
    """Append candidate safety rules for the current free-text lines (Phase D
    reviews them; ADR-027). Never blocks the request — a failure here is
    logged, not surfaced. Called on both create and edit; edits append new
    rows rather than deduping against a prior submission's rows."""
    if not payload.safety.free_text:
        return
    try:
        for text in payload.safety.free_text:
            db.add(
                CandidateSafetyRule(
                    rule_text=text,
                    eval_case_id=eval_case_id,
                    condition_ids=json.dumps(condition_ids),
                    proposed_by=proposed_by,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        logger.warning(
            "Failed to record candidate safety rules for case %s", eval_case_id, exc_info=True
        )


@router.post("", response_model=EvalCaseCreated, status_code=201)
def create_eval_case(
    payload: EvalCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids, case_id, expected, warnings = _validate_and_build(payload, db, current_user.display_name)

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
        safety_none_declared=payload.safety.none_declared,
        guideline_provenance=payload.guideline_provenance,
        author_user_id=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    _collect_candidate_safety_rules(payload, db, row.id, ids, current_user.display_name)
    _retire_draft(payload, db, current_user)

    return EvalCaseCreated(id=row.id, case_id=case_id, warnings=warnings)


@router.put("/{case_id}", response_model=EvalCaseCreated, status_code=200)
def update_eval_case(
    case_id: int,
    payload: EvalCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an author's own case in place (id preserved). Reuses the exact
    same validation and expected_response construction as create — the only
    difference is updating an existing row instead of inserting a new one."""
    row = db.query(EvalCase).filter_by(id=case_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Eval case {case_id} not found")
    # A legacy case with no author_user_id (pre-auth) is never silently
    # editable — it must go through the one-time backfill first.
    if row.author_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own cases")

    ids, new_case_id, expected, warnings = _validate_and_build(payload, db, current_user.display_name)

    row.query = payload.query.strip()
    row.condition_ids = json.dumps(ids)
    row.expected_response = json.dumps(expected)
    row.query_scope = payload.query_scope.strip() or None
    row.safety_none_declared = payload.safety.none_declared
    row.guideline_provenance = payload.guideline_provenance
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)

    _collect_candidate_safety_rules(payload, db, row.id, ids, current_user.display_name)

    return EvalCaseCreated(id=row.id, case_id=new_case_id, warnings=warnings)


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
def list_eval_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the Phase A corpus: only cases authored through this UI
    (ground_truth_source = md_authored_via_ui). Legacy auto_generated_legacy
    cases and the hand-seeded nstg_derived reference cases remain in the database
    but are not surfaced here, so the count reflects the real MD-authored corpus.
    Reads metadata (case_id, subtype, authored_by) from the expected_response JSON.

    Result privacy (A3/ADR-031): an author sees only their own cases; the
    aggregate corpus is readable only by the owner."""
    q = db.query(EvalCase).filter(EvalCase.ground_truth_source == GROUND_TRUTH_SOURCE)
    if not is_owner(current_user):
        q = q.filter(EvalCase.author_user_id == current_user.id)
    rows = q.order_by(EvalCase.created_at.desc()).all()

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


@router.get("/count")
def count_eval_cases(db: Session = Depends(get_db)):
    """Public corpus size for the landing page — the one aggregate fact that
    stays open now that the case list itself is private (A3/ADR-031)."""
    n = (
        db.query(EvalCase)
        .filter(EvalCase.ground_truth_source == GROUND_TRUTH_SOURCE)
        .count()
    )
    return {"count": n}


@router.get("/{case_id}")
def get_eval_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full eval case for the read-only detail view. Readable by its author
    or the owner only (A3/ADR-031)."""
    row = db.query(EvalCase).filter_by(id=case_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Eval case {case_id} not found")
    if row.author_user_id != current_user.id and not is_owner(current_user):
        raise HTTPException(status_code=403, detail="You can only view your own cases")

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
        "guideline_provenance": row.guideline_provenance,
        "submitted_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "author_user_id": row.author_user_id,
        "expected_response": expected,
    }
