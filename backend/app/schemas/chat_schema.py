from marshmallow import Schema, fields, validate, validates_schema, ValidationError


class ChatQuerySchema(Schema):
    before = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(min=1, max=9223372036854775807))


class ChatQueueSchema(Schema):
    search = fields.String(load_default='', validate=validate.Length(max=100))
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))


class ChatUnitSchema(Schema):
    MaThuoc = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))
    MaDonGia = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))
    SoLuong = fields.Integer(load_default=1, strict=True, validate=validate.Range(min=1, max=2147483647))


class ChatSendSchema(Schema):
    request_id = fields.UUID(required=True)
    kind = fields.String(required=True, validate=validate.OneOf(['text', 'image', 'product', 'offer']))
    text = fields.String(validate=validate.Length(min=1, max=4000))
    url = fields.String(validate=validate.Length(min=1, max=2000))
    items = fields.List(fields.Nested(ChatUnitSchema), validate=validate.Length(min=1, max=30))

    @validates_schema
    def content(self, data, **kwargs):
        expected = {'text': {'text'}, 'image': {'url'}, 'product': {'items'}, 'offer': {'items'}}[data['kind']]
        if set(data) - {'kind', 'request_id'} != expected:
            raise ValidationError('Invalid message content.')
        if data['kind'] == 'text' and (not data['text'].strip() or '\0' in data['text']):
            raise ValidationError('Invalid text.')
        if 'items' in data and (len({line['MaDonGia'] for line in data['items']}) != len(data['items'])
                               or (data['kind'] == 'product' and len(data['items']) != 1)):
            raise ValidationError('Invalid products.')


class ChatReadSchema(Schema):
    last_id = fields.String(required=True, validate=validate.Regexp(r'^[1-9][0-9]{0,18}$'))


class AiChatSchema(Schema):
    request_id = fields.UUID(load_default=None, allow_none=True)
    text = fields.String(required=True, validate=validate.Length(min=1, max=2000))

    @validates_schema
    def content(self, data, **kwargs):
        if not data['text'].strip() or '\0' in data['text']:
            raise ValidationError('Invalid text.')
