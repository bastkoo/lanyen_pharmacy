import re

from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema


class PromotionSchema(Schema):
    MaChuongTrinh = fields.Integer(dump_only=True)
    TenChuongTrinh = fields.String(required=True, validate=validate.Length(min=1, max=255))
    NgayBatDau = fields.Date(required=True)
    NgayKetThuc = fields.Date(required=True)

    @pre_load
    def normalize_values(self, data, **kwargs):
        data = dict(data)
        name = data.get('TenChuongTrinh')
        if isinstance(name, str):
            if '\x00' in name:
                raise ValidationError({'TenChuongTrinh': ['Invalid text']})
            data['TenChuongTrinh'] = name.strip()
        for key in ('NgayBatDau', 'NgayKetThuc'):
            if key in data and (not isinstance(data[key], str) or
                                not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', data[key])):
                raise ValidationError({key: ['Use YYYY-MM-DD']})
        return data

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if data['NgayKetThuc'] < data['NgayBatDau']:
            raise ValidationError({'NgayKetThuc': ['Must not precede NgayBatDau']})
