#!/usr/bin/env python3
"""
Build / refresh Horizon18 metro cost-of-living data from public sources.

Downloads BEA Regional Price Parities (RPP) from the FRED API and Census
population estimates, then regenerates defaults/metros_data.json.

Usage:
    python scripts/build_metro_col.py                   # uses existing metros list
    python scripts/build_metro_col.py --fred-key YOUR_KEY  # provide FRED API key

Data sources:
    - BEA Regional Price Parities via FRED (St. Louis Fed) — free API key
      https://fred.stlouisfed.org/docs/api/api_key.html
    - RPP series format: RPPALL{CBSA_FIPS} (e.g., RPPALL35620 for NYC)

The script reads the current metros_data.json to get the list of metros and
their CBSA FIPS codes, then fetches updated RPP values from FRED.

Notes:
    - FRED API requires a free API key (register at https://fred.stlouisfed.org)
    - BEA publishes metro RPPs annually, typically with a 1-2 year lag
    - If a FRED fetch fails for a metro, the existing value is preserved
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
METRO_DB_PATH = os.path.join(PROJECT_ROOT, "defaults", "metros_data.json")

# FRED API base URL
FRED_API_BASE = "https://api.stlouisfed.org/fred/series/observations"


def get_fred_key():
    """Get FRED API key from args, env, or config file."""
    # Check command line args
    for i, arg in enumerate(sys.argv):
        if arg == "--fred-key" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]

    # Check environment variable
    key = os.environ.get("FRED_API_KEY")
    if key:
        return key

    # Check config file
    config_path = os.path.join(PROJECT_ROOT, ".fred_api_key")
    if os.path.exists(config_path):
        with open(config_path) as f:
            return f.read().strip()

    return None


def fetch_rpp_from_fred(cbsa_fips: str, api_key: str) -> float | None:
    """Fetch the most recent RPP value for a metro from FRED.

    FRED series ID format: RPPALL{CBSA_FIPS}
    Example: RPPALL35620 for New York City

    Returns RPP index value (100 = national avg) or None if unavailable.
    """
    series_id = f"RPPALL{cbsa_fips}"
    url = (
        f"{FRED_API_BASE}?"
        f"series_id={series_id}"
        f"&api_key={api_key}"
        f"&file_type=json"
        f"&sort_order=desc"
        f"&limit=1"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Horizon18-MetroCOL/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        observations = data.get("observations", [])
        if observations and observations[0].get("value", ".") != ".":
            return float(observations[0]["value"])
    except (urllib.error.URLError, json.JSONDecodeError, ValueError, KeyError) as e:
        print(f"    WARN: Could not fetch {series_id}: {e}")

    return None


def compute_multipliers(rpp: float) -> tuple[float, float]:
    """Compute COL and salary multipliers from RPP index.

    col_multiplier = RPP / 100
    salary_multiplier = 1 + (RPP - 100) / 100 * 0.75
        (wages track ~75% of cost-of-living differences)
    """
    col = round(rpp / 100.0, 3)
    sal = round(1.0 + (rpp - 100.0) / 100.0 * 0.75, 3)
    return col, sal


def load_current_db() -> dict:
    """Load the current metros_data.json."""
    if not os.path.exists(METRO_DB_PATH):
        print("  ERROR: metros_data.json not found.")
        sys.exit(1)

    with open(METRO_DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def update_metro_rpp(db: dict, api_key: str) -> int:
    """Update RPP values for all metros from FRED.

    Returns count of successfully updated metros.
    """
    metros = db.get("metros", [])
    updated = 0

    for metro in metros:
        cbsa = metro.get("cbsa", "00000")
        code = metro.get("code", "?")

        # Skip national average (no FRED series)
        if code == "national_avg" or cbsa == "00000":
            continue

        print(f"    Fetching RPP for {code} (CBSA {cbsa})...", end=" ")
        rpp = fetch_rpp_from_fred(cbsa, api_key)

        if rpp is not None:
            old_rpp = metro.get("rpp", 100.0)
            col, sal = compute_multipliers(rpp)
            metro["rpp"] = rpp
            metro["col"] = col
            metro["sal"] = sal
            diff = rpp - old_rpp
            print(f"RPP={rpp:.1f} (Δ{diff:+.1f})")
            updated += 1
        else:
            print("SKIPPED (kept existing)")

        # Rate limit: FRED allows 120 requests/min
        time.sleep(0.6)

    return updated


def save_db(db: dict):
    """Save the updated database."""
    db["metadata"]["last_updated"] = datetime.now().isoformat()
    db["metadata"]["rpp_vintage"] = str(datetime.now().year)

    with open(METRO_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)

    size_kb = os.path.getsize(METRO_DB_PATH) / 1024
    print(f"\n  Saved to: {METRO_DB_PATH}")
    print(f"  File size: {size_kb:.1f} KB")


def main():
    print("=" * 60)
    print("  Horizon18 — Metro COL Data Updater")
    print("=" * 60)

    api_key = get_fred_key()
    if not api_key:
        print("\n  ERROR: FRED API key required.")
        print("  Get a free key at: https://fred.stlouisfed.org/docs/api/api_key.html")
        print("\n  Usage:")
        print("    python scripts/build_metro_col.py --fred-key YOUR_KEY")
        print("    FRED_API_KEY=YOUR_KEY python scripts/build_metro_col.py")
        print("    echo YOUR_KEY > .fred_api_key && python scripts/build_metro_col.py")
        sys.exit(1)

    db = load_current_db()
    metro_count = len(db.get("metros", []))
    print(f"\n  Loaded {metro_count} metros from database.")
    print(f"  Current RPP vintage: {db.get('metadata', {}).get('rpp_vintage', 'unknown')}")
    print(f"\n  Fetching updated RPP values from FRED...")

    updated = update_metro_rpp(db, api_key)

    print(f"\n  Updated: {updated}/{metro_count - 1} metros")  # -1 for national_avg
    save_db(db)

    print("=" * 60)


if __name__ == "__main__":
    main()
