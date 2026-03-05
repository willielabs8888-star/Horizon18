"""
Trade apprenticeship wage ramps and journeyman salary defaults.

Sources:
- Bureau of Labor Statistics (BLS) Occupational Employment and Wage Statistics (May 2024)
- Department of Labor registered apprenticeship data
- Industry-specific training provider wage schedules

Apprentice wages are annual salary for each year of a 4-year apprenticeship.
These represent typical progression from ~40-50% of journeyman pay in year 1
to ~80-85% in year 4.

All salaries are NATIONAL MEDIANS. Metro/regional multipliers are applied
downstream by the career engine.
"""

# Year-by-year apprentice wages (list of 4 annual salaries)
# Formula: roughly 40% → 55% → 70% → 85% of journeyman salary
APPRENTICE_WAGES: dict[str, list[float]] = {
    "electrician":       [35_000, 42_000, 49_000, 56_000],
    "plumber":           [36_500, 42_000, 50_000, 57_000],
    "hvac":              [25_080, 32_000, 38_000, 43_000],
    "carpenter":         [33_000, 38_000, 45_000, 52_000],
    "welder":            [30_000, 36_000, 41_000, 46_000],
    "automotive_tech":   [28_000, 33_000, 38_000, 42_000],
    "diesel_mechanic":   [30_000, 36_000, 43_000, 50_000],
    "cnc_machinist":     [30_000, 35_000, 40_000, 45_000],
    "lineworker":        [38_000, 46_000, 54_000, 63_000],
    "ironworker":        [34_000, 41_000, 48_000, 55_000],
    "elevator_mechanic": [40_000, 50_000, 60_000, 72_000],
    "heavy_equipment_op":[30_000, 36_000, 42_000, 48_000],
}

# Full journeyman salary (after completing apprenticeship)
# Source: BLS OEWS May 2024 national median wages
JOURNEYMAN_SALARY: dict[str, float] = {
    "electrician":       67_810,    # BLS 47-2111
    "plumber":           64_960,    # BLS 47-2152
    "hvac":              54_100,    # BLS 49-9021
    "carpenter":         60_083,    # BLS 47-2031
    "welder":            49_000,    # BLS 51-4121
    "automotive_tech":   48_000,    # BLS 49-3023
    "diesel_mechanic":   58_000,    # BLS 49-3031
    "cnc_machinist":     49_970,    # BLS 51-4041
    "lineworker":        82_340,    # BLS 49-9051 (electrical power-line installers)
    "ironworker":        62_000,    # BLS 47-2171
    "elevator_mechanic": 99_000,    # BLS 47-4021 (highest-paid trade)
    "heavy_equipment_op":55_280,    # BLS 47-2073
}
