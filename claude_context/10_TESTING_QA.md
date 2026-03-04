# Testing & QA

## Test Suite: 105 tests, all passing
Run with: `python3 run_tests.py` (uses unittest, no pip dependencies needed)

## Engine Tests (96 tests)
- **test_data_models.py** — Enum coverage, quiz answer defaults, engine output shapes, scenario defaults, snapshot math
- **test_defaults.py** — All 7 defaults modules: value ranges, cross-module consistency, locked values ($85k healthcare, 7% return, 2% CC discount)
- **test_loan.py** — Monthly payment calculation, interest accrual, year-by-year amortization, edge cases (zero balance, full payoff)
- **test_integration.py** — End-to-end pipeline for all 5 path types: quiz → builder → engines → projection → SimResult. Tests include region effects, family savings impact, 5-path comparison, cumulative field verification.

## API Tests (9 tests)
- **backend/test_api.py** — HTTP server validation
  - POST /api/simulate with valid quiz JSON
  - GET /api/options returns all enums
  - Error handling (malformed JSON, missing fields)
  - Multi-instance simulation requests
  - Response schema validation

## Key Assertions
- PathType enum has exactly 5 members, str-comparable
- All trades have 4-year apprentice wage arrays that increase each year
- Journeyman salary > final apprentice wage for all trades
- STEM salary > Liberal Arts salary over same horizon
- CC transfer has less debt than direct college (same major)
- Workforce and military paths have $0 loan amount
- Military GI Bill path has non-empty tax_exempt_years list
- Region affects both income and expenses (Northeast > Southeast)
- Family savings reduces loan amount
- Snapshot count matches projection_years (32 by default)

## Spot-Check Validation
The demo output should produce results that pass a common-sense check:
- College STEM should have the highest 32-year earnings (~$3.8M)
- Electrician should have the highest net worth at age 38 (early saver advantage)
- College STEM should lead net worth by age 50 (compounding + salary growth)
- Direct workforce should have the lowest 32-year earnings and end net worth
- Military + GI Bill should have $0 debt and strong positioning
