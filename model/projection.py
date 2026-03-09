"""
Projection Engine.

The core simulation loop. Reads pre-computed arrays from the three engines
and simulates savings, investment growth, and loan paydown year by year.

No path-specific logic lives here — all complexity is resolved upstream
by the engines.
"""

from __future__ import annotations

from model.data_models import Scenario, YearSnapshot, SimResult
from model.loan import calculate_monthly_payment, accrue_interest, amortize_year
from model.metrics import compute_summary_metrics


def run_projection(scenario: Scenario) -> SimResult:
    """Run a deterministic financial projection for one scenario.

    Args:
        scenario: A fully composed Scenario (three engine outputs + params).

    Returns:
        SimResult with year-by-year snapshots and summary metrics.
    """

    snapshots: list[YearSnapshot] = []
    debt = 0.0  # Loans are disbursed gradually during school, not front-loaded
    investment_balance = 0.0
    monthly_payment = 0.0
    loan_payments_started = False
    total_interest_paid = 0.0
    cumulative_earnings = 0.0
    cumulative_taxes = 0.0

    ed = scenario.education
    career = scenario.career
    living = scenario.living

    # Pre-compute per-year loan disbursement (tuition + R&B minus family savings share)
    # Family savings offset is spread proportionally across school years
    school_years = ed.years_in_school
    total_cost = sum(ed.annual_tuition) + sum(ed.annual_room_and_board)
    # total_loan_amount = max(0, total_cost - family_savings) from education engine
    # so: family_savings_used = total_cost - total_loan_amount
    family_savings_total = total_cost - scenario.education.total_loan_amount

    # If family savings exceeded total cost, the excess seeds investment balance
    # (e.g., parents gave $100k but school only costs $60k → $40k starts invested)
    if ed.excess_family_savings > 0:
        investment_balance = ed.excess_family_savings

    for year in range(scenario.projection_years):
        age = scenario.start_age + year

        # --- LOAN DISBURSEMENT (during school years) ---
        # Each year of school, that year's costs are added to the debt
        if year < school_years:
            year_cost = ed.annual_tuition[year] + ed.annual_room_and_board[year]
            # Apply family savings proportionally: spread across school years
            year_savings_share = family_savings_total / school_years if school_years > 0 else 0
            year_borrowed = max(0.0, year_cost - year_savings_share)
            debt += year_borrowed

        # --- INCOME (read from career engine) ---
        gross_income = career.annual_income[year]

        # Apply tax — but check tax_exempt_years
        if year in career.tax_exempt_years:
            net_income = gross_income  # GI Bill housing is tax-free
        else:
            net_income = gross_income * (1 - career.effective_tax_rate)

        # --- EXPENSES (read from living engine) ---
        expenses = living.annual_expenses[year]

        # --- LOAN HANDLING ---
        loan_payment = 0.0
        interest_this_year = 0.0

        if debt > 0:
            school_done_year = ed.years_in_school
            grace_done_year = ed.years_in_school + (ed.grace_period_months / 12)

            if year < school_done_year:
                # During school/service: interest accrues (unsubsidized)
                interest_this_year = debt * ed.loan_interest_rate
                debt += interest_this_year
                total_interest_paid += interest_this_year

            elif year < grace_done_year:
                # Grace period: interest accrues, no payments
                interest_this_year = debt * ed.loan_interest_rate
                debt += interest_this_year
                total_interest_paid += interest_this_year

            else:
                # Repayment phase
                if not loan_payments_started:
                    loan_payments_started = True
                    monthly_payment = calculate_monthly_payment(
                        debt, ed.loan_interest_rate, ed.loan_term_years,
                    )

                new_balance, interest, principal = amortize_year(
                    debt, ed.loan_interest_rate, monthly_payment,
                )
                loan_payment = interest + principal
                interest_this_year = interest
                total_interest_paid += interest
                debt = new_balance

        # --- SAVINGS + INVESTMENT ---
        # Savings rate = % of disposable income (what's left after expenses
        # and loan payments). This ensures higher debt → lower savings,
        # which correctly differentiates paths with different loan burdens.
        disposable = net_income - expenses - loan_payment
        new_savings = max(0.0, disposable * scenario.savings_rate)

        # Grow existing investments, then add new savings
        investment_balance = (
            investment_balance * (1 + scenario.investment_return_rate)
            + new_savings
        )

        # --- NET WORTH ---
        net_worth = investment_balance - debt

        # --- CUMULATIVE TRACKING ---
        taxes_this_year = gross_income - net_income
        cumulative_earnings += gross_income
        cumulative_taxes += taxes_this_year
        actual_savings_rate = (new_savings / disposable) if disposable > 0 else 0.0

        snapshots.append(YearSnapshot(
            year=year,
            age=age,
            gross_income=round(gross_income, 2),
            net_income=round(net_income, 2),
            living_expenses=round(expenses, 2),
            loan_payment=round(loan_payment, 2),
            debt_remaining=round(max(0.0, debt), 2),
            annual_savings=round(new_savings, 2),
            investment_balance=round(investment_balance, 2),
            net_worth=round(net_worth, 2),
            cumulative_earnings=round(cumulative_earnings, 2),
            cumulative_taxes=round(cumulative_taxes, 2),
            savings_rate_actual=round(actual_savings_rate, 4),
        ))

    # Compute summary metrics
    metrics = compute_summary_metrics(
        snapshots=snapshots,
        total_interest_paid=total_interest_paid,
        education=scenario.education,
        start_age=scenario.start_age,
        projection_years=scenario.projection_years,
    )

    return SimResult(
        scenario=scenario,
        snapshots=snapshots,
        **metrics,
    )
