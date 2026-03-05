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
# Sources: DOL apprenticeship data, trade school directories, industry averages
TRADE_SCHOOL_TOTAL: dict[str, float] = {
    "electrician":       14_640,
    "plumber":           12_500,
    "hvac":              12_500,
    "carpenter":         12_550,
    "welder":            15_000,    # Welding program (6-18 months)
    "automotive_tech":   20_000,    # UTI/tech school (longer programs)
    "diesel_mechanic":   18_000,    # Diesel tech program
    "cnc_machinist":     15_000,    # CNC/machining certificate
    "lineworker":        10_000,    # Lineworker program (shorter, often utility-sponsored)
    "ironworker":        12_000,    # Ironworker apprenticeship fees
    "elevator_mechanic": 12_000,    # Elevator union apprenticeship fees
    "heavy_equipment_op":10_000,    # Equipment operator training
}
