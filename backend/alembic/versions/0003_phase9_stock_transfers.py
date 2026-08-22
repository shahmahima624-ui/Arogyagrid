"""phase9 stock transfers

Revision ID: 0003_phase9
Revises: 0002_phase8
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_phase9"
down_revision = "0002_phase8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_transfers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("tracking_number", sa.String(60), unique=True, nullable=False),
        sa.Column("recommendation_id", sa.Uuid(), sa.ForeignKey("redistribution_recommendations.id"), nullable=True),
        sa.Column("source_facility_id", sa.Uuid(), sa.ForeignKey("facilities.id"), nullable=True),
        sa.Column("source_warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=True),
        sa.Column("destination_facility_id", sa.Uuid(), sa.ForeignKey("facilities.id"), nullable=False),
        sa.Column("medicine_id", sa.Uuid(), sa.ForeignKey("medicines.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("stock_transfers")
