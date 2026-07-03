"""add candidate_safety_rules table

Revision ID: c4e1a2b9d3f7
Revises: 78cd60aef718
Create Date: 2026-07-02 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e1a2b9d3f7'
down_revision: Union[str, Sequence[str], None] = '78cd60aef718'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Free-text safety flags collected as candidates for the verified rule
    library (ADR-027). Background collection only; Phase D adds the review UI."""
    op.create_table(
        'candidate_safety_rules',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('rule_text', sa.Text(), nullable=False),
        sa.Column('eval_case_id', sa.Integer(), nullable=True),
        sa.Column('condition_ids', sa.Text(), nullable=True),
        sa.Column('proposed_by', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['eval_case_id'], ['eval_cases.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('candidate_safety_rules')
