from flask import jsonify, request
from marshmallow import ValidationError

from app.schemas.dashboard_schema import DashboardQuerySchema, RecentOrdersQuerySchema
from app.services import dashboard_service
from app.services.product_service import ProductError


def summary():
    return jsonify(code='DASHBOARD_SUMMARY', **dashboard_service.summary(**query(DashboardQuerySchema)))


def recent_orders():
    return jsonify(code='RECENT_ORDERS_LISTED', **dashboard_service.recent_orders(**query(RecentOrdersQuerySchema)))


def revenue():
    return jsonify(code='REVENUE_LISTED', **dashboard_service.revenue(**query(DashboardQuerySchema)))


def query(schema):
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Repeated parameters')
        return schema().load(request.args.to_dict())
    except ValidationError:
        raise ProductError('INVALID_REQUEST', 400) from None
