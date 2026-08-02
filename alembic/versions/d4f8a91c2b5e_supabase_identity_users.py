"""users: supabase identity replaces local credentials

Revision ID: d4f8a91c2b5e
Revises: 8b012f38c469
Create Date: 2026-08-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4f8a91c2b5e'
down_revision: Union[str, Sequence[str], None] = '8b012f38c469'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Re-key users to Supabase Auth (ADR-031).

    Existing rows (and every eval_cases.author_user_id FK) are preserved —
    only the local credential columns go away. supabase_user_id/email are
    nullable so a legacy row keeps existing until its author's first Google
    sign-in links it by email (api.deps.get_current_user). The owner's email
    is backfilled here so that link is deterministic for the known owner
    account; other legacy users are linked by setting their email before
    they first sign in, or by hand-relinking their cases after.
    """
    op.add_column("users", sa.Column("supabase_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(length=320), nullable=True))
    op.create_index("ix_users_supabase_user_id", "users", ["supabase_user_id"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.execute("UPDATE users SET email = 'irfanjimoh123@gmail.com' WHERE username = 'mujeeb'")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "username")


def downgrade() -> None:
    # Local credentials are unrecoverable; downgrade restores the columns
    # with placeholder values only so the old schema loads.
    op.add_column("users", sa.Column("username", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=200), nullable=True))
    op.execute("UPDATE users SET username = COALESCE(email, 'user_' || id), password_hash = '!'")
    op.alter_column("users", "username", nullable=False)
    op.alter_column("users", "password_hash", nullable=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_supabase_user_id", table_name="users")
    op.drop_column("users", "email")
    op.drop_column("users", "supabase_user_id")
