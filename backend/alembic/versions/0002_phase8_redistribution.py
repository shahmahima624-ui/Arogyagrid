"""phase8 redistribution recommendations

Revision ID: 0002_phase8
Revises: 0001_phase1
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_phase8"
down_revision = "0001_phase1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "redistribution_recommendations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("destination_facility_id", sa.Uuid(), sa.ForeignKey("facilities.id"), nullable=False),
        sa.Column("medicine_id", sa.Uuid(), sa.ForeignKey("medicines.id"), nullable=False),
        sa.Column("source_facility_id", sa.Uuid(), sa.ForeignKey("facilities.id"), nullable=True),
        sa.Column("source_warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=True),
        sa.Column("recommended_quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="RECOMMENDED"),
        # Scoring breakdown
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("urgency_weight", sa.Float(), nullable=False),
        sa.Column("surplus_weight", sa.Float(), nullable=False),
        sa.Column("expiry_rescue_weight", sa.Float(), nullable=False),
        sa.Column("impact_weight", sa.Float(), nullable=False),
        sa.Column("distance_penalty", sa.Float(), nullable=False),
        sa.Column("source_risk_penalty", sa.Float(), nullable=False),
        # Context
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("destination_days_to_stockout", sa.Float(), nullable=True),
        sa.Column("source_safe_surplus", sa.Integer(), nullable=True),
        sa.Column("estimated_coverage_days_restored", sa.Float(), nullable=True),
        sa.Column("reason", sa.String(800), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("redistribution_recommendations")
