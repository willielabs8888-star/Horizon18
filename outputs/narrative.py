"""
Plain-English narrative generator.

Produces a human-readable summary of the comparison results.
Designed to be understood by a high school senior.
"""

from __future__ import annotations

from model.data_models import SimResult


def render_narrative(results: list[SimResult]) -> str:
    """Generate a plain-English comparison summary.

    Uses the highest milestone age (end-of-horizon) for ranking
    and key takeaway, adapting automatically to any --years value.
    """

    lines = []
    lines.append("=" * 60)
    lines.append("  YOUR PATH COMPARISON — WHAT THE NUMBERS SAY")
    lines.append("=" * 60)
    lines.append("")

    projection_years = results[0].scenario.projection_years
    start_age = results[0].scenario.start_age
    end_age = start_age + projection_years - 1

    # Sort by net worth at end of horizon (best to worst)
    def _end_nw(r: SimResult) -> float:
        milestones = r.net_worth_milestones
        if milestones:
            return milestones[max(milestones.keys())]
        return r.snapshots[-1].net_worth if r.snapshots else 0.0

    ranked = sorted(results, key=_end_nw, reverse=True)

    for i, result in enumerate(ranked):
        name = result.scenario.name
        end_nw = _end_nw(result)
        debt = result.scenario.education.total_loan_amount
        year_pos = result.year_positive_net_worth
        earnings = result.total_earnings

        lines.append(f"  #{i + 1}  {name}")
        lines.append(f"      Net worth at {end_age}: ${end_nw:,.0f}")
        lines.append(f"      {projection_years}-year earnings: ${earnings:,.0f}")

        if debt > 0:
            lines.append(f"      Starting debt: ${debt:,.0f}")
            lines.append(f"      Total interest paid: ${result.total_loan_interest_paid:,.0f}")
            if result.year_debt_free is not None:
                lines.append(f"      Debt-free by: Age {result.year_debt_free}")
        else:
            lines.append(f"      Starting debt: $0")

        if year_pos is not None:
            lines.append(f"      Positive net worth at: Age {year_pos}")

        lines.append("")

    # Key takeaway
    best = ranked[0]
    fastest_positive = min(
        (r for r in results if r.year_positive_net_worth is not None),
        key=lambda r: r.year_positive_net_worth,
        default=None,
    )

    lines.append("─" * 60)
    lines.append("  KEY TAKEAWAYS")
    lines.append("─" * 60)
    lines.append("")
    lines.append(f"  Strongest position at {end_age}: {best.scenario.name}")
    lines.append(f"    → ${_end_nw(best):,.0f} projected net worth")
    lines.append("")

    if fastest_positive is not None and fastest_positive != best:
        lines.append(f"  Fastest to positive net worth: {fastest_positive.scenario.name}")
        lines.append(f"    → Crosses $0 at age {fastest_positive.year_positive_net_worth}")
        lines.append("")

    # Debt warning for high-debt paths
    high_debt = [r for r in results if r.debt_burden_ratio > 0.20]
    if high_debt:
        for r in high_debt:
            lines.append(f"  ⚠ {r.scenario.name}: peak debt burden of {r.debt_burden_ratio:.0%}")
            lines.append(f"    This means {r.debt_burden_ratio:.0%} of take-home pay goes to loan payments.")
        lines.append("")

    lines.append("─" * 60)
    lines.append("  DISCLAIMER")
    lines.append("  These are projections based on national averages.")
    lines.append("  Your actual results depend on your specific choices,")
    lines.append("  effort, market conditions, and circumstances.")
    lines.append("  Historical returns ≠ future returns.")
    lines.append("  This is not financial advice.")
    lines.append("─" * 60)
    lines.append("")

    return "\n".join(lines)
