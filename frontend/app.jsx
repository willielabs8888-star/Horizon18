    const { useState, useEffect, useCallback, useRef } = React;
    const {
      LineChart, Line, XAxis, YAxis, CartesianGrid,
      Tooltip, ResponsiveContainer, ReferenceLine,
    } = Recharts;

    // ============================================================
    // CONSTANTS
    // ============================================================

    // Base colors per path type
    const PATH_BASE_COLORS = {
      college: ["#6366f1", "#a5b4fc", "#c7d2fe", "#818cf8", "#4f46e5"],
      cc_transfer: ["#06b6d4", "#67e8f9", "#a5f3fc", "#22d3ee", "#0891b2"],
      trade: ["#f59e0b", "#fbbf24", "#fcd34d", "#d97706", "#b45309"],
      workforce: ["#ef4444", "#f87171", "#fca5a5", "#dc2626", "#b91c1c"],
      military: ["#22c55e", "#4ade80", "#86efac", "#16a34a", "#15803d"],
    };

    const PATH_LABELS = {
      college: "4-Year College", cc_transfer: "Community College + Transfer",
      trade: "Trade / Apprenticeship", workforce: "Direct Workforce", military: "Military Enlistment",
    };

    const PATH_DESCRIPTIONS = {
      college: "Bachelor's degree from a 4-year university",
      cc_transfer: "2 years at community college, then transfer",
      trade: "Apprenticeship or trade school certification",
      workforce: "Enter the workforce directly after high school",
      military: "Enlist, serve, then transition to civilian life",
    };

    const LABEL_MAP = {
      public_in_state: "Public (In-State)", public_out_of_state: "Public (Out-of-State)",
      private: "Private University",
      // Majors — new granular list
      computer_science: "Computer Science", engineering: "Engineering",
      biology: "Biology / Pre-Med", environmental_science: "Environmental Science",
      nursing: "Nursing", kinesiology: "Kinesiology / Exercise Science",
      business_finance: "Business / Finance", accounting: "Accounting", marketing: "Marketing",
      psychology: "Psychology", criminal_justice: "Criminal Justice",
      political_science: "Political Science", communications: "Communications",
      english: "English / Writing", social_work: "Social Work",
      education: "Education", art_design: "Art / Design", undecided: "Undecided",
      // Legacy major aliases (still used by older saved quizzes)
      stem: "STEM / Engineering", business: "Business",
      healthcare: "Healthcare / Nursing", liberal_arts: "Liberal Arts",
      // Trades
      electrician: "Electrician", plumber: "Plumber", hvac: "HVAC",
      carpenter: "Carpenter", welder: "Welder", automotive_tech: "Automotive Technician",
      diesel_mechanic: "Diesel Mechanic", cnc_machinist: "CNC Machinist",
      lineworker: "Lineworker", ironworker: "Ironworker",
      elevator_mechanic: "Elevator Mechanic", heavy_equipment_op: "Heavy Equipment Operator",
      apprenticeship: "Apprenticeship", trade_school: "Trade School",
      // Workforce
      retail: "Retail", logistics: "Logistics / Warehouse", food_service: "Food Service",
      admin: "Office / Admin", manufacturing: "Manufacturing", security: "Security",
      landscaping: "Landscaping", customer_service: "Customer Service / Call Center",
      delivery_driver: "Delivery Driver", janitorial: "Janitorial / Maintenance",
      home_health_aide: "Home Health Aide", childcare: "Childcare",
      // Regions
      northeast: "Northeast", southeast: "Southeast", midwest: "Midwest",
      southwest: "Southwest", west_coast: "West Coast",
      national_avg: "National Average",
    };
    // Metro labels are merged dynamically when /api/metros loads (see QuizPage)

    // Default configs for new instances — blank-slate (user must choose)
    const DEFAULT_CONFIGS = {
      college: { school_type: "", major: "", use_search: true, loan_term_years: 10, part_time_work: true, part_time_income: 8000 },
      cc_transfer: { transfer_university_type: "", major: "", use_search: true, use_transfer_search: true, loan_term_years: 10, part_time_work: true, part_time_income: 10000 },
      trade: { trade_type: "", loan_term_years: 5 },
      workforce: { industry: "" },
      military: { enlistment_years: 4, use_gi_bill: true, gi_bill_major: "" },
    };

    const MAX_INSTANCES = 10;

    // Region-based default tax rates (blended federal + state + payroll)
    const REGION_TAX_DEFAULTS = {
      northeast: 0.25, southeast: 0.22, midwest: 0.22,
      southwest: 0.22, west_coast: 0.27,
    };

    // ── Auth State Helpers ──────────────────────────────────────
    // Token stored in module scope (not localStorage — React rule)
    let _authToken = null;
    let _currentUser = null;

    function setAuth(token, user) {
      _authToken = token;
      _currentUser = user;
    }

    function clearAuth() {
      _authToken = null;
      _currentUser = null;
    }

    function getAuthHeaders() {
      if (!_authToken) return {};
      return { "Authorization": "Bearer " + _authToken };
    }

    async function apiCall(url, options = {}) {
      const headers = { "Content-Type": "application/json", ...getAuthHeaders(), ...(options.headers || {}) };
      const resp = await fetch(url, { ...options, headers });
      const data = await resp.json();
      if (!resp.ok) throw { status: resp.status, ...data };
      return data;
    }

    // Path ordering for display grouping
    const PATH_ORDER = ["college", "cc_transfer", "trade", "workforce", "military"];

    function sortInstances(insts) {
      return [...insts].sort((a, b) => {
        const typeA = PATH_ORDER.indexOf(a.path_type);
        const typeB = PATH_ORDER.indexOf(b.path_type);
        if (typeA !== typeB) return typeA - typeB;
        return a.instance_id.localeCompare(b.instance_id);
      });
    }

    // ============================================================
    // HELPERS
    // ============================================================

    function fmt(val) {
      if (val == null) return "N/A";
      const a = Math.abs(val), s = val < 0 ? "-" : "";
      if (a >= 1e6) return s + "$" + (a/1e6).toFixed(1) + "M";
      if (a >= 1e3) return s + "$" + (a/1e3).toFixed(0) + "K";
      return s + "$" + a.toFixed(0);
    }

    function fmtFull(val) {
      if (val == null) return "N/A";
      return (val < 0 ? "-$" : "$") + Math.abs(val).toLocaleString("en-US", {maximumFractionDigits: 0});
    }

    /** Format an enum value for display (e.g. "computer_science" → "Computer Science") */
    function fmtEnum(val) {
      if (!val) return "";
      return LABEL_MAP[val] || val.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }

    /** Get a descriptive label for an instance including specific field. */
    function instanceLabel(inst, allInstances) {
      const sameType = (allInstances || []).filter(i => i.path_type === inst.path_type);
      const idx = sameType.findIndex(i => i.instance_id === inst.instance_id);
      const num = sameType.length > 1 ? ` #${(idx >= 0 ? idx + 1 : 1)}` : "";
      const base = PATH_LABELS[inst.path_type] || inst.path_type;

      // Include school name, major, trade, or industry for clarity
      let specific = "";
      if (inst.path_type === "college") {
        const school = inst._selected_school ? inst._selected_school.name : null;
        const major = inst.major ? fmtEnum(inst.major) : null;
        specific = " – " + [major, school].filter(Boolean).join(" – ") || "";
      } else if (inst.path_type === "cc_transfer") {
        const cc = inst._selected_cc ? inst._selected_cc.name : "Community College";
        const transfer = inst._selected_transfer ? inst._selected_transfer.name : LABEL_MAP[inst.transfer_university_type];
        const major = inst.major ? fmtEnum(inst.major) : null;
        specific = " – " + [major, cc + " → " + (transfer || "Transfer")].filter(Boolean).join(" – ");
      } else if (inst.path_type === "trade" && inst.trade_type) {
        specific = ` – ${fmtEnum(inst.trade_type)}`;
      } else if (inst.path_type === "workforce" && inst.industry) {
        specific = ` – ${fmtEnum(inst.industry)}`;
      } else if (inst.path_type === "military") {
        specific = inst.use_gi_bill ? ` – GI Bill (${fmtEnum(inst.gi_bill_major) || "Undecided"})` : " – Civilian";
      }

      return `${base}${specific}${num}`;
    }

    /** Get list of missing required fields for an instance. Returns array of {field, label} */
    function getMissingFields(inst) {
      const pt = inst.path_type;
      const missing = [];
      if (pt === "college") {
        const hasSchool = inst.use_search ? !!inst.ipeds_id : !!inst.school_type;
        if (!hasSchool) missing.push({ field: "school_type", label: "Choose a school" });
        if (!inst.major) missing.push({ field: "major", label: "Pick a major" });
      } else if (pt === "cc_transfer") {
        const hasTransfer = inst.use_transfer_search ? !!inst.ipeds_id_transfer : !!inst.transfer_university_type;
        if (!hasTransfer) missing.push({ field: "transfer_university_type", label: "Choose a transfer university" });
        if (!inst.major) missing.push({ field: "major", label: "Pick a major" });
      } else if (pt === "trade") {
        if (!inst.trade_type) missing.push({ field: "trade_type", label: "Pick a trade" });
      } else if (pt === "workforce") {
        if (!inst.industry) missing.push({ field: "industry", label: "Pick an industry" });
      } else if (pt === "military") {
        if (inst.use_gi_bill && !inst.gi_bill_major) missing.push({ field: "gi_bill_major", label: "Pick a post-service major" });
      }
      return missing;
    }

    /** Check if an instance is fully configured */
    function isInstanceComplete(inst) {
      return getMissingFields(inst).length === 0;
    }

    /** Get a short config summary for an instance (for review step). */
    function instanceSummary(inst) {
      const pt = inst.path_type;
      if (pt === "college") {
        const school = inst._selected_school ? inst._selected_school.name : LABEL_MAP[inst.school_type];
        const term = inst.loan_term_years && inst.loan_term_years !== 10 ? `${inst.loan_term_years}yr repayment` : null;
        return [school, LABEL_MAP[inst.major], term].filter(Boolean).join(", ") || "Not configured";
      }
      if (pt === "cc_transfer") {
        const transfer = inst._selected_transfer ? inst._selected_transfer.name : LABEL_MAP[inst.transfer_university_type];
        const cc = inst._selected_cc ? inst._selected_cc.name : "Community College";
        const term = inst.loan_term_years && inst.loan_term_years !== 10 ? `${inst.loan_term_years}yr repayment` : null;
        return [cc + " → " + transfer, LABEL_MAP[inst.major], term].filter(Boolean).join(", ") || "Not configured";
      }
      if (pt === "trade") return LABEL_MAP[inst.trade_type] || "Not configured";
      if (pt === "workforce") return LABEL_MAP[inst.industry] || "Not configured";
      if (pt === "military") return inst.use_gi_bill ? `GI Bill: ${LABEL_MAP[inst.gi_bill_major] || "Not configured"}` : "No GI Bill";
      return "";
    }

    /** Get color for an instance based on path type and index within that type. */
    function instanceColor(inst, allInstances) {
      const sameType = allInstances.filter(i => i.path_type === inst.path_type);
      const idx = sameType.findIndex(i => i.instance_id === inst.instance_id);
      const colors = PATH_BASE_COLORS[inst.path_type] || ["#888"];
      return colors[Math.min(idx, colors.length - 1)];
    }

    /** Build a color map from instance_id → color */
    function buildColorMap(instances) {
      const map = {};
      for (const inst of instances) {
        map[inst.instance_id] = instanceColor(inst, instances);
      }
      return map;
    }

    /** Build a label map from instance_id → descriptive label.
     *  Prefers the scenario.name from API results (includes real school names),
     *  falls back to quiz-based instanceLabel if results aren't loaded yet. */
    function buildLabelMap(instances, results) {
      const map = {};
      for (const inst of instances) {
        // Try to get the authoritative label from the API result (includes school names)
        const match = (results || []).find(r =>
          (r.scenario.instance_id || r.scenario.path_type) === inst.instance_id
        );
        if (match && match.scenario.name) {
          map[inst.instance_id] = match.scenario.name;
        } else {
          map[inst.instance_id] = instanceLabel(inst, instances);
        }
      }
      return map;
    }

    // ============================================================
    // SCHOOL SEARCH COMPONENT
    // ============================================================

    function SchoolSearch({ value, onSelect, onClear, placeholder, levelFilter }) {
      const [query, setQuery] = useState("");
      const [results, setResults] = useState([]);
      const [showResults, setShowResults] = useState(false);
      const searchTimeout = useRef(null);
      const wrapRef = useRef(null);

      // Close dropdown when clicking outside
      useEffect(() => {
        const handleClick = (e) => {
          if (wrapRef.current && !wrapRef.current.contains(e.target)) {
            setShowResults(false);
          }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
      }, []);

      const doSearch = (q) => {
        setQuery(q);
        if (q.length < 2) { setResults([]); setShowResults(false); return; }
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
          const url = levelFilter
            ? `/api/schools/search?q=${encodeURIComponent(q)}&level=${levelFilter}`
            : `/api/schools/search?q=${encodeURIComponent(q)}`;
          fetch(url)
            .then(r => r.json())
            .then(data => { setResults(data.schools || []); setShowResults(true); })
            .catch(() => {});
        }, 200);
      };

      const selectSchool = (school) => {
        onSelect(school);
        setQuery("");
        setResults([]);
        setShowResults(false);
      };

      const controlLabel = (c) => c === 1 ? "Public" : "Private";
      const levelLabel = (l) => l === 1 ? "4-Year" : "2-Year";

      // If a school is already selected, show it
      if (value) {
        return (
          <div className="school-selected">
            <span style={{color: "var(--accent)", fontWeight: 600}}>{value.name}</span>
            <span style={{color: "var(--text-dim)", fontSize: 11}}>
              {value.state} · {controlLabel(value.control)} · ${(value.tuition_in || 0).toLocaleString()}/yr
              {value.room_board ? ` · R&B $${value.room_board.toLocaleString()}/yr` : ""}
            </span>
            <button className="school-clear" onClick={onClear}>✕ Clear</button>
          </div>
        );
      }

      return (
        <div className="school-search-wrap" ref={wrapRef}>
          <input
            type="text"
            className="school-search-input"
            placeholder={placeholder || "Search by school name..."}
            value={query}
            onChange={e => doSearch(e.target.value)}
            onFocus={() => { if (results.length) setShowResults(true); }}
          />
          {showResults && results.length > 0 && (
            <div className="school-results">
              {results.map(s => (
                <div key={s.id} className="school-result-item" onClick={() => selectSchool(s)}>
                  <div>
                    <div className="school-result-name">{s.name}</div>
                    <div className="school-result-meta">
                      {s.state} · {controlLabel(s.control)} {levelLabel(s.level)}
                    </div>
                  </div>
                  <div style={{textAlign: "right"}}>
                    <div style={{fontSize: 12, fontWeight: 600, color: "var(--accent)"}}>
                      ${(s.tuition_in || 0).toLocaleString()}
                    </div>
                    <div className="school-result-meta">in-state/yr</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showResults && query.length >= 2 && results.length === 0 && (
            <div className="school-results" style={{padding: "12px 16px", color: "var(--text-dim)", fontSize: 13}}>
              No schools found for "{query}"
            </div>
          )}
        </div>
      );
    }

    // ============================================================
    // SCHOOL STATS PANEL — shown after school selection
    // ============================================================

    // Major → national avg starting salary (mirrors defaults/salaries.py)
    const MAJOR_SALARY = {
      computer_science: 76251, engineering: 78731, biology: 45000,
      environmental_science: 48500, nursing: 77600, kinesiology: 48000,
      business_finance: 65276, accounting: 61500, marketing: 57000,
      psychology: 40000, criminal_justice: 43000, political_science: 44500,
      communications: 45500, english: 40000, social_work: 41000,
      education: 44860, art_design: 44000, undecided: 52000,
      // Legacy aliases
      stem: 78731, business: 65276, healthcare: 77600, liberal_arts: 40000,
    };

    // Trade → journeyman salary (mirrors defaults/trades.py)
    const TRADE_SALARY = {
      electrician: 67810, plumber: 64960, hvac: 54100, carpenter: 60083,
      welder: 49000, automotive_tech: 48000, diesel_mechanic: 58000,
      cnc_machinist: 49970, lineworker: 82340, ironworker: 62000,
      elevator_mechanic: 99000, heavy_equipment_op: 55280,
    };

    // Workforce → entry salary (mirrors defaults/workforce.py)
    const INDUSTRY_SALARY = {
      retail: 32240, logistics: 36500, food_service: 28245,
      admin: 35419, manufacturing: 34320, security: 36530,
      landscaping: 34480, customer_service: 38200, delivery_driver: 38180,
      janitorial: 31990, home_health_aide: 33530, childcare: 28520,
    };

    function SchoolStatsPanel({ school, schoolType, major, metroArea, isCC, years }) {
      if (!school) return null;

      const tuition = schoolType === "public_out_of_state"
        ? (school.tuition_out || school.tuition_in)
        : school.tuition_in;
      const rb = school.room_board || 0;
      const yrs = years || (isCC ? 2 : 4);
      const totalCost = (tuition + rb) * yrs;

      // Salary estimate = major base * metro salary multiplier
      const majorSalary = MAJOR_SALARY[major] || MAJOR_SALARY.undecided;
      const mults = METRO_REGION_MAP[metroArea];
      // We don't have the exact multiplier in the frontend, but we can note it's metro-adjusted
      // For the panel, show the national avg and note metro adjustment happens in simulation

      const gradRatePct = school.grad_rate != null ? Math.round(school.grad_rate * 100) : null;
      const admRatePct = school.adm_rate != null ? Math.round(school.adm_rate * 100) : null;

      return (
        <div className="stats-panel">
          <div className="stats-panel-header">
            <h4>{school.name}</h4>
            <span className="stats-badge">
              {school.control === 1 ? "Public" : "Private"} · {school.state}
            </span>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">Annual Tuition</div>
              <div className="stat-value">${tuition.toLocaleString()}</div>
              <div className="stat-detail">{schoolType === "public_out_of_state" ? "out-of-state" : "in-state"}</div>
            </div>
            {rb > 0 && (
              <div className="stat-item">
                <div className="stat-label">Room & Board</div>
                <div className="stat-value">${rb.toLocaleString()}</div>
                <div className="stat-detail">per year</div>
              </div>
            )}
            <div className="stat-item">
              <div className="stat-label">Est. {yrs}-Year Cost</div>
              <div className="stat-value highlight">${(totalCost / 1000).toFixed(0)}K</div>
              <div className="stat-detail">tuition + R&B</div>
            </div>
            {gradRatePct != null && (
              <div className="stat-item">
                <div className="stat-label">Graduation Rate</div>
                <div className="stat-value" style={{color: gradRatePct >= 60 ? "var(--success)" : gradRatePct >= 40 ? "#eab308" : "var(--danger)"}}>{gradRatePct}%</div>
                <div className="stat-detail">within 150% time</div>
              </div>
            )}
            {admRatePct != null && (
              <div className="stat-item">
                <div className="stat-label">Acceptance Rate</div>
                <div className="stat-value">{admRatePct}%</div>
                <div className="stat-detail">of applicants</div>
              </div>
            )}
            {school.med_earn != null && (
              <div className="stat-item">
                <div className="stat-label">Median Earnings</div>
                <div className="stat-value">${(school.med_earn / 1000).toFixed(0)}K</div>
                <div className="stat-detail">10yr post-enrollment</div>
              </div>
            )}
            {school.net_price != null && (
              <div className="stat-item">
                <div className="stat-label">Avg Net Price</div>
                <div className="stat-value">${(school.net_price / 1000).toFixed(1)}K</div>
                <div className="stat-detail">after avg. fin. aid</div>
              </div>
            )}
            {major && major !== "" && (
              <div className="stat-item">
                <div className="stat-label">Est. Starting Salary</div>
                <div className="stat-value highlight">${(majorSalary / 1000).toFixed(0)}K</div>
                <div className="stat-detail">national avg, {LABEL_MAP[major] || major}</div>
              </div>
            )}
          </div>
          <div className="stats-disclaimer">
            Tuition and R&B from U.S. Dept. of Education College Scorecard.
            {school.med_earn != null && " Median earnings reflect all graduates, not specific to your major."}
            {" "}Starting salary is a national average — the simulation adjusts for your selected metro area.
            {" "}Estimates vary by region, experience, and job market.
          </div>
        </div>
      );
    }

    function buildChartData(results) {
      if (!results || !results.length) return [];
      const rows = [];
      for (let i = 0; i < results[0].snapshots.length; i++) {
        const row = { age: results[0].snapshots[i].age };
        for (const r of results) {
          const id = r.scenario.instance_id || r.scenario.path_type;
          const s = r.snapshots[i];
          row[id+"_nw"] = Math.round(s.net_worth);
          row[id+"_income"] = Math.round(s.gross_income);
          row[id+"_cum_earn"] = Math.round(s.cumulative_earnings);
          row[id+"_debt"] = Math.round(s.debt_remaining);
          row[id+"_invest"] = Math.round(s.investment_balance);
          row[id+"_savings"] = Math.round(s.savings_rate_actual * 100);
          row[id+"_loan_pay"] = Math.round(s.loan_payment);
          row[id+"_annual_save"] = Math.round(s.annual_savings);
          row[id+"_cum_tax"] = Math.round(s.cumulative_taxes);
        }
        rows.push(row);
      }
      return rows;
    }

    // ============================================================
    // GENERIC CHART COMPONENT (instance-aware)
    // ============================================================

    function SimChart({ data, results, suffix, dataKeySuffix, yDomain, colorMap, labelMap, savingsRate }) {
      const ids = results.map(r => r.scenario.instance_id || r.scenario.path_type);
      const isMoney = !suffix;
      const [hoverData, setHoverData] = useState(null);

      const handleMouseMove = (state) => {
        if (state && state.activePayload && state.activePayload.length) {
          const label = state.activeLabel;
          const values = state.activePayload.map(e => ({
            id: e.dataKey.replace("_"+dataKeySuffix, ""),
            color: e.color,
            value: e.value,
          })).sort((a,b) => (b.value||0) - (a.value||0));
          setHoverData({ age: label, values });
        }
      };

      return (
        <div style={{animation: "fadeIn 0.3s ease"}}>
          <div className="legend">
            {ids.map(id => (
              <div className="legend-item" key={id}>
                <div className="legend-dot" style={{background: colorMap[id] || "#888"}} />
                {labelMap[id] || id}
              </div>
            ))}
          </div>

          {/* Static hover panel — shows values as you move cursor along chart */}
          <div style={{minHeight: 48, padding: "8px 16px", marginBottom: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, transition: "opacity 0.15s", opacity: hoverData ? 1 : 0.4}}>
            {hoverData ? (
              <div>
                <div style={{fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4}}>Age {hoverData.age}</div>
                <div style={{display: "flex", gap: 20, flexWrap: "wrap"}}>
                  {hoverData.values.map(v => (
                    <div key={v.id} style={{display: "flex", alignItems: "center", gap: 6}}>
                      <div style={{width: 8, height: 8, borderRadius: "50%", background: v.color, flexShrink: 0}} />
                      <span style={{fontSize: 12, color: "var(--text-dim)"}}>{labelMap[v.id] || v.id}</span>
                      <span style={{fontSize: 13, fontWeight: 600, color: v.color}}>
                        {isMoney ? fmtFull(v.value) : (v.value != null ? v.value + (suffix||"") : "—")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{fontSize: 12, color: "var(--text-dim)"}}>Hover over the chart to see values at each age</div>
            )}
          </div>

          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={data} margin={{top:10, right:30, left:20, bottom:5}}
              onMouseMove={handleMouseMove} onMouseLeave={() => setHoverData(null)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
              <XAxis dataKey="age" stroke="#6b7280" tick={{fill:"#9ca3af", fontSize:12}}
                label={{value:"Age", position:"insideBottom", offset:-2, fill:"#9ca3af"}} />
              <YAxis stroke="#6b7280" tick={{fill:"#9ca3af", fontSize:12}}
                tickFormatter={isMoney ? fmt : (v => v + (suffix||""))}
                domain={yDomain || undefined} />
              <Tooltip content={() => null} cursor={{stroke: "var(--text-dim)", strokeWidth: 1, strokeDasharray: "4 4"}} />
              {dataKeySuffix === "nw" && <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />}
              {dataKeySuffix === "savings" && savingsRate !== undefined && <ReferenceLine y={Math.round(savingsRate * 100)} stroke="var(--accent)" strokeDasharray="5 5" label={{value: "Target", position: "right", fill: "var(--text-dim)", fontSize: 11}} />}
              {ids.map(id => (
                <Line key={id} type="monotone" dataKey={id+"_"+dataKeySuffix}
                  stroke={colorMap[id] || "#888"} strokeWidth={dataKeySuffix === "nw" ? 2.5 : 2}
                  dot={false} activeDot={{r: dataKeySuffix === "nw" ? 5 : 4, strokeWidth:0}} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // ============================================================
    // QUIZ PAGE (multi-instance)
    // ============================================================

    const QUIZ_STEPS = ["paths", "details", "location", "review"];
    let _nextId = 0;

    // Metro area → region mapping (built dynamically from /api/metros response)
    // Initialized with national_avg fallback; populated in QuizPage useEffect
    let METRO_REGION_MAP = { national_avg: "midwest" };

    function QuizPage({ onComplete }) {
      const [step, setStep] = useState(0);
      const [instances, setInstances] = useState([]);
      const [metros, setMetros] = useState([]);
      const [collapsed, setCollapsed] = useState({});   // instance_id → bool
      const [showMissing, setShowMissing] = useState(false); // highlight empty fields after Continue attempt
      const [shared, setShared] = useState({
        metro_area: "national_avg",
        living_at_home: false,
        years_at_home: 2,
        family_savings: 0,
        projection_years: 32,
      });

      // Fetch metro list on mount and build region map dynamically
      useEffect(() => {
        fetch("/api/metros").then(r => r.json()).then(d => {
          const list = d.metros || [];
          setMetros(list);
          // Build METRO_REGION_MAP and merge labels dynamically
          const map = { national_avg: "midwest" };
          list.forEach(m => {
            map[m.code] = m.region;
            if (!LABEL_MAP[m.code]) LABEL_MAP[m.code] = m.label;
          });
          METRO_REGION_MAP = map;
        }).catch(() => {});
      }, []);

      const updateShared = (key, val) => setShared(prev => ({...prev, [key]: val}));

      const addInstance = (pathType) => {
        if (instances.length >= MAX_INSTANCES) return;
        const count = instances.filter(i => i.path_type === pathType).length;
        const id = `${pathType}_${_nextId++}`;
        setInstances(prev => [...prev, {
          instance_id: id,
          path_type: pathType,
          ...JSON.parse(JSON.stringify(DEFAULT_CONFIGS[pathType])),
        }]);
      };

      const removeInstance = (instanceId) => {
        setInstances(prev => prev.filter(i => i.instance_id !== instanceId));
      };

      const updateInstance = (instanceId, key, val) => {
        setInstances(prev => {
          const updated = prev.map(i =>
            i.instance_id === instanceId ? {...i, [key]: val} : i
          );
          // Auto-collapse section if it just became complete
          const inst = updated.find(i => i.instance_id === instanceId);
          if (inst && isInstanceComplete(inst)) {
            setTimeout(() => setCollapsed(c => ({...c, [instanceId]: true})), 600);
          }
          return updated;
        });
      };

      const canNext = () => {
        if (step === 0) return instances.length >= 1;
        if (step === 1) {
          // Validate that all required fields are filled for every instance
          return instances.every(inst => {
            const pt = inst.path_type;
            if (pt === "college") {
              const hasSchool = inst.use_search ? !!inst.ipeds_id : !!inst.school_type;
              return hasSchool && inst.major;
            }
            if (pt === "cc_transfer") {
              const hasTransfer = inst.use_transfer_search ? !!inst.ipeds_id_transfer : !!inst.transfer_university_type;
              return hasTransfer && inst.major;
            }
            if (pt === "trade") return inst.trade_type;
            if (pt === "workforce") return inst.industry;
            if (pt === "military") return !inst.use_gi_bill || inst.gi_bill_major;
            return true;
          });
        }
        return true;
      };

      const toggleCollapse = (id) => setCollapsed(prev => ({...prev, [id]: !prev[id]}));

      const next = () => {
        // On step 1, if can't proceed, highlight missing fields and scroll to first
        if (step === 1 && !canNext()) {
          setShowMissing(true);
          // Expand collapsed sections that have missing fields
          const newCollapsed = {...collapsed};
          let firstMissingEl = null;
          for (const inst of instances) {
            if (!isInstanceComplete(inst)) {
              newCollapsed[inst.instance_id] = false;
              if (!firstMissingEl) {
                setTimeout(() => {
                  const el = document.getElementById(`path-${inst.instance_id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
                firstMissingEl = true;
              }
            }
          }
          setCollapsed(newCollapsed);
          return;
        }
        setShowMissing(false);
        if (step < QUIZ_STEPS.length - 1) setStep(step + 1);
        else {
          // Build the API request — strip internal UI fields (prefixed with _)
          const cleanInstances = sortInstances(instances).map(inst => {
            const clean = {};
            for (const [k, v] of Object.entries(inst)) {
              if (!k.startsWith("_") && k !== "use_search" && k !== "use_transfer_search") {
                clean[k] = v;
              }
            }
            return clean;
          });
          // Include derived region so ResultsPage can use it for tax defaults
          const derivedRegion = METRO_REGION_MAP[shared.metro_area] || "midwest";
          onComplete({
            path_instances: cleanInstances,
            ...shared,
            region: derivedRegion,
          });
        }
      };
      const back = () => { if (step > 0) setStep(step - 1); };

      // Step 0: Path selection (add instances)
      const renderPathStep = () => (
        <div className="quiz-step">
          <h2>Build your comparison</h2>
          <p className="hint">Add the paths you want to compare. You can add the same type multiple times with different options (up to {MAX_INSTANCES} total).</p>

          {Object.entries(PATH_LABELS).map(([key, label]) => {
            const count = instances.filter(i => i.path_type === key).length;
            const typeInstances = instances.filter(i => i.path_type === key);
            return (
              <div key={key} className="path-type-card" style={count > 0 ? {borderColor: PATH_BASE_COLORS[key][0]} : {}}>
                <div className="path-type-header">
                  <div>
                    <div className="path-name" style={count > 0 ? {color: PATH_BASE_COLORS[key][0]} : {}}>
                      {label} {count > 0 && <span style={{fontSize:12, opacity:0.7}}>({count})</span>}
                    </div>
                    <div className="path-desc">{PATH_DESCRIPTIONS[key]}</div>
                  </div>
                  <button className="add-btn" onClick={() => addInstance(key)}
                    disabled={instances.length >= MAX_INSTANCES}>
                    + Add
                  </button>
                </div>
                {typeInstances.length > 0 && (
                  <div className="instance-chips">
                    {typeInstances.map((inst, idx) => {
                      const complete = isInstanceComplete(inst);
                      const missing = getMissingFields(inst);
                      return (
                        <div key={inst.instance_id} className="instance-chip"
                          style={{borderColor: instanceColor(inst, instances)}}>
                          <span style={{color: instanceColor(inst, instances)}}>
                            #{idx+1}{" "}
                            {complete
                              ? <span className="configured">{instanceSummary(inst)}</span>
                              : <span className="needs-action">{missing.map(m => m.label).join(", ")}</span>
                            }
                          </span>
                          <button className="remove-btn" onClick={() => removeInstance(inst.instance_id)}>x</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {instances.length > 0 && (
            <p style={{color: "var(--text-dim)", fontSize: 13, textAlign: "center", marginTop: 8}}>
              {instances.length} of {MAX_INSTANCES} slots used
            </p>
          )}
        </div>
      );

      // Step 1: Configure paths + family savings
      const renderDetailsStep = () => {
        const sorted = sortInstances(instances);
        return (
        <div className="quiz-step">
          <h2>Configure each path</h2>
          <p className="hint">Set the specific options for each path you added.</p>

          {/* Family savings — shared across all education paths */}
          <div className="card" style={{marginBottom: 16, padding: "12px 16px"}}>
            <div className="form-group" style={{marginBottom: 0}}>
              <label>Family savings for education</label>
              <p className="field-hint">Total amount your family can contribute across all years of school (e.g. $20,000 total, not per year). This reduces how much you need to borrow. Any amount beyond your total school cost will be added to your starting investments.</p>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#666",fontSize:14}}>$</span>
                <input type="number" className="form-select" style={{paddingLeft:22}} min="0" step="500"
                  value={shared.family_savings || ""}
                  placeholder="0"
                  onChange={e => updateShared("family_savings", Math.max(0, parseFloat(e.target.value) || 0))} />
              </div>
            </div>
          </div>

          {showMissing && !canNext() && (
            <div style={{
              background: "#f59e0b15", border: "1px solid #f59e0b40",
              borderRadius: 8, padding: "10px 14px", marginBottom: 12,
              color: "#f59e0b", fontSize: 13,
            }}>
              Some paths still need selections. Look for the highlighted fields below.
            </div>
          )}

          {sorted.map((inst, idx) => {
            const pt = inst.path_type;
            const color = instanceColor(inst, instances);
            const heading = instanceLabel(inst, instances);
            const complete = isInstanceComplete(inst);
            const missing = getMissingFields(inst);
            const isCollapsed = collapsed[inst.instance_id] && complete;
            const missingFieldNames = new Set(missing.map(m => m.field));

            return (
              <div key={inst.instance_id} id={`path-${inst.instance_id}`}
                className="path-section" style={{borderLeftColor: color}}>
                <div className="path-section-header" onClick={() => toggleCollapse(inst.instance_id)}>
                  <h3 style={{color, margin: 0, display: "flex", alignItems: "center"}}>
                    {heading}
                    {complete
                      ? <span className="path-status complete">Ready</span>
                      : <span className="path-status incomplete">{missing.length} field{missing.length > 1 ? "s" : ""} needed</span>
                    }
                  </h3>
                  <div className="path-section-toggle">
                    {complete && <span style={{color: "#10b981", fontSize: 12}}>
                      {instanceSummary(inst)}
                    </span>}
                    <span className={"chevron" + (isCollapsed ? " collapsed" : "")}>&#9660;</span>
                  </div>
                </div>
                <div className={"path-section-body" + (isCollapsed ? " collapsed" : "")}
                  style={isCollapsed ? {maxHeight: 0} : {maxHeight: 2000}}>

                {pt === "college" && (
                  <>
                    <div className="form-group">
                      <label>Choose your school</label>
                      <div className="school-mode-toggle">
                        <button className={"school-mode-btn" + (inst.use_search ? " active" : "")}
                          onClick={() => { updateInstance(inst.instance_id, "use_search", true); updateInstance(inst.instance_id, "ipeds_id", null); updateInstance(inst.instance_id, "_selected_school", null); }}>
                          Search by name
                        </button>
                        <button className={"school-mode-btn" + (!inst.use_search ? " active" : "")}
                          onClick={() => { updateInstance(inst.instance_id, "use_search", false); updateInstance(inst.instance_id, "ipeds_id", null); updateInstance(inst.instance_id, "_selected_school", null); }}>
                          Use general estimates
                        </button>
                      </div>
                      {inst.use_search ? (
                        <SchoolSearch
                          value={inst._selected_school}
                          levelFilter="1"
                          placeholder="Type a university name (e.g. Ohio State)..."
                          onSelect={(school) => {
                            updateInstance(inst.instance_id, "ipeds_id", school.id);
                            updateInstance(inst.instance_id, "_selected_school", school);
                            const st = school.control === 1 ? "public_in_state" : "private";
                            updateInstance(inst.instance_id, "school_type", st);
                            // Reset overrides so the new school's data shows
                            updateInstance(inst.instance_id, "tuition_override", null);
                            updateInstance(inst.instance_id, "room_board_override", null);
                          }}
                          onClear={() => {
                            updateInstance(inst.instance_id, "ipeds_id", null);
                            updateInstance(inst.instance_id, "_selected_school", null);
                            updateInstance(inst.instance_id, "tuition_override", null);
                            updateInstance(inst.instance_id, "room_board_override", null);
                          }}
                        />
                      ) : (
                        <select className={"form-select" + (showMissing && missingFieldNames.has("school_type") && !inst.school_type ? " field-missing" : "")} value={inst.school_type}
                          onChange={e => updateInstance(inst.instance_id, "school_type", e.target.value)}>
                          <option value="" disabled>Select school type...</option>
                          <option value="public_in_state">Public (In-State)</option>
                          <option value="public_out_of_state">Public (Out-of-State)</option>
                          <option value="private">Private University</option>
                        </select>
                      )}
                    </div>
                    {/* School Stats Panel — shown immediately after school selection */}
                    {inst.use_search && inst._selected_school && (
                      <SchoolStatsPanel
                        school={inst._selected_school}
                        schoolType={inst.school_type}
                        major={inst.major}
                        metroArea={shared.metro_area}
                        years={4}
                      />
                    )}
                    {/* When a school is selected, show editable cost fields */}
                    {inst.use_search && inst._selected_school && (
                      <>
                        {/* In-state vs out-of-state for public schools */}
                        {inst._selected_school.control === 1 && (
                          <div className="form-group">
                            <label>Residency status</label>
                            <select className="form-select" value={inst.school_type}
                              onChange={e => {
                                updateInstance(inst.instance_id, "school_type", e.target.value);
                                // Reset tuition override so it picks up the new rate
                                const s = inst._selected_school;
                                const newTuition = e.target.value === "public_out_of_state" ? s.tuition_out : s.tuition_in;
                                updateInstance(inst.instance_id, "tuition_override", newTuition);
                              }}>
                              <option value="public_in_state">In-State</option>
                              <option value="public_out_of_state">Out-of-State</option>
                            </select>
                          </div>
                        )}
                        <div className="form-group">
                          <label>Annual tuition + fees</label>
                          <p className="field-hint">From our database. Set to $0 for a full scholarship, or reduce for a partial one.</p>
                          <div style={{position:"relative"}}>
                            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#666",fontSize:14}}>$</span>
                            <input type="number" className="form-select" style={{paddingLeft:22}}
                              value={inst.tuition_override != null ? inst.tuition_override : (inst.school_type === "public_out_of_state" ? inst._selected_school.tuition_out : inst._selected_school.tuition_in) || ""}
                              onChange={e => updateInstance(inst.instance_id, "tuition_override", e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </div>
                        </div>
                        {inst._selected_school.room_board && (
                          <div className="form-group">
                            <label>Annual room & board</label>
                            <p className="field-hint">On-campus housing + meal plan cost per year. If you plan to live at home (set on the next page), set this to $0 to avoid double-counting.</p>
                            <div style={{position:"relative"}}>
                              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#666",fontSize:14}}>$</span>
                              <input type="number" className="form-select" style={{paddingLeft:22}}
                                value={inst.room_board_override != null ? inst.room_board_override : inst._selected_school.room_board || ""}
                                onChange={e => updateInstance(inst.instance_id, "room_board_override", e.target.value ? parseFloat(e.target.value) : null)}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="form-group">
                      <label>Loan repayment term (years)</label>
                      <p className="field-hint">Longer terms reduce monthly payments but increase total interest paid.</p>
                      <div style={{display: "flex", alignItems: "center", gap: 12}}>
                        <button className="btn btn-secondary" style={{padding: "8px 12px", fontSize: 14, minWidth: 40}}
                          onClick={() => updateInstance(inst.instance_id, "loan_term_years", Math.max(5, (inst.loan_term_years || 10) - 1))}>
                          −
                        </button>
                        <input type="number" className="form-select" min="5" max="30" step="1"
                          value={inst.loan_term_years || 10}
                          onChange={e => updateInstance(inst.instance_id, "loan_term_years", Math.max(5, Math.min(30, parseInt(e.target.value) || 10)))}
                          style={{flex: 1, textAlign: "center"}}
                        />
                        <button className="btn btn-secondary" style={{padding: "8px 12px", fontSize: 14, minWidth: 40}}
                          onClick={() => updateInstance(inst.instance_id, "loan_term_years", Math.min(30, (inst.loan_term_years || 10) + 1))}>
                          +
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Will you work part-time during school?</label>
                      <div style={{display: "flex", gap: 12, marginBottom: 12}}>
                        <button className={"btn" + (inst.part_time_work ? " btn-primary" : " btn-secondary")}
                          onClick={() => updateInstance(inst.instance_id, "part_time_work", true)}
                          style={{flex: 1}}>
                          Yes
                        </button>
                        <button className={"btn" + (!inst.part_time_work ? " btn-primary" : " btn-secondary")}
                          onClick={() => updateInstance(inst.instance_id, "part_time_work", false)}
                          style={{flex: 1}}>
                          No
                        </button>
                      </div>
                    </div>
                    {inst.part_time_work && (
                      <div className="form-group">
                        <label>Expected annual earnings</label>
                        <p className="field-hint">Estimated income from part-time work during the 4 school years.</p>
                        <div style={{position:"relative"}}>
                          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#666",fontSize:14}}>$</span>
                          <input type="number" className="form-select" style={{paddingLeft:22}} min="0"
                            value={inst.part_time_income || 8000}
                            onChange={e => updateInstance(inst.instance_id, "part_time_income", Math.max(0, parseInt(e.target.value) || 8000))}
                          />
                        </div>
                      </div>
                    )}
                    <div className={"form-group" + (showMissing && missingFieldNames.has("major") ? " field-missing" : "")}>
                      <label>Intended major</label>
                      <select className="form-select" value={inst.major}
                        onChange={e => updateInstance(inst.instance_id, "major", e.target.value)}>
                        <option value="" disabled>Select a major...</option>
                        {["computer_science","engineering","biology","environmental_science","nursing","kinesiology","business_finance","accounting","marketing","psychology","criminal_justice","political_science","communications","english","social_work","education","art_design","undecided"].map(m =>
                          <option key={m} value={m}>{LABEL_MAP[m]}</option>
                        )}
                      </select>
                    </div>
                  </>
                )}

                {pt === "cc_transfer" && (
                  <>
                    <div className="form-group">
                      <label>Community College (Years 1-2)</label>
                      <p className="field-hint">Optional: search for your specific CC for accurate tuition.</p>
                      <SchoolSearch
                        value={inst._selected_cc}
                        levelFilter="2"
                        placeholder="Search community colleges (optional)..."
                        onSelect={(school) => {
                          updateInstance(inst.instance_id, "ipeds_id_cc", school.id);
                          updateInstance(inst.instance_id, "_selected_cc", school);
                          updateInstance(inst.instance_id, "tuition_override_cc", null);
                        }}
                        onClear={() => {
                          updateInstance(inst.instance_id, "ipeds_id_cc", null);
                          updateInstance(inst.instance_id, "_selected_cc", null);
                          updateInstance(inst.instance_id, "tuition_override_cc", null);
                        }}
                      />
                      {inst._selected_cc && (
                        <SchoolStatsPanel
                          school={inst._selected_cc}
                          schoolType="public_in_state"
                          major={inst.major}
                          metroArea={shared.metro_area}
                          isCC={true}
                          years={2}
                        />
                      )}
                      {inst._selected_cc && (
                        <div className="form-group" style={{marginTop:8}}>
                          <label>CC annual tuition + fees</label>
                          <p className="field-hint">From our database. Set to $0 for a full scholarship, or reduce for a partial one.</p>
                          <div style={{position:"relative"}}>
                            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#666",fontSize:14}}>$</span>
                            <input type="number" className="form-select" style={{paddingLeft:22}}
                              value={inst.tuition_override_cc != null ? inst.tuition_override_cc : inst._selected_cc.tuition_in || ""}
                              onChange={e => updateInstance(inst.instance_id, "tuition_override_cc", e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Transfer University (Years 3-4)</label>
                      <div className="school-mode-toggle">
                        <button className={"school-mode-btn" + (inst.use_transfer_search ? " active" : "")}
                          onClick={() => { updateInstance(inst.instance_id, "use_transfer_search", true); updateInstance(inst.instance_id, "ipeds_id_transfer", null); updateInstance(inst.instance_id, "_selected_transfer", null); }}>
                          Search by name
                        </button>
                        <button className={"school-mode-btn" + (!inst.use_transfer_search ? " active" : "")}
                          onClick={() => { updateInstance(inst.instance_id, "use_transfer_search", false); updateInstance(inst.instance_id, "ipeds_id_transfer", null); updateInstance(inst.instance_id, "_selected_transfer", null); }}>
                          Use general estimates
                        </button>
                      </div>
                      {inst.use_transfer_search ? (
                        <SchoolSearch
                          value={inst._selected_transfer}
                          levelFilter="1"
                          placeholder="Type a university name..."
                          onSelect={(school) => {
                            updateInstance(inst.instance_id, "ipeds_id_transfer", school.id);
                            updateInstance(inst.instance_id, "_selected_transfer", school);
                            const st = school.control === 1 ? "public_in_state" : "private";
                            updateInstance(inst.instance_id, "transfer_university_type", st);
                            updateInstance(inst.instance_id, "tuition_override_transfer", null);
                          }}
                          onClear={() => {
                            updateInstance(inst.instance_id, "ipeds_id_transfer", null);
                            updateInstance(inst.instance_id, "_selected_transfer", null);
                            updateInstance(inst.instance_id, "tuition_override_transfer", null);
                          }}
                        />
                      ) : (
                        <select className={"form-select" + (showMissing && missingFieldNames.has("transfer_university_type") && !inst.transfer_university_type ? " field-missing" : "")} value={inst.transfer_university_type}
                          onChange={e => updateInstance(inst.instance_id, "transfer_university_type", e.target.value)}>
                          <option value="" disabled>Select school type...</option>
                          <option value="public_in_state">Public (In-State)</option>
                          <option value="public_out_of_state">Public (Out-of-State)</option>
                          <option value="private">Private University</option>
                        </select>
                      )}
                      {/* Stats panel for transfer university */}
                      {inst.use_transfer_search && inst._selected_transfer && (
                        <SchoolStatsPanel
                          school={inst._selected_transfer}
                          schoolType={inst.transfer_university_type}
                          major={inst.major}
                          metroArea={shared.metro_area}
                          years={2}
                        />
                      )}
                      {/* Editable tuition for selected transfer university */}
                      {inst.use_transfer_search && inst._selected_transfer && (
                        <div style={{marginTop:8}}>
                          {inst._selected_transfer.control === 1 && (
                            <div className="form-group">
                              <label>Residency status</label>
                              <select className="form-select" value={inst.transfer_university_type}
                                onChange={e => {
                                  updateInstance(inst.instance_id, "transfer_university_type", e.target.value);
                                  const s = inst._selected_transfer;
                                  const newTuition = e.target.value === "public_out_of_state" ? s.tuition_out : s.tuition_in;
                                  updateInstance(inst.instance_id, "tuition_override_transfer", newTuition);
                                }}>
                                <option value="public_in_state">In-State</option>
                                <option value="public_out_of_state">Out-of-State</option>
                              </select>
                            </div>
                          )}
                          <div className="form-group">
                            <label>Transfer university annual tuition + fees</label>
                            <p className="field-hint">From our database. Set to $0 for a full scholarship, or reduce for a partial one.</p>
                            <div style={{position:"relative"}}>
                              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#666",fontSize:14}}>$</span>
                              <input type="number" className="form-select" style={{paddingLeft:22}}
                                value={inst.tuition_override_transfer != null ? inst.tuition_override_transfer : (inst.transfer_university_type === "public_out_of_state" ? inst._selected_transfer.tuition_out : inst._selected_transfer.tuition_in) || ""}
                                onChange={e => updateInstance(inst.instance_id, "tuition_override_transfer", e.target.value ? parseFloat(e.target.value) : null)}
                              />
                            </div>
                          </div>
                          {inst._selected_transfer.room_board && (
                            <div className="form-group">
                              <label>Annual room & board</label>
                              <p className="field-hint">On-campus housing + meal plan for transfer years. If you plan to live at home (set on the next page), set this to $0 to avoid double-counting.</p>
                              <div style={{position:"relative"}}>
                                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#666",fontSize:14}}>$</span>
                                <input type="number" className="form-select" style={{paddingLeft:22}}
                                  value={inst.room_board_override != null ? inst.room_board_override : inst._selected_transfer.room_board || ""}
                                  onChange={e => updateInstance(inst.instance_id, "room_board_override", e.target.value ? parseFloat(e.target.value) : null)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Loan repayment term (years)</label>
                      <p className="field-hint">Longer terms reduce monthly payments but increase total interest paid.</p>
                      <div style={{display: "flex", alignItems: "center", gap: 12}}>
                        <button className="btn btn-secondary" style={{padding: "8px 12px", fontSize: 14, minWidth: 40}}
                          onClick={() => updateInstance(inst.instance_id, "loan_term_years", Math.max(5, (inst.loan_term_years || 10) - 1))}>
                          −
                        </button>
                        <input type="number" className="form-select" min="5" max="30" step="1"
                          value={inst.loan_term_years || 10}
                          onChange={e => updateInstance(inst.instance_id, "loan_term_years", Math.max(5, Math.min(30, parseInt(e.target.value) || 10)))}
                          style={{flex: 1, textAlign: "center"}}
                        />
                        <button className="btn btn-secondary" style={{padding: "8px 12px", fontSize: 14, minWidth: 40}}
                          onClick={() => updateInstance(inst.instance_id, "loan_term_years", Math.min(30, (inst.loan_term_years || 10) + 1))}>
                          +
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Will you work part-time during school?</label>
                      <div style={{display: "flex", gap: 12, marginBottom: 12}}>
                        <button className={"btn" + (inst.part_time_work ? " btn-primary" : " btn-secondary")}
                          onClick={() => updateInstance(inst.instance_id, "part_time_work", true)}
                          style={{flex: 1}}>
                          Yes
                        </button>
                        <button className={"btn" + (!inst.part_time_work ? " btn-primary" : " btn-secondary")}
                          onClick={() => updateInstance(inst.instance_id, "part_time_work", false)}
                          style={{flex: 1}}>
                          No
                        </button>
                      </div>
                    </div>
                    {inst.part_time_work && (
                      <div className="form-group">
                        <label>Expected annual earnings</label>
                        <p className="field-hint">Estimated income from part-time work during the 4 school years.</p>
                        <div style={{position:"relative"}}>
                          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#666",fontSize:14}}>$</span>
                          <input type="number" className="form-select" style={{paddingLeft:22}} min="0"
                            value={inst.part_time_income || 10000}
                            onChange={e => updateInstance(inst.instance_id, "part_time_income", Math.max(0, parseInt(e.target.value) || 10000))}
                          />
                        </div>
                      </div>
                    )}
                    <div className={"form-group" + (showMissing && missingFieldNames.has("major") ? " field-missing" : "")}>
                      <label>Intended major</label>
                      <select className="form-select" value={inst.major}
                        onChange={e => updateInstance(inst.instance_id, "major", e.target.value)}>
                        <option value="" disabled>Select a major...</option>
                        {["computer_science","engineering","biology","environmental_science","nursing","kinesiology","business_finance","accounting","marketing","psychology","criminal_justice","political_science","communications","english","social_work","education","art_design","undecided"].map(m =>
                          <option key={m} value={m}>{LABEL_MAP[m]}</option>
                        )}
                      </select>
                    </div>
                    <p style={{fontSize: 12, color: "var(--text-dim)", marginTop: 4, fontStyle: "italic"}}>
                      Note: CC transfer graduates typically earn ~2% less than direct 4-year grads in the same major, based on NACE employment data.
                    </p>
                  </>
                )}

                {pt === "trade" && (
                  <>
                    <div className={"form-group" + (showMissing && missingFieldNames.has("trade_type") ? " field-missing" : "")}>
                      <label>Which trade?</label>
                      <select className="form-select" value={inst.trade_type}
                        onChange={e => updateInstance(inst.instance_id, "trade_type", e.target.value)}>
                        <option value="" disabled>Select a trade...</option>
                        {["electrician","plumber","hvac","carpenter","welder","automotive_tech","diesel_mechanic","cnc_machinist","lineworker","ironworker","elevator_mechanic","heavy_equipment_op"].map(t =>
                          <option key={t} value={t}>{LABEL_MAP[t]}</option>
                        )}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Loan repayment term (years)</label>
                      <p className="field-hint">Trade school loans are typically shorter than college loans. Range: 3-15 years.</p>
                      <div style={{display: "flex", alignItems: "center", gap: 12}}>
                        <button className="btn btn-secondary" style={{padding: "8px 12px", fontSize: 14, minWidth: 40}}
                          onClick={() => updateInstance(inst.instance_id, "loan_term_years", Math.max(3, (inst.loan_term_years || 5) - 1))}>
                          −
                        </button>
                        <input type="number" className="form-select" min="3" max="15" step="1"
                          value={inst.loan_term_years || 5}
                          onChange={e => updateInstance(inst.instance_id, "loan_term_years", Math.max(3, Math.min(15, parseInt(e.target.value) || 5)))}
                          style={{flex: 1, textAlign: "center"}}
                        />
                        <button className="btn btn-secondary" style={{padding: "8px 12px", fontSize: 14, minWidth: 40}}
                          onClick={() => updateInstance(inst.instance_id, "loan_term_years", Math.min(15, (inst.loan_term_years || 5) + 1))}>
                          +
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {pt === "workforce" && (
                  <div className={"form-group" + (showMissing && missingFieldNames.has("industry") ? " field-missing" : "")}>
                    <label>Industry</label>
                    <select className="form-select" value={inst.industry}
                      onChange={e => updateInstance(inst.instance_id, "industry", e.target.value)}>
                      <option value="" disabled>Select an industry...</option>
                      {["retail","logistics","food_service","admin","manufacturing","security","landscaping","customer_service","delivery_driver","janitorial","home_health_aide","childcare"].map(i =>
                        <option key={i} value={i}>{LABEL_MAP[i]}</option>
                      )}
                    </select>
                  </div>
                )}

                {pt === "military" && (
                  <>
                    <div className="form-group">
                      <label>Use GI Bill for college after service?</label>
                      <div className="toggle-row" onClick={() => updateInstance(inst.instance_id, "use_gi_bill", !inst.use_gi_bill)}>
                        <div className={"toggle-indicator" + (inst.use_gi_bill ? " on" : "")}>
                          {inst.use_gi_bill ? "✓" : ""}
                        </div>
                        <span>{inst.use_gi_bill ? "Yes — pursue a degree after service" : "No — enter civilian workforce directly"}</span>
                      </div>
                    </div>
                    {inst.use_gi_bill && (
                      <div className={"form-group" + (showMissing && missingFieldNames.has("gi_bill_major") ? " field-missing" : "")}>
                        <label>Post-service major</label>
                        <select className="form-select" value={inst.gi_bill_major}
                          onChange={e => updateInstance(inst.instance_id, "gi_bill_major", e.target.value)}>
                          <option value="" disabled>Select a major...</option>
                          {["computer_science","engineering","biology","environmental_science","nursing","kinesiology","business_finance","accounting","marketing","psychology","criminal_justice","political_science","communications","english","social_work","education","art_design","undecided"].map(m =>
                            <option key={m} value={m}>{LABEL_MAP[m]}</option>
                          )}
                        </select>
                      </div>
                    )}
                  </>
                )}
                </div>{/* end path-section-body */}
              </div>
            );
          })}

          {instances.length === 0 && (
            <p style={{color: "var(--text-dim)", padding: 20, textAlign: "center"}}>
              Go back and add at least one path to compare.
            </p>
          )}
        </div>
      );
      };

      // Step 2: Post-graduation location & living situation
      const renderLocationStep = () => {
        const selectedMetro = metros.find(m => m.code === shared.metro_area);
        return (
        <div className="quiz-step">
          <h2>Post-graduation location</h2>
          <p className="hint">Where you plan to live affects salary expectations and cost of living.</p>

          <div className="form-group">
            <label>Where do you plan to live after graduation?</label>
            <select className="form-select" value={shared.metro_area}
              onChange={e => updateShared("metro_area", e.target.value)}>
              {metros.length > 0 ? metros.map(m => (
                <option key={m.code} value={m.code}>{m.label}</option>
              )) : (
                <option value="national_avg">Other / National Average</option>
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Will you live at home after graduation?</label>
            <div style={{display: "flex", gap: 12, marginBottom: 12}}>
              <button className={"btn" + (shared.living_at_home ? " btn-primary" : " btn-secondary")}
                onClick={() => updateShared("living_at_home", true)}
                style={{flex: 1}}>
                Yes
              </button>
              <button className={"btn" + (!shared.living_at_home ? " btn-primary" : " btn-secondary")}
                onClick={() => updateShared("living_at_home", false)}
                style={{flex: 1}}>
                No
              </button>
            </div>
          </div>

          {shared.living_at_home && (
            <div className="form-group">
              <label>How many years at home?</label>
              <input type="number" className="form-select" min="1" max="15" step="1"
                value={shared.years_at_home}
                onChange={e => updateShared("years_at_home", Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))} />
              <p className="field-hint">Living at home typically means living with parents or family to reduce rent and utility costs.</p>
            </div>
          )}
        </div>
      );
      };

      // Step 3: Review (sorted by path type)
      const renderReviewStep = () => {
        const sorted = sortInstances(instances);
        const metroLabel = (metros.find(m => m.code === shared.metro_area) || {}).label || "National Average";
        return (
        <div className="quiz-step">
          <h2>Review your choices</h2>
          <p className="hint">Everything look right? Hit "Run Simulation" to see your results.</p>

          <div className="card" style={{marginBottom: 16}}>
            <div style={{marginBottom: 12}}>
              <strong>Comparing:</strong> {instances.length} path{instances.length > 1 ? "s" : ""}
            </div>
            <div style={{marginBottom: 8}}><strong>Location:</strong> {metroLabel}</div>
            <div style={{marginBottom: 8}}><strong>Living at home:</strong> {shared.living_at_home ? `Yes (${shared.years_at_home} year${shared.years_at_home>1?"s":""})` : "No"}</div>
            <div><strong>Family savings:</strong> {fmtFull(shared.family_savings)}</div>
          </div>

          {sorted.map(inst => {
            const color = instanceColor(inst, instances);
            return (
              <div key={inst.instance_id} className="card" style={{padding: "12px 16px", marginBottom: 8, borderLeft: `3px solid ${color}`}}>
                <strong style={{color}}>{instanceLabel(inst, instances)}</strong>
                <span style={{color: "var(--text-dim)"}}> — {instanceSummary(inst)}</span>
              </div>
            );
          })}
        </div>
      );
      };

      const stepRenderers = [renderPathStep, renderDetailsStep, renderLocationStep, renderReviewStep];

      return (
        <div className="quiz-container">
          <div className="quiz-progress">
            {QUIZ_STEPS.map((s, i) => (
              <div key={s} className={"step" + (i < step ? " done" : "") + (i === step ? " current" : "")} />
            ))}
          </div>

          {stepRenderers[step]()}

          <div className="btn-row">
            {step > 0 && <button className="btn btn-secondary" onClick={back}>Back</button>}
            <button className="btn btn-primary" onClick={next} disabled={!canNext()}>
              {step === QUIZ_STEPS.length - 1 ? "Run Simulation →" : "Continue →"}
            </button>
          </div>
        </div>
      );
    }

    // ============================================================
    // RESULTS PAGE (instance-aware)
    // ============================================================

    const CHART_TABS = [
      { key: "nw", label: "Net Worth", title: "Net Worth Over Time", subtitle: "Investments minus debt — the bottom line", suffix: null },
      { key: "income", label: "Income", title: "Annual Income", subtitle: "Gross income each year (part-time, apprentice wages, military pay, salary)", suffix: null },
      { key: "cum_earn", label: "Cumulative Earnings", title: "Cumulative Earnings", subtitle: "Total gross income earned through each age", suffix: null },
      { key: "debt", label: "Debt", title: "Student Debt Over Time", subtitle: "Outstanding student loan balance (paths with no debt are hidden)", suffix: null },
      { key: "invest", label: "Investments", title: "Investment Growth", subtitle: "Savings compounding at the configured annual return rate", suffix: null },
      { key: "savings", label: "Realized Savings Rate", title: "Realized Savings Rate", subtitle: "Percentage of income actually saved after taxes, expenses, and loan payments", suffix: "%" },
      { key: "loan_pay", label: "Loan Payments", title: "Annual Loan Payments", subtitle: "Amount paid toward student loans each year", suffix: null },
      { key: "annual_save", label: "Annual Savings", title: "Annual Savings Contribution", subtitle: "New savings contributed each year after all expenses", suffix: null },
      { key: "cum_tax", label: "Taxes Paid", title: "Cumulative Taxes Paid", subtitle: "Total taxes paid through each age", suffix: null },
    ];

    function ResultsPage({ quiz, onReset, onSave, saveStatus }) {
      const [results, setResults] = useState(null);
      const [chartData, setChartData] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [projYears, setProjYears] = useState(quiz.projection_years || 32);
      const [activeTab, setActiveTab] = useState("nw");
      const sliderTimeout = useRef(null);
      const assumptionTimeout = useRef(null);

      // Advanced Assumptions state
      const [showAdvanced, setShowAdvanced] = useState(false);
      const [savingsRate, setSavingsRate] = useState(0.10);
      const [investReturn, setInvestReturn] = useState(0.07);
      const [taxRate, setTaxRate] = useState(REGION_TAX_DEFAULTS[quiz.region] || 0.22);
      const [startAge, setStartAge] = useState(18);

      // Year-by-year breakdown table state
      const [showTable, setShowTable] = useState(false);
      const [tableTab, setTableTab] = useState("");

      // Build color and label maps from quiz instances
      const instances = quiz.path_instances || [];
      const colorMap = buildColorMap(instances);
      const labelMap = buildLabelMap(instances, results);

      const fetchData = useCallback((years, sr, ir, tr, sa) => {
        setLoading(true);
        setError(null);
        const body = {
          ...quiz,
          projection_years: years,
          savings_rate: sr,
          investment_return_rate: ir,
          tax_rate: tr,
          start_age: sa,
        };

        fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then(r => { if (!r.ok) throw new Error("API error " + r.status); return r.json(); })
          .then(data => {
            setResults(data.results);
            setChartData(buildChartData(data.results));
            setLoading(false);
          })
          .catch(e => { setError(e.message); setLoading(false); });
      }, [quiz]);

      useEffect(() => { fetchData(projYears, savingsRate, investReturn, taxRate, startAge); }, []);

      const handleSlider = (e) => {
        const y = parseInt(e.target.value);
        setProjYears(y);
        if (sliderTimeout.current) clearTimeout(sliderTimeout.current);
        sliderTimeout.current = setTimeout(() => fetchData(y, savingsRate, investReturn, taxRate, startAge), 200);
      };

      const handleAssumptionChange = (setter, value, sr, ir, tr, sa) => {
        setter(value);
        if (assumptionTimeout.current) clearTimeout(assumptionTimeout.current);
        assumptionTimeout.current = setTimeout(() => fetchData(projYears, sr, ir, tr, sa), 300);
      };

      if (loading && !results) {
        return (
          <div>
            <div className="loading"><div className="spinner" /><p>Running {projYears}-year projections...</p></div>
          </div>
        );
      }

      if (error && !results) {
        return (
          <div className="error-box">
            <h3>Simulation Error</h3>
            <p>{error}</p>
            <button className="btn btn-secondary" style={{marginTop:16}} onClick={onReset}>Try Again</button>
          </div>
        );
      }

      if (!results) return null;

      const endAge = startAge + projYears - 1;
      const tab = CHART_TABS.find(t => t.key === activeTab);

      // Filter out zero-debt instances for the debt chart
      const filteredResults = activeTab === "debt"
        ? (() => {
            const debtResults = results.filter(r =>
              r.snapshots.some(s => s.debt_remaining > 0)
            );
            if (debtResults.length === 0) return null;
            return debtResults;
          })()
        : results;

      // Preserve user-selected order (no sorting by net worth)
      const sorted = results;

      return (
        <div>
          {/* Status bar */}
          <div className="status-bar">
            <span className="badge active">{results.length} Path{results.length>1?"s":""} Compared</span>
            <span className="badge active">{LABEL_MAP[quiz.metro_area] || LABEL_MAP[quiz.region] || "National Average"}</span>
            <span className="badge active">{projYears}-Year Projection (ages {startAge}–{endAge})</span>
            <span className="badge" style={{cursor:"pointer", borderColor:"var(--danger)", color:"var(--danger)"}} onClick={onReset}>
              Start New Projection
            </span>
          </div>

          {/* Timeline slider */}
          <div className="card" style={{textAlign:"center", padding:"16px 24px"}}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:16, flexWrap:"wrap"}}>
              <span style={{color:"var(--text-dim)", fontSize:13}}>Timeline:</span>
              <span style={{fontSize:13}}>10 yrs</span>
              <input type="range" min={10} max={50} value={projYears} onChange={handleSlider}
                style={{width:"280px", accentColor:"var(--accent)", cursor:"pointer"}} />
              <span style={{fontSize:13}}>50 yrs</span>
              <span style={{fontWeight:700, fontSize:18, color:"var(--accent)", minWidth:90}}>
                {projYears} years
              </span>
            </div>
            {loading && <p style={{color:"var(--text-dim)", fontSize:12, marginTop:4}}>Updating...</p>}
          </div>

          {/* Advanced Assumptions (collapsible) */}
          <div className="card" style={{padding: 0, overflow: "hidden"}}>
            <div onClick={() => setShowAdvanced(!showAdvanced)}
              style={{padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
              <span style={{fontWeight: 600, fontSize: 14, color: "var(--text-dim)"}}>Advanced Assumptions</span>
              <span style={{color: "var(--text-dim)", fontSize: 12}}>{showAdvanced ? "▲ Collapse" : "▼ Expand"}</span>
            </div>
            {showAdvanced && (
              <div style={{padding: "0 20px 20px", borderTop: "1px solid var(--border)"}}>
                <div style={{marginTop: 16, marginBottom: 20}}>
                  <div style={{display: "flex", justifyContent: "space-between", marginBottom: 6}}>
                    <label style={{fontSize: 13}}>Starting Age</label>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--accent)"}}>{startAge}</span>
                  </div>
                  <input type="range" min={15} max={40} step={1} value={startAge}
                    onChange={e => { const v = parseInt(e.target.value); handleAssumptionChange(setStartAge, v, savingsRate, investReturn, taxRate, v); }}
                    style={{width: "100%", accentColor: "var(--accent)", cursor: "pointer"}} />
                  <p style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
                    Age when you start your post-graduation path (default: 18)
                  </p>
                </div>

                <div style={{marginBottom: 20}}>
                  <div style={{display: "flex", justifyContent: "space-between", marginBottom: 6}}>
                    <label style={{fontSize: 13}}>Savings Rate</label>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--accent)"}}>{Math.round(savingsRate * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={Math.round(savingsRate * 100)}
                    onChange={e => { const v = parseInt(e.target.value) / 100; handleAssumptionChange(setSavingsRate, v, v, investReturn, taxRate, startAge); }}
                    style={{width: "100%", accentColor: "var(--accent)", cursor: "pointer"}} />
                  <p style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
                    Percent of after-tax income saved annually
                  </p>
                </div>

                <div style={{marginBottom: 20}}>
                  <div style={{display: "flex", justifyContent: "space-between", marginBottom: 6}}>
                    <label style={{fontSize: 13}}>Expected Annual Investment Return</label>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--accent)"}}>{(investReturn * 100).toFixed(1)}%</span>
                  </div>
                  <input type="range" min={0} max={200} step={5} value={Math.round(investReturn * 1000)}
                    onChange={e => { const v = parseInt(e.target.value) / 1000; handleAssumptionChange(setInvestReturn, v, savingsRate, v, taxRate, startAge); }}
                    style={{width: "100%", accentColor: "var(--accent)", cursor: "pointer"}} />
                  <p style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
                    Historical average: ~7%/year after inflation. Conservative: 6%. Aggressive: 8%.
                  </p>
                </div>

                <div>
                  <div style={{display: "flex", justifyContent: "space-between", marginBottom: 6}}>
                    <label style={{fontSize: 13}}>Estimated Effective Income Tax Rate</label>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--accent)"}}>{Math.round(taxRate * 100)}%</span>
                  </div>
                  <input type="range" min={10} max={40} step={1} value={Math.round(taxRate * 100)}
                    onChange={e => { const v = parseInt(e.target.value) / 100; handleAssumptionChange(setTaxRate, v, savingsRate, investReturn, v, startAge); }}
                    style={{width: "100%", accentColor: "var(--accent)", cursor: "pointer"}} />
                  <p style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
                    Blended federal + state + payroll tax burden. {LABEL_MAP[quiz.metro_area] || LABEL_MAP[quiz.region]} region average: {Math.round((REGION_TAX_DEFAULTS[quiz.region] || 0.22) * 100)}%.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Summary cards */}
          <div className="summary-grid">
            {sorted.map((r, i) => {
              const id = r.scenario.instance_id || r.scenario.path_type;
              const color = colorMap[id] || "#888";
              const label = labelMap[id] || r.scenario.name;
              const finalNW = r.snapshots[r.snapshots.length-1].net_worth;
              const df = r.summary.year_debt_free;
              const totalEarn = r.summary.total_earnings;

              return (
                <div className="summary-card" key={id} style={{borderLeft:`3px solid ${color}`}}>
                  <div className="label" style={{color}}>#{i+1} — {label}</div>
                  <div className="value" style={{color}}>{fmtFull(finalNW)}</div>
                  <div className="detail">
                    {df ? `Debt-free at age ${df}` : "No student debt"}
                    {" · "}{fmt(totalEarn)} earned
                  </div>
                </div>
              );
            })}
          </div>

          {/* Disclaimer banner */}
          <div className="disclaimer-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>All figures are in <strong>nominal dollars</strong>. Living expenses grow at 3% annually to reflect inflation; income and investment returns are not inflation-adjusted. These projections use simplified assumptions and national averages. Your actual results will vary.</span>
          </div>

          {/* Chart tabs */}
          <div className="card">
            <div className="chart-tabs">
              {CHART_TABS.map(t => (
                <div key={t.key} className={"chart-tab" + (activeTab === t.key ? " active" : "")}
                  onClick={() => setActiveTab(t.key)}>
                  {t.label}
                </div>
              ))}
            </div>

            <h2>{tab.title}</h2>
            <p className="subtitle">{tab.subtitle}</p>

            {activeTab === "debt" && !filteredResults ? (
              <p style={{color:"var(--text-dim)", padding:"40px 0", textAlign:"center"}}>
                No paths in this comparison carry student debt.
              </p>
            ) : (
              <SimChart
                data={chartData}
                results={filteredResults || results}
                dataKeySuffix={activeTab}
                suffix={tab.suffix}
                yDomain={activeTab === "savings" ? [0, "auto"] : undefined}
                colorMap={colorMap}
                labelMap={labelMap}
                savingsRate={savingsRate}
              />
            )}
          </div>

          {/* Key insights */}
          <div className="card">
            <h2>Key Insights</h2>
            <p className="subtitle">What the numbers tell us about your options</p>
            <div style={{lineHeight: 1.8, fontSize: 14}}>
              {sorted.length >= 2 && (() => {
                const best = sorted[0], worst = sorted[sorted.length - 1];
                const bestNW = best.snapshots[best.snapshots.length-1].net_worth;
                const worstNW = worst.snapshots[worst.snapshots.length-1].net_worth;
                const gap = bestNW - worstNW;
                const bestId = best.scenario.instance_id || best.scenario.path_type;
                const worstId = worst.scenario.instance_id || worst.scenario.path_type;

                return (
                  <div>
                    <p style={{marginBottom: 12}}>
                      Over {projYears} years, <strong style={{color: colorMap[bestId]}}>{labelMap[bestId]}</strong> leads
                      with a projected net worth of <strong>{fmtFull(bestNW)}</strong>, which
                      is <strong>{fmtFull(gap)}</strong> more
                      than <strong style={{color: colorMap[worstId]}}>{labelMap[worstId]}</strong> ({fmtFull(worstNW)}).
                    </p>
                    {sorted.filter(r => r.summary.year_debt_free).length > 0 && (
                      <p style={{marginBottom: 12}}>
                        <strong>Debt timelines:</strong>{" "}
                        {sorted.filter(r => r.summary.year_debt_free).map(r => {
                          const rid = r.scenario.instance_id || r.scenario.path_type;
                          return `${labelMap[rid]} is debt-free at age ${r.summary.year_debt_free}`;
                        }).join("; ")}
                        {sorted.filter(r => !r.summary.year_debt_free && r.summary.total_cost_of_education === 0).length > 0 &&
                          "; " + sorted.filter(r => !r.summary.year_debt_free && r.summary.total_cost_of_education === 0)
                            .map(r => labelMap[r.scenario.instance_id || r.scenario.path_type]).join(", ") + " carry no student debt"
                        }.
                      </p>
                    )}
                    {sorted.filter(r => r.summary.debt_burden_ratio > 0).length > 0 && (
                      <p style={{marginBottom: 12}}>
                        <strong>Peak debt burden:</strong>{" "}
                        {sorted.filter(r => r.summary.debt_burden_ratio > 0).map(r => {
                          const rid = r.scenario.instance_id || r.scenario.path_type;
                          const pct = (r.summary.debt_burden_ratio * 100).toFixed(0);
                          const level = r.summary.debt_burden_ratio > 0.15 ? " (high)" : r.summary.debt_burden_ratio > 0.10 ? " (moderate)" : " (manageable)";
                          return `${labelMap[rid]}: ${pct}% of income${level}`;
                        }).join("; ")}.
                        <span style={{color:"var(--text-dim)", fontSize:12}}> Peak annual loan payment as % of take-home pay. Under 10% is comfortable; over 15% can be a strain.</span>
                      </p>
                    )}
                    {sorted.filter(r => r.summary.loan_extended).length > 0 && (
                      <p style={{marginBottom: 12, padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, fontSize: 13}}>
                        <strong style={{color: "#f59e0b"}}>Loan repayment adjusted:</strong>{" "}
                        {sorted.filter(r => r.summary.loan_extended).map(r => {
                          const rid = r.scenario.instance_id || r.scenario.path_type;
                          const orig = r.summary.loan_term_original;
                          const actual = r.summary.loan_term_actual;
                          return `${labelMap[rid]}: selected ${orig}-year repayment, but income-based payments extend it to ~${actual} years`;
                        }).join("; ")}.
                        <br /><span style={{color: "var(--text-dim)"}}>Loan payments are capped at what you can afford after living expenses. The remaining balance continues accruing interest.</span>
                      </p>
                    )}
                    <p style={{color: "var(--text-dim)", fontStyle: "italic", marginTop: 16}}>
                      Try adjusting the timeline slider above — shorter horizons (10-15 years) tend to favor paths
                      with no debt, while longer horizons (30+ years) show the compounding advantage of higher salaries.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Year-by-Year Breakdown */}
          {(() => {
            const effectiveTab = tableTab || (results[0]?.scenario.instance_id || results[0]?.scenario.path_type || "");
            const activeResult = results.find(r => (r.scenario.instance_id || r.scenario.path_type) === effectiveTab);

            const pathFormulas = {
              college: "Income during school = part-time work earnings. After graduation: Starting Salary × (1 + Growth Rate)^years of experience. Grace period year = 50% of starting salary.",
              cc_transfer: "Same as 4-year college, but starting salary is ~2% lower for CC transfers. First 2 years at community college tuition rates.",
              trade: "Apprentice wages increase each year (40→60→75→90% of journeyman rate). After apprenticeship: Journeyman Salary × (1 + Growth Rate)^years.",
              workforce: "Starting Wage × (1.02)^years. No education costs or debt. Income begins immediately.",
              military: "Active duty pay during service (E1→E4 progression). GI Bill housing allowance (~$28k/yr, tax-exempt) during school. Then civilian career salary.",
            };
            const sharedFormulas = "Savings = max(0, (Net Income − Living Expenses − Loan Payment) × Savings Rate)\nInvestments = Previous Balance × (1 + Return Rate) + Annual Savings\nNet Worth = Investment Balance − Remaining Debt";

            return (
              <div className="card" style={{padding: 0, overflow: "hidden"}}>
                <div onClick={() => setShowTable(!showTable)}
                  style={{padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                  <span style={{fontWeight: 600, fontSize: 14}}>Year-by-Year Breakdown</span>
                  <span style={{color: "var(--text-dim)", fontSize: 12}}>{showTable ? "▲ Collapse" : "▼ Expand"}</span>
                </div>
                {showTable && (
                  <div style={{borderTop: "1px solid var(--border)"}}>
                    {/* Path tabs */}
                    <div style={{display: "flex", gap: 0, borderBottom: "1px solid var(--border)", overflowX: "auto"}}>
                      {results.map(r => {
                        const id = r.scenario.instance_id || r.scenario.path_type;
                        return (
                          <button key={id} onClick={() => setTableTab(id)}
                            style={{padding: "10px 16px", fontSize: 12, fontWeight: effectiveTab === id ? 600 : 400,
                              background: effectiveTab === id ? "var(--surface)" : "transparent",
                              borderBottom: effectiveTab === id ? "2px solid var(--accent)" : "2px solid transparent",
                              color: effectiveTab === id ? "var(--accent)" : "var(--text-dim)",
                              border: "none", cursor: "pointer", whiteSpace: "nowrap"}}>
                            {labelMap[id] || id}
                          </button>
                        );
                      })}
                    </div>
                    {/* Data table */}
                    {activeResult && (
                      <div style={{overflowX: "auto", padding: "0 0 16px 0"}}>
                        <table style={{width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900}}>
                          <thead>
                            <tr style={{background: "var(--bg)", position: "sticky", top: 0}}>
                              {["Year","Age","Gross Income","Net Income","Expenses","Loan Payment","Debt","Savings","Investments","Net Worth"].map(h => (
                                <th key={h} style={{padding: "8px 10px", textAlign: "right", borderBottom: "1px solid var(--border)", color: "var(--text-dim)", fontWeight: 600, whiteSpace: "nowrap"}}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activeResult.snapshots.map((s, i) => (
                              <tr key={i} style={{borderBottom: "1px solid var(--border)"}}>
                                <td style={{padding: "6px 10px", textAlign: "right"}}>{s.year + 1}</td>
                                <td style={{padding: "6px 10px", textAlign: "right"}}>{s.age}</td>
                                <td style={{padding: "6px 10px", textAlign: "right", color: "#4ade80"}}>{fmtFull(s.gross_income)}</td>
                                <td style={{padding: "6px 10px", textAlign: "right"}}>{fmtFull(s.net_income)}</td>
                                <td style={{padding: "6px 10px", textAlign: "right", color: "#f87171"}}>{fmtFull(s.living_expenses)}</td>
                                <td style={{padding: "6px 10px", textAlign: "right", color: s.loan_payment > 0 ? "#fbbf24" : "var(--text-dim)"}}>{fmtFull(s.loan_payment)}</td>
                                <td style={{padding: "6px 10px", textAlign: "right", color: s.debt_remaining > 0 ? "#f87171" : "var(--text-dim)"}}>{fmtFull(s.debt_remaining)}</td>
                                <td style={{padding: "6px 10px", textAlign: "right", color: "#60a5fa"}}>{fmtFull(s.annual_savings)}</td>
                                <td style={{padding: "6px 10px", textAlign: "right", color: "#a78bfa"}}>{fmtFull(s.investment_balance)}</td>
                                <td style={{padding: "6px 10px", textAlign: "right", fontWeight: 600, color: s.net_worth >= 0 ? "#4ade80" : "#f87171"}}>{fmtFull(s.net_worth)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {/* Formula explanations */}
                        <div style={{padding: "16px 20px", borderTop: "1px solid var(--border)", background: "var(--bg)"}}>
                          <div style={{fontWeight: 600, fontSize: 13, marginBottom: 8}}>How these numbers are calculated</div>
                          <p style={{fontSize: 12, color: "var(--text-dim)", marginBottom: 8, whiteSpace: "pre-line"}}>
                            <strong>Income:</strong> {pathFormulas[activeResult.scenario.path_type] || "Based on path-specific income model."}
                          </p>
                          <p style={{fontSize: 12, color: "var(--text-dim)", whiteSpace: "pre-line"}}>
                            <strong>Shared formulas:</strong>{"\n"}{sharedFormulas}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Save & Share */}
          <div className="card" style={{textAlign: "center", padding: "20px 24px"}}>
            <p style={{fontWeight: 600, marginBottom: 12}}>Found this useful?</p>
            <div style={{display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap"}}>
              {onSave && (
                <button className="btn btn-primary" style={{padding: "10px 20px", fontSize: 13}}
                  onClick={() => onSave(results)}
                  disabled={saveStatus === "saving" || saveStatus === "saved"}>
                  {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Simulation"}
                </button>
              )}
              <button className="btn btn-secondary" style={{padding: "10px 20px", fontSize: 13}}
                onClick={() => {
                  const shareUrl = window.location.origin + "?sim=" + btoa(JSON.stringify(quiz));
                  const text = `I just compared ${results.length} career paths on Horizon18 — a free tool that shows the financial reality of college, trades, military, and more over ${projYears} years. Check it out:`;
                  if (navigator.share) {
                    navigator.share({ title: "Horizon18", text, url: shareUrl }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text + " " + shareUrl).then(() => {
                      alert("Link copied to clipboard!");
                    });
                  }
                }}>
                Share Results
              </button>
              <a className="btn btn-secondary" style={{padding: "10px 20px", fontSize: 13, textDecoration: "none", display: "inline-block"}}
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I just compared career paths on @horizon18 — college, trades, military & more. Free tool that shows the real financial picture:")}&url=${encodeURIComponent("https://horizon18.app")}`}
                target="_blank" rel="noopener">
                Post on X
              </a>
            </div>
            {saveStatus === "error" && (
              <p style={{color: "var(--danger)", fontSize: 12, marginTop: 8}}>Failed to save. Please try again.</p>
            )}
          </div>

          {/* How the Math Works */}
          <HowItWorks />

          <div className="footer">
            Horizon18 — For educational purposes only. This tool does not provide financial advice.
            <br />Living expenses grow at 3% annually to reflect inflation. Income and investment returns are not inflation-adjusted.
            <br />Projections use simplified assumptions and generalized data sources (BLS, College Scorecard, NACE, DFAS).
          </div>
        </div>
      );
    }

    // ============================================================
    // HOW THE MATH WORKS
    // ============================================================

    function HiwDropdown({ icon, title, badge, children }) {
      const [open, setOpen] = useState(false);
      return (
        <div className="hiw-section">
          <div className="hiw-header" onClick={() => setOpen(!open)}>
            <h4>{icon} {title} {badge && <span className="hiw-badge">{badge}</span>}</h4>
            <span style={{color:"var(--text-dim)", fontSize:12}}>{open ? "▲" : "▼"}</span>
          </div>
          {open && <div className="hiw-body">{children}</div>}
        </div>
      );
    }

    function HowItWorks() {
      const [open, setOpen] = useState(false);

      return (
        <div className="card">
          <div onClick={() => setOpen(!open)}
            style={{cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <div>
              <h2>How the Math Works</h2>
              <p className="subtitle">See the formulas, steps, and assumptions behind every path</p>
            </div>
            <span style={{color:"var(--text-dim)", fontSize:12}}>{open ? "▲ Collapse" : "▼ Expand"}</span>
          </div>

          {open && (
            <div style={{marginTop: 20}}>

              {/* ===== 4-YEAR COLLEGE ===== */}
              <HiwDropdown icon="🎓" title="4-Year College" badge="4 years school">
                <p><strong>What this path looks like:</strong></p>
                <div className="hiw-timeline">
                  <div className="hiw-timeline-step"><strong>Years 1–4 (ages 18–21):</strong> Full-time student. You pay tuition + room & board each year. Optional part-time work (default: ~$8,000/year if enabled; you can adjust in path settings).</div>
                  <div className="hiw-timeline-step"><strong>Year 5 (age 22):</strong> Grace period — 6 months after graduation before loan payments begin. You start job searching; we count half a year of salary.</div>
                  <div className="hiw-timeline-step"><strong>Year 6+ (age 23+):</strong> Full-time career. Salary grows each year based on your major. You pay off loans, save, and invest.</div>
                </div>

                <p><strong>Education cost:</strong></p>
                <div className="hiw-formula">
                  Total Cost = (Annual Tuition × 4 years) + (Room & Board × 4 years)<br/>
                  Loan Amount = Total Cost − Family Savings (if any)<br/><br/>
                  Example (Public In-State, off-campus):<br/>
                  = ($11,371 × 4) + ($9,600 × 4) = $83,884<br/>
                  With $0 savings → you borrow $83,884<br/><br/>
                  Family savings are applied to education costs first. Any excess becomes your starting investment.
                </div>

                <p><strong>Income after graduation:</strong></p>
                <div className="hiw-formula">
                  Salary in Year N = Starting Salary × (1 + Growth Rate)^(years working)<br/><br/>
                  Example (STEM major):<br/>
                  Year 1 salary = $80,000<br/>
                  Year 5 salary = $80,000 × 1.04^4 = $93,588<br/>
                  Growth rate varies by major: STEM 4%, Business 3.5%, Healthcare 3%
                </div>
                <div className="hiw-note">Source: NACE salary survey, BLS Occupational Outlook. Tuition: College Board 2025-26.</div>
              </HiwDropdown>

              {/* ===== CC + TRANSFER ===== */}
              <HiwDropdown icon="🔄" title="Community College + Transfer" badge="2 + 2 years">
                <p><strong>What this path looks like:</strong></p>
                <div className="hiw-timeline">
                  <div className="hiw-timeline-step"><strong>Years 1–2 (ages 18–19):</strong> Community college at much lower tuition. Same room & board costs.</div>
                  <div className="hiw-timeline-step"><strong>Years 3–4 (ages 20–21):</strong> Transfer to a 4-year university. Pay university tuition for the final 2 years.</div>
                  <div className="hiw-timeline-step"><strong>Year 5+ (age 22+):</strong> Same career path as a 4-year grad, but starting salary is 2% lower (reflects minor hiring differences for transfer students).</div>
                </div>

                <p><strong>Cost savings vs. straight 4-year:</strong></p>
                <div className="hiw-formula">
                  CC tuition = $3,890/year vs. Public In-State = $11,371/year<br/>
                  2-year savings on tuition alone = ($11,371 − $3,890) × 2 = $14,962<br/><br/>
                  Total Cost = ($3,890 × 2) + ($11,371 × 2) + (Room & Board × 4)<br/>
                  = $7,780 + $22,742 + $38,400 = $68,922<br/><br/>
                  Room & board costs can be configured separately for CC and university years.
                </div>

                <p><strong>The trade-off:</strong></p>
                <div className="hiw-formula">
                  Starting Salary = Same-major salary × 0.98 (2% discount)<br/>
                  CC transfer graduates earn approximately 2% less than direct 4-year graduates in the same major.<br/><br/>
                  Example (STEM): $80,000 × 0.98 = $78,400<br/>
                  Less debt up front, slightly lower starting pay. Over 30+ years the savings usually win.
                </div>
                <div className="hiw-note">Source: College Board community college pricing. 2% discount: NACE employment data estimate.</div>
              </HiwDropdown>

              {/* ===== TRADE / APPRENTICESHIP ===== */}
              <HiwDropdown icon="🔧" title="Trade / Apprenticeship" badge="Earn while you learn">
                <p><strong>What this path looks like:</strong></p>
                <div className="hiw-timeline">
                  <div className="hiw-timeline-step"><strong>Year 1 (age 18):</strong> Start trade school or apprenticeship. School costs are low ($12K-$15K total, not per year). You earn a wage from day one — starting around 40-50% of a journeyman's salary.</div>
                  <div className="hiw-timeline-step"><strong>Years 2–4 (ages 19–21):</strong> Continue apprenticeship with increasing wages each year (roughly 60% → 70% → 85% of journeyman pay).</div>
                  <div className="hiw-timeline-step"><strong>Year 5+ (age 22+):</strong> Become a licensed journeyman earning full salary. Growth is steady at about 2.5% per year.</div>
                </div>

                <p><strong>Apprentice wage progression (Electrician example):</strong></p>
                <div className="hiw-formula">
                  Year 1: $35,000 (about 52% of journeyman pay)<br/>
                  Year 2: $42,000 (62%)<br/>
                  Year 3: $49,000 (72%)<br/>
                  Year 4: $56,000 (83%)<br/>
                  Year 5+: $67,810 × (1.025)^years as journeyman
                </div>

                <p><strong>Education cost:</strong></p>
                <div className="hiw-formula">
                  Trade school total (one-time, not per year):<br/>
                  Electrician: $14,640 | Plumber: $12,500 | HVAC: $12,500<br/>
                  Carpenter: $12,550 | Welder: $12,000 | Automotive Tech: $12,500<br/>
                  Diesel Mechanic: $13,000 | CNC Machinist: $12,750 | Lineworker: $14,500<br/>
                  Ironworker: $13,200 | Elevator Mechanic: $15,000 | Heavy Equipment Op: $12,200<br/><br/>
                  Journeyman Salaries (Year 5+):<br/>
                  Electrician: $67,810 | Plumber: $62,430 | HVAC: $61,040<br/>
                  Carpenter: $54,650 | Welder: $52,810 | Automotive Tech: $45,230<br/>
                  Diesel Mechanic: $56,780 | CNC Machinist: $59,400 | Lineworker: $72,150<br/>
                  Ironworker: $64,320 | Elevator Mechanic: $82,900 | Heavy Equipment Op: $58,620<br/><br/>
                  Loan term: 5 years (shorter than college loans)<br/>
                  No grace period — you're already working
                </div>

                <p><strong>Why trades often win early:</strong> You earn income from age 18 with minimal debt. College grads don't start full-time earning until age 22-23 and carry much larger loans.</p>
                <div className="hiw-note">Source: BLS wage data, Dept. of Labor apprenticeship records, industry training providers.</div>
              </HiwDropdown>

              {/* ===== DIRECT WORKFORCE ===== */}
              <HiwDropdown icon="💼" title="Direct Workforce" badge="Start immediately">
                <p><strong>What this path looks like:</strong></p>
                <div className="hiw-timeline">
                  <div className="hiw-timeline-step"><strong>Day 1 (age 18):</strong> Start working full-time right after high school. No education costs, no loans, no delay.</div>
                  <div className="hiw-timeline-step"><strong>Every year after:</strong> Your salary grows at 2% per year. This is slower growth than paths requiring a degree, but you have a head start. Default salary growth: 2% annually.</div>
                </div>

                <p><strong>Starting wages by industry:</strong></p>
                <div className="hiw-formula">
                  Retail:        $32,240/year<br/>
                  Logistics:     $31,137/year<br/>
                  Food Service:  $28,245/year<br/>
                  Office/Admin:  $35,419/year<br/>
                  Manufacturing: $34,320/year
                </div>

                <p><strong>Income growth:</strong></p>
                <div className="hiw-formula">
                  Salary in Year N = Starting Wage × (1.02)^N<br/><br/>
                  Example (Admin, Midwest):<br/>
                  Start: $35,419 × 0.95 (regional) = $33,648<br/>
                  Age 30: $33,648 × 1.02^12 = $42,680
                </div>

                <p><strong>The trade-off:</strong> No debt and immediate income, but lower lifetime earnings. Over 30+ years, the salary ceiling is lower than degree-requiring paths.</p>
                <div className="hiw-note">Source: BLS Occupational Employment and Wage Statistics, Indeed/Glassdoor 2025.</div>
              </HiwDropdown>

              {/* ===== MILITARY ===== */}
              <HiwDropdown icon="🎖️" title="Military Enlistment" badge="Service + benefits">
                <p><strong>What this path looks like:</strong></p>
                <div className="hiw-timeline">
                  <div className="hiw-timeline-step"><strong>Years 1–4 (ages 18–21):</strong> Active duty enlisted service. You earn military pay (base pay + housing allowance). Almost all living expenses are covered — housing, food, healthcare.</div>
                  <div className="hiw-timeline-step"><strong>If using GI Bill — Years 5–8 (ages 22–25):</strong> Free college. The GI Bill covers tuition (up to $29,921/year) plus a monthly housing allowance of $2,338. This income is tax-free.</div>
                  <div className="hiw-timeline-step"><strong>After service/school:</strong> Enter civilian career. Veterans with degrees get the same salary as other college grads. Without GI Bill, you get a 10% hiring premium over standard entry-level wages.</div>
                </div>

                <p><strong>Military pay progression:</strong></p>
                <div className="hiw-formula">
                  Year 1 (E-1): $25,296 base + $14,400 BAH = $39,696<br/>
                  Year 2 (E-2): $28,380 base + $14,400 BAH = $42,780<br/>
                  Year 3 (E-3): $30,132 base + $14,400 BAH = $44,532<br/>
                  Year 4 (E-4): $34,584 base + $15,000 BAH = $49,584
                </div>

                <p><strong>Monthly expenses during service:</strong></p>
                <div className="hiw-formula">
                  Only ~$400/month out-of-pocket (phone, car, insurance, personal)<br/>
                  vs. $2,200/month for independent civilian living<br/><br/>
                  That's $21,600/year you're saving compared to living on your own
                </div>

                <p><strong>GI Bill math:</strong></p>
                <div className="hiw-formula">
                  Tuition: Covered (up to $29,921/year private, public in-state fully covered)<br/>
                  Housing: $2,338/month = $28,056/year (TAX FREE)<br/>
                  Books: $1,000/year stipend<br/>
                  Duration: 36 months of benefits (9 months/academic year × 4 years)<br/><br/>
                  Income shown during GI Bill school years (~$28,000/year) represents the GI Bill housing allowance, which is tax-exempt.<br/>
                  Student loans needed: $0
                </div>

                <p><strong>Without GI Bill — civilian transition:</strong></p>
                <div className="hiw-formula">
                  Base civilian wage (Admin): $35,419<br/>
                  Veteran premium (+10%): $35,419 × 1.10 = $38,961<br/>
                  Growth rate: 3% per year<br/><br/>
                  Military pay rates based on 2025 DoD tables.
                </div>
                <div className="hiw-note">Source: DFAS 2025 pay tables, VA Post-9/11 GI Bill rates 2025-26, Military.com BAH calculator.</div>
              </HiwDropdown>

              {/* ===== SHARED FORMULAS ===== */}
              <HiwDropdown icon="📐" title="Shared Formulas (All Paths)" badge="Core math">
                <p>These calculations apply to every path. They're how we turn income and expenses into the charts you see above.</p>

                <p><strong>💰 Take-Home Pay (after taxes):</strong></p>
                <div className="hiw-formula">
                  Net Income = Gross Income × (1 − Tax Rate)<br/><br/>
                  Example: $60,000 gross × (1 − 0.18) = $49,200 take-home<br/>
                  Default tax rate: 18% (simplified flat rate)
                </div>

                <p><strong>🏦 Student Loan Payments:</strong></p>
                <div className="hiw-formula">
                  Standard Amortization Formula:<br/>
                  Monthly Payment = P × [r(1+r)^n] / [(1+r)^n − 1]<br/><br/>
                  Don't worry if that looks scary! Here's what the letters mean:<br/>
                  P = your total loan balance when payments start<br/>
                  r = monthly interest rate (6.5% annual ÷ 12 months = 0.542%)<br/>
                  n = total number of monthly payments (10 years × 12 = 120 payments)<br/><br/>
                  Example: $83,884 loan at 6.5% for 10 years<br/>
                  Monthly payment ≈ $953<br/>
                  Total paid over 10 years ≈ $114,360<br/>
                  Total interest ≈ $30,476
                </div>

                <p><strong>⚠️ Loan payments are capped at what you can afford:</strong></p>
                <div className="hiw-formula">
                  Actual Payment = min(Required Payment, Net Income − Living Expenses)<br/><br/>
                  If your income minus expenses is less than the required monthly payment,<br/>
                  the simulation only pays what you can actually afford.<br/>
                  The remaining balance continues accruing interest, and your loan takes<br/>
                  longer to pay off than the originally selected term.<br/><br/>
                  Example: Required payment = $953/month ($11,436/year)<br/>
                  But disposable income = $8,000/year<br/>
                  → You pay $8,000. The shortfall stays on the loan with interest.
                </div>

                <p><strong>⚠️ Interest grows while you're in school:</strong></p>
                <div className="hiw-formula">
                  Each year in school: Balance = Balance × (1 + 0.065)<br/><br/>
                  Example: Borrow $83,884 freshman year<br/>
                  After 4 years of accrual: $83,884 × 1.065^4 ≈ $107,870<br/>
                  That's $23,986 in interest before you make a single payment!
                </div>

                <p><strong>📈 Investment Growth (compound interest):</strong></p>
                <div className="hiw-formula">
                  Each year: Investments = (Previous Balance × 1.07) + New Savings<br/><br/>
                  Default return rate: 7% per year<br/><br/>
                  Example: Save $5,000/year for 30 years at 7%<br/>
                  Total contributed: $150,000<br/>
                  Final balance: ~$472,000 (compound interest earned you $322,000!)
                </div>

                <p><strong>💵 How much you save each year:</strong></p>
                <div className="hiw-formula">
                  Annual Savings = max(0, (Net Income − Living Expenses − Loan Payment) × Savings Rate)<br/><br/>
                  The 'Realized Savings Rate' chart shows what percentage of income was actually saved — which may be lower than your target if expenses and loan payments are high.
                </div>

                <p><strong>📊 Net Worth (the bottom line):</strong></p>
                <div className="hiw-formula">
                  Net Worth = Investment Balance − Remaining Debt<br/><br/>
                  This is the single number that captures everything:<br/>
                  what you've built up minus what you still owe.
                </div>

                <p><strong>🌎 Metro-area-based adjustments:</strong></p>
                <div className="hiw-formula">
                  Salary = Base Salary × Metro Area Multiplier<br/>
                  Expenses = Base Expenses × Metro Area Multiplier<br/><br/>
                  Northeast: Salary ×1.15, Expenses ×1.25 (pays more, costs more)<br/>
                  Southeast: Salary ×0.90, Expenses ×0.87 (lower pay, lower cost)<br/>
                  Midwest:   Salary ×0.95, Expenses ×0.90<br/>
                  Southwest: Salary ×0.97, Expenses ×0.95<br/>
                  West Coast: Salary ×1.12, Expenses ×1.15<br/><br/>
                  Living Expenses Base: Independent living ~$2,200/month. Living at home ~$800/month. Both adjusted by metro area cost-of-living multiplier.
                </div>

                <p><strong>🏠 Living Expenses:</strong></p>
                <div className="hiw-formula">
                  At home:       $800/month base (before regional multiplier)<br/>
                  Independent: $2,200/month base (rent, food, utilities, etc.)<br/><br/>
                  Expenses grow at 3% per year to reflect inflation:<br/>
                  Year N Expenses = Base Expenses × (1.03)^N<br/><br/>
                  Example (Midwest, independent, Year 0):<br/>
                  $2,200 × 0.90 = $1,980/month = $23,760/year<br/>
                  By Year 10: $23,760 × 1.03^10 = ~$31,933/year
                </div>
                <div className="hiw-note">All defaults are adjustable via the Advanced Assumptions sliders above.</div>
              </HiwDropdown>

            </div>
          )}
        </div>
      );
    }

    // ============================================================
    // APP ROOT
    // ============================================================

    // ══════════════════════════════════════════════════════════════
    // AUTH COMPONENTS
    // ══════════════════════════════════════════════════════════════

    function LoginPage({ onLogin, onSwitch, onGuest }) {
      const [email, setEmail] = useState("");
      const [password, setPassword] = useState("");
      const [error, setError] = useState("");
      const [loading, setLoading] = useState(false);

      const handleSubmit = async (e) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
          const data = await apiCall("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          setAuth(data.token, data.user);
          onLogin(data.user);
        } catch(err) {
          setError(err.error || "Login failed");
        } finally { setLoading(false); }
      };

      return (
        <div className="quiz-container" style={{textAlign: "center"}}>
          <h2 style={{marginBottom: 8}}>Sign In</h2>
          <p style={{color: "var(--text-dim)", fontSize: 14, marginBottom: 24}}>
            Save simulations and access them from any device.
          </p>

          <form onSubmit={handleSubmit} style={{textAlign: "left"}}>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p style={{color: "var(--danger)", fontSize: 13, marginBottom: 12}}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{width: "100%", marginBottom: 12}}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p style={{fontSize: 13, color: "var(--text-dim)", marginBottom: 8}}>
            Don't have an account?{" "}
            <a href="#" onClick={e => {e.preventDefault(); onSwitch();}}
              style={{color: "var(--accent)"}}>Create one</a>
          </p>
          <p style={{fontSize: 13}}>
            <a href="#" onClick={e => {e.preventDefault(); onGuest();}}
              style={{color: "var(--text-dim)"}}>Continue as guest</a>
          </p>
        </div>
      );
    }

    function RegisterPage({ onRegister, onSwitch, onGuest }) {
      const [email, setEmail] = useState("");
      const [password, setPassword] = useState("");
      const [confirm, setConfirm] = useState("");
      const [name, setName] = useState("");
      const [error, setError] = useState("");
      const [loading, setLoading] = useState(false);

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirm) { setError("Passwords don't match"); return; }
        if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
        setError(""); setLoading(true);
        try {
          const data = await apiCall("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password, display_name: name }),
          });
          setAuth(data.token, data.user);
          onRegister(data.user);
        } catch(err) {
          setError(err.error || "Registration failed");
        } finally { setLoading(false); }
      };

      return (
        <div className="quiz-container" style={{textAlign: "center"}}>
          <h2 style={{marginBottom: 8}}>Create Account</h2>
          <p style={{color: "var(--text-dim)", fontSize: 14, marginBottom: 24}}>
            Save and revisit your simulations anytime.
          </p>

          <form onSubmit={handleSubmit} style={{textAlign: "left"}}>
            <div className="form-group">
              <label>Name (optional)</label>
              <input className="form-input" type="text" value={name}
                onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required placeholder="At least 8 characters" />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input className="form-input" type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && <p style={{color: "var(--danger)", fontSize: 13, marginBottom: 12}}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{width: "100%", marginBottom: 12}}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p style={{fontSize: 13, color: "var(--text-dim)", marginBottom: 8}}>
            Already have an account?{" "}
            <a href="#" onClick={e => {e.preventDefault(); onSwitch();}}
              style={{color: "var(--accent)"}}>Sign in</a>
          </p>
          <p style={{fontSize: 13}}>
            <a href="#" onClick={e => {e.preventDefault(); onGuest();}}
              style={{color: "var(--text-dim)"}}>Continue as guest</a>
          </p>
        </div>
      );
    }

    function DashboardPage({ onLoadSim, onNewSim, onLogout }) {
      const [sims, setSims] = useState([]);
      const [loading, setLoading] = useState(true);
      const [editingId, setEditingId] = useState(null);
      const [editTitle, setEditTitle] = useState("");

      useEffect(() => {
        apiCall("/api/simulations")
          .then(data => { setSims(data.simulations || []); setLoading(false); })
          .catch(() => setLoading(false));
      }, []);

      const handleDelete = async (id) => {
        if (!confirm("Delete this simulation?")) return;
        try {
          await apiCall("/api/simulations/" + id, { method: "DELETE" });
          setSims(prev => prev.filter(s => s.id !== id));
        } catch(e) {}
      };

      const handleRename = async (id) => {
        if (!editTitle.trim()) return;
        try {
          await apiCall("/api/simulations/" + id, {
            method: "PATCH",
            body: JSON.stringify({ title: editTitle }),
          });
          setSims(prev => prev.map(s => s.id === id ? {...s, title: editTitle} : s));
          setEditingId(null);
        } catch(e) {}
      };

      const handleShare = (shareId) => {
        const url = window.location.origin + "/sim/" + shareId;
        navigator.clipboard.writeText(url).then(() => alert("Share link copied!"));
      };

      if (loading) return <div className="loading"><div className="spinner"></div><p>Loading your simulations...</p></div>;

      return (
        <div>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24}}>
            <h2 style={{fontSize: 22}}>My Simulations</h2>
            <div style={{display: "flex", gap: 8}}>
              <button className="btn btn-primary" style={{padding: "8px 16px", fontSize: 13}} onClick={onNewSim}>
                New Simulation
              </button>
            </div>
          </div>

          {sims.length === 0 ? (
            <div className="card" style={{textAlign: "center", padding: 40}}>
              <p style={{color: "var(--text-dim)", marginBottom: 16}}>No saved simulations yet.</p>
              <button className="btn btn-primary" onClick={onNewSim}>Run Your First Simulation</button>
            </div>
          ) : (
            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16}}>
              {sims.map(sim => (
                <div key={sim.id} className="card" style={{padding: 16, cursor: "pointer"}}
                  onClick={() => onLoadSim(sim)}>
                  {editingId === sim.id ? (
                    <div onClick={e => e.stopPropagation()} style={{marginBottom: 8}}>
                      <input className="form-input" value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleRename(sim.id); if (e.key === "Escape") setEditingId(null); }}
                        autoFocus style={{fontSize: 14, padding: "6px 10px", marginBottom: 6}} />
                      <div style={{display: "flex", gap: 6}}>
                        <button className="btn btn-primary" style={{padding: "4px 12px", fontSize: 12}} onClick={() => handleRename(sim.id)}>Save</button>
                        <button className="btn btn-secondary" style={{padding: "4px 12px", fontSize: 12}} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <h3 style={{fontSize: 15, fontWeight: 600, marginBottom: 6}}>{sim.title || "Untitled"}</h3>
                  )}
                  <p style={{fontSize: 12, color: "var(--text-dim)", marginBottom: 12}}>
                    {new Date(sim.created_at).toLocaleDateString()}
                  </p>
                  {sim.results_summary && (
                    <div style={{display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12}}>
                      {(sim.results_summary.paths || []).map((p, i) => (
                        <span key={i} className="badge">{p}</span>
                      ))}
                    </div>
                  )}
                  <div style={{display: "flex", gap: 6}} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary" style={{padding: "4px 10px", fontSize: 11}}
                      onClick={() => { setEditingId(sim.id); setEditTitle(sim.title || ""); }}>
                      Rename
                    </button>
                    <button className="btn btn-secondary" style={{padding: "4px 10px", fontSize: 11}}
                      onClick={() => handleShare(sim.share_id)}>
                      Share
                    </button>
                    <button className="btn btn-secondary" style={{padding: "4px 10px", fontSize: 11, color: "var(--danger)"}}
                      onClick={() => handleDelete(sim.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    function App() {
      const [page, setPage] = useState("quiz");
      const [quizData, setQuizData] = useState(null);
      const [user, setUser] = useState(null);
      const [authPage, setAuthPage] = useState(null); // "login" | "register" | null
      const [saveStatus, setSaveStatus] = useState(null); // "saving" | "saved" | "error" | null

      // Check for shared simulation link on load
      useEffect(() => {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);

        // DB-backed share link: /sim/abc123
        const simMatch = path.match(/^\/sim\/([a-z0-9]+)$/);
        if (simMatch) {
          fetch("/api/sim/" + simMatch[1])
            .then(r => r.json())
            .then(data => {
              if (data.quiz_state) {
                setQuizData(data.quiz_state);
                setPage("results");
              }
            })
            .catch(() => {});
          return;
        }

        // Legacy base64 share link: ?sim=...
        const simParam = params.get("sim");
        if (simParam) {
          try {
            const decoded = JSON.parse(atob(simParam));
            setQuizData(decoded);
            setPage("results");
          } catch(e) { console.error("Failed to decode shared simulation:", e); }
        }
      }, []);

      const handleLogin = (u) => { setUser(u); setAuthPage(null); };
      const handleLogout = () => { clearAuth(); setUser(null); setPage("quiz"); setQuizData(null); };

      const handleQuizComplete = (quiz) => {
        setQuizData(quiz);
        setPage("results");
        setSaveStatus(null);
        window.scrollTo(0, 0);
      };

      const handleReset = () => {
        setQuizData(null);
        setPage("quiz");
        setSaveStatus(null);
        window.scrollTo(0, 0);
      };

      const handleSave = async (results) => {
        if (!user) { setAuthPage("login"); return; }
        setSaveStatus("saving");
        try {
          // Build a summary for dashboard cards
          const summary = {
            paths: results.map(r => r.label),
            net_worths: results.map(r => {
              const last = r.snapshots[r.snapshots.length - 1];
              return last ? last.net_worth : 0;
            }),
          };
          const title = results.map(r => r.label).join(" vs ");
          await apiCall("/api/simulations/save", {
            method: "POST",
            body: JSON.stringify({ quiz_state: quizData, title, results_summary: summary }),
          });
          setSaveStatus("saved");
        } catch(e) {
          setSaveStatus("error");
        }
      };

      const handleLoadSim = (sim) => {
        setQuizData(sim.quiz_state);
        setPage("results");
        setSaveStatus(null);
        window.scrollTo(0, 0);
      };

      // Auth pages overlay
      if (authPage === "login") {
        return (
          <div className="app">
            <div className="header" style={{cursor: "pointer"}} onClick={() => setAuthPage(null)}>
              <h1>Horizon18</h1>
              <p>Compare paths. Project outcomes. Decide with data.</p>
            </div>
            <LoginPage onLogin={handleLogin} onSwitch={() => setAuthPage("register")}
              onGuest={() => setAuthPage(null)} />
          </div>
        );
      }
      if (authPage === "register") {
        return (
          <div className="app">
            <div className="header" style={{cursor: "pointer"}} onClick={() => setAuthPage(null)}>
              <h1>Horizon18</h1>
              <p>Compare paths. Project outcomes. Decide with data.</p>
            </div>
            <RegisterPage onRegister={handleLogin} onSwitch={() => setAuthPage("login")}
              onGuest={() => setAuthPage(null)} />
          </div>
        );
      }

      return (
        <div className="app">
          <div className="header" style={{position: "relative"}}>
            <div style={{position: "absolute", top: 0, right: 0, display: "flex", gap: 8, alignItems: "center"}}>
              {user ? (
                <>
                  <button className="btn btn-secondary" style={{padding: "6px 12px", fontSize: 12}}
                    onClick={() => { setPage("dashboard"); window.scrollTo(0,0); }}>
                    Dashboard
                  </button>
                  <span style={{fontSize: 12, color: "var(--text-dim)"}}>{user.display_name || user.email}</span>
                  <button className="btn btn-secondary" style={{padding: "6px 12px", fontSize: 12}}
                    onClick={handleLogout}>
                    Sign Out
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary" style={{padding: "6px 12px", fontSize: 12}}
                  onClick={() => setAuthPage("login")}>
                  Sign In
                </button>
              )}
            </div>
            <h1 style={{cursor: "pointer"}} onClick={handleReset}>Horizon18</h1>
            <p>Compare paths. Project outcomes. Decide with data.</p>
          </div>

          {page === "quiz" && !quizData && (
            <div style={{maxWidth: 640, margin: "0 auto 24px", textAlign: "center"}}>
              <p style={{color: "var(--text)", fontSize: 16, lineHeight: 1.6, marginBottom: 16}}>
                College isn't the only path. Compare your options — with real numbers.
              </p>
            </div>
          )}

          {page === "quiz" && <QuizPage onComplete={handleQuizComplete} />}
          {page === "results" && <ResultsPage quiz={quizData} onReset={handleReset} onSave={handleSave} saveStatus={saveStatus} />}
          {page === "dashboard" && <DashboardPage onLoadSim={handleLoadSim} onNewSim={handleReset} onLogout={handleLogout} />}
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(<App />);
