from datetime import datetime, timedelta, timezone

from app.repositories import inventory_repository as inventory
from app.schemas.batch_schema import ExpirySchema, InventorySummarySchema
from app.services.batch_service import page_data
from app.services.product_service import database_operation


def current_date():
    return datetime.now(timezone(timedelta(hours=7))).date()


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
