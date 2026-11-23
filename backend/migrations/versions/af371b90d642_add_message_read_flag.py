"""Approved unread-message tracking; preserve old messages as read."""
from alembic import op
import sqlalchemy as sa

revision = 'af371b90d642'
down_revision = '6a2f83c915e4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('NoiDungTinNhan', sa.Column('DaDoc', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column('NoiDungTinNhan', 'DaDoc', server_default=sa.false())


def downgrade():
    op.drop_column('NoiDungTinNhan', 'DaDoc')
