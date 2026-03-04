"""
School database loader and search functions.

Loads the schools_data.json file (built from College Scorecard data) and
provides lookup by IPEDS ID and text search by name.

Usage:
    from defaults.schools import get_school, search_schools

    school = get_school("170976")          # U of M by IPEDS ID
    results = search_schools("michigan")   # Search by name
"""

from __future__ import annotations

import json
import os

# Load database once at import time
_DB_PATH = os.path.join(os.path.dirname(__file__), "schools_data.json")
_SCHOOLS: dict[str, dict] = {}  # keyed by IPEDS ID
_SCHOOL_LIST: list[dict] = []   # for search iteration


def _load():
    """Load the school database from JSON."""
    global _SCHOOLS, _SCHOOL_LIST
    if _SCHOOLS:
        return  # Already loaded

    if not os.path.exists(_DB_PATH):
        return  # No database file — feature disabled

    with open(_DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    _SCHOOL_LIST = db.get("schools", [])
    _SCHOOLS = {s["id"]: s for s in _SCHOOL_LIST}


# Load on import
_load()


def get_school(ipeds_id: str) -> dict | None:
    """Look up a school by its IPEDS Unit ID.

    Returns the school dict or None if not found.
    """
    return _SCHOOLS.get(str(ipeds_id))


def search_schools(query: str, limit: int = 10) -> list[dict]:
    """Search schools by name (case-insensitive substring match).

    Returns up to `limit` matching schools, sorted with prefix matches first.
    """
    if not query or len(query) < 2:
        return []

    q = query.lower().strip()
    prefix_matches = []
    substring_matches = []

    for school in _SCHOOL_LIST:
        name_lower = school["name"].lower()
        if name_lower.startswith(q):
            prefix_matches.append(school)
        elif q in name_lower:
            substring_matches.append(school)

    # Prefix matches first, then substring matches
    results = prefix_matches + substring_matches
    return results[:limit]


def get_school_count() -> int:
    """Return the total number of schools in the database."""
    return len(_SCHOOL_LIST)


def has_school_database() -> bool:
    """Return True if the school database is loaded and available."""
    return len(_SCHOOL_LIST) > 0
