"""flatten escalation triggers in expected_response blobs

Escalation loses its required/expected tier (ADR-028): a finding either
warrants escalation or it does not. MD-authored cases' blobs are migrated from
  "required_escalation_triggers": {"required": [...], "expected": [...]}
to
  "escalation_triggers": [...required, ...expected]
No data loss — the two arrays are concatenated in order. Legacy nstg_derived
reference cases are left untouched (the LLM scorer reads either shape).

Revision ID: e7a94c31f8b2
Revises: c4e1a2b9d3f7
Create Date: 2026-07-03 16:30:00.000000

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a94c31f8b2'
down_revision: Union[str, Sequence[str], None] = 'c4e1a2b9d3f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT id, expected_response FROM eval_cases "
        "WHERE ground_truth_source = 'md_authored_via_ui' AND expected_response IS NOT NULL"
    )).fetchall()
    for row_id, blob in rows:
        try:
            data = json.loads(blob)
        except (json.JSONDecodeError, TypeError):
            continue
        old = data.pop("required_escalation_triggers", None)
        if old is None:
            continue
        merged = list(old.get("required", [])) + list(old.get("expected", []))
        data["escalation_triggers"] = merged
        conn.execute(
            sa.text("UPDATE eval_cases SET expected_response = :blob WHERE id = :id"),
            {"blob": json.dumps(data), "id": row_id},
        )


def downgrade() -> None:
    # The required/expected split cannot be reconstructed; restore the old key
    # with everything under "required" so older code still finds the field.
    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT id, expected_response FROM eval_cases "
        "WHERE ground_truth_source = 'md_authored_via_ui' AND expected_response IS NOT NULL"
    )).fetchall()
    for row_id, blob in rows:
        try:
            data = json.loads(blob)
        except (json.JSONDecodeError, TypeError):
            continue
        flat = data.pop("escalation_triggers", None)
        if flat is None:
            continue
        data["required_escalation_triggers"] = {"required": flat, "expected": []}
        conn.execute(
            sa.text("UPDATE eval_cases SET expected_response = :blob WHERE id = :id"),
            {"blob": json.dumps(data), "id": row_id},
        )
