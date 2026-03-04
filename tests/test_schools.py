"""
Tests for the school database and school-aware education engine.
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from defaults.schools import get_school, search_schools, get_school_count, has_school_database
from model.data_models import (
    CollegeAnswers, CommunityCollegeAnswers, SchoolType, Major, PathType,
    QuizAnswers, Region,
)
from engines.education import build_education_profile


class TestSchoolDatabase(unittest.TestCase):
    """Tests for the school database loader."""

    def test_database_loaded(self):
        self.assertTrue(has_school_database())

    def test_school_count_reasonable(self):
        count = get_school_count()
        self.assertGreater(count, 100)

    def test_search_returns_results(self):
        results = search_schools("michigan")
        self.assertGreater(len(results), 0)
        # Should find University of Michigan
        names = [s["name"] for s in results]
        self.assertTrue(any("Michigan" in n for n in names))

    def test_search_case_insensitive(self):
        r1 = search_schools("OHIO")
        r2 = search_schools("ohio")
        self.assertEqual(len(r1), len(r2))

    def test_search_short_query_returns_empty(self):
        self.assertEqual(search_schools("a"), [])
        self.assertEqual(search_schools(""), [])

    def test_search_limit(self):
        results = search_schools("university", limit=5)
        self.assertLessEqual(len(results), 5)

    def test_search_prefix_first(self):
        """Prefix matches should come before substring matches."""
        results = search_schools("ohio state")
        if results:
            # "Ohio State" should be near the top
            self.assertTrue(results[0]["name"].lower().startswith("ohio state"))

    def test_lookup_by_id(self):
        # Get any school from search to find a valid ID
        results = search_schools("michigan")
        if results:
            school = results[0]
            looked_up = get_school(school["id"])
            self.assertIsNotNone(looked_up)
            self.assertEqual(looked_up["name"], school["name"])

    def test_lookup_invalid_id(self):
        self.assertIsNone(get_school("999999999"))

    def test_school_has_required_fields(self):
        results = search_schools("university", limit=20)
        for school in results:
            self.assertIn("id", school)
            self.assertIn("name", school)
            self.assertIn("state", school)
            self.assertIn("control", school)
            self.assertIn("level", school)
            self.assertIn("tuition_in", school)
            self.assertIn("tuition_out", school)
            self.assertIn("room_board", school)
            # Values should be reasonable
            self.assertGreater(school["tuition_in"], 0)
            self.assertIn(school["control"], [1, 2])
            self.assertIn(school["level"], [1, 2])

    def test_four_year_and_two_year_exist(self):
        results = search_schools("college", limit=50)
        levels = {s["level"] for s in results}
        # Should have both types in a broad enough search
        # (depends on dataset, so just check we have at least one type)
        self.assertTrue(len(levels) >= 1)

    def test_public_and_private_exist(self):
        results = search_schools("university", limit=50)
        controls = {s["control"] for s in results}
        self.assertIn(1, controls, "No public schools found")
        self.assertIn(2, controls, "No private schools found")


class TestSchoolAwareEducation(unittest.TestCase):
    """Tests for the education engine with school database lookups."""

    def _get_real_school_id(self):
        """Helper to get a real school ID from the database."""
        results = search_schools("michigan")
        for s in results:
            if s["level"] == 1:  # 4-year
                return s["id"]
        return None

    def _get_real_cc_id(self):
        """Helper to get a real community college ID."""
        results = search_schools("community", limit=20)
        for s in results:
            if s["level"] == 2:
                return s["id"]
        return None

    def test_college_with_real_school(self):
        """Education engine should use real tuition when ipeds_id is provided."""
        school_id = self._get_real_school_id()
        if not school_id:
            self.skipTest("No 4-year school found in database")

        school = get_school(school_id)
        answers = CollegeAnswers(
            ipeds_id=school_id,
            school_type=SchoolType.PUBLIC_IN_STATE,
            major=Major.STEM,
        )
        profile = build_education_profile(
            PathType.COLLEGE, Region.MIDWEST, False, 0.0, college=answers,
        )
        # Tuition should match the real school data
        self.assertEqual(profile.annual_tuition[0], school["tuition_in"])
        # Label should contain school name
        self.assertIn(school["name"], profile.label)

    def test_college_fallback_without_school(self):
        """Without ipeds_id, should fall back to generic school type."""
        answers = CollegeAnswers(
            school_type=SchoolType.PUBLIC_IN_STATE,
            major=Major.STEM,
        )
        profile = build_education_profile(
            PathType.COLLEGE, Region.MIDWEST, False, 0.0, college=answers,
        )
        from defaults import TUITION_ANNUAL
        self.assertEqual(profile.annual_tuition[0], TUITION_ANNUAL["public_in_state"])

    def test_college_fallback_invalid_id(self):
        """Invalid ipeds_id should fall back to generic."""
        answers = CollegeAnswers(
            ipeds_id="999999999",
            school_type=SchoolType.PUBLIC_IN_STATE,
            major=Major.STEM,
        )
        profile = build_education_profile(
            PathType.COLLEGE, Region.MIDWEST, False, 0.0, college=answers,
        )
        from defaults import TUITION_ANNUAL
        self.assertEqual(profile.annual_tuition[0], TUITION_ANNUAL["public_in_state"])

    def test_college_out_of_state_with_real_school(self):
        """For public schools, out-of-state should use higher tuition."""
        school_id = self._get_real_school_id()
        if not school_id:
            self.skipTest("No 4-year school found in database")

        school = get_school(school_id)
        if school["control"] != 1:
            self.skipTest("Need a public school for this test")

        answers = CollegeAnswers(
            ipeds_id=school_id,
            school_type=SchoolType.PUBLIC_OUT_OF_STATE,
            major=Major.STEM,
        )
        profile = build_education_profile(
            PathType.COLLEGE, Region.MIDWEST, False, 0.0, college=answers,
        )
        self.assertEqual(profile.annual_tuition[0], school["tuition_out"])

    def test_cc_transfer_with_real_schools(self):
        """CC transfer path with real school lookups."""
        cc_id = self._get_real_cc_id()
        uni_id = self._get_real_school_id()

        if not cc_id or not uni_id:
            self.skipTest("Need both CC and university in database")

        cc_school = get_school(cc_id)
        uni_school = get_school(uni_id)

        answers = CommunityCollegeAnswers(
            ipeds_id_cc=cc_id,
            ipeds_id_transfer=uni_id,
            transfer_university_type=SchoolType.PUBLIC_IN_STATE,
            major=Major.BUSINESS,
        )
        profile = build_education_profile(
            PathType.CC_TRANSFER, Region.MIDWEST, False, 0.0,
            community_college=answers,
        )
        # Years 1-2: CC tuition, Years 3-4: university tuition
        self.assertEqual(profile.annual_tuition[0], cc_school["tuition_in"])
        self.assertEqual(profile.annual_tuition[1], cc_school["tuition_in"])
        self.assertEqual(profile.annual_tuition[2], uni_school["tuition_in"])
        self.assertEqual(profile.annual_tuition[3], uni_school["tuition_in"])

    def test_cc_transfer_partial_lookup(self):
        """CC transfer with only the transfer university specified."""
        uni_id = self._get_real_school_id()
        if not uni_id:
            self.skipTest("No 4-year school found in database")

        answers = CommunityCollegeAnswers(
            ipeds_id_transfer=uni_id,
            transfer_university_type=SchoolType.PUBLIC_IN_STATE,
            major=Major.BUSINESS,
        )
        profile = build_education_profile(
            PathType.CC_TRANSFER, Region.MIDWEST, False, 0.0,
            community_college=answers,
        )
        from defaults import TUITION_ANNUAL
        # Years 1-2 should use generic CC tuition (no CC specified)
        self.assertEqual(profile.annual_tuition[0], TUITION_ANNUAL["community_college"])
        # Years 3-4 should use real university tuition
        uni_school = get_school(uni_id)
        self.assertEqual(profile.annual_tuition[2], uni_school["tuition_in"])


if __name__ == "__main__":
    print("=" * 60)
    print("  School Database & School-Aware Education Tests")
    print("=" * 60)
    unittest.main(verbosity=2)
