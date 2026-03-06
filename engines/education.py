"""
Education Cost Engine.

Takes quiz answers and defaults, produces an EducationProfile with
year-by-year cost arrays and loan structure.
"""

from __future__ import annotations

from model.data_models import (
    PathType, SchoolType, Major, TradeType, Region,
    EducationProfile,
    CollegeAnswers, CommunityCollegeAnswers, TradeAnswers,
    WorkforceAnswers, MilitaryAnswers,
)
from defaults import (
    TUITION_ANNUAL, ROOM_AND_BOARD_ANNUAL, TRADE_SCHOOL_TOTAL,
    LOAN_INTEREST_RATE, LOAN_TERM_YEARS, GRACE_PERIOD_MONTHS,
    GI_BILL,
    get_school,
)


def build_education_profile(
    path_type: PathType,
    region: Region,
    living_at_home: bool,
    family_savings: float,
    college: CollegeAnswers | None = None,
    community_college: CommunityCollegeAnswers | None = None,
    trade: TradeAnswers | None = None,
    workforce: WorkforceAnswers | None = None,
    military: MilitaryAnswers | None = None,
) -> EducationProfile:
    """Build an EducationProfile from quiz answers + defaults."""

    if path_type == PathType.COLLEGE:
        return _build_college(college or CollegeAnswers(), living_at_home, family_savings)

    elif path_type == PathType.CC_TRANSFER:
        return _build_cc_transfer(community_college or CommunityCollegeAnswers(), living_at_home, family_savings)

    elif path_type == PathType.TRADE:
        return _build_trade(trade or TradeAnswers(), family_savings)

    elif path_type == PathType.WORKFORCE:
        return _build_workforce(family_savings)

    elif path_type == PathType.MILITARY:
        return _build_military(military or MilitaryAnswers(), family_savings)

    else:
        raise ValueError(f"Unknown path type: {path_type}")


def _room_and_board(living_at_home: bool) -> float:
    return ROOM_AND_BOARD_ANNUAL["at_home"] if living_at_home else ROOM_AND_BOARD_ANNUAL["off_campus"]


def _build_college(
    answers: CollegeAnswers,
    living_at_home: bool,
    family_savings: float,
) -> EducationProfile:
    # Look up real school data if a specific school was selected
    school = get_school(answers.ipeds_id) if answers.ipeds_id else None

    if school:
        # Use real tuition from database
        # For public schools, use in-state vs out-of-state based on school_type
        if school["control"] == 1 and answers.school_type == SchoolType.PUBLIC_OUT_OF_STATE:
            tuition = school["tuition_out"]
        else:
            tuition = school["tuition_in"]
        rb = school.get("room_board") or _room_and_board(living_at_home)
        label = f"{school['name']} ({answers.major.value.replace('_', ' ').title()})"
    else:
        # Fall back to generic school type estimates
        tuition = TUITION_ANNUAL[answers.school_type.value]
        rb = _room_and_board(living_at_home)
        label = f"4-Year {answers.school_type.value.replace('_', ' ').title()} ({answers.major.value.replace('_', ' ').title()})"

    # Apply user overrides (e.g. scholarship adjustment)
    if answers.tuition_override is not None:
        tuition = answers.tuition_override
    if answers.room_board_override is not None:
        rb = answers.room_board_override
    elif living_at_home:
        # Auto-zero R&B when living at home and no explicit override set.
        # Living expenses are handled separately by the living engine.
        rb = 0.0

    years = 4
    annual_tuition = [tuition] * years
    annual_rb = [rb] * years
    total_cost = sum(annual_tuition) + sum(annual_rb)
    loan_amount = max(0.0, total_cost - family_savings)
    excess_savings = max(0.0, family_savings - total_cost)

    return EducationProfile(
        path_type=PathType.COLLEGE,
        label=label,
        years_in_school=years,
        earns_during_school=answers.part_time_work,
        annual_tuition=annual_tuition,
        annual_room_and_board=annual_rb,
        total_loan_amount=loan_amount,
        excess_family_savings=excess_savings,
        loan_interest_rate=LOAN_INTEREST_RATE,
        loan_term_years=answers.loan_term_years,
        grace_period_months=GRACE_PERIOD_MONTHS,
    )


def _build_cc_transfer(
    answers: CommunityCollegeAnswers,
    living_at_home: bool,
    family_savings: float,
) -> EducationProfile:
    # Look up specific CC if selected
    cc_school = get_school(answers.ipeds_id_cc) if answers.ipeds_id_cc else None
    cc_tuition = cc_school["tuition_in"] if cc_school else TUITION_ANNUAL["community_college"]
    cc_label = cc_school["name"] if cc_school else "Community College"

    # Look up specific transfer university if selected
    uni_school = get_school(answers.ipeds_id_transfer) if answers.ipeds_id_transfer else None
    if uni_school:
        if uni_school["control"] == 1 and answers.transfer_university_type == SchoolType.PUBLIC_OUT_OF_STATE:
            uni_tuition = uni_school["tuition_out"]
        else:
            uni_tuition = uni_school["tuition_in"]
        uni_label = uni_school["name"]
    else:
        uni_tuition = TUITION_ANNUAL[answers.transfer_university_type.value]
        uni_label = answers.transfer_university_type.value.replace('_', ' ').title()

    # Apply user overrides (e.g. scholarship adjustment)
    if answers.tuition_override_cc is not None:
        cc_tuition = answers.tuition_override_cc
    if answers.tuition_override_transfer is not None:
        uni_tuition = answers.tuition_override_transfer

    if answers.room_board_override is not None:
        rb = answers.room_board_override
    elif living_at_home:
        rb = 0.0
    else:
        rb = _room_and_board(living_at_home)
    years = 4

    annual_tuition = [cc_tuition, cc_tuition, uni_tuition, uni_tuition]
    annual_rb = [rb] * years
    total_cost = sum(annual_tuition) + sum(annual_rb)
    loan_amount = max(0.0, total_cost - family_savings)
    excess_savings = max(0.0, family_savings - total_cost)

    # Build label based on what's selected
    major_label = answers.major.value.replace('_', ' ').title()
    if cc_school or uni_school:
        label = f"{cc_label} → {uni_label} ({major_label})"
    else:
        label = f"CC + Transfer ({major_label})"

    return EducationProfile(
        path_type=PathType.CC_TRANSFER,
        label=label,
        years_in_school=years,
        earns_during_school=answers.part_time_work,
        annual_tuition=annual_tuition,
        annual_room_and_board=annual_rb,
        total_loan_amount=loan_amount,
        excess_family_savings=excess_savings,
        loan_interest_rate=LOAN_INTEREST_RATE,
        loan_term_years=answers.loan_term_years,
        grace_period_months=GRACE_PERIOD_MONTHS,
    )


def _build_trade(
    answers: TradeAnswers,
    family_savings: float,
) -> EducationProfile:
    total_cost = TRADE_SCHOOL_TOTAL[answers.trade_type.value]
    loan_amount = max(0.0, total_cost - family_savings)
    excess_savings = max(0.0, family_savings - total_cost)

    # Trade school cost spread across first year; apprenticeship is 4 years
    # of earning. years_in_school = apprenticeship duration.
    years = 4
    annual_tuition = [total_cost, 0.0, 0.0, 0.0]  # All cost in year 1
    annual_rb = [0.0] * years  # Apprentices live independently (handled by living engine)

    return EducationProfile(
        path_type=PathType.TRADE,
        label=f"{answers.trade_type.value.title()} Apprenticeship",
        years_in_school=years,
        earns_during_school=True,  # Apprentices earn from day 1
        annual_tuition=annual_tuition,
        annual_room_and_board=annual_rb,
        total_loan_amount=loan_amount,
        excess_family_savings=excess_savings,
        loan_interest_rate=LOAN_INTEREST_RATE,
        loan_term_years=answers.loan_term_years,  # Configurable (default 5 years for trades)
        grace_period_months=0,  # No grace — they're working
    )


def _build_workforce(family_savings: float = 0.0) -> EducationProfile:
    # No education costs — all family savings go directly to starting investment
    return EducationProfile(
        path_type=PathType.WORKFORCE,
        label="Direct Workforce",
        years_in_school=0,
        earns_during_school=True,
        total_loan_amount=0,
        excess_family_savings=family_savings,
        grace_period_months=0,
    )


def _build_military(answers: MilitaryAnswers, family_savings: float = 0.0) -> EducationProfile:
    gi_bill_tuition = 0.0
    gi_bill_housing = 0.0

    if answers.use_gi_bill:
        gi_bill_tuition = GI_BILL["annual_tuition_cap"]
        gi_bill_housing = GI_BILL["monthly_housing"]

    return EducationProfile(
        path_type=PathType.MILITARY,
        label="Military Enlistment" + (" + GI Bill" if answers.use_gi_bill else ""),
        years_in_school=answers.enlistment_years,  # Service years (see Nit #2)
        earns_during_school=True,  # Military earns during service
        annual_tuition=[0.0] * answers.enlistment_years,
        annual_room_and_board=[0.0] * answers.enlistment_years,
        total_loan_amount=0,
        excess_family_savings=family_savings,  # No education costs — all goes to investment
        loan_interest_rate=0,
        loan_term_years=0,
        grace_period_months=0,
        gi_bill_tuition_covered_annual=gi_bill_tuition,
        gi_bill_housing_monthly=gi_bill_housing,
    )
