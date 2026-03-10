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

    # Family savings (529 account) — starts invested and grows at the
    # investment return rate. Each school year, that year's costs are
    # withdrawn from the 529 first. Only if the 529 is depleted does
    # the student take out loans for the remainder.
    school_years = ed.years_in_school
    total_cost = sum(ed.annual_tuition) + sum(ed.annual_room_and_board)

    # Reconstruct original family savings: excess + amount used for school
    family_savings_used = total_cost - ed.total_loan_amount
    original_family_savings = ed.excess_family_savings + family_savings_used

    # 529 balance starts with ALL family savings (grows while in school)
    savings_529 = original_family_savings

    for year in range(scenario.projection_years):
        age = scenario.start_age + year

        # --- 529 GROWTH (during school years) ---
        # The 529 grows at the investment return rate each year
        if year < school_years and savings_529 > 0:
            savings_529 *= (1 + scenario.investment_return_rate)

        # --- INCOME (read from career engine) ---
        # Income is calculated FIRST so that part-time earnings during
        # school can offset tuition/R&B costs and reduce borrowing.
        gross_income = career.annual_income[year]

        # Apply tax — but check tax_exempt_years
        if year in career.tax_exempt_years:
            net_income = gross_income  # GI Bill housing is tax-free
        else:
            net_income = gross_income * (1 - career.effective_tax_rate)

        # --- SCHOOL COSTS + LOAN DISBURSEMENT ---
        # Each year of school: part-time income offsets costs first,
        # then 529 covers what it can, and the rest becomes student loans.
        pt_income_used_for_school = 0.0
        if year < school_years:
            year_cost = ed.annual_tuition[year] + ed.annual_room_and_board[year]

            # Part-time income offsets school costs (reduces borrowing)
            pt_income_used_for_school = min(net_income, year_cost)
            year_cost -= pt_income_used_for_school

            # Pay remainder from 529 first
            paid_from_529 = min(savings_529, year_cost)
            savings_529 -= paid_from_529
            year_borrowed = year_cost - paid_from_529
            student_debt += year_borrowed

        # --- TRANSFER REMAINING 529 TO INVESTMENTS ---
        # Once school is done, any remaining 529 balance moves to investments
        if year == school_years and savings_529 > 0:
            investment_balance += savings_529
            savings_529 = 0.0

        # --- EXPENSES (read from living engine) ---
        expenses = living.annual_expenses[year]

        # Grace period expense adjustment: graduates mid-year (May/June),
        # so the first year after school has only ~6 months of full
        # independent living expenses, mirroring the grace period income logic.
        if year == school_years and school_years > 0:
            expenses *= (ed.grace_period_months / 12)

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

                # --- CONSUMER DEBT PRIORITY ---
                # If consumer debt exists (~15.5% interest), defer student
                # loan payments (~4% interest) and let disposable income
                # attack the higher-rate debt first. Interest still accrues
                # on student loans during deferral.
                if consumer_debt > 0:
                    interest_this_year = student_debt * ed.loan_interest_rate
                    student_debt += interest_this_year
                    total_interest_paid += interest_this_year
                    loan_payment = 0.0
                    loan_payment_was_capped = True
                else:
                    # Normal amortization — no consumer debt to worry about
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
        # During school years, part-time income already used for tuition
        # is excluded so it isn't double-counted.
        disposable = net_income - pt_income_used_for_school - expenses - loan_payment

        if disposable >= 0:
            # Savings target = % of net income (what the user "wants" to save).
            # But actual savings can't exceed what's available after all costs.
            # Example: 25% of $40k net = $10k target, but if only $5k is
            # available after expenses + loans, actual savings = $5k (12.5%).
            target_savings = net_income * scenario.savings_rate
            available_for_savings = disposable  # What's actually left

            if consumer_debt > 0:
                # PRIORITY: Pay down high-interest consumer debt first.
                # All disposable income goes to consumer debt before saving.
                paydown = min(consumer_debt, disposable)
                consumer_debt -= paydown
                available_for_savings = disposable - paydown

            new_savings = min(target_savings, available_for_savings)

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
                # Investments can't cover it — remainder becomes debt
                remaining_deficit = deficit - investment_balance
                investment_balance = 0.0

                if year < school_years:
                    # During school: shortfalls are covered by student loans
                    # (students borrow more, not credit cards)
                    student_debt += remaining_deficit
                else:
                    # After school: shortfalls become consumer debt
                    consumer_debt += remaining_deficit

        # --- NET WORTH ---
        # Include 529 balance as part of investment balance for display
        displayed_investments = investment_balance + savings_529
        total_debt = student_debt + consumer_debt
        net_worth = displayed_investments - total_debt

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
            investment_balance=round(displayed_investments, 2),
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
