"""
Living Expense Engine.

Takes quiz answers and defaults, produces a LivingProfile with a
pre-computed annual_expenses array for the full projection horizon.
"""

from __future__ import annotations

from model.data_models import (
    PathType, Region, LivingProfile,
)
from defaults import (
    MONTHLY_EXPENSES, MILITARY_MONTHLY_EXPENSES,
    get_multipliers_for_metro, EXPENSE_INFLATION_RATE,
)


def build_living_profile(
    path_type: PathType,
    region: Region,
    living_at_home: bool,
    years_at_home: int,
    projection_years: int = 32,
    metro_area: str = "national_avg",
    military_service_years: int = 0,
    military_use_gi_bill: bool = False,
    expense_inflation_rate: float = EXPENSE_INFLATION_RATE,
) -> LivingProfile:
    """Build a LivingProfile from quiz answers + defaults."""

    # Per-metro expense multiplier (falls back to regional)
    mults = get_multipliers_for_metro(metro_area)
    exp_mult = mults["expenses"]

    monthly_home = MONTHLY_EXPENSES["at_home"]
    monthly_indep = MONTHLY_EXPENSES["independent"]

    annual_home = monthly_home * 12 * exp_mult
    annual_indep = monthly_indep * 12 * exp_mult
    annual_military = MILITARY_MONTHLY_EXPENSES * 12  # No regional mult — on base

    expenses: list[float] = []

    for year in range(projection_years):
        # Apply inflation: year-0 costs are base, each subsequent year grows
        inflation_factor = (1 + expense_inflation_rate) ** year

        if path_type == PathType.MILITARY and year < military_service_years:
            # During active duty, nearly everything is covered
            expenses.append(annual_military * inflation_factor)
        elif path_type == PathType.MILITARY and military_use_gi_bill and year < military_service_years + 4:
            # During GI Bill school: living at home or independently
            if living_at_home and (year - military_service_years) < years_at_home:
                expenses.append(annual_home * inflation_factor)
            else:
                expenses.append(annual_indep * inflation_factor)
        elif living_at_home and year < years_at_home:
            expenses.append(annual_home * inflation_factor)
        else:
            expenses.append(annual_indep * inflation_factor)

    return LivingProfile(
        annual_expenses=expenses,
        region=region,
        at_home_years=years_at_home,
        monthly_at_home=round(monthly_home * exp_mult, 2),
        monthly_independent=round(monthly_indep * exp_mult, 2),
    )
