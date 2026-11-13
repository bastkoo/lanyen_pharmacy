from marshmallow import Schema, ValidationError, fields, pre_load


class CategorySchema(Schema):
    MaLoaiThuoc = fields.Integer(dump_only=True)
    TenLoaiThuoc = fields.String(required=True)

    @pre_load
    def normalize_name(self, data, **kwargs):
        data = dict(data)
        name = data.get('TenLoaiThuoc')
        if not isinstance(name, str):
            raise ValidationError('Invalid category name')
        name = ' '.join(name.split())
        if not name or len(name) > 255 or '\x00' in name:
            raise ValidationError('Invalid category name')
        data['TenLoaiThuoc'] = name
        return data
