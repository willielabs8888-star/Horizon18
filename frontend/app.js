const {
  useState,
  useEffect,
  useCallback,
  useRef
} = React;
const {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
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
  military: ["#22c55e", "#4ade80", "#86efac", "#16a34a", "#15803d"]
};
const PATH_LABELS = {
  college: "4-Year College",
  cc_transfer: "Community College + Transfer",
  trade: "Trade / Apprenticeship",
  workforce: "Direct Workforce",
  military: "Military Enlistment"
};
const PATH_DESCRIPTIONS = {
  college: "Bachelor's degree from a 4-year university",
  cc_transfer: "2 years at community college, then transfer",
  trade: "Apprenticeship or trade school certification",
  workforce: "Enter the workforce directly after high school",
  military: "Enlist, serve, then transition to civilian life"
};
const LABEL_MAP = {
  public_in_state: "Public (In-State)",
  public_out_of_state: "Public (Out-of-State)",
  private: "Private University",
  // Majors — new granular list
  computer_science: "Computer Science",
  engineering: "Engineering",
  biology: "Biology / Pre-Med",
  environmental_science: "Environmental Science",
  nursing: "Nursing",
  kinesiology: "Kinesiology / Exercise Science",
  business_finance: "Business / Finance",
  accounting: "Accounting",
  marketing: "Marketing",
  psychology: "Psychology",
  criminal_justice: "Criminal Justice",
  political_science: "Political Science",
  communications: "Communications",
  english: "English / Writing",
  social_work: "Social Work",
  education: "Education",
  art_design: "Art / Design",
  undecided: "Undecided",
  // Legacy major aliases (still used by older saved quizzes)
  stem: "STEM / Engineering",
  business: "Business",
  healthcare: "Healthcare / Nursing",
  liberal_arts: "Liberal Arts",
  // Trades
  electrician: "Electrician",
  plumber: "Plumber",
  hvac: "HVAC",
  carpenter: "Carpenter",
  welder: "Welder",
  automotive_tech: "Automotive Technician",
  diesel_mechanic: "Diesel Mechanic",
  cnc_machinist: "CNC Machinist",
  lineworker: "Lineworker",
  ironworker: "Ironworker",
  elevator_mechanic: "Elevator Mechanic",
  heavy_equipment_op: "Heavy Equipment Operator",
  apprenticeship: "Apprenticeship",
  trade_school: "Trade School",
  // Workforce
  retail: "Retail",
  logistics: "Logistics / Warehouse",
  food_service: "Food Service",
  admin: "Office / Admin",
  manufacturing: "Manufacturing",
  security: "Security",
  landscaping: "Landscaping",
  customer_service: "Customer Service / Call Center",
  delivery_driver: "Delivery Driver",
  janitorial: "Janitorial / Maintenance",
  home_health_aide: "Home Health Aide",
  childcare: "Childcare",
  // Regions
  northeast: "Northeast",
  southeast: "Southeast",
  midwest: "Midwest",
  southwest: "Southwest",
  west_coast: "West Coast",
  national_avg: "National Average"
};
// Metro labels are merged dynamically when /api/metros loads (see QuizPage)

// Default configs for new instances — blank-slate (user must choose)
const DEFAULT_CONFIGS = {
  college: {
    school_type: "",
    major: "",
    use_search: true,
    loan_term_years: 10,
    part_time_work: true,
    part_time_income: 8000
  },
  cc_transfer: {
    transfer_university_type: "",
    major: "",
    use_search: true,
    use_transfer_search: true,
    loan_term_years: 10,
    part_time_work: true,
    part_time_income: 10000
  },
  trade: {
    trade_type: "",
    loan_term_years: 5
  },
  workforce: {
    industry: ""
  },
  military: {
    enlistment_years: 4,
    use_gi_bill: true,
    gi_bill_major: ""
  }
};
const MAX_INSTANCES = 10;

// Region-based default tax rates (blended federal + state + payroll)
const REGION_TAX_DEFAULTS = {
  northeast: 0.25,
  southeast: 0.22,
  midwest: 0.22,
  southwest: 0.22,
  west_coast: 0.27
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
  return {
    "Authorization": "Bearer " + _authToken
  };
}
async function apiCall(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(options.headers || {})
  };
  const resp = await fetch(url, {
    ...options,
    headers
  });
  const data = await resp.json();
  if (!resp.ok) throw {
    status: resp.status,
    ...data
  };
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
  const a = Math.abs(val),
    s = val < 0 ? "-" : "";
  if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return s + "$" + (a / 1e3).toFixed(0) + "K";
  return s + "$" + a.toFixed(0);
}
function fmtFull(val) {
  if (val == null) return "N/A";
  return (val < 0 ? "-$" : "$") + Math.abs(val).toLocaleString("en-US", {
    maximumFractionDigits: 0
  });
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
  const num = sameType.length > 1 ? ` #${idx >= 0 ? idx + 1 : 1}` : "";
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
    if (!hasSchool) missing.push({
      field: "school_type",
      label: "Choose a school"
    });
    if (!inst.major) missing.push({
      field: "major",
      label: "Pick a major"
    });
  } else if (pt === "cc_transfer") {
    const hasTransfer = inst.use_transfer_search ? !!inst.ipeds_id_transfer : !!inst.transfer_university_type;
    if (!hasTransfer) missing.push({
      field: "transfer_university_type",
      label: "Choose a transfer university"
    });
    if (!inst.major) missing.push({
      field: "major",
      label: "Pick a major"
    });
  } else if (pt === "trade") {
    if (!inst.trade_type) missing.push({
      field: "trade_type",
      label: "Pick a trade"
    });
  } else if (pt === "workforce") {
    if (!inst.industry) missing.push({
      field: "industry",
      label: "Pick an industry"
    });
  } else if (pt === "military") {
    if (inst.use_gi_bill && !inst.gi_bill_major) missing.push({
      field: "gi_bill_major",
      label: "Pick a post-service major"
    });
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
    const match = (results || []).find(r => (r.scenario.instance_id || r.scenario.path_type) === inst.instance_id);
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

function SchoolSearch({
  value,
  onSelect,
  onClear,
  placeholder,
  levelFilter
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef(null);
  const wrapRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const doSearch = q => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      const url = levelFilter ? `/api/schools/search?q=${encodeURIComponent(q)}&level=${levelFilter}` : `/api/schools/search?q=${encodeURIComponent(q)}`;
      fetch(url).then(r => r.json()).then(data => {
        setResults(data.schools || []);
        setShowResults(true);
      }).catch(() => {});
    }, 200);
  };
  const selectSchool = school => {
    onSelect(school);
    setQuery("");
    setResults([]);
    setShowResults(false);
  };
  const controlLabel = c => c === 1 ? "Public" : "Private";
  const levelLabel = l => l === 1 ? "4-Year" : "2-Year";

  // If a school is already selected, show it
  if (value) {
    return /*#__PURE__*/React.createElement("div", {
      className: "school-selected"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--accent)",
        fontWeight: 600
      }
    }, value.name), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-dim)",
        fontSize: 11
      }
    }, value.state, " \xB7 ", controlLabel(value.control), " \xB7 $", (value.tuition_in || 0).toLocaleString(), "/yr", value.room_board ? ` · R&B $${value.room_board.toLocaleString()}/yr` : ""), /*#__PURE__*/React.createElement("button", {
      className: "school-clear",
      onClick: onClear
    }, "\u2715 Clear"));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "school-search-wrap",
    ref: wrapRef
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "school-search-input",
    placeholder: placeholder || "Search by school name...",
    value: query,
    onChange: e => doSearch(e.target.value),
    onFocus: () => {
      if (results.length) setShowResults(true);
    }
  }), showResults && results.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "school-results"
  }, results.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    className: "school-result-item",
    onClick: () => selectSchool(s)
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "school-result-name"
  }, s.name), /*#__PURE__*/React.createElement("div", {
    className: "school-result-meta"
  }, s.state, " \xB7 ", controlLabel(s.control), " ", levelLabel(s.level))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: "var(--accent)"
    }
  }, "$", (s.tuition_in || 0).toLocaleString()), /*#__PURE__*/React.createElement("div", {
    className: "school-result-meta"
  }, "in-state/yr"))))), showResults && query.length >= 2 && results.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "school-results",
    style: {
      padding: "12px 16px",
      color: "var(--text-dim)",
      fontSize: 13
    }
  }, "No schools found for \"", query, "\""));
}

// ============================================================
// SCHOOL STATS PANEL — shown after school selection
// ============================================================

// Major → national avg starting salary (mirrors defaults/salaries.py)
const MAJOR_SALARY = {
  computer_science: 76251,
  engineering: 78731,
  biology: 45000,
  environmental_science: 48500,
  nursing: 77600,
  kinesiology: 48000,
  business_finance: 65276,
  accounting: 61500,
  marketing: 57000,
  psychology: 40000,
  criminal_justice: 43000,
  political_science: 44500,
  communications: 45500,
  english: 40000,
  social_work: 41000,
  education: 44860,
  art_design: 44000,
  undecided: 52000,
  // Legacy aliases
  stem: 78731,
  business: 65276,
  healthcare: 77600,
  liberal_arts: 40000
};

// Trade → journeyman salary (mirrors defaults/trades.py)
const TRADE_SALARY = {
  electrician: 67810,
  plumber: 64960,
  hvac: 54100,
  carpenter: 60083,
  welder: 49000,
  automotive_tech: 48000,
  diesel_mechanic: 58000,
  cnc_machinist: 49970,
  lineworker: 82340,
  ironworker: 62000,
  elevator_mechanic: 99000,
  heavy_equipment_op: 55280
};

// Workforce → entry salary (mirrors defaults/workforce.py)
const INDUSTRY_SALARY = {
  retail: 32240,
  logistics: 36500,
  food_service: 28245,
  admin: 35419,
  manufacturing: 34320,
  security: 36530,
  landscaping: 34480,
  customer_service: 38200,
  delivery_driver: 38180,
  janitorial: 31990,
  home_health_aide: 33530,
  childcare: 28520
};
function SchoolStatsPanel({
  school,
  schoolType,
  major,
  metroArea,
  isCC,
  years
}) {
  if (!school) return null;
  const tuition = schoolType === "public_out_of_state" ? school.tuition_out || school.tuition_in : school.tuition_in;
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
  return /*#__PURE__*/React.createElement("div", {
    className: "stats-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stats-panel-header"
  }, /*#__PURE__*/React.createElement("h4", null, school.name), /*#__PURE__*/React.createElement("span", {
    className: "stats-badge"
  }, school.control === 1 ? "Public" : "Private", " \xB7 ", school.state)), /*#__PURE__*/React.createElement("div", {
    className: "stats-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Annual Tuition"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value"
  }, "$", tuition.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    className: "stat-detail"
  }, schoolType === "public_out_of_state" ? "out-of-state" : "in-state")), rb > 0 && /*#__PURE__*/React.createElement("div", {
    className: "stat-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Room & Board"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value"
  }, "$", rb.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    className: "stat-detail"
  }, "per year")), /*#__PURE__*/React.createElement("div", {
    className: "stat-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Est. ", yrs, "-Year Cost"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value highlight"
  }, "$", (totalCost / 1000).toFixed(0), "K"), /*#__PURE__*/React.createElement("div", {
    className: "stat-detail"
  }, "tuition + R&B")), gradRatePct != null && /*#__PURE__*/React.createElement("div", {
    className: "stat-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Graduation Rate"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value",
    style: {
      color: gradRatePct >= 60 ? "var(--success)" : gradRatePct >= 40 ? "#eab308" : "var(--danger)"
    }
  }, gradRatePct, "%"), /*#__PURE__*/React.createElement("div", {
    className: "stat-detail"
  }, "within 150% time")), admRatePct != null && /*#__PURE__*/React.createElement("div", {
    className: "stat-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Acceptance Rate"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value"
  }, admRatePct, "%"), /*#__PURE__*/React.createElement("div", {
    className: "stat-detail"
  }, "of applicants")), school.med_earn != null && /*#__PURE__*/React.createElement("div", {
    className: "stat-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Median Earnings"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value"
  }, "$", (school.med_earn / 1000).toFixed(0), "K"), /*#__PURE__*/React.createElement("div", {
    className: "stat-detail"
  }, "10yr post-enrollment")), school.net_price != null && /*#__PURE__*/React.createElement("div", {
    className: "stat-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Avg Net Price"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value"
  }, "$", (school.net_price / 1000).toFixed(1), "K"), /*#__PURE__*/React.createElement("div", {
    className: "stat-detail"
  }, "after avg. fin. aid")), major && major !== "" && /*#__PURE__*/React.createElement("div", {
    className: "stat-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Est. Starting Salary"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value highlight"
  }, "$", (majorSalary / 1000).toFixed(0), "K"), /*#__PURE__*/React.createElement("div", {
    className: "stat-detail"
  }, "national avg, ", LABEL_MAP[major] || major))), /*#__PURE__*/React.createElement("div", {
    className: "stats-disclaimer"
  }, "Tuition and R&B from U.S. Dept. of Education College Scorecard.", school.med_earn != null && " Median earnings reflect all graduates, not specific to your major.", " ", "Starting salary is a national average \u2014 the simulation adjusts for your selected metro area.", " ", "Estimates vary by region, experience, and job market."));
}
function buildChartData(results) {
  if (!results || !results.length) return [];
  const rows = [];
  for (let i = 0; i < results[0].snapshots.length; i++) {
    const row = {
      age: results[0].snapshots[i].age
    };
    for (const r of results) {
      const id = r.scenario.instance_id || r.scenario.path_type;
      const s = r.snapshots[i];
      row[id + "_nw"] = Math.round(s.net_worth);
      row[id + "_income"] = Math.round(s.gross_income);
      row[id + "_cum_earn"] = Math.round(s.cumulative_earnings);
      row[id + "_debt"] = Math.round(s.debt_remaining);
      row[id + "_invest"] = Math.round(s.investment_balance);
      row[id + "_savings"] = Math.round(s.savings_rate_actual * 100);
      row[id + "_loan_pay"] = Math.round(s.loan_payment);
      row[id + "_annual_save"] = Math.round(s.annual_savings);
      row[id + "_cum_tax"] = Math.round(s.cumulative_taxes);
    }
    rows.push(row);
  }
  return rows;
}

// ============================================================
// GENERIC CHART COMPONENT (instance-aware)
// ============================================================

function SimChart({
  data,
  results,
  suffix,
  dataKeySuffix,
  yDomain,
  colorMap,
  labelMap,
  savingsRate
}) {
  const ids = results.map(r => r.scenario.instance_id || r.scenario.path_type);
  const isMoney = !suffix;
  const [hoverData, setHoverData] = useState(null);
  const handleMouseMove = state => {
    if (state && state.activePayload && state.activePayload.length) {
      const label = state.activeLabel;
      const values = state.activePayload.map(e => ({
        id: e.dataKey.replace("_" + dataKeySuffix, ""),
        color: e.color,
        value: e.value
      })).sort((a, b) => (b.value || 0) - (a.value || 0));
      setHoverData({
        age: label,
        values
      });
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      animation: "fadeIn 0.3s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "legend"
  }, ids.map(id => /*#__PURE__*/React.createElement("div", {
    className: "legend-item",
    key: id
  }, /*#__PURE__*/React.createElement("div", {
    className: "legend-dot",
    style: {
      background: colorMap[id] || "#888"
    }
  }), labelMap[id] || id))), /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: 48,
      padding: "8px 16px",
      marginBottom: 4,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      transition: "opacity 0.15s",
      opacity: hoverData ? 1 : 0.4
    }
  }, hoverData ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: "var(--text-dim)",
      marginBottom: 4
    }
  }, "Age ", hoverData.age), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 20,
      flexWrap: "wrap"
    }
  }, hoverData.values.map(v => /*#__PURE__*/React.createElement("div", {
    key: v.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: v.color,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, labelMap[v.id] || v.id), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: v.color
    }
  }, isMoney ? fmtFull(v.value) : v.value != null ? v.value + (suffix || "") : "—"))))) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, "Hover over the chart to see values at each age")), /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: 420
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: data,
    margin: {
      top: 10,
      right: 30,
      left: 20,
      bottom: 5
    },
    onMouseMove: handleMouseMove,
    onMouseLeave: () => setHoverData(null)
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: "#2a2e3f"
  }), /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "age",
    stroke: "#6b7280",
    tick: {
      fill: "#9ca3af",
      fontSize: 12
    },
    label: {
      value: "Age",
      position: "insideBottom",
      offset: -2,
      fill: "#9ca3af"
    }
  }), /*#__PURE__*/React.createElement(YAxis, {
    stroke: "#6b7280",
    tick: {
      fill: "#9ca3af",
      fontSize: 12
    },
    tickFormatter: isMoney ? fmt : v => v + (suffix || ""),
    domain: yDomain || undefined
  }), /*#__PURE__*/React.createElement(Tooltip, {
    content: () => null,
    cursor: {
      stroke: "var(--text-dim)",
      strokeWidth: 1,
      strokeDasharray: "4 4"
    }
  }), dataKeySuffix === "nw" && /*#__PURE__*/React.createElement(ReferenceLine, {
    y: 0,
    stroke: "#6b7280",
    strokeDasharray: "4 4"
  }), dataKeySuffix === "savings" && savingsRate !== undefined && /*#__PURE__*/React.createElement(ReferenceLine, {
    y: Math.round(savingsRate * 100),
    stroke: "var(--accent)",
    strokeDasharray: "5 5",
    label: {
      value: "Target",
      position: "right",
      fill: "var(--text-dim)",
      fontSize: 11
    }
  }), ids.map(id => /*#__PURE__*/React.createElement(Line, {
    key: id,
    type: "monotone",
    dataKey: id + "_" + dataKeySuffix,
    stroke: colorMap[id] || "#888",
    strokeWidth: dataKeySuffix === "nw" ? 2.5 : 2,
    dot: false,
    activeDot: {
      r: dataKeySuffix === "nw" ? 5 : 4,
      strokeWidth: 0
    }
  })))));
}

// ============================================================
// QUIZ PAGE (multi-instance)
// ============================================================

const QUIZ_STEPS = ["paths", "details", "location", "review"];
let _nextId = 0;

// Metro area → region mapping (built dynamically from /api/metros response)
// Initialized with national_avg fallback; populated in QuizPage useEffect
let METRO_REGION_MAP = {
  national_avg: "midwest"
};
function QuizPage({
  onComplete
}) {
  const [step, setStep] = useState(0);
  const [instances, setInstances] = useState([]);
  const [metros, setMetros] = useState([]);
  const [collapsed, setCollapsed] = useState({}); // instance_id → bool
  const [showMissing, setShowMissing] = useState(false); // highlight empty fields after Continue attempt
  const [shared, setShared] = useState({
    metro_area: "national_avg",
    living_at_home: false,
    years_at_home: 2,
    family_savings: 0,
    projection_years: 32
  });

  // Fetch metro list on mount and build region map dynamically
  useEffect(() => {
    fetch("/api/metros").then(r => r.json()).then(d => {
      const list = d.metros || [];
      setMetros(list);
      // Build METRO_REGION_MAP and merge labels dynamically
      const map = {
        national_avg: "midwest"
      };
      list.forEach(m => {
        map[m.code] = m.region;
        if (!LABEL_MAP[m.code]) LABEL_MAP[m.code] = m.label;
      });
      METRO_REGION_MAP = map;
    }).catch(() => {});
  }, []);
  const updateShared = (key, val) => setShared(prev => ({
    ...prev,
    [key]: val
  }));
  const addInstance = pathType => {
    if (instances.length >= MAX_INSTANCES) return;
    const count = instances.filter(i => i.path_type === pathType).length;
    const id = `${pathType}_${_nextId++}`;
    setInstances(prev => [...prev, {
      instance_id: id,
      path_type: pathType,
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIGS[pathType]))
    }]);
  };
  const removeInstance = instanceId => {
    setInstances(prev => prev.filter(i => i.instance_id !== instanceId));
  };
  const updateInstance = (instanceId, key, val) => {
    setInstances(prev => {
      const updated = prev.map(i => i.instance_id === instanceId ? {
        ...i,
        [key]: val
      } : i);
      // Auto-collapse section if it just became complete
      const inst = updated.find(i => i.instance_id === instanceId);
      if (inst && isInstanceComplete(inst)) {
        setTimeout(() => setCollapsed(c => ({
          ...c,
          [instanceId]: true
        })), 600);
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
  const toggleCollapse = id => setCollapsed(prev => ({
    ...prev,
    [id]: !prev[id]
  }));
  const next = () => {
    // On step 1, if can't proceed, highlight missing fields and scroll to first
    if (step === 1 && !canNext()) {
      setShowMissing(true);
      // Expand collapsed sections that have missing fields
      const newCollapsed = {
        ...collapsed
      };
      let firstMissingEl = null;
      for (const inst of instances) {
        if (!isInstanceComplete(inst)) {
          newCollapsed[inst.instance_id] = false;
          if (!firstMissingEl) {
            setTimeout(() => {
              const el = document.getElementById(`path-${inst.instance_id}`);
              if (el) el.scrollIntoView({
                behavior: "smooth",
                block: "center"
              });
            }, 100);
            firstMissingEl = true;
          }
        }
      }
      setCollapsed(newCollapsed);
      return;
    }
    setShowMissing(false);
    if (step < QUIZ_STEPS.length - 1) setStep(step + 1);else {
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
        region: derivedRegion
      });
    }
  };
  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  // Step 0: Path selection (add instances)
  const renderPathStep = () => /*#__PURE__*/React.createElement("div", {
    className: "quiz-step"
  }, /*#__PURE__*/React.createElement("h2", null, "Build your comparison"), /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "Add the paths you want to compare. You can add the same type multiple times with different options (up to ", MAX_INSTANCES, " total)."), Object.entries(PATH_LABELS).map(([key, label]) => {
    const count = instances.filter(i => i.path_type === key).length;
    const typeInstances = instances.filter(i => i.path_type === key);
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      className: "path-type-card",
      style: count > 0 ? {
        borderColor: PATH_BASE_COLORS[key][0]
      } : {}
    }, /*#__PURE__*/React.createElement("div", {
      className: "path-type-header"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "path-name",
      style: count > 0 ? {
        color: PATH_BASE_COLORS[key][0]
      } : {}
    }, label, " ", count > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        opacity: 0.7
      }
    }, "(", count, ")")), /*#__PURE__*/React.createElement("div", {
      className: "path-desc"
    }, PATH_DESCRIPTIONS[key])), /*#__PURE__*/React.createElement("button", {
      className: "add-btn",
      onClick: () => addInstance(key),
      disabled: instances.length >= MAX_INSTANCES
    }, "+ Add")), typeInstances.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "instance-chips"
    }, typeInstances.map((inst, idx) => {
      const complete = isInstanceComplete(inst);
      const missing = getMissingFields(inst);
      return /*#__PURE__*/React.createElement("div", {
        key: inst.instance_id,
        className: "instance-chip",
        style: {
          borderColor: instanceColor(inst, instances)
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: instanceColor(inst, instances)
        }
      }, "#", idx + 1, " ", complete ? /*#__PURE__*/React.createElement("span", {
        className: "configured"
      }, instanceSummary(inst)) : /*#__PURE__*/React.createElement("span", {
        className: "needs-action"
      }, missing.map(m => m.label).join(", "))), /*#__PURE__*/React.createElement("button", {
        className: "remove-btn",
        onClick: () => removeInstance(inst.instance_id)
      }, "x"));
    })));
  }), instances.length > 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-dim)",
      fontSize: 13,
      textAlign: "center",
      marginTop: 8
    }
  }, instances.length, " of ", MAX_INSTANCES, " slots used"));

  // Step 1: Configure paths + family savings
  const renderDetailsStep = () => {
    const sorted = sortInstances(instances);
    return /*#__PURE__*/React.createElement("div", {
      className: "quiz-step"
    }, /*#__PURE__*/React.createElement("h2", null, "Configure each path"), /*#__PURE__*/React.createElement("p", {
      className: "hint"
    }, "Set the specific options for each path you added."), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginBottom: 16,
        padding: "12px 16px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "form-group",
      style: {
        marginBottom: 0
      }
    }, /*#__PURE__*/React.createElement("label", null, "Family savings for education"), /*#__PURE__*/React.createElement("p", {
      className: "field-hint"
    }, "Total amount your family can contribute across all years of school (e.g. $20,000 total, not per year). This reduces how much you need to borrow. Any amount beyond your total school cost will be added to your starting investments."), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 10,
        top: "50%",
        transform: "translateY(-50%)",
        color: "#666",
        fontSize: 14
      }
    }, "$"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "form-select",
      style: {
        paddingLeft: 22
      },
      min: "0",
      step: "500",
      value: shared.family_savings || "",
      placeholder: "0",
      onChange: e => updateShared("family_savings", Math.max(0, parseFloat(e.target.value) || 0))
    })))), showMissing && !canNext() && /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#f59e0b15",
        border: "1px solid #f59e0b40",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 12,
        color: "#f59e0b",
        fontSize: 13
      }
    }, "Some paths still need selections. Look for the highlighted fields below."), sorted.map((inst, idx) => {
      const pt = inst.path_type;
      const color = instanceColor(inst, instances);
      const heading = instanceLabel(inst, instances);
      const complete = isInstanceComplete(inst);
      const missing = getMissingFields(inst);
      const isCollapsed = collapsed[inst.instance_id] && complete;
      const missingFieldNames = new Set(missing.map(m => m.field));
      return /*#__PURE__*/React.createElement("div", {
        key: inst.instance_id,
        id: `path-${inst.instance_id}`,
        className: "path-section",
        style: {
          borderLeftColor: color
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "path-section-header",
        onClick: () => toggleCollapse(inst.instance_id)
      }, /*#__PURE__*/React.createElement("h3", {
        style: {
          color,
          margin: 0,
          display: "flex",
          alignItems: "center"
        }
      }, heading, complete ? /*#__PURE__*/React.createElement("span", {
        className: "path-status complete"
      }, "Ready") : /*#__PURE__*/React.createElement("span", {
        className: "path-status incomplete"
      }, missing.length, " field", missing.length > 1 ? "s" : "", " needed")), /*#__PURE__*/React.createElement("div", {
        className: "path-section-toggle"
      }, complete && /*#__PURE__*/React.createElement("span", {
        style: {
          color: "#10b981",
          fontSize: 12
        }
      }, instanceSummary(inst)), /*#__PURE__*/React.createElement("span", {
        className: "chevron" + (isCollapsed ? " collapsed" : "")
      }, "\u25BC"))), /*#__PURE__*/React.createElement("div", {
        className: "path-section-body" + (isCollapsed ? " collapsed" : ""),
        style: isCollapsed ? {
          maxHeight: 0
        } : {
          maxHeight: 2000
        }
      }, pt === "college" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Choose your school"), /*#__PURE__*/React.createElement("div", {
        className: "school-mode-toggle"
      }, /*#__PURE__*/React.createElement("button", {
        className: "school-mode-btn" + (inst.use_search ? " active" : ""),
        onClick: () => {
          updateInstance(inst.instance_id, "use_search", true);
          updateInstance(inst.instance_id, "ipeds_id", null);
          updateInstance(inst.instance_id, "_selected_school", null);
        }
      }, "Search by name"), /*#__PURE__*/React.createElement("button", {
        className: "school-mode-btn" + (!inst.use_search ? " active" : ""),
        onClick: () => {
          updateInstance(inst.instance_id, "use_search", false);
          updateInstance(inst.instance_id, "ipeds_id", null);
          updateInstance(inst.instance_id, "_selected_school", null);
        }
      }, "Use general estimates")), inst.use_search ? /*#__PURE__*/React.createElement(SchoolSearch, {
        value: inst._selected_school,
        levelFilter: "1",
        placeholder: "Type a university name (e.g. Ohio State)...",
        onSelect: school => {
          updateInstance(inst.instance_id, "ipeds_id", school.id);
          updateInstance(inst.instance_id, "_selected_school", school);
          const st = school.control === 1 ? "public_in_state" : "private";
          updateInstance(inst.instance_id, "school_type", st);
          // Reset overrides so the new school's data shows
          updateInstance(inst.instance_id, "tuition_override", null);
          updateInstance(inst.instance_id, "room_board_override", null);
        },
        onClear: () => {
          updateInstance(inst.instance_id, "ipeds_id", null);
          updateInstance(inst.instance_id, "_selected_school", null);
          updateInstance(inst.instance_id, "tuition_override", null);
          updateInstance(inst.instance_id, "room_board_override", null);
        }
      }) : /*#__PURE__*/React.createElement("select", {
        className: "form-select" + (showMissing && missingFieldNames.has("school_type") && !inst.school_type ? " field-missing" : ""),
        value: inst.school_type,
        onChange: e => updateInstance(inst.instance_id, "school_type", e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: "",
        disabled: true
      }, "Select school type..."), /*#__PURE__*/React.createElement("option", {
        value: "public_in_state"
      }, "Public (In-State)"), /*#__PURE__*/React.createElement("option", {
        value: "public_out_of_state"
      }, "Public (Out-of-State)"), /*#__PURE__*/React.createElement("option", {
        value: "private"
      }, "Private University"))), inst.use_search && inst._selected_school && /*#__PURE__*/React.createElement(SchoolStatsPanel, {
        school: inst._selected_school,
        schoolType: inst.school_type,
        major: inst.major,
        metroArea: shared.metro_area,
        years: 4
      }), inst.use_search && inst._selected_school && /*#__PURE__*/React.createElement(React.Fragment, null, inst._selected_school.control === 1 && /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Residency status"), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.school_type,
        onChange: e => {
          updateInstance(inst.instance_id, "school_type", e.target.value);
          // Reset tuition override so it picks up the new rate
          const s = inst._selected_school;
          const newTuition = e.target.value === "public_out_of_state" ? s.tuition_out : s.tuition_in;
          updateInstance(inst.instance_id, "tuition_override", newTuition);
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: "public_in_state"
      }, "In-State"), /*#__PURE__*/React.createElement("option", {
        value: "public_out_of_state"
      }, "Out-of-State"))), /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Annual tuition + fees"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "From our database. Set to $0 for a full scholarship, or reduce for a partial one."), /*#__PURE__*/React.createElement("div", {
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#666",
          fontSize: 14
        }
      }, "$"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        style: {
          paddingLeft: 22
        },
        value: inst.tuition_override != null ? inst.tuition_override : (inst.school_type === "public_out_of_state" ? inst._selected_school.tuition_out : inst._selected_school.tuition_in) || "",
        onChange: e => updateInstance(inst.instance_id, "tuition_override", e.target.value ? parseFloat(e.target.value) : null)
      }))), inst._selected_school.room_board && /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Annual room & board"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "On-campus housing + meal plan cost per year. If you plan to live at home (set on the next page), set this to $0 to avoid double-counting."), /*#__PURE__*/React.createElement("div", {
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#666",
          fontSize: 14
        }
      }, "$"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        style: {
          paddingLeft: 22
        },
        value: inst.room_board_override != null ? inst.room_board_override : inst._selected_school.room_board || "",
        onChange: e => updateInstance(inst.instance_id, "room_board_override", e.target.value ? parseFloat(e.target.value) : null)
      })))), /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Loan repayment term (years)"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "Longer terms reduce monthly payments but increase total interest paid."), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn btn-secondary",
        style: {
          padding: "8px 12px",
          fontSize: 14,
          minWidth: 40
        },
        onClick: () => updateInstance(inst.instance_id, "loan_term_years", Math.max(5, (inst.loan_term_years || 10) - 1))
      }, "\u2212"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        min: "5",
        max: "30",
        step: "1",
        value: inst.loan_term_years || 10,
        onChange: e => updateInstance(inst.instance_id, "loan_term_years", Math.max(5, Math.min(30, parseInt(e.target.value) || 10))),
        style: {
          flex: 1,
          textAlign: "center"
        }
      }), /*#__PURE__*/React.createElement("button", {
        className: "btn btn-secondary",
        style: {
          padding: "8px 12px",
          fontSize: 14,
          minWidth: 40
        },
        onClick: () => updateInstance(inst.instance_id, "loan_term_years", Math.min(30, (inst.loan_term_years || 10) + 1))
      }, "+"))), /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Will you work part-time during school?"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 12,
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn" + (inst.part_time_work ? " btn-primary" : " btn-secondary"),
        onClick: () => updateInstance(inst.instance_id, "part_time_work", true),
        style: {
          flex: 1
        }
      }, "Yes"), /*#__PURE__*/React.createElement("button", {
        className: "btn" + (!inst.part_time_work ? " btn-primary" : " btn-secondary"),
        onClick: () => updateInstance(inst.instance_id, "part_time_work", false),
        style: {
          flex: 1
        }
      }, "No"))), inst.part_time_work && /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Expected annual earnings"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "Estimated income from part-time work during the 4 school years."), /*#__PURE__*/React.createElement("div", {
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#666",
          fontSize: 14
        }
      }, "$"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        style: {
          paddingLeft: 22
        },
        min: "0",
        value: inst.part_time_income || 8000,
        onChange: e => updateInstance(inst.instance_id, "part_time_income", Math.max(0, parseInt(e.target.value) || 8000))
      }))), /*#__PURE__*/React.createElement("div", {
        className: "form-group" + (showMissing && missingFieldNames.has("major") ? " field-missing" : "")
      }, /*#__PURE__*/React.createElement("label", null, "Intended major"), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.major,
        onChange: e => updateInstance(inst.instance_id, "major", e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: "",
        disabled: true
      }, "Select a major..."), ["computer_science", "engineering", "biology", "environmental_science", "nursing", "kinesiology", "business_finance", "accounting", "marketing", "psychology", "criminal_justice", "political_science", "communications", "english", "social_work", "education", "art_design", "undecided"].map(m => /*#__PURE__*/React.createElement("option", {
        key: m,
        value: m
      }, LABEL_MAP[m]))))), pt === "cc_transfer" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Community College (Years 1-2)"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "Optional: search for your specific CC for accurate tuition."), /*#__PURE__*/React.createElement(SchoolSearch, {
        value: inst._selected_cc,
        levelFilter: "2",
        placeholder: "Search community colleges (optional)...",
        onSelect: school => {
          updateInstance(inst.instance_id, "ipeds_id_cc", school.id);
          updateInstance(inst.instance_id, "_selected_cc", school);
          updateInstance(inst.instance_id, "tuition_override_cc", null);
        },
        onClear: () => {
          updateInstance(inst.instance_id, "ipeds_id_cc", null);
          updateInstance(inst.instance_id, "_selected_cc", null);
          updateInstance(inst.instance_id, "tuition_override_cc", null);
        }
      }), inst._selected_cc && /*#__PURE__*/React.createElement(SchoolStatsPanel, {
        school: inst._selected_cc,
        schoolType: "public_in_state",
        major: inst.major,
        metroArea: shared.metro_area,
        isCC: true,
        years: 2
      }), inst._selected_cc && /*#__PURE__*/React.createElement("div", {
        className: "form-group",
        style: {
          marginTop: 8
        }
      }, /*#__PURE__*/React.createElement("label", null, "CC annual tuition + fees"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "From our database. Set to $0 for a full scholarship, or reduce for a partial one."), /*#__PURE__*/React.createElement("div", {
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#666",
          fontSize: 14
        }
      }, "$"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        style: {
          paddingLeft: 22
        },
        value: inst.tuition_override_cc != null ? inst.tuition_override_cc : inst._selected_cc.tuition_in || "",
        onChange: e => updateInstance(inst.instance_id, "tuition_override_cc", e.target.value ? parseFloat(e.target.value) : null)
      })))), /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Transfer University (Years 3-4)"), /*#__PURE__*/React.createElement("div", {
        className: "school-mode-toggle"
      }, /*#__PURE__*/React.createElement("button", {
        className: "school-mode-btn" + (inst.use_transfer_search ? " active" : ""),
        onClick: () => {
          updateInstance(inst.instance_id, "use_transfer_search", true);
          updateInstance(inst.instance_id, "ipeds_id_transfer", null);
          updateInstance(inst.instance_id, "_selected_transfer", null);
        }
      }, "Search by name"), /*#__PURE__*/React.createElement("button", {
        className: "school-mode-btn" + (!inst.use_transfer_search ? " active" : ""),
        onClick: () => {
          updateInstance(inst.instance_id, "use_transfer_search", false);
          updateInstance(inst.instance_id, "ipeds_id_transfer", null);
          updateInstance(inst.instance_id, "_selected_transfer", null);
        }
      }, "Use general estimates")), inst.use_transfer_search ? /*#__PURE__*/React.createElement(SchoolSearch, {
        value: inst._selected_transfer,
        levelFilter: "1",
        placeholder: "Type a university name...",
        onSelect: school => {
          updateInstance(inst.instance_id, "ipeds_id_transfer", school.id);
          updateInstance(inst.instance_id, "_selected_transfer", school);
          const st = school.control === 1 ? "public_in_state" : "private";
          updateInstance(inst.instance_id, "transfer_university_type", st);
          updateInstance(inst.instance_id, "tuition_override_transfer", null);
        },
        onClear: () => {
          updateInstance(inst.instance_id, "ipeds_id_transfer", null);
          updateInstance(inst.instance_id, "_selected_transfer", null);
          updateInstance(inst.instance_id, "tuition_override_transfer", null);
        }
      }) : /*#__PURE__*/React.createElement("select", {
        className: "form-select" + (showMissing && missingFieldNames.has("transfer_university_type") && !inst.transfer_university_type ? " field-missing" : ""),
        value: inst.transfer_university_type,
        onChange: e => updateInstance(inst.instance_id, "transfer_university_type", e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: "",
        disabled: true
      }, "Select school type..."), /*#__PURE__*/React.createElement("option", {
        value: "public_in_state"
      }, "Public (In-State)"), /*#__PURE__*/React.createElement("option", {
        value: "public_out_of_state"
      }, "Public (Out-of-State)"), /*#__PURE__*/React.createElement("option", {
        value: "private"
      }, "Private University")), inst.use_transfer_search && inst._selected_transfer && /*#__PURE__*/React.createElement(SchoolStatsPanel, {
        school: inst._selected_transfer,
        schoolType: inst.transfer_university_type,
        major: inst.major,
        metroArea: shared.metro_area,
        years: 2
      }), inst.use_transfer_search && inst._selected_transfer && /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 8
        }
      }, inst._selected_transfer.control === 1 && /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Residency status"), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.transfer_university_type,
        onChange: e => {
          updateInstance(inst.instance_id, "transfer_university_type", e.target.value);
          const s = inst._selected_transfer;
          const newTuition = e.target.value === "public_out_of_state" ? s.tuition_out : s.tuition_in;
          updateInstance(inst.instance_id, "tuition_override_transfer", newTuition);
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: "public_in_state"
      }, "In-State"), /*#__PURE__*/React.createElement("option", {
        value: "public_out_of_state"
      }, "Out-of-State"))), /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Transfer university annual tuition + fees"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "From our database. Set to $0 for a full scholarship, or reduce for a partial one."), /*#__PURE__*/React.createElement("div", {
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#666",
          fontSize: 14
        }
      }, "$"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        style: {
          paddingLeft: 22
        },
        value: inst.tuition_override_transfer != null ? inst.tuition_override_transfer : (inst.transfer_university_type === "public_out_of_state" ? inst._selected_transfer.tuition_out : inst._selected_transfer.tuition_in) || "",
        onChange: e => updateInstance(inst.instance_id, "tuition_override_transfer", e.target.value ? parseFloat(e.target.value) : null)
      }))), inst._selected_transfer.room_board && /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Annual room & board"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "On-campus housing + meal plan for transfer years. If you plan to live at home (set on the next page), set this to $0 to avoid double-counting."), /*#__PURE__*/React.createElement("div", {
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#666",
          fontSize: 14
        }
      }, "$"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        style: {
          paddingLeft: 22
        },
        value: inst.room_board_override != null ? inst.room_board_override : inst._selected_transfer.room_board || "",
        onChange: e => updateInstance(inst.instance_id, "room_board_override", e.target.value ? parseFloat(e.target.value) : null)
      }))))), /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Loan repayment term (years)"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "Longer terms reduce monthly payments but increase total interest paid."), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn btn-secondary",
        style: {
          padding: "8px 12px",
          fontSize: 14,
          minWidth: 40
        },
        onClick: () => updateInstance(inst.instance_id, "loan_term_years", Math.max(5, (inst.loan_term_years || 10) - 1))
      }, "\u2212"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        min: "5",
        max: "30",
        step: "1",
        value: inst.loan_term_years || 10,
        onChange: e => updateInstance(inst.instance_id, "loan_term_years", Math.max(5, Math.min(30, parseInt(e.target.value) || 10))),
        style: {
          flex: 1,
          textAlign: "center"
        }
      }), /*#__PURE__*/React.createElement("button", {
        className: "btn btn-secondary",
        style: {
          padding: "8px 12px",
          fontSize: 14,
          minWidth: 40
        },
        onClick: () => updateInstance(inst.instance_id, "loan_term_years", Math.min(30, (inst.loan_term_years || 10) + 1))
      }, "+"))), /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Will you work part-time during school?"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 12,
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn" + (inst.part_time_work ? " btn-primary" : " btn-secondary"),
        onClick: () => updateInstance(inst.instance_id, "part_time_work", true),
        style: {
          flex: 1
        }
      }, "Yes"), /*#__PURE__*/React.createElement("button", {
        className: "btn" + (!inst.part_time_work ? " btn-primary" : " btn-secondary"),
        onClick: () => updateInstance(inst.instance_id, "part_time_work", false),
        style: {
          flex: 1
        }
      }, "No"))), inst.part_time_work && /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Expected annual earnings"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "Estimated income from part-time work during the 4 school years."), /*#__PURE__*/React.createElement("div", {
        style: {
          position: "relative"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#666",
          fontSize: 14
        }
      }, "$"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        style: {
          paddingLeft: 22
        },
        min: "0",
        value: inst.part_time_income || 10000,
        onChange: e => updateInstance(inst.instance_id, "part_time_income", Math.max(0, parseInt(e.target.value) || 10000))
      }))), /*#__PURE__*/React.createElement("div", {
        className: "form-group" + (showMissing && missingFieldNames.has("major") ? " field-missing" : "")
      }, /*#__PURE__*/React.createElement("label", null, "Intended major"), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.major,
        onChange: e => updateInstance(inst.instance_id, "major", e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: "",
        disabled: true
      }, "Select a major..."), ["computer_science", "engineering", "biology", "environmental_science", "nursing", "kinesiology", "business_finance", "accounting", "marketing", "psychology", "criminal_justice", "political_science", "communications", "english", "social_work", "education", "art_design", "undecided"].map(m => /*#__PURE__*/React.createElement("option", {
        key: m,
        value: m
      }, LABEL_MAP[m])))), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12,
          color: "var(--text-dim)",
          marginTop: 4,
          fontStyle: "italic"
        }
      }, "Note: CC transfer graduates typically earn ~2% less than direct 4-year grads in the same major, based on NACE employment data.")), pt === "trade" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "form-group" + (showMissing && missingFieldNames.has("trade_type") ? " field-missing" : "")
      }, /*#__PURE__*/React.createElement("label", null, "Which trade?"), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.trade_type,
        onChange: e => updateInstance(inst.instance_id, "trade_type", e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: "",
        disabled: true
      }, "Select a trade..."), ["electrician", "plumber", "hvac", "carpenter", "welder", "automotive_tech", "diesel_mechanic", "cnc_machinist", "lineworker", "ironworker", "elevator_mechanic", "heavy_equipment_op"].map(t => /*#__PURE__*/React.createElement("option", {
        key: t,
        value: t
      }, LABEL_MAP[t])))), /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Loan repayment term (years)"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "Trade school loans are typically shorter than college loans. Range: 3-15 years."), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn btn-secondary",
        style: {
          padding: "8px 12px",
          fontSize: 14,
          minWidth: 40
        },
        onClick: () => updateInstance(inst.instance_id, "loan_term_years", Math.max(3, (inst.loan_term_years || 5) - 1))
      }, "\u2212"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        className: "form-select",
        min: "3",
        max: "15",
        step: "1",
        value: inst.loan_term_years || 5,
        onChange: e => updateInstance(inst.instance_id, "loan_term_years", Math.max(3, Math.min(15, parseInt(e.target.value) || 5))),
        style: {
          flex: 1,
          textAlign: "center"
        }
      }), /*#__PURE__*/React.createElement("button", {
        className: "btn btn-secondary",
        style: {
          padding: "8px 12px",
          fontSize: 14,
          minWidth: 40
        },
        onClick: () => updateInstance(inst.instance_id, "loan_term_years", Math.min(15, (inst.loan_term_years || 5) + 1))
      }, "+")))), pt === "workforce" && /*#__PURE__*/React.createElement("div", {
        className: "form-group" + (showMissing && missingFieldNames.has("industry") ? " field-missing" : "")
      }, /*#__PURE__*/React.createElement("label", null, "Industry"), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.industry,
        onChange: e => updateInstance(inst.instance_id, "industry", e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: "",
        disabled: true
      }, "Select an industry..."), ["retail", "logistics", "food_service", "admin", "manufacturing", "security", "landscaping", "customer_service", "delivery_driver", "janitorial", "home_health_aide", "childcare"].map(i => /*#__PURE__*/React.createElement("option", {
        key: i,
        value: i
      }, LABEL_MAP[i])))), pt === "military" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "form-group"
      }, /*#__PURE__*/React.createElement("label", null, "Use GI Bill for college after service?"), /*#__PURE__*/React.createElement("div", {
        className: "toggle-row",
        onClick: () => updateInstance(inst.instance_id, "use_gi_bill", !inst.use_gi_bill)
      }, /*#__PURE__*/React.createElement("div", {
        className: "toggle-indicator" + (inst.use_gi_bill ? " on" : "")
      }, inst.use_gi_bill ? "✓" : ""), /*#__PURE__*/React.createElement("span", null, inst.use_gi_bill ? "Yes — pursue a degree after service" : "No — enter civilian workforce directly"))), inst.use_gi_bill && /*#__PURE__*/React.createElement("div", {
        className: "form-group" + (showMissing && missingFieldNames.has("gi_bill_major") ? " field-missing" : "")
      }, /*#__PURE__*/React.createElement("label", null, "Post-service major"), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.gi_bill_major,
        onChange: e => updateInstance(inst.instance_id, "gi_bill_major", e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: "",
        disabled: true
      }, "Select a major..."), ["computer_science", "engineering", "biology", "environmental_science", "nursing", "kinesiology", "business_finance", "accounting", "marketing", "psychology", "criminal_justice", "political_science", "communications", "english", "social_work", "education", "art_design", "undecided"].map(m => /*#__PURE__*/React.createElement("option", {
        key: m,
        value: m
      }, LABEL_MAP[m])))))));
    }), instances.length === 0 && /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--text-dim)",
        padding: 20,
        textAlign: "center"
      }
    }, "Go back and add at least one path to compare."));
  };

  // Step 2: Post-graduation location & living situation
  const renderLocationStep = () => {
    const selectedMetro = metros.find(m => m.code === shared.metro_area);
    return /*#__PURE__*/React.createElement("div", {
      className: "quiz-step"
    }, /*#__PURE__*/React.createElement("h2", null, "Post-graduation location"), /*#__PURE__*/React.createElement("p", {
      className: "hint"
    }, "Where you plan to live affects salary expectations and cost of living."), /*#__PURE__*/React.createElement("div", {
      className: "form-group"
    }, /*#__PURE__*/React.createElement("label", null, "Where do you plan to live after graduation?"), /*#__PURE__*/React.createElement("select", {
      className: "form-select",
      value: shared.metro_area,
      onChange: e => updateShared("metro_area", e.target.value)
    }, metros.length > 0 ? metros.map(m => /*#__PURE__*/React.createElement("option", {
      key: m.code,
      value: m.code
    }, m.label)) : /*#__PURE__*/React.createElement("option", {
      value: "national_avg"
    }, "Other / National Average"))), /*#__PURE__*/React.createElement("div", {
      className: "form-group"
    }, /*#__PURE__*/React.createElement("label", null, "Will you live at home after graduation?"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn" + (shared.living_at_home ? " btn-primary" : " btn-secondary"),
      onClick: () => updateShared("living_at_home", true),
      style: {
        flex: 1
      }
    }, "Yes"), /*#__PURE__*/React.createElement("button", {
      className: "btn" + (!shared.living_at_home ? " btn-primary" : " btn-secondary"),
      onClick: () => updateShared("living_at_home", false),
      style: {
        flex: 1
      }
    }, "No"))), shared.living_at_home && /*#__PURE__*/React.createElement("div", {
      className: "form-group"
    }, /*#__PURE__*/React.createElement("label", null, "How many years at home?"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "form-select",
      min: "1",
      max: "15",
      step: "1",
      value: shared.years_at_home,
      onChange: e => updateShared("years_at_home", Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))
    }), /*#__PURE__*/React.createElement("p", {
      className: "field-hint"
    }, "Living at home typically means living with parents or family to reduce rent and utility costs.")));
  };

  // Step 3: Review (sorted by path type)
  const renderReviewStep = () => {
    const sorted = sortInstances(instances);
    const metroLabel = (metros.find(m => m.code === shared.metro_area) || {}).label || "National Average";
    return /*#__PURE__*/React.createElement("div", {
      className: "quiz-step"
    }, /*#__PURE__*/React.createElement("h2", null, "Review your choices"), /*#__PURE__*/React.createElement("p", {
      className: "hint"
    }, "Everything look right? Hit \"Run Simulation\" to see your results."), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Comparing:"), " ", instances.length, " path", instances.length > 1 ? "s" : ""), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Location:"), " ", metroLabel), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Living at home:"), " ", shared.living_at_home ? `Yes (${shared.years_at_home} year${shared.years_at_home > 1 ? "s" : ""})` : "No"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Family savings:"), " ", fmtFull(shared.family_savings))), sorted.map(inst => {
      const color = instanceColor(inst, instances);
      return /*#__PURE__*/React.createElement("div", {
        key: inst.instance_id,
        className: "card",
        style: {
          padding: "12px 16px",
          marginBottom: 8,
          borderLeft: `3px solid ${color}`
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color
        }
      }, instanceLabel(inst, instances)), /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-dim)"
        }
      }, " \u2014 ", instanceSummary(inst)));
    }));
  };
  const stepRenderers = [renderPathStep, renderDetailsStep, renderLocationStep, renderReviewStep];
  return /*#__PURE__*/React.createElement("div", {
    className: "quiz-container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "quiz-progress"
  }, QUIZ_STEPS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s,
    className: "step" + (i < step ? " done" : "") + (i === step ? " current" : "")
  }))), stepRenderers[step](), /*#__PURE__*/React.createElement("div", {
    className: "btn-row"
  }, step > 0 && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: back
  }, "Back"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: next,
    disabled: !canNext()
  }, step === QUIZ_STEPS.length - 1 ? "Run Simulation →" : "Continue →")));
}

// ============================================================
// RESULTS PAGE (instance-aware)
// ============================================================

const CHART_TABS = [{
  key: "nw",
  label: "Net Worth",
  title: "Net Worth Over Time",
  subtitle: "Investments minus debt — the bottom line",
  suffix: null
}, {
  key: "income",
  label: "Income",
  title: "Annual Income",
  subtitle: "Gross income each year (part-time, apprentice wages, military pay, salary)",
  suffix: null
}, {
  key: "cum_earn",
  label: "Cumulative Earnings",
  title: "Cumulative Earnings",
  subtitle: "Total gross income earned through each age",
  suffix: null
}, {
  key: "debt",
  label: "Debt",
  title: "Student Debt Over Time",
  subtitle: "Outstanding student loan balance (paths with no debt are hidden)",
  suffix: null
}, {
  key: "invest",
  label: "Investments",
  title: "Investment Growth",
  subtitle: "Savings compounding at the configured annual return rate",
  suffix: null
}, {
  key: "savings",
  label: "Realized Savings Rate",
  title: "Realized Savings Rate",
  subtitle: "Percentage of income actually saved after taxes, expenses, and loan payments",
  suffix: "%"
}, {
  key: "loan_pay",
  label: "Loan Payments",
  title: "Annual Loan Payments",
  subtitle: "Amount paid toward student loans each year",
  suffix: null
}, {
  key: "annual_save",
  label: "Annual Savings",
  title: "Annual Savings Contribution",
  subtitle: "New savings contributed each year after all expenses",
  suffix: null
}, {
  key: "cum_tax",
  label: "Taxes Paid",
  title: "Cumulative Taxes Paid",
  subtitle: "Total taxes paid through each age",
  suffix: null
}];
function ResultsPage({
  quiz,
  onReset,
  onSave,
  saveStatus
}) {
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
      start_age: sa
    };
    fetch("/api/simulate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(r => {
      if (!r.ok) throw new Error("API error " + r.status);
      return r.json();
    }).then(data => {
      setResults(data.results);
      setChartData(buildChartData(data.results));
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, [quiz]);
  useEffect(() => {
    fetchData(projYears, savingsRate, investReturn, taxRate, startAge);
  }, []);
  const handleSlider = e => {
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
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "loading"
    }, /*#__PURE__*/React.createElement("div", {
      className: "spinner"
    }), /*#__PURE__*/React.createElement("p", null, "Running ", projYears, "-year projections...")));
  }
  if (error && !results) {
    return /*#__PURE__*/React.createElement("div", {
      className: "error-box"
    }, /*#__PURE__*/React.createElement("h3", null, "Simulation Error"), /*#__PURE__*/React.createElement("p", null, error), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-secondary",
      style: {
        marginTop: 16
      },
      onClick: onReset
    }, "Try Again"));
  }
  if (!results) return null;
  const endAge = startAge + projYears - 1;
  const tab = CHART_TABS.find(t => t.key === activeTab);

  // Filter out zero-debt instances for the debt chart
  const filteredResults = activeTab === "debt" ? (() => {
    const debtResults = results.filter(r => r.snapshots.some(s => s.debt_remaining > 0));
    if (debtResults.length === 0) return null;
    return debtResults;
  })() : results;

  // Preserve user-selected order (no sorting by net worth)
  const sorted = results;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "status-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge active"
  }, results.length, " Path", results.length > 1 ? "s" : "", " Compared"), /*#__PURE__*/React.createElement("span", {
    className: "badge active"
  }, LABEL_MAP[quiz.metro_area] || LABEL_MAP[quiz.region] || "National Average"), /*#__PURE__*/React.createElement("span", {
    className: "badge active"
  }, projYears, "-Year Projection (ages ", startAge, "\u2013", endAge, ")"), /*#__PURE__*/React.createElement("span", {
    className: "badge",
    style: {
      cursor: "pointer",
      borderColor: "var(--danger)",
      color: "var(--danger)"
    },
    onClick: onReset
  }, "Start New Projection")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: "center",
      padding: "16px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-dim)",
      fontSize: 13
    }
  }, "Timeline:"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, "10 yrs"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 10,
    max: 50,
    value: projYears,
    onChange: handleSlider,
    style: {
      width: "280px",
      accentColor: "var(--accent)",
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, "50 yrs"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 18,
      color: "var(--accent)",
      minWidth: 90
    }
  }, projYears, " years")), loading && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-dim)",
      fontSize: 12,
      marginTop: 4
    }
  }, "Updating...")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setShowAdvanced(!showAdvanced),
    style: {
      padding: "14px 20px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 14,
      color: "var(--text-dim)"
    }
  }, "Advanced Assumptions"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-dim)",
      fontSize: 12
    }
  }, showAdvanced ? "▲ Collapse" : "▼ Expand")), showAdvanced && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px 20px",
      borderTop: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13
    }
  }, "Starting Age"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--accent)"
    }
  }, startAge)), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 15,
    max: 40,
    step: 1,
    value: startAge,
    onChange: e => {
      const v = parseInt(e.target.value);
      handleAssumptionChange(setStartAge, v, savingsRate, investReturn, taxRate, v);
    },
    style: {
      width: "100%",
      accentColor: "var(--accent)",
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginTop: 4
    }
  }, "Age when you start your post-graduation path (default: 18)")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13
    }
  }, "Savings Rate"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--accent)"
    }
  }, Math.round(savingsRate * 100), "%")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 100,
    step: 1,
    value: Math.round(savingsRate * 100),
    onChange: e => {
      const v = parseInt(e.target.value) / 100;
      handleAssumptionChange(setSavingsRate, v, v, investReturn, taxRate, startAge);
    },
    style: {
      width: "100%",
      accentColor: "var(--accent)",
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginTop: 4
    }
  }, "Percent of after-tax income saved annually")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13
    }
  }, "Expected Annual Investment Return"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--accent)"
    }
  }, (investReturn * 100).toFixed(1), "%")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 200,
    step: 5,
    value: Math.round(investReturn * 1000),
    onChange: e => {
      const v = parseInt(e.target.value) / 1000;
      handleAssumptionChange(setInvestReturn, v, savingsRate, v, taxRate, startAge);
    },
    style: {
      width: "100%",
      accentColor: "var(--accent)",
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginTop: 4
    }
  }, "Historical average: ~7%/year after inflation. Conservative: 6%. Aggressive: 8%.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13
    }
  }, "Estimated Effective Income Tax Rate"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--accent)"
    }
  }, Math.round(taxRate * 100), "%")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 10,
    max: 40,
    step: 1,
    value: Math.round(taxRate * 100),
    onChange: e => {
      const v = parseInt(e.target.value) / 100;
      handleAssumptionChange(setTaxRate, v, savingsRate, investReturn, v, startAge);
    },
    style: {
      width: "100%",
      accentColor: "var(--accent)",
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginTop: 4
    }
  }, "Blended federal + state + payroll tax burden. ", LABEL_MAP[quiz.metro_area] || LABEL_MAP[quiz.region], " region average: ", Math.round((REGION_TAX_DEFAULTS[quiz.region] || 0.22) * 100), "%.")))), /*#__PURE__*/React.createElement("div", {
    className: "summary-grid"
  }, sorted.map((r, i) => {
    const id = r.scenario.instance_id || r.scenario.path_type;
    const color = colorMap[id] || "#888";
    const label = labelMap[id] || r.scenario.name;
    const finalNW = r.snapshots[r.snapshots.length - 1].net_worth;
    const df = r.summary.year_debt_free;
    const totalEarn = r.summary.total_earnings;
    return /*#__PURE__*/React.createElement("div", {
      className: "summary-card",
      key: id,
      style: {
        borderLeft: `3px solid ${color}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "label",
      style: {
        color
      }
    }, "#", i + 1, " \u2014 ", label), /*#__PURE__*/React.createElement("div", {
      className: "value",
      style: {
        color
      }
    }, fmtFull(finalNW)), /*#__PURE__*/React.createElement("div", {
      className: "detail"
    }, df ? `Debt-free at age ${df}` : "No student debt", " · ", fmt(totalEarn), " earned"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "disclaimer-banner"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "16",
    x2: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "8",
    x2: "12.01",
    y2: "8"
  })), /*#__PURE__*/React.createElement("span", null, "All figures are in ", /*#__PURE__*/React.createElement("strong", null, "nominal dollars"), ". Living expenses grow at 3% annually to reflect inflation; income and investment returns are not inflation-adjusted. These projections use simplified assumptions and national averages. Your actual results will vary.")), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chart-tabs"
  }, CHART_TABS.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.key,
    className: "chart-tab" + (activeTab === t.key ? " active" : ""),
    onClick: () => setActiveTab(t.key)
  }, t.label))), /*#__PURE__*/React.createElement("h2", null, tab.title), /*#__PURE__*/React.createElement("p", {
    className: "subtitle"
  }, tab.subtitle), activeTab === "debt" && !filteredResults ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-dim)",
      padding: "40px 0",
      textAlign: "center"
    }
  }, "No paths in this comparison carry student debt.") : /*#__PURE__*/React.createElement(SimChart, {
    data: chartData,
    results: filteredResults || results,
    dataKeySuffix: activeTab,
    suffix: tab.suffix,
    yDomain: activeTab === "savings" ? [0, "auto"] : undefined,
    colorMap: colorMap,
    labelMap: labelMap,
    savingsRate: savingsRate
  })), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Key Insights"), /*#__PURE__*/React.createElement("p", {
    className: "subtitle"
  }, "What the numbers tell us about your options"), /*#__PURE__*/React.createElement("div", {
    style: {
      lineHeight: 1.8,
      fontSize: 14
    }
  }, sorted.length >= 2 && (() => {
    const best = sorted[0],
      worst = sorted[sorted.length - 1];
    const bestNW = best.snapshots[best.snapshots.length - 1].net_worth;
    const worstNW = worst.snapshots[worst.snapshots.length - 1].net_worth;
    const gap = bestNW - worstNW;
    const bestId = best.scenario.instance_id || best.scenario.path_type;
    const worstId = worst.scenario.instance_id || worst.scenario.path_type;
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        marginBottom: 12
      }
    }, "Over ", projYears, " years, ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: colorMap[bestId]
      }
    }, labelMap[bestId]), " leads with a projected net worth of ", /*#__PURE__*/React.createElement("strong", null, fmtFull(bestNW)), ", which is ", /*#__PURE__*/React.createElement("strong", null, fmtFull(gap)), " more than ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: colorMap[worstId]
      }
    }, labelMap[worstId]), " (", fmtFull(worstNW), ")."), sorted.filter(r => r.summary.year_debt_free).length > 0 && /*#__PURE__*/React.createElement("p", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Debt timelines:"), " ", sorted.filter(r => r.summary.year_debt_free).map(r => {
      const rid = r.scenario.instance_id || r.scenario.path_type;
      return `${labelMap[rid]} is debt-free at age ${r.summary.year_debt_free}`;
    }).join("; "), sorted.filter(r => !r.summary.year_debt_free && r.summary.total_cost_of_education === 0).length > 0 && "; " + sorted.filter(r => !r.summary.year_debt_free && r.summary.total_cost_of_education === 0).map(r => labelMap[r.scenario.instance_id || r.scenario.path_type]).join(", ") + " carry no student debt", "."), sorted.filter(r => r.summary.debt_burden_ratio > 0).length > 0 && /*#__PURE__*/React.createElement("p", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Peak debt burden:"), " ", sorted.filter(r => r.summary.debt_burden_ratio > 0).map(r => {
      const rid = r.scenario.instance_id || r.scenario.path_type;
      const pct = (r.summary.debt_burden_ratio * 100).toFixed(0);
      const level = r.summary.debt_burden_ratio > 0.15 ? " (high)" : r.summary.debt_burden_ratio > 0.10 ? " (moderate)" : " (manageable)";
      return `${labelMap[rid]}: ${pct}% of income${level}`;
    }).join("; "), ".", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-dim)",
        fontSize: 12
      }
    }, " Peak annual loan payment as % of take-home pay. Under 10% is comfortable; over 15% can be a strain.")), sorted.filter(r => r.summary.loan_extended).length > 0 && /*#__PURE__*/React.createElement("p", {
      style: {
        marginBottom: 12,
        padding: "10px 14px",
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: 8,
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "#f59e0b"
      }
    }, "Loan repayment adjusted:"), " ", sorted.filter(r => r.summary.loan_extended).map(r => {
      const rid = r.scenario.instance_id || r.scenario.path_type;
      const orig = r.summary.loan_term_original;
      const actual = r.summary.loan_term_actual;
      return `${labelMap[rid]}: selected ${orig}-year repayment, but income-based payments extend it to ~${actual} years`;
    }).join("; "), ".", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-dim)"
      }
    }, "Loan payments are capped at what you can afford after living expenses. The remaining balance continues accruing interest.")), /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--text-dim)",
        fontStyle: "italic",
        marginTop: 16
      }
    }, "Try adjusting the timeline slider above \u2014 shorter horizons (10-15 years) tend to favor paths with no debt, while longer horizons (30+ years) show the compounding advantage of higher salaries."));
  })())), (() => {
    const effectiveTab = tableTab || results[0]?.scenario.instance_id || results[0]?.scenario.path_type || "";
    const activeResult = results.find(r => (r.scenario.instance_id || r.scenario.path_type) === effectiveTab);
    const pathFormulas = {
      college: "Income during school = part-time work earnings. After graduation: Starting Salary × (1 + Growth Rate)^years of experience. Grace period year = 50% of starting salary.",
      cc_transfer: "Same as 4-year college, but starting salary is ~2% lower for CC transfers. First 2 years at community college tuition rates.",
      trade: "Apprentice wages increase each year (40→60→75→90% of journeyman rate). After apprenticeship: Journeyman Salary × (1 + Growth Rate)^years.",
      workforce: "Starting Wage × (1.02)^years. No education costs or debt. Income begins immediately.",
      military: "Active duty pay during service (E1→E4 progression). GI Bill housing allowance (~$28k/yr, tax-exempt) during school. Then civilian career salary."
    };
    const sharedFormulas = "Savings = max(0, (Net Income − Living Expenses − Loan Payment) × Savings Rate)\nInvestments = Previous Balance × (1 + Return Rate) + Annual Savings\nNet Worth = Investment Balance − Remaining Debt";
    return /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        padding: 0,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setShowTable(!showTable),
      style: {
        padding: "14px 20px",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 14
      }
    }, "Year-by-Year Breakdown"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-dim)",
        fontSize: 12
      }
    }, showTable ? "▲ Collapse" : "▼ Expand")), showTable && /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border)",
        overflowX: "auto"
      }
    }, results.map(r => {
      const id = r.scenario.instance_id || r.scenario.path_type;
      return /*#__PURE__*/React.createElement("button", {
        key: id,
        onClick: () => setTableTab(id),
        style: {
          padding: "10px 16px",
          fontSize: 12,
          fontWeight: effectiveTab === id ? 600 : 400,
          background: effectiveTab === id ? "var(--surface)" : "transparent",
          borderBottom: effectiveTab === id ? "2px solid var(--accent)" : "2px solid transparent",
          color: effectiveTab === id ? "var(--accent)" : "var(--text-dim)",
          border: "none",
          cursor: "pointer",
          whiteSpace: "nowrap"
        }
      }, labelMap[id] || id);
    })), activeResult && /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: "auto",
        padding: "0 0 16px 0"
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
        minWidth: 900
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        background: "var(--bg)",
        position: "sticky",
        top: 0
      }
    }, ["Year", "Age", "Gross Income", "Net Income", "Expenses", "Loan Payment", "Debt", "Savings", "Investments", "Net Worth"].map(h => /*#__PURE__*/React.createElement("th", {
      key: h,
      style: {
        padding: "8px 10px",
        textAlign: "right",
        borderBottom: "1px solid var(--border)",
        color: "var(--text-dim)",
        fontWeight: 600,
        whiteSpace: "nowrap"
      }
    }, h)))), /*#__PURE__*/React.createElement("tbody", null, activeResult.snapshots.map((s, i) => /*#__PURE__*/React.createElement("tr", {
      key: i,
      style: {
        borderBottom: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right"
      }
    }, s.year + 1), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right"
      }
    }, s.age), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right",
        color: "#4ade80"
      }
    }, fmtFull(s.gross_income)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right"
      }
    }, fmtFull(s.net_income)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right",
        color: "#f87171"
      }
    }, fmtFull(s.living_expenses)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right",
        color: s.loan_payment > 0 ? "#fbbf24" : "var(--text-dim)"
      }
    }, fmtFull(s.loan_payment)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right",
        color: s.debt_remaining > 0 ? "#f87171" : "var(--text-dim)"
      }
    }, fmtFull(s.debt_remaining)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right",
        color: "#60a5fa"
      }
    }, fmtFull(s.annual_savings)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right",
        color: "#a78bfa"
      }
    }, fmtFull(s.investment_balance)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        textAlign: "right",
        fontWeight: 600,
        color: s.net_worth >= 0 ? "#4ade80" : "#f87171"
      }
    }, fmtFull(s.net_worth)))))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "16px 20px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        fontSize: 13,
        marginBottom: 8
      }
    }, "How these numbers are calculated"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-dim)",
        marginBottom: 8,
        whiteSpace: "pre-line"
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Income:"), " ", pathFormulas[activeResult.scenario.path_type] || "Based on path-specific income model."), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-dim)",
        whiteSpace: "pre-line"
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Shared formulas:"), "\n", sharedFormulas)))));
  })(), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: "center",
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontWeight: 600,
      marginBottom: 12
    }
  }, "Found this useful?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      justifyContent: "center",
      flexWrap: "wrap"
    }
  }, onSave && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      padding: "10px 20px",
      fontSize: 13
    },
    onClick: () => onSave(results),
    disabled: saveStatus === "saving" || saveStatus === "saved"
  }, saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Simulation"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "10px 20px",
      fontSize: 13
    },
    onClick: () => {
      const shareUrl = window.location.origin + "?sim=" + btoa(JSON.stringify(quiz));
      const text = `I just compared ${results.length} career paths on Horizon18 — a free tool that shows the financial reality of college, trades, military, and more over ${projYears} years. Check it out:`;
      if (navigator.share) {
        navigator.share({
          title: "Horizon18",
          text,
          url: shareUrl
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text + " " + shareUrl).then(() => {
          alert("Link copied to clipboard!");
        });
      }
    }
  }, "Share Results"), /*#__PURE__*/React.createElement("a", {
    className: "btn btn-secondary",
    style: {
      padding: "10px 20px",
      fontSize: 13,
      textDecoration: "none",
      display: "inline-block"
    },
    href: `https://twitter.com/intent/tweet?text=${encodeURIComponent("I just compared career paths on @horizon18 — college, trades, military & more. Free tool that shows the real financial picture:")}&url=${encodeURIComponent("https://horizon18.app")}`,
    target: "_blank",
    rel: "noopener"
  }, "Post on X")), saveStatus === "error" && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--danger)",
      fontSize: 12,
      marginTop: 8
    }
  }, "Failed to save. Please try again.")), /*#__PURE__*/React.createElement(HowItWorks, null), /*#__PURE__*/React.createElement("div", {
    className: "footer"
  }, "Horizon18 \u2014 For educational purposes only. This tool does not provide financial advice.", /*#__PURE__*/React.createElement("br", null), "Living expenses grow at 3% annually to reflect inflation. Income and investment returns are not inflation-adjusted.", /*#__PURE__*/React.createElement("br", null), "Projections use simplified assumptions and generalized data sources (BLS, College Scorecard, NACE, DFAS)."));
}

// ============================================================
// HOW THE MATH WORKS
// ============================================================

function HiwDropdown({
  icon,
  title,
  badge,
  children
}) {
  const [open, setOpen] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "hiw-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hiw-header",
    onClick: () => setOpen(!open)
  }, /*#__PURE__*/React.createElement("h4", null, icon, " ", title, " ", badge && /*#__PURE__*/React.createElement("span", {
    className: "hiw-badge"
  }, badge)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-dim)",
      fontSize: 12
    }
  }, open ? "▲" : "▼")), open && /*#__PURE__*/React.createElement("div", {
    className: "hiw-body"
  }, children));
}
function HowItWorks() {
  const [open, setOpen] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(!open),
    style: {
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "How the Math Works"), /*#__PURE__*/React.createElement("p", {
    className: "subtitle"
  }, "See the formulas, steps, and assumptions behind every path")), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-dim)",
      fontSize: 12
    }
  }, open ? "▲ Collapse" : "▼ Expand")), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(HiwDropdown, {
    icon: "\uD83C\uDF93",
    title: "4-Year College",
    badge: "4 years school"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "What this path looks like:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Years 1\u20134 (ages 18\u201321):"), " Full-time student. You pay tuition + room & board each year. Optional part-time work (default: ~$8,000/year if enabled; you can adjust in path settings)."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Year 5 (age 22):"), " Grace period \u2014 6 months after graduation before loan payments begin. You start job searching; we count half a year of salary."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Year 6+ (age 23+):"), " Full-time career. Salary grows each year based on your major. You pay off loans, save, and invest.")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Education cost:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Total Cost = (Annual Tuition \xD7 4 years) + (Room & Board \xD7 4 years)", /*#__PURE__*/React.createElement("br", null), "Loan Amount = Total Cost \u2212 Family Savings (if any)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (Public In-State, off-campus):", /*#__PURE__*/React.createElement("br", null), "= ($11,371 \xD7 4) + ($9,600 \xD7 4) = $83,884", /*#__PURE__*/React.createElement("br", null), "With $0 savings \u2192 you borrow $83,884", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Family savings are applied to education costs first. Any excess becomes your starting investment."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Income after graduation:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Salary in Year N = Starting Salary \xD7 (1 + Growth Rate)^(years working)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (STEM major):", /*#__PURE__*/React.createElement("br", null), "Year 1 salary = $80,000", /*#__PURE__*/React.createElement("br", null), "Year 5 salary = $80,000 \xD7 1.04^4 = $93,588", /*#__PURE__*/React.createElement("br", null), "Growth rate varies by major: STEM 4%, Business 3.5%, Healthcare 3%"), /*#__PURE__*/React.createElement("div", {
    className: "hiw-note"
  }, "Source: NACE salary survey, BLS Occupational Outlook. Tuition: College Board 2025-26.")), /*#__PURE__*/React.createElement(HiwDropdown, {
    icon: "\uD83D\uDD04",
    title: "Community College + Transfer",
    badge: "2 + 2 years"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "What this path looks like:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Years 1\u20132 (ages 18\u201319):"), " Community college at much lower tuition. Same room & board costs."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Years 3\u20134 (ages 20\u201321):"), " Transfer to a 4-year university. Pay university tuition for the final 2 years."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Year 5+ (age 22+):"), " Same career path as a 4-year grad, but starting salary is 2% lower (reflects minor hiring differences for transfer students).")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Cost savings vs. straight 4-year:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "CC tuition = $3,890/year vs. Public In-State = $11,371/year", /*#__PURE__*/React.createElement("br", null), "2-year savings on tuition alone = ($11,371 \u2212 $3,890) \xD7 2 = $14,962", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Total Cost = ($3,890 \xD7 2) + ($11,371 \xD7 2) + (Room & Board \xD7 4)", /*#__PURE__*/React.createElement("br", null), "= $7,780 + $22,742 + $38,400 = $68,922", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Room & board costs can be configured separately for CC and university years."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "The trade-off:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Starting Salary = Same-major salary \xD7 0.98 (2% discount)", /*#__PURE__*/React.createElement("br", null), "CC transfer graduates earn approximately 2% less than direct 4-year graduates in the same major.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (STEM): $80,000 \xD7 0.98 = $78,400", /*#__PURE__*/React.createElement("br", null), "Less debt up front, slightly lower starting pay. Over 30+ years the savings usually win."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-note"
  }, "Source: College Board community college pricing. 2% discount: NACE employment data estimate.")), /*#__PURE__*/React.createElement(HiwDropdown, {
    icon: "\uD83D\uDD27",
    title: "Trade / Apprenticeship",
    badge: "Earn while you learn"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "What this path looks like:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Year 1 (age 18):"), " Start trade school or apprenticeship. School costs are low ($12K-$15K total, not per year). You earn a wage from day one \u2014 starting around 40-50% of a journeyman's salary."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Years 2\u20134 (ages 19\u201321):"), " Continue apprenticeship with increasing wages each year (roughly 60% \u2192 70% \u2192 85% of journeyman pay)."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Year 5+ (age 22+):"), " Become a licensed journeyman earning full salary. Growth is steady at about 2.5% per year.")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Apprentice wage progression (Electrician example):")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Year 1: $35,000 (about 52% of journeyman pay)", /*#__PURE__*/React.createElement("br", null), "Year 2: $42,000 (62%)", /*#__PURE__*/React.createElement("br", null), "Year 3: $49,000 (72%)", /*#__PURE__*/React.createElement("br", null), "Year 4: $56,000 (83%)", /*#__PURE__*/React.createElement("br", null), "Year 5+: $67,810 \xD7 (1.025)^years as journeyman"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Education cost:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Trade school total (one-time, not per year):", /*#__PURE__*/React.createElement("br", null), "Electrician: $14,640 | Plumber: $12,500 | HVAC: $12,500", /*#__PURE__*/React.createElement("br", null), "Carpenter: $12,550 | Welder: $12,000 | Automotive Tech: $12,500", /*#__PURE__*/React.createElement("br", null), "Diesel Mechanic: $13,000 | CNC Machinist: $12,750 | Lineworker: $14,500", /*#__PURE__*/React.createElement("br", null), "Ironworker: $13,200 | Elevator Mechanic: $15,000 | Heavy Equipment Op: $12,200", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Journeyman Salaries (Year 5+):", /*#__PURE__*/React.createElement("br", null), "Electrician: $67,810 | Plumber: $62,430 | HVAC: $61,040", /*#__PURE__*/React.createElement("br", null), "Carpenter: $54,650 | Welder: $52,810 | Automotive Tech: $45,230", /*#__PURE__*/React.createElement("br", null), "Diesel Mechanic: $56,780 | CNC Machinist: $59,400 | Lineworker: $72,150", /*#__PURE__*/React.createElement("br", null), "Ironworker: $64,320 | Elevator Mechanic: $82,900 | Heavy Equipment Op: $58,620", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Loan term: 5 years (shorter than college loans)", /*#__PURE__*/React.createElement("br", null), "No grace period \u2014 you're already working"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Why trades often win early:"), " You earn income from age 18 with minimal debt. College grads don't start full-time earning until age 22-23 and carry much larger loans."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-note"
  }, "Source: BLS wage data, Dept. of Labor apprenticeship records, industry training providers.")), /*#__PURE__*/React.createElement(HiwDropdown, {
    icon: "\uD83D\uDCBC",
    title: "Direct Workforce",
    badge: "Start immediately"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "What this path looks like:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Day 1 (age 18):"), " Start working full-time right after high school. No education costs, no loans, no delay."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Every year after:"), " Your salary grows at 2% per year. This is slower growth than paths requiring a degree, but you have a head start. Default salary growth: 2% annually.")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Starting wages by industry:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Retail:        $32,240/year", /*#__PURE__*/React.createElement("br", null), "Logistics:     $31,137/year", /*#__PURE__*/React.createElement("br", null), "Food Service:  $28,245/year", /*#__PURE__*/React.createElement("br", null), "Office/Admin:  $35,419/year", /*#__PURE__*/React.createElement("br", null), "Manufacturing: $34,320/year"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Income growth:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Salary in Year N = Starting Wage \xD7 (1.02)^N", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (Admin, Midwest):", /*#__PURE__*/React.createElement("br", null), "Start: $35,419 \xD7 0.95 (regional) = $33,648", /*#__PURE__*/React.createElement("br", null), "Age 30: $33,648 \xD7 1.02^12 = $42,680"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "The trade-off:"), " No debt and immediate income, but lower lifetime earnings. Over 30+ years, the salary ceiling is lower than degree-requiring paths."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-note"
  }, "Source: BLS Occupational Employment and Wage Statistics, Indeed/Glassdoor 2025.")), /*#__PURE__*/React.createElement(HiwDropdown, {
    icon: "\uD83C\uDF96\uFE0F",
    title: "Military Enlistment",
    badge: "Service + benefits"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "What this path looks like:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Years 1\u20134 (ages 18\u201321):"), " Active duty enlisted service. You earn military pay (base pay + housing allowance). Almost all living expenses are covered \u2014 housing, food, healthcare."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "If using GI Bill \u2014 Years 5\u20138 (ages 22\u201325):"), " Free college. The GI Bill covers tuition (up to $29,921/year) plus a monthly housing allowance of $2,338. This income is tax-free."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "After service/school:"), " Enter civilian career. Veterans with degrees get the same salary as other college grads. Without GI Bill, you get a 10% hiring premium over standard entry-level wages.")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Military pay progression:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Year 1 (E-1): $25,296 base + $14,400 BAH = $39,696", /*#__PURE__*/React.createElement("br", null), "Year 2 (E-2): $28,380 base + $14,400 BAH = $42,780", /*#__PURE__*/React.createElement("br", null), "Year 3 (E-3): $30,132 base + $14,400 BAH = $44,532", /*#__PURE__*/React.createElement("br", null), "Year 4 (E-4): $34,584 base + $15,000 BAH = $49,584"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Monthly expenses during service:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Only ~$400/month out-of-pocket (phone, car, insurance, personal)", /*#__PURE__*/React.createElement("br", null), "vs. $2,200/month for independent civilian living", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "That's $21,600/year you're saving compared to living on your own"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "GI Bill math:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Tuition: Covered (up to $29,921/year private, public in-state fully covered)", /*#__PURE__*/React.createElement("br", null), "Housing: $2,338/month = $28,056/year (TAX FREE)", /*#__PURE__*/React.createElement("br", null), "Books: $1,000/year stipend", /*#__PURE__*/React.createElement("br", null), "Duration: 36 months of benefits (9 months/academic year \xD7 4 years)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Income shown during GI Bill school years (~$28,000/year) represents the GI Bill housing allowance, which is tax-exempt.", /*#__PURE__*/React.createElement("br", null), "Student loans needed: $0"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Without GI Bill \u2014 civilian transition:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Base civilian wage (Admin): $35,419", /*#__PURE__*/React.createElement("br", null), "Veteran premium (+10%): $35,419 \xD7 1.10 = $38,961", /*#__PURE__*/React.createElement("br", null), "Growth rate: 3% per year", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Military pay rates based on 2025 DoD tables."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-note"
  }, "Source: DFAS 2025 pay tables, VA Post-9/11 GI Bill rates 2025-26, Military.com BAH calculator.")), /*#__PURE__*/React.createElement(HiwDropdown, {
    icon: "\uD83D\uDCD0",
    title: "Shared Formulas (All Paths)",
    badge: "Core math"
  }, /*#__PURE__*/React.createElement("p", null, "These calculations apply to every path. They're how we turn income and expenses into the charts you see above."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCB0 Take-Home Pay (after taxes):")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Net Income = Gross Income \xD7 (1 \u2212 Tax Rate)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: $60,000 gross \xD7 (1 \u2212 0.18) = $49,200 take-home", /*#__PURE__*/React.createElement("br", null), "Default tax rate: 18% (simplified flat rate)"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83C\uDFE6 Student Loan Payments:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Standard Amortization Formula:", /*#__PURE__*/React.createElement("br", null), "Monthly Payment = P \xD7 [r(1+r)^n] / [(1+r)^n \u2212 1]", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Don't worry if that looks scary! Here's what the letters mean:", /*#__PURE__*/React.createElement("br", null), "P = your total loan balance when payments start", /*#__PURE__*/React.createElement("br", null), "r = monthly interest rate (6.5% annual \xF7 12 months = 0.542%)", /*#__PURE__*/React.createElement("br", null), "n = total number of monthly payments (10 years \xD7 12 = 120 payments)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: $83,884 loan at 6.5% for 10 years", /*#__PURE__*/React.createElement("br", null), "Monthly payment \u2248 $953", /*#__PURE__*/React.createElement("br", null), "Total paid over 10 years \u2248 $114,360", /*#__PURE__*/React.createElement("br", null), "Total interest \u2248 $30,476"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\u26A0\uFE0F Loan payments are capped at what you can afford:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Actual Payment = min(Required Payment, Net Income \u2212 Living Expenses)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "If your income minus expenses is less than the required monthly payment,", /*#__PURE__*/React.createElement("br", null), "the simulation only pays what you can actually afford.", /*#__PURE__*/React.createElement("br", null), "The remaining balance continues accruing interest, and your loan takes", /*#__PURE__*/React.createElement("br", null), "longer to pay off than the originally selected term.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: Required payment = $953/month ($11,436/year)", /*#__PURE__*/React.createElement("br", null), "But disposable income = $8,000/year", /*#__PURE__*/React.createElement("br", null), "\u2192 You pay $8,000. The shortfall stays on the loan with interest."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\u26A0\uFE0F Interest grows while you're in school:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Each year in school: Balance = Balance \xD7 (1 + 0.065)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: Borrow $83,884 freshman year", /*#__PURE__*/React.createElement("br", null), "After 4 years of accrual: $83,884 \xD7 1.065^4 \u2248 $107,870", /*#__PURE__*/React.createElement("br", null), "That's $23,986 in interest before you make a single payment!"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCC8 Investment Growth (compound interest):")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Each year: Investments = (Previous Balance \xD7 1.07) + New Savings", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Default return rate: 7% per year", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: Save $5,000/year for 30 years at 7%", /*#__PURE__*/React.createElement("br", null), "Total contributed: $150,000", /*#__PURE__*/React.createElement("br", null), "Final balance: ~$472,000 (compound interest earned you $322,000!)"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCB5 How much you save each year:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Annual Savings = max(0, (Net Income \u2212 Living Expenses \u2212 Loan Payment) \xD7 Savings Rate)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "The 'Realized Savings Rate' chart shows what percentage of income was actually saved \u2014 which may be lower than your target if expenses and loan payments are high."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCCA Net Worth (the bottom line):")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Net Worth = Investment Balance \u2212 Remaining Debt", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "This is the single number that captures everything:", /*#__PURE__*/React.createElement("br", null), "what you've built up minus what you still owe."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83C\uDF0E Metro-area-based adjustments:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Salary = Base Salary \xD7 Metro Area Multiplier", /*#__PURE__*/React.createElement("br", null), "Expenses = Base Expenses \xD7 Metro Area Multiplier", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Northeast: Salary \xD71.15, Expenses \xD71.25 (pays more, costs more)", /*#__PURE__*/React.createElement("br", null), "Southeast: Salary \xD70.90, Expenses \xD70.87 (lower pay, lower cost)", /*#__PURE__*/React.createElement("br", null), "Midwest:   Salary \xD70.95, Expenses \xD70.90", /*#__PURE__*/React.createElement("br", null), "Southwest: Salary \xD70.97, Expenses \xD70.95", /*#__PURE__*/React.createElement("br", null), "West Coast: Salary \xD71.12, Expenses \xD71.15", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Living Expenses Base: Independent living ~$2,200/month. Living at home ~$800/month. Both adjusted by metro area cost-of-living multiplier."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83C\uDFE0 Living Expenses:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "At home:       $800/month base (before regional multiplier)", /*#__PURE__*/React.createElement("br", null), "Independent: $2,200/month base (rent, food, utilities, etc.)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Expenses grow at 3% per year to reflect inflation:", /*#__PURE__*/React.createElement("br", null), "Year N Expenses = Base Expenses \xD7 (1.03)^N", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (Midwest, independent, Year 0):", /*#__PURE__*/React.createElement("br", null), "$2,200 \xD7 0.90 = $1,980/month = $23,760/year", /*#__PURE__*/React.createElement("br", null), "By Year 10: $23,760 \xD7 1.03^10 = ~$31,933/year"), /*#__PURE__*/React.createElement("div", {
    className: "hiw-note"
  }, "All defaults are adjustable via the Advanced Assumptions sliders above."))));
}

// ============================================================
// APP ROOT
// ============================================================

// ══════════════════════════════════════════════════════════════
// AUTH COMPONENTS
// ══════════════════════════════════════════════════════════════

function LoginPage({
  onLogin,
  onSwitch,
  onGuest
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiCall("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password
        })
      });
      setAuth(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "quiz-container",
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      marginBottom: 8
    }
  }, "Sign In"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-dim)",
      fontSize: 14,
      marginBottom: 24
    }
  }, "Save simulations and access them from any device."), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    style: {
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Email"), /*#__PURE__*/React.createElement("input", {
    className: "form-input",
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Password"), /*#__PURE__*/React.createElement("input", {
    className: "form-input",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    required: true
  })), error && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--danger)",
      fontSize: 13,
      marginBottom: 12
    }
  }, error), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit",
    disabled: loading,
    style: {
      width: "100%",
      marginBottom: 12
    }
  }, loading ? "Signing in..." : "Sign In")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-dim)",
      marginBottom: 8
    }
  }, "Don't have an account?", " ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onSwitch();
    },
    style: {
      color: "var(--accent)"
    }
  }, "Create one")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onGuest();
    },
    style: {
      color: "var(--text-dim)"
    }
  }, "Continue as guest")));
}
function RegisterPage({
  onRegister,
  onSwitch,
  onGuest
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiCall("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          display_name: name
        })
      });
      setAuth(data.token, data.user);
      onRegister(data.user);
    } catch (err) {
      setError(err.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "quiz-container",
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      marginBottom: 8
    }
  }, "Create Account"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-dim)",
      fontSize: 14,
      marginBottom: 24
    }
  }, "Save and revisit your simulations anytime."), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    style: {
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Name (optional)"), /*#__PURE__*/React.createElement("input", {
    className: "form-input",
    type: "text",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "Your name"
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Email"), /*#__PURE__*/React.createElement("input", {
    className: "form-input",
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    required: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Password"), /*#__PURE__*/React.createElement("input", {
    className: "form-input",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    required: true,
    placeholder: "At least 8 characters"
  })), /*#__PURE__*/React.createElement("div", {
    className: "form-group"
  }, /*#__PURE__*/React.createElement("label", null, "Confirm Password"), /*#__PURE__*/React.createElement("input", {
    className: "form-input",
    type: "password",
    value: confirm,
    onChange: e => setConfirm(e.target.value),
    required: true
  })), error && /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--danger)",
      fontSize: 13,
      marginBottom: 12
    }
  }, error), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    type: "submit",
    disabled: loading,
    style: {
      width: "100%",
      marginBottom: 12
    }
  }, loading ? "Creating account..." : "Create Account")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "var(--text-dim)",
      marginBottom: 8
    }
  }, "Already have an account?", " ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onSwitch();
    },
    style: {
      color: "var(--accent)"
    }
  }, "Sign in")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onGuest();
    },
    style: {
      color: "var(--text-dim)"
    }
  }, "Continue as guest")));
}
function DashboardPage({
  onLoadSim,
  onNewSim,
  onLogout
}) {
  const [sims, setSims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  useEffect(() => {
    apiCall("/api/simulations").then(data => {
      setSims(data.simulations || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  const handleDelete = async id => {
    if (!confirm("Delete this simulation?")) return;
    try {
      await apiCall("/api/simulations/" + id, {
        method: "DELETE"
      });
      setSims(prev => prev.filter(s => s.id !== id));
    } catch (e) {}
  };
  const handleRename = async id => {
    if (!editTitle.trim()) return;
    try {
      await apiCall("/api/simulations/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle
        })
      });
      setSims(prev => prev.map(s => s.id === id ? {
        ...s,
        title: editTitle
      } : s));
      setEditingId(null);
    } catch (e) {}
  };
  const handleShare = shareId => {
    const url = window.location.origin + "/sim/" + shareId;
    navigator.clipboard.writeText(url).then(() => alert("Share link copied!"));
  };
  if (loading) return /*#__PURE__*/React.createElement("div", {
    className: "loading"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spinner"
  }), /*#__PURE__*/React.createElement("p", null, "Loading your simulations..."));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 22
    }
  }, "My Simulations"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      padding: "8px 16px",
      fontSize: 13
    },
    onClick: onNewSim
  }, "New Simulation"))), sims.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: "center",
      padding: 40
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-dim)",
      marginBottom: 16
    }
  }, "No saved simulations yet."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: onNewSim
  }, "Run Your First Simulation")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: 16
    }
  }, sims.map(sim => /*#__PURE__*/React.createElement("div", {
    key: sim.id,
    className: "card",
    style: {
      padding: 16,
      cursor: "pointer"
    },
    onClick: () => onLoadSim(sim)
  }, editingId === sim.id ? /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "form-input",
    value: editTitle,
    onChange: e => setEditTitle(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") handleRename(sim.id);
      if (e.key === "Escape") setEditingId(null);
    },
    autoFocus: true,
    style: {
      fontSize: 14,
      padding: "6px 10px",
      marginBottom: 6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      padding: "4px 12px",
      fontSize: 12
    },
    onClick: () => handleRename(sim.id)
  }, "Save"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "4px 12px",
      fontSize: 12
    },
    onClick: () => setEditingId(null)
  }, "Cancel"))) : /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      marginBottom: 6
    }
  }, sim.title || "Untitled"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-dim)",
      marginBottom: 12
    }
  }, new Date(sim.created_at).toLocaleDateString()), sim.results_summary && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 4,
      marginBottom: 12
    }
  }, (sim.results_summary.paths || []).map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "badge"
  }, p))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "4px 10px",
      fontSize: 11
    },
    onClick: () => {
      setEditingId(sim.id);
      setEditTitle(sim.title || "");
    }
  }, "Rename"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "4px 10px",
      fontSize: 11
    },
    onClick: () => handleShare(sim.share_id)
  }, "Share"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "4px 10px",
      fontSize: 11,
      color: "var(--danger)"
    },
    onClick: () => handleDelete(sim.id)
  }, "Delete"))))));
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
      fetch("/api/sim/" + simMatch[1]).then(r => r.json()).then(data => {
        if (data.quiz_state) {
          setQuizData(data.quiz_state);
          setPage("results");
        }
      }).catch(() => {});
      return;
    }

    // Legacy base64 share link: ?sim=...
    const simParam = params.get("sim");
    if (simParam) {
      try {
        const decoded = JSON.parse(atob(simParam));
        setQuizData(decoded);
        setPage("results");
      } catch (e) {
        console.error("Failed to decode shared simulation:", e);
      }
    }
  }, []);
  const handleLogin = u => {
    setUser(u);
    setAuthPage(null);
  };
  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setPage("quiz");
    setQuizData(null);
  };
  const handleQuizComplete = quiz => {
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
  const handleSave = async results => {
    if (!user) {
      setAuthPage("login");
      return;
    }
    setSaveStatus("saving");
    try {
      // Build a summary for dashboard cards
      const summary = {
        paths: results.map(r => r.label),
        net_worths: results.map(r => {
          const last = r.snapshots[r.snapshots.length - 1];
          return last ? last.net_worth : 0;
        })
      };
      const title = results.map(r => r.label).join(" vs ");
      await apiCall("/api/simulations/save", {
        method: "POST",
        body: JSON.stringify({
          quiz_state: quizData,
          title,
          results_summary: summary
        })
      });
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("error");
    }
  };
  const handleLoadSim = sim => {
    setQuizData(sim.quiz_state);
    setPage("results");
    setSaveStatus(null);
    window.scrollTo(0, 0);
  };

  // Auth pages overlay
  if (authPage === "login") {
    return /*#__PURE__*/React.createElement("div", {
      className: "app"
    }, /*#__PURE__*/React.createElement("div", {
      className: "header",
      style: {
        cursor: "pointer"
      },
      onClick: () => setAuthPage(null)
    }, /*#__PURE__*/React.createElement("h1", null, "Horizon18"), /*#__PURE__*/React.createElement("p", null, "Compare paths. Project outcomes. Decide with data.")), /*#__PURE__*/React.createElement(LoginPage, {
      onLogin: handleLogin,
      onSwitch: () => setAuthPage("register"),
      onGuest: () => setAuthPage(null)
    }));
  }
  if (authPage === "register") {
    return /*#__PURE__*/React.createElement("div", {
      className: "app"
    }, /*#__PURE__*/React.createElement("div", {
      className: "header",
      style: {
        cursor: "pointer"
      },
      onClick: () => setAuthPage(null)
    }, /*#__PURE__*/React.createElement("h1", null, "Horizon18"), /*#__PURE__*/React.createElement("p", null, "Compare paths. Project outcomes. Decide with data.")), /*#__PURE__*/React.createElement(RegisterPage, {
      onRegister: handleLogin,
      onSwitch: () => setAuthPage("login"),
      onGuest: () => setAuthPage(null)
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement("div", {
    className: "header",
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      right: 0,
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, user ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "6px 12px",
      fontSize: 12
    },
    onClick: () => {
      setPage("dashboard");
      window.scrollTo(0, 0);
    }
  }, "Dashboard"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, user.display_name || user.email), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "6px 12px",
      fontSize: 12
    },
    onClick: handleLogout
  }, "Sign Out")) : /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "6px 12px",
      fontSize: 12
    },
    onClick: () => setAuthPage("login")
  }, "Sign In")), /*#__PURE__*/React.createElement("h1", {
    style: {
      cursor: "pointer"
    },
    onClick: handleReset
  }, "Horizon18"), /*#__PURE__*/React.createElement("p", null, "Compare paths. Project outcomes. Decide with data.")), page === "quiz" && /*#__PURE__*/React.createElement(QuizPage, {
    onComplete: handleQuizComplete
  }), page === "results" && /*#__PURE__*/React.createElement(ResultsPage, {
    quiz: quizData,
    onReset: handleReset,
    onSave: handleSave,
    saveStatus: saveStatus
  }), page === "dashboard" && /*#__PURE__*/React.createElement(DashboardPage, {
    onLoadSim: handleLoadSim,
    onNewSim: handleReset,
    onLogout: handleLogout
  }));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/*#__PURE__*/React.createElement(App, null));
