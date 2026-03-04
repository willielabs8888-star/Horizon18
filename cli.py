#!/usr/bin/env python3
"""
CLI entrypoint for Horizon18.

Two modes:
  python cli.py demo          — Run a preset 5-path comparison (quick demo)
  python cli.py quiz          — Interactive guided quiz

Usage:
  python cli.py demo --years 40 --output outputs/runs/demo
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from model.data_models import (
    PathType, SchoolType, Major, TradeType, WorkforceIndustry, Region,
    QuizAnswers, CollegeAnswers, CommunityCollegeAnswers,
    TradeAnswers, WorkforceAnswers, MilitaryAnswers,
)
from compare import run_comparison
from builder.builder import DEFAULT_PROJECTION_YEARS
from outputs.charts import render_all_charts
from outputs.tables import render_comparison_table, render_csv, render_year_by_year_csv
from outputs.narrative import render_narrative


def build_demo_quiz() -> QuizAnswers:
    """Build the default demo: all 5 paths, Midwest, living at home 2 years."""
    return QuizAnswers(
        selected_paths=[
            PathType.COLLEGE,
            PathType.CC_TRANSFER,
            PathType.TRADE,
            PathType.MILITARY,
            PathType.WORKFORCE,
        ],
        region=Region.MIDWEST,
        living_at_home=True,
        years_at_home=2,
        family_savings=0,
        college=CollegeAnswers(
            school_type=SchoolType.PUBLIC_IN_STATE,
            major=Major.STEM,
            part_time_work=True,
        ),
        community_college=CommunityCollegeAnswers(
            transfer_university_type=SchoolType.PUBLIC_IN_STATE,
            major=Major.BUSINESS,
            part_time_work=True,
        ),
        trade=TradeAnswers(
            trade_type=TradeType.ELECTRICIAN,
        ),
        workforce=WorkforceAnswers(
            industry=WorkforceIndustry.ADMIN,
        ),
        military=MilitaryAnswers(
            enlistment_years=4,
            use_gi_bill=True,
            gi_bill_major=Major.STEM,
        ),
    )


def build_interactive_quiz() -> QuizAnswers:
    """Simple interactive CLI quiz using basic input() prompts."""

    print("\n" + "=" * 60)
    print("  HORIZON18")
    print("  See your financial future before you choose your path.")
    print("=" * 60)

    # Step 1: Path selection
    print("\n  Which paths are you deciding between?")
    print("  (Enter numbers separated by commas)")
    print("    1. 4-Year College")
    print("    2. Community College + Transfer")
    print("    3. Trade / Apprenticeship")
    print("    4. Direct Workforce")
    print("    5. Military (Enlistment)")

    path_map = {
        "1": PathType.COLLEGE,
        "2": PathType.CC_TRANSFER,
        "3": PathType.TRADE,
        "4": PathType.WORKFORCE,
        "5": PathType.MILITARY,
    }

    while True:
        raw = input("\n  Your choices (e.g., 1,3,5): ").strip()
        choices = [c.strip() for c in raw.split(",")]
        selected = [path_map[c] for c in choices if c in path_map]
        if len(selected) >= 2:
            break
        print("  Please select at least 2 paths to compare.")

    # Step 2: Region
    print("\n  What part of the country are you in?")
    print("    1. Northeast (NY, MA, CT, NJ)")
    print("    2. Southeast (FL, GA, TN, NC)")
    print("    3. Midwest (OH, IL, MI, IN)")
    print("    4. Southwest (TX, AZ, NM)")
    print("    5. West Coast (CA, WA, OR)")

    region_map = {
        "1": Region.NORTHEAST, "2": Region.SOUTHEAST,
        "3": Region.MIDWEST, "4": Region.SOUTHWEST, "5": Region.WEST_COAST,
    }
    r = input("  Region (1-5, default=3): ").strip() or "3"
    region = region_map.get(r, Region.MIDWEST)

    # Step 3: Living situation
    home_input = input("\n  Will you live at home after high school? (y/n, default=y): ").strip().lower()
    living_at_home = home_input != "n"

    years_at_home = 2
    if living_at_home:
        y = input("  For how many years? (1/2/3, default=2): ").strip() or "2"
        years_at_home = int(y) if y in ("1", "2", "3") else 2

    # Step 4: Family savings
    print("\n  Does your family have savings for education?")
    print("    0. None / not sure")
    print("    1. Under $5,000")
    print("    2. $5,000 - $15,000")
    print("    3. $15,000 - $30,000")
    print("    4. $30,000+")
    savings_map = {"0": 0, "1": 2500, "2": 10000, "3": 22500, "4": 35000}
    s = input("  Savings (0-4, default=0): ").strip() or "0"
    family_savings = savings_map.get(s, 0)

    # Path-specific questions
    college = None
    cc = None
    trade = None
    workforce = None
    military = None

    if PathType.COLLEGE in selected:
        print("\n  --- 4-YEAR COLLEGE ---")
        print("  School type: 1=Public in-state  2=Public out-of-state  3=Private")
        st = input("  (1-3, default=1): ").strip() or "1"
        school_types = {"1": SchoolType.PUBLIC_IN_STATE, "2": SchoolType.PUBLIC_OUT_OF_STATE, "3": SchoolType.PRIVATE}

        print("  Major: 1=STEM  2=Business  3=Healthcare  4=Liberal Arts  5=Education  6=Undecided")
        m = input("  (1-6, default=6): ").strip() or "6"
        majors = {"1": Major.STEM, "2": Major.BUSINESS, "3": Major.HEALTHCARE,
                  "4": Major.LIBERAL_ARTS, "5": Major.EDUCATION, "6": Major.UNDECIDED}

        college = CollegeAnswers(
            school_type=school_types.get(st, SchoolType.PUBLIC_IN_STATE),
            major=majors.get(m, Major.UNDECIDED),
        )

    if PathType.CC_TRANSFER in selected:
        print("\n  --- COMMUNITY COLLEGE + TRANSFER ---")
        print("  Transfer to: 1=Public in-state  2=Public out-of-state  3=Private")
        st = input("  (1-3, default=1): ").strip() or "1"
        school_types = {"1": SchoolType.PUBLIC_IN_STATE, "2": SchoolType.PUBLIC_OUT_OF_STATE, "3": SchoolType.PRIVATE}

        print("  Major: 1=STEM  2=Business  3=Healthcare  4=Liberal Arts  5=Education  6=Undecided")
        m = input("  (1-6, default=6): ").strip() or "6"
        majors = {"1": Major.STEM, "2": Major.BUSINESS, "3": Major.HEALTHCARE,
                  "4": Major.LIBERAL_ARTS, "5": Major.EDUCATION, "6": Major.UNDECIDED}

        cc = CommunityCollegeAnswers(
            transfer_university_type=school_types.get(st, SchoolType.PUBLIC_IN_STATE),
            major=majors.get(m, Major.UNDECIDED),
        )

    if PathType.TRADE in selected:
        print("\n  --- TRADE / APPRENTICESHIP ---")
        print("  Which trade? 1=Electrician  2=Plumber  3=HVAC  4=Carpenter")
        t = input("  (1-4, default=1): ").strip() or "1"
        trades = {"1": TradeType.ELECTRICIAN, "2": TradeType.PLUMBER,
                  "3": TradeType.HVAC, "4": TradeType.CARPENTER}

        trade = TradeAnswers(trade_type=trades.get(t, TradeType.ELECTRICIAN))

    if PathType.WORKFORCE in selected:
        print("\n  --- DIRECT WORKFORCE ---")
        print("  Industry? 1=Retail  2=Logistics  3=Food Service  4=Admin/Office  5=Manufacturing")
        w = input("  (1-5, default=1): ").strip() or "1"
        industries = {"1": WorkforceIndustry.RETAIL, "2": WorkforceIndustry.LOGISTICS,
                      "3": WorkforceIndustry.FOOD_SERVICE, "4": WorkforceIndustry.ADMIN,
                      "5": WorkforceIndustry.MANUFACTURING}

        workforce = WorkforceAnswers(industry=industries.get(w, WorkforceIndustry.RETAIL))

    if PathType.MILITARY in selected:
        print("\n  --- MILITARY ---")
        gi = input("  Use GI Bill for college after service? (y/n, default=y): ").strip().lower()
        use_gi = gi != "n"

        gi_major = Major.UNDECIDED
        if use_gi:
            print("  What would you study? 1=STEM  2=Business  3=Healthcare  4=Liberal Arts  5=Education  6=Undecided")
            m = input("  (1-6, default=6): ").strip() or "6"
            majors = {"1": Major.STEM, "2": Major.BUSINESS, "3": Major.HEALTHCARE,
                      "4": Major.LIBERAL_ARTS, "5": Major.EDUCATION, "6": Major.UNDECIDED}
            gi_major = majors.get(m, Major.UNDECIDED)

        military = MilitaryAnswers(use_gi_bill=use_gi, gi_bill_major=gi_major)

    return QuizAnswers(
        selected_paths=selected,
        region=region,
        living_at_home=living_at_home,
        years_at_home=years_at_home,
        family_savings=family_savings,
        college=college,
        community_college=cc,
        trade=trade,
        workforce=workforce,
        military=military,
    )


def run_and_output(quiz: QuizAnswers, output_dir: str, projection_years: int):
    """Run comparison and generate all outputs."""

    print(f"\n  Running {projection_years}-year projections for {len(quiz.selected_paths)} paths...")

    results = run_comparison(quiz, projection_years=projection_years)

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Render charts
    print("  Generating charts...")
    chart_paths = render_all_charts(results, output_dir)
    for p in chart_paths:
        print(f"    ✓ {p}")

    # Render tables
    table_text = render_comparison_table(results)
    print(table_text)

    # Render narrative
    narrative = render_narrative(results)
    print(narrative)

    # Save CSV exports
    csv_path = render_csv(results, output_dir)
    print(f"  ✓ Summary CSV: {csv_path}")

    proj_path = render_year_by_year_csv(results, output_dir)
    print(f"  ✓ Year-by-year CSV: {proj_path}")

    # Save narrative to file
    narrative_path = os.path.join(output_dir, "summary.txt")
    with open(narrative_path, "w", encoding="utf-8") as f:
        f.write(table_text)
        f.write("\n")
        f.write(narrative)
    print(f"  ✓ Summary text: {narrative_path}")

    print(f"\n  All outputs saved to: {output_dir}")
    print("  Done!\n")


def main():
    parser = argparse.ArgumentParser(
        description="Horizon18 — Life-Path Financial Comparison Tool"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Shared argument for --years
    year_help = f"Projection horizon in years (default: {DEFAULT_PROJECTION_YEARS}, min: 10, max: 50)"

    # Demo mode
    demo_parser = subparsers.add_parser("demo", help="Run preset 5-path comparison")
    demo_parser.add_argument("--output", "-o", default=None,
                             help="Output directory (default: outputs/runs/<timestamp>)")
    demo_parser.add_argument("--years", "-y", type=int, default=DEFAULT_PROJECTION_YEARS,
                             help=year_help)

    # Quiz mode
    quiz_parser = subparsers.add_parser("quiz", help="Interactive guided quiz")
    quiz_parser.add_argument("--output", "-o", default=None,
                             help="Output directory")
    quiz_parser.add_argument("--years", "-y", type=int, default=DEFAULT_PROJECTION_YEARS,
                             help=year_help)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    # Validate years
    years = max(10, min(50, args.years))
    if years != args.years:
        print(f"  Note: clamped --years to {years} (valid range: 10-50)")

    # Default output dir
    if args.output is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = os.path.join("outputs", "runs", timestamp)

    if args.command == "demo":
        quiz = build_demo_quiz()
        run_and_output(quiz, args.output, projection_years=years)

    elif args.command == "quiz":
        quiz = build_interactive_quiz()
        run_and_output(quiz, args.output, projection_years=years)


if __name__ == "__main__":
    main()
