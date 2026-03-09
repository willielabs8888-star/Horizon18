"""
Tests for the defaults module.

Verifies:
1. All expected keys exist in every defaults dictionary.
2. Values are within reasonable ranges (sanity checks).
3. Enum values from data_models align with defaults dict keys.
4. Product decisions are locked to correct values.
5. Cross-module consistency (same trades in wages, journeyman, school costs).
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from model.data_models import (
    SchoolType,
    Major,
    TradeType,
    WorkforceIndustry,
    Region,
)
from defaults import (
    TUITION_ANNUAL,
    ROOM_AND_BOARD_ANNUAL,
    TRADE_SCHOOL_TOTAL,
    STARTING_SALARY,
    SALARY_GROWTH,
    CC_TRANSFER_SALARY_DISCOUNT,
    APPRENTICE_WAGES,
    JOURNEYMAN_SALARY,
    ENLISTED_ANNUAL_COMP,
    MILITARY_MONTHLY_EXPENSES,
    GI_BILL,
    VETERAN_HIRING_PREMIUM,
    ENTRY_WAGES,
    REGION_MULTIPLIERS,
    MONTHLY_EXPENSES,
    SAVINGS_RATE,
    INVESTMENT_RETURN,
    EFFECTIVE_TAX_RATE,
    LOAN_INTEREST_RATE,
    LOAN_TERM_YEARS,
    GRACE_PERIOD_MONTHS,
)


# =============================================================================
# TUITION DEFAULTS
# =============================================================================

class TestTuitionDefaults(unittest.TestCase):
    def test_all_school_types_have_tuition(self):
        for st in SchoolType:
            self.assertIn(st.value, TUITION_ANNUAL, f"Missing tuition for {st.value}")

    def test_community_college_in_tuition(self):
        self.assertIn("community_college", TUITION_ANNUAL)

    def test_tuition_values_reasonable(self):
        for key, val in TUITION_ANNUAL.items():
            self.assertGreater(val, 1_000, f"Tuition for {key} too low")
            self.assertLess(val, 100_000, f"Tuition for {key} too high")

    def test_public_cheaper_than_private(self):
        self.assertLess(TUITION_ANNUAL["public_in_state"], TUITION_ANNUAL["private"])
        self.assertLess(TUITION_ANNUAL["public_in_state"], TUITION_ANNUAL["public_out_of_state"])

    def test_community_college_cheapest(self):
        self.assertLess(TUITION_ANNUAL["community_college"], TUITION_ANNUAL["public_in_state"])

    def test_room_and_board_keys(self):
        self.assertEqual(set(ROOM_AND_BOARD_ANNUAL.keys()), {"on_campus", "off_campus", "at_home"})

    def test_room_and_board_ordering(self):
        self.assertLess(ROOM_AND_BOARD_ANNUAL["at_home"], ROOM_AND_BOARD_ANNUAL["off_campus"])
        self.assertLess(ROOM_AND_BOARD_ANNUAL["off_campus"], ROOM_AND_BOARD_ANNUAL["on_campus"])

    def test_trade_school_all_trades_present(self):
        for trade in TradeType:
            self.assertIn(trade.value, TRADE_SCHOOL_TOTAL, f"Missing trade school cost for {trade.value}")

    def test_trade_school_costs_reasonable(self):
        for key, val in TRADE_SCHOOL_TOTAL.items():
            self.assertGreater(val, 5_000, f"Trade school for {key} too low")
            self.assertLess(val, 30_000, f"Trade school for {key} too high")


# =============================================================================
# SALARY DEFAULTS
# =============================================================================

class TestSalaryDefaults(unittest.TestCase):
    def test_all_majors_have_starting_salary(self):
        for major in Major:
            self.assertIn(major.value, STARTING_SALARY, f"Missing salary for {major.value}")

    def test_salary_values_reasonable(self):
        for key, val in STARTING_SALARY.items():
            self.assertGreater(val, 20_000, f"Salary for {key} too low")
            self.assertLess(val, 200_000, f"Salary for {key} too high")

    def test_stem_among_highest(self):
        stem = STARTING_SALARY["stem"]
        healthcare = STARTING_SALARY["healthcare"]
        top = max(stem, healthcare)
        for key, val in STARTING_SALARY.items():
            if key not in ("stem", "healthcare"):
                self.assertLessEqual(val, top, f"{key} exceeds STEM/healthcare")

    def test_healthcare_locked_at_85k(self):
        self.assertEqual(STARTING_SALARY["healthcare"], 85_000)

    def test_all_growth_rates_positive(self):
        for key, val in SALARY_GROWTH.items():
            self.assertGreater(val, 0, f"Growth for {key} not positive")
            self.assertLess(val, 0.10, f"Growth for {key} unreasonably high")

    def test_cc_discount_locked_at_2pct(self):
        self.assertEqual(CC_TRANSFER_SALARY_DISCOUNT, 0.02)

    def test_salary_growth_covers_all_paths(self):
        required = set(m.value for m in Major) | {"trade", "workforce", "military_civilian"}
        actual = set(SALARY_GROWTH.keys())
        self.assertTrue(required.issubset(actual), f"Missing growth rates: {required - actual}")


# =============================================================================
# TRADE DEFAULTS
# =============================================================================

class TestTradeDefaults(unittest.TestCase):
    def test_all_trades_have_apprentice_wages(self):
        for trade in TradeType:
            self.assertIn(trade.value, APPRENTICE_WAGES)

    def test_apprentice_wages_are_4_years(self):
        for trade, wages in APPRENTICE_WAGES.items():
            self.assertEqual(len(wages), 4, f"{trade} has {len(wages)} years, expected 4")

    def test_apprentice_wages_increase_each_year(self):
        for trade, wages in APPRENTICE_WAGES.items():
            for i in range(1, len(wages)):
                self.assertGreater(
                    wages[i], wages[i - 1],
                    f"{trade} year {i+1} not higher than year {i}"
                )

    def test_all_trades_have_journeyman_salary(self):
        for trade in TradeType:
            self.assertIn(trade.value, JOURNEYMAN_SALARY)

    def test_journeyman_higher_than_final_apprentice(self):
        for trade in TradeType:
            tv = trade.value
            self.assertGreater(
                JOURNEYMAN_SALARY[tv], APPRENTICE_WAGES[tv][-1],
                f"{tv} journeyman not higher than final apprentice year"
            )


# =============================================================================
# MILITARY DEFAULTS
# =============================================================================

class TestMilitaryDefaults(unittest.TestCase):
    def test_enlisted_comp_is_4_years(self):
        self.assertEqual(len(ENLISTED_ANNUAL_COMP), 4)

    def test_enlisted_comp_increases(self):
        for i in range(1, len(ENLISTED_ANNUAL_COMP)):
            self.assertGreater(ENLISTED_ANNUAL_COMP[i], ENLISTED_ANNUAL_COMP[i - 1])

    def test_enlisted_comp_reasonable(self):
        for val in ENLISTED_ANNUAL_COMP:
            self.assertGreater(val, 30_000)
            self.assertLess(val, 60_000)

    def test_military_monthly_expenses_low(self):
        self.assertLess(MILITARY_MONTHLY_EXPENSES, 1_000)

    def test_gi_bill_required_keys(self):
        required = {"annual_tuition_cap", "monthly_housing", "annual_books", "months_of_benefits"}
        self.assertEqual(set(GI_BILL.keys()), required)

    def test_gi_bill_36_months(self):
        self.assertEqual(GI_BILL["months_of_benefits"], 36)

    def test_veteran_premium_reasonable(self):
        self.assertGreater(VETERAN_HIRING_PREMIUM, 0)
        self.assertLess(VETERAN_HIRING_PREMIUM, 0.25)


# =============================================================================
# WORKFORCE DEFAULTS
# =============================================================================

class TestWorkforceDefaults(unittest.TestCase):
    def test_all_industries_have_wages(self):
        for industry in WorkforceIndustry:
            self.assertIn(industry.value, ENTRY_WAGES)

    def test_wages_reasonable(self):
        for key, val in ENTRY_WAGES.items():
            self.assertGreater(val, 20_000, f"Wage for {key} too low")
            self.assertLess(val, 50_000, f"Wage for {key} too high")


# =============================================================================
# REGION DEFAULTS
# =============================================================================

class TestRegionDefaults(unittest.TestCase):
    def test_all_regions_have_multipliers(self):
        for region in Region:
            self.assertIn(region.value, REGION_MULTIPLIERS)

    def test_multiplier_keys(self):
        for region, data in REGION_MULTIPLIERS.items():
            self.assertIn("salary", data, f"{region} missing salary multiplier")
            self.assertIn("expenses", data, f"{region} missing expenses multiplier")

    def test_multipliers_reasonable(self):
        for region, data in REGION_MULTIPLIERS.items():
            self.assertGreater(data["salary"], 0.5)
            self.assertLess(data["salary"], 2.0)
            self.assertGreater(data["expenses"], 0.5)
            self.assertLess(data["expenses"], 2.0)

    def test_northeast_most_expensive(self):
        ne = REGION_MULTIPLIERS["northeast"]["expenses"]
        for region, data in REGION_MULTIPLIERS.items():
            self.assertLessEqual(data["expenses"], ne,
                f"{region} expenses exceeds northeast")

    def test_southeast_cheapest(self):
        se = REGION_MULTIPLIERS["southeast"]["expenses"]
        for region, data in REGION_MULTIPLIERS.items():
            self.assertGreaterEqual(data["expenses"], se,
                f"{region} cheaper than southeast")


# =============================================================================
# LIVING + FINANCIAL DEFAULTS
# =============================================================================

class TestLivingDefaults(unittest.TestCase):
    def test_expense_keys(self):
        self.assertEqual(set(MONTHLY_EXPENSES.keys()), {"at_home", "independent"})

    def test_at_home_cheaper(self):
        self.assertLess(MONTHLY_EXPENSES["at_home"], MONTHLY_EXPENSES["independent"])

    def test_values_reasonable(self):
        self.assertGreater(MONTHLY_EXPENSES["at_home"], 200)
        self.assertLess(MONTHLY_EXPENSES["at_home"], 2_000)
        self.assertGreater(MONTHLY_EXPENSES["independent"], 1_000)
        self.assertLess(MONTHLY_EXPENSES["independent"], 5_000)


class TestFinancialDefaults(unittest.TestCase):
    def test_savings_rate(self):
        self.assertEqual(SAVINGS_RATE, 0.10)

    def test_investment_return_locked_at_7pct(self):
        self.assertEqual(INVESTMENT_RETURN, 0.07)

    def test_effective_tax_rate(self):
        self.assertGreater(EFFECTIVE_TAX_RATE, 0.10)
        self.assertLess(EFFECTIVE_TAX_RATE, 0.30)

    def test_loan_interest_rate(self):
        self.assertGreater(LOAN_INTEREST_RATE, 0.01)
        self.assertLess(LOAN_INTEREST_RATE, 0.15)

    def test_loan_term(self):
        self.assertEqual(LOAN_TERM_YEARS, 10)

    def test_grace_period(self):
        self.assertEqual(GRACE_PERIOD_MONTHS, 6)


# =============================================================================
# CROSS-MODULE CONSISTENCY
# =============================================================================

class TestCrossModuleConsistency(unittest.TestCase):
    """Verify enum values used as dict keys align across modules."""

    def test_trade_types_consistent_across_modules(self):
        wage_keys = set(APPRENTICE_WAGES.keys())
        journeyman_keys = set(JOURNEYMAN_SALARY.keys())
        school_keys = set(TRADE_SCHOOL_TOTAL.keys())
        enum_keys = {t.value for t in TradeType}

        self.assertEqual(wage_keys, enum_keys, "Apprentice wages mismatch")
        self.assertEqual(journeyman_keys, enum_keys, "Journeyman mismatch")
        self.assertEqual(school_keys, enum_keys, "Trade school mismatch")

    def test_workforce_industries_consistent(self):
        enum_keys = {i.value for i in WorkforceIndustry}
        wage_keys = set(ENTRY_WAGES.keys())
        self.assertEqual(wage_keys, enum_keys)

    def test_regions_consistent(self):
        enum_keys = {r.value for r in Region}
        region_keys = set(REGION_MULTIPLIERS.keys())
        self.assertEqual(region_keys, enum_keys)

    def test_major_salary_keys_cover_enum(self):
        enum_keys = {m.value for m in Major}
        salary_keys = set(STARTING_SALARY.keys())
        self.assertTrue(enum_keys.issubset(salary_keys),
            f"Missing salary entries: {enum_keys - salary_keys}")


if __name__ == "__main__":
    unittest.main()
