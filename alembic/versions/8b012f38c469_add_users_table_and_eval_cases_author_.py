"""add users table and eval_cases author_user_id updated_at

Revision ID: 8b012f38c469
Revises: 6ee901a8debd
Create Date: 2026-07-15 16:14:25.708481

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b012f38c469'
down_revision: Union[str, Sequence[str], None] = '6ee901a8debd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Users table + eval_cases.author_user_id/updated_at (ADR-030).

    author_user_id is nullable: pre-auth rows have no session-backed author
    and must go through a one-off name-match backfill (not part of this
    migration — no plaintext credentials or author-matching logic belongs in
    a schema migration) before they're editable.
    """
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(length=100), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=200), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.add_column("eval_cases", sa.Column("author_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_eval_cases_author_user_id", "eval_cases", "users", ["author_user_id"], ["id"]
    )
    op.add_column("eval_cases", sa.Column("updated_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("eval_cases", "updated_at")
    op.drop_constraint("fk_eval_cases_author_user_id", "eval_cases", type_="foreignkey")
    op.drop_column("eval_cases", "author_user_id")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
