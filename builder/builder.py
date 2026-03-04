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
    )

    # --- Compose ---
    region_label = quiz.region.value.replace("_", " ").title()
    name = f"{education.label} — {region_label}"

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
