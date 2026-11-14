from marshmallow import Schema, fields, validate


# Labels copied from the approved DonHang model comments; no revenue policy inferred.
ORDER_STATUS_LABELS = {0: 'Chờ duyệt', 1: 'Đang xử lý', 2: 'Đang giao',
                       3: 'Hoàn thành', 4: 'Đã hủy', 5: 'Đổi trả'}


class DashboardQuerySchema(Schema):
    days = fields.Integer(load_default=30, validate=validate.OneOf([7, 30, 90]))


class RecentOrdersQuerySchema(DashboardQuerySchema):
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=20))


class RecentOrderSchema(Schema):
    # PostgreSQL BIGINT can exceed JavaScript's safe integer range.
    MaDonHang = fields.String()
    NgayDat = fields.DateTime()
    TongThanhToan = fields.String()
    TrangThaiDonHang = fields.Integer()
    TenTrangThai = fields.Method('status_label')

    def status_label(self, order):
        return ORDER_STATUS_LABELS.get(order['TrangThaiDonHang'], 'Không xác định')
