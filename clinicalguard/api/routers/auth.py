"""Minimal identity auth (ADR-030): login/logout/me against seeded users
only. No signup, reset, or roles — see clinicalguard.auth.seed_user."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_current_user, get_db
from clinicalguard.auth.hashing import verify_password
from clinicalguard.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or passphrase")
    request.session["user_id"] = user.id
    return UserOut(id=user.id, username=user.username, display_name=user.display_name)


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(id=current_user.id, username=current_user.username, display_name=current_user.display_name)
