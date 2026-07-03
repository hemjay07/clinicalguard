"""Safety-rules endpoint: all active rules with condition info (read-only browser)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from clinicalguard.api.deps import get_db
from clinicalguard.db.models import Condition, ConditionSafetyRule

router = APIRouter(prefix="/safety-rules", tags=["safety-rules"])

# Ingested data is static for a deployment — cache in-process like /conditions.
_rules_cache: list[dict] | None = None


@router.get("")
def list_safety_rules(db: Session = Depends(get_db)):
    """All active safety rules with their condition name. Returns verified and
    unverified active rules so the browser can filter by verification status;
    universal rules (condition_id is NULL) are labelled 'Universal'."""
    global _rules_cache
    if _rules_cache is not None:
        return _rules_cache
    rules = (
        db.query(ConditionSafetyRule)
        .filter(ConditionSafetyRule.is_active == True)  # noqa: E712 (SQLAlchemy needs ==)
        .all()
    )

    cond_ids = {r.condition_id for r in rules if r.condition_id is not None}
    name_map = {
        c.id: c.name
        for c in db.query(Condition.id, Condition.name).filter(Condition.id.in_(cond_ids)).all()
    } if cond_ids else {}

    _rules_cache = [
        {
            "id": r.id,
            "condition_id": r.condition_id,
            "condition_name": name_map.get(r.condition_id, "Universal"),
            "rule_type": r.rule_type,
            "description": r.description,
            "severity": r.severity,
            "action": r.action,
            "source": r.source,
            "is_universal": r.is_universal,
            "is_active": r.is_active,
            "is_verified": r.is_verified,
        }
        for r in rules
    ]
    return _rules_cache
