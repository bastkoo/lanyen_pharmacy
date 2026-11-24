"""Approved AI history in the existing conversation and message tables."""
from alembic import op
import sqlalchemy as sa

revision = 'b7d20a81c649'
down_revision = 'af371b90d642'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('TinNhan', sa.Column('LoaiHoiThoai', sa.String(16), nullable=False, server_default='DUOC_SI'))
    op.add_column('NoiDungTinNhan', sa.Column('LoaiNguoiGui', sa.String(16), nullable=True))
    # Preserve the existing sender interpretation. No message content is changed.
    op.execute(sa.text('''UPDATE "NoiDungTinNhan" AS m
        SET "LoaiNguoiGui" = CASE WHEN u."VaiTro" = 1 THEN 'DUOC_SI' ELSE 'KHACH_HANG' END
        FROM "NguoiDung" AS u WHERE u."MaNguoiDung" = m."NguoiGui"'''))
    op.alter_column('NoiDungTinNhan', 'LoaiNguoiGui', existing_type=sa.String(16), nullable=False)
    op.alter_column('NoiDungTinNhan', 'NguoiGui', existing_type=sa.BigInteger(), nullable=True)


def downgrade():
    # A downgrade cannot represent AI senders. Refuse rather than delete history.
    op.execute(sa.text('''DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM "NoiDungTinNhan" WHERE "NguoiGui" IS NULL)
           OR EXISTS (SELECT 1 FROM "TinNhan" WHERE "LoaiHoiThoai" = 'AI') THEN
            RAISE EXCEPTION 'AI history exists; export and resolve it before downgrade';
        END IF;
    END $$'''))
    op.alter_column('NoiDungTinNhan', 'NguoiGui', existing_type=sa.BigInteger(), nullable=False)
    op.drop_column('NoiDungTinNhan', 'LoaiNguoiGui')
    op.drop_column('TinNhan', 'LoaiHoiThoai')
