# Data Model

All data models are defined in `model/data_models.py`. This is the single source of truth.

## Enums
- **PathType**: college, cc_transfer, trade, workforce, military (canonical, str-based)
- **SchoolType**: public_in_state, public_out_of_state, private
- **Major**: stem, business, healthcare, liberal_arts, education, undecided
- **TradeType**: electrician, plumber, hvac, carpenter
- **WorkforceIndustry**: retail, logistics, food_service, admin, manufacturing
- **Region**: northeast, southeast, midwest, southwest, west_coast

## Quiz Layer
- **QuizAnswers**: selected_paths, region, living_at_home, years_at_home, family_savings + optional path-specific answer blocks
- **CollegeAnswers**, **CommunityCollegeAnswers**, **TradeAnswers**, **WorkforceAnswers**, **MilitaryAnswers**

## Engine Outputs
- **EducationProfile**: path_type, label, years_in_school, annual_tuition[], annual_room_and_board[], total_loan_amount, loan params, GI Bill fields
- **CareerProfile**: label, annual_income[N], starting_salary, growth_rate, tax_rate, tax_exempt_years[]
- **LivingProfile**: annual_expenses[N], region, at_home_years, monthly costs

## Simulation
- **Scenario**: name, path_type, education + career + living profiles, savings_rate, investment_return_rate, start_age, projection_years, instance_id (optional, for multi-instance comparison)
- **YearSnapshot**: year, age, gross_income, net_income, expenses, loan_payment, debt_remaining, savings, investments, net_worth, cumulative_earnings, cumulative_taxes, savings_rate_actual
- **SimResult**: scenario, snapshots[], total_earnings, total_interest, total_cost, year_debt_free, year_positive_nw, net_worth_milestones{}, legacy net_worth_at_25/30/38/50, debt_burden_ratio

## API Format
**POST /api/simulate** accepts JSON with array of quiz scenarios (up to 5 for multi-instance comparison):
```json
{
  "scenarios": [
    {
      "selected_paths": ["college", "trade"],
      "region": "northeast",
      "living_at_home": false,
      "years_at_home": 0,
      "family_savings": 0,
      "college_answers": { "school_type": "public_in_state", "major": "stem" },
      ...
    }
  ]
}
```

**Returns** array of SimResult JSON objects, one per scenario, with color coding and instance identifiers for UI rendering.
