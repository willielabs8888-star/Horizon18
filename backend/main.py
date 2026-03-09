"""
Backend API server for Horizon18.

Flask-based server with JWT authentication, PostgreSQL persistence,
and the same simulation API. Serves both API endpoints and the
frontend SPA.

Start locally:
    cd Horizon18
    python backend/main.py

Production (Railway):
    gunicorn backend.main:app --bind 0.0.0.0:$PORT
"""

from __future__ import annotations

import sys
import os
import json
import re

from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS

# Ensure the project root is on the Python path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.api import handle_simulate
from backend.auth import (
    hash_password, check_password, create_jwt, decode_jwt,
    auth_required, auth_optional, exchange_google_token,
)
from backend.db import (
    create_user, get_user_by_email, get_user_by_id, get_user_by_google_id,
    link_google_id, save_simulation, get_user_simulations,
    get_simulation_by_share_id, delete_simulation, update_simulation_title,
    generate_share_id, DATABASE_URL,
)

PORT = int(os.environ.get("PORT", 8000))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")

# ── App setup ──────────────────────────────────────────────────────

app = Flask(__name__, static_folder=None)

# CORS: restrict origins via env var (comma-separated). Defaults to localhost for dev.
# Set ALLOWED_ORIGINS in Railway to your production domain, e.g. "https://horizon18.up.railway.app"
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:8000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

# ── Analytics (database-backed when DB available, silent fallback) ─

def _track_event(event_type: str):
    """Increment an analytics counter. Uses PostgreSQL if available, otherwise no-op."""
    if not DATABASE_URL:
        return
    from datetime import datetime, timezone
    try:
        from backend.db import get_conn
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO analytics (event_type, count, first_seen)
                   VALUES (%s, 1, %s)
                   ON CONFLICT (event_type) DO UPDATE
                   SET count = analytics.count + 1""",
                (event_type, datetime.now(timezone.utc)),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        pass  # Analytics should never break the app


def _load_analytics() -> dict:
    """Load analytics counters from the database."""
    if not DATABASE_URL:
        return {"page_views": 0, "simulations": 0}
    try:
        from backend.db import get_conn
        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT event_type, count, first_seen FROM analytics")
            rows = cur.fetchall()
            result = {}
            for row in rows:
                result[row["event_type"]] = row["count"]
                if row.get("first_seen"):
                    result.setdefault("first_seen", row["first_seen"].isoformat())
            return result
        finally:
            conn.close()
    except Exception:
        return {"page_views": 0, "simulations": 0}


# ══════════════════════════════════════════════════════════════════
# EXISTING API ENDPOINTS (preserved from http.server version)
# ══════════════════════════════════════════════════════════════════

@app.route("/api/health")
def api_health():
    return jsonify({"status": "ok"})


@app.route("/api/analytics")
def api_analytics():
    return jsonify(_load_analytics())


@app.route("/api/options")
def api_options():
    return jsonify(_get_options())


@app.route("/api/metros")
def api_metros():
    from defaults.regions import get_metro_list, get_metro_count
    metros = get_metro_list()
    return jsonify({"metros": metros, "count": get_metro_count()})


@app.route("/api/schools/search")
def api_schools_search():
    q = request.args.get("q", "")
    level = request.args.get("level", None)
    from defaults.schools import search_schools
    results = search_schools(q, limit=15)
    if level:
        results = [s for s in results if str(s.get("level")) == level][:10]
    return jsonify({"schools": results})


@app.route("/api/simulate", methods=["POST"])
def api_simulate():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body is empty or invalid JSON."}), 400

    _track_event("simulations")
    result = handle_simulate(body)
    return jsonify(result["body"]), result["status"]


# ══════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════════

def _require_db():
    """Return error response if database is not configured, else None."""
    if not DATABASE_URL:
        return jsonify({"error": "Database not configured. Account features are disabled."}), 503
    return None


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    err = _require_db()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password", "")
    display_name = body.get("display_name", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return jsonify({"error": "Invalid email address"}), 400

    existing = get_user_by_email(email)
    if existing:
        return jsonify({"error": "An account with this email already exists"}), 409

    pw_hash = hash_password(password)
    user = create_user(email, password_hash=pw_hash, display_name=display_name or email.split("@")[0])
    token = create_jwt(user["id"], email)

    return jsonify({
        "token": token,
        "user": {"id": user["id"], "email": email, "display_name": user["display_name"]},
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    err = _require_db()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = get_user_by_email(email)
    if not user or not user.get("password_hash"):
        return jsonify({"error": "Invalid email or password"}), 401

    if not check_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_jwt(user["id"], email)
    return jsonify({
        "token": token,
        "user": {"id": user["id"], "email": email, "display_name": user["display_name"]},
    })


@app.route("/api/auth/google", methods=["POST"])
def auth_google():
    err = _require_db()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    id_token = body.get("id_token", "")

    if not id_token:
        return jsonify({"error": "Google ID token is required"}), 400

    google_info = exchange_google_token(id_token)
    if not google_info:
        return jsonify({"error": "Invalid Google token"}), 401

    # Check if user exists by google_id
    user = get_user_by_google_id(google_info["google_id"])
    if user:
        token = create_jwt(user["id"], user["email"])
        return jsonify({
            "token": token,
            "user": {"id": user["id"], "email": user["email"], "display_name": user["display_name"]},
        })

    # Check if user exists by email (registered with password, now using Google)
    user = get_user_by_email(google_info["email"])
    if user:
        link_google_id(user["id"], google_info["google_id"])
        token = create_jwt(user["id"], user["email"])
        return jsonify({
            "token": token,
            "user": {"id": user["id"], "email": user["email"], "display_name": user["display_name"]},
        })

    # New user via Google
    user = create_user(
        email=google_info["email"],
        google_id=google_info["google_id"],
        display_name=google_info["name"],
    )
    token = create_jwt(user["id"], google_info["email"])
    return jsonify({
        "token": token,
        "user": {"id": user["id"], "email": google_info["email"], "display_name": user["display_name"]},
    }), 201


@app.route("/api/auth/me")
@auth_required
def auth_me():
    user = get_user_by_id(g.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id": user["id"],
        "email": user["email"],
        "display_name": user["display_name"],
    })


# ══════════════════════════════════════════════════════════════════
# SIMULATION CRUD ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.route("/api/simulations/save", methods=["POST"])
@auth_required
def sim_save():
    body = request.get_json(silent=True) or {}
    quiz_state = body.get("quiz_state")
    title = body.get("title", "Untitled Simulation")
    results_summary = body.get("results_summary")

    if not quiz_state:
        return jsonify({"error": "quiz_state is required"}), 400

    share_id = generate_share_id()
    sim = save_simulation(
        user_id=g.user_id,
        share_id=share_id,
        title=title,
        quiz_state=quiz_state,
        results_summary=results_summary,
    )
    # Convert datetime for JSON
    for key in ("created_at",):
        if sim.get(key) and hasattr(sim[key], "isoformat"):
            sim[key] = sim[key].isoformat()
    return jsonify(sim), 201


@app.route("/api/simulations")
@auth_required
def sim_list():
    sims = get_user_simulations(g.user_id)
    for s in sims:
        for key in ("created_at", "updated_at"):
            if s.get(key) and hasattr(s[key], "isoformat"):
                s[key] = s[key].isoformat()
    return jsonify({"simulations": sims})


@app.route("/api/simulations/<int:sim_id>", methods=["DELETE"])
@auth_required
def sim_delete(sim_id):
    deleted = delete_simulation(sim_id, g.user_id)
    if not deleted:
        return jsonify({"error": "Simulation not found"}), 404
    return jsonify({"ok": True})


@app.route("/api/simulations/<int:sim_id>", methods=["PATCH"])
@auth_required
def sim_update(sim_id):
    body = request.get_json(silent=True) or {}
    new_title = body.get("title")
    if not new_title:
        return jsonify({"error": "title is required"}), 400

    updated = update_simulation_title(sim_id, g.user_id, new_title)
    if not updated:
        return jsonify({"error": "Simulation not found"}), 404
    return jsonify({"ok": True})


@app.route("/api/sim/<share_id>")
def sim_load_shared(share_id):
    sim = get_simulation_by_share_id(share_id)
    if not sim:
        return jsonify({"error": "Simulation not found"}), 404
    return jsonify({
        "quiz_state": sim["quiz_state"],
        "title": sim["title"],
        "share_id": sim["share_id"],
    })


# ══════════════════════════════════════════════════════════════════
# STATIC FILE SERVING (SPA fallback)
# ══════════════════════════════════════════════════════════════════

@app.route("/")
def serve_index():
    _track_event("page_views")
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    filepath = os.path.join(FRONTEND_DIR, path)
    real_frontend = os.path.realpath(FRONTEND_DIR)
    real_filepath = os.path.realpath(filepath)

    # Security: prevent path traversal
    if not real_filepath.startswith(real_frontend):
        return jsonify({"error": "Forbidden"}), 403

    if os.path.isfile(filepath):
        return send_from_directory(FRONTEND_DIR, path)

    # SPA fallback: serve index.html for all non-file routes
    return send_from_directory(FRONTEND_DIR, "index.html")


# ══════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════

def _get_options() -> dict:
    """Return all enum values the frontend needs for quiz dropdowns."""
    from model.data_models import (
        PathType, SchoolType, Major, TradeType,
        WorkforceIndustry, Region,
    )

    def enum_to_list(enum_class):
        return [{"value": e.value, "label": e.value.replace("_", " ").title()} for e in enum_class]

    from defaults.schools import has_school_database, get_school_count
    return {
        "paths": enum_to_list(PathType),
        "school_types": enum_to_list(SchoolType),
        "majors": enum_to_list(Major),
        "trade_types": enum_to_list(TradeType),
        "workforce_industries": enum_to_list(WorkforceIndustry),
        "regions": enum_to_list(Region),
        "projection_years": {"min": 10, "max": 50, "default": 32},
        "school_search": has_school_database(),
        "school_count": get_school_count(),
    }


# ══════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════

def main():
    db_status = "connected" if DATABASE_URL else "not configured (auth/save disabled)"
    print(f"\n  Horizon18")
    print(f"  ================================")
    print(f"  App:      http://localhost:{PORT}")
    print(f"  Database: {db_status}")
    print(f"\n  Open http://localhost:{PORT} in your browser to use the app.")
    print(f"  Press Ctrl+C to stop.\n")
    app.run(host="0.0.0.0", port=PORT, debug=True)


if __name__ == "__main__":
    main()
