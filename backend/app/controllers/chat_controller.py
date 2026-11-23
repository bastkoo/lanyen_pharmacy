from flask import g, request, jsonify
from marshmallow import ValidationError

from app.schemas.chat_schema import ChatQuerySchema, ChatQueueSchema, ChatSendSchema, ChatReadSchema
from app.services import chat_service as service
from app.services.auth_service import AuthError
from app.utils.image_validator import ImageError


def respond(callback, schema=None, query=False):
    try:
        if query:
            if any(len(values) != 1 for _, values in request.args.lists()):
                raise ValidationError('Duplicate parameter.')
            values = schema().load(request.args.to_dict())
        elif schema:
            if request.args or not request.is_json or not isinstance(request.get_json(silent=True), dict):
                raise ValidationError('Object required.')
            values = schema().load(request.get_json())
        else:
            if request.args or (request.get_data() and request.get_json(silent=True) != {}):
                raise ValidationError('Empty request required.')
            values = {}
        return jsonify(code='CHAT_OK', **(callback(values) or {}))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except (AuthError, ImageError) as error:
        return jsonify(code=error.code), error.status


def history(thread_id=None):
    return respond(lambda values: service.history(g.current_user, thread_id, **values), ChatQuerySchema, query=True)


def queue():
    return respond(lambda values: service.queue(g.current_user, **values), ChatQueueSchema, query=True)


def unread():
    return respond(lambda _: service.unread(g.current_user))


def send(thread_id=None):
    return respond(lambda values: dict(message=service.send(g.current_user, values, thread_id)), ChatSendSchema)


def read(thread_id=None):
    return respond(lambda values: service.read(g.current_user, thread_id=thread_id, **values), ChatReadSchema)


def claim(thread_id):
    return respond(lambda _: dict(thread=service.claim(g.current_user, thread_id)))


def finish(thread_id):
    return respond(lambda _: dict(thread=service.claim(g.current_user, thread_id, finish=True)))


def purchase(message_id):
    return respond(lambda _: service.purchase(g.current_user, message_id))


def upload(thread_id=None):
    try:
        if request.args or request.mimetype != 'multipart/form-data' or request.form or set(request.files) != {'image'} or len(request.files.getlist('image')) != 1:
            raise ImageError('IMAGE_REQUIRED', 400)
        return jsonify(code='CHAT_OK', data=service.upload(g.current_user, request.files['image'], thread_id))
    except (AuthError, ImageError) as error:
        return jsonify(code=error.code), error.status
