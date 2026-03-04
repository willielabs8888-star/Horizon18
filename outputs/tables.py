"""
Summary table rendering for comparison output.

Generates:
- Terminal-formatted comparison table
- CSV export (summary + year-by-year with all data series)
"""

from __future__ import annotations

import csv
import os
from model.data_models import SimResult


def _fmt_dollars(val: float) -> str:
    if val >= 1_000_000:
        return f"${val:,.0f}"
    elif val >= 1_000:
        return f"${val:,.0f}"
    else:
        return f"${val:.0f}"


def _fmt_age(val: int | None) -> str:
    return f"Age {val}" if val is not None else "N/A"


def _fmt_pct(val: float) -> str:
    return f"{val * 100:.1f}%"


def render_comparison_table(results: list[SimResult]) -> str:
    """Generate a formatted comparison table for terminal output.

    Milestone ages are adaptive — only ages within the projection
    horizon are shown, plus the end-of-horizon age.
    """

    projection_years = results[0].scenario.projection_years

    # Build milestone rows dynamically from the adaptive dict
    milestone_ages = sorted(results[0].net_worth_milestones.keys())

    rows = [
        ("Path", [r.scenario.name for r in results]),
        ("Education Cost", [_fmt_dollars(r.total_cost_of_education) for r in results]),
        ("Loan Amount", [_fmt_dollars(r.scenario.education.total_loan_amount) for r in results]),
        ("Total Interest Paid", [_fmt_dollars(r.total_loan_interest_paid) for r in results]),
        ("Year Debt-Free", [_fmt_age(r.year_debt_free) for r in results]),
        ("Year Net Worth > $0", [_fmt_age(r.year_positive_net_worth) for r in results]),
    ]

    # Add net worth milestone rows
    for age in milestone_ages:
        rows.append((
            f"Net Worth at {age}",
            [_fmt_dollars(r.net_worth_milestones.get(age, 0.0)) for r in results],
        ))

    rows.append((
        f"{projection_years}-Year Earnings",
        [_fmt_dollars(r.total_earnings) for r in results],
    ))
    rows.append((
        "Peak Debt Burden",
        [_fmt_pct(r.debt_burden_ratio) for r in results],
    ))

    # Calculate column widths
    label_width = max(len(row[0]) for row in rows)
    data_widths = []
    for i in range(len(results)):
        w = max(len(row[1][i]) for row in rows)
        data_widths.append(max(w, 15))

    # Build output
    lines = []
    separator = "─" * (label_width + sum(data_widths) + 3 * len(results) + 3)
    lines.append("")
    lines.append("  SIDE-BY-SIDE COMPARISON")
    lines.append(separator)

    for label, values in rows:
        parts = [f"  {label:<{label_width}}"]
        for i, val in enumerate(values):
            parts.append(f"  {val:>{data_widths[i]}}")
        lines.append("".join(parts))

        if label == "Path":
            lines.append(separator)

    lines.append(separator)
    lines.append("")

    return "\n".join(lines)


def render_csv(results: list[SimResult], output_dir: str, filename: str = "summary.csv") -> str:
    """Export comparison data as CSV with adaptive milestones."""

    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, filename)
    projection_years = results[0].scenario.projection_years
    milestone_ages = sorted(results[0].net_worth_milestones.keys())

    with open(path, "w", newline="") as f:
        writer = csv.writer(f)

        # Header
        writer.writerow(["Metric"] + [r.scenario.name for r in results])

        # Data rows
        writer.writerow(["Education Cost"] + [f"{r.total_cost_of_education:.0f}" for r in results])
        writer.writerow(["Loan Amount"] + [f"{r.scenario.education.total_loan_amount:.0f}" for r in results])
        writer.writerow(["Total Interest Paid"] + [f"{r.total_loan_interest_paid:.0f}" for r in results])
        writer.writerow(["Year Debt-Free"] + [str(r.year_debt_free or "N/A") for r in results])
        writer.writerow(["Year Positive Net Worth"] + [str(r.year_positive_net_worth or "N/A") for r in results])

        for age in milestone_ages:
            writer.writerow(
                [f"Net Worth at {age}"]
                + [f"{r.net_worth_milestones.get(age, 0.0):.0f}" for r in results]
            )

        writer.writerow([f"{projection_years}-Year Earnings"] + [f"{r.total_earnings:.0f}" for r in results])
        writer.writerow(["Peak Debt Burden"] + [f"{r.debt_burden_ratio:.2%}" for r in results])

    return path


def render_year_by_year_csv(
    results: list[SimResult],
    output_dir: str,
    filename: str = "projections.csv",
) -> str:
    """Export year-by-year projection data for all paths.

    Includes all data series needed for web app hover tooltips:
    income, expenses, loan payment, debt, savings, investments,
    net worth, cumulative earnings, cumulative taxes, and savings rate.
    """

    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, filename)

    with open(path, "w", newline="") as f:
        writer = csv.writer(f)

        # Header
        header = ["Year", "Age"]
        for r in results:
            name = r.scenario.name
            header.extend([
                f"{name} - Income",
                f"{name} - Net Income",
                f"{name} - Expenses",
                f"{name} - Loan Payment",
                f"{name} - Debt",
                f"{name} - Savings",
                f"{name} - Investments",
                f"{name} - Net Worth",
                f"{name} - Cumulative Earnings",
                f"{name} - Cumulative Taxes",
                f"{name} - Savings Rate",
            ])
        writer.writerow(header)

        # Data
        for year in range(results[0].scenario.projection_years):
            row = [year, results[0].snapshots[year].age]
            for r in results:
                s = r.snapshots[year]
                row.extend([
                    f"{s.gross_income:.0f}",
                    f"{s.net_income:.0f}",
                    f"{s.living_expenses:.0f}",
                    f"{s.loan_payment:.0f}",
                    f"{s.debt_remaining:.0f}",
                    f"{s.annual_savings:.0f}",
                    f"{s.investment_balance:.0f}",
                    f"{s.net_worth:.0f}",
                    f"{s.cumulative_earnings:.0f}",
                    f"{s.cumulative_taxes:.0f}",
                    f"{s.savings_rate_actual:.1%}",
                ])
            writer.writerow(row)

    return path
