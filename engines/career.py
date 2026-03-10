"""
Career Income Engine.

Takes quiz answers and defaults, produces a CareerProfile with a
pre-computed annual_income array for the full projection horizon.

The projection engine reads this array directly — no phase logic needed.
"""

from __future__ import annotations

from model.data_models import (
    PathType, Major, TradeType, WorkforceIndustry, Region,
    CareerProfile,
    CollegeAnswers, CommunityCollegeAnswers, TradeAnswers,
    WorkforceAnswers, MilitaryAnswers,
)
from defaults import (
    STARTING_SALARY, SALARY_GROWTH, CC_TRANSFER_SALARY_DISCOUNT,
    APPRENTICE_WAGES, JOURNEYMAN_SALARY,
    ENLISTED_ANNUAL_COMP, VETERAN_HIRING_PREMIUM,
    ENTRY_WAGES, EFFECTIVE_TAX_RATE,
    GI_BILL, GRACE_PERIOD_MONTHS, get_multipliers_for_metro,
)


def build_career_profile(
    path_type: PathType,
    region: Region,
    projection_years: int = 32,
    metro_area: str = "national_avg",
    college: CollegeAnswers | None = None,
    community_college: CommunityCollegeAnswers | None = None,
    trade: TradeAnswers | None = None,
    workforce: WorkforceAnswers | None = None,
    military: MilitaryAnswers | None = None,
) -> CareerProfile:
    """Build a CareerProfile from quiz answers + defaults."""

    # Per-metro multipliers (falls back to regional if no metro-specific data)
    mults = get_multipliers_for_metro(metro_area)
    sal_mult = mults["salary"]

    if path_type == PathType.COLLEGE:
        return _build_college_career(college or CollegeAnswers(), sal_mult, projection_years)

    elif path_type == PathType.CC_TRANSFER:
        return _build_cc_career(community_college or CommunityCollegeAnswers(), sal_mult, projection_years)

    elif path_type == PathType.TRADE:
        return _build_trade_career(trade or TradeAnswers(), sal_mult, projection_years)

    elif path_type == PathType.WORKFORCE:
        return _build_workforce_career(workforce or WorkforceAnswers(), sal_mult, projection_years)

    elif path_type == PathType.MILITARY:
        return _build_military_career(military or MilitaryAnswers(), sal_mult, projection_years)

    else:
        raise ValueError(f"Unknown path type: {path_type}")


def _build_college_career(
    answers: CollegeAnswers,
    salary_multiplier: float,
    projection_years: int,
) -> CareerProfile:
    major = answers.major.value
    if answers.starting_salary_override is not None:
        base_salary = answers.starting_salary_override
    else:
        base_salary = STARTING_SALARY[major] * salary_multiplier
    growth = SALARY_GROWTH[major]
    years_in_school = 4
    part_time = answers.part_time_income if answers.part_time_work else 0.0

    income: list[float] = []
    for year in range(projection_years):
        if year < years_in_school:
            income.append(part_time)
        elif year == years_in_school:
            # Grace period — fraction of salary based on grace months
            income.append(base_salary * (GRACE_PERIOD_MONTHS / 12))
        else:
            years_working = year - years_in_school
            income.append(base_salary * (1 + growth) ** years_working)

    return CareerProfile(
        label=f"{major.replace('_', ' ').title()} (4-Year Degree)",
        annual_income=income,
        income_start_age=18 + years_in_school + 1,
        starting_salary=base_salary,
        salary_growth_rate=growth,
        effective_tax_rate=EFFECTIVE_TAX_RATE,
    )


def _build_cc_career(
    answers: CommunityCollegeAnswers,
    salary_multiplier: float,
    projection_years: int,
) -> CareerProfile:
    major = answers.major.value
    if answers.starting_salary_override is not None:
        base_salary = answers.starting_salary_override
    else:
        base_salary = STARTING_SALARY[major] * salary_multiplier * (1 - CC_TRANSFER_SALARY_DISCOUNT)
    growth = SALARY_GROWTH[major]
    years_in_school = 4
    part_time = answers.part_time_income if answers.part_time_work else 0.0

    income: list[float] = []
    for year in range(projection_years):
        if year < years_in_school:
            income.append(part_time)
        elif year == years_in_school:
            income.append(base_salary * (GRACE_PERIOD_MONTHS / 12))
        else:
            years_working = year - years_in_school
            income.append(base_salary * (1 + growth) ** years_working)

    return CareerProfile(
        label=f"{major.replace('_', ' ').title()} (CC + Transfer)",
        annual_income=income,
        income_start_age=18 + years_in_school + 1,
        starting_salary=base_salary,
        salary_growth_rate=growth,
        effective_tax_rate=EFFECTIVE_TAX_RATE,
    )


def _build_trade_career(
    answers: TradeAnswers,
    salary_multiplier: float,
    projection_years: int,
) -> CareerProfile:
    trade = answers.trade_type.value
    if answers.apprentice_wages_override is not None:
        apprentice_wages = answers.apprentice_wages_override
    else:
        apprentice_wages = APPRENTICE_WAGES[trade]
    if answers.journeyman_salary_override is not None:
        journeyman = answers.journeyman_salary_override
    else:
        journeyman = JOURNEYMAN_SALARY[trade] * salary_multiplier
    growth = SALARY_GROWTH["trade"]
    apprentice_years = len(apprentice_wages)

    income: list[float] = []
    for year in range(projection_years):
        if year < apprentice_years:
            # Apply multiplier only to default wages, not overrides
            if answers.apprentice_wages_override is not None:
                income.append(apprentice_wages[year])
            else:
                income.append(apprentice_wages[year] * salary_multiplier)
        else:
            years_as_journeyman = year - apprentice_years
            income.append(journeyman * (1 + growth) ** years_as_journeyman)

    return CareerProfile(
        label=f"{trade.title()} (Apprenticeship)",
        annual_income=income,
        income_start_age=18,  # Earn from day 1
        starting_salary=journeyman,
        salary_growth_rate=growth,
        effective_tax_rate=EFFECTIVE_TAX_RATE,
    )


def _build_workforce_career(
    answers: WorkforceAnswers,
    salary_multiplier: float,
    projection_years: int,
) -> CareerProfile:
    industry = answers.industry.value

    if answers.known_starting_wage is not None:
        base_salary = answers.known_starting_wage
    else:
        base_salary = ENTRY_WAGES[industry] * salary_multiplier

    growth = SALARY_GROWTH["workforce"]

    income = [base_salary * (1 + growth) ** year for year in range(projection_years)]

    return CareerProfile(
        label=f"Direct Workforce ({industry.replace('_', ' ').title()})",
        annual_income=income,
        income_start_age=18,
        starting_salary=base_salary,
        salary_growth_rate=growth,
        effective_tax_rate=EFFECTIVE_TAX_RATE,
    )


def _build_military_career(
    answers: MilitaryAnswers,
    salary_multiplier: float,
    projection_years: int,
) -> CareerProfile:
    service_years = answers.enlistment_years
    income: list[float] = []
    tax_exempt_years: list[int] = []

    # Phase 1: Active duty (income is partially tax-exempt but we simplify)
    for year in range(min(service_years, projection_years)):
        if year < len(ENLISTED_ANNUAL_COMP):
            income.append(ENLISTED_ANNUAL_COMP[year])
        else:
            income.append(ENLISTED_ANNUAL_COMP[-1])

    if answers.use_gi_bill:
        # Phase 2: GI Bill school (4 years, housing allowance is tax-exempt)
        gi_bill_annual = GI_BILL["monthly_housing"] * 12  # ~$28k/yr
        gi_bill_school_years = GI_BILL["months_of_benefits"] // 9  # 36mo / 9mo per academic year = 4

        for year_offset in range(gi_bill_school_years):
            year_idx = service_years + year_offset
            if year_idx < projection_years:
                income.append(gi_bill_annual)
                tax_exempt_years.append(year_idx)  # Nit #3: real list

        # Phase 3: Post-degree career
        major = answers.gi_bill_major.value
        post_salary = STARTING_SALARY[major] * salary_multiplier
        growth = SALARY_GROWTH[major]
        career_start_year = service_years + gi_bill_school_years

        for year in range(career_start_year, projection_years):
            years_working = year - career_start_year
            income.append(post_salary * (1 + growth) ** years_working)

        label = f"Military + GI Bill ({major.replace('_', ' ').title()})"
        income_start_age = 18 + career_start_year
        starting_salary = post_salary
        growth_rate = growth

    else:
        # Phase 2: Direct civilian career (veteran premium)
        base_industry_wage = ENTRY_WAGES[answers.civilian_industry.value] * salary_multiplier
        post_salary = base_industry_wage * (1 + VETERAN_HIRING_PREMIUM)
        growth = SALARY_GROWTH["military_civilian"]

        for year in range(service_years, projection_years):
            years_working = year - service_years
            income.append(post_salary * (1 + growth) ** years_working)

        label = "Military → Civilian Workforce"
        income_start_age = 18 + service_years
        starting_salary = post_salary
        growth_rate = growth

    # Pad if needed (shouldn't be, but safety)
    while len(income) < projection_years:
        income.append(income[-1] if income else 0.0)

    return CareerProfile(
        label=label,
        annual_income=income[:projection_years],
        income_start_age=income_start_age,
        starting_salary=starting_salary,
        salary_growth_rate=growth_rate,
        effective_tax_rate=EFFECTIVE_TAX_RATE,
        tax_exempt_years=tax_exempt_years,
    )
