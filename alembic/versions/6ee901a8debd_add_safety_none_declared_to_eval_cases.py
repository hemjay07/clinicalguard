"""add safety_none_declared to eval_cases

Revision ID: 6ee901a8debd
Revises: 0920942cf2ee
Create Date: 2026-07-15 15:49:39.560635

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ee901a8debd'
down_revision: Union[str, Sequence[str], None] = '0920942cf2ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add safety_none_declared to eval_cases (ADR-029).

    True only when the author actively ticked "no danger-level constraints
    apply." Server-side default False means every pre-v1.4 row correctly
    reads as "not yet answered" — it was structurally impossible for the old
    UI to have produced a genuine declared-empty case.
    """
    op.add_column(
        "eval_cases",
        sa.Column("safety_none_declared", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("eval_cases", "safety_none_declared", server_default=None)


def downgrade() -> None:
    op.drop_column("eval_cases", "safety_none_declared")
