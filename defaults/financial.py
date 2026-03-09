"""
Shared financial parameter defaults.

These are the "knobs" that apply across all paths. They're adjustable
via sliders on the results page in the future web app.

ALL VALUES ARE IN REAL (INFLATION-ADJUSTED) DOLLARS.
We strip ~2.5% historical CPI inflation from all nominal rates so that
every dollar shown represents today's purchasing power.

Investment return: ~4.5% real (nominal ~7% minus ~2.5% inflation).
Loan interest:     ~4.0% real (nominal ~6.5% minus ~2.5% inflation).
Effective tax rate: 18% (simplified flat rate for early-career earners,
avoids bracket complexity in V0).
"""

SAVINGS_RATE: float = 0.10              # 10% of net (take-home) income, capped at disposable
INVESTMENT_RETURN: float = 0.06         # ~6% real return
EFFECTIVE_TAX_RATE: float = 0.18        # Simplified effective rate (engine default)
LOAN_INTEREST_RATE: float = 0.040       # ~4.0% real rate (nominal ~6.5% minus ~2.5% inflation)
LOAN_TERM_YEARS: int = 10              # Default repayment plan (editable by user, 5-30 years)
GRACE_PERIOD_MONTHS: int = 6           # Post-graduation grace period
EXPENSE_INFLATION_RATE: float = 0.0    # 0% — expenses are flat in real dollars

# Region-based effective tax rate defaults (blended federal + state + payroll)
# Used by the frontend Advanced Assumptions section to set initial slider value.
REGION_TAX_RATES: dict[str, float] = {
    "northeast": 0.25,
    "southeast": 0.22,
    "midwest": 0.22,
    "southwest": 0.22,
    "west_coast": 0.27,
}
