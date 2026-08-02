"""Supabase Auth token verification (ADR-031, replaces ADR-030).

The frontend signs in through Supabase (Google OAuth primary) and sends the
resulting access token as a Bearer header. We verify it against the project's
public JWKS — asymmetric ES256 keys, so the backend holds no signing secret.
Identity is whatever the verified token says; nothing client-supplied is
trusted.
"""

from functools import lru_cache

import jwt
from jwt import PyJWKClient

from clinicalguard.config import settings


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    # PyJWKClient caches fetched keys; one instance for the process.
    return PyJWKClient(f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json")


class TokenError(Exception):
    pass


def verify_supabase_token(token: str) -> dict:
    """Return the verified claims of a Supabase access token, or raise TokenError."""
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except Exception as e:  # expired, bad signature, wrong audience, no kid…
        raise TokenError(str(e)) from e
