"""Auth surface (ADR-031): identity lives in Supabase Auth, so the backend
only exposes /auth/me — sign-in, sign-out, and token refresh all happen
against Supabase from the frontend. Calling /auth/me with a fresh token is
also what creates/links the app's users row on first sign-in."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from clinicalguard.api.deps import get_current_user, is_owner
from clinicalguard.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class UserOut(BaseModel):
    id: int
    email: str | None
    display_name: str
    is_owner: bool


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        is_owner=is_owner(current_user),
    )
