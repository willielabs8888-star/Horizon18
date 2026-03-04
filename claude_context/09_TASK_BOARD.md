# Task Board

## Phase 1 — Foundation — COMPLETE ✓
- [x] Day 1: data_models.py + all 7 defaults modules + 72 unit tests
- [x] Day 2: Three engines (education, career, living)
- [x] Day 3: loan.py + projection.py + metrics.py
- [x] Day 4: builder.py + compare.py

## Phase 2 — CLI Output Layer — COMPLETE ✓
- [x] CLI: demo mode + interactive quiz mode
- [x] Charts: net worth, debt, income trajectory (matplotlib)
- [x] Tables: terminal comparison table + CSV export
- [x] Narrative: plain-English summary generator
- [x] Integration tests: all 5 path types end-to-end (96 tests passing)

## Phase 2.5 — Refinements — COMPLETE ✓
- [x] Fix: savings rate semantics (% of net income, capped at disposable)
- [x] Fix: narrative truthiness checks (use `is not None`)
- [x] Fix: UnicodeEncodeError on Windows (UTF-8 encoding for file writes)
- [x] Extended default projection horizon from 20 → 32 years
- [x] Variable timeline: `--years` CLI flag (10-50 range)
- [x] Adaptive milestones: table/narrative auto-select ages within horizon
- [x] Added cumulative tracking to YearSnapshot (cumulative_earnings, cumulative_taxes, savings_rate_actual)
- [x] 3 new charts: cumulative earnings, savings rate, investment growth (6 total)
- [x] Expanded year-by-year CSV with all data series for web hover tooltips
- [x] Full documentation review and update

## Phase 3 — Web App — COMPLETE ✓
- [x] Phase 3A: Backend API (Python http.server, zero dependencies)
  - [x] POST /api/simulate: accepts quiz JSON, returns year-by-year results
  - [x] GET /api/options: returns all enum values for quiz dropdowns
  - [x] Server serves both API and frontend static files
  - [x] 9 automated API tests passing
- [x] Phase 3B: Frontend (React + Recharts via CDN)
  - [x] 7 interactive chart types with hover tooltips
  - [x] Summary cards ranked by final net worth
  - [x] Timeline slider (10-50 years, debounced live redraw)
- [x] Phase 3C: Quiz flow
  - [x] 4-step guided quiz: path selection → shared questions → path details → review
  - [x] Path-specific conditional questions (college major, trade type, GI Bill, etc.)
  - [x] Review step showing all selections before running simulation
- [x] Phase 3D: Polish
  - [x] Key Insights section with dynamic text analysis
  - [x] Dark theme, responsive design
  - [x] Error handling (API failure states, loading spinners)
  - [x] SPA-style routing (quiz → results)
- [x] Phase 3E: Multi-instance comparison
  - [x] Store and compare up to 5 simulation instances in session
  - [x] Color-coded instance chips in chart legend
  - [x] Descriptive labels for each instance (user-editable)
  - [x] Remove instance button + clear all
  - [x] Multi-instance API tests

## Phase 4 — Deployment (Next)
- [ ] Choose hosting platform (Vercel, Railway, Render, etc.)
- [ ] Set up domain name
- [ ] Deploy backend + frontend
- [ ] Analytics integration (site views, quiz completions, path selections)
- [ ] SEO basics (meta tags, Open Graph, social sharing)
- [ ] Performance optimization (cache API responses, lazy load charts)

## Completed Milestones
- [x] Architecture Rev 1 → Rev 2 → Rev 3 (approved and implemented)
- [x] Defaults research (BLS, College Board, NACE, DFAS data)
- [x] 13 design decisions locked
- [x] 3 nits addressed (enum consistency, military naming, GI Bill tax-exempt)
- [x] 4 code review tweaks applied
- [x] **96 engine tests passing**
- [x] **9 API tests passing (105 total)**
- [x] **Working CLI with demo + quiz + --years flag**
- [x] **Working web app with quiz flow + 7 interactive charts**
- [x] **Full 5-path comparison with adaptive milestones**
- [x] **Multi-instance path comparison (max 5 instances)**
- [x] **Horizon18 brand established**
- [x] **All documentation current**
