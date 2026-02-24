# Tax Model Assumptions (Phase 3)

Updated: February 24, 2026.

## Income Tax (rUK default model)

- Personal allowance: `£12,570`
- Basic rate: `20%` on first `£37,700` taxable income
- Higher rate: `40%` up to `£125,140`
- Additional rate: `45%` above `£125,140`
- Personal allowance taper over `£100,000`

Reference:
- https://www.gov.uk/income-tax-rates

## National Insurance (employee Class 1)

- Primary threshold: `£12,570`
- Upper earnings limit: `£50,270`
- Main rate: `8%`
- Additional rate: `2%`

Reference:
- https://www.gov.uk/national-insurance-rates-letters

## VAT

- Standard rate: `20%`
- Estimated VAT contribution is modeled from post-income-tax and post-NI disposable income using a configurable `vatable_spend_ratio`.

Reference:
- https://www.gov.uk/vat-rates

## Council Tax

- Regional-average estimator using static defaults by region/nation.
- Defaults are for approximate modeling only and should be replaced by explicit annual local-authority source tables in a later phase.

Reference example:
- https://www.gov.uk/government/statistics/council-tax-levels-set-by-local-authorities-in-england-2025-to-2026

## Deduction Inputs (UI/API)

Supported modeling inputs:
- `pension_salary_sacrifice_gbp`: reduces income for both income tax and employee NI calculations
- `other_pre_tax_deductions_gbp`: reduces income for both income tax and employee NI calculations
- `pension_relief_at_source_gbp`: extends basic-rate band for income tax (no NI effect)
- `gift_aid_gbp`: extends basic-rate band for income tax (no NI effect)

These are simplified approximations and do not cover all HMRC edge cases (for example all allowance interactions, tapered annual allowance behavior, and every relief mechanism detail).
