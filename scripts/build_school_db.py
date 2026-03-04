#!/usr/bin/env python3
"""
Build the Horizon18 school database from College Scorecard data.

Downloads the latest College Scorecard bulk CSV from the U.S. Department of
Education, filters to 4-year and 2-year degree-granting institutions, and
outputs a lightweight JSON file for use by the app.

Usage:
    python scripts/build_school_db.py

Output:
    defaults/schools_data.json

Data source:
    https://collegescorecard.ed.gov/data/
    U.S. Department of Education — public domain, no API key needed.
"""

import csv
import io
import itertools
import json
import os
import sys
import urllib.request
import zipfile

# College Scorecard bulk download URL (most recent cohorts)
SCORECARD_URL = "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_05192025.zip"

# Output path (relative to project root)
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "defaults", "schools_data.json")

# Fields we need from the CSV
# See: https://collegescorecard.ed.gov/data/data-documentation/
FIELDS = {
    "UNITID":        "id",           # IPEDS unique identifier
    "INSTNM":        "name",         # Institution name
    "STABBR":        "state",        # State abbreviation
    "CONTROL":       "control",      # 1=Public, 2=Private nonprofit, 3=Private for-profit
    "ICLEVEL":       "level",        # 1=4-year, 2=2-year, 3=Less than 2-year
    "CURROPER":      "operating",    # 1=Currently operating (filter field)
    "TUITIONFEE_IN": "tuition_in",   # In-state tuition + fees
    "TUITIONFEE_OUT":"tuition_out",  # Out-of-state tuition + fees
    "ROOMBOARD":     "room_board",   # Room and board
}


def download_and_extract_csv():
    """Download the College Scorecard ZIP and extract the CSV."""
    print(f"Downloading College Scorecard data from:\n  {SCORECARD_URL}")
    print("  (This is ~150MB, may take a minute...)")

    req = urllib.request.Request(SCORECARD_URL, headers={"User-Agent": "Horizon18-SchoolDB-Builder/1.0"})
    response = urllib.request.urlopen(req, timeout=120)
    zip_data = response.read()
    print(f"  Downloaded {len(zip_data) / 1e6:.1f} MB")

    # Extract CSV from ZIP
    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
        if not csv_names:
            raise RuntimeError("No CSV found in ZIP file")
        csv_name = csv_names[0]
        print(f"  Extracting: {csv_name}")
        csv_bytes = zf.read(csv_name)

    # Strip UTF-8 BOM if present (College Scorecard CSVs sometimes include one)
    text = csv_bytes.decode("utf-8-sig", errors="replace")
    return text


def parse_schools(csv_text):
    """Parse CSV and extract school records."""
    reader = csv.DictReader(io.StringIO(csv_text))

    schools = []
    skipped_closed = 0
    skipped_level = 0
    skipped_missing = 0
    skipped_forprofit = 0

    # Auto-detect column names (College Scorecard renames columns between releases)
    first_row = None
    rows_iter = iter(reader)
    try:
        first_row = next(rows_iter)
    except StopIteration:
        print("  ERROR: CSV is empty")
        return []

    headers = set(first_row.keys())

    # Find the right column names by checking known variants
    def find_col(preferred, *alternates):
        if preferred in headers:
            return preferred
        for alt in alternates:
            matches = [h for h in headers if alt.lower() in h.lower()]
            if len(matches) == 1:
                return matches[0]
        return None

    col_unitid     = find_col("UNITID", "unitid")
    col_instnm     = find_col("INSTNM", "instnm", "institution")
    col_stabbr     = find_col("STABBR", "stabbr", "state")
    col_control    = find_col("CONTROL", "control")
    col_iclevel    = find_col("ICLEVEL", "iclevel")
    col_curroper   = find_col("CURROPER", "curroper")
    col_tuition_in = find_col("TUITIONFEE_IN", "tuition", "tuit")
    col_tuition_out= find_col("TUITIONFEE_OUT", "tuitionfee_out")
    col_roomboard  = find_col("ROOMBOARD", "ROOMBOARD_ON", "roomboard", "ROOM_AND_BOARD")
    col_roomboard_off = find_col("ROOMBOARD_OFF")

    # Extended fields for School Stats Panel
    col_grad_rate   = find_col("C150_4", "c150_4")          # 4-year graduation rate (150% time)
    col_grad_rate_2 = find_col("C150_L4", "c150_l4")        # 2-year graduation rate (150% time)
    col_adm_rate    = find_col("ADM_RATE", "adm_rate")      # Admission rate
    col_med_earn    = find_col("MD_EARN_WNE_P10", "md_earn") # Median earnings 10yr post-enrollment
    col_avg_net_pub = find_col("NPT4_PUB", "npt4_pub")      # Avg net price (public)
    col_avg_net_prv = find_col("NPT4_PRIV", "npt4_priv")    # Avg net price (private)
    col_ugds        = find_col("UGDS", "ugds")               # Undergraduate enrollment

    # Show what we found
    print(f"\n  Column mapping:")
    mapping = {
        "UNITID": col_unitid, "INSTNM": col_instnm, "STABBR": col_stabbr,
        "CONTROL": col_control, "ICLEVEL": col_iclevel, "CURROPER": col_curroper,
        "TUITIONFEE_IN": col_tuition_in, "TUITIONFEE_OUT": col_tuition_out,
        "ROOMBOARD": col_roomboard,
    }
    for expected, actual in mapping.items():
        status = f"→ {actual}" if actual and actual != expected else ("→ (same)" if actual else "→ NOT FOUND")
        print(f"    {expected} {status}")

    # If room & board column not found, show candidates so user can report
    if col_roomboard is None:
        room_candidates = [h for h in headers if any(t in h.lower() for t in ("room", "board", "hous", "dorm", "chg"))]
        if room_candidates:
            print(f"    → Possible room/board columns: {sorted(room_candidates)}")
        else:
            print(f"    → No room/board-like columns found; room_board will be null")

    missing_cols = [k for k, v in mapping.items() if v is None and k not in ("ROOMBOARD",)]
    if missing_cols:
        print(f"\n  ERROR: Could not find columns: {missing_cols}")
        print(f"  Available columns (first 30): {sorted(headers)[:30]}")
        print(f"  ... ({len(headers)} total columns)")
        return []

    all_rows = itertools.chain([first_row], rows_iter)

    for row in all_rows:
        # Filter: must be currently operating
        if col_curroper and row.get(col_curroper, "0") != "1":
            skipped_closed += 1
            continue

        # Filter: 4-year or 2-year only
        level = row.get(col_iclevel, "")
        if level not in ("1", "2"):
            skipped_level += 1
            continue

        # Filter: skip for-profit institutions (less credible data)
        control = row.get(col_control, "")
        if control == "3":
            skipped_forprofit += 1
            continue

        # Must have at least in-state tuition
        tuition_in = row.get(col_tuition_in, "NULL") if col_tuition_in else "NULL"
        if tuition_in in ("NULL", "", "PrivacySuppressed"):
            skipped_missing += 1
            continue

        # Build school record
        try:
            # Pick graduation rate based on institution level
            if level == "1" and col_grad_rate:
                grad_rate_raw = row.get(col_grad_rate, "NULL")
            elif level == "2" and col_grad_rate_2:
                grad_rate_raw = row.get(col_grad_rate_2, "NULL")
            else:
                grad_rate_raw = "NULL"

            # Pick net price based on control type
            if control == "1" and col_avg_net_pub:
                net_price_raw = row.get(col_avg_net_pub, "NULL")
            elif control == "2" and col_avg_net_prv:
                net_price_raw = row.get(col_avg_net_prv, "NULL")
            else:
                net_price_raw = "NULL"

            school = {
                "id": row[col_unitid].strip(),
                "name": row[col_instnm].strip(),
                "state": row[col_stabbr].strip(),
                "control": int(control),  # 1=Public, 2=Private nonprofit
                "level": int(level),      # 1=4-year, 2=2-year
                "tuition_in": int(float(tuition_in)),
                "tuition_out": _safe_int(row.get(col_tuition_out, "NULL") if col_tuition_out else "NULL"),
                "room_board": _safe_int(row.get(col_roomboard, "NULL") if col_roomboard else "NULL")
                              or _safe_int(row.get(col_roomboard_off, "NULL") if col_roomboard_off else "NULL"),
                # Extended stats (null if unavailable — UI handles gracefully)
                "grad_rate": _safe_pct(grad_rate_raw),           # 0.0-1.0 or null
                "adm_rate":  _safe_pct(row.get(col_adm_rate, "NULL") if col_adm_rate else "NULL"),
                "med_earn":  _safe_int(row.get(col_med_earn, "NULL") if col_med_earn else "NULL"),
                "net_price": _safe_int(net_price_raw),
                "enrollment": _safe_int(row.get(col_ugds, "NULL") if col_ugds else "NULL"),
            }
        except (ValueError, KeyError) as e:
            skipped_missing += 1
            continue

        # For public schools, out-of-state should exist; private same in/out
        if school["tuition_out"] is None:
            school["tuition_out"] = school["tuition_in"]

        schools.append(school)

    # Sort by name for consistent ordering
    schools.sort(key=lambda s: s["name"])

    print(f"\n  Processed schools:")
    print(f"    Included:       {len(schools)}")
    print(f"    Skipped closed: {skipped_closed}")
    print(f"    Skipped level:  {skipped_level} (not 4-year or 2-year)")
    print(f"    Skipped profit: {skipped_forprofit} (for-profit)")
    print(f"    Skipped data:   {skipped_missing} (missing tuition)")

    if len(schools) == 0:
        # Debug: show a sample row so the user can report column names
        print(f"\n  DEBUG — Sample row from CSV (first operating, 4yr/2yr, non-profit):")
        reader2 = csv.DictReader(io.StringIO(csv_text))
        for sample in reader2:
            c = sample.get(col_control, "")
            lv = sample.get(col_iclevel, "")
            op = sample.get(col_curroper, "")
            if op == "1" and lv in ("1", "2") and c in ("1", "2"):
                # Show tuition-related columns
                tuition_cols = {k: v for k, v in sample.items()
                                if any(t in k.lower() for t in ("tuition", "fee", "cost", "charg", "price", "room"))}
                print(f"    School: {sample.get(col_instnm, '?')}")
                print(f"    Tuition columns found:")
                for k, v in sorted(tuition_cols.items()):
                    print(f"      {k} = {v}")
                break

    return schools


def _safe_int(val):
    """Convert to int, return None if NULL/empty/suppressed."""
    if val in ("NULL", "", "PrivacySuppressed", None):
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _safe_pct(val):
    """Convert to float percentage (0.0-1.0), return None if unavailable."""
    if val in ("NULL", "", "PrivacySuppressed", None):
        return None
    try:
        f = float(val)
        if 0.0 <= f <= 1.0:
            return round(f, 3)
        return None
    except (ValueError, TypeError):
        return None


def build_database(schools):
    """Build the final JSON database."""
    # Count by type
    four_year = sum(1 for s in schools if s["level"] == 1)
    two_year = sum(1 for s in schools if s["level"] == 2)
    public = sum(1 for s in schools if s["control"] == 1)
    private = sum(1 for s in schools if s["control"] == 2)

    db = {
        "metadata": {
            "source": "U.S. Department of Education — College Scorecard",
            "url": "https://collegescorecard.ed.gov/data/",
            "description": "Tuition, fees, and room & board for U.S. colleges and universities",
            "license": "Public domain (U.S. government data)",
            "count": len(schools),
            "four_year": four_year,
            "two_year": two_year,
            "public": public,
            "private_nonprofit": private,
        },
        "schools": schools,
    }

    print(f"\n  Database summary:")
    print(f"    Total schools: {len(schools)}")
    print(f"    4-year:        {four_year}")
    print(f"    2-year:        {two_year}")
    print(f"    Public:        {public}")
    print(f"    Private (NP):  {private}")

    return db


def main():
    print("=" * 60)
    print("  Horizon18 — School Database Builder")
    print("=" * 60)

    # Download and parse
    csv_text = download_and_extract_csv()
    schools = parse_schools(csv_text)

    if len(schools) < 100:
        print(f"\n  ERROR: Only {len(schools)} schools found — something went wrong.")
        sys.exit(1)

    # Build and save
    db = build_database(schools)

    output = os.path.abspath(OUTPUT_PATH)
    with open(output, "w", encoding="utf-8") as f:
        json.dump(db, f, separators=(",", ":"))

    size_mb = os.path.getsize(output) / 1e6
    print(f"\n  Saved to: {output}")
    print(f"  File size: {size_mb:.1f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
