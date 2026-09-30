"""Quadras, replays, contas e favoritos. SQLite local, sem serviço extra."""

from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("DATABASE_PATH", str(ROOT / "data" / "cliqueplay.db")))
DEFAULT_COURT_SLUG = os.getenv("DEFAULT_COURT_SLUG", "quadra-teste")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courts (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    about TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS replays (
    id INTEGER PRIMARY KEY,
    court_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    front_file TEXT,
    back_file TEXT,
    locked INTEGER NOT NULL DEFAULT 0,
    price_cents INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    court_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, court_id)
);
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    replay_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quadras (
    id INTEGER PRIMARY KEY,
    court_id INTEGER NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);
"""

TZ = ZoneInfo("America/Sao_Paulo")
WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(_SCHEMA)
        columns = {row[1] for row in conn.execute("PRAGMA table_info(replays)")}
        if "quadra_id" not in columns:
            conn.execute("ALTER TABLE replays ADD COLUMN quadra_id INTEGER")
        conn.execute(
            """
            INSERT INTO courts (slug, name, city, about)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(slug) DO NOTHING
            """,
            (
                DEFAULT_COURT_SLUG,
                "Quadra teste",
                "Casa",
                "Primeira quadra, usada para testar a câmera e o botão.",
            ),
        )
        courts = conn.execute("SELECT id, slug FROM courts").fetchall()
        for court in courts:
            _ensure_quadra(conn, court["id"], court["slug"])
        conn.execute(
            """
            UPDATE replays
            SET quadra_id = (
                SELECT quadras.id FROM quadras
                WHERE quadras.court_id = replays.court_id
                ORDER BY quadras.id LIMIT 1
            )
            WHERE quadra_id IS NULL
            """
        )


def _ensure_quadra(conn: sqlite3.Connection, court_id: int, court_slug: str) -> int:
    found = conn.execute(
        "SELECT id FROM quadras WHERE court_id = ? ORDER BY id LIMIT 1",
        (court_id,),
    ).fetchone()
    if found:
        return found["id"]
    cur = conn.execute(
        "INSERT INTO quadras (court_id, slug, name) VALUES (?, ?, ?)",
        (court_id, f"{court_slug}-1", "Quadra 1"),
    )
    return int(cur.lastrowid)


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"pbkdf2${salt.hex()}${digest.hex()}"


def _check_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split("$", 2)
    except ValueError:
        return False
    candidate = _hash_password(password, bytes.fromhex(salt_hex))
    return secrets.compare_digest(candidate, f"pbkdf2${salt_hex}${digest_hex}")


def _user_public(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "name": row["name"], "email": row["email"]}


def register_user(name: str, email: str, password: str) -> dict:
    name = name.strip()
    email = email.strip().lower()
    if len(name) < 2:
        raise ValueError("Informe seu nome.")
    if "@" not in email or len(email) < 5:
        raise ValueError("E-mail inválido.")
    if len(password) < 6:
        raise ValueError("A senha precisa ter pelo menos 6 caracteres.")
    with connect() as conn:
        exists = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if exists:
            raise ValueError("Este e-mail já tem conta.")
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (name, email, _hash_password(password), _now()),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        return _user_public(row)


def login_user(email: str, password: str) -> tuple[dict, str]:
    email = email.strip().lower()
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row is None or not _check_password(password, row["password_hash"]):
            raise ValueError("E-mail ou senha incorretos.")
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, row["id"], _now()),
        )
        return _user_public(row), token


def logout_token(token: str) -> None:
    if not token:
        return
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def user_from_token(token: str | None) -> dict | None:
    if not token:
        return None
    with connect() as conn:
        row = conn.execute(
            """
            SELECT users.* FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
        return _user_public(row) if row else None


def list_courts(user_id: int | None = None) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT courts.*,
                   (SELECT COUNT(*) FROM replays WHERE replays.court_id = courts.id) AS replay_count,
                   EXISTS(
                       SELECT 1 FROM favorites
                       WHERE favorites.court_id = courts.id AND favorites.user_id = ?
                   ) AS favorite
            FROM courts
            ORDER BY courts.name
            """,
            (user_id or 0,),
        ).fetchall()
    return [_court_public(row) for row in rows]


def get_court(slug: str, user_id: int | None = None) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT courts.*,
                   (SELECT COUNT(*) FROM replays WHERE replays.court_id = courts.id) AS replay_count,
                   EXISTS(
                       SELECT 1 FROM favorites
                       WHERE favorites.court_id = courts.id AND favorites.user_id = ?
                   ) AS favorite
            FROM courts
            WHERE slug = ?
            """,
            (user_id or 0, slug),
        ).fetchone()
        if row is None:
            return None
        court = _court_public(row)
        court["quadras"] = _quadras_of(conn, row["id"])
        replays = conn.execute(
            "SELECT * FROM replays WHERE court_id = ? ORDER BY id DESC",
            (row["id"],),
        ).fetchall()
        court["replays"] = [_replay_public(item) for item in replays]
        return court


def get_quadra(arena_slug: str, quadra_slug: str) -> dict | None:
    with connect() as conn:
        arena = conn.execute("SELECT * FROM courts WHERE slug = ?", (arena_slug,)).fetchone()
        if arena is None:
            return None
        quadra = conn.execute(
            "SELECT * FROM quadras WHERE court_id = ? AND slug = ?",
            (arena["id"], quadra_slug),
        ).fetchone()
        if quadra is None:
            return None
        replays = conn.execute(
            "SELECT * FROM replays WHERE quadra_id = ? ORDER BY created_at DESC",
            (quadra["id"],),
        ).fetchall()
        count = conn.execute(
            "SELECT COUNT(*) AS n FROM replays WHERE quadra_id = ?",
            (quadra["id"],),
        ).fetchone()["n"]
    return {
        "arena": {
            "slug": arena["slug"],
            "name": arena["name"],
            "city": arena["city"],
            "about": arena["about"],
        },
        "quadra": {"slug": quadra["slug"], "name": quadra["name"], "replay_count": count},
        "days": _days(replays),
    }


def _quadras_of(conn: sqlite3.Connection, court_id: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT quadras.*,
               (SELECT COUNT(*) FROM replays WHERE replays.quadra_id = quadras.id) AS replay_count
        FROM quadras
        WHERE court_id = ?
        ORDER BY quadras.id
        """,
        (court_id,),
    ).fetchall()
    return [
        {"slug": row["slug"], "name": row["name"], "replay_count": row["replay_count"]}
        for row in rows
    ]


def _days(replays: list[sqlite3.Row]) -> list[dict]:
    buckets: dict[str, dict[int, list[dict]]] = {}
    for replay in replays:
        moment = datetime.fromisoformat(replay["created_at"]).astimezone(TZ)
        day_key = moment.date().isoformat()
        hour = moment.hour
        buckets.setdefault(day_key, {}).setdefault(hour, []).append(
            {
                **_replay_public(replay),
                "time_label": moment.strftime("%H:%M"),
            }
        )
    today = datetime.now(TZ).date()
    days = []
    for day_key in sorted(set(buckets) | {today.isoformat()}):
        day = datetime.fromisoformat(day_key).date()
        if day > today:
            continue
        if day != today and day_key not in buckets:
            continue
        hours = [
            {"hour": hour, "label": f"{hour:02d}:00", "replays": buckets[day_key][hour]}
            for hour in sorted(buckets.get(day_key, {}))
        ]
        days.append(
            {
                "date": day_key,
                "is_today": day == today,
                "label": "Hoje" if day == today else day.strftime("%d/%m"),
                "weekday": WEEKDAYS[day.weekday()],
                "hours": hours,
            }
        )
    return days


def _court_public(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "city": row["city"],
        "about": row["about"],
        "replay_count": row["replay_count"],
        "favorite": bool(row["favorite"]),
    }


def _replay_public(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "locked": bool(row["locked"]),
        "price_cents": row["price_cents"],
        "has_front": bool(row["front_file"]),
        "has_back": bool(row["back_file"]),
    }


def set_favorite(user_id: int, slug: str, on: bool) -> dict:
    with connect() as conn:
        court = conn.execute("SELECT id FROM courts WHERE slug = ?", (slug,)).fetchone()
        if court is None:
            raise LookupError("Quadra não encontrada.")
        if on:
            conn.execute(
                "INSERT OR IGNORE INTO favorites (user_id, court_id) VALUES (?, ?)",
                (user_id, court["id"]),
            )
        else:
            conn.execute(
                "DELETE FROM favorites WHERE user_id = ? AND court_id = ?",
                (user_id, court["id"]),
            )
    found = get_court(slug, user_id)
    if found is None:
        raise LookupError("Quadra não encontrada.")
    return found


def list_favorites(user_id: int) -> list[dict]:
    courts = list_courts(user_id)
    return [court for court in courts if court["favorite"]]


def list_purchases(user_id: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT purchases.*, replays.created_at AS replay_at, courts.name AS court_name, courts.slug
            FROM purchases
            JOIN replays ON replays.id = purchases.replay_id
            JOIN courts ON courts.id = replays.court_id
            WHERE purchases.user_id = ?
            ORDER BY purchases.id DESC
            """,
            (user_id,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "replay_id": row["replay_id"],
            "court_name": row["court_name"],
            "court_slug": row["slug"],
            "amount_cents": row["amount_cents"],
            "status": row["status"],
            "created_at": row["created_at"],
            "replay_at": row["replay_at"],
        }
        for row in rows
    ]


def request_purchase(user_id: int, replay_id: int) -> dict:
    with connect() as conn:
        replay = conn.execute("SELECT * FROM replays WHERE id = ?", (replay_id,)).fetchone()
        if replay is None:
            raise LookupError("Replay não encontrado.")
        if not replay["locked"]:
            raise ValueError("Este vídeo já está liberado para baixar.")
        existing = conn.execute(
            """
            SELECT id FROM purchases
            WHERE user_id = ? AND replay_id = ? AND status = 'pendente'
            """,
            (user_id, replay_id),
        ).fetchone()
        if existing is None:
            conn.execute(
                """
                INSERT INTO purchases (user_id, replay_id, amount_cents, status, created_at)
                VALUES (?, ?, ?, 'pendente', ?)
                """,
                (user_id, replay_id, replay["price_cents"], _now()),
            )
    return {
        "ok": True,
        "status": "pendente",
        "message": (
            "Pedido anotado. O valor fica com o dono da quadra. "
            "O pagamento ainda não está ligado, então o vídeo continua reservado."
        ),
    }


def add_replay(front_file: str, back_file: str | None = None, slug: str | None = None) -> dict:
    slug = slug or DEFAULT_COURT_SLUG
    with connect() as conn:
        court = conn.execute("SELECT * FROM courts WHERE slug = ?", (slug,)).fetchone()
        if court is None:
            raise LookupError("Quadra não encontrada.")
        quadra_id = _ensure_quadra(conn, court["id"], court["slug"])
        cur = conn.execute(
            """
            INSERT INTO replays (court_id, quadra_id, created_at, front_file, back_file, locked, price_cents)
            VALUES (?, ?, ?, ?, ?, 0, 0)
            """,
            (court["id"], quadra_id, _now(), front_file, back_file),
        )
        replay_id = cur.lastrowid
    return {"id": replay_id, "court_slug": slug, "locked": False}


def replay_file(replay_id: int, angle: str) -> tuple[str, bool] | None:
    column = "front_file" if angle == "frente" else "back_file" if angle == "fundo" else ""
    if not column:
        return None
    with connect() as conn:
        row = conn.execute(f"SELECT {column} AS file, locked FROM replays WHERE id = ?", (replay_id,)).fetchone()
    if row is None or not row["file"]:
        return None
    return row["file"], bool(row["locked"])


def file_is_locked(name: str) -> bool:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT locked FROM replays
            WHERE front_file = ? OR back_file = ?
            ORDER BY id DESC LIMIT 1
            """,
            (name, name),
        ).fetchone()
    return bool(row and row["locked"])
