"""
Data models for Horizon18 — Life-Path Financial Simulator.

All dataclasses used across the system are defined here. This is the single
source of truth for data shapes.

Design notes:
- PathType enum is the CANONICAL set of path identifiers used everywhere.
  Quiz layer, builder, engines, and output all use these same string values.
- Engine output profiles (EducationProfile, CareerProfile, LivingProfile)
  use pre-computed year-by-year arrays so the projection loop stays simple.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


# =============================================================================
# CANONICAL PATH TYPES
# =============================================================================
# Nit #1 fix: Single enum used everywhere. No more "university" vs "college"
# inconsistency. Quiz `selected_paths` uses these values. Builders map to them.

class PathType(str, Enum):
    """Canonical life-path identifiers. Used as keys in quiz, builder, engines,
    and output layers. Inherits from str so JSON serialization works cleanly."""

    COLLEGE = "college"
    CC_TRANSFER = "cc_transfer"
    TRADE = "trade"
    WORKFORCE = "workforce"
    MILITARY = "military"


class SchoolType(str, Enum):
    PUBLIC_IN_STATE = "public_in_state"
    PUBLIC_OUT_OF_STATE = "public_out_of_state"
    PRIVATE = "private"


class Major(str, Enum):
    # STEM cluster
    COMPUTER_SCIENCE = "computer_science"
    ENGINEERING = "engineering"
    BIOLOGY = "biology"
    ENVIRONMENTAL_SCIENCE = "environmental_science"

    # Health cluster
    NURSING = "nursing"
    KINESIOLOGY = "kinesiology"

    # Business cluster
    BUSINESS_FINANCE = "business_finance"
    ACCOUNTING = "accounting"
    MARKETING = "marketing"

    # Social science / humanities cluster
    PSYCHOLOGY = "psychology"
    CRIMINAL_JUSTICE = "criminal_justice"
    POLITICAL_SCIENCE = "political_science"
    COMMUNICATIONS = "communications"
    ENGLISH = "english"
    SOCIAL_WORK = "social_work"

    # Other
    EDUCATION = "education"
    ART_DESIGN = "art_design"
    UNDECIDED = "undecided"

    # Legacy aliases — kept for backward compatibility with saved quizzes
    STEM = "stem"
    BUSINESS = "business"
    HEALTHCARE = "healthcare"
    LIBERAL_ARTS = "liberal_arts"


class TradeType(str, Enum):
    ELECTRICIAN = "electrician"
    PLUMBER = "plumber"
    HVAC = "hvac"
    CARPENTER = "carpenter"
    WELDER = "welder"
    AUTOMOTIVE_TECH = "automotive_tech"
    DIESEL_MECHANIC = "diesel_mechanic"
    CNC_MACHINIST = "cnc_machinist"
    LINEWORKER = "lineworker"
    IRONWORKER = "ironworker"
    ELEVATOR_MECHANIC = "elevator_mechanic"
    HEAVY_EQUIPMENT_OP = "heavy_equipment_op"


class WorkforceIndustry(str, Enum):
    RETAIL = "retail"
    LOGISTICS = "logistics"
    FOOD_SERVICE = "food_service"
    ADMIN = "admin"
    MANUFACTURING = "manufacturing"
    SECURITY = "security"
    LANDSCAPING = "landscaping"
    CUSTOMER_SERVICE = "customer_service"
    DELIVERY_DRIVER = "delivery_driver"
    JANITORIAL = "janitorial"
    HOME_HEALTH_AIDE = "home_health_aide"
    CHILDCARE = "childcare"


class Region(str, Enum):
    NORTHEAST = "northeast"
    SOUTHEAST = "southeast"
    MIDWEST = "midwest"
    SOUTHWEST = "southwest"
    WEST_COAST = "west_coast"


# =============================================================================
# QUIZ ANSWER MODELS
# =============================================================================
# These capture raw student responses. Most fields have sensible defaults.
# Optional path-specific blocks are None when that path isn't selected.

@dataclass
class CollegeAnswers:
    school_type: SchoolType = SchoolType.PUBLIC_IN_STATE
    ipeds_id: str | None = None          # Specific school from database (optional)
    tuition_override: float | None = None  # User-adjusted annual tuition + fees
    room_board_override: float | None = None  # User-adjusted annual room & board
    loan_term_years: int = 10             # Repayment period in years (editable, 5-30)
    major: Major = Major.UNDECIDED
    part_time_work: bool = True
    part_time_income: float = 8_000


@dataclass
class CommunityCollegeAnswers:
    transfer_university_type: SchoolType = SchoolType.PUBLIC_IN_STATE
    ipeds_id_cc: str | None = None       # Specific community college (optional)
    ipeds_id_transfer: str | None = None # Specific transfer university (optional)
    tuition_override_cc: float | None = None  # User-adjusted CC tuition
    tuition_override_transfer: float | None = None  # User-adjusted transfer tuition
    room_board_override: float | None = None  # User-adjusted room & board (transfer yrs)
    loan_term_years: int = 10             # Repayment period in years (editable, 5-30)
    major: Major = Major.UNDECIDED
    part_time_work: bool = True
    part_time_income: float = 10_000


@dataclass
class TradeAnswers:
    trade_type: TradeType = TradeType.ELECTRICIAN
    loan_term_years: int = 5              # Shorter default for smaller trade school loans


@dataclass
class WorkforceAnswers:
    industry: WorkforceIndustry = WorkforceIndustry.RETAIL
    known_starting_wage: float | None = None


@dataclass
class MilitaryAnswers:
    enlistment_years: int = 4
    use_gi_bill: bool = True
    gi_bill_major: Major = Major.UNDECIDED


@dataclass
class QuizAnswers:
    """Complete quiz response. `selected_paths` drives which path-specific
    blocks are populated."""

    selected_paths: list[PathType]
    metro_area: str = "national_avg"      # Metro code (maps to region)
    region: Region = Region.MIDWEST       # Derived from metro_area at API layer
    living_at_home: bool = False
    years_at_home: int = 2
    family_savings: float = 0.0

    college: CollegeAnswers | None = None
    community_college: CommunityCollegeAnswers | None = None
    trade: TradeAnswers | None = None
    workforce: WorkforceAnswers | None = None
    military: MilitaryAnswers | None = None


# =============================================================================
# ENGINE OUTPUT PROFILES
# =============================================================================

@dataclass
class EducationProfile:
    """Output of the Education Cost Engine.

    Fully describes the cost structure of an education/training path.

    Note on `years_in_school`:
      - For college/CC: actual years of academic enrollment.
      - For trade apprenticeship: years in apprenticeship program.
      - For military: years of active duty service (not academic school).
        This field is named generically because the projection engine uses it
        to determine when loan payments start and when the "school phase" ends.
        (Nit #2: see architecture doc — for military, read as "service years".)
      - For workforce: 0.
    """

    path_type: PathType
    label: str
    years_in_school: int
    earns_during_school: bool

    # Per-year cost arrays (length = years_in_school, or empty for workforce)
    annual_tuition: list[float] = field(default_factory=list)
    annual_room_and_board: list[float] = field(default_factory=list)

    # Loan structure
    total_loan_amount: float = 0.0
    loan_interest_rate: float = 0.065
    loan_term_years: int = 15
    grace_period_months: int = 6

    # Excess family savings beyond education cost (seeds investment balance)
    excess_family_savings: float = 0.0

    # GI Bill offset (military with use_gi_bill=True only)
    gi_bill_tuition_covered_annual: float = 0.0
    gi_bill_housing_monthly: float = 0.0


@dataclass
class CareerProfile:
    """Output of the Career Income Engine.

    The `annual_income` array is the master income schedule. The projection
    engine reads from it directly — no phase logic needed downstream.

    `tax_exempt_years` is a list of year indices (0-based) where income is
    fully tax-exempt. This is used for GI Bill housing allowance years, which
    are not subject to federal income tax.
    (Nit #3: projection engine MUST check this list, not just document it.)
    """

    label: str
    annual_income: list[float]          # Pre-computed, length = projection_years
    income_start_age: int               # Age when meaningful income begins
    starting_salary: float              # First full-time post-education salary
    salary_growth_rate: float
    effective_tax_rate: float

    # Year indices where income is tax-exempt (e.g., GI Bill housing years)
    tax_exempt_years: list[int] = field(default_factory=list)


@dataclass
class LivingProfile:
    """Output of the Living Expense Engine."""

    annual_expenses: list[float]        # Pre-computed, length = projection_years
    region: Region
    at_home_years: int
    monthly_at_home: float
    monthly_independent: float


# =============================================================================
# SCENARIO (composed from three engine outputs)
# =============================================================================

@dataclass
class Scenario:
    """A complete scenario ready for projection. Composed from three engine
    outputs plus shared financial parameters."""

    name: str
    path_type: PathType
    education: EducationProfile
    career: CareerProfile
    living: LivingProfile

    # Instance identifier for multi-instance comparison (e.g., "college_0", "trade_1")
    # Empty string for backward compat with single-instance usage.
    instance_id: str = ""

    # Shared financial params (adjustable via sliders on results page)
    savings_rate: float = 0.10
    investment_return_rate: float = 0.07
    start_age: int = 18
    projection_years: int = 32


# =============================================================================
# SIMULATION OUTPUT
# =============================================================================

@dataclass
class YearSnapshot:
    """Financial state for a single year of the simulation."""

    year: int                   # 0-indexed simulation year
    age: int                    # start_age + year
    gross_income: float
    net_income: float           # After tax (respects tax_exempt_years)
    living_expenses: float
    loan_payment: float
    debt_remaining: float
    annual_savings: float
    investment_balance: float
    net_worth: float            # investment_balance - debt_remaining

    # Cumulative tracking (powers web hover tooltips + extra charts)
    cumulative_earnings: float  # Total gross income earned through this year
    cumulative_taxes: float     # Total taxes paid through this year
    savings_rate_actual: float  # Actual savings as % of net income this year

    # Loan feasibility (default = 0 so existing code doesn't break)
    loan_payment_required: float = 0.0  # Pre-cap payment (what amortization demands)


@dataclass
class SimResult:
    """Complete simulation output for one scenario."""

    scenario: Scenario
    snapshots: list[YearSnapshot]

    # Summary metrics
    total_earnings: float               # Total gross earnings over projection horizon
    total_loan_interest_paid: float
    total_cost_of_education: float
    year_debt_free: int | None          # Age when debt hits 0 (None if no debt)
    year_positive_net_worth: int | None # Age when net worth crosses 0

    # Net worth at milestone ages — adaptive to projection horizon.
    # Always includes end-of-horizon. Keys are ages, values are net worth.
    net_worth_milestones: dict[int, float] = field(default_factory=dict)

    # Legacy convenience accessors (kept for backward compat / quick access)
    net_worth_at_25: float = 0.0
    net_worth_at_30: float = 0.0
    net_worth_at_38: float = 0.0
    net_worth_at_50: float = 0.0

    debt_burden_ratio: float = 0.0      # Peak (annual_loan_payment / net_income)

    # Loan feasibility tracking
    loan_extended: bool = False         # True if payments were capped by income
    loan_term_original: int = 0         # User-selected repayment term (years)
    loan_term_actual: int = 0           # Actual years to pay off (may be longer)
