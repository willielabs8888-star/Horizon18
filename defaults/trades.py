"""
Trade apprenticeship wage ramps and journeyman salary defaults.

Sources:
- Bureau of Labor Statistics (BLS) Occupational Employment and Wage Statistics
- Department of Labor registered apprenticeship data
- Industry-specific training provider wage schedules

Apprentice wages are annual salary for each year of a 4-year apprenticeship.
These represent typical progression from ~40-50% of journeyman pay in year 1
to ~80-85% in year 4.
"""

# Year-by-year apprentice wages (list of 4 annual salaries)
APPRENTICE_WAGES: dict[str, list[float]] = {
    "electrician": [35_000, 42_000, 49_000, 56_000],
    "plumber":     [36_500, 42_000, 50_000, 57_000],
    "hvac":        [25_080, 32_000, 38_000, 43_000],
    "carpenter":   [33_000, 38_000, 45_000, 52_000],
}

# Full journeyman salary (after completing apprenticeship)
JOURNEYMAN_SALARY: dict[str, float] = {
    "electrician": 67_810,
    "plumber":     64_960,
    "hvac":        54_100,
    "carpenter":   60_083,
}
