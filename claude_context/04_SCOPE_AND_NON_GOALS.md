# Scope and Non-Goals

## In-Scope (V0 — Current)
- Quiz-guided life-path comparison tool for HS seniors (ages 16-18)
- 5 paths: College, CC+Transfer, Trade, Workforce, Military
- Three-engine composition: Education Cost, Career Income, Living Expense
- Deterministic annual projection with configurable horizon (10-50 years)
- Simple flat tax model (18% effective rate, GI Bill exemption)
- Loan amortization (6.5%, 10-year term, 6-month grace)
- Investment growth (7% annual return)
- 6 comparison charts (net worth, debt, income, cumulative earnings, savings rate, investments)
- Adaptive milestone summaries
- CLI with demo + quiz modes
- Research-backed defaults (BLS, NACE, College Board, DFAS)
- CSV exports with all data series for web integration

## In-Scope (Phase 3 — COMPLETE ✓)
- Web app (Python http.server backend + React frontend, zero dependencies)
- Interactive charts with hover tooltips
- Timeline slider (10-50 years, live chart redraw)
- Mobile responsive design
- Multi-instance path comparison (up to 5 instances)
- React + Recharts via CDN (no build step)

## In-Scope (Phase 4 — Next)
- Analytics (site views, path selections)
- Hosting and deployment

## Nice-to-Have (V1+)
- Inflation modeling (2.5% annual)
- School-level tuition lookup database
- Detailed federal/state tax brackets
- Gap year / certificate program paths
- Slider adjustments for savings rate, investment return
- Monte Carlo probabilistic outcomes
- Social Security modeling

## Non-Goals
- Perfect tax accuracy
- Live market data or brokerage integration
- Real estate modeling
- Healthcare cost modeling
- Mobile native app
- Account types (401k, Roth, HSA) — wrong audience for HS grads
