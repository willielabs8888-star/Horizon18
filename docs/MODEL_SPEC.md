# Horizon18 — Financial Model Specification

## Time Horizon
Age 18 to 18+N where N is user-configurable (default: 32 years, range: 10-50).
Start age is always 18 (high school graduation).

## Paths Modeled
1. 4-Year College (18 majors including CS, Engineering, Nursing, Business, etc.)
2. Community College + Transfer (2 years CC then 2 years university, same majors)
3. Trade / Apprenticeship (12 trades: Electrician, Plumber, HVAC, Carpenter, Welder, etc.)
4. Direct Workforce (12 industries: Retail, Logistics, Admin, Manufacturing, Security, etc.)
5. Military Enlistment (4-year service with optional GI Bill → college, or civilian industry choice)

## Three-Engine Architecture

### Education Cost Engine
Produces: loan amount, annual tuition arrays, room & board arrays, grace period.
Inputs: path type, school type, region, family savings, living situation.

### Career Income Engine
Produces: pre-computed `annual_income[N]` array for the full projection horizon.
Handles: part-time income during school (applied toward school costs first, reducing borrowing; remainder saved), grace period half-income, apprentice wage ramps, military pay → GI Bill housing → post-degree salary, immediate workforce income.
Applies: regional salary multipliers, CC transfer discount (2%), veteran hiring premium (10%).

### Living Expense Engine
Produces: pre-computed `annual_expenses[N]` array for the full projection horizon.
Handles: at-home vs independent living, military low-expense years, GI Bill school years, regional cost multipliers.

## Core Inputs (User-Facing via Quiz)
- Which paths to compare (2-5 selected)
- Region (Northeast, Southeast, Midwest, Southwest, West Coast)
- Living at home? For how many years?
- Family savings for education
- Path-specific: school type, major, trade type, industry, GI Bill toggle, civilian industry (military no-GI-Bill)

## Core Outputs (Per Path)
- Net worth over time (hero metric)
- Annual and cumulative gross income
- Cumulative taxes paid
- Debt remaining over time
- Investment balance over time
- Actual savings rate over time
- Year debt-free (age)
- Year positive net worth (age)
- Net worth at adaptive milestone ages (within horizon)
- Peak debt burden ratio
- Total earnings over horizon

## Modeling Rules
- Annual discrete compounding
- Deterministic growth (no stochastic/Monte Carlo)
- Simplified flat tax rate: 18% effective (with GI Bill tax exemption for housing years)
- Savings rate: % of net (take-home) income, capped at disposable after expenses + loan payments
- Investment return: 6% real annual (after inflation)
- Loan: 4.0% real interest, 10-year default term (user-adjustable 5-30), 6-month grace period, standard amortization
- All values in real (inflation-adjusted) dollars — no separate inflation modeling needed
- Monthly precision for loan amortization internally, annual output granularity

## Defaults Data Sources
- College Board "Trends in College Pricing" (2025-2026)
- NACE salary surveys (2025)
- BLS Occupational Employment and Wage Statistics
- Defense Finance and Accounting Service (DFAS) 2025 pay tables
- Veterans Affairs Post-9/11 GI Bill benefit rates
- World Population Review state-level cost of living data
