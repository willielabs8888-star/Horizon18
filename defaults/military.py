"""
Military enlisted pay, benefits, and GI Bill defaults.

Sources:
- Defense Finance and Accounting Service (DFAS) 2025 pay tables
- Military.com BAH calculator (national averages)
- Veterans Affairs Post-9/11 GI Bill benefit rates (2025-2026 AY)

Total compensation = base pay + Basic Allowance for Housing (BAH).
BAH is for single service members without dependents (national average).

During active duty, most living expenses are covered:
- Housing: barracks or BAH
- Food: BAS (Basic Allowance for Subsistence) or dining facility
- Healthcare: Tricare (free)
- Remaining personal expenses: phone, car insurance, personal items
"""

# Annual total compensation by year of enlistment
# Format: base pay + (BAH * 12)
ENLISTED_ANNUAL_COMP: list[float] = [
    39_696,   # Year 1: E-1 ($25,296 base) + ($1,200/mo BAH * 12)
    42_780,   # Year 2: E-2 ($28,380 base) + ($1,200/mo BAH * 12)
    44_532,   # Year 3: E-3 ($30,132 base) + ($1,200/mo BAH * 12)
    49_584,   # Year 4: E-4 ($34,584 base) + ($1,250/mo BAH * 12)
]

# Monthly out-of-pocket expenses during active duty service
# Nearly everything is covered; this covers phone, car, insurance, personal
MILITARY_MONTHLY_EXPENSES: float = 400

# Post-9/11 GI Bill benefits (2025-2026 academic year)
GI_BILL: dict[str, float] = {
    "annual_tuition_cap":   29_921,   # Max annual tuition for private schools
                                       # (public in-state: typically fully covered)
    "monthly_housing":       2_338,   # Monthly housing allowance (in-classroom)
    "annual_books":          1_000,   # Annual books and supplies stipend
    "months_of_benefits":       36,   # 36 months = covers full 4-year degree
}

# Salary premium for veterans entering civilian workforce without a degree
# Reflects hiring preference for veterans in many industries
VETERAN_HIRING_PREMIUM: float = 0.10
