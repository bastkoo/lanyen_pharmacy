from app import create_app

app = create_app()

if __name__ == "__main__":
    import os
    from app.services.order_expiry_service import start_worker
    if app.config['APP_ENV'] != 'development' or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        start_worker(app)
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=app.config["APP_ENV"] == "development"
    )
