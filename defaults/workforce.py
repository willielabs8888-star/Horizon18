"""
Direct workforce entry-level wage defaults by industry.

Sources:
- Bureau of Labor Statistics (BLS) Occupational Employment and Wage Statistics (May 2024)
- Indeed, Glassdoor, and ZipRecruiter entry-level wage surveys (2025)

These are annual salaries for full-time entry-level positions requiring
no post-secondary education (high school diploma or GED only).

All salaries are NATIONAL MEDIANS. Metro/regional multipliers are applied
downstream by the career engine.
"""

# Annual starting salary by industry sector
ENTRY_WAGES: dict[str, float] = {
    "retail":           32_240,    # BLS 41-2031: retail salespersons
    "logistics":        36_500,    # BLS 53-7065: warehouse / stockers + forklift
    "food_service":     28_245,    # BLS 35-3023: fast food / restaurant (pre-tip base)
    "admin":            35_419,    # BLS 43-6014: office assistant, receptionist
    "manufacturing":    34_320,    # BLS 51-9199: production, assembly
    "security":         36_530,    # BLS 33-9032: security guards
    "landscaping":      34_480,    # BLS 37-3011: landscaping / groundskeeping
    "customer_service": 38_200,    # BLS 43-4051: customer service representatives
    "delivery_driver":  38_180,    # BLS 53-3033: light truck / delivery drivers
    "janitorial":       31_990,    # BLS 37-2011: janitors and cleaners
    "home_health_aide": 33_530,    # BLS 31-1120: home health / personal care aides
    "childcare":        28_520,    # BLS 39-9011: childcare workers
}
