"""Add the approved nullable Gateway environment to DonHang.

Revision ID: 31ac74d9e206
Revises: 7e66691b2041
"""
from alembic import op
import sqlalchemy as sa

revision = '31ac74d9e206'
down_revision = '7e66691b2041'
branch_labels = None
depends_on = None


def upgrade():
    # No default or backfill: preserve all existing records as unclassified.
    op.add_column('DonHang', sa.Column('MoiTruongThanhToan', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('DonHang', 'MoiTruongThanhToan')
