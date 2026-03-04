# Architecture Notes

## Implemented Architecture: Three-Engine Composition Model

See `docs/ARCHITECTURE_V0_R3.md` for the full approved design.

### Module Structure
```
model/          — Data models + simulation core
  data_models.py    PathType enum, all dataclasses (QuizAnswers → Scenario → YearSnapshot → SimResult)
  loan.py           Amortization math (monthly payment, accrual, year-by-year paydown)
  projection.py     Core simulation loop (reads engine arrays, computes savings/investments/net worth)
  metrics.py        Adaptive milestone summary stats from snapshots

engines/        — Three independent pre-computation engines
  education.py      Tuition, R&B, loan amounts, grace periods per path type
  career.py         Pre-computed annual_income[N] arrays with phase handling
  living.py         Pre-computed annual_expenses[N] arrays with living situation logic

defaults/       — Research-backed data constants (BLS, NACE, College Board, DFAS)
  tuition.py, salaries.py, trades.py, military.py, workforce.py, regions.py, living.py, financial.py

builder/        — Quiz answer → Scenario composition
  builder.py        Calls all 3 engines, composes Scenario, passes projection_years through

outputs/        — Rendering layer (CLI charts + CSV)
  charts.py         6 matplotlib charts with adaptive x-axis
  tables.py         Terminal table + CSV export with all data series
  narrative.py      Plain-English summary with adaptive milestones

backend/        — Web API server and multi-instance support
  api.py            HTTP server (http.server, zero deps), POST /api/simulate, GET /api/options
  test_api.py       9 API integration tests

frontend/       — Web UI (React via CDN, single HTML file)
  index.html        React app, chart rendering, quiz flow, multi-instance comparison UI
```

### Key Design Patterns
- **Pre-computed arrays**: Engines output `list[float]` of length N. Projection loop just reads them — zero path-specific logic.
- **Adaptive milestones**: `metrics.py` picks milestone ages that fall within the projection window, always including end-of-horizon.
- **Cumulative tracking**: YearSnapshot carries `cumulative_earnings`, `cumulative_taxes`, `savings_rate_actual` for web hover tooltips.
- **Variable timeline**: `projection_years` flows from CLI → builder → engines → projection → metrics → output.
- **Multi-instance support**: Each simulated scenario has `instance_id` for tracking in comparisons. API returns array of SimResults for side-by-side path comparison (max 5).

### Output Modes
**CLI Mode** (desktop):
```
outputs/runs/<timestamp>/
  comparison_networth.png
  comparison_debt.png
  comparison_income.png
  comparison_cumulative_earnings.png
  comparison_savings_rate.png
  comparison_investments.png
  summary.csv
  projections.csv        ← Full data series for web integration
  summary.txt
```

**Web Mode** (browser):
- API returns JSON with year-by-year snapshots for each instance
- React frontend renders Recharts visualizations with hover tooltips
- Multi-instance UI with color-coded instance chips and comparison controls
