"""
Starting salary and salary growth defaults by major/field.

Sources:
- NACE (National Association of Colleges and Employers) 2025 salary survey
- Bureau of Labor Statistics Occupational Employment and Wage Statistics (May 2024)
- PayScale and Glassdoor entry-level salary aggregates

All salaries are NATIONAL AVERAGES for entry-level positions with the
relevant degree. Metro/regional multipliers are applied downstream by
the career engine.

CC transfer graduates receive a 2% salary discount vs direct 4-year grads in
the same major (per product decision — reflects minor signaling differences).
"""

# First full-time salary after completing education, by major
# Sources: NACE Winter 2025 projections + BLS OOH median entry-level
STARTING_SALARY: dict[str, float] = {
    # --- STEM cluster ---
    "computer_science":       76_251,   # NACE 2025: CS average
    "engineering":            78_731,   # NACE 2025: engineering average
    "biology":                45_000,   # BLS: biological technicians / entry bio
    "environmental_science":  48_500,   # BLS: environmental scientists entry

    # --- Health cluster ---
    "nursing":                77_600,   # BLS: registered nurses median (entry ~85th pctile adjusted down)
    "kinesiology":            48_000,   # BLS: exercise physiologists / fitness

    # --- Business cluster ---
    "business_finance":       65_276,   # NACE 2025: business/finance combined
    "accounting":             61_500,   # NACE: accounting entry-level
    "marketing":              57_000,   # NACE: marketing entry-level

    # --- Social science / humanities ---
    "psychology":             40_000,   # BLS: BA-level psychology positions
    "criminal_justice":       43_000,   # BLS: police/corrections entry (BA premium)
    "political_science":      44_500,   # BLS: policy analyst / govt entry
    "communications":         45_500,   # NACE: communications average
    "english":                40_000,   # NACE: humanities average
    "social_work":            41_000,   # BLS: social workers BA entry

    # --- Other ---
    "education":              44_860,   # BLS: K-12 teaching entry
    "art_design":             44_000,   # BLS: graphic designers / fine artists entry
    "undecided":              52_000,   # General/unspecialized average

    # --- Legacy aliases (map to closest new category) ---
    "stem":                   78_731,   # → engineering
    "business":               65_276,   # → business_finance
    "healthcare":             85_000,   # LOCKED at $85k per product decision
    "liberal_arts":           40_000,   # → psychology/english avg
}

# Annual REAL salary growth rate by field (inflation-adjusted)
# Nominal BLS 10-year trends minus ~2.5% CPI inflation.
# All figures represent real purchasing-power growth.
SALARY_GROWTH: dict[str, float] = {
    # --- STEM cluster ---
    "computer_science":       0.020,    # Tech: strong real growth
    "engineering":            0.015,    # Engineering: solid real growth
    "biology":                0.005,    # Bio: minimal real growth, often needs grad degree
    "environmental_science":  0.005,    # Environmental: growing field, modest real

    # --- Health cluster ---
    "nursing":                0.005,    # Healthcare: steady but tracks inflation
    "kinesiology":            0.005,    # Fitness: near-flat real growth

    # --- Business cluster ---
    "business_finance":       0.010,    # Business: good corporate ladder
    "accounting":             0.010,    # Accounting: CPA path accelerates
    "marketing":              0.005,    # Marketing: modest real growth

    # --- Social science / humanities ---
    "psychology":             0.005,    # Often needs grad school for advancement
    "criminal_justice":       0.005,    # Government pay scales
    "political_science":      0.005,    # Government/nonprofit
    "communications":         0.005,    # Media/PR: modest
    "english":                0.005,    # Humanities: near-flat real
    "social_work":            0.005,    # Social work: low ceiling without MSW

    # --- Other ---
    "education":              0.005,    # Teacher pay grows slowly
    "art_design":             0.005,    # Creative: varies wildly
    "undecided":              0.005,    # General average

    # --- Legacy aliases ---
    "stem":                   0.015,
    "business":               0.010,
    "healthcare":             0.005,
    "liberal_arts":           0.005,

    # --- Non-degree paths (used by other engines) ---
    "trade":                  0.005,    # Post-journeyman real growth
    "workforce":              0.005,    # Entry-level, minimal real growth
    "military_civilian":      0.005,    # Post-service civilian career
}

# Community college transfer salary discount (applied to starting salary)
# 2% discount vs same-major 4-year grad — LOCKED per product decision
CC_TRANSFER_SALARY_DISCOUNT: float = 0.02
