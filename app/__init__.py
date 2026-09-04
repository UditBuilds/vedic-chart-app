"""Flask application factory for the Vedic chart service."""

from __future__ import annotations

from dotenv import load_dotenv
from flask import Flask


def create_app() -> Flask:
    """Build the Flask app."""
    # Load .env once at app startup. Real shell environment variables win (override=False).
    load_dotenv()

    app = Flask(__name__)
    # Preserve the key order of the chart payload; it reads far better when a
    # human inspects the response by eye.
    app.json.sort_keys = False

    from app.routes import bp

    app.register_blueprint(bp)
    return app
