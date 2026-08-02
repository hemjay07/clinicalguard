"""Decomposition rater task (ADR-032): the fixed 15-item set, each rater's
own responses (upsert = edit-own pattern), and an owner-only export of the
raw responses across raters. No agreement stats in-app — that analysis is
done deliberately, offline, from the export."""

import csv
import io
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


class ResponseIn(BaseModel):
    decision: str
    split_count: int | None = None
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
    reason: str
    updated_at: str | None


def _out(row: DecompositionResponse) -> ResponseOut:
    return ResponseOut(
        item_id=row.item_id,
        decision=row.decision,
        split_count=row.split_count,
        reason=row.reason,
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
    else:
        # keep_whole carries no count — normalize rather than reject.
        payload.split_count = None

    row = (
        db.query(DecompositionResponse)
        .filter_by(rater_user_id=current_user.id, item_id=item_id)
        .first()
    )
    if row:
        row.decision = payload.decision
        row.split_count = payload.split_count
        row.reason = payload.reason
        row.updated_at = datetime.utcnow()
    else:
        row = DecompositionResponse(
            rater_user_id=current_user.id,
            item_id=item_id,
            decision=payload.decision,
            split_count=payload.split_count,
            reason=payload.reason,
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
            "item_id": resp.item_id,
            "item_text": ITEMS_BY_ID.get(resp.item_id, {}).get("text"),
            "decision": resp.decision,
            "split_count": resp.split_count,
            "reason": resp.reason,
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
            "rater", "rater_email", "item_id", "item_text",
            "decision", "split_count", "reason", "updated_at",
        ],
    )
    writer.writeheader()
    writer.writerows(records)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=decomposition_responses.csv"},
    )
