"""Shared FastAPI dependencies."""

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from clinicalguard.db.models import User
from clinicalguard.db.session import get_db

# Re-exported so routers depend on `clinicalguard.api.deps.get_db` rather than
# reaching into the db package directly. The session generator itself lives in
# clinicalguard/db/session.py.
__all__ = ["get_db", "get_current_user"]


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Identifies the caller from the session cookie (ADR-030). Raises 401 if
    there's no session or it doesn't resolve to a known user — never falls
    back to a default identity."""
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(User).filter_by(id=user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
