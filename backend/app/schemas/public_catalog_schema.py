from marshmallow import Schema, ValidationError, fields, pre_load, validate


class PublicCategoryQuerySchema(Schema):
    search = fields.String(load_default='', validate=validate.Length(max=255))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))
    per_page = fields.Integer(load_default=100, validate=validate.Range(min=1, max=100))

    @pre_load
    def trim_search(self, data, **kwargs):
        data = dict(data)
        if '\x00' in data.get('search', ''):
            raise ValidationError({'search': ['Invalid text']})
        if 'search' in data:
            data['search'] = data['search'].strip()
        return data


class PublicProductQuerySchema(PublicCategoryQuerySchema):
    category_id = fields.Integer(validate=validate.Range(min=1, max=2147483647))
    ke_don = fields.String(validate=validate.OneOf(['true', 'false']))
    sort_order = fields.String(load_default='asc', validate=validate.OneOf(['asc', 'desc']))
    per_page = fields.Integer(load_default=12, validate=validate.Range(min=1, max=100))


class PublicProductSchema(Schema):
    """Public browsing fields; internal stock thresholds remain private."""
    MaThuoc = fields.Integer(dump_only=True)
    MaLoaiThuoc = fields.Integer(dump_only=True)
    TenThuoc = fields.String(dump_only=True)
    HinhAnh = fields.String(dump_only=True)
    MoTa = fields.String(dump_only=True)
    QuyCachDongGoi = fields.String(dump_only=True)
    NhaSanXuat = fields.String(dump_only=True)
    NuocSanXuat = fields.String(dump_only=True)
    KeDon = fields.Boolean(dump_only=True)


class PublicPromotionQuerySchema(Schema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))
    per_page = fields.Integer(load_default=12, validate=validate.Range(min=1, max=100))
