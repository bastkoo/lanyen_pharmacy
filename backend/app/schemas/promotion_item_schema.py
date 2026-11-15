from decimal import Decimal

from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema


MAX_DISCOUNT = Decimal('9999999999.99')


class PromotionItemSchema(Schema):
    MaChuongTrinh = fields.Integer(dump_only=True)
    MaThuoc = fields.Integer(dump_only=True)
    SoLuong = fields.Integer(dump_only=True)
    LoaiGiamGia = fields.Boolean(required=True)
    GiaTriGiam = fields.Decimal(required=True, as_string=True, places=2, allow_nan=False,
                               validate=validate.Range(min=Decimal('0'), max=MAX_DISCOUNT))

    @pre_load
    def validate_types(self, data, **kwargs):
        data = dict(data)
        if 'LoaiGiamGia' in data and type(data['LoaiGiamGia']) is not bool:
            raise ValidationError({'LoaiGiamGia': ['Must be a boolean']})
        for key in ('MaThuoc', 'SoLuong'):
            if key in data and type(data[key]) is not int:
                raise ValidationError({key: ['Must be an integer']})
        if 'GiaTriGiam' in data:
            raw = data['GiaTriGiam']
            if type(raw) not in (int, float):
                raise ValidationError({'GiaTriGiam': ['Must be a JSON number']})
            amount = Decimal(str(raw))
            if (not amount.is_finite() or not Decimal('0') <= amount <= MAX_DISCOUNT or
                    amount != amount.quantize(Decimal('0.01'))):
                raise ValidationError({'GiaTriGiam': ['Invalid amount or precision']})
            if data.get('LoaiGiamGia') is True and type(raw) is not int:
                raise ValidationError({'GiaTriGiam': ['Percentage must be an integer']})
        return data

    @validates_schema
    def validate_percentage(self, data, **kwargs):
        if data['LoaiGiamGia'] and not Decimal('1') <= data['GiaTriGiam'] <= Decimal('100'):
            raise ValidationError({'GiaTriGiam': ['Percentage must be between 1 and 100']})


class PromotionItemCreateSchema(PromotionItemSchema):
    MaThuoc = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))
    SoLuong = fields.Integer(required=True, strict=True, validate=validate.Range(min=0, max=2147483647))
