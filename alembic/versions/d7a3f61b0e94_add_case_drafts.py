"""add case_drafts

Revision ID: d7a3f61b0e94
Revises: b5e2c8a41d76
Create Date: 2026-09-06 03:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd7a3f61b0e94'
down_revision: Union[str, Sequence[str], None] = 'b5e2c8a41d76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Server-side authoring drafts (ADR-034). Until now a draft lived in one
    browser's localStorage, so a case begun on a phone could not be finished on
    a laptop and clearing site data destroyed it.

    form_state is opaque JSON: the client's own form shape, stored and returned
    unread. Nothing here validates it — a draft is by definition half-written,
    and the eval-case validation still runs only at submit."""
    op.create_table(
        "case_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        # The conditions the draft is being written against, same shape the
        # compose URL carries.
        sa.Column("condition_ids", postgresql.JSONB(), nullable=False),
        sa.Column("form_state", postgresql.JSONB(), nullable=False),
        # Internal screen id (e.g. "2.7"), so resuming returns the author to
        # the question they stopped on rather than the top of the flow.
        sa.Column("screen_id", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    # The list endpoint is always "this user's drafts, newest first".
    op.create_index("ix_case_drafts_user_updated", "case_drafts", ["user_id", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_case_drafts_user_updated", table_name="case_drafts")
    op.drop_table("case_drafts")
