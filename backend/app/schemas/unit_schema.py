from marshmallow import Schema, ValidationError, fields, pre_load, validate


class UnitSchema(Schema):
    MaDonGia = fields.Integer(dump_only=True)
    MaThuoc = fields.Integer(dump_only=True)
    DonViTinh = fields.String(required=True, validate=validate.Length(min=1, max=50))
    GiaBan = fields.Integer(required=True, strict=True, validate=validate.Range(min=0, max=2147483647))
    SoLuongQuyDoi = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))

    @pre_load
    def validate_values(self, data, **kwargs):
        data = dict(data)
        for key in ('GiaBan', 'SoLuongQuyDoi'):
            if key in data and type(data[key]) is not int:
                raise ValidationError({key: ['Must be an integer']})
        name = data.get('DonViTinh')
        if isinstance(name, str):
            if '\x00' in name:
                raise ValidationError({'DonViTinh': ['Invalid text']})
            data['DonViTinh'] = name.strip()
        return data


class UnitQuerySchema(Schema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
