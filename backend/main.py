"""
Backend API server for Horizon18.

Uses Python's built-in http.server — zero external dependencies.
Serves both the API (POST /api/simulate) and the frontend (static files).

Start with:
    cd HS_Grad_Financial_Sim
    python backend/main.py

Then open http://localhost:8000 in your browser to use the app.
"""

from __future__ import annotations

import sys
import os
import json
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# Ensure the project root is on the Python path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.api import handle_simulate

PORT = int(os.environ.get("PORT", 8000))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")

# Simple analytics — persisted to disk so it survives restarts
_ANALYTICS_FILE = os.path.join(PROJECT_ROOT, "analytics.json")

def _load_analytics():
    try:
        with open(_ANALYTICS_FILE, "r") as f:
            return json.loads(f.read())
    except (FileNotFoundError, json.JSONDecodeError):
        return {"page_views": 0, "simulations": 0, "first_seen": None}

def _save_analytics(data):
    try:
        with open(_ANALYTICS_FILE, "w") as f:
            f.write(json.dumps(data))
    except Exception:
        pass

def _track_event(event_type):
    from datetime import datetime
    data = _load_analytics()
    data[event_type] = data.get(event_type, 0) + 1
    if not data.get("first_seen"):
        data["first_seen"] = datetime.now().isoformat()
    _save_analytics(data)


class APIHandler(BaseHTTPRequestHandler):
    """Serves JSON API endpoints and static frontend files."""

    # ------------------------------------------------------------------
    # Response helpers
    # ------------------------------------------------------------------

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, filepath: str):
        """Serve a static file from the frontend directory."""
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            mime_type, _ = mimetypes.guess_type(filepath)
            if mime_type is None:
                mime_type = "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self._send_json(404, {"error": f"File not found: {filepath}"})

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    # ------------------------------------------------------------------
    # HTTP methods
    # ------------------------------------------------------------------

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        # --- API endpoints ---
        if path == "/api/health":
            self._send_json(200, {"status": "ok"})
            return

        if path == "/api/analytics":
            data = _load_analytics()
            self._send_json(200, data)
            return

        if path == "/api/options":
            self._send_json(200, _get_options())
            return

        if path == "/api/metros":
            from defaults.regions import get_metro_list, get_metro_count
            metros = get_metro_list()
            self._send_json(200, {"metros": metros, "count": get_metro_count()})
            return

        if path == "/api/schools/search":
            from urllib.parse import parse_qs
            query_params = parse_qs(urlparse(self.path).query)
            q = query_params.get("q", [""])[0]
            level = query_params.get("level", [None])[0]  # "1" for 4-year, "2" for 2-year
            from defaults.schools import search_schools
            results = search_schools(q, limit=15)
            if level:
                results = [s for s in results if str(s.get("level")) == level][:10]
            self._send_json(200, {"schools": results})
            return

        # --- Frontend static files ---
        # Root → serve index.html
        if path == "/" or path == "":
            _track_event("page_views")
            self._send_file(os.path.join(FRONTEND_DIR, "index.html"))
            return

        # Try to serve the requested file from frontend/
        # Strip leading slash and resolve
        relative = path.lstrip("/")
        filepath = os.path.join(FRONTEND_DIR, relative)

        # Security: prevent path traversal
        real_frontend = os.path.realpath(FRONTEND_DIR)
        real_filepath = os.path.realpath(filepath)
        if not real_filepath.startswith(real_frontend):
            self._send_json(403, {"error": "Forbidden"})
            return

        if os.path.isfile(filepath):
            self._send_file(filepath)
        else:
            # For SPA-style routing, fall back to index.html
            self._send_file(os.path.join(FRONTEND_DIR, "index.html"))

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/simulate":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self._send_json(400, {"error": "Request body is empty."})
                return

            raw_body = self.rfile.read(content_length)

            try:
                body = json.loads(raw_body)
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
                return

            _track_event("simulations")
            result = handle_simulate(body)
            self._send_json(result["status"], result["body"])

        else:
            self._send_json(404, {"error": f"Not found: {path}"})

    def log_message(self, format, *args):
        """Custom log format."""
        print(f"  [{self.log_date_time_string()}] {format % args}")


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


def main():
    server = HTTPServer(("0.0.0.0", PORT), APIHandler)
    print(f"\n  Horizon18")
    print(f"  ================================")
    print(f"  App:     http://localhost:{PORT}")
    print(f"  API:     http://localhost:{PORT}/api/options")
    print(f"           POST http://localhost:{PORT}/api/simulate")
    print(f"\n  Open http://localhost:{PORT} in your browser to use the app.")
    print(f"  Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
