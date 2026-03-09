"""
Database initialization script for Horizon18.

Uses a simple versioned migration system. Each migration runs once and is
tracked in the schema_migrations table. Safe to run repeatedly — only
pending migrations are applied.

Requires DATABASE_URL environment variable.

Usage:
    python backend/init_db.py
"""

import os
import sys
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")

# ── Migrations ────────────────────────────────────────────────────
# Each entry: (version_number, description, SQL)
# APPEND ONLY — never edit or reorder existing migrations.

MIGRATIONS = [
    (1, "Create users and simulations tables", """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            google_id TEXT UNIQUE,
            display_name TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS simulations (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            share_id TEXT UNIQUE NOT NULL,
            title TEXT,
            quiz_state JSONB NOT NULL,
            results_summary JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_sim_user ON simulations(user_id);
        CREATE INDEX IF NOT EXISTS idx_sim_share ON simulations(share_id);
    """),

    (2, "Add analytics table", """
        CREATE TABLE IF NOT EXISTS analytics (
            event_type TEXT PRIMARY KEY,
            count BIGINT NOT NULL DEFAULT 0,
            first_seen TIMESTAMPTZ DEFAULT NOW()
        );
    """),
]


def init_db():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable not set.")
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Create the migration tracking table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INT PRIMARY KEY,
            description TEXT,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    conn.commit()

    # Find which migrations have already been applied
    cur.execute("SELECT version FROM schema_migrations ORDER BY version")
    applied = {row[0] for row in cur.fetchall()}

    # Run pending migrations in order
    for version, description, sql in MIGRATIONS:
        if version in applied:
            continue
        print(f"  Applying migration {version}: {description}")
        cur.execute(sql)
        cur.execute(
            "INSERT INTO schema_migrations (version, description) VALUES (%s, %s)",
            (version, description),
        )
        conn.commit()

    cur.close()
    conn.close()

    if applied == {m[0] for m in MIGRATIONS}:
        print("Database is up to date. No new migrations.")
    else:
        print("Database initialized successfully.")


if __name__ == "__main__":
    init_db()
