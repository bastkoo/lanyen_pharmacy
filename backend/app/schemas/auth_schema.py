from marshmallow import Schema, ValidationError, fields, validate, validates


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
