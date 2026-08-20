"""phase 1 core domain

Revision ID: 0001_phase1
Revises:
"""

from alembic import op

from app.db.base import Base

revision = "0001_phase1"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(op.get_bind())
