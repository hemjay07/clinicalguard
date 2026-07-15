"""
ClinicalGuard API — FastAPI application entrypoint.

Versioned REST under /api/v1. Serves the Phase A MD-authoring UI but is shaped
as the framework's public API (clean JSON contracts other clients could use).

CORS: allowed origins come from the FRONTEND_ORIGIN env var (comma-separated)
plus local dev defaults. Not opened to "*" — see the deployment notes in
DEPLOYMENT.md and ADR-019.
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from clinicalguard.api.routers import auth, conditions, eval_cases, safety_rules
from clinicalguard.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="ClinicalGuard API",
    version="0.1.0",
    description="Clinical AI evaluation framework — Phase A authoring API.",
)

# Local dev defaults (Vite on 5173, common alt on 3000) plus any deployed
# frontend origin(s) provided via env.
_default_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
_env_origins = [o.strip() for o in os.environ.get("FRONTEND_ORIGIN", "").split(",") if o.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys(_default_origins + _env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # True (was False): the session cookie (ADR-030) must ride cross-origin
    # requests between the Vercel frontend and Railway backend. Safe because
    # ALLOWED_ORIGINS is an explicit list, never "*".
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signed-cookie sessions (ADR-030) — no session table, no JWT. same_site="none"
# is required for the cross-origin cookie to be sent at all in production,
# which in turn requires https_only=True (browsers reject SameSite=None
# cookies without Secure). Locally (cookie_secure=False) same_site="lax" over
# plain HTTP works fine for same-site dev requests.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret_key,
    same_site="none" if settings.cookie_secure else "lax",
    https_only=settings.cookie_secure,
)

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(conditions.router, prefix=API_PREFIX)
app.include_router(eval_cases.router, prefix=API_PREFIX)
app.include_router(safety_rules.router, prefix=API_PREFIX)


@app.get("/health", tags=["meta"])
def health():
    """Liveness probe for the platform health check."""
    return {"status": "ok"}


@app.get("/", tags=["meta"])
def root():
    return {
        "name": "ClinicalGuard API",
        "version": "0.1.0",
        "docs": "/docs",
        "api_base": API_PREFIX,
    }
