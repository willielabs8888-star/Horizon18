
# Horizon18

"See your financial future before you choose your path."

## Mission
Build an interactive, neutral, educational financial comparison tool
for 16-18 year olds evaluating post-graduation paths.

Core Thesis:
Most major financial damage happens between ages 18-22 due to decisions
made without long-term modeling. This tool makes long-term consequences visible.

## What It Does
Students take a short quiz selecting which paths they're considering
(college, community college, trades, workforce, military), answer a few
path-specific questions, and get a side-by-side financial projection showing
net worth, income, debt, and investment growth over a configurable time
horizon (10-50 years, default 32).

Students can compare multiple instances of the same path type — for example,
"Public In-State STEM" vs "Private Liberal Arts" vs "Electrician" — to see
exactly how specific choices affect their financial trajectory.

## Current State (V0 Web App — Complete)
- Working Python web app at http://localhost:8000
- Multi-instance path comparison (up to 5 simultaneous paths)
- 5 life path types, 5 regions, 6 college majors, 4 trades, 5 workforce industries
- 7 interactive charts with hover tooltips, timeline slider (10-50 years)
- Quiz-guided flow with 4-step wizard
- Python CLI with demo + quiz modes (legacy)
- 96 unit + integration tests + 9 API tests passing
- Zero external Python dependencies (stdlib http.server)

## Long-Term Vision
Become the default modeling tool students run before taking on debt.

Future possibilities:
- High school licensing
- Parent access tier
- Advanced simulation tools (inflation, Monte Carlo, school-level lookup)
- Institutional partnerships
