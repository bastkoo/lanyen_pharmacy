from marshmallow import Schema, fields, validate, validates_schema, ValidationError

ORDER_FILTERS = {'all': None, 'processing': (0, 1), 'shipping': (2,),
                 'delivered': (3,), 'cancelled': (4,), 'returns': (5,)}


class OrderListQuerySchema(Schema):
    status = fields.String(load_default='all', validate=validate.OneOf(ORDER_FILTERS))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))
    per_page = fields.Integer(load_default=10, validate=validate.Range(min=1, max=50))


class OrderReorderSchema(Schema):
    MaChiTiet = fields.List(fields.String(validate=validate.Regexp(r'^[1-9][0-9]{0,18}$')),
                           required=True, validate=validate.Length(min=1, max=1000))

    @validates_schema
    def unique_items(self, data, **kwargs):
        if len(set(data['MaChiTiet'])) != len(data['MaChiTiet']):
            raise ValidationError('Duplicate order lines.')


class OrderCreateSchema(Schema):
    MaDonGia = fields.List(fields.Integer(strict=True, validate=validate.Range(min=1, max=2147483647)),
                          required=True, validate=validate.Length(min=1, max=1000))
    PhuongThucThanhToan = fields.Integer(required=True, strict=True, validate=validate.OneOf([0, 1]))
    HinhThucNhanHang = fields.String(required=True, validate=validate.OneOf(['delivery', 'pickup']))
    MaDiaChi = fields.String(load_default=None, allow_none=True, validate=validate.Regexp(r'^[1-9][0-9]{0,18}$'))
    GhiChu = fields.String(load_default='', validate=validate.Length(max=2000))
    # Detect a changed quote instead of charging a different amount silently.
    TongThanhToan = fields.String(required=True, validate=validate.Regexp(r'^(0|[1-9][0-9]{0,18})$'))

    @validates_schema
    def validate_selection(self, data, **kwargs):
        if len(set(data['MaDonGia'])) != len(data['MaDonGia']):
            raise ValidationError('Duplicate units.')
        if data['HinhThucNhanHang'] == 'delivery' and not data['MaDiaChi']:
            raise ValidationError('Delivery address required.')
