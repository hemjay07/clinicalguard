"""users: cadre + contribute_opt_in

Revision ID: c8d3f52e9b41
Revises: b7c2e91d4a38
Create Date: 2026-08-14 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8d3f52e9b41'
down_revision: Union[str, Sequence[str], None] = 'b7c2e91d4a38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Author-level research metadata: professional cadre (asked once per
    author) and the contribute-more opt-in raised on the post-submission
    screen. Both owner-readable, both surfaced in the authors export."""
    op.add_column("users", sa.Column("cadre", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("cadre_other", sa.String(length=200), nullable=True))
    op.add_column(
        "users",
        sa.Column("contribute_opt_in", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("users", "contribute_opt_in")
    op.drop_column("users", "cadre_other")
    op.drop_column("users", "cadre")
