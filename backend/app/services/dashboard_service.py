from datetime import datetime, time, timedelta

from app.repositories import dashboard_repository as dashboard
from app.schemas.dashboard_schema import RecentOrderSchema
from app.services.inventory_service import current_date
from app.services.product_service import database_operation


@database_operation
def summary(days):
    start, end, period = date_range(days)
    values = dict(dashboard.counts(start, end))
    amount = str(int(values.pop('revenue')))
    return dict(values, period=period, revenue=dict(available=True, amount=amount,
                order_status=3, payment_status=1, amount_field='TongThanhToan', date_field='NgayDat'))


@database_operation
def recent_orders(days, limit):
    start, end, period = date_range(days)
    return dict(items=RecentOrderSchema(many=True).dump(dashboard.recent_orders(start, end, limit)),
                limit=limit, period=period, timestamp_basis='vietnam_wall_time')


def date_range(days):
    today = current_date()
    first = today - timedelta(days=days - 1)
    start = datetime.combine(first, time.min)
    end = datetime.combine(today + timedelta(days=1), time.min)
    return start, end, dict(days=days, start_date=first.isoformat(), end_date=today.isoformat(),
                            timezone='Asia/Ho_Chi_Minh')


@database_operation
def revenue(days):
    start, end, period = date_range(days)
    rows = dashboard.revenue_series(start, end)
    by_day = {row['day']: int(row['amount']) for row in rows}
    points = [dict(date=(start.date() + timedelta(days=index)).isoformat(),
                   amount=str(by_day.get(start.date() + timedelta(days=index), 0))) for index in range(days)]
    return dict(items=points, period=period, has_data=bool(rows),
                total=str(sum(by_day.values())), order_status=3, payment_status=1)

