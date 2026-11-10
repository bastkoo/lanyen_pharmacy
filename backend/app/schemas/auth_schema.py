from marshmallow import Schema, ValidationError, fields, validate, validates


class FirebaseLoginSchema(Schema):
    id_token = fields.String(required=True, validate=validate.Length(min=1, max=16384))
    ho_ten = fields.String(required=False, allow_none=False, validate=validate.Length(max=255))

    @validates("ho_ten")
    def validate_name(self, value, **kwargs):
        if not value.strip() or any(ord(char) < 32 for char in value):
            raise ValidationError("Họ tên không được trống hoặc chứa ký tự điều khiển.")


class UserSchema(Schema):
    MaNguoiDung = fields.Integer()
    HoTen = fields.String()
    SDT = fields.String()
    VaiTro = fields.Integer()
    TrangThai = fields.Boolean()
    Email = fields.String(allow_none=True)
    AnhDaiDien = fields.String(allow_none=True)
