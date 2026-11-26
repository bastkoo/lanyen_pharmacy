"""Payload riêng cho API Mobile, tái sử dụng quy tắc tên/điện thoại của Web."""
from marshmallow import Schema, fields, validate

from app.schemas.auth_schema import RegisterSchema


class MobileOtpVerifySchema(Schema):
    challenge_token = fields.String(required=True, validate=validate.Length(min=1, max=4096))
    otp = fields.String(required=True, validate=validate.Regexp(r"^[0-9]{6}$"))


class MobileRegisterSchema(RegisterSchema):
    registration_token = fields.String(required=True, validate=validate.Length(min=1, max=4096))


class MobileRefreshSchema(Schema):
    refresh_token = fields.String(required=True, validate=validate.Length(min=1, max=4096))
