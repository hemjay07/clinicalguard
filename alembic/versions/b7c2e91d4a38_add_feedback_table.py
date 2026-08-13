"""add feedback table

Revision ID: b7c2e91d4a38
Revises: f2a6c8e94b17
Create Date: 2026-08-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c2e91d4a38'
down_revision: Union[str, Sequence[str], None] = 'f2a6c8e94b17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Friction notes from the in-flow "leave a note" button and the
    end-of-session exit prompt, both flows (authoring/decomposition).
    Capture-only, owner-readable."""
    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("flow", sa.String(length=20), nullable=False),
        sa.Column("context", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_feedback_user_id"),
        sa.CheckConstraint("flow IN ('authoring', 'decomposition')", name="ck_feedback_flow"),
    )
    op.create_index("ix_feedback_user_id", "feedback", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_feedback_user_id", table_name="feedback")
    op.drop_table("feedback")
