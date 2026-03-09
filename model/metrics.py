"""
Derived summary metrics from simulation snapshots.

These are the numbers that power the comparison table and the
plain-English narrative.
"""

from __future__ import annotations

from model.data_models import YearSnapshot, EducationProfile


# Candidate milestone ages — we only show ones that fall within the horizon.
_MILESTONE_AGES = [25, 30, 38, 50, 60, 65]


def _pick_milestones(start_age: int, projection_years: int) -> list[int]:
    """Select milestone ages that fall within the projection window.

    Always includes the final age of the projection as the last milestone
    (unless it's already in the list).
    """
    end_age = start_age + projection_years - 1
    milestones = [a for a in _MILESTONE_AGES if start_age < a <= end_age]

    # Always include end-of-horizon
    if end_age not in milestones:
        milestones.append(end_age)

    return sorted(milestones)


def compute_summary_metrics(
    snapshots: list[YearSnapshot],
    total_interest_paid: float,
    education: EducationProfile,
    start_age: int,
    projection_years: int = 32,
) -> dict:
    """Compute all summary metrics from a completed projection.

    Returns a dict matching SimResult field names.
    """

    total_earnings = sum(s.gross_income for s in snapshots)

    # Total cost of education = sticker price (tuition + room & board).
    # This is intentionally DIFFERENT from total_loan_amount, which is
    # the financed portion (sticker price - family savings).
    # Both are useful: sticker price shows what the path costs;
    # loan amount shows what the student actually borrows.
    total_tuition = sum(education.annual_tuition)
    total_rb = sum(education.annual_room_and_board)
    total_cost = total_tuition + total_rb

    # Year debt-free (age when debt hits 0)
    year_debt_free = None
    had_debt = any(s.debt_remaining > 0 for s in snapshots)
    if had_debt:
        for s in snapshots:
            if s.debt_remaining <= 0 and s.year > 0:
                year_debt_free = s.age
                break
        # If never paid off within horizon
        if year_debt_free is None and snapshots[-1].debt_remaining > 0:
            year_debt_free = None  # Still in debt at end
    elif education.total_loan_amount == 0:
        year_debt_free = None  # Never had debt

    # Year positive net worth
    year_positive_nw = None
    for s in snapshots:
        if s.net_worth > 0:
            year_positive_nw = s.age
            break

    # Net worth at milestone ages — adaptive to projection horizon
    def nw_at_age(target_age: int) -> float:
        for s in snapshots:
            if s.age == target_age:
                return s.net_worth
        # If target age is beyond projection, return last
        return snapshots[-1].net_worth if snapshots else 0.0

    milestones = _pick_milestones(start_age, projection_years)
    net_worth_milestones = {age: nw_at_age(age) for age in milestones}

    # Peak debt burden ratio: max(required_loan_payment / net_income)
    # Uses the pre-cap required payment so the ratio reflects true burden,
    # not the artificially lowered capped amount.
    debt_burden = 0.0
    for s in snapshots:
        required = s.loan_payment_required if s.loan_payment_required > 0 else s.loan_payment
        if s.net_income > 0 and required > 0:
            ratio = required / s.net_income
            debt_burden = max(debt_burden, ratio)

    return {
        "total_earnings": round(total_earnings, 2),
        "total_loan_interest_paid": round(total_interest_paid, 2),
        "total_cost_of_education": round(total_cost, 2),
        "year_debt_free": year_debt_free,
        "year_positive_net_worth": year_positive_nw,
        "net_worth_milestones": net_worth_milestones,
        # Legacy accessors — safe fallback for ages outside horizon
        "net_worth_at_25": nw_at_age(25),
        "net_worth_at_30": nw_at_age(30),
        "net_worth_at_38": nw_at_age(38),
        "net_worth_at_50": nw_at_age(50),
        "debt_burden_ratio": round(debt_burden, 4),
    }
