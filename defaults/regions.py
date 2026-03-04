"""
Regional and metro-level cost-of-living and salary multipliers.

Sources:
- U.S. Census Bureau (MSA population estimates)
- BEA Regional Price Parities (RPP) for per-metro COL indices
- BLS regional wage differentials

Metro data loaded from defaults/metros_data.json (refreshed quarterly via
scripts/build_metro_col.py).

Multipliers are relative to 1.0 = national average.
- Salary multiplier ("sal"): applied to starting salaries and wage ramps.
- Expense / COL multiplier ("col"): applied to monthly living costs.
"""

import json
import os

# ---------------------------------------------------------------------------
# Regional multipliers (fallback when metro-specific data is unavailable)
# ---------------------------------------------------------------------------

REGION_MULTIPLIERS: dict[str, dict[str, float]] = {
    "northeast": {
        "salary":   1.15,   # ~15% above national average
        "expenses": 1.25,   # ~25% above (driven by housing in NY, MA, CT)
    },
    "southeast": {
        "salary":   0.90,   # ~10% below national average
        "expenses": 0.87,   # ~13% below (AR, MS, AL among cheapest)
    },
    "midwest": {
        "salary":   0.95,   # ~5% below national average
        "expenses": 0.90,   # ~10% below (strong affordability)
    },
    "southwest": {
        "salary":   0.97,   # ~3% below national average
        "expenses": 0.95,   # ~5% below (TX, AZ — moderate)
    },
    "west_coast": {
        "salary":   1.12,   # ~12% above national average
        "expenses": 1.15,   # ~15% above (CA, WA, OR — high housing)
    },
}


# ---------------------------------------------------------------------------
# Metro area data (loaded from JSON)
# ---------------------------------------------------------------------------

_METRO_DB_PATH = os.path.join(os.path.dirname(__file__), "metros_data.json")

# Populated by _load_metros() on first access
_METROS: dict[str, dict] = {}
_METRO_LIST: list[dict] = []


def _load_metros():
    """Load metro database from JSON file (lazy, once)."""
    global _METROS, _METRO_LIST
    if _METROS:
        return
    if not os.path.exists(_METRO_DB_PATH):
        return
    try:
        with open(_METRO_DB_PATH, "r", encoding="utf-8") as f:
            db = json.load(f)
        _METRO_LIST = db.get("metros", [])
        _METROS = {m["code"]: m for m in _METRO_LIST}
    except (json.JSONDecodeError, KeyError):
        pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

# Legacy dict (kept for backward compatibility with frontend label maps).
# Now dynamically built from the JSON data.
def _build_metro_areas() -> dict[str, dict[str, str]]:
    """Build METRO_AREAS dict from loaded JSON data."""
    _load_metros()
    if not _METROS:
        # Fallback: minimal set so the app doesn't break without the JSON file
        return {
            "national_avg": {"label": "Other / National Average", "region": "midwest"},
        }
    return {
        m["code"]: {"label": m["label"], "region": m["region"]}
        for m in _METRO_LIST
    }


# Lazy-loaded property to avoid import-time file I/O issues
class _MetroAreasProxy(dict):
    """Dict that lazy-loads from JSON on first access."""
    _loaded = False

    def _ensure_loaded(self):
        if not self._loaded:
            self.update(_build_metro_areas())
            self._loaded = True

    def __getitem__(self, key):
        self._ensure_loaded()
        return super().__getitem__(key)

    def __contains__(self, key):
        self._ensure_loaded()
        return super().__contains__(key)

    def __iter__(self):
        self._ensure_loaded()
        return super().__iter__()

    def __len__(self):
        self._ensure_loaded()
        return super().__len__()

    def get(self, key, default=None):
        self._ensure_loaded()
        return super().get(key, default)

    def items(self):
        self._ensure_loaded()
        return super().items()

    def keys(self):
        self._ensure_loaded()
        return super().keys()

    def values(self):
        self._ensure_loaded()
        return super().values()


METRO_AREAS = _MetroAreasProxy()


def get_region_for_metro(metro_code: str) -> str:
    """Return region string for a given metro code. Falls back to 'midwest'."""
    _load_metros()
    m = _METROS.get(metro_code)
    if m:
        return m["region"]
    return "midwest"


def get_multipliers_for_metro(metro_code: str) -> dict[str, float]:
    """Return salary and expense multipliers for a metro area.

    Checks for per-metro multipliers first (from metros_data.json),
    then falls back to regional multipliers.

    Returns:
        {"salary": float, "expenses": float}
    """
    _load_metros()
    m = _METROS.get(metro_code)

    if m and "sal" in m and "col" in m:
        return {"salary": m["sal"], "expenses": m["col"]}

    # Fall back to regional multipliers
    region = m["region"] if m else "midwest"
    return REGION_MULTIPLIERS.get(region, REGION_MULTIPLIERS["midwest"])


def get_metro_list() -> list[dict]:
    """Return sorted list of all metros for the API/frontend.

    Each item: {"code": str, "label": str, "region": str}
    """
    _load_metros()
    return sorted(
        [{"code": m["code"], "label": m["label"], "region": m["region"]}
         for m in _METRO_LIST],
        key=lambda x: x["label"],
    )


def get_metro_count() -> int:
    """Return total number of metros in database."""
    _load_metros()
    return len(_METRO_LIST)
