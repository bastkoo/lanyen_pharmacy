"""Unpaid QR expiry; safe to run concurrently in multiple server processes."""
from datetime import datetime, timedelta, timezone
from threading import Event, Thread, Lock
import atexit

import click
from app.extensions import db
from app.repositories import don_hang_repository as orders
from app.services.auth_service import AuthError

_worker_lock = Lock()


def vietnam_now():
    return datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None)


def overdue(order, now=None):
    placed = getattr(order, 'NgayDat', None)
    return bool(placed and order.TrangThaiDonHang == 0 and order.TrangThaiThanhToan == 0
                and order.PhuongThucThanhToan == 1 and placed < (now or vietnam_now()) - timedelta(hours=24))


def expire_due(now=None):
    from app.services.order_service import cancel
    cutoff = (now or vietnam_now()) - timedelta(hours=24)
    cursor, cancelled, review = 0, 0, 0
    while True:
        candidates = orders.expired_candidates(cutoff, cursor)
        if not candidates:
            break
        for order_id, owner_id in candidates:
            cursor = order_id
            try:
                cancel(owner_id, order_id, expired_before=cutoff)
                cancelled += 1
            except AuthError as error:
                if error.code == 'ORDER_REFUND_REVIEW_REQUIRED':
                    review += 1
                elif error.code not in ('ORDER_NOT_EXPIRED', 'ORDER_NOT_CANCELLABLE', 'ORDER_NOT_FOUND'):
                    raise
    return {'cancelled': cancelled, 'review_required': review}


def start_worker(app):
    with _worker_lock:
        if app.testing or 'order_expiry_worker' in app.extensions:
            return
        app.extensions['order_expiry_worker'] = True
    stop = Event()
    def work():
        while not stop.is_set():
            with app.app_context():
                try:
                    result = expire_due()
                    if result['cancelled'] or result['review_required']:
                        app.logger.info('Order expiry: cancelled=%s review_required=%s', result['cancelled'], result['review_required'])
                except Exception as error:
                    db.session.rollback()
                    app.logger.error('Order expiry failed: %s', getattr(error, 'code', type(error).__name__))
                finally:
                    db.session.remove()
            stop.wait(60)
    worker = Thread(target=work, name='order-expiry', daemon=True)
    app.extensions['order_expiry_worker'] = worker
    atexit.register(stop.set)
    worker.start()


def register_cli(app):
    @app.cli.command('expire-unpaid-orders')
    @click.option('--watch', is_flag=True, help='Check every 60 seconds until stopped.')
    def expire_command(watch):
        stop = Event()
        try:
            while True:
                try:
                    click.echo(expire_due())
                finally:
                    db.session.remove()
                if not watch:
                    break
                stop.wait(60)
        except KeyboardInterrupt:
            stop.set()
