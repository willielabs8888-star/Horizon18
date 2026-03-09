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
from defaults import CONSUMER_DEBT_INTEREST_RATE


def run_projection(scenario: Scenario) -> SimResult:
    """Run a deterministic financial projection for one scenario.

    Args:
        scenario: A fully composed Scenario (three engine outputs + params).

    Returns:
        SimResult with year-by-year snapshots and summary metrics.
    """

    snapshots: list[YearSnapshot] = []
    student_debt = 0.0        # Student loans (from education costs)
    consumer_debt = 0.0       # Deficit debt (from negative cashflow)
    investment_balance = 0.0
    monthly_payment = 0.0
    loan_payments_started = False
    total_interest_paid = 0.0
    cumulative_earnings = 0.0
    cumulative_taxes = 0.0
    loan_payment_was_capped = False  # Track if payments ever exceeded disposable income
    repayment_start_year = None      # Track when repayment began

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
        # Each year of school, that year's costs are added to the student debt
        if year < school_years:
            year_cost = ed.annual_tuition[year] + ed.annual_room_and_board[year]
            # Apply family savings proportionally: spread across school years
            year_savings_share = family_savings_total / school_years if school_years > 0 else 0
            year_borrowed = max(0.0, year_cost - year_savings_share)
            student_debt += year_borrowed

        # --- INCOME (read from career engine) ---
        gross_income = career.annual_income[year]

        # Apply tax — but check tax_exempt_years
        if year in career.tax_exempt_years:
            net_income = gross_income  # GI Bill housing is tax-free
        else:
            net_income = gross_income * (1 - career.effective_tax_rate)

        # --- EXPENSES (read from living engine) ---
        expenses = living.annual_expenses[year]

        # --- CONSUMER DEBT INTEREST ---
        # Consumer debt accrues interest each year (credit card rates)
        if consumer_debt > 0:
            consumer_debt *= (1 + CONSUMER_DEBT_INTEREST_RATE)

        # --- STUDENT LOAN HANDLING ---
        loan_payment = 0.0
        loan_payment_required = 0.0  # What amortization demands (before any cap)
        interest_this_year = 0.0

        if student_debt > 0:
            school_done_year = ed.years_in_school
            grace_done_year = ed.years_in_school + (ed.grace_period_months / 12)

            if year < school_done_year:
                # During school/service: interest accrues (unsubsidized)
                interest_this_year = student_debt * ed.loan_interest_rate
                student_debt += interest_this_year
                total_interest_paid += interest_this_year

            elif year < grace_done_year:
                # Grace period: interest accrues, no payments
                interest_this_year = student_debt * ed.loan_interest_rate
                student_debt += interest_this_year
                total_interest_paid += interest_this_year

            else:
                # Repayment phase
                if not loan_payments_started:
                    loan_payments_started = True
                    repayment_start_year = year
                    monthly_payment = calculate_monthly_payment(
                        student_debt, ed.loan_interest_rate, ed.loan_term_years,
                    )

                # Calculate what the amortization schedule requires
                new_balance, interest, principal = amortize_year(
                    student_debt, ed.loan_interest_rate, monthly_payment,
                )
                loan_payment = interest + principal
                loan_payment_required = loan_payment  # Save pre-cap value
                interest_this_year = interest

                # --- LOAN FEASIBILITY CAP ---
                # Loan payments cannot exceed what the borrower can actually
                # afford. If the required payment exceeds disposable income
                # (net income minus living expenses), cap the payment and let
                # the loan extend.
                max_affordable = max(0.0, net_income - expenses)
                if loan_payment > max_affordable and max_affordable >= 0:
                    loan_payment_was_capped = True
                    # Pay only what's affordable
                    loan_payment = max_affordable
                    # Recalculate: interest still accrues, but less principal is paid
                    interest_this_year = student_debt * ed.loan_interest_rate
                    principal_paid = max(0.0, loan_payment - interest_this_year)
                    student_debt = student_debt + interest_this_year - principal_paid
                else:
                    student_debt = new_balance

                total_interest_paid += interest_this_year

        # --- SAVINGS + INVESTMENT ---
        # Disposable income = what's left after expenses and loan payments.
        disposable = net_income - expenses - loan_payment

        if disposable >= 0:
            # Positive cashflow: save a portion, grow investments
            new_savings = disposable * scenario.savings_rate

            # If there's consumer debt, pay it down before saving
            if consumer_debt > 0 and new_savings > 0:
                paydown = min(consumer_debt, new_savings)
                consumer_debt -= paydown
                new_savings -= paydown

            investment_balance = (
                investment_balance * (1 + scenario.investment_return_rate)
                + new_savings
            )
        else:
            # Negative cashflow: must cover the deficit
            deficit = abs(disposable)
            new_savings = 0.0

            # First, grow existing investments (they still earn returns)
            investment_balance = investment_balance * (1 + scenario.investment_return_rate)

            # Then draw down investments to cover the deficit
            if investment_balance >= deficit:
                investment_balance -= deficit
            else:
                # Investments can't cover it — remainder becomes consumer debt
                remaining_deficit = deficit - investment_balance
                investment_balance = 0.0
                consumer_debt += remaining_deficit

        # --- NET WORTH ---
        total_debt = student_debt + consumer_debt
        net_worth = investment_balance - total_debt

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
            loan_payment_required=round(loan_payment_required, 2),
            debt_remaining=round(max(0.0, student_debt), 2),
            annual_savings=round(new_savings, 2),
            investment_balance=round(investment_balance, 2),
            net_worth=round(net_worth, 2),
            cumulative_earnings=round(cumulative_earnings, 2),
            cumulative_taxes=round(cumulative_taxes, 2),
            savings_rate_actual=round(actual_savings_rate, 4),
            consumer_debt=round(max(0.0, consumer_debt), 2),
        ))

    # Compute summary metrics
    metrics = compute_summary_metrics(
        snapshots=snapshots,
        total_interest_paid=total_interest_paid,
        education=scenario.education,
        start_age=scenario.start_age,
        projection_years=scenario.projection_years,
    )

    # Calculate actual loan payoff duration
    loan_term_actual = 0
    if repayment_start_year is not None:
        # Find when debt hit 0 (or if it never did within projection window)
        for snap in snapshots:
            if snap.year >= repayment_start_year and snap.debt_remaining <= 0:
                loan_term_actual = snap.year - repayment_start_year
                break
        else:
            # Debt not paid off within projection window
            loan_term_actual = scenario.projection_years - repayment_start_year

    return SimResult(
        scenario=scenario,
        snapshots=snapshots,
        loan_extended=loan_payment_was_capped,
        loan_term_original=ed.loan_term_years,
        loan_term_actual=loan_term_actual,
        **metrics,
    )
