"""
Baseline monthly living expense defaults.

These represent national-average monthly costs before regional adjustment.
Region multipliers from regions.py are applied on top of these baselines.

"At home" assumes the student contributes to household expenses (food, transport,
phone, etc.) but does not pay rent.

"Independent" assumes a full cost-of-living budget: rent, utilities, groceries,
transport, insurance, phone, and basic personal expenses.
"""

# Monthly baseline expenses (before regional multiplier)
MONTHLY_EXPENSES: dict[str, float] = {
    "at_home":       800,     # Household contribution + personal costs
    "independent": 2_200,     # Full independent living (rent, food, etc.)
}
