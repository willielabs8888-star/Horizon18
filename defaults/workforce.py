"""
Direct workforce entry-level wage defaults by industry.

Sources:
- Bureau of Labor Statistics (BLS) Occupational Employment and Wage Statistics
- Indeed, Glassdoor, and ZipRecruiter entry-level wage surveys (2025)

These are annual salaries for full-time entry-level positions requiring
no post-secondary education (high school diploma or GED only).
"""

# Annual starting salary by industry sector
ENTRY_WAGES: dict[str, float] = {
    "retail":         32_240,   # Retail sales, customer service
    "logistics":      31_137,   # Warehouse, shipping, receiving
    "food_service":   28_245,   # Restaurant, hospitality (pre-tip base)
    "admin":          35_419,   # Office assistant, receptionist, data entry
    "manufacturing":  34_320,   # Production, assembly, machine operation
}
