"""Server-side authoring drafts (ADR-034).

A draft is an unfinished case: the client's own form shape, stored opaquely and
handed back unread. Nothing here validates its contents — a draft is
half-written by definition, and the eval-case checks still run only at submit
(see routers/eval_cases.py).

Every endpoint is scoped to the signed-in user. Another user's draft is 404,
not 403: a rater has no business learning that someone else's draft exists.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_current_user, get_db
from clinicalguard.db.models import CaseDraft, User

router = APIRouter(prefix="/drafts", tags=["drafts"])


class DraftIn(BaseModel):
    # The conditions the case is being written against, same shape the compose
    # URL carries: [{"condition_id": 1, "subtype": null}, ...]
    condition_ids: list[dict] = Field(default_factory=list)
    form_state: dict = Field(default_factory=dict)
    screen_id: str | None = None


class DraftOut(BaseModel):
    id: uuid.UUID
    condition_ids: list[dict]
    form_state: dict
    screen_id: str | None
    created_at: str
    updated_at: str


def _utc_iso(dt: datetime) -> str:
    """Stamp the offset on. These columns hold naive UTC, and isoformat() then
    emits a string with no zone — which JavaScript reads as *local* time, so a
    draft saved a second ago rendered as "1 hour ago" for anyone not on UTC."""
    return dt.replace(tzinfo=timezone.utc).isoformat()


def _out(row: CaseDraft) -> DraftOut:
    return DraftOut(
        id=row.id,
        condition_ids=row.condition_ids or [],
        form_state=row.form_state or {},
        screen_id=row.screen_id,
        created_at=_utc_iso(row.created_at),
        updated_at=_utc_iso(row.updated_at),
    )


# A form is "pristine" when the author has typed, ticked and chosen nothing.
# The client guards against saving one, but the guard is repeated here because
# the client's autosave fires once on load with an empty form: without this, an
# author who opened a condition and backed out would accumulate drafts for
# cases they never started, on every device they ever opened.
def is_pristine(form_state: dict) -> bool:
    for value in (form_state or {}).values():
        if isinstance(value, str):
            if value.strip():
                return False
        elif isinstance(value, (list, dict)):
            if len(value) > 0:
                return False
        elif value:
            return False
    return True


@router.get("", response_model=list[DraftOut])
def list_drafts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The caller's own unfinished cases, newest first. Never anyone else's."""
    rows = (
        db.query(CaseDraft)
        .filter_by(user_id=current_user.id)
        .order_by(CaseDraft.updated_at.desc())
        .all()
    )
    return [_out(r) for r in rows]


@router.put("/{draft_id}", response_model=DraftOut)
def upsert_draft(
    draft_id: uuid.UUID,
    payload: DraftIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update one draft. The client mints the id, so a draft that is
    still being typed keeps one identity across debounced saves and across a
    reload that happens before the first response comes back.

    A pristine form never creates a row. If a row already exists and has been
    emptied out, the update is still applied — that is the author deliberately
    clearing their work, not an untouched visit."""
    row = db.query(CaseDraft).filter_by(id=draft_id).first()

    if row is None:
        if is_pristine(payload.form_state):
            raise HTTPException(
                status_code=422,
                detail={"errors": ["Nothing to save yet."]},
            )
        row = CaseDraft(
            id=draft_id,
            user_id=current_user.id,
            condition_ids=payload.condition_ids,
            form_state=payload.form_state,
            screen_id=payload.screen_id,
        )
        db.add(row)
    else:
        # Someone else's draft is not found, rather than forbidden.
        if row.user_id != current_user.id:
            raise HTTPException(status_code=404, detail=f"Draft {draft_id} not found")
        row.condition_ids = payload.condition_ids
        row.form_state = payload.form_state
        row.screen_id = payload.screen_id
        row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(row)
    return _out(row)


@router.delete("/{draft_id}", status_code=204)
def delete_draft(
    draft_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Discard a draft. Deleting one that is already gone is a success: the
    common caller is a client cleaning up after a submit, and it must not fail
    because the same cleanup already ran on another tab."""
    row = db.query(CaseDraft).filter_by(id=draft_id).first()
    if row is None:
        return
    if row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail=f"Draft {draft_id} not found")
    db.delete(row)
    db.commit()
