"""drop rule_type severity action from condition_safety_rules

Revision ID: 0920942cf2ee
Revises: e7a94c31f8b2
Create Date: 2026-07-14 01:18:25.486234

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0920942cf2ee'
down_revision: Union[str, Sequence[str], None] = 'e7a94c31f8b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop rule_type, severity, and action from condition_safety_rules.

    These fields carried no methodological signal in the current design:
    rule_type/action were never read by any logic (populated and transported
    but never consumed), and severity's only consumer was a CRITICAL-only
    deduction in the eval scorer, which now deducts uniformly on any fired
    rule instead. Any future reintroduction should be a deliberate,
    classified decision, not a default fill.
    """
    op.drop_column("condition_safety_rules", "rule_type")
    op.drop_column("condition_safety_rules", "severity")
    op.drop_column("condition_safety_rules", "action")


def downgrade() -> None:
    """Restore columns as nullable (original data is not recoverable)."""
    op.add_column("condition_safety_rules", sa.Column("rule_type", sa.String(length=50), nullable=True))
    op.add_column("condition_safety_rules", sa.Column("severity", sa.String(length=20), nullable=True))
    op.add_column("condition_safety_rules", sa.Column("action", sa.Text(), nullable=True))
