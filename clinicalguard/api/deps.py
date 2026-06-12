"""Shared FastAPI dependencies."""

from clinicalguard.db.session import get_db

# Re-exported so routers depend on `clinicalguard.api.deps.get_db` rather than
# reaching into the db package directly. The session generator itself lives in
# clinicalguard/db/session.py.
__all__ = ["get_db"]
