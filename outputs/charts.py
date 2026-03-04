"""
Chart rendering for comparison output (CLI / static PNG).

Generates matplotlib charts:
1. Net worth over time (THE hero chart)
2. Debt remaining over time
3. Annual income trajectory over time
4. Cumulative earnings over time
5. Actual savings rate over time
6. Investment growth over time

NOTE FOR WEB MIGRATION:
  This module is for CLI output only. When moving to a web app,
  the front-end (React/Recharts/D3) should own all chart styling,
  colors, and layout. The API should return raw SimResult data
  and let the client render it. Do not import this module from
  a web backend — it exists solely for the CLI pipeline.
"""

from __future__ import annotations

import os

# matplotlib with non-interactive backend (no display needed)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker


# Color palette — accessible, distinct, looks good on white background
COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#8b5cf6"]
ZERO_LINE_COLOR = "#94a3b8"


def _format_dollars(x, pos):
    """Format axis ticks as $XXk or $XXXk."""
    if abs(x) >= 1_000_000:
        return f"${x / 1_000_000:.1f}M"
    elif abs(x) >= 1_000:
        return f"${x / 1_000:.0f}k"
    else:
        return f"${x:.0f}"


def _format_pct(x, pos):
    """Format axis ticks as percentages."""
    return f"{x * 100:.0f}%"


def _get_xlim(results: list) -> tuple[int, int]:
    """Compute x-axis limits from the projection horizon."""
    start = results[0].scenario.start_age - 1
    end = results[0].scenario.start_age + results[0].scenario.projection_years
    return (start, end)


def _get_ages(result) -> list[int]:
    return [s.age for s in result.snapshots]


def render_net_worth_chart(
    results: list,
    output_dir: str,
    filename: str = "comparison_networth.png",
) -> str:
    """The hero chart: net worth over time for all paths."""

    fig, ax = plt.subplots(figsize=(12, 7))

    for i, result in enumerate(results):
        ages = _get_ages(result)
        net_worths = [s.net_worth for s in result.snapshots]
        color = COLORS[i % len(COLORS)]
        ax.plot(ages, net_worths, linewidth=2.5, color=color,
                label=result.scenario.name, marker="o", markersize=3)

    ax.axhline(y=0, color=ZERO_LINE_COLOR, linestyle="--", linewidth=1, alpha=0.7)

    ax.set_title("Net Worth Over Time — Side-by-Side Comparison",
                 fontsize=16, fontweight="bold", pad=15)
    ax.set_xlabel("Age", fontsize=12)
    ax.set_ylabel("Net Worth", fontsize=12)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(_format_dollars))
    ax.legend(loc="upper left", fontsize=9, framealpha=0.9)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(*_get_xlim(results))

    plt.tight_layout()
    path = os.path.join(output_dir, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def render_debt_chart(
    results: list,
    output_dir: str,
    filename: str = "comparison_debt.png",
) -> str:
    """Debt remaining over time for paths with debt."""

    debt_results = [r for r in results if r.scenario.education.total_loan_amount > 0]
    if not debt_results:
        return ""

    fig, ax = plt.subplots(figsize=(12, 6))

    for i, result in enumerate(debt_results):
        ages = _get_ages(result)
        debt = [s.debt_remaining for s in result.snapshots]
        idx = results.index(result)
        color = COLORS[idx % len(COLORS)]
        ax.plot(ages, debt, linewidth=2.5, color=color,
                label=result.scenario.name, marker="o", markersize=3)

    ax.axhline(y=0, color=ZERO_LINE_COLOR, linestyle="--", linewidth=1, alpha=0.7)

    ax.set_title("Debt Remaining Over Time", fontsize=16, fontweight="bold", pad=15)
    ax.set_xlabel("Age", fontsize=12)
    ax.set_ylabel("Debt Remaining", fontsize=12)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(_format_dollars))
    ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(*_get_xlim(results))

    plt.tight_layout()
    path = os.path.join(output_dir, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def render_income_chart(
    results: list,
    output_dir: str,
    filename: str = "comparison_income.png",
) -> str:
    """Annual income trajectory over time for all paths."""

    fig, ax = plt.subplots(figsize=(12, 6))

    for i, result in enumerate(results):
        ages = _get_ages(result)
        income = [s.gross_income for s in result.snapshots]
        color = COLORS[i % len(COLORS)]
        ax.plot(ages, income, linewidth=2.5, color=color,
                label=result.scenario.name, marker="o", markersize=3)

    ax.set_title("Annual Income Over Time", fontsize=16, fontweight="bold", pad=15)
    ax.set_xlabel("Age", fontsize=12)
    ax.set_ylabel("Annual Gross Income", fontsize=12)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(_format_dollars))
    ax.legend(loc="upper left", fontsize=9, framealpha=0.9)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(*_get_xlim(results))

    plt.tight_layout()
    path = os.path.join(output_dir, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def render_cumulative_earnings_chart(
    results: list,
    output_dir: str,
    filename: str = "comparison_cumulative_earnings.png",
) -> str:
    """Cumulative earnings over time — shows the crossover moment."""

    fig, ax = plt.subplots(figsize=(12, 6))

    for i, result in enumerate(results):
        ages = _get_ages(result)
        cum_earnings = [s.cumulative_earnings for s in result.snapshots]
        color = COLORS[i % len(COLORS)]
        ax.plot(ages, cum_earnings, linewidth=2.5, color=color,
                label=result.scenario.name, marker="o", markersize=3)

    ax.set_title("Cumulative Earnings Over Time", fontsize=16, fontweight="bold", pad=15)
    ax.set_xlabel("Age", fontsize=12)
    ax.set_ylabel("Total Earned To Date", fontsize=12)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(_format_dollars))
    ax.legend(loc="upper left", fontsize=9, framealpha=0.9)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(*_get_xlim(results))

    plt.tight_layout()
    path = os.path.join(output_dir, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def render_savings_rate_chart(
    results: list,
    output_dir: str,
    filename: str = "comparison_savings_rate.png",
) -> str:
    """Actual savings rate over time — shows financial breathing room."""

    fig, ax = plt.subplots(figsize=(12, 6))

    for i, result in enumerate(results):
        ages = _get_ages(result)
        rates = [s.savings_rate_actual for s in result.snapshots]
        color = COLORS[i % len(COLORS)]
        ax.plot(ages, rates, linewidth=2.5, color=color,
                label=result.scenario.name, marker="o", markersize=3)

    ax.axhline(y=0, color=ZERO_LINE_COLOR, linestyle="--", linewidth=1, alpha=0.7)

    ax.set_title("Actual Savings Rate Over Time", fontsize=16, fontweight="bold", pad=15)
    ax.set_xlabel("Age", fontsize=12)
    ax.set_ylabel("% of Net Income Saved", fontsize=12)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(_format_pct))
    ax.legend(loc="lower right", fontsize=9, framealpha=0.9)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(*_get_xlim(results))

    plt.tight_layout()
    path = os.path.join(output_dir, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def render_investment_growth_chart(
    results: list,
    output_dir: str,
    filename: str = "comparison_investments.png",
) -> str:
    """Investment balance over time — the compounding story."""

    fig, ax = plt.subplots(figsize=(12, 6))

    for i, result in enumerate(results):
        ages = _get_ages(result)
        investments = [s.investment_balance for s in result.snapshots]
        color = COLORS[i % len(COLORS)]
        ax.plot(ages, investments, linewidth=2.5, color=color,
                label=result.scenario.name, marker="o", markersize=3)

    ax.set_title("Investment Growth Over Time", fontsize=16, fontweight="bold", pad=15)
    ax.set_xlabel("Age", fontsize=12)
    ax.set_ylabel("Investment Balance", fontsize=12)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(_format_dollars))
    ax.legend(loc="upper left", fontsize=9, framealpha=0.9)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(*_get_xlim(results))

    plt.tight_layout()
    path = os.path.join(output_dir, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def render_all_charts(results: list, output_dir: str) -> list[str]:
    """Render all comparison charts. Returns list of file paths."""
    os.makedirs(output_dir, exist_ok=True)
    paths = []

    # Core charts
    paths.append(render_net_worth_chart(results, output_dir))
    debt_path = render_debt_chart(results, output_dir)
    if debt_path:
        paths.append(debt_path)
    paths.append(render_income_chart(results, output_dir))

    # New charts
    paths.append(render_cumulative_earnings_chart(results, output_dir))
    paths.append(render_savings_rate_chart(results, output_dir))
    paths.append(render_investment_growth_chart(results, output_dir))

    return paths
