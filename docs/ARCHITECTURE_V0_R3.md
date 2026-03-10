
# Horizon18 — Architecture V0 Rev 3: Three-Engine Composition Model

**Date:** 2026-03-01
**Status:** APPROVED AND IMPLEMENTED — All engines, models, and output layers built and tested (96 tests passing)
**Supersedes:** ARCHITECTURE_V0_R2.md

---

## 0. WHAT CHANGED FROM REV 2

Rev 2 had path-specific builders: `college_builder.py`, `trade_builder.py`, etc.
Each builder was a monolithic function that assembled a complete LifePath from
quiz answers. This works but creates duplication — every builder reimplements
expense logic, savings logic, and investment logic.

Rev 3 decomposes the model into **three independent engines** that get composed
together per scenario:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  EDUCATION COST  │  │  CAREER INCOME   │  │  LIVING EXPENSE  │
│     ENGINE       │  │     ENGINE       │  │     ENGINE       │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ Tuition          │  │ Field template   │  │ Region multiplier│
│ Scholarships     │  │ Wage ramp curve  │  │ At-home toggle   │
│ Years in school  │  │ Salary growth    │  │ Baseline expenses│
│ Loan financing   │  │ Income delay     │  │                  │
│ School-period    │  │ Tax rate         │  │                  │
│   living costs   │  │                  │  │                  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         └─────────────┬───────┘──────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   PROJECTION   │
              │     ENGINE     │
              │                │
              │ Year-by-year   │
              │ simulation     │
              │ loop           │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │    METRICS     │
              │                │
              │ Net worth      │
              │ Debt timeline  │
              │ Earnings total │
              │ Break-even age │
              └────────────────┘
```

**Why this matters:** A "Military + GI Bill → STEM career" scenario is now just
a composition of a Military education config + a STEM career template + a
regional living profile. No dedicated military builder needed — it's the same
three engines with different inputs. This also means adding a new path type
later (gap year, certificate program, etc.) only requires adding new templates
to the existing engines, not building a whole new pipeline.

---

## 1. RESOLVED DECISIONS

All open questions from Rev 2 are now locked:

| # | Question | Decision | Value |
|---|----------|----------|-------|
| 1 | CC transfer salary discount | Yes, small | 2% discount vs same-major 4-year grad |
| 2 | Military GI Bill display | One line with toggle | Single path; GI Bill on/off changes the config |
| 3 | Healthcare starting salary | Balanced | $85,000 |
| 4 | Investment return rate | Slightly optimistic | 7% annual |
| 5 | "Not sure" school type default | Public in-state | Unchanged |
| 6 | Part-time income during school | $8,000 default | Unchanged |

Additional constraints confirmed:
- No inflation in V0 (results are nominal dollars)
- No gap year logic
- No Monte Carlo
- No monthly granularity in output
- No graduate degrees
- No union dues or licensing cost modeling for trades

---

## 2. SYSTEM ARCHITECTURE

```
HS_Grad_Financial_Sim/
│
├── engines/                        # THE THREE CORE ENGINES
│   ├── __init__.py
│   ├── education.py                # Education Cost Engine
│   ├── career.py                   # Career Income Engine
│   └── living.py                   # Living Expense Engine
│
├── model/                          # SIMULATION CORE
│   ├── __init__.py
│   ├── data_models.py              # All dataclasses
│   ├── loan.py                     # Loan amortization math
│   ├── projection.py               # Year-by-year simulation loop
│   └── metrics.py                  # Derived summary metrics
│
├── defaults/                       # CENTRALIZED DEFAULTS DATABASE
│   ├── __init__.py                 # Re-exports everything for easy access
│   ├── tuition.py                  # Tuition by school type
│   ├── salaries.py                 # Starting salary by major/field
│   ├── trades.py                   # Apprentice wage ramps by trade
│   ├── military.py                 # Enlisted pay, BAH, GI Bill
│   ├── workforce.py                # Entry-level wages by sector
│   ├── regions.py                  # COL + salary multipliers
│   └── financial.py                # Savings rate, return rate, tax rate, loan terms
│
├── quiz/                           # QUIZ ENGINE
│   ├── __init__.py
│   ├── flow.py                     # Orchestrator: manages question sequence
│   ├── questions.py                # Question definitions (text, options, defaults)
│   ├── blocks/                     # Path-specific question modules
│   │   ├── __init__.py
│   │   ├── college.py
│   │   ├── community_college.py
│   │   ├── trade.py
│   │   ├── workforce.py
│   │   └── military.py
│   └── shared.py                   # Cross-path questions (region, housing, savings)
│
├── builder/                        # SCENARIO BUILDER (quiz → engine configs)
│   ├── __init__.py
│   └── builder.py                  # Maps quiz answers → engine config triplets
│
├── outputs/                        # VISUALIZATION + REPORTING
│   ├── __init__.py
│   ├── charts.py                   # matplotlib comparison charts
│   ├── tables.py                   # Terminal + CSV summary tables
│   ├── narrative.py                # Plain-English takeaway generator
│   └── runs/                       # Output directory per run
│
├── scenarios/                      # PRE-BUILT TEMPLATES (bypass quiz)
│   └── templates/
│       ├── college_public_stem.json
│       ├── college_public_business.json
│       ├── college_public_healthcare.json
│       ├── college_public_liberal_arts.json
│       ├── college_private_stem.json
│       ├── cc_transfer_public_stem.json
│       ├── cc_transfer_public_business.json
│       ├── trade_electrician.json
│       ├── trade_plumber.json
│       ├── trade_hvac.json
│       ├── trade_carpenter.json
│       ├── workforce_retail.json
│       ├── workforce_manufacturing.json
│       ├── workforce_admin.json
│       ├── military_gi_bill_stem.json
│       ├── military_gi_bill_business.json
│       └── military_no_gi_bill.json
│
├── cli.py                          # Click CLI: `quiz` and `compare` modes
├── requirements.txt
│
└── tests/
    ├── test_engines/
    │   ├── test_education.py
    │   ├── test_career.py
    │   └── test_living.py
    ├── test_loan.py
    ├── test_projection.py
    ├── test_builder.py
    └── test_integration.py
```

---

## 3. THE THREE ENGINES — DETAILED DESIGN

### 3.1 Education Cost Engine (`engines/education.py`)

**Purpose:** Given a student's education choices, compute the year-by-year cost
structure: what they owe, when they owe it, and what financing looks like.

**Input: EducationProfile**

```python
@dataclass
class EducationProfile:
    """Output of the Education Cost Engine. Fully describes the cost side
    of an education path."""

    path_type: str              # "university" | "cc_transfer" | "trade" | "workforce" | "military"
    label: str                  # "4-Year Public University (STEM)"
    years_in_school: int        # 0 for workforce, 4 for college, 4 for military service
    earns_during_school: bool   # True for trade apprentices and military

    # Cost breakdown
    annual_tuition: list[float] # Per-year tuition [11371, 11371, 11371, 11371]
                                # CC+transfer: [3890, 3890, 11371, 11371]
                                # Trade: [3660, 0, 0, 0] (one-time spread)
                                # Military/workforce: [0, 0, 0, 0]

    annual_room_and_board: list[float]  # Per-year, varies by living situation
                                        # At home: [2400, 2400, 2400, 2400]
                                        # Military: [0, 0, 0, 0]

    # Loan structure
    total_loan_amount: float    # Auto-calculated: sum(tuition) + sum(R&B) - savings
    loan_interest_rate: float   # Default 6.5%
    loan_term_years: int        # Default 10
    grace_period_months: int    # Default 6 (0 for trade/military)

    # GI Bill offset (military only)
    gi_bill_tuition_covered: float  # Annual tuition covered post-service
    gi_bill_housing_monthly: float  # Monthly housing stipend during school
```

**Key behaviors:**
- `annual_tuition` is a LIST, not a single value. This handles CC+transfer
  (cheap years then expensive years) cleanly.
- `total_loan_amount` is auto-derived: `sum(tuition) + sum(room_and_board) - family_savings`.
  If negative (savings exceed costs), loan is $0.
- Military service period has $0 tuition and $0 room/board (covered by DoD).
- GI Bill fields are only populated for military paths with `use_gi_bill=True`.

**Engine function:**
```python
def build_education_profile(
    path_type: str,
    school_type: str | None,      # "public_in_state", "private", etc.
    major: str | None,
    trade_type: str | None,
    use_gi_bill: bool,
    gi_bill_school_type: str | None,
    family_savings: float,
    living_at_home: bool,
    region: str,
) -> EducationProfile:
    """Pure function. Looks up defaults, applies multipliers, returns profile."""
```

### 3.2 Career Income Engine (`engines/career.py`)

**Purpose:** Given a student's career path, compute the year-by-year income
trajectory from age 18 to 38.

**Input: CareerProfile**

```python
@dataclass
class CareerProfile:
    """Output of the Career Income Engine. Fully describes the income side."""

    label: str                      # "STEM Engineer" or "Electrician (Journeyman)"

    # Year-by-year gross income (length = projection_years)
    # This is the MASTER income array. The projection engine just reads from it.
    annual_income: list[float]      # [0, 0, 0, 0, 55000, 56925, ...] (32 values)

    # Metadata for display
    income_start_age: int           # Age when meaningful income begins
    starting_salary: float          # First full-time salary
    salary_growth_rate: float       # For display/sliders
    effective_tax_rate: float       # Simplified flat rate
```

**Key insight:** The `annual_income` array is pre-computed by the engine. The
projection loop doesn't need to know whether someone is an apprentice, a student
with a part-time job, or active duty military. It just reads `annual_income[year]`.
This is what makes engine composition work — the career engine handles all the
complexity of wage ramps, delays, and phase transitions internally.

**Part-time income during school:** During school years, net part-time income is
applied toward tuition + room & board costs first (reducing the amount borrowed).
Only income remaining after school costs are satisfied flows into the normal
savings/investment pipeline. This is handled in `projection.py` — income is
calculated before school costs so the offset can be applied.

**Grace period income:** College and CC paths use `GRACE_PERIOD_MONTHS / 12`
to compute the fraction of first-year salary earned during the grace period
(6 months = 50%). This is parameterized — if `GRACE_PERIOD_MONTHS` changes
in `defaults/financial.py`, the income fraction updates automatically.

**GI Bill school years:** Derived from `GI_BILL["months_of_benefits"] // 9`
(36 months / 9 months per academic year = 4 years). Auto-updates if VA
changes benefit duration.

**How the array gets built for each path type:**

```
4-Year College (STEM, public in-state, Midwest):
  Year 0-3 (age 18-21): $8,000/yr (part-time work during school)
  Year 4 (age 22):      $0 (grace period / job search — half year, simplified to $27,500)
  Year 5 (age 23):      $76,000 (starting STEM salary * 0.95 midwest multiplier)
  Year 6-19:            $76,000 * 1.04^n (4% STEM growth)

CC + Transfer (Business, public in-state, Midwest):
  Year 0-3 (age 18-21): $10,000/yr (can work more hours at CC)
  Year 4 (age 22):      $0 (grace period, simplified to half starting)
  Year 5 (age 23):      $60,619 (business salary * 0.95 midwest * 0.98 CC discount)
  Year 6-19:            growth at 3.5%

Electrician Apprenticeship (Midwest):
  Year 0 (age 18):      $33,250 (apprentice Y1 * 0.95 midwest)
  Year 1 (age 19):      $39,900 (apprentice Y2 * 0.95)
  Year 2 (age 20):      $46,550 (apprentice Y3 * 0.95)
  Year 3 (age 21):      $53,200 (apprentice Y4 * 0.95)
  Year 4 (age 22):      $64,420 (journeyman * 0.95)
  Year 5-19:            $64,420 * 1.025^n (2.5% trade growth)

Military (4yr enlistment, GI Bill → STEM, Midwest):
  Year 0 (age 18):      $39,696 (E-1 base + BAH)
  Year 1 (age 19):      $42,780 (E-2)
  Year 2 (age 20):      $44,532 (E-3)
  Year 3 (age 21):      $49,584 (E-4)
  Year 4-7 (age 22-25): $28,056/yr (GI Bill housing allowance, tax-free)
  Year 8 (age 26):      $76,000 (STEM salary, post-GI Bill degree)
  Year 9-19:            $76,000 * 1.04^n

Military (no GI Bill, → civilian workforce, Midwest):
  Year 0-3 (age 18-21): Military pay ramp (same as above)
  Year 4 (age 22):      Entry wage for user-selected industry * metro mult * 1.10 veteran premium
                         Example (Admin): $35,419 * 0.95 * 1.10 = $37,013
  Year 5-19:            Starting salary * 1.005^n (workforce growth rate)
  Note: civilian_industry field on MilitaryAnswers controls which industry.
        Default is ADMIN (backward compatible). Users select in quiz when use_gi_bill=False.

Direct Workforce (Retail, Midwest):
  Year 0 (age 18):      $30,628 (retail wage * 0.95 midwest)
  Year 1-19:            $30,628 * 1.02^n (2% workforce growth)
```

**Engine function:**
```python
def build_career_profile(
    path_type: str,
    major: str | None,
    trade_type: str | None,
    industry: str | None,
    known_starting_wage: float | None,
    use_gi_bill: bool,
    gi_bill_major: str | None,
    enlistment_years: int,
    part_time_during_school: bool,
    part_time_income: float,
    years_in_school: int,
    grace_period_months: int,
    region: str,
    cc_transfer: bool,
    projection_years: int = 32,
) -> CareerProfile:
    """Pure function. Builds the complete annual_income array."""
```

### 3.3 Living Expense Engine (`engines/living.py`)

**Purpose:** Given a student's living situation and region, compute year-by-year
living expenses.

**Input: LivingProfile**

```python
@dataclass
class LivingProfile:
    """Output of the Living Expense Engine."""

    # Year-by-year expenses (length = projection_years)
    annual_expenses: list[float]    # [9600, 9600, 26400, 26400, ...] (32 values)

    # Metadata
    region: str
    at_home_years: int
    monthly_at_home: float
    monthly_independent: float
```

**How the array gets built:**

```
Living at home for 2 years, Midwest:
  Year 0-1: $800/mo * 12 * 0.90 midwest = $8,640/yr
  Year 2-19: $2,200/mo * 12 * 0.90 midwest = $23,760/yr

Military (during service):
  Year 0-3: $400/mo * 12 = $4,800/yr (most expenses covered)
  Year 4+: normal civilian expenses by region

Not living at home, West Coast:
  Year 0-19: $2,200/mo * 12 * 1.15 west_coast = $30,360/yr
```

**Engine function:**
```python
def build_living_profile(
    path_type: str,
    living_at_home: bool,
    years_at_home: int,
    region: str,
    is_military_service: bool,
    service_years: int,
    projection_years: int = 32,
) -> LivingProfile:
    """Pure function. Builds the complete annual_expenses array."""
```

---

## 4. ENGINE COMPOSITION — HOW SCENARIOS GET BUILT

The scenario builder is now dead simple. It doesn't contain path-specific logic.
It just calls the three engines and bundles the results.

```python
@dataclass
class Scenario:
    """A complete scenario ready for projection. This is the composition of
    all three engine outputs plus shared financial parameters."""

    name: str                       # "4-Year Public University (STEM) — Midwest"
    path_type: str
    education: EducationProfile
    career: CareerProfile
    living: LivingProfile

    # Shared financial parameters (from defaults, adjustable via sliders)
    savings_rate: float             # Default: 0.10
    investment_return_rate: float   # Default: 0.07
    start_age: int                  # Default: 18
    projection_years: int           # Default: 20
```

**The builder function:**

```python
def build_scenario(quiz_answers: QuizAnswers, path: str) -> Scenario:
    """
    Takes quiz answers for ONE selected path and produces a Scenario.

    This is the only place where quiz answers are transformed into
    engine inputs. Each engine is called independently.
    """

    education = build_education_profile(
        path_type=path,
        school_type=quiz_answers.college.school_type if path == "college" else ...,
        major=...,
        trade_type=...,
        use_gi_bill=...,
        family_savings=quiz_answers.family_savings,
        living_at_home=quiz_answers.living_at_home,
        region=quiz_answers.region,
    )

    career = build_career_profile(
        path_type=path,
        major=...,
        trade_type=...,
        industry=...,
        years_in_school=education.years_in_school,
        grace_period_months=education.grace_period_months,
        region=quiz_answers.region,
        cc_transfer=(path == "cc_transfer"),
        ...
    )

    living = build_living_profile(
        path_type=path,
        living_at_home=quiz_answers.living_at_home,
        years_at_home=quiz_answers.years_at_home,
        region=quiz_answers.region,
        is_military_service=(path == "military"),
        service_years=4 if path == "military" else 0,
    )

    return Scenario(
        name=f"{education.label} — {quiz_answers.region.title()}",
        path_type=path,
        education=education,
        career=career,
        living=living,
        savings_rate=DEFAULTS.savings_rate,
        investment_return_rate=DEFAULTS.investment_return_rate,
    )


def build_all_scenarios(quiz_answers: QuizAnswers) -> list[Scenario]:
    """Build one Scenario per selected path."""
    return [build_scenario(quiz_answers, path) for path in quiz_answers.selected_paths]
```

**Why this is better than Rev 2:**
- No `college_builder.py`, `trade_builder.py`, `military_builder.py` — ONE builder
  that dispatches to three engines.
- Adding a new path (gap year, certificate, etc.) means adding templates to the
  existing engines, not a new builder file.
- Each engine is independently testable with known inputs → known outputs.
- Sliders on the results page just modify engine outputs and re-run projection.

---

## 5. PROJECTION ENGINE — SIMPLIFIED

Because the three engines pre-compute year-by-year arrays, the projection loop
is now remarkably simple. It doesn't need to know about school phases, apprentice
ramps, or military service. It just reads arrays.

```python
def run_projection(scenario: Scenario) -> SimResult:
    """
    Core simulation loop. Reads pre-computed arrays from the three engines
    and simulates savings, investment growth, and loan paydown.
    """

    snapshots = []
    debt = scenario.education.total_loan_amount
    investment_balance = 0.0
    loan_payments_started = False
    monthly_rate = scenario.education.loan_interest_rate / 12
    loan_term_months = scenario.education.loan_term_years * 12

    for year in range(scenario.projection_years):
        age = scenario.start_age + year

        # --- READ FROM ENGINES (no logic needed) ---
        gross_income = scenario.career.annual_income[year]
        expenses = scenario.living.annual_expenses[year]

        # --- TAX ---
        net_income = gross_income * (1 - scenario.career.effective_tax_rate)
        # GI Bill housing allowance is tax-free (handled in career engine
        # by not applying tax rate to those years — flagged in CareerProfile)

        # --- LOAN PAYMENT ---
        loan_payment = 0.0
        interest_this_year = 0.0

        if debt > 0:
            school_done = year >= scenario.education.years_in_school
            grace_done = year >= (scenario.education.years_in_school
                         + scenario.education.grace_period_months / 12)

            if not school_done:
                # Interest accrues during school (unsubsidized)
                interest_this_year = debt * scenario.education.loan_interest_rate
                debt += interest_this_year

            elif not grace_done:
                # Grace period: interest accrues, no payment
                interest_this_year = debt * scenario.education.loan_interest_rate
                debt += interest_this_year

            else:
                # Repayment phase: standard amortization
                if not loan_payments_started:
                    loan_payments_started = True
                    # Recalculate monthly payment based on current balance
                    monthly_payment = calculate_monthly_payment(
                        debt, monthly_rate, loan_term_months
                    )

                annual_payment = monthly_payment * 12
                interest_this_year = debt * scenario.education.loan_interest_rate
                principal_paid = annual_payment - interest_this_year

                if principal_paid > debt:
                    # Final payment — pay off remainder
                    loan_payment = debt + interest_this_year
                    debt = 0.0
                else:
                    loan_payment = annual_payment
                    debt -= principal_paid

        # --- SAVINGS + INVESTMENT ---
        disposable = net_income - expenses - loan_payment
        new_savings = max(0, disposable * scenario.savings_rate)
        investment_balance = (investment_balance
                              * (1 + scenario.investment_return_rate)
                              + new_savings)

        # --- NET WORTH ---
        net_worth = investment_balance - debt

        snapshots.append(YearSnapshot(
            year=year,
            age=age,
            gross_income=round(gross_income),
            net_income=round(net_income),
            living_expenses=round(expenses),
            loan_payment=round(loan_payment),
            debt_remaining=round(max(0, debt)),
            annual_savings=round(new_savings),
            investment_balance=round(investment_balance),
            net_worth=round(net_worth),
        ))

    return SimResult(
        scenario=scenario,
        snapshots=snapshots,
        **compute_summary_metrics(snapshots, scenario),
    )
```

**What's clean about this:**
- No `if path_type == "military"` anywhere in the projection loop.
- No phase detection logic (school vs grace vs working) for income or expenses.
- The engines already handled all of that when building the arrays.
- Loan logic is the only phase-aware piece, and that's inherent to how loans
  work — it can't be pre-computed because it depends on the running balance.

---

## 6. DATA MODELS — COMPLETE

```python
# --- Quiz layer ---

@dataclass
class CollegeAnswers:
    school_type: str = "public_in_state"
    major: str = "undecided"
    part_time_work: bool = True
    part_time_income: float = 8_000

@dataclass
class CommunityCollegeAnswers:
    transfer_university_type: str = "public_in_state"
    major: str = "undecided"
    part_time_work: bool = True
    part_time_income: float = 10_000

@dataclass
class TradeAnswers:
    trade_type: str = "electrician"
    entry_path: str = "apprenticeship"   # "apprenticeship" | "trade_school"

@dataclass
class WorkforceAnswers:
    industry: str = "retail"
    known_starting_wage: float | None = None

@dataclass
class MilitaryAnswers:
    enlistment_years: int = 4
    use_gi_bill: bool = True
    gi_bill_major: str = "undecided"

@dataclass
class QuizAnswers:
    selected_paths: list[str]           # ["college", "trade", "military"]
    region: str = "midwest"
    living_at_home: bool = True
    years_at_home: int = 2
    family_savings: float = 0.0

    college: CollegeAnswers | None = None
    community_college: CommunityCollegeAnswers | None = None
    trade: TradeAnswers | None = None
    workforce: WorkforceAnswers | None = None
    military: MilitaryAnswers | None = None


# --- Engine outputs ---

@dataclass
class EducationProfile:
    path_type: str
    label: str
    years_in_school: int
    earns_during_school: bool
    annual_tuition: list[float]
    annual_room_and_board: list[float]
    total_loan_amount: float
    loan_interest_rate: float
    loan_term_years: int
    grace_period_months: int
    gi_bill_tuition_covered: float = 0.0
    gi_bill_housing_monthly: float = 0.0

@dataclass
class CareerProfile:
    label: str
    annual_income: list[float]          # Pre-computed, length = projection_years
    income_start_age: int
    starting_salary: float
    salary_growth_rate: float
    effective_tax_rate: float
    tax_exempt_years: list[int] = field(default_factory=list)
        # Years where income is tax-exempt (GI Bill housing allowance)

@dataclass
class LivingProfile:
    annual_expenses: list[float]        # Pre-computed, length = projection_years
    region: str
    at_home_years: int
    monthly_at_home: float
    monthly_independent: float


# --- Simulation I/O ---

@dataclass
class Scenario:
    name: str
    path_type: str
    education: EducationProfile
    career: CareerProfile
    living: LivingProfile
    savings_rate: float = 0.10
    investment_return_rate: float = 0.07
    start_age: int = 18
    projection_years: int = 32

@dataclass
class YearSnapshot:
    year: int
    age: int
    gross_income: float
    net_income: float
    living_expenses: float
    loan_payment: float
    debt_remaining: float
    annual_savings: float
    investment_balance: float
    net_worth: float
    # Cumulative tracking (powers web hover tooltips + extra charts)
    cumulative_earnings: float
    cumulative_taxes: float
    savings_rate_actual: float

@dataclass
class SimResult:
    scenario: Scenario
    snapshots: list[YearSnapshot]
    total_earnings: float               # Timeline-agnostic (was total_earnings_20yr)
    total_loan_interest_paid: float
    total_cost_of_education: float
    year_debt_free: int | None          # Age
    year_positive_net_worth: int | None # Age
    net_worth_milestones: dict[int, float]  # Adaptive: {age: net_worth}
    net_worth_at_25: float              # Legacy convenience accessors
    net_worth_at_30: float
    net_worth_at_38: float
    net_worth_at_50: float
    debt_burden_ratio: float            # Peak (annual_loan_payment / net_income)
```

---

## 7. DEFAULTS MODULE — CENTRALIZED

All defaults live in `defaults/` and are re-exported from `defaults/__init__.py`
for easy import: `from defaults import TUITION, SALARIES, TRADES, ...`

### defaults/tuition.py
```python
TUITION_ANNUAL = {
    "public_in_state":     11_371,
    "public_out_of_state": 25_415,
    "private":             44_961,
    "community_college":    3_890,
}

ROOM_AND_BOARD = {
    "on_campus":  12_000,
    "off_campus":  9_600,
    "at_home":     2_400,
}

TRADE_SCHOOL_TOTAL = {
    "electrician": 14_640,
    "plumber":     12_500,
    "hvac":        12_500,
    "carpenter":   12_550,
}
```

### defaults/salaries.py
```python
STARTING_SALARY = {
    "stem":          80_000,
    "business":      65_276,
    "healthcare":    85_000,     # Locked: $85k per Will's decision
    "liberal_arts":  39_349,
    "education":     44_860,
    "undecided":     52_000,
}

SALARY_GROWTH = {
    "stem":          0.040,
    "business":      0.035,
    "healthcare":    0.030,
    "liberal_arts":  0.025,
    "education":     0.020,
    "undecided":     0.030,
    "trade":         0.025,
    "workforce":     0.020,
    "military_civilian": 0.030,  # Post-service civilian growth
}

CC_TRANSFER_SALARY_DISCOUNT = 0.02  # Locked: 2% per Will's decision
```

### defaults/trades.py
```python
APPRENTICE_WAGES = {
    "electrician": [35_000, 42_000, 49_000, 56_000],
    "plumber":     [36_500, 42_000, 50_000, 57_000],
    "hvac":        [25_080, 32_000, 38_000, 43_000],
    "carpenter":   [33_000, 38_000, 45_000, 52_000],
}

JOURNEYMAN_SALARY = {
    "electrician": 67_810,
    "plumber":     64_960,
    "hvac":        54_100,
    "carpenter":   60_083,
}
```

### defaults/military.py
```python
ENLISTED_ANNUAL_COMP = [39_696, 42_780, 44_532, 49_584]
    # [E-1 base+BAH, E-2, E-3, E-4]

MILITARY_MONTHLY_EXPENSES = 400
    # Nearly everything covered; this is phone, car, personal

GI_BILL = {
    "annual_tuition_cap":    29_921,
    "monthly_housing":        2_338,
    "annual_books":           1_000,
    "months_of_benefits":        36,
}

VETERAN_HIRING_PREMIUM = 0.10
    # 10% salary boost for veterans entering civilian workforce without degree
```

### defaults/workforce.py
```python
ENTRY_WAGES = {
    "retail":         32_240,
    "logistics":      31_137,
    "food_service":   28_245,
    "admin":          35_419,
    "manufacturing":  34_320,
}
```

### defaults/regions.py
```python
REGION_MULTIPLIERS = {
    "northeast":  {"salary": 1.15, "expenses": 1.25},
    "southeast":  {"salary": 0.90, "expenses": 0.87},
    "midwest":    {"salary": 0.95, "expenses": 0.90},
    "southwest":  {"salary": 0.97, "expenses": 0.95},
    "west_coast": {"salary": 1.12, "expenses": 1.15},
}
```

### defaults/financial.py
```python
SAVINGS_RATE = 0.10
INVESTMENT_RETURN = 0.07          # Locked: 7% per Will's decision
EFFECTIVE_TAX_RATE = 0.18
LOAN_INTEREST_RATE = 0.065
LOAN_TERM_YEARS = 10
GRACE_PERIOD_MONTHS = 6
```

---

## 8. QUIZ FLOW — FINAL

Unchanged from Rev 2, included here as reference with question counts:

```
STEP 1 — PATH SELECTION (1 question, always asked)
  "Which paths are you deciding between?" → multi-select from 5

STEP 2 — SHARED (3 questions, always asked)
  Region, living-at-home, family savings

STEP 3 — PATH-SPECIFIC (only for selected paths)
  College:            3 questions (school type, major, part-time work)
  CC + Transfer:      3 questions (transfer university type, major, part-time work)
  Trade:              2 questions (which trade, apprenticeship vs school)
  Workforce:          1-2 questions (industry, optional known wage)
  Military:           1-2 questions (GI Bill toggle, post-service major if yes)

TOTAL: 4-15 questions depending on paths selected
TYPICAL (2 paths): ~8 questions, under 2 minutes
```

---

## 9. FUTURE-PROOFING: SCHOOL-LEVEL OVERRIDES

Will mentioned wanting specific school comparison later (RIT vs Syracuse vs Clarkson).
The architecture supports this cleanly:

**Current V0:** `school_type` → lookup `TUITION_ANNUAL[school_type]`

**Future V1:** Add `defaults/schools.py`:
```python
SCHOOL_OVERRIDES = {
    "rit": {"tuition": 54_518, "type": "private", "region": "northeast"},
    "syracuse": {"tuition": 59_570, "type": "private", "region": "northeast"},
    "clarkson": {"tuition": 56_346, "type": "private", "region": "northeast"},
    "suny_buffalo": {"tuition": 11_310, "type": "public_in_state", "region": "northeast"},
}
```

The education engine already accepts tuition as a parameter. School-level
lookup just becomes another source for that parameter. No engine changes needed.

Income remains tied to major, not school — which is the correct modeling
choice for V0. (School prestige effects on salary are real but hard to
quantify and politically loaded.)

---

## 10. REVISED PHASE PLAN

### Phase 1 — Engines + Core (Days 1-4)
- Day 1: All dataclasses (`data_models.py`) + all 7 defaults modules
- Day 2: Three engines (`education.py`, `career.py`, `living.py`) + engine tests
- Day 3: Loan math (`loan.py`) + projection engine (`projection.py`) + metrics
- Day 4: Scenario builder (`builder.py`) + integration tests for all 5 path types

**Day 4 deliverable:** `python cli.py compare` with JSON templates produces
correct SimResults for all 5 path types.

### Phase 2 — Quiz + Polish (Days 5-8)
- Day 5: Quiz question definitions + flow orchestrator
- Day 6: CLI quiz mode (interactive terminal using `questionary`)
- Day 7: All 17 JSON templates + edge case testing
- Day 8: End-to-end: quiz → builder → engines → projection → output

**Day 8 deliverable:** `python cli.py quiz` walks through questions, builds
scenarios, runs projections, outputs comparison.

### Phase 3 — Visualization + Output (Days 9-14)
- Day 9-10: Three charts (net worth, debt, income trajectory)
- Day 11: Summary table + plain-English narrative generator
- Day 12: Slider adjustment logic (modify engine outputs, re-run projection)
- Day 13: Regional multiplier validation + edge cases + stress testing
- Day 14: Final polish, documentation, README

**Day 14 deliverable:** Complete V0.

---

## 11. DESIGN DECISIONS — LOCKED

| # | Decision | Status |
|---|----------|--------|
| 1 | Three-engine composition (Education, Career, Living) | LOCKED |
| 2 | Pre-computed year-by-year arrays from engines | LOCKED |
| 3 | CC transfer: 2% salary discount | LOCKED |
| 4 | Military: single line, GI Bill toggle | LOCKED |
| 5 | Healthcare starting salary: $85,000 | LOCKED |
| 6 | Investment return: 7% | LOCKED |
| 7 | No inflation in V0 | LOCKED |
| 8 | Annual granularity, monthly loan math internal | LOCKED |
| 9 | 5 paths: College, CC+Transfer, Trade, Workforce, Military | LOCKED |
| 10 | Quiz-first UX, sliders only on results page | LOCKED |
| 11 | School-level tuition overrides deferred to V1 | LOCKED |
| 12 | No gap year, no grad degrees, no Monte Carlo in V0 | LOCKED |

---

## NO OPEN QUESTIONS

All decisions are resolved. Architecture has been **fully implemented and tested** (96 tests passing).

## CURRENT STATUS

- **Web app COMPLETE**: Full-stack application with interactive charts, hover tooltips, and timeline slider
- **Backend**: Python http.server (lightweight, no external dependencies)
- **Frontend**: React with responsive design and real-time interactivity
- **Testing**: 96 engine tests + 9 API tests passing
- **Multi-instance support**: Students can compare multiple scenarios per path type (up to 5 instances max)
- **Dual-format API**: Supports both legacy flat routes and new path_instances hierarchy for backward compatibility
- **All data series**: Year-by-year CSV export, adaptive milestone tracking, cumulative metrics

## SECTION 12 — MULTI-INSTANCE SUPPORT

### Design Overview
Horizon18 supports creating multiple instances within a single path type, allowing students to compare different decisions at the same life stage (e.g., "STEM @ State School vs STEM @ Private School").

### Instance ID
Each Scenario dataclass carries an `instance_id` field:
```python
@dataclass
class Scenario:
    instance_id: str = "default"  # "default", "instance_2", "instance_3", etc.
    name: str
    path_type: str
    # ... rest of fields
```

### API Format Support
Two complementary API routes exist side-by-side:

**Legacy format** (single scenario per path):
```
GET /api/paths/{path_type}/scenario
POST /api/paths/{path_type}/scenario
```

**New path_instances format** (multi-instance):
```
GET /api/paths/{path_type}/instances
GET /api/paths/{path_type}/instances/{instance_id}/scenario
POST /api/paths/{path_type}/instances
PUT /api/paths/{path_type}/instances/{instance_id}/scenario
DELETE /api/paths/{path_type}/instances/{instance_id}
```

### Constraints
- Maximum 5 instances per path type
- Instance IDs are auto-generated or user-specified (alphanumeric, max 32 chars)
- Deleting an instance removes all associated projections
- Backend maintains referential integrity: scenarios must reference valid instances

### Backward Compatibility
The legacy routes continue to work by internally mapping to a "default" instance. No breaking changes to existing integrations.

## NEXT MILESTONE

**Phase 4 — Deployment**: Production infrastructure, monitoring, and institutional partnerships.
