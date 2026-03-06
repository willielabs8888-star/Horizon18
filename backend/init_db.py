"""
Database initialization script for Horizon18.

Run once on deploy to create the users and simulations tables.
Requires DATABASE_URL environment variable.

Usage:
    python backend/init_db.py
"""

import os
import sys
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")


def init_db():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable not set.")
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            google_id TEXT UNIQUE,
            display_name TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    cur.execute("""
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
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_sim_user ON simulations(user_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sim_share ON simulations(share_id);")

    conn.commit()
    cur.close()
    conn.close()
    print("Database initialized successfully.")


if __name__ == "__main__":
    init_db()
