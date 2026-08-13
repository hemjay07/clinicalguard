"""Friction capture: any signed-in user can leave a note (in-flow button or
exit prompt); only the owner can read them. Capture-only by design — there is
no reply path, no status field, no notification. The context string is what
makes a note actionable: it records where in the flow the confusion happened."""

import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_current_user, get_db, require_owner
from clinicalguard.db.models import Feedback, User

router = APIRouter(prefix="/feedback", tags=["feedback"])

FLOWS = ("authoring", "decomposition")


class FeedbackIn(BaseModel):
    flow: str
    # Where the note was left (screen/step + item id or case field). Sent by
    # the UI, not typed by the user — but still bounded, never trusted.
    context: str | None = None
    note: str

    @field_validator("flow")
    @classmethod
    def _flow_valid(cls, v: str) -> str:
        if v not in FLOWS:
            raise ValueError(f"flow must be one of {FLOWS}")
        return v

    @field_validator("note")
    @classmethod
    def _note_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("The note is empty")
        return v[:2000]

    @field_validator("context")
    @classmethod
    def _context_bounded(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v[:300] or None


@router.post("", status_code=204)
def leave_note(
    payload: FeedbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save and nothing else — the response carries no data on purpose, so
    the UI can't build any expectation of a reply on top of it."""
    db.add(
        Feedback(
            user_id=current_user.id,
            flow=payload.flow,
            context=payload.context,
            note=payload.note,
        )
    )
    db.commit()


def _rows(db: Session) -> list[dict]:
    rows = (
        db.query(Feedback, User)
        .join(User, Feedback.user_id == User.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )
    return [
        {
            "id": fb.id,
            "user": user.display_name,
            "user_email": user.email,
            "flow": fb.flow,
            "context": fb.context,
            "note": fb.note,
            "created_at": fb.created_at.isoformat(),
        }
        for fb, user in rows
    ]


@router.get("")
def list_feedback(
    db: Session = Depends(get_db),
    _owner: User = Depends(require_owner),
):
    """All notes with their context, newest first. Owner-only: raters never
    see each other's (or their own past) notes."""
    return _rows(db)


@router.get("/export")
def export_feedback(
    db: Session = Depends(get_db),
    _owner: User = Depends(require_owner),
):
    """CSV of the same rows, for scanning offline which confusions repeat."""
    records = _rows(db)
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=["id", "user", "user_email", "flow", "context", "note", "created_at"],
    )
    writer.writeheader()
    writer.writerows(records)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=feedback.csv"},
    )
