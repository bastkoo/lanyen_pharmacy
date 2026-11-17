from marshmallow import Schema, fields, pre_load, validate, ValidationError


class AddressSchema(Schema):
    TinhThanh = fields.String(required=True, validate=validate.Length(min=1, max=255))
    PhuongXa = fields.String(required=True, validate=validate.Length(min=1, max=255))
    DiaChiCuThe = fields.String(required=True, validate=validate.Length(min=1, max=255))

    @pre_load
    def normalize(self, data, **kwargs):
        data = dict(data)
        for key in ('TinhThanh', 'PhuongXa', 'DiaChiCuThe'):
            value = data.get(key)
            if isinstance(value, str):
                if any(ord(char) < 32 for char in value):
                    raise ValidationError('Invalid text')
                data[key] = value.strip()
        return data


class AddressOutputSchema(AddressSchema):
    MaDiaChi = fields.Integer(dump_only=True)
    DiaChiGiao = fields.Boolean(dump_only=True)
