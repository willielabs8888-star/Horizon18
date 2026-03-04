"""
Starting salary and salary growth defaults by major/field.

Sources:
- NACE (National Association of Colleges and Employers) 2025 salary survey
- Bureau of Labor Statistics Occupational Outlook Handbook
- PayScale and Glassdoor entry-level salary aggregates

Healthcare set to $85,000 per product decision (balanced between conservative
$70k and BLS RN average $100k).

CC transfer graduates receive a 2% salary discount vs direct 4-year grads in
the same major (per product decision — reflects minor signaling differences).
"""

# First full-time salary after completing education, by major category
STARTING_SALARY: dict[str, float] = {
    "stem":          80_000,   # Blended engineering + CS average
    "business":      65_276,   # Business/Finance combined
    "healthcare":    85_000,   # LOCKED: balanced RN-level, no grad degrees
    "liberal_arts":  39_349,   # Humanities, social sciences
    "education":     44_860,   # K-12 teaching
    "undecided":     52_000,   # General/unspecialized average
}

# Annual salary growth rate by field
SALARY_GROWTH: dict[str, float] = {
    "stem":              0.040,   # Tech/engineering: faster early-career growth
    "business":          0.035,
    "healthcare":        0.030,
    "liberal_arts":      0.025,
    "education":         0.020,   # Teacher pay grows slowly
    "undecided":         0.030,
    "trade":             0.025,   # Post-journeyman growth
    "workforce":         0.020,   # Entry-level, no credential
    "military_civilian": 0.030,   # Post-service civilian career
}

# Community college transfer salary discount (applied to starting salary)
# 2% discount vs same-major 4-year grad — LOCKED per product decision
CC_TRANSFER_SALARY_DISCOUNT: float = 0.02
