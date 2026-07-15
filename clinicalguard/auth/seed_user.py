"""Seed or update one known user account (ADR-030). No self-signup — this is
the only way a User row gets created.

Usage:
    python -m clinicalguard.auth.seed_user <username> "<display name>"

Reads the passphrase from the SEED_PASSWORD env var if set, otherwise prompts
interactively (hidden input) so it's never left in shell history. Upserts by
username: running this again for an existing username rotates their
passphrase and updates their display name.
"""

import getpass
import os
import sys

from clinicalguard.auth.hashing import hash_password
from clinicalguard.db.models import User
from clinicalguard.db.session import SessionLocal


def seed_user(username: str, display_name: str, password: str, db) -> User:
    user = db.query(User).filter_by(username=username).first()
    password_hash = hash_password(password)
    if user:
        user.password_hash = password_hash
        user.display_name = display_name
    else:
        user = User(username=username, display_name=display_name, password_hash=password_hash)
        db.add(user)
    db.commit()
    db.refresh(user)
    return user


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print('Usage: python -m clinicalguard.auth.seed_user <username> "<display name>"')
        sys.exit(1)

    username, display_name = sys.argv[1], sys.argv[2]
    password = os.environ.get("SEED_PASSWORD") or getpass.getpass(f"Passphrase for {username}: ")
    if not password.strip():
        print("Passphrase cannot be empty.")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = seed_user(username, display_name, password, db)
        print(f"Seeded user id={user.id} username={user.username!r} display_name={user.display_name!r}")
    finally:
        db.close()
