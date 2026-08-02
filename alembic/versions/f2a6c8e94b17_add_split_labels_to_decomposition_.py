"""add split_labels to decomposition_response

Revision ID: f2a6c8e94b17
Revises: e9c3b7d51a04
Create Date: 2026-08-02 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a6c8e94b17'
down_revision: Union[str, Sequence[str], None] = 'e9c3b7d51a04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """The carve, not just the count: an ordered JSON array of brief
    rater-written piece labels, one per piece, present exactly when
    decision = 'split'. Two raters who both split into N can cut along
    different lines — the labels are what makes that visible."""
    op.add_column("decomposition_response", sa.Column("split_labels", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("decomposition_response", "split_labels")
