from datetime import datetime, timedelta, timezone

from app.repositories import inventory_repository as inventory
from app.schemas.batch_schema import ExpirySchema, InventorySummarySchema
from app.services.batch_service import page_data
from app.services.product_service import database_operation
from app.services.auth_service import AuthError


def current_date():
    return datetime.now(timezone(timedelta(hours=7))).date()


def usable_stock(product_ids):
    return inventory.usable_totals(product_ids, current_date())


def deduct_order_stock(required):
    """Debit base-unit quantities inside the caller's order transaction.

    Lock/recheck real batch balances; an earlier cart quote never authorizes an
    oversell. Validate every product before changing any batch. No commit here.
    """
    if not required or any(type(count) is not int or count <= 0 for count in required.values()):
        raise AuthError('OUT_OF_STOCK', 409)
    batches = inventory.lock_usable_batches_fifo(list(required), current_date())
    totals = {}
    for batch in batches:
        totals[batch.MaThuoc] = totals.get(batch.MaThuoc, 0) + batch.SoLuongTon
    if any(count > totals.get(product, 0) for product, count in required.items()):
        raise AuthError('OUT_OF_STOCK', 409)
    remaining = dict(required)
    for batch in batches:
        amount = min(remaining[batch.MaThuoc], batch.SoLuongTon)
        batch.SoLuongTon -= amount
        remaining[batch.MaThuoc] -= amount


@database_operation
def summary(page, per_page, low_stock=False):
    items, total = inventory.summary(page, per_page, low_stock=low_stock)
    return page_data(InventorySummarySchema(many=True).dump(items), total, page, per_page)


@database_operation
def expiring(days, status, page, per_page):
    today = current_date()
    until = today + timedelta(days=days)
    items, total = inventory.expiring(today, until, status, page, per_page)
    items = [dict(item, TrangThaiHan='EXPIRED' if status == 'expired' else 'EXPIRING') for item in items]
    return dict(page_data(ExpirySchema(many=True).dump(items), total, page, per_page),
                as_of=today.isoformat(), days=days, status=status)
