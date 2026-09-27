"""add expected_none_declared columns to eval_cases

Revision ID: c3f7a1e08b52
Revises: d7a3f61b0e94
Create Date: 2026-09-27 22:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f7a1e08b52'
down_revision: Union[str, Sequence[str], None] = 'd7a3f61b0e94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the two Should-do "Nothing to add" declarations to eval_cases (ADR-035).

    True only when the author actively ticked "Nothing to add" on the Should-do
    (expected) investigations / treatments list. Server-side default False means
    every existing row correctly reads as "not a declared-none" — the old flow
    could not have produced one. Mirrors safety_none_declared (rev 6ee901a8debd).
    """
    for col in (
        "expected_investigations_none_declared",
        "expected_treatments_none_declared",
    ):
        op.add_column(
            "eval_cases",
            sa.Column(col, sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column("eval_cases", col, server_default=None)


def downgrade() -> None:
    op.drop_column("eval_cases", "expected_treatments_none_declared")
    op.drop_column("eval_cases", "expected_investigations_none_declared")
