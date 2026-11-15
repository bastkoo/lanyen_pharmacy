from marshmallow import Schema, ValidationError, fields, pre_load, validate

from app.schemas.auth_schema import OtpRequestSchema, UserSchema
from app.schemas.product_schema import https_url
from app.schemas.unit_schema import UnitQuerySchema
from app.services.otp_service import AuthError, normalize_phone


class AccountSchema(Schema):
    HoTen = fields.String(required=True, validate=validate.Length(min=1, max=255))
    SDT = fields.String(required=True, validate=validate.Length(min=1, max=15))
    VaiTro = fields.Integer(required=True, strict=True, validate=validate.OneOf([1, 2]))
    Email = fields.Email(allow_none=True, validate=validate.Length(max=255))
    AnhDaiDien = fields.String(allow_none=True, validate=https_url)

    @pre_load
    def normalize_values(self, data, **kwargs):
        data = dict(data)
        if 'VaiTro' in data and type(data['VaiTro']) is not int:
            raise ValidationError({'VaiTro': ['Must be an integer']})
        for key in ('HoTen', 'Email', 'AnhDaiDien'):
            value = data.get(key)
            if isinstance(value, str):
                if any(ord(char) < 32 for char in value):
                    raise ValidationError({key: ['Invalid text']})
                data[key] = value.strip()
                if key != 'HoTen' and not data[key]:
                    data[key] = None
        if 'SDT' in data:
            try:
                raw = OtpRequestSchema().load({'phone': data['SDT']})['phone']
                data['SDT'] = normalize_phone(raw)
            except (ValidationError, AuthError):
                raise ValidationError({'SDT': ['Invalid phone']}) from None
        return data


class AccountCreateSchema(AccountSchema):
    Email = fields.Email(allow_none=True, load_default=None, validate=validate.Length(max=255))
    AnhDaiDien = fields.String(allow_none=True, load_default=None, validate=https_url)


class AccountStatusSchema(Schema):
    TrangThai = fields.Boolean(required=True)

    @pre_load
    def strict_status(self, data, **kwargs):
        if 'TrangThai' in data and type(data['TrangThai']) is not bool:
            raise ValidationError({'TrangThai': ['Must be a boolean']})
        return data


class AccountQuerySchema(UnitQuerySchema):
    search = fields.String(load_default='', validate=validate.Length(max=255))
    role = fields.Integer(validate=validate.OneOf([1, 2]))
    status = fields.String(validate=validate.OneOf(['true', 'false']))

    @pre_load
    def normalize_search(self, data, **kwargs):
        data = dict(data)
        if 'search' in data:
            if '\x00' in data['search']:
                raise ValidationError({'search': ['Invalid text']})
            data['search'] = data['search'].strip()
        return data


# Use Module 01's existing seven-field public account representation.
AccountOutputSchema = UserSchema
