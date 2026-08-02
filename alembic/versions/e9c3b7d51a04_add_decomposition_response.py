"""add decomposition_response table

Revision ID: e9c3b7d51a04
Revises: d4f8a91c2b5e
Create Date: 2026-08-02 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9c3b7d51a04'
down_revision: Union[str, Sequence[str], None] = 'd4f8a91c2b5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """One row per rater x item for the fixed 15-item decomposition task
    (ADR-032). The items themselves are seed content in code
    (clinicalguard.decomposition_items), not a table — they are frozen and
    identical for every rater, so only the judgments need persistence.
    """
    op.create_table(
        "decomposition_response",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rater_user_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("decision", sa.String(length=20), nullable=False),
        sa.Column("split_count", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["rater_user_id"], ["users.id"], name="fk_decomposition_rater_user_id"),
        sa.UniqueConstraint("rater_user_id", "item_id", name="uq_decomposition_rater_item"),
        sa.CheckConstraint("decision IN ('keep_whole', 'split')", name="ck_decomposition_decision"),
    )
    op.create_index("ix_decomposition_response_rater_user_id", "decomposition_response", ["rater_user_id"])


def downgrade() -> None:
    op.drop_index("ix_decomposition_response_rater_user_id", table_name="decomposition_response")
    op.drop_table("decomposition_response")
