from app.repositories import lo_thuoc_repository as batches
from app.repositories import thuoc_repository as products
from app.schemas.batch_schema import BatchSchema
from app.services.product_service import ProductError, database_operation, require_product


def require_batch(product_id, batch_id, for_update=False):
    batch = batches.find_by_id(product_id, batch_id, for_update=for_update)
    if batch is None or batch.MaThuoc != product_id:
        raise ProductError('BATCH_NOT_FOUND', 404)
    return batch


def page_data(items, total, page, per_page):
    return dict(items=items, total=total, page=page, per_page=per_page,
                pages=(total + per_page - 1) // per_page)


@database_operation
def list_batches(product_id, page, per_page):
    require_product(product_id)
    items, total = batches.list_batches(product_id, page, per_page)
    return page_data(BatchSchema(many=True).dump(items), total, page, per_page)


@database_operation
def get_batch(product_id, batch_id):
    require_product(product_id)
    return BatchSchema().dump(require_batch(product_id, batch_id))


@database_operation
def create_batch(product_id, data):
    require_product(product_id)
    result = BatchSchema().dump(batches.create(product_id, data))
    products.commit()
    return result


@database_operation
def update_batch(product_id, batch_id, data):
    require_product(product_id)
    batch = require_batch(product_id, batch_id, for_update=True)
    if not 0 <= batch.SoLuongTon <= batch.SoLuongNhap:
        raise ProductError('BATCH_STOCK_INCONSISTENT', 409)
    if 'SoLuongNhap' in data and data['SoLuongNhap'] != batch.SoLuongNhap:
        raise ProductError('BATCH_QUANTITY_IMMUTABLE', 409)
    result = BatchSchema().dump(batches.update(batch, data))
    products.commit()
    return result


@database_operation
def delete_batch(product_id, batch_id):
    require_product(product_id)
    require_batch(product_id, batch_id)
    # There is no per-batch dispatch/audit history in the approved schema.
    # Even stock == received cannot prove that the batch was never dispatched.
    raise ProductError('BATCH_DELETE_UNSAFE', 409)
