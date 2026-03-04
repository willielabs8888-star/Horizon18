
# Architecture Proposal — V0 Rev 2: Guided Life-Path Comparison Tool

**Date:** 2026-03-01
**Status:** DRAFT — Awaiting Will's review
**Supersedes:** ARCHITECTURE_V0.md (Rev 1)

---

## 0. WHAT CHANGED FROM REV 1

Rev 1 was a simulation engine with JSON configs. You'd write a JSON file, run
a command, get a graph. That's an engineer's tool.

Rev 2 is a **guided decision tool**. The student answers 3–5 questions per path,
the system builds the scenario automatically from intelligent defaults, and the
output is an immediate visual comparison. The simulation engine is still there
underneath, but now there's a whole new layer on top: the quiz, the defaults
database, and the scenario builder.

The key architectural insight: **the quiz is a config generator.** Quiz answers
+ defaults database = complete LifePath configs. The simulation engine never
changes — it always takes LifePath configs in and produces SimResults out. What
changes is how those configs get created.

```
┌─────────────────────────────────────────────────────────┐
│                    USER LAYER                            │
│                                                          │
│  Step 1: "Which paths?"  →  Multi-select from 5 paths   │
│  Step 2: Path questions  →  3-5 questions per path       │
│  Step 3: Shared questions → Living situation, region      │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │ Quiz Answers (structured dict)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  SCENARIO BUILDER                         │
│                                                          │
│  quiz_answers + defaults_db → LifePath configs           │
│                                                          │
│  Components:                                             │
│    defaults/     → Tuition, salary, wage, COL tables     │
│    builder.py    → Maps answers to configs               │
│    multipliers.py → Region + school type adjustments     │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │ List[LifePath] (2-5 complete configs)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 SIMULATION ENGINE                         │
│  (unchanged from Rev 1)                                  │
│                                                          │
│  model/                                                  │
│    loan_engine.py                                        │
│    income_engine.py                                      │
│    expense_engine.py                                     │
│    projection.py                                         │
│    metrics.py                                            │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │ List[SimResult] (year-by-year snapshots + metrics)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   OUTPUT LAYER                            │
│                                                          │
│  outputs/                                                │
│    render_charts.py  → matplotlib comparison charts       │
│    render_tables.py  → Terminal + CSV comparison tables   │
│    render_summary.py → Plain-English takeaway text        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 1. FOLDER STRUCTURE

```
HS_Grad_Financial_Sim/
│
├── model/                          # SIMULATION ENGINE (pure math)
│   ├── __init__.py
│   ├── data_models.py              # Dataclasses: LifePath, YearSnapshot, SimResult
│   ├── loan_engine.py              # Amortization, interest accrual, grace periods
│   ├── income_engine.py            # Salary growth, apprentice ramps, military pay
│   ├── expense_engine.py           # Living costs by situation
│   ├── projection.py               # Year-by-year simulation loop
│   └── metrics.py                  # Derived summary metrics
│
├── defaults/                       # INTELLIGENT DEFAULTS DATABASE
│   ├── __init__.py
│   ├── tuition.py                  # Tuition by school type
│   ├── salaries.py                 # Starting salary by major/field
│   ├── trades.py                   # Apprentice wage ramps by trade
│   ├── military.py                 # Enlisted pay scales, BAH, GI Bill
│   ├── workforce.py                # Entry-level wages by sector
│   ├── regions.py                  # COL multipliers + salary multipliers
│   └── living.py                   # Baseline living expense profiles
│
├── quiz/                           # QUIZ ENGINE (input collection)
│   ├── __init__.py
│   ├── flow.py                     # Quiz orchestrator (manages path-specific blocks)
│   ├── questions.py                # Question definitions (text, options, defaults)
│   ├── blocks/                     # Path-specific question blocks
│   │   ├── __init__.py
│   │   ├── college.py              # 4-year university questions
│   │   ├── community_college.py    # CC + transfer questions
│   │   ├── trade.py                # Trade/apprenticeship questions
│   │   ├── workforce.py            # Direct workforce questions
│   │   └── military.py             # Military enlistment questions
│   └── shared.py                   # Cross-path questions (region, living, etc.)
│
├── builder/                        # SCENARIO BUILDER (quiz → config)
│   ├── __init__.py
│   ├── scenario_builder.py         # Master builder: answers + defaults → LifePath
│   ├── college_builder.py          # College-specific config assembly
│   ├── trade_builder.py            # Trade-specific config assembly
│   ├── military_builder.py         # Military-specific config assembly
│   ├── workforce_builder.py        # Workforce-specific config assembly
│   └── multipliers.py              # Region/school-type adjustment functions
│
├── outputs/                        # VISUALIZATION + REPORTING
│   ├── __init__.py
│   ├── render_charts.py            # matplotlib comparison charts
│   ├── render_tables.py            # Terminal + CSV tables
│   ├── render_summary.py           # Plain-English comparison narrative
│   └── runs/                       # Generated output per run
│       └── <timestamp>/
│           ├── comparison_networth.png
│           ├── comparison_debt.png
│           ├── comparison_income.png
│           ├── summary_table.csv
│           └── summary.txt
│
├── scenarios/                      # PRE-BUILT SCENARIO TEMPLATES
│   ├── templates/                  # JSON templates for direct use (bypass quiz)
│   │   ├── four_year_public_stem.json
│   │   ├── four_year_public_liberal_arts.json
│   │   ├── four_year_private_business.json
│   │   ├── community_college_transfer.json
│   │   ├── electrician_apprentice.json
│   │   ├── plumber_apprentice.json
│   │   ├── direct_workforce_retail.json
│   │   ├── direct_workforce_manufacturing.json
│   │   └── military_enlistment_gi_bill.json
│   └── schema.json
│
├── cli.py                          # CLI entrypoint (Click)
├── compare.py                      # Multi-path comparison orchestrator
├── requirements.txt
│
└── tests/
    ├── test_loan_engine.py
    ├── test_income_engine.py
    ├── test_expense_engine.py
    ├── test_projection.py
    ├── test_defaults.py
    ├── test_builder.py
    └── test_quiz_to_config.py
```

---

## 2. REVISED DATA MODEL

### 2.1 Quiz Answers (what comes out of the quiz)

This is the intermediate data structure — it's NOT the LifePath config yet.
The scenario builder transforms this into a LifePath.

```python
@dataclass
class QuizAnswers:
    """Raw answers from the student quiz. Sparse — most fields are Optional."""

    # Step 1: Which paths are they comparing?
    selected_paths: list[str]       # e.g. ["college", "trade", "military"]

    # Shared questions (asked once regardless of paths)
    region: str = "midwest"         # northeast, southeast, midwest, southwest, west_coast
    living_at_home_during_school: bool = True
    years_living_at_home: int = 2
    family_savings_for_education: float = 0.0

    # College-specific (None if not selected)
    college: CollegeAnswers | None = None

    # Community College-specific
    community_college: CommunityCollegeAnswers | None = None

    # Trade-specific
    trade: TradeAnswers | None = None

    # Workforce-specific
    workforce: WorkforceAnswers | None = None

    # Military-specific
    military: MilitaryAnswers | None = None


@dataclass
class CollegeAnswers:
    school_type: str = "public_in_state"  # public_in_state, public_oos, private
    school_name: str | None = None         # Optional — for future lookup
    major_field: str = "undecided"         # stem, business, healthcare, liberal_arts, education, undecided
    expects_part_time_work: bool = True
    part_time_annual_income: float = 8000  # Default: ~15hrs/wk during school year


@dataclass
class CommunityCollegeAnswers:
    transfer_to_university: bool = True
    university_type_after: str = "public_in_state"  # For years 3-4
    major_field: str = "undecided"
    expects_part_time_work: bool = True
    part_time_annual_income: float = 10000  # Can work more at CC


@dataclass
class TradeAnswers:
    trade_type: str = "electrician"   # electrician, plumber, hvac, carpenter
    path_type: str = "apprenticeship" # apprenticeship, trade_school
    # No salary question — we look it up from defaults


@dataclass
class WorkforceAnswers:
    industry: str = "retail"          # retail, logistics, admin, manufacturing, food_service
    known_starting_wage: float | None = None  # Override if they know it


@dataclass
class MilitaryAnswers:
    branch: str | None = None         # Optional — doesn't affect pay much at E1-E4
    enlistment_years: int = 4         # Standard initial contract
    use_gi_bill_after: bool = True    # Toggle GI Bill for post-service education
    gi_bill_school_type: str = "public_in_state"  # What they'd attend after service
    gi_bill_major: str = "undecided"
```

### 2.2 LifePath Config (what the simulation engine consumes)

Unchanged from Rev 1, but I'm including it here for completeness:

```python
@dataclass
class EducationConfig:
    path_type: str                  # "university" | "community_college" | "trade" | "workforce" | "military"
    path_label: str                 # Human-readable display name
    tuition_per_year: float
    years_in_school: int
    room_and_board_annual: float
    has_loan: bool
    loan_amount: float
    loan_interest_rate: float
    loan_term_years: int
    grace_period_months: int


@dataclass
class IncomeConfig:
    starting_salary: float
    salary_growth_rate: float
    income_delay_years: int         # Years before full-time income starts
    part_time_income_during_school: float

    # Trade-specific: explicit year-by-year apprentice wages
    apprentice_wages: list[float]   # e.g. [35000, 42000, 49000, 56000] — empty if N/A

    # Military-specific: year-by-year base pay + BAH
    military_annual_comp: list[float]  # e.g. [39696, 42780, 44532, 49584] — empty if N/A
    post_service_starting_salary: float  # If using GI Bill, salary after degree


@dataclass
class LivingConfig:
    living_at_home_during_school: bool
    monthly_expenses_at_home: float
    monthly_expenses_independent: float
    years_living_at_home: int


@dataclass
class FinancialConfig:
    savings_rate: float
    investment_return_rate: float
    effective_tax_rate: float


@dataclass
class LifePath:
    name: str
    education: EducationConfig
    income: IncomeConfig
    living: LivingConfig
    financial: FinancialConfig
    start_age: int = 18
    projection_years: int = 20
```

### 2.3 YearSnapshot + SimResult (unchanged from Rev 1)

```python
@dataclass
class YearSnapshot:
    year: int
    age: int
    phase: str                      # "school" | "grace" | "apprentice" | "service" | "working"
    gross_income: float
    net_income: float
    living_expenses: float
    loan_payment: float
    debt_remaining: float
    annual_savings: float
    cumulative_savings: float
    investment_balance: float
    net_worth: float


@dataclass
class SimResult:
    path: LifePath
    snapshots: list[YearSnapshot]

    # Summary metrics
    total_earnings_20yr: float
    total_loan_interest_paid: float
    total_cost_of_education: float
    year_debt_free: int | None
    year_positive_net_worth: int | None
    net_worth_at_25: float
    net_worth_at_30: float
    net_worth_at_38: float
    debt_burden_ratio: float        # Peak (annual_loan_payment / net_income)
```

---

## 3. THE DEFAULTS DATABASE

This is the heart of the "intelligent defaults" strategy. Each module is a
simple Python file with dictionaries — no database, no API calls.

### defaults/tuition.py
```python
TUITION_ANNUAL = {
    "public_in_state":     11_371,
    "public_out_of_state": 25_415,
    "private":             44_961,
    "community_college":    3_890,
}

ROOM_AND_BOARD_ANNUAL = {
    "on_campus":     12_000,
    "off_campus":     9_600,
    "at_home":        2_400,   # Food + transport contribution
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
STARTING_SALARY_BY_MAJOR = {
    "stem":          80_000,   # Blended engineering + CS average
    "business":      65_276,
    "healthcare":    70_000,   # Nursing entry, conservative
    "liberal_arts":  39_349,
    "education":     44_860,
    "undecided":     52_000,
}

# Annual salary growth rates by field
SALARY_GROWTH_RATE = {
    "stem":          0.040,    # Tech/engineering grows faster early career
    "business":      0.035,
    "healthcare":    0.030,
    "liberal_arts":  0.025,
    "education":     0.020,    # Teacher pay grows slowly
    "undecided":     0.030,
    "trade":         0.025,
    "workforce":     0.020,
}
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
# Annual total compensation (base pay + BAH without dependents)
ENLISTED_ANNUAL_COMP = {
    "year_1": 25_296 + (1_200 * 12),   # E-1 base + BAH = $39,696
    "year_2": 28_380 + (1_200 * 12),   # E-2 = $42,780
    "year_3": 30_132 + (1_200 * 12),   # E-3 = $44,532
    "year_4": 34_584 + (1_250 * 12),   # E-4 = $49,584
}

# Military living expenses are heavily subsidized
MILITARY_MONTHLY_EXPENSES = 400  # Phone, car insurance, personal — most is covered

GI_BILL = {
    "annual_tuition_cap": 29_921,
    "monthly_housing": 2_338,
    "annual_books": 1_000,
    "months_of_benefits": 36,   # 36 months = full 4-year degree coverage
}
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
# Applied to BOTH salary and living expenses
REGION_MULTIPLIERS = {
    "northeast":        {"salary": 1.15, "cost_of_living": 1.25},
    "west_coast":       {"salary": 1.12, "cost_of_living": 1.15},
    "pacific_northwest":{"salary": 1.05, "cost_of_living": 1.08},
    "midwest":          {"salary": 0.95, "cost_of_living": 0.90},
    "southwest":        {"salary": 0.97, "cost_of_living": 0.95},
    "southeast":        {"salary": 0.90, "cost_of_living": 0.87},
}
```

### defaults/living.py
```python
MONTHLY_EXPENSES = {
    "at_home":       800,    # Contribution to family + personal costs
    "independent":  2_200,   # Rent, food, utilities, transport, insurance, phone
}

STANDARD_FINANCIAL = {
    "savings_rate":           0.10,
    "investment_return_rate": 0.06,
    "effective_tax_rate":     0.18,
    "loan_interest_rate":     0.065,
    "loan_term_years":        10,
    "grace_period_months":    6,
}
```

---

## 4. SCENARIO BUILDER — THE MAPPING LOGIC

This is the critical new component. It transforms quiz answers + defaults into
complete LifePath configs.

### How it works for each path:

**College Path:**
```
quiz.college.school_type  →  lookup TUITION_ANNUAL[school_type]
quiz.college.major_field  →  lookup STARTING_SALARY_BY_MAJOR[major]
quiz.region               →  lookup REGION_MULTIPLIERS[region]

tuition = TUITION_ANNUAL[school_type]
salary  = STARTING_SALARY_BY_MAJOR[major] * REGION_MULTIPLIERS[region].salary
expenses = MONTHLY_EXPENSES[situation] * REGION_MULTIPLIERS[region].cost_of_living

total_cost = (tuition * 4) + (room_and_board * 4)
loan_amount = total_cost - family_savings
if loan_amount < 0: loan_amount = 0

→ Produces a complete LifePath with EducationConfig, IncomeConfig, etc.
```

**Trade Path:**
```
quiz.trade.trade_type     →  lookup APPRENTICE_WAGES[trade]
                          →  lookup JOURNEYMAN_SALARY[trade]
                          →  lookup TRADE_SCHOOL_TOTAL[trade]
quiz.region               →  apply multipliers to wages

loan_amount = TRADE_SCHOOL_TOTAL[trade]  # Typically small
apprentice_wages = [w * region_mult for w in APPRENTICE_WAGES[trade]]
starting_salary = JOURNEYMAN_SALARY[trade] * region_mult

→ LifePath with income_delay_years=0, apprentice_wages filled
```

**Military Path:**
```
enlistment_comp = [ENLISTED_ANNUAL_COMP[f"year_{i}"] for i in 1..4]
living_expenses_during_service = MILITARY_MONTHLY_EXPENSES * 12

if use_gi_bill_after:
    # Model a second phase: 4 years of GI Bill funded education
    # Then career start at age 26 instead of 22
    post_service_salary = STARTING_SALARY_BY_MAJOR[gi_bill_major] * region_mult
else:
    # Transition directly to civilian workforce
    post_service_salary = ENTRY_WAGES["admin"] * region_mult  # Veteran premium

→ LifePath with military_annual_comp filled, two-phase career
```

**Workforce Path:**
```
quiz.workforce.industry   →  lookup ENTRY_WAGES[industry]
quiz.region               →  apply salary multiplier

starting_salary = ENTRY_WAGES[industry] * region_mult
OR if known_starting_wage provided: starting_salary = known_starting_wage

→ Simplest LifePath: no education, no loans, immediate income
```

**Community College + Transfer:**
```
tuition_years_1_2 = TUITION_ANNUAL["community_college"] * 2
tuition_years_3_4 = TUITION_ANNUAL[university_type_after] * 2
total_tuition = tuition_years_1_2 + tuition_years_3_4

loan_amount = total_tuition + (room_and_board * 4) - family_savings
salary = STARTING_SALARY_BY_MAJOR[major] * region_mult * 0.97
    # 3% discount: same degree, slightly less network/prestige effect
    # This is debatable — flag for Will to review

→ Similar to college path but with split tuition and reduced loans
```

---

## 5. QUIZ FLOW STRUCTURE

### The Complete Question Sequence

```
STEP 1 — PATH SELECTION (always asked)
─────────────────────────────────────
Q: "Which paths are you deciding between?" (multi-select)
   □ 4-Year College
   □ Community College + Transfer to University
   □ Trade School / Apprenticeship
   □ Direct Workforce
   □ Military (Enlistment)

STEP 2 — SHARED QUESTIONS (always asked)
────────────────────────────────────────
Q1: "What part of the country do you expect to live in?"
    ○ Northeast (NY, MA, CT, NJ)
    ○ Southeast (FL, GA, TN, NC, SC)
    ○ Midwest (OH, IL, MI, IN, MO)
    ○ Southwest (TX, AZ, NM)
    ○ West Coast (CA, WA, OR)
    Default: Midwest

Q2: "Will you be living at home after high school?"
    ○ Yes, for a while
    ○ No, moving out right away
    Default: Yes

    If yes → Q2b: "For roughly how many years?"
    ○ 1 year  ○ 2 years  ○ 3+ years
    Default: 2

Q3: "Does your family have savings set aside for education?"
    ○ None / not sure
    ○ Under $5,000
    ○ $5,000 – $15,000
    ○ $15,000 – $30,000
    ○ $30,000+
    Default: None

STEP 3 — PATH-SPECIFIC BLOCKS (only for selected paths)
────────────────────────────────────────────────────────

IF "4-Year College" selected:
  C1: "What type of school are you considering?"
      ○ Public university (in-state)
      ○ Public university (out-of-state)
      ○ Private university
      ○ Not sure yet
      Default: Public in-state

  C2: "What do you want to study?"
      ○ STEM (engineering, computer science, math)
      ○ Business / Finance
      ○ Healthcare / Nursing
      ○ Liberal Arts / Humanities
      ○ Education / Teaching
      ○ Undecided
      Default: Undecided

  C3: "Do you plan to work part-time during school?"
      ○ Yes  ○ No
      Default: Yes


IF "Community College + Transfer" selected:
  CC1: "What type of university would you transfer to?"
       ○ Public (in-state)
       ○ Public (out-of-state)
       ○ Private
       Default: Public in-state

  CC2: "What do you want to study?"
       (Same options as C2)
       Default: Undecided

  CC3: "Do you plan to work during community college?"
       ○ Yes  ○ No
       Default: Yes


IF "Trade / Apprenticeship" selected:
  T1: "Which trade are you interested in?"
      ○ Electrician
      ○ Plumbing
      ○ HVAC
      ○ Carpentry
      Default: Electrician

  T2: "Are you entering a formal apprenticeship or trade school?"
      ○ Apprenticeship (earn while you learn)
      ○ Trade school program
      Default: Apprenticeship


IF "Direct Workforce" selected:
  W1: "What kind of work are you looking at?"
      ○ Retail / Customer service
      ○ Warehouse / Logistics
      ○ Office / Administrative
      ○ Manufacturing / Production
      ○ Food service / Hospitality
      Default: Retail

  W2: "Do you know your expected starting pay?" (optional)
      [text input or skip]
      Default: Looked up from industry


IF "Military" selected:
  M1: "Do you plan to use the GI Bill for college after service?"
      ○ Yes  ○ No  ○ Not sure (model both?)
      Default: Yes

  IF yes:
    M2: "What would you study after service?"
        (Same major options as C2)
        Default: Undecided
```

### Question Count Per Path
- Shared: 3 questions (always)
- College: 3 questions
- CC + Transfer: 3 questions
- Trade: 2 questions
- Workforce: 1–2 questions
- Military: 1–2 questions

**Maximum total for a student comparing all 5 paths: 3 + 3 + 3 + 2 + 2 + 2 = 15 questions.**
**Typical comparison (2 paths): 3 + 3 + 2 = 8 questions. Under 2 minutes.**

---

## 6. MILITARY PATH — FULL MODEL

The military path is the most nuanced because it has TWO phases: active duty,
then civilian life (with optional GI Bill education).

### Phase 1: Active Duty (4 years, age 18–22)

```
Year 1 (E-1): $39,696 total comp (base + BAH)
Year 2 (E-2): $42,780
Year 3 (E-3): $44,532
Year 4 (E-4): $49,584

Living expenses during service: ~$400/month ($4,800/year)
   - Housing is covered (barracks or BAH)
   - Food is covered (BAS or DFAC)
   - Healthcare is covered (Tricare)
   - Remaining: phone, car, personal

Debt: $0
Savings potential: HIGH — this is the military's hidden financial advantage
```

### Phase 2a: GI Bill Path (age 22–26)

If `use_gi_bill_after = True`:
```
Tuition: Covered (up to $29,921/yr for private, unlimited for public)
Monthly housing allowance: ~$2,338/month
Books: $1,000/year

The student is essentially PAID to go to college with zero debt.
Starting salary after GI Bill degree: STARTING_SALARY_BY_MAJOR[major]
Income starts at age 26.
```

### Phase 2b: Direct Civilian Path (age 22+)

If `use_gi_bill_after = False`:
```
Transition to civilian workforce.
Veterans get a hiring advantage — model as a 10% salary premium over
equivalent non-degree workforce entry.

Starting salary: ENTRY_WAGES[industry] * 1.10
Income starts at age 22.
```

### Why the Military Path is Interesting

It's the only path where the student:
- Has nearly zero expenses for 4 years (massive savings potential)
- Accumulates zero debt
- Can THEN get a free college degree via GI Bill

The 20-year net worth graph for military + GI Bill often looks the best of all
paths because of the 4-year head start on savings combined with a debt-free degree.
This is important for students to see — especially those who haven't considered
military as a financial strategy.

---

## 7. PROJECTION ALGORITHM — REVISED FOR ALL 5 PATHS

```
For each year (0 to projection_years):

  1. DETERMINE PHASE
     ├─ College/CC:     year < years_in_school → "school"
     │                  year < school + grace_months/12 → "grace"
     │                  else → "working"
     │
     ├─ Trade:          year < apprentice_years → "apprentice"
     │                  else → "working" (as journeyman)
     │
     ├─ Workforce:      all years → "working"
     │
     └─ Military:       year < enlistment_years → "service"
                        if gi_bill: year < enlistment + 4 → "gi_bill_school"
                        else → "working"

  2. CALCULATE INCOME
     ├─ "school":       part_time_income (if working during school)
     ├─ "grace":        job search period — model as 6 months partial income
     ├─ "apprentice":   apprentice_wages[year] (from defaults)
     ├─ "service":      military_annual_comp[year] (from defaults)
     ├─ "gi_bill_school": GI Bill housing allowance (~$28k/yr, not taxable)
     ├─ "working":      starting_salary * (1 + growth_rate) ^ years_working
     │
     Apply effective_tax_rate to taxable income
     (Military comp partially tax-exempt; GI Bill fully tax-exempt)

  3. CALCULATE EXPENSES
     ├─ "service":      minimal ($4,800/yr)
     ├─ "school" + at_home: $800/mo * 12
     ├─ "school" + independent: $2,200/mo * 12 (adjusted by region)
     ├─ all other:      independent living expenses * region multiplier
     │
     Note: No inflation in V0 per Will's spec

  4. ACCUMULATE / PAY DEBT
     ├─ "school":       debt += tuition_per_year (if not covered by savings/GI Bill)
     │                  interest accrues on existing debt
     ├─ "grace":        interest accrues, no payments
     ├─ "working":      standard amortization payment
     │                  M = P * [r(1+r)^n] / [(1+r)^n - 1]
     ├─ "service/gi_bill": no debt accumulation, no payments needed

  5. CALCULATE SAVINGS
     disposable = net_income - expenses - loan_payment
     if disposable > 0:
         new_savings = disposable * savings_rate
         spending_money = disposable * (1 - savings_rate)
     else:
         new_savings = 0
         deficit tracked (important for "stress" metric)

  6. GROW INVESTMENTS
     investment_balance = (prev_balance * (1 + return_rate)) + new_savings

  7. NET WORTH
     net_worth = investment_balance - debt_remaining

  8. RECORD SNAPSHOT
```

---

## 8. OUTPUT DESIGN

### Chart 1: Net Worth Over Time (THE HERO CHART)
- X-axis: Age (18 to 38)
- Y-axis: Net worth ($)
- One colored line per selected path
- Horizontal dashed line at $0 (the "break even" line)
- Clear labels: "Age 25: Electrician +$78k, University -$12k"

### Chart 2: Debt Remaining Over Time
- Shows only paths with debt
- Highlights when each path becomes debt-free
- Visceral visual: "You'll be paying off loans until age 32"

### Chart 3: Income Trajectory
- Shows earning power over time
- Makes the college "crossover point" visible
- Where does the degree salary overtake the trade salary? (if ever)

### Summary Table
```
                    University    CC+Transfer   Electrician   Military+GI   Workforce
                    (STEM)        (Business)    (Apprentice)  (STEM)        (Admin)
─────────────────────────────────────────────────────────────────────────────────────
Education Cost      $45,484       $30,522       $14,640       $0            $0
Loan Amount         $45,484       $30,522       $14,640       $0            $0
Total Interest Paid $15,200       $9,800        $2,100        $0            $0
Year Debt-Free      Age 32        Age 29        Age 22        Age 18        Age 18
Year Net Worth > 0  Age 27        Age 25        Age 21        Age 19        Age 19
Net Worth at 25     -$8,000       $12,000       $52,000       $85,000       $18,000
Net Worth at 30     $95,000       $82,000       $105,000      $155,000      $42,000
Net Worth at 38     $310,000      $265,000      $240,000      $380,000      $135,000
20-Year Earnings    $1,150,000    $950,000      $1,020,000    $1,180,000    $650,000
Peak Debt Burden    28%           22%           8%            0%            0%
```

### Plain-English Summary (auto-generated)
```
"Based on your inputs, here's what the numbers suggest:

The MILITARY + GI BILL path produces the strongest financial position by age 38,
reaching approximately $380,000 in net worth — largely because you'd accumulate
savings during service and graduate college debt-free.

The 4-YEAR UNIVERSITY (STEM) path starts in the deepest hole (-$45k in debt)
but the higher earning potential in STEM fields means it catches up around age 28
and finishes strong at ~$310,000.

The ELECTRICIAN APPRENTICESHIP path is the fastest to positive net worth (age 21)
because you're earning real money from day one with minimal debt.

The DIRECT WORKFORCE path avoids all debt but has a lower earnings ceiling,
reaching ~$135,000 by age 38.

Remember: these are projections based on averages. Your actual results will depend
on your specific choices, effort, and circumstances."
```

---

## 9. CLI MODES

Two ways to run the tool:

### Mode 1: Guided Quiz
```bash
python cli.py quiz
```
Launches the interactive questionnaire. Asks the questions defined in Section 5.
Builds scenarios automatically. Generates output.

### Mode 2: Direct Comparison (power user / testing)
```bash
python cli.py compare \
  --scenarios scenarios/templates/four_year_public_stem.json \
               scenarios/templates/electrician_apprentice.json \
               scenarios/templates/military_enlistment_gi_bill.json \
  --output outputs/runs/
```
Bypasses the quiz entirely. Uses pre-built JSON templates.

Both modes produce the same output format.

---

## 10. REVISED PHASE PLAN (14 Days)

### Phase 1 — Engine + Defaults (Days 1–4)
- Day 1: Data models + defaults database (all 7 defaults modules)
- Day 2: Loan engine + income engine + expense engine + tests
- Day 3: Projection engine + metrics + integration tests for all 5 path types
- Day 4: Scenario builder (quiz answers → LifePath mapping) + builder tests

Deliverable: `python cli.py compare` works with JSON templates for all 5 paths.

### Phase 2 — Quiz + Templates (Days 5–8)
- Day 5: Quiz engine (question definitions + flow orchestrator)
- Day 6: CLI quiz mode (interactive questionnaire using `questionary` library)
- Day 7: All 9 JSON scenario templates built with realistic defaults
- Day 8: End-to-end testing: quiz → build → simulate → output

Deliverable: `python cli.py quiz` walks through questions and produces comparison.

### Phase 3 — Visualization + Polish (Days 9–14)
- Day 9-10: Chart rendering (net worth, debt, income — all three charts)
- Day 11: Summary table + plain-English narrative generator
- Day 12: Regional multiplier validation + edge case testing
- Day 13: "What-if" slider logic (adjust loan/salary/growth and re-simulate)
- Day 14: Final polish, cleanup, documentation

Deliverable: Complete V0 student-facing comparison tool.

---

## 11. KEY DESIGN DECISIONS

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Quiz generates configs, engine stays config-driven | Clean separation. Web app replaces quiz with a form, engine never changes. |
| 2 | Defaults are plain Python dicts, not a database | Simple, version-controlled, easy to update. No infrastructure overhead. |
| 3 | Military modeled as two-phase (service + civilian) | Only accurate way to capture the GI Bill advantage. |
| 4 | CC+Transfer gets 3% salary discount vs same-major university | Debatable but directionally fair. Easy to remove if Will disagrees. |
| 5 | Region multiplier applied to BOTH salary and expenses | Higher COL areas pay more but cost more. Net effect is nuanced. |
| 6 | No inflation in V0 | Per Will's spec. Simplifies the model. Risk: 20-year numbers look optimistic since expenses don't grow. |
| 7 | GI Bill housing allowance modeled as non-taxable income | Matches reality. Makes military + GI Bill path look strong, which it genuinely is. |
| 8 | Five paths, not four | Military is too important to omit. It's a real option for many HS grads and financially unique. |
| 9 | `questionary` library for CLI quiz | Clean multi-select, radio buttons, etc. in terminal. Lightweight, no web server needed. |
| 10 | Annual granularity, loan math uses monthly internally | Best of both worlds: simple yearly output but accurate amortization. |

---

## 12. OPEN QUESTIONS FOR WILL

1. **CC + Transfer salary discount (3%)?**
   I modeled a small discount because CC transfers sometimes face a minor
   hiring-perception gap. But this is debatable and potentially unfair to model.
   Should I keep it, increase it, or remove it?

2. **Military: model both GI Bill and non-GI-Bill as separate lines?**
   When a student selects Military, should we show one line (based on their
   GI Bill choice) or two lines (both options) so they can see the difference?

3. **"Not sure yet" for school type?**
   If they pick "Not sure" for college type, I default to public in-state.
   Is that the right default?

4. **Part-time income during school — $8k default?**
   This assumes ~15 hours/week at $12/hr during the school year. Does that
   feel right? Some students work significantly more.

5. **Healthcare starting salary: $70k or $100k?**
   The BLS says RN starting is ~$100k, but that feels high for a new grad in
   many markets. I went conservative at $70k in the defaults module. Your call.

6. **Investment returns: 6% or 7%?**
   6% is conservative (roughly stocks minus inflation). 7% is closer to
   historical nominal returns on a 60/40 portfolio. For a tool targeting
   teenagers, I lean conservative so we don't oversell investing.

---

## NEXT ACTIONS

1. **Will reviews this document** — especially Sections 5 (quiz flow),
   6 (military model), and 12 (open questions)
2. **Will answers the 6 open questions** above
3. **Green light → I build Day 1** (data models + all 7 defaults modules)
