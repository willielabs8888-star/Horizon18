"""
Database access layer for Horizon18.

Uses psycopg2 with a simple connection helper. All queries are
parameterized to prevent SQL injection.
"""

from __future__ import annotations

import os
import json
import string
import random
DATABASE_URL = os.environ.get("DATABASE_URL")

# Lazy import — psycopg2 is only needed when DATABASE_URL is set
_psycopg2 = None


def _get_psycopg2():
    global _psycopg2
    if _psycopg2 is None:
        import psycopg2
        import psycopg2.extras
        _psycopg2 = psycopg2
    return _psycopg2


def get_conn():
    """Return a new database connection. Raises RuntimeError if no DATABASE_URL."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL not configured — database features disabled")
    pg = _get_psycopg2()
    return pg.connect(DATABASE_URL, cursor_factory=pg.extras.RealDictCursor)


def generate_share_id(length: int = 8) -> str:
    """Generate a random alphanumeric share ID."""
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=length))


# ── Users ──────────────────────────────────────────────────────────

def create_user(email: str, password_hash: str | None = None,
                google_id: str | None = None, display_name: str | None = None) -> dict:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO users (email, password_hash, google_id, display_name)
               VALUES (%s, %s, %s, %s) RETURNING id, email, display_name, created_at""",
            (email, password_hash, google_id, display_name),
        )
        user = dict(cur.fetchone())
        conn.commit()
        return user
    finally:
        conn.close()


def get_user_by_email(email: str) -> dict | None:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> dict | None:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, email, display_name, created_at FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_google_id(google_id: str) -> dict | None:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE google_id = %s", (google_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def link_google_id(user_id: int, google_id: str):
    """Link a Google account to an existing user (for email users who later use Google)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET google_id = %s WHERE id = %s", (google_id, user_id))
        conn.commit()
    finally:
        conn.close()


# ── Simulations ────────────────────────────────────────────────────

def save_simulation(user_id: int | None, share_id: str, title: str,
                    quiz_state: dict, results_summary: dict | None = None) -> dict:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO simulations (user_id, share_id, title, quiz_state, results_summary)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, share_id, title, created_at""",
            (user_id, share_id, title, json.dumps(quiz_state), json.dumps(results_summary) if results_summary else None),
        )
        sim = dict(cur.fetchone())
        conn.commit()
        return sim
    finally:
        conn.close()


def get_user_simulations(user_id: int) -> list[dict]:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, share_id, title, results_summary, created_at, updated_at
               FROM simulations WHERE user_id = %s ORDER BY updated_at DESC""",
            (user_id,),
        )
        return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def get_simulation_by_share_id(share_id: str) -> dict | None:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM simulations WHERE share_id = %s", (share_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_simulation(sim_id: int, user_id: int) -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM simulations WHERE id = %s AND user_id = %s", (sim_id, user_id))
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    finally:
        conn.close()


def update_simulation_title(sim_id: int, user_id: int, new_title: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE simulations SET title = %s, updated_at = NOW() WHERE id = %s AND user_id = %s",
            (new_title, sim_id, user_id),
        )
        updated = cur.rowcount > 0
        conn.commit()
        return updated
    finally:
        conn.close()
