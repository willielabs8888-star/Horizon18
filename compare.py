"""
Multi-scenario comparison orchestrator.

Takes quiz answers, builds all scenarios, runs projections,
and returns results ready for output rendering.
"""

from __future__ import annotations

from model.data_models import QuizAnswers, SimResult
from builder.builder import build_all_scenarios, DEFAULT_PROJECTION_YEARS
from model.projection import run_projection


def run_comparison(
    quiz: QuizAnswers,
    projection_years: int = DEFAULT_PROJECTION_YEARS,
) -> list[SimResult]:
    """Run the full pipeline: quiz → scenarios → projections → results."""
    scenarios = build_all_scenarios(quiz, projection_years=projection_years)
    return [run_projection(scenario) for scenario in scenarios]
