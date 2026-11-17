from marshmallow import Schema, ValidationError, fields, validate, validates, pre_load
from app.schemas.product_schema import https_url


class OtpRequestSchema(Schema):
    phone = fields.String(required=True, validate=validate.Length(min=1, max=24))


class OtpVerifySchema(OtpRequestSchema):
    otp = fields.String(required=True, validate=validate.Regexp(r'^[0-9]{6}$'))


class RegisterSchema(Schema):
    ho_ten = fields.String(required=True, validate=validate.Length(min=1, max=255))

    @validates('ho_ten')
    def validate_name(self, value, **kwargs):
        if not value.strip() or any(ord(char) < 32 for char in value):
            raise ValidationError('Invalid name')


class UserSchema(Schema):
    MaNguoiDung = fields.Integer()
    HoTen = fields.String()
    SDT = fields.String()
    VaiTro = fields.Integer()
    TrangThai = fields.Boolean()
    Email = fields.String(allow_none=True)
    AnhDaiDien = fields.String(allow_none=True)


class ProfileSchema(Schema):
    HoTen = fields.String(required=True, validate=validate.Length(min=1, max=255))
    AnhDaiDien = fields.String(required=True, allow_none=True, validate=https_url)

    @pre_load
    def normalize(self, data, **kwargs):
        data = dict(data)
        for key in ('HoTen', 'AnhDaiDien'):
            value = data.get(key)
            if isinstance(value, str):
                if any(ord(char) < 32 for char in value):
                    raise ValidationError('Invalid text')
                data[key] = value.strip()
        if data.get('AnhDaiDien') == '':
            data['AnhDaiDien'] = None
        return data
