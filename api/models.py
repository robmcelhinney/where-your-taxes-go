from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PolicyOverrides(BaseModel):
    personal_allowance: float | None = Field(default=None, ge=0.0, le=25000.0)
    basic_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    higher_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    additional_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    ni_main_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    ni_upper_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    vat_rate: float | None = Field(default=None, ge=0.0, le=1.0)


class TaxYearComparison(BaseModel):
    compare_tax_year: str
    total_estimated_tax_gbp: float
    delta_vs_selected_gbp: float
    delta_vs_selected_percent: float


class TaxEstimateRequest(BaseModel):
    annual_income_gbp: float = Field(gt=0)
    region: str = Field(default="England")
    tax_year: Literal["2023-24", "2024-25", "2025-26"] = "2025-26"
    vatable_spend_ratio: float = Field(default=0.6, ge=0.0, le=1.0)
    pension_salary_sacrifice_gbp: float = Field(default=0.0, ge=0.0)
    pension_relief_at_source_gbp: float = Field(default=0.0, ge=0.0)
    gift_aid_gbp: float = Field(default=0.0, ge=0.0)
    other_pre_tax_deductions_gbp: float = Field(default=0.0, ge=0.0)
    partner_annual_income_gbp: float = Field(default=0.0, ge=0.0)
    marriage_allowance_transfer: bool = Field(default=False)
    compare_tax_year: Literal["none", "2023-24", "2024-25", "2025-26"] = "none"
    council_tax_band: Literal["auto", "A", "B", "C", "D", "E", "F", "G", "H"] = "auto"
    postcode: str | None = None
    council_name: str | None = None
    council_tax_annual_override_gbp: float | None = Field(default=None, ge=0.0)
    uk_nation_for_income_tax: Literal["england_ni", "wales", "scotland"] = "england_ni"
    employment_type: Literal["employed", "self_employed", "mixed"] = "employed"
    savings_interest_gbp: float = Field(default=0.0, ge=0.0)
    dividend_income_gbp: float = Field(default=0.0, ge=0.0)
    student_loan_plan: Literal["none", "1", "2", "4", "5", "postgrad"] = "none"
    policy_overrides: PolicyOverrides | None = None


class TaxEstimateResponse(BaseModel):
    annual_income_gbp: float
    income_tax_gbp: float
    national_insurance_gbp: float
    vat_estimate_gbp: float
    council_tax_estimate_gbp: float
    student_loan_repayment_gbp: float = 0.0
    savings_tax_gbp: float = 0.0
    dividend_tax_gbp: float = 0.0
    total_estimated_tax_gbp: float
    effective_tax_rate: float
    assumptions: dict[str, float | str]
    household_summary: dict[str, float | bool | int] | None = None
    historical_comparison: TaxYearComparison | None = None
    take_home_gbp: float | None = None
    uncertainty_range_gbp: dict[str, float] | None = None


class SpendingBreakdownRequest(BaseModel):
    annual_income_gbp: float = Field(gt=0)
    region: str = Field(default="England")
    tax_year: Literal["2023-24", "2024-25", "2025-26"] = "2025-26"
    vatable_spend_ratio: float = Field(default=0.6, ge=0.0, le=1.0)
    spending_year: Literal["2024-25"] = "2024-25"
    revenue_year: Literal["2022 to 2023"] = "2022 to 2023"
    top_n: int = Field(default=12, ge=1, le=50)
    pension_salary_sacrifice_gbp: float = Field(default=0.0, ge=0.0)
    pension_relief_at_source_gbp: float = Field(default=0.0, ge=0.0)
    gift_aid_gbp: float = Field(default=0.0, ge=0.0)
    other_pre_tax_deductions_gbp: float = Field(default=0.0, ge=0.0)
    partner_annual_income_gbp: float = Field(default=0.0, ge=0.0)
    marriage_allowance_transfer: bool = Field(default=False)
    council_tax_band: Literal["auto", "A", "B", "C", "D", "E", "F", "G", "H"] = "auto"
    postcode: str | None = None
    council_name: str | None = None
    council_tax_annual_override_gbp: float | None = Field(default=None, ge=0.0)
    uk_nation_for_income_tax: Literal["england_ni", "wales", "scotland"] = "england_ni"
    employment_type: Literal["employed", "self_employed", "mixed"] = "employed"
    savings_interest_gbp: float = Field(default=0.0, ge=0.0)
    dividend_income_gbp: float = Field(default=0.0, ge=0.0)
    student_loan_plan: Literal["none", "1", "2", "4", "5", "postgrad"] = "none"
    policy_overrides: PolicyOverrides | None = None


class ServiceContribution(BaseModel):
    function_label: str
    spending_amount_m_gbp: float
    user_contribution_gbp: float
    share_of_user_tax_percent: float


class SpendingBreakdownResponse(BaseModel):
    total_uk_tax_revenue_m_gbp: float
    user_total_tax_gbp: float
    user_share_of_total_revenue: float
    spending_year: str
    revenue_year: str
    services: list[ServiceContribution]


class ServicesImpactRequest(BaseModel):
    annual_income_gbp: float = Field(gt=0)
    region: str = Field(default="England")
    tax_year: Literal["2023-24", "2024-25", "2025-26"] = "2025-26"
    vatable_spend_ratio: float = Field(default=0.6, ge=0.0, le=1.0)
    spending_year: Literal["2024-25"] = "2024-25"
    revenue_year: Literal["2022 to 2023"] = "2022 to 2023"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    pension_salary_sacrifice_gbp: float = Field(default=0.0, ge=0.0)
    pension_relief_at_source_gbp: float = Field(default=0.0, ge=0.0)
    gift_aid_gbp: float = Field(default=0.0, ge=0.0)
    other_pre_tax_deductions_gbp: float = Field(default=0.0, ge=0.0)
    partner_annual_income_gbp: float = Field(default=0.0, ge=0.0)
    marriage_allowance_transfer: bool = Field(default=False)
    council_tax_band: Literal["auto", "A", "B", "C", "D", "E", "F", "G", "H"] = "auto"
    postcode: str | None = None
    council_name: str | None = None
    council_tax_annual_override_gbp: float | None = Field(default=None, ge=0.0)
    uk_nation_for_income_tax: Literal["england_ni", "wales", "scotland"] = "england_ni"
    employment_type: Literal["employed", "self_employed", "mixed"] = "employed"
    savings_interest_gbp: float = Field(default=0.0, ge=0.0)
    dividend_income_gbp: float = Field(default=0.0, ge=0.0)
    student_loan_plan: Literal["none", "1", "2", "4", "5", "postgrad"] = "none"
    policy_overrides: PolicyOverrides | None = None


class ServicesImpactResponse(BaseModel):
    total_uk_tax_revenue_m_gbp: float
    user_total_tax_gbp: float
    user_share_of_total_revenue: float
    spending_year: str
    revenue_year: str
    page: int
    page_size: int
    total_items: int
    services: list[ServiceContribution]


class RegionalBalance(BaseModel):
    geography_code: str
    geography_name: str
    contribution_m_gbp: float
    spending_m_gbp: float
    net_balance_m_gbp: float


class RegionalFlow(BaseModel):
    origin_region: str
    destination_region: str
    value_m_gbp: float


class RegionalFlowsRequest(BaseModel):
    year: Literal["2022 to 2023"] = "2022 to 2023"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=500)


class RegionalFlowsResponse(BaseModel):
    year: str
    page: int
    page_size: int
    total_items: int
    official_borrowing_b_gbp: float | None = None
    official_borrowing_year_label: str | None = None
    official_borrowing_release_period: str | None = None
    official_borrowing_reference_period: str | None = None
    borrowing_method: str
    balances: list[RegionalBalance]
    flows: list[RegionalFlow]


class JournalistExportRequest(BaseModel):
    annual_income_gbp: float = Field(gt=0)
    region: str = Field(default="England")
    tax_year: Literal["2023-24", "2024-25", "2025-26"] = "2025-26"
    vatable_spend_ratio: float = Field(default=0.6, ge=0.0, le=1.0)
    pension_salary_sacrifice_gbp: float = Field(default=0.0, ge=0.0)
    pension_relief_at_source_gbp: float = Field(default=0.0, ge=0.0)
    gift_aid_gbp: float = Field(default=0.0, ge=0.0)
    other_pre_tax_deductions_gbp: float = Field(default=0.0, ge=0.0)
    partner_annual_income_gbp: float = Field(default=0.0, ge=0.0)
    marriage_allowance_transfer: bool = Field(default=False)
    council_tax_band: Literal["auto", "A", "B", "C", "D", "E", "F", "G", "H"] = "auto"
    postcode: str | None = None
    council_name: str | None = None
    council_tax_annual_override_gbp: float | None = Field(default=None, ge=0.0)
    uk_nation_for_income_tax: Literal["england_ni", "wales", "scotland"] = "england_ni"
    employment_type: Literal["employed", "self_employed", "mixed"] = "employed"
    savings_interest_gbp: float = Field(default=0.0, ge=0.0)
    dividend_income_gbp: float = Field(default=0.0, ge=0.0)
    student_loan_plan: Literal["none", "1", "2", "4", "5", "postgrad"] = "none"
    policy_overrides: PolicyOverrides | None = None


class JournalistExportResponse(BaseModel):
    exported_at_utc: str
    tax: TaxEstimateResponse
    spending_breakdown: SpendingBreakdownResponse
    services_impact: ServicesImpactResponse
    regional_flows: RegionalFlowsResponse
    services_csv: str
    regional_balances_csv: str
