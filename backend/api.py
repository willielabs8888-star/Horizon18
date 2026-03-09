"""
API logic for the simulation endpoint.

Converts raw JSON dicts → engine dataclasses → runs simulation →
converts engine dataclasses → JSON-serializable dicts.

Supports two request formats:
  1. Legacy (single-instance): selected_paths + singular path objects
  2. Multi-instance: path_instances array with per-instance configs

No external dependencies — just stdlib + the simulation engine.
"""

from __future__ import annotations

import sys
import os

# Add parent directory to path so we can import the simulation engine
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from model.data_models import (
    QuizAnswers,
    CollegeAnswers,
    CommunityCollegeAnswers,
    TradeAnswers,
    WorkforceAnswers,
    MilitaryAnswers,
    PathType,
    SchoolType,
    Major,
    TradeType,
    WorkforceIndustry,
    Region,
    SimResult,
    YearSnapshot,
)
from compare import run_comparison
from builder.builder import build_scenario
from defaults.regions import get_region_for_metro


# =============================================================================
# INSTANCE ANSWER BUILDERS
# =============================================================================
# Each function takes an instance config dict and returns the appropriate
# answer dataclass. Used by both legacy and multi-instance paths.

def _build_college_answers(c: dict) -> CollegeAnswers:
    return CollegeAnswers(
        school_type=SchoolType(c.get("school_type", "public_in_state")),
        ipeds_id=c.get("ipeds_id"),
        tuition_override=_safe_non_negative_float(c.get("tuition_override")),
        room_board_override=_safe_non_negative_float(c.get("room_board_override")),
        loan_term_years=_clamp_loan_term(c.get("loan_term_years", 10)),
        major=Major(c.get("major", "undecided")),
        part_time_work=c.get("part_time_work", True),
        part_time_income=max(0.0, min(25000.0, float(c.get("part_time_income", 8000)))),
    )

def _build_cc_answers(cc: dict) -> CommunityCollegeAnswers:
    return CommunityCollegeAnswers(
        transfer_university_type=SchoolType(cc.get("transfer_university_type", "public_in_state")),
        ipeds_id_cc=cc.get("ipeds_id_cc"),
        ipeds_id_transfer=cc.get("ipeds_id_transfer"),
        tuition_override_cc=_safe_non_negative_float(cc.get("tuition_override_cc")),
        tuition_override_transfer=_safe_non_negative_float(cc.get("tuition_override_transfer")),
        room_board_override=_safe_non_negative_float(cc.get("room_board_override")),
        loan_term_years=_clamp_loan_term(cc.get("loan_term_years", 10)),
        major=Major(cc.get("major", "undecided")),
        part_time_work=cc.get("part_time_work", True),
        part_time_income=max(0.0, min(25000.0, float(cc.get("part_time_income", 10000)))),
    )

def _safe_float(val) -> float | None:
    """Convert to float, return None if missing/null."""
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

def _safe_non_negative_float(val) -> float | None:
    """Convert to float, return None if missing/null, clamp to >= 0."""
    f = _safe_float(val)
    if f is not None and f < 0:
        return 0.0
    return f

def _clamp_loan_term(val, default=15) -> int:
    """Clamp loan term to 5-30 years."""
    try:
        v = int(val)
        return max(5, min(30, v))
    except (ValueError, TypeError):
        return default

def _build_trade_answers(t: dict) -> TradeAnswers:
    return TradeAnswers(
        trade_type=TradeType(t.get("trade_type", "electrician")),
        loan_term_years=_clamp_loan_term(t.get("loan_term_years", 5)),
    )

def _build_workforce_answers(w: dict) -> WorkforceAnswers:
    return WorkforceAnswers(
        industry=WorkforceIndustry(w.get("industry", "retail")),
        known_starting_wage=(
            float(w["known_starting_wage"])
            if w.get("known_starting_wage") is not None
            else None
        ),
    )

def _build_military_answers(m: dict) -> MilitaryAnswers:
    enlistment = max(2, min(8, int(m.get("enlistment_years", 4))))
    return MilitaryAnswers(
        enlistment_years=enlistment,
        use_gi_bill=m.get("use_gi_bill", True),
        gi_bill_major=Major(m.get("gi_bill_major", "undecided")),
    )


# Map path types to their answer builder + config key name
_ANSWER_BUILDERS = {
    PathType.COLLEGE: ("college", _build_college_answers),
    PathType.CC_TRANSFER: ("community_college", _build_cc_answers),
    PathType.TRADE: ("trade", _build_trade_answers),
    PathType.WORKFORCE: ("workforce", _build_workforce_answers),
    PathType.MILITARY: ("military", _build_military_answers),
}

# Map path types to the QuizAnswers field name they populate
_QUIZ_FIELD_MAP = {
    PathType.COLLEGE: "college",
    PathType.CC_TRANSFER: "community_college",
    PathType.TRADE: "trade",
    PathType.WORKFORCE: "workforce",
    PathType.MILITARY: "military",
}


# =============================================================================
# MULTI-INSTANCE SIMULATION
# =============================================================================

def _validate_financial_overrides(body: dict) -> dict | None:
    """Validate optional financial parameter overrides.

    Returns None if valid, or an error response dict if invalid.
    """
    savings_rate = body.get("savings_rate")
    investment_return_rate = body.get("investment_return_rate")
    tax_rate = body.get("tax_rate")

    if savings_rate is not None:
        sr = float(savings_rate)
        if sr < 0.0 or sr > 0.50:
            return {"status": 422, "body": {"error": "savings_rate must be between 0 and 0.50."}}

    if investment_return_rate is not None:
        ir = float(investment_return_rate)
        if ir < 0.0 or ir > 0.20:
            return {"status": 422, "body": {"error": "investment_return_rate must be between 0 and 0.20."}}

    if tax_rate is not None:
        tr = float(tax_rate)
        if tr < 0.10 or tr > 0.40:
            return {"status": 422, "body": {"error": "tax_rate must be between 0.10 and 0.40."}}

    return None


def _apply_financial_overrides(scenario, body: dict) -> None:
    """Apply optional financial parameter overrides to a built scenario.

    Mutates scenario in-place. These override the defaults from the builder
    without touching the builder or engine code.
    """
    savings_rate = body.get("savings_rate")
    investment_return_rate = body.get("investment_return_rate")
    tax_rate = body.get("tax_rate")

    if savings_rate is not None:
        scenario.savings_rate = float(savings_rate)
    if investment_return_rate is not None:
        scenario.investment_return_rate = float(investment_return_rate)
    if tax_rate is not None:
        scenario.career.effective_tax_rate = float(tax_rate)

    start_age = body.get("start_age")
    if start_age is not None:
        sa = int(start_age)
        if not (15 <= sa <= 40):
            pass  # silently ignore out-of-range; keep default
        else:
            offset = sa - scenario.start_age
            scenario.start_age = sa
            scenario.career.income_start_age += offset


def _handle_multi_instance(body: dict, region: Region, projection_years: int) -> dict:
    """Handle the multi-instance request format.

    Each path_instance contains its own config. We build a separate QuizAnswers
    per instance (with shared fields + that instance's path answers) and call
    build_scenario() for each. This avoids any changes to the builder or engines.
    """
    instances = body["path_instances"]

    # Validate count
    if len(instances) == 0:
        return {"status": 422, "body": {"error": "path_instances must be non-empty."}}
    if len(instances) > 10:
        return {"status": 422, "body": {"error": "Maximum 10 path instances can be compared."}}

    # Validate financial overrides (if provided)
    override_err = _validate_financial_overrides(body)
    if override_err:
        return override_err

    # Shared quiz fields
    shared = {
        "metro_area": body.get("metro_area", "national_avg"),
        "region": region,
        "living_at_home": body.get("living_at_home", False),
        "years_at_home": body.get("years_at_home", 2),
        "family_savings": max(0.0, float(body.get("family_savings", 0))),
    }

    results = []
    seen_ids = set()

    try:
        for inst in instances:
            # Validate instance structure
            instance_id = inst.get("instance_id", "")
            path_type_str = inst.get("path_type", "")

            if not instance_id or not path_type_str:
                return {"status": 422, "body": {
                    "error": "Each path_instance must have instance_id and path_type."
                }}

            if instance_id in seen_ids:
                return {"status": 422, "body": {
                    "error": f"Duplicate instance_id: {instance_id}"
                }}
            seen_ids.add(instance_id)

            try:
                path_type = PathType(path_type_str)
            except ValueError:
                return {"status": 422, "body": {
                    "error": f"Invalid path_type in instance {instance_id}: {path_type_str}",
                    "valid_paths": [p.value for p in PathType],
                }}

            # Build a QuizAnswers with shared fields + this instance's answers
            quiz = QuizAnswers(
                selected_paths=[path_type],
                **shared,
            )

            # Get the answer builder for this path type and build answers from instance config
            field_name, builder_fn = _ANSWER_BUILDERS[path_type]
            config = inst.get(field_name, inst)  # Use nested config if present, else top-level (frontend sends flat)
            answers = builder_fn(config)
            setattr(quiz, _QUIZ_FIELD_MAP[path_type], answers)

            # Build scenario and stamp instance_id
            scenario = build_scenario(quiz, path_type, projection_years)
            scenario.instance_id = instance_id

            # Apply optional financial overrides (savings_rate, investment_return, tax_rate)
            _apply_financial_overrides(scenario, body)

            # Run projection
            from model.projection import run_projection
            result = run_projection(scenario)
            results.append(result)

    except (ValueError, KeyError, TypeError) as e:
        return {"status": 422, "body": {"error": f"Invalid instance data: {e}"}}
    except Exception as e:
        return {"status": 500, "body": {"error": f"Simulation error: {e}"}}

    return {
        "status": 200,
        "body": {
            "results": [_serialize_result(r) for r in results],
            "projection_years": projection_years,
            "paths_compared": len(results),
        },
    }


# =============================================================================
# MAIN HANDLER (supports both legacy and multi-instance formats)
# =============================================================================

def handle_simulate(body: dict) -> dict:
    """Handle POST /api/simulate.

    Supports two formats:
      1. Legacy: { selected_paths: [...], college: {...}, trade: {...}, ... }
      2. Multi-instance: { path_instances: [...], region: ..., ... }

    Returns:
        {"status": int, "body": dict} — HTTP status code and response body.
    """

    # --- Parse shared fields first ---
    # Metro area → region resolution (backward compatible: accepts either)
    metro_area = body.get("metro_area")
    try:
        if metro_area:
            region = Region(get_region_for_metro(metro_area))
        else:
            region = Region(body.get("region", "midwest"))
    except ValueError:
        return {"status": 422, "body": {
            "error": f"Invalid region: {body.get('region')}",
            "valid_regions": [r.value for r in Region],
        }}

    projection_years = body.get("projection_years", 32)
    projection_years = max(10, min(50, int(projection_years)))

    # --- Detect format and dispatch ---
    if "path_instances" in body and isinstance(body["path_instances"], list):
        return _handle_multi_instance(body, region, projection_years)

    # --- Legacy format: selected_paths + singular path objects ---
    selected_paths_raw = body.get("selected_paths")
    if not selected_paths_raw or not isinstance(selected_paths_raw, list):
        return {"status": 422, "body": {
            "error": "selected_paths is required and must be a non-empty list.",
            "valid_paths": [p.value for p in PathType],
        }}

    if len(selected_paths_raw) > 10:
        return {"status": 422, "body": {"error": "Maximum 10 paths can be compared."}}

    try:
        selected_paths = [PathType(p) for p in selected_paths_raw]
    except ValueError as e:
        return {"status": 422, "body": {
            "error": f"Invalid path type: {e}",
            "valid_paths": [p.value for p in PathType],
        }}

    # --- Build QuizAnswers (legacy) ---
    try:
        quiz = QuizAnswers(
            selected_paths=selected_paths,
            metro_area=body.get("metro_area", "national_avg"),
            region=region,
            living_at_home=body.get("living_at_home", False),
            years_at_home=body.get("years_at_home", 2),
            family_savings=max(0.0, float(body.get("family_savings", 0))),
        )

        # Path-specific answers (legacy singular format)
        for path_type in selected_paths:
            field_name, builder_fn = _ANSWER_BUILDERS[path_type]
            config = body.get(field_name, {})
            answers = builder_fn(config)
            setattr(quiz, _QUIZ_FIELD_MAP[path_type], answers)

    except (ValueError, KeyError, TypeError) as e:
        return {"status": 422, "body": {"error": f"Invalid quiz data: {e}"}}

    # Validate financial overrides (if provided)
    override_err = _validate_financial_overrides(body)
    if override_err:
        return override_err

    has_overrides = any(body.get(k) is not None for k in ("savings_rate", "investment_return_rate", "tax_rate"))

    # --- Run simulation ---
    try:
        if has_overrides:
            # Build scenarios manually so we can apply overrides before projection
            from model.projection import run_projection
            results = []
            for path_type in selected_paths:
                scenario = build_scenario(quiz, path_type, projection_years)
                _apply_financial_overrides(scenario, body)
                results.append(run_projection(scenario))
        else:
            results = run_comparison(quiz, projection_years=projection_years)
    except Exception as e:
        return {"status": 500, "body": {"error": f"Simulation error: {e}"}}

    # --- Build response ---
    return {
        "status": 200,
        "body": {
            "results": [_serialize_result(r) for r in results],
            "projection_years": projection_years,
            "paths_compared": len(results),
        },
    }


# =============================================================================
# SERIALIZATION
# =============================================================================

def _serialize_result(result: SimResult) -> dict:
    """Convert a SimResult dataclass to a JSON-serializable dict."""

    return {
        "scenario": {
            "name": result.scenario.name,
            "path_type": result.scenario.path_type.value,
            "instance_id": result.scenario.instance_id,
            "savings_rate": result.scenario.savings_rate,
            "investment_return_rate": result.scenario.investment_return_rate,
            "start_age": result.scenario.start_age,
            "projection_years": result.scenario.projection_years,
            "loan_term_years": result.scenario.education.loan_term_years,
        },
        "snapshots": [_serialize_snapshot(s) for s in result.snapshots],
        "summary": {
            "total_earnings": result.total_earnings,
            "total_loan_interest_paid": result.total_loan_interest_paid,
            "total_cost_of_education": result.total_cost_of_education,
            "year_debt_free": result.year_debt_free,
            "year_positive_net_worth": result.year_positive_net_worth,
            "net_worth_milestones": {
                str(k): v for k, v in result.net_worth_milestones.items()
            },
            "net_worth_at_25": result.net_worth_at_25,
            "net_worth_at_30": result.net_worth_at_30,
            "net_worth_at_38": result.net_worth_at_38,
            "net_worth_at_50": result.net_worth_at_50,
            "debt_burden_ratio": result.debt_burden_ratio,
            "loan_extended": result.loan_extended,
            "loan_term_original": result.loan_term_original,
            "loan_term_actual": result.loan_term_actual,
        },
    }


def _serialize_snapshot(s: YearSnapshot) -> dict:
    """Convert a YearSnapshot dataclass to a JSON-serializable dict."""

    return {
        "year": s.year,
        "age": s.age,
        "gross_income": s.gross_income,
        "net_income": s.net_income,
        "living_expenses": s.living_expenses,
        "loan_payment": s.loan_payment,
        "debt_remaining": s.debt_remaining,
        "annual_savings": s.annual_savings,
        "investment_balance": s.investment_balance,
        "net_worth": s.net_worth,
        "cumulative_earnings": s.cumulative_earnings,
        "cumulative_taxes": s.cumulative_taxes,
        "savings_rate_actual": s.savings_rate_actual,
        "consumer_debt": s.consumer_debt,
    }
