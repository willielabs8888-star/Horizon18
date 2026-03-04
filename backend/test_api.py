"""
Quick API test — runs the simulate endpoint logic directly (no HTTP server needed).

Usage:
    cd HS_Grad_Financial_Sim
    python3 backend/test_api.py
"""

from __future__ import annotations

import sys
import os
import json

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.api import handle_simulate


def test_demo_2_paths():
    """Test with 2 paths: College STEM + Trade Electrician."""
    print("\n--- Test 1: 2 paths (College STEM + Trade Electrician) ---")

    request = {
        "selected_paths": ["college", "trade"],
        "region": "midwest",
        "living_at_home": True,
        "years_at_home": 2,
        "family_savings": 0,
        "projection_years": 32,
        "college": {
            "school_type": "public_in_state",
            "major": "stem",
        },
        "trade": {
            "trade_type": "electrician",
        },
    }

    result = handle_simulate(request)
    assert result["status"] == 200, f"Expected 200, got {result['status']}: {result['body']}"

    body = result["body"]
    assert body["paths_compared"] == 2
    assert body["projection_years"] == 32
    assert len(body["results"]) == 2

    for r in body["results"]:
        assert len(r["snapshots"]) == 32, f"Expected 32 snapshots, got {len(r['snapshots'])}"
        assert r["scenario"]["path_type"] in ("college", "trade")
        assert r["summary"]["total_earnings"] > 0

        # Check snapshot structure
        snap = r["snapshots"][0]
        assert "age" in snap
        assert "net_worth" in snap
        assert "cumulative_earnings" in snap
        assert snap["age"] == 18

    print(f"  PASS: {body['paths_compared']} paths, {len(body['results'][0]['snapshots'])} years each")
    for r in body["results"]:
        name = r["scenario"]["name"]
        final_nw = r["snapshots"][-1]["net_worth"]
        print(f"  {name}: final net worth = ${final_nw:,.0f}")


def test_all_5_paths():
    """Test with all 5 paths (demo mode equivalent)."""
    print("\n--- Test 2: All 5 paths (demo equivalent) ---")

    request = {
        "selected_paths": ["college", "cc_transfer", "trade", "workforce", "military"],
        "region": "midwest",
        "living_at_home": True,
        "years_at_home": 2,
        "family_savings": 0,
        "projection_years": 32,
        "college": {"school_type": "public_in_state", "major": "stem"},
        "community_college": {"transfer_university_type": "public_in_state", "major": "business"},
        "trade": {"trade_type": "electrician"},
        "workforce": {"industry": "admin"},
        "military": {"enlistment_years": 4, "use_gi_bill": True, "gi_bill_major": "stem"},
    }

    result = handle_simulate(request)
    assert result["status"] == 200, f"Expected 200, got {result['status']}: {result['body']}"

    body = result["body"]
    assert body["paths_compared"] == 5

    print(f"  PASS: {body['paths_compared']} paths compared")
    for r in body["results"]:
        name = r["scenario"]["name"]
        final_nw = r["snapshots"][-1]["net_worth"]
        debt_free = r["summary"]["year_debt_free"]
        print(f"  {name}: final NW = ${final_nw:,.0f}, debt-free at age {debt_free}")


def test_variable_timeline():
    """Test with non-default projection years."""
    print("\n--- Test 3: Variable timeline (15 years) ---")

    request = {
        "selected_paths": ["college", "workforce"],
        "projection_years": 15,
        "college": {"major": "stem"},
        "workforce": {"industry": "retail"},
    }

    result = handle_simulate(request)
    assert result["status"] == 200

    body = result["body"]
    assert body["projection_years"] == 15
    assert len(body["results"][0]["snapshots"]) == 15

    print(f"  PASS: {body['projection_years']}-year projection, {len(body['results'][0]['snapshots'])} snapshots")


def test_validation_errors():
    """Test error handling."""
    print("\n--- Test 4: Validation errors ---")

    # Empty paths
    result = handle_simulate({"selected_paths": []})
    assert result["status"] == 422
    print(f"  PASS: Empty paths → {result['status']}")

    # Invalid path type
    result = handle_simulate({"selected_paths": ["invalid_path"]})
    assert result["status"] == 422
    print(f"  PASS: Invalid path → {result['status']}")

    # Invalid region
    result = handle_simulate({"selected_paths": ["college"], "region": "mars"})
    assert result["status"] == 422
    print(f"  PASS: Invalid region → {result['status']}")

    # Missing body
    result = handle_simulate({})
    assert result["status"] == 422
    print(f"  PASS: Missing body → {result['status']}")


def test_json_serializable():
    """Ensure response is fully JSON-serializable."""
    print("\n--- Test 5: JSON serialization ---")

    request = {
        "selected_paths": ["college"],
        "college": {"major": "stem"},
    }

    result = handle_simulate(request)
    assert result["status"] == 200

    # This will throw if any value isn't JSON-serializable
    json_str = json.dumps(result["body"])
    assert len(json_str) > 1000  # Sanity check — response should be substantial

    print(f"  PASS: Response serializes to {len(json_str):,} bytes of JSON")


# =============================================================================
# MULTI-INSTANCE TESTS
# =============================================================================

def test_multi_instance_two_colleges():
    """Test multi-instance: 2 different college configs."""
    print("\n--- Test 6: Multi-instance — 2 colleges ---")

    request = {
        "path_instances": [
            {
                "instance_id": "college_0",
                "path_type": "college",
                "school_type": "public_in_state",
                "major": "stem",
            },
            {
                "instance_id": "college_1",
                "path_type": "college",
                "school_type": "private",
                "major": "liberal_arts",
            },
        ],
        "region": "midwest",
        "living_at_home": True,
        "years_at_home": 2,
        "family_savings": 0,
        "projection_years": 32,
    }

    result = handle_simulate(request)
    assert result["status"] == 200, f"Expected 200, got {result['status']}: {result['body']}"

    body = result["body"]
    assert body["paths_compared"] == 2

    # Both should be "college" type but with different instance IDs
    ids = [r["scenario"]["instance_id"] for r in body["results"]]
    assert "college_0" in ids, f"Missing college_0 in {ids}"
    assert "college_1" in ids, f"Missing college_1 in {ids}"

    # Both path_type should be "college"
    types = [r["scenario"]["path_type"] for r in body["results"]]
    assert all(t == "college" for t in types), f"Expected all college, got {types}"

    # Net worths should differ (public in-state STEM vs private liberal arts)
    nw0 = body["results"][0]["snapshots"][-1]["net_worth"]
    nw1 = body["results"][1]["snapshots"][-1]["net_worth"]
    assert nw0 != nw1, f"Expected different net worths but both are {nw0}"

    print(f"  PASS: 2 college instances with distinct results")
    for r in body["results"]:
        name = r["scenario"]["name"]
        iid = r["scenario"]["instance_id"]
        final_nw = r["snapshots"][-1]["net_worth"]
        print(f"  [{iid}] {name}: final net worth = ${final_nw:,.0f}")


def test_multi_instance_mixed():
    """Test multi-instance: college + 2 trades."""
    print("\n--- Test 7: Multi-instance — college + 2 trades ---")

    request = {
        "path_instances": [
            {
                "instance_id": "college_0",
                "path_type": "college",
                "school_type": "public_in_state",
                "major": "stem",
            },
            {
                "instance_id": "trade_0",
                "path_type": "trade",
                "trade_type": "electrician",
            },
            {
                "instance_id": "trade_1",
                "path_type": "trade",
                "trade_type": "plumber",
            },
        ],
        "region": "west_coast",
        "projection_years": 25,
    }

    result = handle_simulate(request)
    assert result["status"] == 200, f"Expected 200, got {result['status']}: {result['body']}"

    body = result["body"]
    assert body["paths_compared"] == 3
    assert body["projection_years"] == 25

    ids = {r["scenario"]["instance_id"] for r in body["results"]}
    assert ids == {"college_0", "trade_0", "trade_1"}, f"Unexpected IDs: {ids}"

    # Verify snapshots are correct length
    for r in body["results"]:
        assert len(r["snapshots"]) == 25

    print(f"  PASS: 3 instances (1 college, 2 trades), 25-year projection")
    for r in body["results"]:
        iid = r["scenario"]["instance_id"]
        name = r["scenario"]["name"]
        final_nw = r["snapshots"][-1]["net_worth"]
        print(f"  [{iid}] {name}: final NW = ${final_nw:,.0f}")


def test_multi_instance_backward_compat():
    """Verify legacy format still works when path_instances is absent."""
    print("\n--- Test 8: Backward compat (legacy format) ---")

    # Same as test_demo_2_paths — should produce identical results
    request = {
        "selected_paths": ["college", "trade"],
        "region": "midwest",
        "college": {"school_type": "public_in_state", "major": "stem"},
        "trade": {"trade_type": "electrician"},
    }

    result = handle_simulate(request)
    assert result["status"] == 200
    body = result["body"]
    assert body["paths_compared"] == 2

    # Legacy format should have empty instance_id
    for r in body["results"]:
        assert r["scenario"]["instance_id"] == "", \
            f"Legacy results should have empty instance_id, got '{r['scenario']['instance_id']}'"

    print(f"  PASS: Legacy format works, instance_id is empty string")


def test_multi_instance_max_5():
    """Verify max 5 instances enforced."""
    print("\n--- Test 9: Max 5 instances ---")

    request = {
        "path_instances": [
            {"instance_id": f"college_{i}", "path_type": "college", "major": "stem"}
            for i in range(6)
        ],
        "region": "midwest",
    }

    result = handle_simulate(request)
    assert result["status"] == 422, f"Expected 422, got {result['status']}"
    assert "Maximum 5" in result["body"]["error"]

    print(f"  PASS: 6 instances → 422")


def test_financial_overrides():
    """Test that financial assumption overrides affect results."""
    print("\n--- Test 10: Financial overrides ---")

    base_request = {
        "path_instances": [
            {"instance_id": "college_0", "path_type": "college", "school_type": "public_in_state", "major": "stem"},
        ],
        "region": "midwest",
        "projection_years": 20,
    }

    # Run with defaults
    result_default = handle_simulate(base_request)
    assert result_default["status"] == 200
    nw_default = result_default["body"]["results"][0]["snapshots"][-1]["net_worth"]

    # Run with custom overrides
    override_request = {
        **base_request,
        "savings_rate": 0.20,
        "investment_return_rate": 0.09,
        "tax_rate": 0.15,
    }
    result_override = handle_simulate(override_request)
    assert result_override["status"] == 200
    nw_override = result_override["body"]["results"][0]["snapshots"][-1]["net_worth"]

    # Higher savings + higher return + lower tax should produce higher net worth
    assert nw_override > nw_default, \
        f"Expected overrides to increase net worth: default={nw_default}, override={nw_override}"

    # Verify the scenario reflects the overrides
    scenario = result_override["body"]["results"][0]["scenario"]
    assert scenario["savings_rate"] == 0.20, f"Expected 0.20, got {scenario['savings_rate']}"
    assert scenario["investment_return_rate"] == 0.09, f"Expected 0.09, got {scenario['investment_return_rate']}"

    print(f"  PASS: Overrides applied (default NW=${nw_default:,.0f}, override NW=${nw_override:,.0f})")


def test_financial_override_validation():
    """Test that out-of-range financial overrides are rejected."""
    print("\n--- Test 11: Financial override validation ---")

    base = {
        "path_instances": [
            {"instance_id": "college_0", "path_type": "college", "major": "stem"},
        ],
        "region": "midwest",
    }

    # Savings rate too high
    result = handle_simulate({**base, "savings_rate": 0.50})
    assert result["status"] == 422, f"Expected 422 for savings_rate=0.50, got {result['status']}"
    print(f"  PASS: savings_rate=0.50 → 422")

    # Investment return too low
    result = handle_simulate({**base, "investment_return_rate": 0.01})
    assert result["status"] == 422, f"Expected 422 for investment_return_rate=0.01, got {result['status']}"
    print(f"  PASS: investment_return_rate=0.01 → 422")

    # Tax rate too high
    result = handle_simulate({**base, "tax_rate": 0.60})
    assert result["status"] == 422, f"Expected 422 for tax_rate=0.60, got {result['status']}"
    print(f"  PASS: tax_rate=0.60 → 422")

    # Valid overrides should work
    result = handle_simulate({**base, "savings_rate": 0.15, "investment_return_rate": 0.06, "tax_rate": 0.25})
    assert result["status"] == 200, f"Expected 200, got {result['status']}: {result['body']}"
    print(f"  PASS: valid overrides → 200")


if __name__ == "__main__":
    print("=" * 60)
    print("  API Unit Tests (no server required)")
    print("=" * 60)

    # Legacy tests
    test_demo_2_paths()
    test_all_5_paths()
    test_variable_timeline()
    test_validation_errors()
    test_json_serializable()

    # Multi-instance tests
    test_multi_instance_two_colleges()
    test_multi_instance_mixed()
    test_multi_instance_backward_compat()
    test_multi_instance_max_5()

    # Financial override tests
    test_financial_overrides()
    test_financial_override_validation()

    print("\n" + "=" * 60)
    print("  ALL TESTS PASSED")
    print("=" * 60)
