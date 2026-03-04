"""
Shared financial parameter defaults.

These are the "knobs" that apply across all paths. They're adjustable
via sliders on the results page in the future web app.

Investment return: 7% (LOCKED per product decision — historically reasonable,
slight optimism acceptable with disclaimer).

Effective tax rate: 18% (simplified flat rate for early-career earners,
avoids bracket complexity in V0).
"""

SAVINGS_RATE: float = 0.10              # 10% of net (take-home) income, capped at disposable
INVESTMENT_RETURN: float = 0.07         # 7% annual return (LOCKED)
EFFECTIVE_TAX_RATE: float = 0.18        # Simplified effective rate (engine default)
LOAN_INTEREST_RATE: float = 0.065       # Federal direct loan rate
LOAN_TERM_YEARS: int = 15              # Default repayment plan (editable by user, 5-30 years)
GRACE_PERIOD_MONTHS: int = 6           # Post-graduation grace period

# Region-based effective tax rate defaults (blended federal + state + payroll)
# Used by the frontend Advanced Assumptions section to set initial slider value.
REGION_TAX_RATES: dict[str, float] = {
    "northeast": 0.25,
    "southeast": 0.22,
    "midwest": 0.22,
    "southwest": 0.22,
    "west_coast": 0.27,
}
