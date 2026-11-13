import re

from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.schemas.unit_schema import UnitQuerySchema


class BatchSchema(Schema):
    MaLo = fields.Integer(dump_only=True)
    MaThuoc = fields.Integer(dump_only=True)
    SoLuongTon = fields.Integer(dump_only=True)
    SoLoSanXuat = fields.String(required=True, validate=validate.Length(min=1, max=100))
    NgaySanXuat = fields.Date(required=True)
    HanSuDung = fields.Date(required=True)
    GiaNhap = fields.Integer(required=True, strict=True, validate=validate.Range(min=0, max=2147483647))
    SoLuongNhap = fields.Integer(strict=True, validate=validate.Range(min=1, max=2147483647))

    @pre_load
    def validate_values(self, data, **kwargs):
        data = dict(data)
        for key in ('GiaNhap', 'SoLuongNhap'):
            if key in data and type(data[key]) is not int:
                raise ValidationError({key: ['Must be an integer']})
        for key in ('NgaySanXuat', 'HanSuDung'):
            if key in data and (not isinstance(data[key], str) or
                                not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', data[key])):
                raise ValidationError({key: ['Use YYYY-MM-DD']})
        name = data.get('SoLoSanXuat')
        if isinstance(name, str):
            if '\x00' in name:
                raise ValidationError({'SoLoSanXuat': ['Invalid text']})
            data['SoLoSanXuat'] = name.strip()
        return data

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if data['HanSuDung'] <= data['NgaySanXuat']:
            raise ValidationError({'HanSuDung': ['Must be after NgaySanXuat']})


class BatchCreateSchema(BatchSchema):
    SoLuongNhap = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))


class InventorySummarySchema(Schema):
    MaThuoc = fields.Integer()
    TenThuoc = fields.String()
    TongSoLuongTon = fields.Integer()
    NguongTonKho = fields.Integer()
    TonKhoThap = fields.Boolean()


class ExpirySchema(BatchSchema):
    TenThuoc = fields.String(dump_only=True)
    TrangThaiHan = fields.String(dump_only=True)


class ExpiryQuerySchema(UnitQuerySchema):
    days = fields.Integer(load_default=30, validate=validate.Range(min=0, max=36500))
    status = fields.String(load_default='expiring', validate=validate.OneOf(['expiring', 'expired']))
