"""Add the approved points redemption flag to DonHang.

Revision ID: 58bd14a72f93
Revises: 31ac74d9e206
"""
from alembic import op
import sqlalchemy as sa

revision = '58bd14a72f93'
down_revision = '31ac74d9e206'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('DonHang', sa.Column('DoiDiem', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('DonHang', 'DoiDiem')
