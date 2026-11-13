from flask import jsonify, request
from marshmallow import ValidationError

from app.controllers.product_controller import payload
from app.schemas.batch_schema import BatchCreateSchema, BatchSchema, ExpiryQuerySchema
from app.schemas.unit_schema import UnitQuerySchema
from app.services import batch_service, inventory_service
from app.services.product_service import ProductError


def query_payload(schema=UnitQuerySchema):
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Repeated parameters')
        return schema().load(request.args.to_dict())
    except ValidationError:
        raise ProductError('INVALID_REQUEST', 400) from None


def list_batches(product_id):
    return jsonify(code='BATCHES_LISTED', **batch_service.list_batches(product_id, **query_payload()))


def get_batch(product_id, batch_id):
    return jsonify(code='BATCH_FOUND', batch=batch_service.get_batch(product_id, batch_id))


def create_batch(product_id):
    return jsonify(code='BATCH_CREATED', batch=batch_service.create_batch(product_id, payload(BatchCreateSchema))), 201


def update_batch(product_id, batch_id):
    return jsonify(code='BATCH_UPDATED', batch=batch_service.update_batch(product_id, batch_id, payload(BatchSchema)))


def delete_batch(product_id, batch_id):
    batch_service.delete_batch(product_id, batch_id)


def summary():
    return jsonify(code='INVENTORY_SUMMARY', **inventory_service.summary(**query_payload()))


def low_stock():
    return jsonify(code='LOW_STOCK_LISTED', **inventory_service.summary(low_stock=True, **query_payload()))


def expiring():
    filters = query_payload(ExpiryQuerySchema)
    code = 'EXPIRED_BATCHES_LISTED' if filters['status'] == 'expired' else 'EXPIRING_BATCHES_LISTED'
    return jsonify(code=code, **inventory_service.expiring(**filters))
