"""
Tuition and education cost defaults.

Sources:
- College Board "Trends in College Pricing" (2025-2026)
- Education Data Initiative (educationdata.org)
- Trade school cost data from industry training providers

All values are annual unless noted otherwise.
"""

# Annual tuition by school type (tuition + fees, excludes room & board)
TUITION_ANNUAL: dict[str, float] = {
    "public_in_state":     11_371,
    "public_out_of_state": 25_415,
    "private":             44_961,
    "community_college":    3_890,
}

# Annual room and board by living situation
ROOM_AND_BOARD_ANNUAL: dict[str, float] = {
    "on_campus":   12_000,   # Dorms + meal plan
    "off_campus":   9_600,   # Apartment near campus
    "at_home":      2_400,   # Contribution to household + transport
}

# Total program cost for trade schools (NOT per-year — these are full program)
TRADE_SCHOOL_TOTAL: dict[str, float] = {
    "electrician": 14_640,
    "plumber":     12_500,
    "hvac":        12_500,
    "carpenter":   12_550,
}
