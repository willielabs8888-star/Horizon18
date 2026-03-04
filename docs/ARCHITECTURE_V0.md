
# Architecture Proposal — V0: Life-Path Financial Simulator

**Date:** 2026-03-01
**Status:** DRAFT — Awaiting Will's review before implementation
**Scope:** Phase 1 (Days 1–4) of the 14-day build plan

---

## 1. SCOPE REFINEMENT

The original project brief described a general-purpose financial simulator. We are
narrowing V0 to a **life-path decision tool** for high school seniors comparing:

1. **4-Year University** — Traditional degree, student loans, delayed income
2. **Community College + Transfer** — Lower cost entry, partial loan reduction
3. **Trade School / Apprenticeship** — Short education, wage ramp during training
4. **Direct Workforce Entry** — Immediate income, no education debt, lower ceiling

This is NOT a FIRE calculator. This is a "what do the next 20 years look like
financially depending on which door I walk through at 18?" tool.

**Key question we answer:** Given your path choice, loan amount, and expected
income — what does your net worth trajectory look like from age 18 to 38?

---

## 2. SYSTEM ARCHITECTURE

```
HS_Grad_Financial_Sim/
├── model/
│   ├── __init__.py
│   ├── data_models.py        # Dataclasses: LifePath, YearSnapshot, SimResult
│   ├── loan_engine.py        # Loan amortization + grace period logic
│   ├── income_engine.py      # Salary progression + apprentice wage ramp
│   ├── expense_engine.py     # Living costs (home vs independent)
│   ├── projection.py         # Core year-by-year simulation loop
│   └── metrics.py            # Derived metrics (time-to-zero, debt burden, etc.)
│
├── scenarios/
│   ├── templates/
│   │   ├── four_year_university.json
│   │   ├── community_college_transfer.json
│   │   ├── electrician_trade.json
│   │   └── direct_workforce.json
│   └── schema.json            # JSON schema for validation
│
├── outputs/
│   ├── render_charts.py       # matplotlib charts
│   ├── render_tables.py       # CLI + CSV summary tables
│   └── runs/                  # Generated output per run
│       └── <timestamp>/
│           ├── comparison.png
│           ├── projection.csv
│           └── summary.txt
│
├── cli.py                     # Click-based CLI entrypoint
├── compare.py                 # Multi-scenario comparison orchestrator
├── requirements.txt
└── tests/
    ├── test_loan_engine.py
    ├── test_income_engine.py
    ├── test_projection.py
    └── test_scenarios.py
```

### Design Principles Applied

- **Modular engines** — Each financial concept (loans, income, expenses) is its
  own module with pure functions. This is critical for the future web app: these
  modules become your API layer with zero refactoring.
- **JSON scenarios** — No hardcoded assumptions. Every path is defined in a
  JSON file that a user (or eventually a web form) can generate.
- **Separation of model and presentation** — The projection engine returns data.
  The output layer renders it. Swap matplotlib for a React chart later with no
  model changes.
- **Deterministic first** — No randomness in V0. Same inputs = same outputs.
  This builds trust and makes testing easy.

---

## 3. DATA MODEL

### 3.1 LifePath (the input)

This is what a single scenario looks like. One JSON file = one life path.

```python
@dataclass
class EducationConfig:
    path_type: str               # "university" | "community_college" | "trade" | "workforce"
    path_label: str              # Human-readable: "4-Year Public University"
    tuition_per_year: float      # Annual tuition cost
    years_in_school: int         # Duration of education (0 for workforce)
    room_and_board_annual: float # On-campus or near-campus housing during school
    has_loan: bool
    loan_amount: float           # Total borrowed
    loan_interest_rate: float    # Annual rate (e.g., 0.065 for 6.5%)
    loan_term_years: int         # Standard repayment period (e.g., 10)
    grace_period_months: int     # Months after graduation before payments start

@dataclass
class IncomeConfig:
    starting_salary: float       # First full-time salary after education
    salary_growth_rate: float    # Annual raise (e.g., 0.03 for 3%)
    income_delay_years: int      # Years before full income starts (= years_in_school)
    part_time_income_during_school: float  # Summer jobs, work-study, etc.
    # Trade-specific
    apprentice_year1_wage: float # Year 1 apprentice pay (0 if not applicable)
    apprentice_year2_wage: float # Year 2 (wage ramp)
    apprentice_year3_wage: float # Year 3
    apprentice_year4_wage: float # Year 4 (journeyman transition)

@dataclass
class LivingConfig:
    living_at_home_during_school: bool  # Massive cost difference
    monthly_expenses_at_home: float     # Reduced (food, transport, phone)
    monthly_expenses_independent: float # Full cost of living
    years_living_at_home: int           # How long before going independent
    expense_inflation_rate: float       # Annual increase (e.g., 0.025)

@dataclass
class FinancialConfig:
    savings_rate: float          # % of post-expense income saved/invested
    investment_return_rate: float # Conservative annual return (e.g., 0.06)
    effective_tax_rate: float    # Simplified tax (e.g., 0.22)

@dataclass
class LifePath:
    """Complete definition of one life path scenario."""
    name: str
    education: EducationConfig
    income: IncomeConfig
    living: LivingConfig
    financial: FinancialConfig
    start_age: int = 18
    projection_years: int = 20
```

### 3.2 YearSnapshot (the output per year)

```python
@dataclass
class YearSnapshot:
    year: int                    # Simulation year (0-indexed)
    age: int                     # 18, 19, 20...
    phase: str                   # "school" | "grace_period" | "working"
    gross_income: float          # Pre-tax income this year
    net_income: float            # After simplified tax
    living_expenses: float       # Cost of living this year
    loan_payment: float          # Annual loan payment (0 during school/grace)
    debt_remaining: float        # Outstanding loan balance
    annual_savings: float        # What's left after expenses + loan payment
    cumulative_savings: float    # Running total of invested savings
    investment_balance: float    # Savings + investment returns
    net_worth: float             # investment_balance - debt_remaining
```

### 3.3 SimResult (the complete output)

```python
@dataclass
class SimResult:
    path: LifePath
    snapshots: list[YearSnapshot]

    # Derived summary metrics
    total_earnings_20yr: float
    total_loan_interest_paid: float
    year_debt_free: int | None         # Age when debt hits 0
    year_positive_net_worth: int | None # Age when net worth crosses 0
    net_worth_at_age_25: float
    net_worth_at_age_30: float
    net_worth_at_age_38: float
    debt_burden_ratio: float           # Peak (loan_payment / net_income)
    total_cost_of_education: float     # Tuition + interest + opportunity cost
```

### 3.4 Why This Structure

**EducationConfig / IncomeConfig / LivingConfig / FinancialConfig** — Grouping
by domain keeps each config section easy to understand on its own. A high school
student can fill in the education section without being overwhelmed by income
growth rates.

**YearSnapshot** — Year-by-year granularity (not monthly) keeps V0 simple while
still being useful. Monthly adds complexity with minimal insight for a 20-year
horizon. We can add monthly resolution later if needed for loan amortization
detail.

**SimResult** — Pre-computed summary metrics mean the output layer doesn't need
to re-derive anything. The `snapshots` list is what powers the charts; the
summary fields are what power the comparison table.

---

## 4. CORE PROJECTION ALGORITHM

```
For each year (0 to projection_years):

  1. DETERMINE PHASE
     - If year < years_in_school → "school"
     - If year < years_in_school + (grace_period_months / 12) → "grace_period"
     - Else → "working"

  2. CALCULATE INCOME
     - If school:
         income = part_time_income_during_school
     - If trade apprentice AND in apprentice years:
         income = apprentice_year_N_wage (from wage ramp array)
     - If working:
         income = starting_salary * (1 + growth_rate) ^ years_working
     - Apply effective_tax_rate → net_income

  3. CALCULATE EXPENSES
     - If living_at_home AND year < years_living_at_home:
         expenses = monthly_at_home * 12
     - Else:
         expenses = monthly_independent * 12
     - Apply inflation: expenses *= (1 + inflation_rate) ^ year
     - If in school: add room_and_board (unless living at home)

  4. ACCUMULATE DEBT (during school)
     - If school: debt += tuition_per_year
     - Interest accrues on unsubsidized loans during school
     - If grace_period: interest accrues, no payments

  5. CALCULATE LOAN PAYMENT (during working phase)
     - Standard amortization formula:
       M = P * [r(1+r)^n] / [(1+r)^n - 1]
     - Where P = remaining principal, r = monthly rate, n = remaining months
     - Annual payment = M * 12
     - Reduce debt_remaining by (annual_payment - interest_portion)

  6. CALCULATE SAVINGS
     - disposable = net_income - expenses - loan_payment
     - if disposable > 0:
         savings = disposable * savings_rate
     - else:
         savings = 0 (deficit year — flag this)

  7. GROW INVESTMENTS
     - investment_balance = (prev_balance * (1 + return_rate)) + new_savings

  8. COMPUTE NET WORTH
     - net_worth = investment_balance - debt_remaining

  9. RECORD SNAPSHOT
```

### Key Nuances in the Algorithm

**Opportunity cost is implicit.** The 4-year university student has $0 income
for 4 years while the trade worker is earning $35-60k. The model captures this
naturally — you don't need a separate "opportunity cost" calculation because the
net worth gap at year 4 IS the opportunity cost, visible on the graph.

**Apprentice wage ramp.** Trades don't go from $0 to full salary overnight. A
typical electrician apprentice might earn $18/hr → $22/hr → $28/hr → $35/hr
over 4 years, then jump to journeyman wages. The model supports this with
explicit year-by-year wage inputs.

**Debt accrues interest during school.** For unsubsidized federal loans (which
most are), interest starts accumulating immediately. A student who borrows $50k
over 4 years actually owes ~$55-58k at graduation. This is a critical detail
most students don't understand — our model shows it.

**Living at home is a superpower.** The model explicitly captures the
financial advantage of living at home during school or early career. This is
one of the biggest levers a student has, and it should be visible in the output.

---

## 5. PHASE 1 IMPLEMENTATION PLAN (Days 1–4)

### Day 1: Data Models + Loan Engine
- [ ] Implement all dataclasses in `data_models.py`
- [ ] Build `loan_engine.py`:
  - `calculate_monthly_payment(principal, annual_rate, term_years) → float`
  - `amortize_year(balance, annual_rate, annual_payment) → (new_balance, interest_paid, principal_paid)`
  - `accrue_interest_during_school(balance, annual_rate) → new_balance`
- [ ] Write tests for loan math (known-good amortization tables)

### Day 2: Income + Expense Engines
- [ ] Build `income_engine.py`:
  - `get_annual_income(path, year) → float` (handles school, apprentice ramp, salary growth)
  - `apply_tax(gross, effective_rate) → net`
- [ ] Build `expense_engine.py`:
  - `get_annual_expenses(path, year) → float` (handles at-home vs independent, inflation)
- [ ] Write tests for income progression + expense inflation

### Day 3: Projection Engine + Metrics
- [ ] Build `projection.py`:
  - `run_projection(path: LifePath) → SimResult`
  - Year-by-year loop implementing the algorithm above
- [ ] Build `metrics.py`:
  - `compute_summary_metrics(snapshots) → dict` of derived values
- [ ] Write integration test: known scenario → known output

### Day 4: CLI + Output + Templates
- [ ] Build `cli.py` with Click:
  - `simulate --scenario path1.json path2.json --output ./outputs/`
- [ ] Build `render_charts.py`:
  - Side-by-side net worth over time (the hero chart)
  - Debt remaining over time
- [ ] Build `render_tables.py`:
  - Summary comparison table (CSV + terminal)
- [ ] Create 4 JSON scenario templates with realistic defaults
- [ ] End-to-end test: run all 4 templates, verify output

### Phase 1 Deliverable
Run this command:
```bash
python cli.py simulate \
  --scenarios scenarios/templates/four_year_university.json \
               scenarios/templates/community_college_transfer.json \
               scenarios/templates/electrician_trade.json \
               scenarios/templates/direct_workforce.json \
  --output outputs/runs/
```

Get back:
- `comparison.png` — 4-line net worth graph, age 18–38
- `debt_payoff.png` — Debt remaining over time for each path
- `summary.csv` — Side-by-side metrics table
- `summary.txt` — Human-readable comparison

---

## 6. REALISTIC DEFAULT VALUES (for templates)

These are the defaults I'll bake into the 4 scenario templates. All are
approximate national averages or common values — the point is giving students
a reasonable starting point they can then customize.

### 4-Year Public University
- Tuition: $11,000/yr (in-state public average)
- Years: 4
- Loan amount: $35,000 (average federal student loan debt)
- Interest rate: 6.5% (current federal direct loan rate)
- Loan term: 10 years
- Grace period: 6 months
- Starting salary: $55,000 (average bachelor's degree starting salary)
- Salary growth: 3.5%/yr

### Community College + Transfer
- Tuition: $4,000/yr (CC) for 2 years, then $13,000/yr (university) for 2 years
- Years: 4 total
- Loan amount: $20,000 (reduced due to CC savings)
- Starting salary: $52,000 (slight discount — same degree, less network effect)
- Otherwise same as university path

### Electrician Trade (Apprenticeship)
- Trade school: $5,000 total (not per year)
- Years: 4 (apprenticeship period, but EARNING during)
- Loan amount: $5,000
- Apprentice wages: $32k → $38k → $45k → $52k (4-year ramp)
- Journeyman salary: $62,000
- Salary growth: 2.5%/yr (trades grow more slowly but start higher)

### Direct Workforce
- Education cost: $0
- Years in school: 0
- Loan amount: $0
- Starting salary: $32,000 (entry-level, no degree)
- Salary growth: 2.0%/yr (slower without credential)

### Shared Defaults
- Monthly expenses (at home): $800
- Monthly expenses (independent): $2,200
- Expense inflation: 2.5%/yr
- Savings rate: 10%
- Investment return: 6%/yr
- Effective tax rate: 18% (low bracket for early career)

---

## 7. WHAT THE OUTPUT SHOULD FEEL LIKE

The hero output is the **4-line net worth chart**. When a student sees:

- The **electrician** crossing $0 net worth at age 22
- The **university grad** still at -$30k at age 22 but climbing
- The **workforce** person with modest positive net worth but a flatter slope
- The **CC transfer** student tracking close to the university grad but 1–2
  years ahead on debt payoff

...that's the "aha moment." That's the entire product in one image.

The secondary output is the **comparison table**:

```
                        University   CC+Transfer   Electrician   Workforce
Total Education Cost     $44,000      $34,000       $5,000        $0
Total Loan Interest      $12,400      $7,100        $850          $0
Year Debt-Free           Age 32       Age 29        Age 21        Age 18
Year Positive Net Worth  Age 27       Age 25        Age 21        Age 19
Net Worth at 30          $42,000      $58,000       $78,000       $35,000
Net Worth at 38          $195,000     $210,000      $205,000      $120,000
Total Earnings (20yr)    $920,000     $880,000      $950,000      $600,000
Peak Debt Burden         34%          24%           8%            0%
```

(Numbers are illustrative — the model will compute actuals.)

The story those numbers tell: the trades and CC paths often WIN in the medium
term (to age 30), the university path catches up in the long run IF salary
growth materializes, and the direct workforce path provides stability but a
lower ceiling. That's the kind of clarity a 17-year-old needs.

---

## 8. DESIGN DECISIONS TO LOG

| Decision | Rationale |
|----------|-----------|
| Annual granularity (not monthly) for V0 | Simpler, sufficient for 20-yr view. Monthly adds complexity without proportional insight. |
| JSON scenarios (not YAML) | More universal, better tooling, web-friendly for future API. |
| Effective tax rate (not brackets) | Students don't care about marginal rates. One number is clear enough. |
| No investment account types in V0 | 401k/Roth distinctions add noise for the target audience. Just "savings + growth." |
| Apprentice wage ramp as explicit array | More accurate than a growth formula for trade paths. Real apprenticeships have stepped pay scales. |
| Include "living at home" toggle | One of the most impactful financial decisions a student can make. Must be visible. |

---

## 9. FUTURE-PROOFING FOR WEB APP

The architecture above is deliberately designed so that:

- `model/` becomes a Python package imported by a FastAPI or Flask backend
- `scenarios/templates/` become the "quick start" presets in a web form
- `LifePath` dataclass maps directly to a JSON request body
- `SimResult` maps directly to a JSON response body
- `render_charts.py` gets replaced by a React charting library (Recharts, etc.)
- The CLI remains as a power-user tool and testing harness

No refactoring needed to go from CLI → web. That's the goal.

---

## NEXT ACTIONS

1. **Will reviews this document** — flag anything that feels wrong, missing,
   or over-engineered
2. **Confirm the 4 path types** — are these the right four to start with?
   Any others? (Gap year? Military?)
3. **Confirm default values** — do the salary/tuition numbers feel reasonable?
4. **Green light → I build Day 1** (data models + loan engine + tests)
