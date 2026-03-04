"""
Loan amortization math.

Handles:
- Monthly payment calculation (standard amortization formula)
- Interest accrual during school (unsubsidized loans)
- Grace period interest accrual
- Year-by-year amortization tracking

All internal math uses monthly precision, results are annualized
for the projection engine.
"""

from __future__ import annotations


def calculate_monthly_payment(
    principal: float,
    annual_rate: float,
    term_years: int,
) -> float:
    """Standard amortization: fixed monthly payment for a given loan.

    M = P * [r(1+r)^n] / [(1+r)^n - 1]

    Args:
        principal: Remaining loan balance.
        annual_rate: Annual interest rate (e.g. 0.065 for 6.5%).
        term_years: Repayment period in years.

    Returns:
        Monthly payment amount. Returns 0 if principal <= 0 or rate is 0.
    """
    if principal <= 0:
        return 0.0

    monthly_rate = annual_rate / 12
    n_months = term_years * 12

    if monthly_rate == 0:
        return principal / n_months

    factor = (1 + monthly_rate) ** n_months
    return principal * (monthly_rate * factor) / (factor - 1)


def accrue_interest(balance: float, annual_rate: float) -> float:
    """Accrue one year of interest on an outstanding balance.

    Used during school and grace periods when no payments are being made
    (unsubsidized loans).

    Returns the new balance after interest accrual.
    """
    if balance <= 0:
        return 0.0
    return balance * (1 + annual_rate)


def amortize_year(
    balance: float,
    annual_rate: float,
    monthly_payment: float,
) -> tuple[float, float, float]:
    """Simulate one year of loan repayment (12 monthly payments).

    Tracks interest vs principal split month by month for accuracy,
    then returns annualized totals.

    Args:
        balance: Loan balance at start of year.
        annual_rate: Annual interest rate.
        monthly_payment: Fixed monthly payment.

    Returns:
        Tuple of (new_balance, total_interest_paid, total_principal_paid)
    """
    if balance <= 0:
        return 0.0, 0.0, 0.0

    monthly_rate = annual_rate / 12
    total_interest = 0.0
    total_principal = 0.0

    for _ in range(12):
        if balance <= 0:
            break

        interest = balance * monthly_rate
        principal = min(monthly_payment - interest, balance)

        if principal < 0:
            # Payment doesn't cover interest — negative amortization
            # Shouldn't happen with standard loans but handle gracefully
            principal = 0.0

        total_interest += interest
        total_principal += principal
        balance -= principal

    return max(0.0, balance), total_interest, total_principal
