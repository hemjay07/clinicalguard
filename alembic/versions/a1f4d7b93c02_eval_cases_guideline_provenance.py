"""eval_cases: guideline_provenance tier

Revision ID: a1f4d7b93c02
Revises: c8d3f52e9b41
Create Date: 2026-09-04 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f4d7b93c02'
down_revision: Union[str, Sequence[str], None] = 'c8d3f52e9b41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CK_NAME = "ck_eval_cases_guideline_provenance"


def upgrade() -> None:
    """Case-level provenance tier (ADR-033): how much of the authored answer
    the Nigerian guideline actually covers. A plain string + CHECK constraint
    rather than a native enum, so the vocabulary can be extended without a
    type migration. Nullable — every row predating this column stays null."""
    op.add_column(
        "eval_cases",
        sa.Column("guideline_provenance", sa.String(length=30), nullable=True),
    )
    op.create_check_constraint(
        CK_NAME,
        "eval_cases",
        "guideline_provenance IS NULL OR guideline_provenance IN "
        "('nstg_only', 'nstg_plus_other', 'judgment_primary')",
    )


def downgrade() -> None:
    op.drop_constraint(CK_NAME, "eval_cases", type_="check")
    op.drop_column("eval_cases", "guideline_provenance")
