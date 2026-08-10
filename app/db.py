"""SQLite persistence for cached charts and conversation history.

Two tables, deliberately:

``charts``
    Natal placements and the Vimshottari timeline. These are a function of the
    birth moment alone, so they are computed once and cached forever.
    **Transits are not stored here.** They go stale within hours and are
    recomputed on every turn -- caching them would be a correctness bug, not an
    optimisation.

``messages``
    Raw conversation turns. No summarisation, no embeddings, no extracted
    "life facts" table. The chat layer reads a sliding window of the most
    recent turns and nothing else.

There is one hardcoded user for v1 (see :data:`DEFAULT_USER_ID`). Multi-tenancy
is not built until there is a second real user.
"""

from __future__ import annotations

import datetime as _dt
import json
import sqlite3
from pathlib import Path
from typing import Any, Final

#: v1 has no auth. One user, named so the intent is obvious in the data.
DEFAULT_USER_ID: Final[str] = "test-user"

#: How many individual messages (not exchanges) the chat layer replays.
#: Ten exchanges = twenty rows.
HISTORY_WINDOW: Final[int] = 20

DEFAULT_DB_PATH: Final[Path] = Path(__file__).resolve().parent.parent / "vedic_chat.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS charts (
    user_id     TEXT PRIMARY KEY,
    birth_date  TEXT NOT NULL,
    birth_time  TEXT NOT NULL,
    lat         REAL NOT NULL,
    lon         REAL NOT NULL,
    tz_offset   REAL NOT NULL,
    chart_json  TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages (user_id, id);
"""


def connect(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Open the database, creating the schema if this is a first run."""
    path = Path(db_path) if db_path is not None else DEFAULT_DB_PATH
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.executescript(_SCHEMA)
    connection.commit()
    return connection


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------
# Charts
# --------------------------------------------------------------------------
def save_chart(
    connection: sqlite3.Connection,
    user_id: str,
    birth: Any,
    chart: dict[str, Any],
) -> None:
    """Cache the natal chart for ``user_id``, replacing any existing row.

    ``chart`` is stored with its ``transits`` key stripped. Storing a transit
    snapshot would mean serving yesterday's sky tomorrow; the chat layer always
    recomputes them.
    """
    natal_only = {k: v for k, v in chart.items() if k != "transits"}
    connection.execute(
        """
        INSERT INTO charts (user_id, birth_date, birth_time, lat, lon,
                            tz_offset, chart_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            birth_date = excluded.birth_date,
            birth_time = excluded.birth_time,
            lat        = excluded.lat,
            lon        = excluded.lon,
            tz_offset  = excluded.tz_offset,
            chart_json = excluded.chart_json,
            created_at = excluded.created_at
        """,
        (
            user_id, birth.date.isoformat(), birth.time.isoformat(),
            birth.lat, birth.lon, birth.tz_offset,
            json.dumps(natal_only), _now(),
        ),
    )
    connection.commit()


def load_chart(connection: sqlite3.Connection, user_id: str) -> dict[str, Any] | None:
    """Cached natal chart and the birth data it came from, or ``None``."""
    row = connection.execute(
        "SELECT * FROM charts WHERE user_id = ?", (user_id,)
    ).fetchone()
    if row is None:
        return None
    return {
        "birth": {
            "date": row["birth_date"],
            "time": row["birth_time"],
            "lat": row["lat"],
            "lon": row["lon"],
            "tz_offset": row["tz_offset"],
        },
        "chart": json.loads(row["chart_json"]),
    }


# --------------------------------------------------------------------------
# Messages
# --------------------------------------------------------------------------
def append_message(
    connection: sqlite3.Connection, user_id: str, role: str, content: str
) -> None:
    """Record one turn. ``role`` is 'user' or 'assistant'; the schema enforces it."""
    if role not in ("user", "assistant"):
        raise ValueError(f"role must be 'user' or 'assistant', got {role!r}")
    connection.execute(
        "INSERT INTO messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (user_id, role, content, _now()),
    )
    connection.commit()


def recent_messages(
    connection: sqlite3.Connection, user_id: str, limit: int = HISTORY_WINDOW
) -> list[dict[str, str]]:
    """The last ``limit`` turns, oldest first.

    Selected newest-first so the window is the *most recent* messages, then
    reversed so the model reads them in the order they happened.
    """
    rows = connection.execute(
        "SELECT role, content FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def clear_messages(connection: sqlite3.Connection, user_id: str) -> int:
    """Wipe this user's history. Returns the number of rows removed."""
    cursor = connection.execute("DELETE FROM messages WHERE user_id = ?", (user_id,))
    connection.commit()
    return cursor.rowcount
