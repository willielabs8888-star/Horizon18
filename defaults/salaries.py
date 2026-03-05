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

# Annual salary growth rate by field
# Based on BLS 10-year wage growth trends and industry projections
SALARY_GROWTH: dict[str, float] = {
    # --- STEM cluster ---
    "computer_science":       0.045,    # Tech: fast early-career growth
    "engineering":            0.040,    # Engineering: strong growth
    "biology":                0.030,    # Bio: moderate, often needs grad degree
    "environmental_science":  0.030,    # Environmental: growing field, moderate

    # --- Health cluster ---
    "nursing":                0.030,    # Healthcare: steady, shift differentials
    "kinesiology":            0.025,    # Fitness: slower growth, ceiling

    # --- Business cluster ---
    "business_finance":       0.035,    # Business: good corporate ladder
    "accounting":             0.035,    # Accounting: CPA path accelerates
    "marketing":              0.030,    # Marketing: moderate growth

    # --- Social science / humanities ---
    "psychology":             0.025,    # Often needs grad school for advancement
    "criminal_justice":       0.025,    # Government pay scales
    "political_science":      0.025,    # Government/nonprofit
    "communications":         0.030,    # Media/PR: moderate
    "english":                0.020,    # Humanities: slow growth
    "social_work":            0.020,    # Social work: low ceiling without MSW

    # --- Other ---
    "education":              0.020,    # Teacher pay grows slowly
    "art_design":             0.025,    # Creative: varies wildly
    "undecided":              0.030,    # General average

    # --- Legacy aliases ---
    "stem":                   0.040,
    "business":               0.035,
    "healthcare":             0.030,
    "liberal_arts":           0.025,

    # --- Non-degree paths (used by other engines) ---
    "trade":                  0.025,    # Post-journeyman growth
    "workforce":              0.020,    # Entry-level, no credential
    "military_civilian":      0.030,    # Post-service civilian career
}

# Community college transfer salary discount (applied to starting salary)
# 2% discount vs same-major 4-year grad — LOCKED per product decision
CC_TRANSFER_SALARY_DISCOUNT: float = 0.02
