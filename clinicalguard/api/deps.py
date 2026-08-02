"""Shared FastAPI dependencies."""

import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from clinicalguard.auth.supabase import TokenError, verify_supabase_token
from clinicalguard.config import settings
from clinicalguard.db.models import User
from clinicalguard.db.session import get_db

# Re-exported so routers depend on `clinicalguard.api.deps.get_db` rather than
# reaching into the db package directly. The session generator itself lives in
# clinicalguard/db/session.py.
__all__ = ["get_db", "get_current_user", "require_owner", "is_owner"]


def _display_name_from_claims(claims: dict, email: str) -> str:
    meta = claims.get("user_metadata") or {}
    return (meta.get("full_name") or meta.get("name") or email.split("@")[0]).strip()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Identifies the caller from a verified Supabase access token (ADR-031).

    On first sign-in the users row is created — or, if a pre-Supabase row
    exists with the same email, linked to it, which is how legacy case
    authorship carries over. Raises 401 if the token is missing or invalid;
    never falls back to a default identity.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        claims = verify_supabase_token(auth.removeprefix("Bearer ").strip())
    except TokenError:
        raise HTTPException(status_code=401, detail="Not authenticated")

    supabase_user_id = uuid.UUID(claims["sub"])
    email = (claims.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Token has no email identity")

    user = db.query(User).filter_by(supabase_user_id=supabase_user_id).first()
    if user:
        return user

    # First sign-in for this Supabase identity. Link by email if a legacy row
    # (or a row pre-seeded with this email) exists, otherwise create one.
    user = db.query(User).filter(User.email == email, User.supabase_user_id.is_(None)).first()
    if user:
        user.supabase_user_id = supabase_user_id
    else:
        user = User(
            supabase_user_id=supabase_user_id,
            email=email,
            display_name=_display_name_from_claims(claims, email),
        )
        db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Two first-sign-in requests raced; the other one won.
        db.rollback()
        user = db.query(User).filter_by(supabase_user_id=supabase_user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def is_owner(user: User) -> bool:
    return bool(user.email) and user.email.lower() == settings.owner_email.lower()


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    """Gate for aggregate results (all cases, all decomposition responses)."""
    if not is_owner(current_user):
        raise HTTPException(status_code=403, detail="Owner access required")
    return current_user
