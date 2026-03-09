"""
Centralized defaults database.

All baseline assumptions are defined in submodules and re-exported here
for convenient access:

    from defaults import TUITION_ANNUAL, STARTING_SALARY, REGION_MULTIPLIERS

Every value is overrideable downstream (via quiz answers, sliders, or
advanced settings). These are the "intelligent defaults" that make the
quiz-first UX possible.
"""

from defaults.tuition import (
    TUITION_ANNUAL,
    ROOM_AND_BOARD_ANNUAL,
    TRADE_SCHOOL_TOTAL,
)

from defaults.salaries import (
    STARTING_SALARY,
    SALARY_GROWTH,
    CC_TRANSFER_SALARY_DISCOUNT,
)

from defaults.trades import (
    APPRENTICE_WAGES,
    JOURNEYMAN_SALARY,
)

from defaults.military import (
    ENLISTED_ANNUAL_COMP,
    MILITARY_MONTHLY_EXPENSES,
    GI_BILL,
    VETERAN_HIRING_PREMIUM,
)

from defaults.workforce import ENTRY_WAGES

from defaults.regions import REGION_MULTIPLIERS, get_multipliers_for_metro

from defaults.living import MONTHLY_EXPENSES

from defaults.financial import (
    SAVINGS_RATE,
    INVESTMENT_RETURN,
    EFFECTIVE_TAX_RATE,
    LOAN_INTEREST_RATE,
    LOAN_TERM_YEARS,
    GRACE_PERIOD_MONTHS,
    EXPENSE_INFLATION_RATE,
)

from defaults.schools import (
    get_school,
    search_schools,
    get_school_count,
    has_school_database,
)

__all__ = [
    "TUITION_ANNUAL",
    "ROOM_AND_BOARD_ANNUAL",
    "TRADE_SCHOOL_TOTAL",
    "STARTING_SALARY",
    "SALARY_GROWTH",
    "CC_TRANSFER_SALARY_DISCOUNT",
    "APPRENTICE_WAGES",
    "JOURNEYMAN_SALARY",
    "ENLISTED_ANNUAL_COMP",
    "MILITARY_MONTHLY_EXPENSES",
    "GI_BILL",
    "VETERAN_HIRING_PREMIUM",
    "ENTRY_WAGES",
    "REGION_MULTIPLIERS",
    "get_multipliers_for_metro",
    "MONTHLY_EXPENSES",
    "SAVINGS_RATE",
    "INVESTMENT_RETURN",
    "EFFECTIVE_TAX_RATE",
    "LOAN_INTEREST_RATE",
    "LOAN_TERM_YEARS",
    "GRACE_PERIOD_MONTHS",
    "EXPENSE_INFLATION_RATE",
    "get_school",
    "search_schools",
    "get_school_count",
    "has_school_database",
]
