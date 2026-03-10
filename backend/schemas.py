"""
Pydantic models for the API layer.

These mirror the dataclasses in model/data_models.py but are Pydantic models
for automatic JSON serialization and request validation.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from enum import Enum


# =============================================================================
# ENUMS (mirror model/data_models.py)
# =============================================================================

class PathType(str, Enum):
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
    STEM = "stem"
    BUSINESS = "business"
    HEALTHCARE = "healthcare"
    LIBERAL_ARTS = "liberal_arts"
    EDUCATION = "education"
    UNDECIDED = "undecided"


class TradeType(str, Enum):
    ELECTRICIAN = "electrician"
    PLUMBER = "plumber"
    HVAC = "hvac"
    CARPENTER = "carpenter"


class TradeEntryPath(str, Enum):
    APPRENTICESHIP = "apprenticeship"
    TRADE_SCHOOL = "trade_school"


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
# REQUEST MODELS (quiz answers)
# =============================================================================

class CollegeAnswersRequest(BaseModel):
    school_type: SchoolType = SchoolType.PUBLIC_IN_STATE
    major: Major = Major.UNDECIDED
    part_time_work: bool = True
    part_time_income: float = 8_000
    starting_salary_override: float | None = None  # User-adjusted starting salary

class CommunityCollegeAnswersRequest(BaseModel):
    transfer_university_type: SchoolType = SchoolType.PUBLIC_IN_STATE
    major: Major = Major.UNDECIDED
    part_time_work: bool = True
    part_time_income: float = 10_000
    starting_salary_override: float | None = None  # User-adjusted starting salary

class TradeAnswersRequest(BaseModel):
    trade_type: TradeType = TradeType.ELECTRICIAN
    entry_path: TradeEntryPath = TradeEntryPath.APPRENTICESHIP
    journeyman_salary_override: float | None = None   # User-adjusted journeyman salary
    apprentice_wages_override: list[float] | None = None  # User-adjusted [yr1, yr2, yr3, yr4]

class WorkforceAnswersRequest(BaseModel):
    industry: WorkforceIndustry = WorkforceIndustry.RETAIL
    known_starting_wage: float | None = None  # User-adjusted starting wage


class MilitaryAnswersRequest(BaseModel):
    enlistment_years: int = 4
    use_gi_bill: bool = True
    gi_bill_major: Major = Major.UNDECIDED
    civilian_industry: WorkforceIndustry = WorkforceIndustry.ADMIN


class SimulateRequest(BaseModel):
    """Top-level request body for POST /api/simulate."""

    selected_paths: list[PathType]
    region: Region = Region.MIDWEST
    living_at_home: bool = True
    years_at_home: int = 2
    family_savings: float = 0.0
    projection_years: int = Field(default=32, ge=10, le=50)

    # Path-specific answers (only needed for selected paths)
    college: CollegeAnswersRequest | None = None
    community_college: CommunityCollegeAnswersRequest | None = None
    trade: TradeAnswersRequest | None = None
    workforce: WorkforceAnswersRequest | None = None
    military: MilitaryAnswersRequest | None = None


# =============================================================================
# RESPONSE MODELS (simulation results)
# =============================================================================

class YearSnapshotResponse(BaseModel):
    year: int
    age: int
    gross_income: float
    net_income: float
    living_expenses: float
    loan_payment: float
    debt_remaining: float
    annual_savings: float
    investment_balance: float
    net_worth: float
    cumulative_earnings: float
    cumulative_taxes: float
    savings_rate_actual: float


class ScenarioResponse(BaseModel):
    name: str
    path_type: str
    savings_rate: float
    investment_return_rate: float
    start_age: int
    projection_years: int


class SimResultResponse(BaseModel):
    scenario: ScenarioResponse
    snapshots: list[YearSnapshotResponse]

    # Summary metrics
    total_earnings: float
    total_loan_interest_paid: float
    total_cost_of_education: float
    year_debt_free: int | None
    year_positive_net_worth: int | None
    net_worth_milestones: dict[int, float]
    net_worth_at_25: float
    net_worth_at_30: float
    net_worth_at_38: float
    net_worth_at_50: float
    debt_burden_ratio: float


class SimulateResponse(BaseModel):
    """Top-level response for POST /api/simulate."""
    results: list[SimResultResponse]
    projection_years: int
    paths_compared: int
