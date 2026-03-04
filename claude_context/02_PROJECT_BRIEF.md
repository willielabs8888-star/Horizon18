# Project Brief — Horizon18

## Tagline
"See your financial future before you choose your path."

## Goal
Build a guided financial comparison tool that helps high school seniors (ages 16-18) see the long-term financial consequences of their post-graduation path choice before they take on debt.

## Target Audience
- High school juniors and seniors deciding what to do after graduation
- Parents anxious about student loan burden
- Guidance counselors looking for data-driven decision tools

## What It Does
Students take a short quiz selecting which paths they're considering (college, community college, trades, workforce, military), answer a few path-specific questions, and get a side-by-side financial projection showing net worth, income, debt, and investment growth over a configurable time horizon (10-50 years).

Students can compare multiple instances of the same path type — for example, "Public In-State STEM" vs "Private Liberal Arts" vs "Electrician" — to see exactly how specific choices affect their financial trajectory. Up to 5 simultaneous comparisons.

## Core Insight
The "best" path depends on how far out you look. Trades and military lead at 10-15 years (no debt, immediate income). College degrees overtake around year 20-25 due to salary growth and compounding. The tool lets students see both sides and make an informed choice.

## Current State
- Working web app at http://localhost:8000 with quiz-guided flow
- Multi-instance path comparison (up to 5 paths)
- 7 interactive charts with hover tooltips, timeline slider (10-50 years)
- Python CLI with demo + quiz modes (legacy)
- 96 engine tests + 9 API tests passing
- Zero external Python dependencies

## Next Milestone
Public deployment — live URL with custom domain, HTTPS, production hosting.
