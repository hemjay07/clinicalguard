"""Password hashing for the seeded-user auth model (ADR-030). Plain bcrypt —
no passlib, which has had bcrypt-backend maintenance issues."""

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash — never treat as a match.
        return False
