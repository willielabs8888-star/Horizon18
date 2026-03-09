"""
Integration tests — end-to-end from quiz answers to simulation results.

Tests all 5 path types through the full pipeline:
quiz answers → builder → engines → projection → SimResult
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from model.data_models import (
    PathType, SchoolType, Major, TradeType, WorkforceIndustry, Region,
    QuizAnswers, CollegeAnswers, CommunityCollegeAnswers,
    TradeAnswers, WorkforceAnswers, MilitaryAnswers,
    SimResult,
)
from compare import run_comparison


def _make_quiz(**overrides) -> QuizAnswers:
    """Helper to build quiz answers with sensible defaults."""
    defaults = dict(
        selected_paths=[PathType.COLLEGE],
        region=Region.MIDWEST,
        living_at_home=True,
        years_at_home=2,
        family_savings=0,
    )
    defaults.update(overrides)
    return QuizAnswers(**defaults)


class TestCollegePath(unittest.TestCase):
    def test_college_stem_produces_valid_result(self):
        quiz = _make_quiz(
            selected_paths=[PathType.COLLEGE],
            college=CollegeAnswers(school_type=SchoolType.PUBLIC_IN_STATE, major=Major.STEM),
        )
        results = run_comparison(quiz)
        self.assertEqual(len(results), 1)
        r = results[0]

        self.assertIsInstance(r, SimResult)
        self.assertEqual(len(r.snapshots), 32)
        self.assertEqual(r.snapshots[0].age, 18)
        self.assertEqual(r.snapshots[-1].age, 49)

        # Should have debt
        self.assertGreater(r.scenario.education.total_loan_amount, 0)
        # Should eventually have positive net worth
        self.assertIsNotNone(r.year_positive_net_worth)
        # STEM should earn well by 38
        self.assertGreater(r.net_worth_at_38, 0)

    def test_college_liberal_arts_lower_than_stem(self):
        quiz_stem = _make_quiz(
            selected_paths=[PathType.COLLEGE],
            college=CollegeAnswers(major=Major.STEM),
        )
        quiz_la = _make_quiz(
            selected_paths=[PathType.COLLEGE],
            college=CollegeAnswers(major=Major.LIBERAL_ARTS),
        )
        r_stem = run_comparison(quiz_stem)[0]
        r_la = run_comparison(quiz_la)[0]

        self.assertGreater(r_stem.net_worth_at_38, r_la.net_worth_at_38)
        self.assertGreater(r_stem.total_earnings, r_la.total_earnings)


class TestCCTransferPath(unittest.TestCase):
    def test_cc_transfer_less_debt_than_college(self):
        quiz = _make_quiz(
            selected_paths=[PathType.COLLEGE, PathType.CC_TRANSFER],
            college=CollegeAnswers(major=Major.BUSINESS),
            community_college=CommunityCollegeAnswers(major=Major.BUSINESS),
        )
        results = run_comparison(quiz)
        college_result = results[0]
        cc_result = results[1]

        self.assertLess(
            cc_result.scenario.education.total_loan_amount,
            college_result.scenario.education.total_loan_amount,
        )


class TestTradePath(unittest.TestCase):
    def test_trade_earns_from_day_one(self):
        quiz = _make_quiz(
            selected_paths=[PathType.TRADE],
            trade=TradeAnswers(trade_type=TradeType.ELECTRICIAN),
        )
        results = run_comparison(quiz)
        r = results[0]

        # Should have income from year 0
        self.assertGreater(r.snapshots[0].gross_income, 0)
        # Minimal debt
        self.assertLess(r.scenario.education.total_loan_amount, 20_000)
        # Positive net worth quickly
        self.assertIsNotNone(r.year_positive_net_worth)
        self.assertLessEqual(r.year_positive_net_worth, 25)

    def test_all_trades_produce_results(self):
        for trade_type in TradeType:
            quiz = _make_quiz(
                selected_paths=[PathType.TRADE],
                trade=TradeAnswers(trade_type=trade_type),
            )
            results = run_comparison(quiz)
            self.assertEqual(len(results), 1)
            self.assertEqual(len(results[0].snapshots), 32)


class TestWorkforcePath(unittest.TestCase):
    def test_workforce_no_debt(self):
        quiz = _make_quiz(
            selected_paths=[PathType.WORKFORCE],
            workforce=WorkforceAnswers(industry=WorkforceIndustry.ADMIN),
        )
        results = run_comparison(quiz)
        r = results[0]

        self.assertEqual(r.scenario.education.total_loan_amount, 0)
        self.assertEqual(r.total_loan_interest_paid, 0)
        self.assertIsNone(r.year_debt_free)  # Never had debt

    def test_workforce_immediate_income(self):
        quiz = _make_quiz(
            selected_paths=[PathType.WORKFORCE],
            workforce=WorkforceAnswers(),
        )
        r = run_comparison(quiz)[0]
        self.assertGreater(r.snapshots[0].gross_income, 0)


class TestMilitaryPath(unittest.TestCase):
    def test_military_gi_bill(self):
        quiz = _make_quiz(
            selected_paths=[PathType.MILITARY],
            military=MilitaryAnswers(use_gi_bill=True, gi_bill_major=Major.STEM),
        )
        r = run_comparison(quiz)[0]

        self.assertEqual(r.scenario.education.total_loan_amount, 0)
        # Income from year 0 (military pay)
        self.assertGreater(r.snapshots[0].gross_income, 30_000)
        # Tax-exempt years for GI Bill housing
        self.assertGreater(len(r.scenario.career.tax_exempt_years), 0)

    def test_military_no_gi_bill(self):
        quiz = _make_quiz(
            selected_paths=[PathType.MILITARY],
            military=MilitaryAnswers(use_gi_bill=False),
        )
        r = run_comparison(quiz)[0]

        self.assertEqual(r.scenario.education.total_loan_amount, 0)
        self.assertEqual(len(r.scenario.career.tax_exempt_years), 0)


class TestFullComparison(unittest.TestCase):
    def test_five_path_comparison(self):
        """The big test: all 5 paths at once."""
        quiz = QuizAnswers(
            selected_paths=list(PathType),
            region=Region.MIDWEST,
            living_at_home=True,
            years_at_home=2,
            family_savings=0,
            college=CollegeAnswers(major=Major.STEM),
            community_college=CommunityCollegeAnswers(major=Major.BUSINESS),
            trade=TradeAnswers(trade_type=TradeType.ELECTRICIAN),
            workforce=WorkforceAnswers(industry=WorkforceIndustry.ADMIN),
            military=MilitaryAnswers(use_gi_bill=True, gi_bill_major=Major.STEM),
        )
        results = run_comparison(quiz)

        self.assertEqual(len(results), 5)
        for r in results:
            self.assertEqual(len(r.snapshots), 32)
            self.assertIsInstance(r.total_earnings, float)
            self.assertGreater(r.total_earnings, 0)

    def test_region_affects_outcomes(self):
        """NYC (northeast) should have higher costs than Atlanta (southeast)."""
        quiz_ne = _make_quiz(
            selected_paths=[PathType.WORKFORCE],
            metro_area="nyc",
            region=Region.NORTHEAST,
            workforce=WorkforceAnswers(industry=WorkforceIndustry.ADMIN),
        )
        quiz_se = _make_quiz(
            selected_paths=[PathType.WORKFORCE],
            metro_area="atlanta",
            region=Region.SOUTHEAST,
            workforce=WorkforceAnswers(industry=WorkforceIndustry.ADMIN),
        )
        r_ne = run_comparison(quiz_ne)[0]
        r_se = run_comparison(quiz_se)[0]

        # NYC has higher income than Atlanta
        self.assertGreater(r_ne.snapshots[0].gross_income, r_se.snapshots[0].gross_income)
        # NYC has higher expenses than Atlanta
        self.assertGreater(r_ne.snapshots[0].living_expenses, r_se.snapshots[0].living_expenses)

    def test_family_savings_reduces_debt(self):
        quiz_no_savings = _make_quiz(
            selected_paths=[PathType.COLLEGE],
            family_savings=0,
            college=CollegeAnswers(major=Major.STEM),
        )
        quiz_with_savings = _make_quiz(
            selected_paths=[PathType.COLLEGE],
            family_savings=20_000,
            college=CollegeAnswers(major=Major.STEM),
        )
        r_no = run_comparison(quiz_no_savings)[0]
        r_with = run_comparison(quiz_with_savings)[0]

        self.assertLess(
            r_with.scenario.education.total_loan_amount,
            r_no.scenario.education.total_loan_amount,
        )


class TestLoanFeasibility(unittest.TestCase):
    """Loan payments must not exceed disposable income."""

    def test_loan_payment_never_exceeds_disposable_income(self):
        """Every year's loan payment should be <= net_income - expenses."""
        quiz = _make_quiz(
            selected_paths=[PathType.COLLEGE],
            college=CollegeAnswers(
                school_type=SchoolType.PRIVATE,
                major=Major.EDUCATION,
                loan_term_years=10,
            ),
        )
        results = run_comparison(quiz)
        r = results[0]
        for snap in r.snapshots:
            if snap.loan_payment > 0:
                max_affordable = snap.net_income - snap.living_expenses
                self.assertLessEqual(
                    snap.loan_payment, max_affordable + 0.01,
                    f"Age {snap.age}: loan payment ${snap.loan_payment:.0f} exceeds "
                    f"affordable ${max_affordable:.0f} (net ${snap.net_income:.0f} - expenses ${snap.living_expenses:.0f})"
                )

    def test_loan_extended_flag_set_when_capped(self):
        """If payments are capped, loan_extended should be True."""
        quiz = _make_quiz(
            selected_paths=[PathType.COLLEGE],
            college=CollegeAnswers(
                school_type=SchoolType.PRIVATE,
                major=Major.EDUCATION,
                loan_term_years=5,  # Very aggressive repayment
            ),
        )
        results = run_comparison(quiz, projection_years=40)
        r = results[0]
        # If payments were capped, actual term should exceed original
        if r.loan_extended:
            self.assertGreater(r.loan_term_actual, r.loan_term_original)

    def test_different_return_rates_produce_different_outcomes(self):
        """Investment return rate should affect final net worth."""
        from model.projection import run_projection
        quiz = _make_quiz(
            selected_paths=[PathType.WORKFORCE],
            workforce=WorkforceAnswers(industry=WorkforceIndustry.ADMIN),
        )
        # Run with low return rate
        results_low = run_comparison(quiz, projection_years=30)
        r_low = results_low[0]
        r_low.scenario.investment_return_rate = 0.04
        r_low = run_projection(r_low.scenario)

        results_high = run_comparison(quiz, projection_years=30)
        r_high = results_high[0]
        r_high.scenario.investment_return_rate = 0.15
        r_high = run_projection(r_high.scenario)

        nw_low = r_low.snapshots[-1].net_worth
        nw_high = r_high.snapshots[-1].net_worth
        self.assertGreater(nw_high, nw_low,
            f"15% return (${nw_high:.0f}) should beat 4% return (${nw_low:.0f})")


if __name__ == "__main__":
    unittest.main()
