"""Auth surface (ADR-031): identity lives in Supabase Auth, so the backend
exposes /auth/me plus small profile writes — sign-in, sign-out, and token
refresh all happen against Supabase from the frontend. Calling /auth/me with
a fresh token is also what creates/links the app's users row on first
sign-in. No contact details are collected anywhere: auth IS the identity."""

import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_current_user, get_db, is_owner, require_owner
from clinicalguard.db.models import EvalCase, User

router = APIRouter(prefix="/auth", tags=["auth"])

# Fixed category list — research metadata must stay cleanly categorical.
CADRES = (
    "House Officer (HO)",
    "Medical Officer",
    "Registrar",
    "Senior Registrar",
    "Consultant",
    "Other",
)


class UserOut(BaseModel):
    id: int
    email: str | None
    display_name: str
    is_owner: bool
    cadre: str | None
    cadre_other: str | None
    contribute_opt_in: bool


def _out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_owner=is_owner(user),
        cadre=user.cadre,
        cadre_other=user.cadre_other,
        contribute_opt_in=user.contribute_opt_in,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return _out(current_user)


class CadreIn(BaseModel):
    cadre: str
    cadre_other: str | None = None

    @model_validator(mode="after")
    def _valid(self):
        if self.cadre not in CADRES:
            raise ValueError(f"cadre must be one of {CADRES}")
        other = (self.cadre_other or "").strip()
        if self.cadre == "Other":
            if not other:
                raise ValueError("Please specify your cadre")
            self.cadre_other = other[:200]
        else:
            self.cadre_other = None
        return self


@router.put("/me/cadre", response_model=UserOut)
def set_cadre(
    payload: CadreIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Author-level research metadata, asked once before the first case. The
    UI only prompts while cadre is unset; the endpoint stays writable so a
    mis-click can be corrected without owner intervention."""
    current_user.cadre = payload.cadre
    current_user.cadre_other = payload.cadre_other
    db.commit()
    return _out(current_user)


@router.post("/me/contribute-interest", response_model=UserOut)
def contribute_interest(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One-way opt-in from the post-submission screen. Capture-only: the
    owner follows up manually from the authors export."""
    current_user.contribute_opt_in = True
    db.commit()
    return _out(current_user)


@router.get("/authors/export")
def export_authors(
    db: Session = Depends(get_db),
    _owner: User = Depends(require_owner),
):
    """One CSV row per user: cadre, contribute opt-in, and their cases —
    the owner's source for cadre distribution and follow-up candidates."""
    users = db.query(User).order_by(User.id).all()
    cases = db.query(EvalCase.id, EvalCase.author_user_id).all()
    by_author: dict[int, list[int]] = {}
    for case_id, author_id in cases:
        if author_id is not None:
            by_author.setdefault(author_id, []).append(case_id)

    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=[
            "user_id", "display_name", "email", "cadre", "cadre_other",
            "contribute_opt_in", "case_count", "case_ids",
        ],
    )
    writer.writeheader()
    writer.writerows(
        {
            "user_id": u.id,
            "display_name": u.display_name,
            "email": u.email,
            "cadre": u.cadre,
            "cadre_other": u.cadre_other,
            "contribute_opt_in": u.contribute_opt_in,
            "case_count": len(by_author.get(u.id, [])),
            "case_ids": " ".join(str(i) for i in sorted(by_author.get(u.id, []))),
        }
        for u in users
    )
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=authors.csv"},
    )
