"""Development entry point.

For anything beyond local development, run under a WSGI server, e.g.
    waitress-serve --port=5000 "app:create_app()"
"""

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
