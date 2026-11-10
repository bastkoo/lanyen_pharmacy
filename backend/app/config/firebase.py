"""Firebase initialization; credential contents must never be logged."""
from threading import Lock

import firebase_admin
from firebase_admin import credentials


_init_lock = Lock()


def get_firebase_app(app):
    # Lazy initialization also lets isolated tests run without real credentials.
    with _init_lock:
        if "firebase_admin" not in app.extensions:
            try:
                instance = firebase_admin.get_app("lanyen")
            except ValueError:
                path = app.config.get("FIREBASE_CREDENTIALS_PATH")
                credential = credentials.Certificate(path) if path else credentials.ApplicationDefault()
                options = {}
                if app.config.get("FIREBASE_PROJECT_ID"):
                    options["projectId"] = app.config["FIREBASE_PROJECT_ID"]
                instance = firebase_admin.initialize_app(credential, options, name="lanyen")
            app.extensions["firebase_admin"] = instance
        return app.extensions["firebase_admin"]
