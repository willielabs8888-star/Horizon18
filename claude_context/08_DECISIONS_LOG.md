# Decisions Log

---

- Date: 2026-03-01
- Decision: Narrow V0 from general finance simulator to life-path decision tool for HS grads
- Why: Sharper product focus. 401k/Roth/allocation is noise for a 17-year-old.
- Alternatives: Keep general simulator. Rejected — wrong audience.

---

- Date: 2026-03-01
- Decision: Pivot to guided quiz → auto-generated configs (not JSON-first)
- Why: Students won't write JSON. The quiz IS the product.
- Alternatives: JSON-only power tool. Rejected.

---

- Date: 2026-03-01
- Decision: Three-engine composition model (Education, Career, Living)
- Why: Each engine is independently testable, composable, and swappable. No path-specific builders needed. Adding new paths = adding templates to existing engines.
- Alternatives: Monolithic path builders (Rev 2). Rejected — creates duplication.

---

- Date: 2026-03-01
- Decision: Pre-computed year-by-year arrays from engines
- Why: Projection loop becomes trivially simple. No phase detection needed. Engines handle all complexity internally.
- Alternatives: Projection loop determines phases and computes income/expenses. Rejected — mixes concerns.

---

- Date: 2026-03-01
- Decision: CC transfer salary discount = 2%
- Why: Conservatively reflects signaling differences. Small enough not to distort.
- Alternatives: 0% (no discount), 5% (too aggressive). 2% is balanced.

---

- Date: 2026-03-01
- Decision: Military path = single line with GI Bill toggle (not two lines)
- Why: Cleaner output. Toggle changes the config, doesn't add a path.
- Alternatives: Auto-show both military variants. Deferred — adds clutter in V0.

---

- Date: 2026-03-01
- Decision: Healthcare starting salary = $85,000
- Why: Balanced between conservative ($70k) and BLS RN average ($100k). No grad degrees in V0.
- Alternatives: $70k (too low for most markets), $100k (too high for new grads).

---

- Date: 2026-03-01
- Decision: Investment return rate = 7%
- Why: Historically reasonable. Slight optimism acceptable with clear disclaimer.
- Alternatives: 6% (too conservative for long horizon).

---

- Date: 2026-03-01
- Decision: No inflation in V0
- Why: Simplifies expense engine. Results framed as nominal dollars.
- Alternatives: 2.5% inflation. Deferred to V1.

---

- Date: 2026-03-01
- Decision: 5 paths: College, CC+Transfer, Trade, Workforce, Military
- Why: Covers the major post-HS options. Military is too important to defer.
- Alternatives: 4 paths (no military). Rejected.

---

- Date: 2026-03-01
- Decision: Centralized defaults as plain Python dicts (not DB)
- Why: Simple, version-controlled, research-backed. BLS, College Board, NACE data.
- Alternatives: SQLite, YAML, external API. All rejected for V0 simplicity.

---

- Date: 2026-03-01
- Decision: School-level tuition overrides deferred to V1
- Why: Requires curated school database. V0 uses type-based presets.
- Alternatives: Build school lookup in V0. Rejected — scope creep.

---

- Date: 2026-03-01
- Decision: Default projection horizon = 32 years (ages 18-49), user-adjustable 10-50
- Why: 32 years illustrates compounding advantage of higher-income paths while keeping a reasonable default. Shorter horizons favor trades/military (no debt), longer horizons favor college degrees (salary growth). Making it adjustable lets users see both sides.
- Alternatives: Fixed 20 years (original default, too short to show college payoff). Fixed 40 years (too long for most students to relate to). Variable was the right call.

---

- Date: 2026-03-02
- Decision: Backend uses Python http.server (zero dependencies) instead of FastAPI
- Why: No need for a heavy framework. http.server is in stdlib, eliminates FastAPI dependency. Simple routing for POST /api/simulate and GET /api/options is trivial to implement.
- Alternatives: FastAPI (adds pip dependency, over-engineered for this scope). Flask (similar issue). Raw socket server (too low-level).

---

- Date: 2026-03-02
- Decision: Frontend uses React + Recharts via CDN UMD bundles (no build step)
- Why: Single index.html file, no npm install or build process. Simpler deployment, easier to understand. UMD bundles from jsdelivr load instantly.
- Alternatives: Next.js or Create React App (adds complexity, build step, deployment overhead). Vanilla JS only (loses React's composable components and Recharts' polish).

---

- Date: 2026-03-02
- Decision: Multi-instance path comparison (max 5 instances)
- Why: Lets users explore different scenarios in parallel. UI shows up to 5 color-coded instances. Limit prevents chart clutter and keeps API responses bounded.
- Alternatives: Unlimited instances (chart becomes unreadable). 2-instance only (too limiting for exploratory analysis). 10+ instances (performance hit, visual clutter).

---

- Date: 2026-03-02
- Decision: Project renamed from "The Biggest Decision Simulator" to "Horizon18"
- Why: Cleaner, more memorable, reflects the core mission (planning the horizon from age 18). Easier to market and brand.
- Alternatives: Keep "The Biggest Decision Simulator" (too wordy). Other names considered and rejected.

---

- Date: 2026-03-02
- Decision: CDN provider = jsdelivr for React, Recharts, and Babel
- Why: Fast, reliable, good uptime SLA. Recommended by React docs. Free tier supports all CDN needs for Phase 3.
- Alternatives: unpkg (also good), cdnjs (less comprehensive). jsdelivr chosen for consistency with React ecosystem defaults.

---

- Date: 2026-03-04
- Decision: Expand metros to all US MSAs >500K population with per-metro COL/salary multipliers
- Why: 20 hardcoded metros was too limiting. Now 92 metros with BEA RPP-based multipliers give granular cost-of-living adjustments. Per-metro multipliers override regional fallbacks.
- Alternatives: Keep 5-region system (too coarse). Use C2ER COLI (expensive, requires license). BEA RPP via FRED API is free and authoritative.

---

- Date: 2026-03-04
- Decision: Metro data stored in JSON (metros_data.json), loaded lazily like schools_data.json
- Why: Consistent pattern with existing school database. Easy to refresh via script. Decouples data from code.
- Alternatives: Hardcode in Python dict (harder to update). External API at runtime (adds latency, fragile).

---

- Date: 2026-03-04
- Decision: Salary multiplier formula = 1 + (RPP - 100) / 100 * 0.75
- Why: BLS data shows wages track ~75% of cost-of-living differences. Pure RPP/100 overestimates salary adjustments in high-COL areas.
- Alternatives: sal = col (wages match COL 1:1, unrealistic). sal = 1 + (RPP-100)/100 * 0.5 (too conservative).

---

- Date: 2026-03-04
- Decision: Quarterly scheduled task for IPEDS + COL data refresh
- Why: College Scorecard data updates annually. BEA RPP updates annually with ~2yr lag. Quarterly checks ensure timely updates without excessive overhead.
- Alternatives: Monthly (too frequent). Annually (might miss mid-year releases).

---
