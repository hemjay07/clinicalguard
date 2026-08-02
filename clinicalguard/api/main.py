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

from clinicalguard.api.routers import auth, conditions, decomposition, eval_cases, safety_rules

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

# Identity rides the Authorization header (Supabase access token, ADR-031),
# not cookies, so no credentialed CORS and no session middleware.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    # Explicit, not "*": the wildcard never covers Authorization in the
    # fetch spec, and Authorization is the one header that matters here.
    allow_headers=["Authorization", "Content-Type"],
)

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(conditions.router, prefix=API_PREFIX)
app.include_router(decomposition.router, prefix=API_PREFIX)
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
