"""
Scenario Builder.

Maps quiz answers → engine config triplets → Scenario objects.
This is the glue between the quiz layer and the simulation engine.
"""

from __future__ import annotations

from model.data_models import (
    PathType, QuizAnswers, Scenario,
)
from engines.education import build_education_profile
from engines.career import build_career_profile
from engines.living import build_living_profile
from defaults import SAVINGS_RATE, INVESTMENT_RETURN
from defaults.regions import get_metro_label

DEFAULT_PROJECTION_YEARS = 32


def build_scenario(
    quiz: QuizAnswers,
    path_type: PathType,
    projection_years: int = DEFAULT_PROJECTION_YEARS,
) -> Scenario:
    """Build a complete Scenario for one selected path from quiz answers."""

    # Metro area code for per-metro multiplier lookups
    metro_area = quiz.metro_area or "national_avg"

    # --- Education Engine ---
    education = build_education_profile(
        path_type=path_type,
        region=quiz.region,
        living_at_home=quiz.living_at_home,
        family_savings=quiz.family_savings,
        college=quiz.college,
        community_college=quiz.community_college,
        trade=quiz.trade,
        workforce=quiz.workforce,
        military=quiz.military,
    )

    # --- Career Engine ---
    career = build_career_profile(
        path_type=path_type,
        region=quiz.region,
        metro_area=metro_area,
        projection_years=projection_years,
        college=quiz.college,
        community_college=quiz.community_college,
        trade=quiz.trade,
        workforce=quiz.workforce,
        military=quiz.military,
    )

    # --- Living Engine ---
    military_answers = quiz.military
    living = build_living_profile(
        path_type=path_type,
        region=quiz.region,
        metro_area=metro_area,
        living_at_home=quiz.living_at_home,
        years_at_home=quiz.years_at_home,
        projection_years=projection_years,
        military_service_years=(
            military_answers.enlistment_years
            if military_answers and path_type == PathType.MILITARY
            else 0
        ),
        military_use_gi_bill=(
            military_answers.use_gi_bill
            if military_answers and path_type == PathType.MILITARY
            else False
        ),
        years_in_school=education.years_in_school,
    )

    # --- Compose ---
    # Use metro city name instead of generic region (e.g. "Pittsburgh, PA" not "Northeast")
    location_label = get_metro_label(metro_area) if metro_area != "national_avg" else quiz.region.value.replace("_", " ").title()

    # Enrich name for workforce and military paths with sector/major details
    ed_label = education.label
    if path_type == PathType.WORKFORCE and quiz.workforce:
        industry = quiz.workforce.industry.value.replace("_", " ").title()
        ed_label = f"Direct Workforce – {industry}"
    elif path_type == PathType.MILITARY and quiz.military:
        if quiz.military.use_gi_bill and quiz.military.gi_bill_major:
            major_name = quiz.military.gi_bill_major.value.replace("_", " ").title()
            ed_label = f"Military Enlistment → GI Bill – {major_name}"
        elif not quiz.military.use_gi_bill and quiz.military.civilian_industry:
            civ = quiz.military.civilian_industry.value.replace("_", " ").title()
            ed_label = f"Military → Civilian – {civ}"

    name = f"{ed_label} — {location_label}"

    return Scenario(
        name=name,
        path_type=path_type,
        education=education,
        career=career,
        living=living,
        savings_rate=SAVINGS_RATE,
        investment_return_rate=INVESTMENT_RETURN,
        projection_years=projection_years,
    )


def build_all_scenarios(
    quiz: QuizAnswers,
    projection_years: int = DEFAULT_PROJECTION_YEARS,
) -> list[Scenario]:
    """Build one Scenario per selected path."""
    return [build_scenario(quiz, path, projection_years) for path in quiz.selected_paths]
