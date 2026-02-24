# API

FastAPI service for tax estimation and spending attribution endpoints.

## Run

```bash
uv run uvicorn api.main:app --reload
```

## Implemented Endpoints

- `POST /tax/estimate`
- `POST /spending/breakdown`
- `POST /services/impact`
- `POST /regional/flows`
- `POST /journalist/export`
- `GET /public/meta`
- `GET /health`

`POST /tax/estimate`, `POST /spending/breakdown`, and `POST /services/impact` also accept optional deduction inputs:
- `pension_salary_sacrifice_gbp`
- `pension_relief_at_source_gbp`
- `gift_aid_gbp`
- `other_pre_tax_deductions_gbp`

Advanced options:
- `partner_annual_income_gbp`
- `marriage_allowance_transfer`
- `council_tax_band` (`auto` by default, or `A` to `H`)
- `postcode` + `council_name` + `council_tax_annual_override_gbp`
- `uk_nation_for_income_tax` (`england_ni`, `wales`, `scotland`)
- `employment_type` (`employed`, `self_employed`, `mixed`)
- `student_loan_plan` (`none`, `1`, `2`, `4`, `5`, `postgrad`)
- `savings_interest_gbp`, `dividend_income_gbp`
- `policy_overrides` (for policy simulation)
- `compare_tax_year` (`/tax/estimate` historical comparison)
