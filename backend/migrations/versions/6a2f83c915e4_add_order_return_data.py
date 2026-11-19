"""Store approved refund allocations for customer cancellation.

Revision ID: 6a2f83c915e4
Revises: 58bd14a72f93
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '6a2f83c915e4'
down_revision = '58bd14a72f93'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('DonHang', sa.Column('DuLieuHoanTra', postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column('DonHang', 'DuLieuHoanTra')
