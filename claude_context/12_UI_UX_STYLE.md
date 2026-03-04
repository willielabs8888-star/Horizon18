# UI/UX Style

## V0 — CLI Output (Current)
- Clear run summaries with adaptive milestones
- 6 comparison charts: net worth, debt, income, cumulative earnings, savings rate, investment growth
- Terminal table with milestone ages (adaptive to timeline)
- Year-by-year CSV with all data series
- Plain-English narrative ranking paths by end-of-horizon net worth

## Phase 3 — Web App (COMPLETE ✓)

**Quiz Flow:**
- 4-step guided quiz: path selection → shared questions → path details → review
- Path-specific conditional questions (college major, trade type, GI Bill, etc.)
- Smart defaults (Northeast region, living independently)
- Review step shows all selections before running simulation

**Results Page:**
- Hero chart: net worth over time with multiple path curves
- Hover tooltip: shows age-specific data (net worth, cumulative earnings, taxes, debt, investments) as cursor moves along curves
- Timeline slider: 10-50 years, charts redraw live in real time
- 7 interactive chart types: net worth, debt, income, cumulative earnings, savings rate, investments, and summary
- Summary cards ranked by final net worth with key metrics

**Multi-Instance UI:**
- Color-coded instance chips in legend (up to 5 instances)
- User-editable descriptive labels for each instance
- Remove instance button per chip + clear all button
- Charts show all instances overlaid with distinct colors
- Instance comparison shows side-by-side final metrics

**Design:**
- Dark theme (dark background, light text, accent colors for instances)
- Mobile responsive (charts stack on mobile, touch-friendly controls)
- Clean, neutral design — educational tone, not sales-y
- Key Insights section with dynamic text analysis
- Error handling (API failure states, loading spinners)

**Tone:**
- Practical and concise
- Neutral and educational — we show outcomes, not recommendations
- Age-appropriate for 16-18 year olds
