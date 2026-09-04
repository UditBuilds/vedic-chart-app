"""Development entry point.

For anything beyond local development, run under a WSGI server, e.g.
    waitress-serve --port=5000 "app:create_app()"
"""

import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    # NOTE: Next.js proxy routes (frontend/src/app/api/v1/**) default to
    # http://127.0.0.1:5000 unless BACKEND_URL is set in frontend environment.
    # If FLASK_PORT is changed here or in .env, ensure BACKEND_URL in
    # frontend matches, otherwise the Next.js proxy cannot reach the backend.
    port = int(os.environ.get("FLASK_PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=True)
