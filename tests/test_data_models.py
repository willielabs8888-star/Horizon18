"""
Tests for data_models.py — enums, dataclasses, and consistency checks.
Uses unittest (stdlib) so no pip install required.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from model.data_models import (
    PathType,
    SchoolType,
    Major,
    TradeType,
    WorkforceIndustry,
    Region,
    CollegeAnswers,
    CommunityCollegeAnswers,
    TradeAnswers,
    WorkforceAnswers,
    MilitaryAnswers,
    QuizAnswers,
    EducationProfile,
    CareerProfile,
    LivingProfile,
    Scenario,
    YearSnapshot,
    SimResult,
)


# =============================================================================
# ENUM TESTS
# =============================================================================

class TestPathType(unittest.TestCase):
    """Nit #1: PathType is the single canonical enum."""

    def test_all_five_paths_exist(self):
        self.assertEqual(len(PathType), 5)
        self.assertEqual(PathType.COLLEGE.value, "college")
        self.assertEqual(PathType.CC_TRANSFER.value, "cc_transfer")
        self.assertEqual(PathType.TRADE.value, "trade")
        self.assertEqual(PathType.WORKFORCE.value, "workforce")
        self.assertEqual(PathType.MILITARY.value, "military")

    def test_str_enum_equality(self):
        """PathType inherits from str so it compares equal to its value."""
        self.assertEqual(PathType.COLLEGE, "college")
        self.assertEqual(PathType.MILITARY, "military")

    def test_path_type_from_string(self):
        self.assertEqual(PathType("college"), PathType.COLLEGE)
        self.assertEqual(PathType("military"), PathType.MILITARY)

    def test_invalid_path_raises(self):
        with self.assertRaises(ValueError):
            PathType("university")
        with self.assertRaises(ValueError):
            PathType("community_college")


class TestSchoolType(unittest.TestCase):
    def test_all_types(self):
        self.assertEqual(len(SchoolType), 3)
        self.assertEqual(SchoolType.PUBLIC_IN_STATE.value, "public_in_state")
        self.assertEqual(SchoolType.PUBLIC_OUT_OF_STATE.value, "public_out_of_state")
        self.assertEqual(SchoolType.PRIVATE.value, "private")


class TestMajor(unittest.TestCase):
    def test_all_majors(self):
        self.assertEqual(len(Major), 22)
        values = {m.value for m in Major}
        # New granular majors + legacy aliases
        expected = {
            "computer_science", "engineering", "biology", "environmental_science",
            "nursing", "kinesiology",
            "business_finance", "accounting", "marketing",
            "psychology", "criminal_justice", "political_science", "communications",
            "english", "social_work",
            "education", "art_design", "undecided",
            # Legacy aliases
            "stem", "business", "healthcare", "liberal_arts",
        }
        self.assertEqual(values, expected)


class TestTradeType(unittest.TestCase):
    def test_all_trades(self):
        self.assertEqual(len(TradeType), 12)
        values = {t.value for t in TradeType}
        expected = {
            "electrician", "plumber", "hvac", "carpenter",
            "welder", "automotive_tech", "diesel_mechanic", "cnc_machinist",
            "lineworker", "ironworker", "elevator_mechanic", "heavy_equipment_op",
        }
        self.assertEqual(values, expected)


class TestRegion(unittest.TestCase):
    def test_all_regions(self):
        self.assertEqual(len(Region), 5)
        values = {r.value for r in Region}
        expected = {"northeast", "southeast", "midwest", "southwest", "west_coast"}
        self.assertEqual(values, expected)


# =============================================================================
# QUIZ ANSWER TESTS
# =============================================================================

class TestQuizAnswers(unittest.TestCase):
    def test_default_quiz_answers(self):
        qa = QuizAnswers(selected_paths=[PathType.COLLEGE, PathType.TRADE])
        self.assertEqual(qa.region, Region.MIDWEST)
        self.assertFalse(qa.living_at_home)
        self.assertEqual(qa.years_at_home, 2)
        self.assertEqual(qa.family_savings, 0.0)
        self.assertIsNone(qa.college)
        self.assertIsNone(qa.trade)
        self.assertIsNone(qa.military)

    def test_college_answers_defaults(self):
        ca = CollegeAnswers()
        self.assertEqual(ca.school_type, SchoolType.PUBLIC_IN_STATE)
        self.assertEqual(ca.major, Major.UNDECIDED)
        self.assertTrue(ca.part_time_work)
        self.assertEqual(ca.part_time_income, 8_000)

    def test_cc_answers_defaults(self):
        cc = CommunityCollegeAnswers()
        self.assertEqual(cc.transfer_university_type, SchoolType.PUBLIC_IN_STATE)
        self.assertEqual(cc.major, Major.UNDECIDED)
        self.assertEqual(cc.part_time_income, 10_000)

    def test_trade_answers_defaults(self):
        ta = TradeAnswers()
        self.assertEqual(ta.trade_type, TradeType.ELECTRICIAN)

    def test_workforce_answers_defaults(self):
        wa = WorkforceAnswers()
        self.assertEqual(wa.industry, WorkforceIndustry.RETAIL)
        self.assertIsNone(wa.known_starting_wage)

    def test_military_answers_defaults(self):
        ma = MilitaryAnswers()
        self.assertEqual(ma.enlistment_years, 4)
        self.assertTrue(ma.use_gi_bill)
        self.assertEqual(ma.gi_bill_major, Major.UNDECIDED)

    def test_full_quiz_with_all_paths(self):
        qa = QuizAnswers(
            selected_paths=list(PathType),
            region=Region.NORTHEAST,
            living_at_home=False,
            years_at_home=0,
            family_savings=15_000,
            college=CollegeAnswers(school_type=SchoolType.PRIVATE, major=Major.STEM),
            community_college=CommunityCollegeAnswers(major=Major.BUSINESS),
            trade=TradeAnswers(trade_type=TradeType.PLUMBER),
            workforce=WorkforceAnswers(industry=WorkforceIndustry.MANUFACTURING),
            military=MilitaryAnswers(use_gi_bill=True, gi_bill_major=Major.STEM),
        )
        self.assertEqual(len(qa.selected_paths), 5)
        self.assertEqual(qa.college.school_type, SchoolType.PRIVATE)
        self.assertEqual(qa.trade.trade_type, TradeType.PLUMBER)


# =============================================================================
# ENGINE OUTPUT PROFILE TESTS
# =============================================================================

class TestEducationProfile(unittest.TestCase):
    def test_college_profile(self):
        ep = EducationProfile(
            path_type=PathType.COLLEGE,
            label="4-Year Public University (STEM)",
            years_in_school=4,
            earns_during_school=False,
            annual_tuition=[11_371] * 4,
            annual_room_and_board=[12_000] * 4,
            total_loan_amount=35_000,
        )
        self.assertEqual(ep.years_in_school, 4)
        self.assertEqual(len(ep.annual_tuition), 4)
        self.assertEqual(ep.loan_interest_rate, 0.065)
        self.assertEqual(ep.grace_period_months, 6)

    def test_military_profile_earns_during_service(self):
        """Nit #2: military years_in_school = service years, earns_during_school=True."""
        ep = EducationProfile(
            path_type=PathType.MILITARY,
            label="4-Year Military Enlistment",
            years_in_school=4,
            earns_during_school=True,
            annual_tuition=[0, 0, 0, 0],
            annual_room_and_board=[0, 0, 0, 0],
            total_loan_amount=0,
            grace_period_months=0,
            gi_bill_tuition_covered_annual=29_921,
            gi_bill_housing_monthly=2_338,
        )
        self.assertEqual(ep.path_type, PathType.MILITARY)
        self.assertTrue(ep.earns_during_school)
        self.assertEqual(ep.total_loan_amount, 0)
        self.assertEqual(ep.gi_bill_housing_monthly, 2_338)

    def test_workforce_profile_no_school(self):
        ep = EducationProfile(
            path_type=PathType.WORKFORCE,
            label="Direct Workforce (Retail)",
            years_in_school=0,
            earns_during_school=True,
            total_loan_amount=0,
            grace_period_months=0,
        )
        self.assertEqual(ep.years_in_school, 0)
        self.assertEqual(ep.annual_tuition, [])
        self.assertEqual(ep.annual_room_and_board, [])


class TestCareerProfile(unittest.TestCase):
    def test_basic_career_profile(self):
        income = [0.0] * 4 + [55_000 * (1.04 ** i) for i in range(28)]
        cp = CareerProfile(
            label="STEM Engineer",
            annual_income=income,
            income_start_age=22,
            starting_salary=55_000,
            salary_growth_rate=0.04,
            effective_tax_rate=0.18,
        )
        self.assertEqual(len(cp.annual_income), 32)
        self.assertEqual(cp.annual_income[0], 0.0)
        self.assertEqual(cp.annual_income[4], 55_000)
        self.assertEqual(cp.tax_exempt_years, [])

    def test_gi_bill_tax_exempt_years(self):
        """Nit #3: tax_exempt_years is a real list for projection engine to use."""
        income = [39_696, 42_780, 44_532, 49_584]  # service
        income += [28_056] * 4  # GI Bill housing (tax-exempt)
        income += [80_000 * (1.04 ** i) for i in range(24)]  # career

        cp = CareerProfile(
            label="Military -> GI Bill -> STEM",
            annual_income=income,
            income_start_age=26,
            starting_salary=80_000,
            salary_growth_rate=0.04,
            effective_tax_rate=0.18,
            tax_exempt_years=[4, 5, 6, 7],
        )
        self.assertEqual(cp.tax_exempt_years, [4, 5, 6, 7])
        self.assertEqual(len(cp.annual_income), 32)
        for yr in cp.tax_exempt_years:
            self.assertEqual(cp.annual_income[yr], 28_056)


class TestLivingProfile(unittest.TestCase):
    def test_at_home_then_independent(self):
        expenses = [800 * 12] * 2 + [2_200 * 12] * 30
        lp = LivingProfile(
            annual_expenses=expenses,
            region=Region.MIDWEST,
            at_home_years=2,
            monthly_at_home=800,
            monthly_independent=2_200,
        )
        self.assertEqual(len(lp.annual_expenses), 32)
        self.assertEqual(lp.annual_expenses[0], 9_600)
        self.assertEqual(lp.annual_expenses[2], 26_400)


# =============================================================================
# SCENARIO + SIM RESULT TESTS
# =============================================================================

class TestScenario(unittest.TestCase):
    def test_scenario_defaults(self):
        ed = EducationProfile(
            path_type=PathType.WORKFORCE, label="Direct Workforce",
            years_in_school=0, earns_during_school=True,
            total_loan_amount=0, grace_period_months=0,
        )
        career = CareerProfile(
            label="Retail",
            annual_income=[32_240 * (1.02 ** i) for i in range(32)],
            income_start_age=18, starting_salary=32_240,
            salary_growth_rate=0.02, effective_tax_rate=0.18,
        )
        living = LivingProfile(
            annual_expenses=[2_200 * 12] * 32, region=Region.MIDWEST,
            at_home_years=0, monthly_at_home=800, monthly_independent=2_200,
        )
        scenario = Scenario(
            name="Direct Workforce (Retail) — Midwest",
            path_type=PathType.WORKFORCE,
            education=ed, career=career, living=living,
        )
        self.assertEqual(scenario.savings_rate, 0.10)
        self.assertEqual(scenario.investment_return_rate, 0.07)
        self.assertEqual(scenario.start_age, 18)
        self.assertEqual(scenario.projection_years, 32)


class TestYearSnapshot(unittest.TestCase):
    def test_net_worth_is_assets_minus_debt(self):
        snap = YearSnapshot(
            year=0, age=18, gross_income=32_240, net_income=26_437,
            living_expenses=26_400, loan_payment=0, debt_remaining=5_000,
            annual_savings=4, investment_balance=10_000, net_worth=5_000,
            cumulative_earnings=32_240, cumulative_taxes=5_803,
            savings_rate_actual=0.0002,
        )
        self.assertEqual(snap.net_worth, snap.investment_balance - snap.debt_remaining)


class TestSimResult(unittest.TestCase):
    def test_sim_result_creation(self):
        ed = EducationProfile(
            path_type=PathType.WORKFORCE, label="Test",
            years_in_school=0, earns_during_school=True,
            total_loan_amount=0, grace_period_months=0,
        )
        career = CareerProfile(
            label="Test", annual_income=[30_000] * 32,
            income_start_age=18, starting_salary=30_000,
            salary_growth_rate=0.02, effective_tax_rate=0.18,
        )
        living = LivingProfile(
            annual_expenses=[24_000] * 32, region=Region.MIDWEST,
            at_home_years=0, monthly_at_home=800, monthly_independent=2_000,
        )
        scenario = Scenario(
            name="Test", path_type=PathType.WORKFORCE,
            education=ed, career=career, living=living,
        )
        result = SimResult(
            scenario=scenario, snapshots=[],
            total_earnings=600_000, total_loan_interest_paid=0,
            total_cost_of_education=0, year_debt_free=None,
            year_positive_net_worth=18, net_worth_at_25=10_000,
            net_worth_at_30=50_000, net_worth_at_38=120_000,
            net_worth_at_50=350_000, debt_burden_ratio=0.0,
        )
        self.assertIsNone(result.year_debt_free)
        self.assertEqual(result.debt_burden_ratio, 0.0)


if __name__ == "__main__":
    unittest.main()
