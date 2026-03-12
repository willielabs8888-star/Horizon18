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
  engineering: "Engineering (General)",
  biology: "Biology / Pre-Med",
  environmental_science: "Environmental Science",
  mathematics: "Mathematics / Statistics",
  physics: "Physics",
  chemistry: "Chemistry",
  data_science: "Data Science",
  software_engineering: "Software Engineering",
  electrical_engineering: "Electrical Engineering",
  mechanical_engineering: "Mechanical Engineering",
  civil_engineering: "Civil Engineering",
  nursing: "Nursing",
  kinesiology: "Kinesiology / Exercise Science",
  public_health: "Public Health",
  business_finance: "Business / Finance",
  accounting: "Accounting",
  marketing: "Marketing",
  economics: "Economics",
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
    gi_bill_major: "",
    civilian_industry: "admin"
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
    specific = inst.use_gi_bill ? ` – GI Bill (${fmtEnum(inst.gi_bill_major) || "Undecided"})` : ` – Civilian (${fmtEnum(inst.civilian_industry) || "Admin"})`;
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
    if (!inst.use_gi_bill && !inst.civilian_industry) missing.push({
      field: "civilian_industry",
      label: "Pick a civilian industry"
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
  if (pt === "military") return inst.use_gi_bill ? `GI Bill: ${LABEL_MAP[inst.gi_bill_major] || "Not configured"}` : `Civilian: ${LABEL_MAP[inst.civilian_industry] || "Not configured"}`;
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
      row[id + "_cashflow"] = Math.round(s.net_income - s.living_expenses - s.loan_payment);
      row[id + "_consumer_debt"] = Math.round(s.consumer_debt || 0);
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

const QUIZ_STEPS = ["paths", "details", "location", "salary", "review"];
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
  const [salaryDefaults, setSalaryDefaults] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const salaryFetchedMetro = useRef(null);
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
        if (pt === "military") return inst.use_gi_bill ? !!inst.gi_bill_major : !!inst.civilian_industry;
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
      }, "Estimated annual income from part-time work during school. This income is applied toward tuition and room & board first, reducing the amount you need to borrow. Any remainder is saved at your designated savings rate."), /*#__PURE__*/React.createElement("div", {
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
      }, "Select a major..."), ["computer_science", "software_engineering", "data_science", "engineering", "electrical_engineering", "mechanical_engineering", "civil_engineering", "biology", "environmental_science", "mathematics", "physics", "chemistry", "nursing", "kinesiology", "public_health", "business_finance", "accounting", "marketing", "economics", "psychology", "criminal_justice", "political_science", "communications", "english", "social_work", "education", "art_design", "undecided"].map(m => /*#__PURE__*/React.createElement("option", {
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
      }, "Estimated annual income from part-time work during school. This income is applied toward tuition and room & board first, reducing the amount you need to borrow. Any remainder is saved at your designated savings rate."), /*#__PURE__*/React.createElement("div", {
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
      }, "Select a major..."), ["computer_science", "software_engineering", "data_science", "engineering", "electrical_engineering", "mechanical_engineering", "civil_engineering", "biology", "environmental_science", "mathematics", "physics", "chemistry", "nursing", "kinesiology", "public_health", "business_finance", "accounting", "marketing", "economics", "psychology", "criminal_justice", "political_science", "communications", "english", "social_work", "education", "art_design", "undecided"].map(m => /*#__PURE__*/React.createElement("option", {
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
      }, /*#__PURE__*/React.createElement("label", null, "Will you use the GI Bill for college after serving?"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 12,
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn" + (inst.use_gi_bill ? " btn-primary" : " btn-secondary"),
        onClick: () => updateInstance(inst.instance_id, "use_gi_bill", true),
        style: {
          flex: 1
        }
      }, "Yes"), /*#__PURE__*/React.createElement("button", {
        className: "btn" + (!inst.use_gi_bill ? " btn-primary" : " btn-secondary"),
        onClick: () => updateInstance(inst.instance_id, "use_gi_bill", false),
        style: {
          flex: 1
        }
      }, "No"))), inst.use_gi_bill && /*#__PURE__*/React.createElement("div", {
        className: "form-group" + (showMissing && missingFieldNames.has("gi_bill_major") ? " field-missing" : "")
      }, /*#__PURE__*/React.createElement("label", null, "What will you study after serving?"), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.gi_bill_major,
        onChange: e => updateInstance(inst.instance_id, "gi_bill_major", e.target.value)
      }, /*#__PURE__*/React.createElement("option", {
        value: "",
        disabled: true
      }, "Select a major..."), ["computer_science", "software_engineering", "data_science", "engineering", "electrical_engineering", "mechanical_engineering", "civil_engineering", "biology", "environmental_science", "mathematics", "physics", "chemistry", "nursing", "kinesiology", "public_health", "business_finance", "accounting", "marketing", "economics", "psychology", "criminal_justice", "political_science", "communications", "english", "social_work", "education", "art_design", "undecided"].map(m => /*#__PURE__*/React.createElement("option", {
        key: m,
        value: m
      }, LABEL_MAP[m])))), !inst.use_gi_bill && /*#__PURE__*/React.createElement("div", {
        className: "form-group" + (showMissing && missingFieldNames.has("civilian_industry") ? " field-missing" : "")
      }, /*#__PURE__*/React.createElement("label", null, "What industry will you work in after serving?"), /*#__PURE__*/React.createElement("p", {
        className: "field-hint"
      }, "Veterans receive a 10% hiring premium over standard entry-level wages."), /*#__PURE__*/React.createElement("select", {
        className: "form-select",
        value: inst.civilian_industry,
        onChange: e => updateInstance(inst.instance_id, "civilian_industry", e.target.value)
      }, ["retail", "logistics", "food_service", "admin", "manufacturing", "security", "landscaping", "customer_service", "delivery_driver", "janitorial", "home_health_aide", "childcare"].map(i => /*#__PURE__*/React.createElement("option", {
        key: i,
        value: i
      }, LABEL_MAP[i])))))));
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

  // Step 3: Salary review — fetch defaults via useEffect (not during render)
  useEffect(() => {
    if (step !== 3) return; // Only fetch when on salary step
    if (salaryFetchedMetro.current === shared.metro_area && salaryDefaults) return;
    setSalaryLoading(true);
    fetch(`/api/salary-defaults?metro=${encodeURIComponent(shared.metro_area)}`).then(r => r.json()).then(data => {
      setSalaryDefaults(data);
      salaryFetchedMetro.current = shared.metro_area;
      setInstances(prev => prev.map(inst => {
        const updated = {
          ...inst
        };
        if (inst.path_type === "college" && !inst.starting_salary_override && inst.major) {
          updated._estimated_salary = data.college[inst.major] || null;
        }
        if (inst.path_type === "cc_transfer" && !inst.starting_salary_override && inst.major) {
          updated._estimated_salary = data.cc_transfer[inst.major] || null;
        }
        if (inst.path_type === "trade" && inst.trade_type) {
          if (!inst.journeyman_salary_override) updated._estimated_journeyman = data.trade_journeyman[inst.trade_type] || null;
          if (!inst.apprentice_wages_override) updated._estimated_apprentice = data.trade_apprentice[inst.trade_type] || null;
        }
        if (inst.path_type === "workforce" && inst.industry) {
          if (!inst.known_starting_wage) updated._estimated_wage = data.workforce[inst.industry] || null;
        }
        if (inst.path_type === "military") {
          updated._military_active = data.military_active;
          if (inst.use_gi_bill && inst.gi_bill_major) {
            updated._estimated_salary = data.college[inst.gi_bill_major] || null;
          } else if (inst.civilian_industry) {
            const baseWage = data.workforce[inst.civilian_industry] || 0;
            updated._estimated_wage = Math.round(baseWage * (1 + (data.military_veteran_premium || 0)));
          }
        }
        return updated;
      }));
    }).catch(() => {}).finally(() => setSalaryLoading(false));
  }, [step, shared.metro_area]);
  const renderSalaryStep = () => {
    const sorted = sortInstances(instances);
    const metroLabel = (metros.find(m => m.code === shared.metro_area) || {}).label || "National Average";
    return /*#__PURE__*/React.createElement("div", {
      className: "quiz-step"
    }, /*#__PURE__*/React.createElement("h2", null, "Review estimated salaries"), /*#__PURE__*/React.createElement("p", {
      className: "hint"
    }, "These are estimated starting salaries for ", metroLabel, " based on national data and local cost of living. Adjust any value if you have better information."), salaryLoading && /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: 20,
        color: "var(--text-dim)"
      }
    }, "Loading salary estimates..."), !salaryLoading && sorted.map(inst => {
      const color = instanceColor(inst, instances);
      const pt = inst.path_type;
      return /*#__PURE__*/React.createElement("div", {
        key: inst.instance_id,
        className: "card",
        style: {
          marginBottom: 12,
          borderLeft: `3px solid ${color}`,
          padding: "14px 16px"
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color,
          marginBottom: 8,
          display: "block"
        }
      }, instanceLabel(inst, instances)), (pt === "college" || pt === "cc_transfer") && (() => {
        const majorKey = inst.major;
        const lookup = pt === "college" ? salaryDefaults?.college || {} : salaryDefaults?.cc_transfer || {};
        const estimated = lookup[majorKey] || 0;
        const current = inst.starting_salary_override || estimated;
        const isOverridden = inst.starting_salary_override != null;
        return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          className: "form-group",
          style: {
            marginBottom: 8
          }
        }, /*#__PURE__*/React.createElement("label", {
          style: {
            fontSize: 13
          }
        }, "Estimated starting salary after graduation"), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 8,
            alignItems: "center"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: "relative",
            flex: 1
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
          step: "1000",
          value: current || "",
          placeholder: estimated ? estimated.toLocaleString() : "",
          onChange: e => {
            const val = parseFloat(e.target.value);
            updateInstance(inst.instance_id, "starting_salary_override", val > 0 ? val : null);
          }
        })), isOverridden && /*#__PURE__*/React.createElement("button", {
          className: "btn btn-secondary",
          style: {
            fontSize: 11,
            padding: "4px 8px"
          },
          onClick: () => updateInstance(inst.instance_id, "starting_salary_override", null)
        }, "Reset")), /*#__PURE__*/React.createElement("p", {
          className: "field-hint",
          style: {
            marginTop: 4
          }
        }, "Based on ", (LABEL_MAP[majorKey] || majorKey || "your major").replace("_", " "), " graduates in ", metroLabel, ".", pt === "cc_transfer" && " Includes a 2% discount for community college transfer.", salaryDefaults?.salary_growth?.[majorKey] != null && ` Grows at ${(salaryDefaults.salary_growth[majorKey] * 100).toFixed(1)}%/year above inflation.`)));
      })(), pt === "trade" && (() => {
        const tradeKey = inst.trade_type;
        const estJourneyman = salaryDefaults?.trade_journeyman?.[tradeKey] || 0;
        const estApprentice = salaryDefaults?.trade_apprentice?.[tradeKey] || [0, 0, 0, 0];
        const currentJ = inst.journeyman_salary_override || estJourneyman;
        const currentA = inst.apprentice_wages_override || estApprentice;
        const jOverridden = inst.journeyman_salary_override != null;
        const aOverridden = inst.apprentice_wages_override != null;
        return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          className: "form-group",
          style: {
            marginBottom: 10
          }
        }, /*#__PURE__*/React.createElement("label", {
          style: {
            fontSize: 13
          }
        }, "Journeyman salary (after apprenticeship)"), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 8,
            alignItems: "center"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: "relative",
            flex: 1
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
          step: "1000",
          value: currentJ || "",
          onChange: e => {
            const val = parseFloat(e.target.value);
            updateInstance(inst.instance_id, "journeyman_salary_override", val > 0 ? val : null);
          }
        })), jOverridden && /*#__PURE__*/React.createElement("button", {
          className: "btn btn-secondary",
          style: {
            fontSize: 11,
            padding: "4px 8px"
          },
          onClick: () => updateInstance(inst.instance_id, "journeyman_salary_override", null)
        }, "Reset"))), /*#__PURE__*/React.createElement("div", {
          className: "form-group",
          style: {
            marginBottom: 8
          }
        }, /*#__PURE__*/React.createElement("label", {
          style: {
            fontSize: 13
          }
        }, "Apprentice wages (years 1\u20134)"), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6
          }
        }, [0, 1, 2, 3].map(yr => /*#__PURE__*/React.createElement("div", {
          key: yr,
          style: {
            position: "relative"
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#888",
            fontSize: 11
          }
        }, "Yr ", yr + 1, " $"), /*#__PURE__*/React.createElement("input", {
          type: "number",
          className: "form-select",
          style: {
            paddingLeft: 52,
            fontSize: 13
          },
          min: "0",
          step: "500",
          value: (aOverridden ? currentA[yr] : estApprentice[yr]) || "",
          onChange: e => {
            const val = parseFloat(e.target.value) || 0;
            const newWages = [...(inst.apprentice_wages_override || [...estApprentice])];
            newWages[yr] = val;
            updateInstance(inst.instance_id, "apprentice_wages_override", newWages);
          }
        })))), aOverridden && /*#__PURE__*/React.createElement("button", {
          className: "btn btn-secondary",
          style: {
            fontSize: 11,
            padding: "4px 6px",
            marginTop: 4
          },
          onClick: () => updateInstance(inst.instance_id, "apprentice_wages_override", null)
        }, "Reset apprentice wages"), /*#__PURE__*/React.createElement("p", {
          className: "field-hint",
          style: {
            marginTop: 4
          }
        }, (LABEL_MAP[tradeKey] || tradeKey || "").replace("_", " "), " wages progress from ~40% to ~85% of journeyman pay. After journeyman, grows at 0.5%/year above inflation.")));
      })(), pt === "workforce" && (() => {
        const indKey = inst.industry;
        const estimated = salaryDefaults?.workforce?.[indKey] || 0;
        const current = inst.known_starting_wage || estimated;
        const isOverridden = inst.known_starting_wage != null;
        return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          className: "form-group",
          style: {
            marginBottom: 8
          }
        }, /*#__PURE__*/React.createElement("label", {
          style: {
            fontSize: 13
          }
        }, "Starting annual wage"), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 8,
            alignItems: "center"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: "relative",
            flex: 1
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
          value: current || "",
          onChange: e => {
            const val = parseFloat(e.target.value);
            updateInstance(inst.instance_id, "known_starting_wage", val > 0 ? val : null);
          }
        })), isOverridden && /*#__PURE__*/React.createElement("button", {
          className: "btn btn-secondary",
          style: {
            fontSize: 11,
            padding: "4px 8px"
          },
          onClick: () => updateInstance(inst.instance_id, "known_starting_wage", null)
        }, "Reset")), /*#__PURE__*/React.createElement("p", {
          className: "field-hint",
          style: {
            marginTop: 4
          }
        }, "Based on ", (LABEL_MAP[indKey] || indKey || "").replace("_", " "), " entry-level in ", metroLabel, ". Grows at 0.5%/year above inflation.")));
      })(), pt === "military" && (() => {
        const activeComp = salaryDefaults?.military_active || [];
        return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          className: "form-group",
          style: {
            marginBottom: 10
          }
        }, /*#__PURE__*/React.createElement("label", {
          style: {
            fontSize: 13
          }
        }, "Active duty compensation (federal \u2014 not adjustable)"), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4
          }
        }, activeComp.map((c, i) => /*#__PURE__*/React.createElement("div", {
          key: i,
          style: {
            fontSize: 12,
            color: "var(--text-dim)",
            padding: "4px 8px",
            background: "var(--card-bg)",
            borderRadius: 4
          }
        }, "Year ", i + 1, ": ", fmtFull(c))))), inst.use_gi_bill && inst.gi_bill_major && /*#__PURE__*/React.createElement("div", {
          className: "form-group",
          style: {
            marginBottom: 8
          }
        }, /*#__PURE__*/React.createElement("label", {
          style: {
            fontSize: 13
          }
        }, "Post-degree starting salary (", (LABEL_MAP[inst.gi_bill_major] || inst.gi_bill_major).replace("_", " "), ")"), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 8,
            alignItems: "center"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: "relative",
            flex: 1
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
          step: "1000",
          value: inst.starting_salary_override || salaryDefaults?.college?.[inst.gi_bill_major] || "",
          onChange: e => {
            const val = parseFloat(e.target.value);
            updateInstance(inst.instance_id, "starting_salary_override", val > 0 ? val : null);
          }
        })), inst.starting_salary_override && /*#__PURE__*/React.createElement("button", {
          className: "btn btn-secondary",
          style: {
            fontSize: 11,
            padding: "4px 8px"
          },
          onClick: () => updateInstance(inst.instance_id, "starting_salary_override", null)
        }, "Reset")), /*#__PURE__*/React.createElement("p", {
          className: "field-hint",
          style: {
            marginTop: 4
          }
        }, "Salary after using GI Bill to complete a degree in ", metroLabel, ".")), !inst.use_gi_bill && inst.civilian_industry && /*#__PURE__*/React.createElement("div", {
          className: "form-group",
          style: {
            marginBottom: 8
          }
        }, /*#__PURE__*/React.createElement("label", {
          style: {
            fontSize: 13
          }
        }, "Post-service civilian wage (", (LABEL_MAP[inst.civilian_industry] || inst.civilian_industry).replace("_", " "), ")"), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 8,
            alignItems: "center"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            position: "relative",
            flex: 1
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
          value: inst.known_starting_wage || inst._estimated_wage || "",
          onChange: e => {
            const val = parseFloat(e.target.value);
            updateInstance(inst.instance_id, "known_starting_wage", val > 0 ? val : null);
          }
        })), inst.known_starting_wage && /*#__PURE__*/React.createElement("button", {
          className: "btn btn-secondary",
          style: {
            fontSize: 11,
            padding: "4px 8px"
          },
          onClick: () => updateInstance(inst.instance_id, "known_starting_wage", null)
        }, "Reset")), /*#__PURE__*/React.createElement("p", {
          className: "field-hint",
          style: {
            marginTop: 4
          }
        }, "Includes a 10% veteran hiring premium over standard ", (LABEL_MAP[inst.civilian_industry] || "").replace("_", " "), " wages.")));
      })());
    }));
  };

  // Step 4: Review (sorted by path type)
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
  const stepRenderers = [renderPathStep, renderDetailsStep, renderLocationStep, renderSalaryStep, renderReviewStep];
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
  label: "Student Debt",
  title: "Student Debt Over Time",
  subtitle: "Outstanding student loan balance (paths with no debt are hidden)",
  suffix: null
}, {
  key: "consumer_debt",
  label: "Consumer Debt",
  title: "Consumer Debt Over Time",
  subtitle: "Deficit debt from years when income doesn't cover expenses — accrues ~15.5% annual interest",
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
}, {
  key: "cashflow",
  label: "Cash Flow",
  title: "Annual Cash Flow",
  subtitle: "Net income minus expenses and loan payments — negative means you're borrowing or drawing down savings",
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
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [projYears, setProjYears] = useState(quiz.projection_years || 32);
  const [activeTab, setActiveTab] = useState("nw");
  const sliderTimeout = useRef(null);
  const assumptionTimeout = useRef(null);

  // Advanced Assumptions state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savingsRate, setSavingsRate] = useState(0.10);
  const [investReturn, setInvestReturn] = useState(0.06);
  const [taxRate, setTaxRate] = useState(REGION_TAX_DEFAULTS[quiz.region] || 0.22);
  const [loanRate, setLoanRate] = useState(0.04);
  const [startAge, setStartAge] = useState(18);

  // Refs to always have current slider values (avoids stale closures)
  const savingsRateRef = useRef(savingsRate);
  const investReturnRef = useRef(investReturn);
  const taxRateRef = useRef(taxRate);
  const loanRateRef = useRef(loanRate);
  const startAgeRef = useRef(startAge);
  const projYearsRef = useRef(projYears);
  savingsRateRef.current = savingsRate;
  investReturnRef.current = investReturn;
  taxRateRef.current = taxRate;
  loanRateRef.current = loanRate;
  startAgeRef.current = startAge;
  projYearsRef.current = projYears;

  // Year-by-year breakdown table state
  const [showTable, setShowTable] = useState(false);
  const [tableTab, setTableTab] = useState("");

  // Build color and label maps from quiz instances
  const instances = quiz.path_instances || [];
  const colorMap = buildColorMap(instances);
  const labelMap = buildLabelMap(instances, results);
  const fetchData = useCallback((years, sr, ir, tr, lr, sa) => {
    setLoading(true);
    setError(null);
    const body = {
      ...quiz,
      projection_years: years,
      savings_rate: sr,
      investment_return_rate: ir,
      tax_rate: tr,
      loan_interest_rate: lr,
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
    fetchData(projYears, savingsRate, investReturn, taxRate, loanRate, startAge);
  }, []);
  const handleSlider = e => {
    const y = parseInt(e.target.value);
    setProjYears(y);
    if (sliderTimeout.current) clearTimeout(sliderTimeout.current);
    sliderTimeout.current = setTimeout(() => fetchData(y, savingsRateRef.current, investReturnRef.current, taxRateRef.current, loanRateRef.current, startAgeRef.current), 200);
  };
  const handleAssumptionChange = (setter, value) => {
    setter(value);
    if (assumptionTimeout.current) clearTimeout(assumptionTimeout.current);
    assumptionTimeout.current = setTimeout(() => {
      fetchData(projYearsRef.current, savingsRateRef.current, investReturnRef.current, taxRateRef.current, loanRateRef.current, startAgeRef.current);
    }, 300);
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

  // Filter out zero-debt instances for debt charts
  const filteredResults = activeTab === "debt" ? (() => {
    const debtResults = results.filter(r => r.snapshots.some(s => s.debt_remaining > 0));
    if (debtResults.length === 0) return null;
    return debtResults;
  })() : activeTab === "consumer_debt" ? (() => {
    const cdResults = results.filter(r => r.snapshots.some(s => (s.consumer_debt || 0) > 0));
    if (cdResults.length === 0) return null;
    return cdResults;
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
  }, projYears, "-Year Projection (ages ", startAge, "\u2013", endAge, ")"), onSave && /*#__PURE__*/React.createElement("span", {
    className: "badge",
    style: {
      cursor: "pointer",
      borderColor: "var(--accent)",
      color: "var(--accent)"
    },
    onClick: async () => {
      if (saveStatus === "saved") return;
      // Generate default name: "09 Mar 2026 Sim 01" with auto-increment
      const d = new Date();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dateStr = String(d.getDate()).padStart(2, "0") + " " + months[d.getMonth()] + " " + d.getFullYear();
      let nextNum = 1;
      try {
        const data = await apiCall("/api/simulations");
        const existing = (data.simulations || []).map(s => s.title || "");
        const pattern = new RegExp("^" + dateStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + " Sim (\\d+)$");
        for (const t of existing) {
          const m = t.match(pattern);
          if (m) nextNum = Math.max(nextNum, parseInt(m[1]) + 1);
        }
      } catch (e) {}
      setSaveName(dateStr + " Sim " + String(nextNum).padStart(2, "0"));
      setShowSaveModal(true);
    }
  }, saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Simulation"), /*#__PURE__*/React.createElement("span", {
    className: "badge",
    style: {
      cursor: "pointer",
      borderColor: "var(--danger)",
      color: "var(--danger)"
    },
    onClick: onReset
  }, "Start New Projection")), showSaveModal && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    onClick: () => setShowSaveModal(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      maxWidth: 400,
      width: "90%",
      padding: "24px"
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: 16
    }
  }, "Save Simulation"), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13,
      color: "var(--text-dim)",
      marginBottom: 6,
      display: "block"
    }
  }, "Simulation Name"), /*#__PURE__*/React.createElement("input", {
    className: "form-input",
    value: saveName,
    onChange: e => setSaveName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && saveName.trim()) {
        setShowSaveModal(false);
        onSave(results, saveName.trim());
      }
    },
    autoFocus: true,
    style: {
      width: "100%",
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    style: {
      padding: "8px 16px",
      fontSize: 13
    },
    onClick: () => setShowSaveModal(false)
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    style: {
      padding: "8px 16px",
      fontSize: 13
    },
    disabled: !saveName.trim(),
    onClick: () => {
      setShowSaveModal(false);
      onSave(results, saveName.trim());
    }
  }, "Save")))), /*#__PURE__*/React.createElement("div", {
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
      handleAssumptionChange(setStartAge, v);
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
  }, "Age when the simulation begins (default: 18)")), /*#__PURE__*/React.createElement("div", {
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
    max: 50,
    step: 1,
    value: Math.round(savingsRate * 100),
    onChange: e => {
      const v = parseInt(e.target.value) / 100;
      handleAssumptionChange(setSavingsRate, v);
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
  }, "Percent of after-tax income saved annually. Most people save 5\u201315%.")), /*#__PURE__*/React.createElement("div", {
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
      handleAssumptionChange(setInvestReturn, v);
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
  }, "Default: 6%/year (real, after inflation). Conservative: 4%. Aggressive: 8%.")), /*#__PURE__*/React.createElement("div", {
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
      handleAssumptionChange(setTaxRate, v);
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
  }, "Blended federal + state + payroll tax burden. ", LABEL_MAP[quiz.metro_area] || LABEL_MAP[quiz.region], " region average: ", Math.round((REGION_TAX_DEFAULTS[quiz.region] || 0.22) * 100), "%.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13
    }
  }, "Student Loan Interest Rate"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--accent)"
    }
  }, (loanRate * 100).toFixed(1), "%")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 120,
    step: 5,
    value: Math.round(loanRate * 1000),
    onChange: e => {
      const v = parseInt(e.target.value) / 1000;
      handleAssumptionChange(setLoanRate, v);
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
  }, "Real rate after inflation. Default: 4.0% (nominal ~6.5% minus ~2.5% inflation). Federal loans: 3\u20135%. Private loans: 4\u20138%.")))), /*#__PURE__*/React.createElement("div", {
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
  })), /*#__PURE__*/React.createElement("span", null, "All figures are in ", /*#__PURE__*/React.createElement("strong", null, "today's dollars"), " (adjusted for inflation). A dollar shown at age 40 has the same purchasing power as a dollar today. These projections use simplified assumptions and national averages. Your actual results will vary.")), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chart-tabs"
  }, CHART_TABS.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.key,
    className: "chart-tab" + (activeTab === t.key ? " active" : ""),
    onClick: () => setActiveTab(t.key)
  }, t.label))), /*#__PURE__*/React.createElement("h2", null, tab.title), /*#__PURE__*/React.createElement("p", {
    className: "subtitle"
  }, tab.subtitle), (activeTab === "debt" || activeTab === "consumer_debt") && !filteredResults ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-dim)",
      padding: "40px 0",
      textAlign: "center"
    }
  }, activeTab === "debt" ? "No paths in this comparison carry student debt." : "No paths in this comparison accumulated consumer debt.") : /*#__PURE__*/React.createElement(SimChart, {
    data: chartData,
    results: filteredResults || results,
    dataKeySuffix: activeTab,
    suffix: tab.suffix,
    yDomain: activeTab === "savings" ? [0, "auto"] : undefined,
    colorMap: colorMap,
    labelMap: labelMap,
    savingsRate: savingsRate
  })), (() => {
    const metroLabel = LABEL_MAP[quiz.metro_area] || (quiz.metro_area || "").replace("_", " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "National Average";
    const instances = quiz.path_instances || [];
    return /*#__PURE__*/React.createElement("details", {
      className: "card",
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("summary", {
      style: {
        fontWeight: 600,
        fontSize: 16,
        padding: "4px 0",
        listStyle: "none",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", null, "Simulation Configuration"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: "var(--text-dim)",
        fontWeight: 400
      }
    }, "Click to expand")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        fontSize: 13,
        lineHeight: 1.7
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px 24px",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Location:"), " ", metroLabel), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Living at home:"), " ", quiz.living_at_home ? `Yes (${quiz.years_at_home} year${quiz.years_at_home > 1 ? "s" : ""})` : "No"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Family education savings:"), " ", fmtFull(quiz.family_savings || 0))), /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: "1px solid var(--border-color)",
        paddingTop: 12
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Paths Compared (", instances.length, "):"), instances.map((inst, idx) => {
      const pt = inst.path_type;
      const color = sorted[idx] ? colorMap[sorted[idx].scenario.instance_id || sorted[idx].scenario.path_type] || "var(--text-main)" : "var(--text-main)";
      const matchResult = sorted.find(r => (r.scenario.instance_id || r.scenario.path_type) === inst.instance_id);
      const scenarioName = matchResult ? matchResult.scenario.name : inst.instance_id || pt;
      return /*#__PURE__*/React.createElement("div", {
        key: inst.instance_id || idx,
        style: {
          marginTop: 8,
          paddingLeft: 12,
          borderLeft: `3px solid ${color}`
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontWeight: 600,
          color
        }
      }, scenarioName), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2px 16px",
          color: "var(--text-dim)",
          fontSize: 12
        }
      }, matchResult && /*#__PURE__*/React.createElement("span", null, "Starting salary: ", fmtFull(matchResult.scenario.starting_salary)), (pt === "college" || pt === "cc_transfer" || pt === "trade") && /*#__PURE__*/React.createElement("span", null, "Loan term: ", inst.loan_term_years || 10, " years"), (pt === "college" || pt === "cc_transfer") && /*#__PURE__*/React.createElement("span", null, "Part-time work: ", inst.part_time_work ? `Yes (${fmtFull(inst.part_time_income || 0)}/yr)` : "No"), matchResult && matchResult.summary && /*#__PURE__*/React.createElement("span", null, "Total education cost: ", fmtFull(matchResult.summary.total_cost_of_education))));
    }))));
  })(), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Key Insights"), /*#__PURE__*/React.createElement("p", {
    className: "subtitle"
  }, "What the numbers tell us about your options"), /*#__PURE__*/React.createElement("div", {
    style: {
      lineHeight: 1.8,
      fontSize: 14
    }
  }, sorted.length === 1 && (() => {
    try {
      const r = sorted[0];
      if (!r || !r.snapshots || !r.summary) return /*#__PURE__*/React.createElement("p", null, "No data available.");
      const rid = r.scenario.instance_id || r.scenario.path_type;
      const lastSnap = r.snapshots[r.snapshots.length - 1];
      if (!lastSnap) return /*#__PURE__*/React.createElement("p", null, "No snapshot data available.");
      const finalNW = lastSnap.net_worth;
      const totalEarn = r.summary.total_earnings;
      const debtFree = r.summary.year_debt_free;
      const totalEd = r.summary.total_cost_of_education;
      const posNW = r.summary.year_positive_net_worth;
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 12
        }
      }, "Over ", projYears, " years, ", /*#__PURE__*/React.createElement("strong", {
        style: {
          color: colorMap[rid]
        }
      }, labelMap[rid]), " reaches a projected net worth of ", /*#__PURE__*/React.createElement("strong", null, fmtFull(finalNW)), " with total lifetime earnings of ", /*#__PURE__*/React.createElement("strong", null, fmtFull(totalEarn)), "."), debtFree ? /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("strong", null, "Debt timeline:"), " Student debt is paid off at age ", debtFree, ".", totalEd > 0 ? ` Total education cost: ${fmtFull(totalEd)}.` : "") : null, !debtFree && totalEd === 0 ? /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("strong", null, "No student debt"), " \u2014 all income goes toward living expenses, savings, and investments from day one.") : null, posNW ? /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("strong", null, "Positive net worth"), " reached at age ", posNW, ".") : null, r.summary.debt_burden_ratio > 0 ? /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("strong", null, "Peak debt burden:"), " ", (r.summary.debt_burden_ratio * 100).toFixed(0), "% of take-home pay", r.summary.debt_burden_ratio > 0.15 ? " (high)" : r.summary.debt_burden_ratio > 0.10 ? " (moderate)" : " (manageable)", ".", /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-dim)",
          fontSize: 12
        }
      }, " Under 10% is comfortable; over 15% can be a strain.")) : null, r.summary.loan_extended ? /*#__PURE__*/React.createElement("p", {
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
      }, "Loan repayment adjusted:"), " ", (() => {
        const lastS = r.snapshots[r.snapshots.length - 1];
        if (lastS && lastS.debt_remaining > 0) {
          return `Selected ${r.summary.loan_term_original}-year repayment, but income never exceeds expenses enough to pay off the loan within the projection window.`;
        }
        return `Selected ${r.summary.loan_term_original}-year repayment, but income-based payments extend it to ~${r.summary.loan_term_actual} years.`;
      })()) : null, /*#__PURE__*/React.createElement("p", {
        style: {
          color: "var(--text-dim)",
          fontStyle: "italic",
          marginTop: 16
        }
      }, "Add more paths to compare \u2014 the real power of this tool is seeing how different choices stack up side by side."));
    } catch (err) {
      console.error("Key Insights single-path error:", err);
      return /*#__PURE__*/React.createElement("p", {
        style: {
          color: "var(--text-dim)"
        }
      }, "Unable to generate insights for this path.");
    }
  })(), sorted.length >= 2 && (() => {
    const byNW = [...sorted].sort((a, b) => b.snapshots[b.snapshots.length - 1].net_worth - a.snapshots[a.snapshots.length - 1].net_worth);
    const best = byNW[0],
      worst = byNW[byNW.length - 1];
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
    }, labelMap[worstId]), " (", fmtFull(worstNW), ")."), (() => {
      const debtPaths = sorted.filter(r => r.summary.year_debt_free || r.summary.debt_burden_ratio > 0 || r.summary.total_cost_of_education > 0);
      if (debtPaths.length === 0) return null;
      return /*#__PURE__*/React.createElement("div", {
        style: {
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          display: "block",
          marginBottom: 6
        }
      }, "Debt Overview"), /*#__PURE__*/React.createElement("table", {
        style: {
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13
        }
      }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
        style: {
          borderBottom: "2px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("th", {
        style: {
          textAlign: "left",
          padding: "6px 8px"
        }
      }, "Path"), /*#__PURE__*/React.createElement("th", {
        style: {
          textAlign: "left",
          padding: "6px 8px"
        }
      }, "Education Cost"), /*#__PURE__*/React.createElement("th", {
        style: {
          textAlign: "left",
          padding: "6px 8px"
        }
      }, "Debt-Free Age"), /*#__PURE__*/React.createElement("th", {
        style: {
          textAlign: "left",
          padding: "6px 8px"
        }
      }, "Peak Debt Burden"))), /*#__PURE__*/React.createElement("tbody", null, sorted.map(r => {
        const rid = r.scenario.instance_id || r.scenario.path_type;
        const edCost = r.summary.total_cost_of_education || 0;
        const debtFreeAge = r.summary.year_debt_free;
        const burden = r.summary.debt_burden_ratio || 0;
        const burdenPct = (burden * 100).toFixed(0);
        const level = burden > 0.15 ? "high" : burden > 0.10 ? "moderate" : "manageable";
        return /*#__PURE__*/React.createElement("tr", {
          key: rid,
          style: {
            borderBottom: "1px solid var(--border)"
          }
        }, /*#__PURE__*/React.createElement("td", {
          style: {
            padding: "6px 8px",
            color: colorMap[rid],
            fontWeight: 600
          }
        }, labelMap[rid]), /*#__PURE__*/React.createElement("td", {
          style: {
            padding: "6px 8px"
          }
        }, edCost > 0 ? fmtFull(edCost) : "None"), /*#__PURE__*/React.createElement("td", {
          style: {
            padding: "6px 8px"
          }
        }, debtFreeAge ? `Age ${debtFreeAge}` : edCost > 0 ? "Not within projection" : "No debt"), /*#__PURE__*/React.createElement("td", {
          style: {
            padding: "6px 8px"
          }
        }, burden > 0 ? `${burdenPct}% (${level})` : "—"));
      }))), /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-dim)",
          fontSize: 11,
          display: "block",
          marginTop: 4
        }
      }, "Peak debt burden = peak annual loan payment as % of take-home pay. Under 10% is comfortable; over 15% can be a strain."));
    })(), sorted.filter(r => r.summary.loan_extended).length > 0 && /*#__PURE__*/React.createElement("p", {
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
      const lastSnap = r.snapshots[r.snapshots.length - 1];
      const neverPaidOff = lastSnap && lastSnap.debt_remaining > 0;
      if (neverPaidOff) {
        return `${labelMap[rid]}: selected ${orig}-year repayment, but income never exceeds expenses enough to pay off the loan within the projection window`;
      }
      return `${labelMap[rid]}: selected ${orig}-year repayment, but income-based payments extend it to ~${actual} years`;
    }).join("; "), ".", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-dim)"
      }
    }, "Loan payments are capped at what you can afford after living expenses. The remaining balance continues accruing interest.")), sorted.filter(r => r.summary.investments_used_for_debt > 0).length > 0 && /*#__PURE__*/React.createElement("p", {
      style: {
        marginBottom: 12,
        padding: "10px 14px",
        background: "rgba(59,130,246,0.08)",
        border: "1px solid rgba(59,130,246,0.25)",
        borderRadius: 8,
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "#3b82f6"
      }
    }, "Investments redirected to debt:"), " ", sorted.filter(r => r.summary.investments_used_for_debt > 0).map(r => {
      const rid = r.scenario.instance_id || r.scenario.path_type;
      return `${labelMap[rid]}: ${fmtFull(r.summary.investments_used_for_debt)} used`;
    }).join("; "), ".", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-dim)"
      }
    }, "Because the loan balance was growing faster than income could repay it, the model used available investments to reduce the loan principal. This is a rational financial decision \u2014 paying down high-interest debt instead of holding lower-return investments.")), (() => {
      const negCashflow = sorted.filter(r => r.snapshots.some(s => s.net_income - s.living_expenses - s.loan_payment < 0));
      if (negCashflow.length === 0) return null;
      return /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 12,
          padding: "10px 14px",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 8,
          fontSize: 13
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "#ef4444"
        }
      }, "Negative cashflow detected:"), " ", negCashflow.map(r => {
        const rid = r.scenario.instance_id || r.scenario.path_type;
        const deficitYears = r.snapshots.filter(s => s.net_income - s.living_expenses - s.loan_payment < 0).length;
        return `${labelMap[rid]} (${deficitYears} year${deficitYears > 1 ? "s" : ""})`;
      }).join("; "), ".", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-dim)"
        }
      }, "Income does not cover living expenses during these years. The model draws down investments first, then accumulates consumer debt (~15.5% interest) to cover the gap."));
    })(), /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--text-dim)",
        fontStyle: "italic",
        marginTop: 16
      }
    }, "Try adjusting the timeline slider above \u2014 shorter horizons (10-15 years) tend to favor paths with no debt, while longer horizons (30+ years) show the compounding advantage of higher salaries."));
  })())), (() => {
    const effectiveTab = tableTab || results[0]?.scenario.instance_id || results[0]?.scenario.path_type || "";
    const activeResult = results.find(r => (r.scenario.instance_id || r.scenario.path_type) === effectiveTab);

    // Build a path-specific reading guide using actual scenario data
    const buildGuide = result => {
      if (!result) return null;
      const pt = result.scenario.path_type;
      const snaps = result.snapshots;
      const startSal = result.scenario.starting_salary || 0;
      const fmtK = v => v >= 1000 ? "$" + (v / 1000).toFixed(0) + "k" : "$" + Math.round(v);
      const fmtD = v => "$" + Math.round(v).toLocaleString();
      const schoolYrs = result.scenario.years_in_school || 0;
      const startAge = result.scenario.start_age || 18;
      if (pt === "college") {
        const ptIncome = snaps[0]?.gross_income || 0;
        const graceSal = snaps[schoolYrs]?.gross_income || 0;
        const fullSal = snaps[schoolYrs + 1]?.gross_income || startSal;
        const peakDebt = Math.max(...snaps.map(s => s.debt_remaining));
        return {
          phases: [{
            label: `Ages ${startAge}–${startAge + schoolYrs - 1} · School`,
            desc: ptIncome > 0 ? `Full-time student. Part-time income (${fmtK(ptIncome)}/yr) goes toward tuition + room & board first, reducing loans. 529 savings cover remaining costs.` : `Full-time student. No part-time work. Tuition + room & board paid from 529 savings, remainder becomes student loans.`
          }, {
            label: `Age ${startAge + schoolYrs} · Grace Period`,
            desc: `Job search phase. You earn roughly half your starting salary (${fmtK(graceSal)}). Loan interest still accrues but no payments yet.`
          }, {
            label: `Age ${startAge + schoolYrs + 1}+ · Career`,
            desc: `Full-time career begins at ${fmtD(fullSal)}/yr. Salary grows annually. Loan payments start, and you begin saving and investing.`
          }],
          tip: peakDebt > 0 ? `Peak student debt reaches ${fmtD(peakDebt)} — watch for when it drops to $0 in the table.` : `No student loans needed — 529 savings and part-time income covered all costs.`
        };
      }
      if (pt === "cc_transfer") {
        const ptIncome = snaps[0]?.gross_income || 0;
        const fullSal = snaps[schoolYrs + 1]?.gross_income || startSal;
        const peakDebt = Math.max(...snaps.map(s => s.debt_remaining));
        return {
          phases: [{
            label: `Ages ${startAge}–${startAge + 1} · Community College`,
            desc: `Lower tuition years.${ptIncome > 0 ? ` Part-time income (${fmtK(ptIncome)}/yr) offsets costs.` : ""} This is where you save the most vs. 4-year college.`
          }, {
            label: `Ages ${startAge + 2}–${startAge + 3} · University`,
            desc: `Transfer to 4-year school at higher tuition. Part-time income continues to help offset costs.`
          }, {
            label: `Age ${startAge + schoolYrs}+ · Career`,
            desc: `Starting salary is ~2% lower than direct 4-year grads (${fmtD(fullSal)}/yr). Less debt usually offsets the small salary gap.`
          }],
          tip: peakDebt > 0 ? `Peak debt: ${fmtD(peakDebt)} — typically lower than straight 4-year college.` : `No student loans needed.`
        };
      }
      if (pt === "trade") {
        const yr1Income = snaps[0]?.gross_income || 0;
        const yr4Income = snaps[Math.min(3, snaps.length - 1)]?.gross_income || 0;
        const journeymanIncome = snaps[Math.min(4, snaps.length - 1)]?.gross_income || startSal;
        const peakDebt = Math.max(...snaps.map(s => s.debt_remaining));
        return {
          phases: [{
            label: `Age ${startAge} · Apprentice Year 1`,
            desc: `Start earning immediately at ${fmtK(yr1Income)}/yr while learning. Trade school costs are low (one-time, not per year).`
          }, {
            label: `Ages ${startAge + 1}–${startAge + 3} · Apprentice Years 2–4`,
            desc: `Wages increase each year as skills grow. By year 4 you earn ${fmtK(yr4Income)}/yr — roughly 85% of journeyman pay.`
          }, {
            label: `Age ${startAge + 4}+ · Journeyman`,
            desc: `Full journeyman salary kicks in at ${fmtD(journeymanIncome)}/yr. No grace period — you were already working.`
          }],
          tip: peakDebt > 0 ? `Small loan of ${fmtD(peakDebt)} for trade school — typically paid off within 2–3 years.` : `No loans needed — family savings covered trade school.`
        };
      }
      if (pt === "workforce") {
        const startIncome = snaps[0]?.gross_income || 0;
        const yr10Income = snaps[Math.min(9, snaps.length - 1)]?.gross_income || 0;
        return {
          phases: [{
            label: `Age ${startAge} · Day 1`,
            desc: `Start earning full-time immediately at ${fmtD(startIncome)}/yr. No tuition, no loans, no waiting.`
          }, {
            label: `Every year after`,
            desc: `Salary grows ~0.5% per year (above inflation). By age ${startAge + 10}, you earn ${fmtD(yr10Income)}/yr. Growth is slower than degree paths, but you have a 4-year head start.`
          }],
          tip: `No debt at any point. Your investments compound from day one — that head start matters.`
        };
      }
      if (pt === "military") {
        const yr1Income = snaps[0]?.gross_income || 0;
        const serviceYrs = schoolYrs;
        const isGiBill = (result.scenario.gi_bill_tuition_covered_annual || 0) > 0 || (result.scenario.gi_bill_housing_monthly || 0) > 0;
        if (isGiBill) {
          const giBillIncome = snaps[Math.min(serviceYrs, snaps.length - 1)]?.gross_income || 0;
          const postDegreeIncome = snaps[Math.min(serviceYrs + 4, snaps.length - 1)]?.gross_income || startSal;
          return {
            phases: [{
              label: `Ages ${startAge}–${startAge + serviceYrs - 1} · Active Duty`,
              desc: `Military pay starts at ${fmtK(yr1Income)}/yr (base + housing allowance). Most living expenses covered — save aggressively.`
            }, {
              label: `Ages ${startAge + serviceYrs}–${startAge + serviceYrs + 3} · GI Bill School`,
              desc: `Free tuition + tax-free housing allowance of ${fmtK(giBillIncome)}/yr. No student loans.`
            }, {
              label: `Age ${startAge + serviceYrs + 4}+ · Career`,
              desc: `Post-degree career at ${fmtD(postDegreeIncome)}/yr. Same salary as civilian grads in your major.`
            }],
            tip: `$0 student debt. The GI Bill housing income shown is tax-exempt — your take-home equals your gross during those years.`
          };
        } else {
          const civIncome = snaps[Math.min(serviceYrs, snaps.length - 1)]?.gross_income || startSal;
          return {
            phases: [{
              label: `Ages ${startAge}–${startAge + serviceYrs - 1} · Active Duty`,
              desc: `Military pay starts at ${fmtK(yr1Income)}/yr. Most living expenses covered.`
            }, {
              label: `Age ${startAge + serviceYrs}+ · Civilian Career`,
              desc: `Enter workforce with 10% veteran hiring premium. Starting at ${fmtD(civIncome)}/yr in your chosen industry.`
            }],
            tip: `No school costs, no debt. Your military savings give you a strong investment head start.`
          };
        }
      }
      return null;
    };
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
        padding: "12px 20px",
        borderBottom: "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        fontSize: 12,
        color: "var(--text-dim)",
        marginRight: 8
      }
    }, "Select path:"), /*#__PURE__*/React.createElement("select", {
      value: effectiveTab,
      onChange: e => setTableTab(e.target.value),
      className: "form-input",
      style: {
        fontSize: 13,
        padding: "6px 12px",
        minWidth: 200,
        maxWidth: "100%"
      }
    }, results.map(r => {
      const id = r.scenario.instance_id || r.scenario.path_type;
      return /*#__PURE__*/React.createElement("option", {
        key: id,
        value: id
      }, labelMap[id] || id);
    }))), activeResult && (() => {
      const guide = buildGuide(activeResult);
      if (!guide) return null;
      return /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "14px 20px",
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 10,
          color: "var(--text)"
        }
      }, "How to read this table"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 8
        }
      }, guide.phases.map((p, i) => /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          fontSize: 12,
          lineHeight: 1.5
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 600,
          color: "var(--accent)"
        }
      }, p.label, ":"), " ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-dim)"
        }
      }, p.desc)))), guide.tip && /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 10,
          fontSize: 12,
          color: "var(--text-dim)",
          fontStyle: "italic",
          borderLeft: "3px solid var(--accent)",
          paddingLeft: 10
        }
      }, guide.tip));
    })(), activeResult && /*#__PURE__*/React.createElement("div", {
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
    }, ["Year", "Age", "Gross Income", "Net Income", "Expenses", "Loan Pmt", "Student Debt", "Consumer Debt", "Savings", "Investments", "Net Worth"].map(h => /*#__PURE__*/React.createElement("th", {
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
        color: (s.consumer_debt || 0) > 0 ? "#fb923c" : "var(--text-dim)"
      }
    }, fmtFull(s.consumer_debt || 0)), /*#__PURE__*/React.createElement("td", {
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
    }, fmtFull(s.net_worth)))))), activeResult && (() => {
      const pt = activeResult.scenario.path_type;
      const incomeExplain = pt === "college" ? "Starting salary is based on median earnings for your chosen major and region (e.g., a CS grad in the Northeast earns more than in the Midwest). Salary grows each year at a major-specific rate above inflation. During school, income reflects part-time work (if enabled). The first year after graduation is a grace period — you earn roughly half a year's salary while job searching." : pt === "cc_transfer" ? "Same salary data as 4-year college, but CC transfer grads start ~2% lower to reflect employer preferences. During community college and university years, income reflects part-time work (if enabled). Grace period applies after graduation." : pt === "trade" ? "Apprentice wages start at ~40% of journeyman pay and increase each year (55%, 70%, 85%). Journeyman salary is based on your trade and region — for example, electricians earn differently in the Southeast vs. Northeast. You earn from day one with no grace period." : pt === "workforce" ? "Starting wage is based on your chosen industry and region (e.g., manufacturing in the Midwest vs. retail nationally). Wages grow ~0.5% per year above inflation — slower than degree paths, but you start earning immediately with no school costs." : pt === "military" ? "Active duty pay is based on E-1 through E-4 base pay plus Basic Allowance for Housing (BAH). Pay is nationally standardized. If using the GI Bill, post-service income matches civilian college grads in your major. Without the GI Bill, post-service pay uses your chosen industry wage plus a 10% veteran hiring premium." : "";
      return /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "14px 20px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg)",
          fontSize: 12,
          color: "var(--text-dim)",
          lineHeight: 1.7
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 8,
          fontSize: 13
        }
      }, "How these numbers are calculated"), /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text)"
        }
      }, "Income:"), " ", incomeExplain), /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text)"
        }
      }, "Net income:"), " Gross pay minus an estimated tax rate (~22%), giving your take-home pay."), /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text)"
        }
      }, "Living expenses:"), " Based on your region's cost of living. Reduced by half during the grace period year (you graduate mid-year)."), /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text)"
        }
      }, "Savings:"), " Your savings target is your savings rate (e.g. 25%) applied to your take-home pay. If there isn't enough left after expenses and loan payments, you save what you can \u2014 so your actual savings rate may be lower than the target. During school, part-time income goes toward tuition first."), /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text)"
        }
      }, "Investments:"), " Last year's balance grows at 6% (real return above inflation), plus this year's new savings."), /*#__PURE__*/React.createElement("p", {
        style: {
          marginBottom: 0
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          color: "var(--text)"
        }
      }, "Net worth:"), " Investment balance minus all remaining debt (student loans + any consumer debt)."));
    })())));
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
  }, /*#__PURE__*/React.createElement("button", {
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
  }, "Horizon18 \u2014 For educational purposes only. This tool does not provide financial advice.", /*#__PURE__*/React.createElement("br", null), "All figures are in today's dollars (inflation-adjusted). A dollar shown at any age has the same purchasing power as a dollar today.", /*#__PURE__*/React.createElement("br", null), "Projections use simplified assumptions and generalized data sources (BLS, College Scorecard, NACE, DFAS).", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("a", {
    href: "mailto:willielabs8888@gmail.com?subject=Horizon18 Feedback",
    style: {
      color: "var(--accent)",
      textDecoration: "none",
      fontSize: 13,
      marginTop: 8,
      display: "inline-block"
    }
  }, "Contact Us")));
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
  }, /*#__PURE__*/React.createElement("strong", null, "Years 1\u20134 (ages 18\u201321):"), " Full-time student. You pay tuition + room & board each year. Optional part-time work (default: ~$8,000/year if enabled). Part-time income is applied toward school costs first, reducing the amount you need to borrow. Any remaining income after school costs are covered is saved at your designated savings rate."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Year 5 (age 22):"), " Grace period \u2014 6 months after graduation before loan payments begin. You start job searching; we count half a year of salary."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Year 6+ (age 23+):"), " Full-time career. Salary grows each year based on your major. You pay off loans, save, and invest.")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Education cost:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Total Cost = (Annual Tuition \xD7 4 years) + (Room & Board \xD7 4 years)", /*#__PURE__*/React.createElement("br", null), "Each year: Net School Cost = Year Cost \u2212 Part-Time Income (after tax)", /*#__PURE__*/React.createElement("br", null), "Then: 529 savings cover what they can, and the remainder becomes student loans.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (Public In-State, off-campus, $8k part-time):", /*#__PURE__*/React.createElement("br", null), "Year cost = $11,371 + $9,600 = $20,971", /*#__PURE__*/React.createElement("br", null), "Part-time after tax = $8,000 \xD7 0.82 = $6,560", /*#__PURE__*/React.createElement("br", null), "Net cost = $20,971 \u2212 $6,560 = $14,411 (covered by 529/loans)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Family savings (529) are applied to remaining costs first. Any excess becomes your starting investment."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Income after graduation:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Salary in Year N = Starting Salary \xD7 (1 + Growth Rate)^(years working)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (STEM major):", /*#__PURE__*/React.createElement("br", null), "Year 1 salary = $80,000", /*#__PURE__*/React.createElement("br", null), "Year 5 salary = $80,000 \xD7 1.02^4 = $86,595", /*#__PURE__*/React.createElement("br", null), "Real growth rate varies by major: CS 2%, Engineering 1.5%, Business 1%, most others 0.5%"), /*#__PURE__*/React.createElement("div", {
    className: "hiw-note"
  }, "Source: NACE salary survey, BLS Occupational Outlook. Tuition: College Board 2025-26.")), /*#__PURE__*/React.createElement(HiwDropdown, {
    icon: "\uD83D\uDD04",
    title: "Community College + Transfer",
    badge: "2 + 2 years"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "What this path looks like:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Years 1\u20132 (ages 18\u201319):"), " Community college at much lower tuition. Same room & board costs. Optional part-time work (default: ~$10,000/year if enabled). Part-time income goes toward school costs first, then savings."), /*#__PURE__*/React.createElement("div", {
    className: "hiw-timeline-step"
  }, /*#__PURE__*/React.createElement("strong", null, "Years 3\u20134 (ages 20\u201321):"), " Transfer to a 4-year university. Pay university tuition for the final 2 years. Part-time income continues to offset costs."), /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement("strong", null, "Year 5+ (age 22+):"), " Become a licensed journeyman earning full salary. Growth is steady at about 0.5% per year in real terms (above inflation).")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Apprentice wage progression (Electrician example):")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Year 1: $35,000 (about 52% of journeyman pay)", /*#__PURE__*/React.createElement("br", null), "Year 2: $42,000 (62%)", /*#__PURE__*/React.createElement("br", null), "Year 3: $49,000 (72%)", /*#__PURE__*/React.createElement("br", null), "Year 4: $56,000 (83%)", /*#__PURE__*/React.createElement("br", null), "Year 5+: $67,810 \xD7 (1.005)^years as journeyman"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Education cost:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Trade school total (one-time, not per year):", /*#__PURE__*/React.createElement("br", null), "Electrician: $14,640 | Plumber: $12,500 | HVAC: $12,500", /*#__PURE__*/React.createElement("br", null), "Carpenter: $12,550 | Welder: $15,000 | Automotive Tech: $20,000", /*#__PURE__*/React.createElement("br", null), "Diesel Mechanic: $18,000 | CNC Machinist: $15,000 | Lineworker: $10,000", /*#__PURE__*/React.createElement("br", null), "Ironworker: $12,000 | Elevator Mechanic: $12,000 | Heavy Equipment Op: $10,000", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Journeyman Salaries (Year 5+):", /*#__PURE__*/React.createElement("br", null), "Electrician: $67,810 | Plumber: $64,960 | HVAC: $54,100", /*#__PURE__*/React.createElement("br", null), "Carpenter: $60,083 | Welder: $49,000 | Automotive Tech: $48,000", /*#__PURE__*/React.createElement("br", null), "Diesel Mechanic: $58,000 | CNC Machinist: $49,970 | Lineworker: $82,340", /*#__PURE__*/React.createElement("br", null), "Ironworker: $62,000 | Elevator Mechanic: $99,000 | Heavy Equipment Op: $55,280", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Loan term: 5 years (shorter than college loans)", /*#__PURE__*/React.createElement("br", null), "No grace period \u2014 you're already working"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Why trades often win early:"), " You earn income from age 18 with minimal debt. College grads don't start full-time earning until age 22-23 and carry much larger loans."), /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement("strong", null, "Every year after:"), " Your salary grows at ~0.5% per year in real terms (above inflation). This is slower growth than paths requiring a degree, but you have a head start.")), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Starting wages by industry:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Retail: $32,240 | Logistics: $36,500 | Food Service: $28,245", /*#__PURE__*/React.createElement("br", null), "Admin: $35,419 | Manufacturing: $34,320 | Security: $36,530", /*#__PURE__*/React.createElement("br", null), "Customer Service: $38,200 | Delivery Driver: $38,180", /*#__PURE__*/React.createElement("br", null), "Home Health Aide: $33,530 | Childcare: $28,520", /*#__PURE__*/React.createElement("br", null), "Landscaping: $34,480 | Janitorial: $31,990"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "Income growth:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Salary in Year N = Starting Wage \xD7 (1.005)^N", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (Admin, Midwest):", /*#__PURE__*/React.createElement("br", null), "Start: $35,419 \xD7 0.95 (regional) = $33,648", /*#__PURE__*/React.createElement("br", null), "Age 30: $33,648 \xD7 1.005^12 = $35,712"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "The trade-off:"), " No debt and immediate income, but lower lifetime earnings. Over 30+ years, the salary ceiling is lower than degree-requiring paths."), /*#__PURE__*/React.createElement("div", {
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
  }, "Your take-home pay is your gross salary minus taxes. The model uses a simplified flat tax rate (default 22%) to estimate this. In reality, tax brackets are more complex, but a flat rate gives a reasonable approximation for comparison purposes.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: $60,000 gross salary at 22% tax rate = $46,800 take-home pay"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83C\uDFE6 Student Loan Payments:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Your monthly loan payment is calculated using a standard amortization formula \u2014 the same one banks use for mortgages and auto loans. It spreads your total balance into equal monthly payments over your chosen repayment period (default: 10 years).", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "The model uses a 4% annual interest rate. This is a \"real\" rate, meaning it's already adjusted for inflation. In practice, student loan rates are typically 6\u20137%, but roughly 2\u20133% of that just keeps up with rising prices. By using the real rate, all dollar amounts in the simulation stay in today's purchasing power \u2014 so $50,000 in year 20 means the same as $50,000 today.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: $60,000 loan at 4% for 10 years", /*#__PURE__*/React.createElement("br", null), "Monthly payment \u2248 $607", /*#__PURE__*/React.createElement("br", null), "Total paid over 10 years \u2248 $72,840", /*#__PURE__*/React.createElement("br", null), "Total interest paid \u2248 $12,840"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\u26A0\uFE0F Loan payments are capped at what you can afford:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Loan payments are capped at what you can realistically afford. If the required payment is larger than the money you have left after paying living expenses, the model assumes you only pay what you can that year. The unpaid balance stays on the loan and continues accruing interest, which means it takes longer to pay off.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: Your calculated payment is $953/month ($11,436/year), but after rent, food, and other expenses you only have $8,000 left. You pay the $8,000 and the remaining $3,436 stays on the loan with interest."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\u26A0\uFE0F Interest grows while you're in school:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Your loan balance grows by 4% each year while you're in school, even though you aren't making payments yet. New loans are taken out each year (after part-time income and family savings are applied), and interest compounds on the entire outstanding balance. This means money borrowed in your first year costs more than money borrowed in your last year.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: Borrow $15,000/year for 4 years at 4%", /*#__PURE__*/React.createElement("br", null), "By graduation your balance is ~$63,650 (vs $60,000 borrowed)", /*#__PURE__*/React.createElement("br", null), "That's ~$3,650 in interest before you make a single payment."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCC8 Investment Growth (compound interest):")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Each year, your existing investment balance grows by 6% (above inflation), and then any new savings you make that year are added on top. Over time, this compounding effect is powerful \u2014 your money earns returns, and those returns earn their own returns.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "The 6% rate assumes a balanced portfolio of stocks and bonds, after adjusting for inflation. This is a widely used long-term planning assumption.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example: Save $5,000/year for 30 years at 6%", /*#__PURE__*/React.createElement("br", null), "Total you put in: $150,000", /*#__PURE__*/React.createElement("br", null), "Final balance: ~$395,000 in today's dollars", /*#__PURE__*/React.createElement("br", null), "Compound interest earned you ~$245,000 on top of what you saved!"), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCB5 How much you save each year:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Your savings target is your chosen savings rate (default 10%) applied to your take-home pay. For example, if you earn $40,000 after taxes and your target is 25%, you'd aim to save $10,000 that year.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "But if living expenses, loan payments, and other costs leave you with less than $10,000, you save whatever is actually available. In a tight year where expenses leave only $5,000 free, your realized savings rate drops to 12.5% even though your target is 25%.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "During school years, part-time income goes toward tuition and room & board first. Only the remaining income (if any) can be saved.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "The \"Realized Savings Rate\" chart shows what you actually saved each year versus your target."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCB3 Consumer Debt (deficit spending):")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "If your expenses + loan payments exceed your income, you run a deficit.", /*#__PURE__*/React.createElement("br", null), "The simulation draws down investments first. If investments hit $0,", /*#__PURE__*/React.createElement("br", null), "the remaining deficit becomes consumer debt (think credit cards).", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Consumer debt accrues ~15.5% annual interest (real rate).", /*#__PURE__*/React.createElement("br", null), "During school years, shortfalls go to student loans instead (lower rate).", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("strong", null, "Payoff priority:"), " Consumer debt is paid off first because of its", /*#__PURE__*/React.createElement("br", null), "much higher interest rate (15.5% vs 4% for student loans). All disposable", /*#__PURE__*/React.createElement("br", null), "income goes toward consumer debt before any saving or investing.", /*#__PURE__*/React.createElement("br", null), "Once consumer debt is cleared, normal saving resumes.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "This is tracked separately from student loans \u2014 you can see both", /*#__PURE__*/React.createElement("br", null), "in the Year-by-Year table and the Consumer Debt chart tab."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCCA Net Worth (the bottom line):")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Net Worth = Investment Balance \u2212 Student Debt \u2212 Consumer Debt", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "This is the single number that captures everything:", /*#__PURE__*/React.createElement("br", null), "what you've built up minus what you still owe."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83C\uDF0E Metro-area-based adjustments:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "Salary = Base Salary \xD7 Metro Salary Multiplier", /*#__PURE__*/React.createElement("br", null), "Expenses = Base Expenses \xD7 Metro Cost-of-Living Multiplier", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "We have per-city data for 90+ U.S. metro areas (sourced from BEA Regional Price Parities and BLS wage data). Each metro has its own salary and cost-of-living multiplier relative to the national average (1.00).", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Examples:", /*#__PURE__*/React.createElement("br", null), "New York City:  Salary \xD71.13, Expenses \xD71.17 (high pay, high cost)", /*#__PURE__*/React.createElement("br", null), "Dallas-Fort Worth: Salary \xD71.01, Expenses \xD71.01 (near average)", /*#__PURE__*/React.createElement("br", null), "Atlanta:        Salary \xD70.98, Expenses \xD70.98 (slightly below average)", /*#__PURE__*/React.createElement("br", null), "Seattle:        Salary \xD71.10, Expenses \xD71.14 (tech-driven premium)", /*#__PURE__*/React.createElement("br", null), "Chicago:        Salary \xD71.02, Expenses \xD71.02 (near average)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "If you select \"Other / National Average,\" multipliers are 1.00 (no adjustment)."), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "\uD83C\uDFE0 Living Expenses:")), /*#__PURE__*/React.createElement("div", {
    className: "hiw-formula"
  }, "At home:       $800/month base (before metro multiplier)", /*#__PURE__*/React.createElement("br", null), "Independent: $2,200/month base (rent, food, utilities, etc.)", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("strong", null, "During college:"), " Living expenses are $0 because room & board is already", /*#__PURE__*/React.createElement("br", null), "included in your education costs (and folded into student loans).", /*#__PURE__*/React.createElement("br", null), "After graduation, full independent living expenses kick in.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Expenses stay flat because all figures are in today's dollars (inflation-adjusted).", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (Chicago, independent, post-graduation):", /*#__PURE__*/React.createElement("br", null), "$2,200 \xD7 1.02 = $2,244/month = $26,928/year", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "Example (Atlanta, independent, post-graduation):", /*#__PURE__*/React.createElement("br", null), "$2,200 \xD7 0.98 = $2,156/month = $25,872/year"), /*#__PURE__*/React.createElement("div", {
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
  const pendingSaveRef = useRef(null); // stash save data when user isn't logged in

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
  const handleLogin = async u => {
    setUser(u);
    setAuthPage(null);
    // If there's a pending save from before login, execute it now
    if (pendingSaveRef.current) {
      const {
        results,
        title,
        quizState
      } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      const ok = await executeSave(results, title, quizState);
      if (ok) {
        setPage("dashboard");
        window.scrollTo(0, 0);
      }
    }
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
  const executeSave = async (results, customTitle, quizState) => {
    setSaveStatus("saving");
    try {
      const getLabel = r => r.scenario.name || r.scenario.instance_id || r.scenario.path_type;
      const summary = {
        paths: results.map(r => getLabel(r)),
        net_worths: results.map(r => {
          const last = r.snapshots[r.snapshots.length - 1];
          return last ? last.net_worth : 0;
        })
      };
      const title = customTitle || results.map(r => getLabel(r)).join(" vs ");
      await apiCall("/api/simulations/save", {
        method: "POST",
        body: JSON.stringify({
          quiz_state: quizState || quizData,
          title,
          results_summary: summary
        })
      });
      setSaveStatus("saved");
      return true;
    } catch (e) {
      setSaveStatus("error");
      return false;
    }
  };
  const handleSave = async (results, customTitle) => {
    if (!user) {
      // Stash the save intent, then prompt login
      pendingSaveRef.current = {
        results,
        title: customTitle,
        quizState: quizData
      };
      setAuthPage("login");
      return;
    }
    await executeSave(results, customTitle);
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
      onClick: () => {
        pendingSaveRef.current = null;
        setAuthPage(null);
      }
    }, /*#__PURE__*/React.createElement("h1", null, "Horizon18"), /*#__PURE__*/React.createElement("p", null, "Compare paths. Project outcomes. Decide with data.")), /*#__PURE__*/React.createElement(LoginPage, {
      onLogin: handleLogin,
      onSwitch: () => setAuthPage("register"),
      onGuest: () => {
        pendingSaveRef.current = null;
        setAuthPage(null);
      }
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
