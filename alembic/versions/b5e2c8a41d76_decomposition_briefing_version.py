"""decomposition_response: briefing_version

Revision ID: b5e2c8a41d76
Revises: a1f4d7b93c02
Create Date: 2026-09-04 09:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5e2c8a41d76'
down_revision: Union[str, Sequence[str], None] = 'a1f4d7b93c02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Which briefing the rater read before answering. Two raters completed
    the task under the v1 wording; the analysis has to be able to separate
    them from everyone who reads v2, so every existing row backfills to 'v1'
    and new rows are written as 'v2'."""
    op.add_column(
        "decomposition_response",
        sa.Column(
            "briefing_version",
            sa.String(length=10),
            nullable=False,
            server_default="v1",
        ),
    )
    # The server_default backfills existing rows; new rows carry the value
    # the application writes, so drop the default rather than let it mask a
    # future omission.
    op.alter_column("decomposition_response", "briefing_version", server_default=None)


def downgrade() -> None:
    op.drop_column("decomposition_response", "briefing_version")
