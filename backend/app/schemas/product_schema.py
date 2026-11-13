from urllib.parse import urlsplit

from marshmallow import Schema, ValidationError, fields, pre_load, validate


def required_text(max_length=None):
    return fields.String(required=True, validate=validate.Length(min=1, max=max_length))


def https_url(value):
    validate.URL(schemes={'https'})(value)
    try:
        parsed = urlsplit(value)
        parsed.port  # Reject malformed/out-of-range ports.
        if parsed.scheme != 'https' or any(char.isspace() for char in value) or '\\' in value:
            raise ValueError
    except ValueError:
        raise ValidationError('Invalid HTTPS URL') from None


class ProductSchema(Schema):
    MaThuoc = fields.Integer(dump_only=True)
    MaLoaiThuoc = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))
    HinhAnh = fields.String(required=True, validate=https_url)
    TenThuoc = required_text(255)
    MoTa = required_text()
    MaDuoc = required_text(50)
    SoDangKy = required_text(100)
    DangBaoChe = required_text(255)
    QuyCachDongGoi = required_text(255)
    NhaSanXuat = required_text(255)
    NuocSanXuat = required_text(255)
    CachDung = required_text()
    ChongChiDinh = required_text()
    BaoQuan = required_text()
    NguongTonKho = fields.Integer(required=True, strict=True, validate=validate.Range(min=0, max=2147483647))
    PhanLoai = fields.Boolean()

    @pre_load
    def validate_types_and_trim(self, data, **kwargs):
        data = dict(data)
        for key in ('MaLoaiThuoc', 'NguongTonKho'):
            if key in data and type(data[key]) is not int:
                raise ValidationError({key: ['Must be an integer']})
        if 'PhanLoai' in data and type(data['PhanLoai']) is not bool:
            raise ValidationError({'PhanLoai': ['Must be a boolean']})
        for key, value in data.items():
            if isinstance(value, str):
                if '\x00' in value:
                    raise ValidationError({key: ['Invalid text']})
                data[key] = value.strip()
        return data


class ProductCreateSchema(ProductSchema):
    PhanLoai = fields.Boolean(load_default=False)


class ProductQuerySchema(Schema):
    search = fields.String(load_default='', validate=validate.Length(max=255))
    category_id = fields.Integer(validate=validate.Range(min=1, max=2147483647))
    phan_loai = fields.String(validate=validate.OneOf(['true', 'false']))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    sort_by = fields.String(load_default='MaThuoc', validate=validate.OneOf(
        ['MaThuoc', 'TenThuoc', 'MaDuoc', 'SoDangKy', 'MaLoaiThuoc', 'NguongTonKho', 'PhanLoai']))
    sort_order = fields.String(load_default='asc', validate=validate.OneOf(['asc', 'desc']))
