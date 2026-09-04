"""Decomposition rater task (ADR-032): the fixed 15-item set, each rater's
own responses (upsert = edit-own pattern), and an owner-only export of the
raw responses across raters. No agreement stats in-app — that analysis is
done deliberately, offline, from the export."""

import csv
import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_current_user, get_db, require_owner
from clinicalguard.db.models import DecompositionResponse, User
from clinicalguard.decomposition_items import ITEM_GROUPS, ITEMS_BY_ID, TASK_VERSION, TOTAL_ITEMS

router = APIRouter(prefix="/decomposition", tags=["decomposition"])

DECISIONS = ("keep_whole", "split")
# The wording of the task briefing currently on the page. Stamped on a row
# when it is first written, never on a revision — an answer belongs to the
# briefing the rater actually read. Two raters completed the task under "v1";
# the analysis has to be able to hold them apart from everyone after.
BRIEFING_VERSION = "v2"


class ResponseIn(BaseModel):
    decision: str
    split_count: int | None = None
    # Ordered brief piece labels, one per piece — the carve itself. Never
    # pre-populated anywhere: these must be the rater's own words.
    split_labels: list[str] | None = None
    reason: str

    @field_validator("decision")
    @classmethod
    def _decision_valid(cls, v: str) -> str:
        if v not in DECISIONS:
            raise ValueError(f"decision must be one of {DECISIONS}")
        return v

    @field_validator("reason")
    @classmethod
    def _reason_required(cls, v: str) -> str:
        # The one-line reason is the channel that surfaces tacit criteria —
        # required, never optional.
        if not v.strip():
            raise ValueError("A one-line reason is required")
        return v.strip()


class ResponseOut(BaseModel):
    item_id: int
    decision: str
    split_count: int | None
    split_labels: list[str] | None
    reason: str
    briefing_version: str
    updated_at: str | None


def _labels(row: DecompositionResponse) -> list[str] | None:
    return json.loads(row.split_labels) if row.split_labels else None


def _out(row: DecompositionResponse) -> ResponseOut:
    return ResponseOut(
        item_id=row.item_id,
        decision=row.decision,
        split_count=row.split_count,
        split_labels=_labels(row),
        reason=row.reason,
        briefing_version=row.briefing_version,
        updated_at=(row.updated_at or row.created_at).isoformat(),
    )


@router.get("/items")
def list_items(current_user: User = Depends(get_current_user)):
    """The frozen task set, grouped by source case, in task-sheet order.
    Identical for every rater; contains no rulebook content."""
    return {"task_version": TASK_VERSION, "total_items": TOTAL_ITEMS, "groups": ITEM_GROUPS}


@router.get("/responses", response_model=list[ResponseOut])
def my_responses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Only ever the caller's own rows — a rater never sees another rater's
    answers or the aggregate (that's the owner export)."""
    rows = (
        db.query(DecompositionResponse)
        .filter_by(rater_user_id=current_user.id)
        .order_by(DecompositionResponse.item_id)
        .all()
    )
    return [_out(r) for r in rows]


@router.put("/responses/{item_id}", response_model=ResponseOut)
def upsert_response(
    item_id: int,
    payload: ResponseIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or revise the caller's response to one item. Revising is a
    first-class action (raters are told they may change earlier answers), so
    an existing row is updated in place."""
    if item_id not in ITEMS_BY_ID:
        raise HTTPException(status_code=404, detail=f"Unknown item {item_id}")
    if payload.decision == "split":
        if payload.split_count is None or payload.split_count < 2:
            raise HTTPException(
                status_code=422,
                detail="A split needs how many pieces (at least 2).",
            )
        # The carve is the measurement: a split with unlabeled pieces gives
        # the count without the cut lines, which is the useless case.
        labels = [l.strip() for l in (payload.split_labels or [])]
        if len(labels) != payload.split_count or any(not l for l in labels):
            raise HTTPException(
                status_code=422,
                detail="Name each piece in a few words — one label per piece.",
            )
        payload.split_labels = labels
    else:
        # keep_whole carries no count or labels — normalize rather than reject.
        payload.split_count = None
        payload.split_labels = None

    row = (
        db.query(DecompositionResponse)
        .filter_by(rater_user_id=current_user.id, item_id=item_id)
        .first()
    )
    labels_json = json.dumps(payload.split_labels) if payload.split_labels else None
    if row:
        row.decision = payload.decision
        row.split_count = payload.split_count
        row.split_labels = labels_json
        row.reason = payload.reason
        row.updated_at = datetime.utcnow()
    else:
        row = DecompositionResponse(
            rater_user_id=current_user.id,
            item_id=item_id,
            decision=payload.decision,
            split_count=payload.split_count,
            split_labels=labels_json,
            reason=payload.reason,
            briefing_version=BRIEFING_VERSION,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return _out(row)


@router.get("/export")
def export_responses(
    format: str = "csv",
    db: Session = Depends(get_db),
    _owner: User = Depends(require_owner),
):
    """All raw responses across raters — rater x item x decision x
    split_count x reason. Owner-only (A3): raters can never read the
    aggregate."""
    rows = (
        db.query(DecompositionResponse, User)
        .join(User, DecompositionResponse.rater_user_id == User.id)
        .order_by(User.id, DecompositionResponse.item_id)
        .all()
    )
    records = [
        {
            "rater": user.display_name,
            "rater_email": user.email,
            "rater_cadre": user.cadre,
            "item_id": resp.item_id,
            "item_text": ITEMS_BY_ID.get(resp.item_id, {}).get("text"),
            "decision": resp.decision,
            "split_count": resp.split_count,
            "split_labels": _labels(resp),
            "reason": resp.reason,
            "briefing_version": resp.briefing_version,
            "updated_at": (resp.updated_at or resp.created_at).isoformat(),
        }
        for resp, user in rows
    ]
    if format == "json":
        return {"task_version": TASK_VERSION, "responses": records}

    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=[
            "rater", "rater_email", "rater_cadre", "item_id", "item_text",
            "decision", "split_count", "split_labels", "reason",
            "briefing_version", "updated_at",
        ],
    )
    writer.writeheader()
    # CSV cell: ordered labels joined with " | " (JSON export carries the real array).
    writer.writerows(
        {**r, "split_labels": " | ".join(r["split_labels"]) if r["split_labels"] else ""}
        for r in records
    )
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=decomposition_responses.csv"},
    )
