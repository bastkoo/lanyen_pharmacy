from marshmallow import Schema, fields, validate, validates_schema, ValidationError

ORDER_FILTERS = {'all': None, 'processing': (0, 1), 'shipping': (2,),
                 'delivered': (3,), 'cancelled': (4,), 'returns': (5,)}


class OrderListQuerySchema(Schema):
    status = fields.String(load_default='all', validate=validate.OneOf(ORDER_FILTERS))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))
    per_page = fields.Integer(load_default=10, validate=validate.Range(min=1, max=50))


class EmployeeOrderQuerySchema(Schema):
    status = fields.String(load_default='all', validate=validate.OneOf(['all', '0', '1', '2']))
    search = fields.String(load_default='', validate=validate.Length(max=40))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=50))


class EmployeeOrderUpdateSchema(Schema):
    from_status = fields.Integer(strict=True, required=True, validate=validate.OneOf([0, 1, 2]))
    to_status = fields.Integer(strict=True, required=True, validate=validate.OneOf([1, 2, 3]))


class CompletedOrderQuerySchema(EmployeeOrderQuerySchema):
    status = fields.String(load_default='3', validate=validate.OneOf(['3']))


class CounterLineSchema(Schema):
    MaThuoc = fields.Integer(strict=True, required=True, validate=validate.Range(min=1, max=2147483647))
    MaDonGia = fields.Integer(strict=True, required=True, validate=validate.Range(min=1, max=2147483647))
    SoLuong = fields.Integer(strict=True, required=True, validate=validate.Range(min=1, max=2147483647))


class CounterQuoteSchema(Schema):
    SDT = fields.String(required=True, validate=validate.Length(min=1, max=24))
    items = fields.List(fields.Nested(CounterLineSchema), required=True, validate=validate.Length(min=1, max=100))
    DoiDiem = fields.Boolean(load_default=False)

    @validates_schema(pass_original=True)
    def validate_values(self, data, original_data, **kwargs):
        if type(original_data.get('DoiDiem', False)) is not bool or len({line['MaDonGia'] for line in data['items']}) != len(data['items']):
            raise ValidationError('Invalid selection.')


class CounterCreateSchema(CounterQuoteSchema):
    HoTen = fields.String(load_default='', validate=validate.Length(max=255))
    PhuongThucThanhToan = fields.Integer(strict=True, required=True, validate=validate.OneOf([0, 1]))
    TongThanhToan = fields.String(required=True, validate=validate.Regexp(r'^(0|[1-9][0-9]{0,18})$'))
    request_id = fields.UUID(required=True)


class OrderReorderSchema(Schema):
    MaChiTiet = fields.List(fields.String(validate=validate.Regexp(r'^[1-9][0-9]{0,18}$')),
                           required=True, validate=validate.Length(min=1, max=1000))

    @validates_schema
    def unique_items(self, data, **kwargs):
        if len(set(data['MaChiTiet'])) != len(data['MaChiTiet']):
            raise ValidationError('Duplicate order lines.')


class OrderCreateSchema(Schema):
    DoiDiem = fields.Boolean(load_default=False)
    MaDonGia = fields.List(fields.Integer(strict=True, validate=validate.Range(min=1, max=2147483647)),
                          required=True, validate=validate.Length(min=1, max=1000))
    PhuongThucThanhToan = fields.Integer(required=True, strict=True, validate=validate.OneOf([0, 1]))
    HinhThucNhanHang = fields.String(required=True, validate=validate.OneOf(['delivery', 'pickup']))
    MaDiaChi = fields.String(load_default=None, allow_none=True, validate=validate.Regexp(r'^[1-9][0-9]{0,18}$'))
    GhiChu = fields.String(load_default='', validate=validate.Length(max=2000))
    # Detect a changed quote instead of charging a different amount silently.
    TongThanhToan = fields.String(required=True, validate=validate.Regexp(r'^(0|[1-9][0-9]{0,18})$'))

    @validates_schema(pass_original=True)
    def validate_redemption(self, data, original_data, **kwargs):
        if type(original_data.get('DoiDiem', False)) is not bool:
            raise ValidationError('DoiDiem must be boolean.')

    @validates_schema
    def validate_selection(self, data, **kwargs):
        if len(set(data['MaDonGia'])) != len(data['MaDonGia']):
            raise ValidationError('Duplicate units.')
        if data['HinhThucNhanHang'] == 'delivery' and not data['MaDiaChi']:
            raise ValidationError('Delivery address required.')


class ReorderCheckoutSchema(OrderCreateSchema, OrderReorderSchema):
    class Meta:
        exclude = ('MaDonGia',)

    @validates_schema
    def validate_selection(self, data, **kwargs):
        if data['HinhThucNhanHang'] == 'delivery' and not data['MaDiaChi']:
            raise ValidationError('Delivery address required.')
