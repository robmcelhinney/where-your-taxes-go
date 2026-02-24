from __future__ import annotations

import csv
import io
from dataclasses import replace
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.attribution import build_service_contributions, build_service_contributions_paginated, paginate_items
from api.models import (
    JournalistExportRequest,
    JournalistExportResponse,
    RegionalBalance,
    RegionalFlow,
    RegionalFlowsRequest,
    RegionalFlowsResponse,
    ServiceContribution,
    ServicesImpactRequest,
    ServicesImpactResponse,
    SpendingBreakdownRequest,
    SpendingBreakdownResponse,
    TaxEstimateRequest,
    TaxEstimateResponse,
)
from api.regional import load_official_uk_borrowing, load_precomputed_balances, load_precomputed_flows
from api.tax_model import (
    MARRIAGE_ALLOWANCE_CREDIT_GBP,
    estimate_council_tax,
    estimate_dividend_tax,
    estimate_income_tax_with_reliefs,
    estimate_income_tax_scotland,
    get_tax_parameters,
    estimate_national_insurance,
    estimate_savings_tax,
    estimate_self_employed_ni,
    estimate_student_loan_repayment,
    estimate_vat,
    lookup_council_from_postcode,
)


app = FastAPI(title="Where Your Taxes Go API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/public/meta")
def public_meta() -> dict[str, object]:
    return {
        "name": "Where Your Taxes Go API",
        "version": app.version,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "public_endpoints": [
            "/tax/estimate",
            "/spending/breakdown",
            "/services/impact",
            "/regional/flows",
            "/journalist/export",
            "/public/meta",
        ],
    }


def _compute_person_tax(
    annual_income_gbp: float,
    p,
    basic_rate_band_extension_gbp: float = 0.0,
) -> dict[str, float]:
    income_tax = estimate_income_tax_with_reliefs(
        annual_income_gbp, p, basic_rate_band_extension_gbp=basic_rate_band_extension_gbp
    )
    ni = estimate_national_insurance(annual_income_gbp, p)
    return {"income_tax_gbp": income_tax, "national_insurance_gbp": ni}


def _apply_policy_overrides(base_params, req: TaxEstimateRequest):
    if not req.policy_overrides:
        return base_params
    return replace(
        base_params,
        personal_allowance=(
            req.policy_overrides.personal_allowance
            if req.policy_overrides.personal_allowance is not None
            else base_params.personal_allowance
        ),
        basic_rate=(
            req.policy_overrides.basic_rate
            if req.policy_overrides.basic_rate is not None
            else base_params.basic_rate
        ),
        higher_rate=(
            req.policy_overrides.higher_rate
            if req.policy_overrides.higher_rate is not None
            else base_params.higher_rate
        ),
        additional_rate=(
            req.policy_overrides.additional_rate
            if req.policy_overrides.additional_rate is not None
            else base_params.additional_rate
        ),
        ni_main_rate=(
            req.policy_overrides.ni_main_rate
            if req.policy_overrides.ni_main_rate is not None
            else base_params.ni_main_rate
        ),
        ni_upper_rate=(
            req.policy_overrides.ni_upper_rate
            if req.policy_overrides.ni_upper_rate is not None
            else base_params.ni_upper_rate
        ),
        vat_rate=(
            req.policy_overrides.vat_rate
            if req.policy_overrides.vat_rate is not None
            else base_params.vat_rate
        ),
    )


def _estimate_tax_totals(req: TaxEstimateRequest) -> tuple[TaxEstimateResponse, float, float]:
    params = _apply_policy_overrides(get_tax_parameters(req.tax_year), req)
    adjusted_income = max(
        0.0,
        req.annual_income_gbp - req.pension_salary_sacrifice_gbp - req.other_pre_tax_deductions_gbp,
    )
    adjusted_partner_income = max(0.0, req.partner_annual_income_gbp)
    basic_rate_band_extension = req.pension_relief_at_source_gbp + req.gift_aid_gbp

    primary_income_tax = estimate_income_tax_with_reliefs(
        adjusted_income,
        params,
        basic_rate_band_extension_gbp=basic_rate_band_extension,
    )
    if req.uk_nation_for_income_tax == "scotland":
        primary_income_tax = estimate_income_tax_scotland(adjusted_income, params)
    primary = {
        "income_tax_gbp": primary_income_tax,
        "national_insurance_gbp": estimate_national_insurance(adjusted_income, params),
    }
    partner = _compute_person_tax(adjusted_partner_income, params)
    if req.employment_type in {"self_employed", "mixed"}:
        primary["national_insurance_gbp"] = estimate_self_employed_ni(adjusted_income)

    marriage_credit = 0.0
    if req.marriage_allowance_transfer and adjusted_partner_income > 0:
        lower_income = min(adjusted_income, adjusted_partner_income)
        higher_income = max(adjusted_income, adjusted_partner_income)
        if lower_income <= params.personal_allowance and higher_income <= params.higher_rate_threshold:
            marriage_credit = min(
                MARRIAGE_ALLOWANCE_CREDIT_GBP,
                max(primary["income_tax_gbp"], partner["income_tax_gbp"]),
            )
            if primary["income_tax_gbp"] >= partner["income_tax_gbp"]:
                primary["income_tax_gbp"] = round(primary["income_tax_gbp"] - marriage_credit, 2)
            else:
                partner["income_tax_gbp"] = round(partner["income_tax_gbp"] - marriage_credit, 2)

    household_income_tax = round(primary["income_tax_gbp"] + partner["income_tax_gbp"], 2)
    household_ni = round(primary["national_insurance_gbp"] + partner["national_insurance_gbp"], 2)
    gross_household_income = req.annual_income_gbp + req.partner_annual_income_gbp
    adjusted_household_income = adjusted_income + adjusted_partner_income
    vat = estimate_vat(
        adjusted_household_income,
        household_income_tax,
        household_ni,
        req.vatable_spend_ratio,
        params,
    )
    council_lookup = (
        lookup_council_from_postcode(req.postcode or "") if req.postcode else None
    )
    inferred_council = req.council_name or (council_lookup.get("council_name", "") if council_lookup else "")
    inferred_region = council_lookup.get("region", "") if council_lookup else ""
    council_region = inferred_region or req.region
    if req.council_tax_annual_override_gbp is not None:
        council = round(req.council_tax_annual_override_gbp, 2)
    else:
        council = estimate_council_tax(council_region, req.council_tax_band)
    savings_tax = estimate_savings_tax(adjusted_income, req.savings_interest_gbp)
    dividend_tax = estimate_dividend_tax(adjusted_income, req.dividend_income_gbp)
    student_loan = estimate_student_loan_repayment(adjusted_income, req.student_loan_plan)
    total = round(household_income_tax + household_ni + vat + council + savings_tax + dividend_tax + student_loan, 2)
    effective = round((total / gross_household_income) if gross_household_income else 0.0, 6)
    take_home = round(gross_household_income - total, 2)

    vat_low = max(0.0, req.vatable_spend_ratio - 0.10)
    vat_high = min(1.0, req.vatable_spend_ratio + 0.10)
    vat_est_low = estimate_vat(adjusted_household_income, household_income_tax, household_ni, vat_low, params)
    vat_est_high = estimate_vat(adjusted_household_income, household_income_tax, household_ni, vat_high, params)
    council_low = council if req.council_tax_annual_override_gbp is not None else round(council * 0.9, 2)
    council_high = council if req.council_tax_annual_override_gbp is not None else round(council * 1.1, 2)
    total_low = round(household_income_tax + household_ni + vat_est_low + council_low + savings_tax + dividend_tax + student_loan, 2)
    total_high = round(
        household_income_tax + household_ni + vat_est_high + council_high + savings_tax + dividend_tax + student_loan,
        2,
    )

    response = TaxEstimateResponse(
        annual_income_gbp=round(req.annual_income_gbp, 2),
        income_tax_gbp=household_income_tax,
        national_insurance_gbp=household_ni,
        vat_estimate_gbp=vat,
        council_tax_estimate_gbp=council,
        student_loan_repayment_gbp=student_loan,
        savings_tax_gbp=savings_tax,
        dividend_tax_gbp=dividend_tax,
        total_estimated_tax_gbp=total,
        effective_tax_rate=effective,
        assumptions={
            "tax_year": req.tax_year,
            "vatable_spend_ratio": req.vatable_spend_ratio,
            "vat_rate": params.vat_rate,
            "ni_main_rate": params.ni_main_rate,
            "ni_upper_rate": params.ni_upper_rate,
            "adjusted_income_gbp": round(adjusted_income, 2),
            "adjusted_partner_income_gbp": round(adjusted_partner_income, 2),
            "pension_salary_sacrifice_gbp": req.pension_salary_sacrifice_gbp,
            "pension_relief_at_source_gbp": req.pension_relief_at_source_gbp,
            "gift_aid_gbp": req.gift_aid_gbp,
            "other_pre_tax_deductions_gbp": req.other_pre_tax_deductions_gbp,
            "council_tax_band": req.council_tax_band,
            "council_name": inferred_council,
            "postcode_lookup_region": inferred_region,
            "council_tax_region_used": council_region,
            "uk_nation_for_income_tax": req.uk_nation_for_income_tax,
            "employment_type": req.employment_type,
            "student_loan_plan": req.student_loan_plan,
            "policy_simulation_active": "yes" if req.policy_overrides else "no",
            "marriage_allowance_credit_gbp": marriage_credit,
        },
        household_summary={
            "household_income_gbp": round(gross_household_income, 2),
            "partner_annual_income_gbp": round(req.partner_annual_income_gbp, 2),
            "household_adults": 2 if req.partner_annual_income_gbp > 0 else 1,
            "marriage_allowance_transfer": req.marriage_allowance_transfer,
        },
        take_home_gbp=take_home,
        uncertainty_range_gbp={"low": total_low, "high": total_high},
    )
    return response, adjusted_income, adjusted_partner_income


@app.post("/tax/estimate", response_model=TaxEstimateResponse)
def tax_estimate(req: TaxEstimateRequest) -> TaxEstimateResponse:
    response, _, _ = _estimate_tax_totals(req)
    if req.compare_tax_year != "none" and req.compare_tax_year != req.tax_year:
        compare_req = req.model_copy(update={"tax_year": req.compare_tax_year, "compare_tax_year": "none"})
        compare_response, _, _ = _estimate_tax_totals(compare_req)
        delta = round(compare_response.total_estimated_tax_gbp - response.total_estimated_tax_gbp, 2)
        response.historical_comparison = {
            "compare_tax_year": req.compare_tax_year,
            "total_estimated_tax_gbp": compare_response.total_estimated_tax_gbp,
            "delta_vs_selected_gbp": delta,
            "delta_vs_selected_percent": round(
                (delta / response.total_estimated_tax_gbp * 100.0)
                if response.total_estimated_tax_gbp
                else 0.0,
                4,
            ),
        }
    return response


@app.post("/spending/breakdown", response_model=SpendingBreakdownResponse)
def spending_breakdown(req: SpendingBreakdownRequest) -> SpendingBreakdownResponse:
    tax = tax_estimate(
        TaxEstimateRequest(
            annual_income_gbp=req.annual_income_gbp,
            region=req.region,
            tax_year=req.tax_year,
            vatable_spend_ratio=req.vatable_spend_ratio,
            pension_salary_sacrifice_gbp=req.pension_salary_sacrifice_gbp,
            pension_relief_at_source_gbp=req.pension_relief_at_source_gbp,
            gift_aid_gbp=req.gift_aid_gbp,
            other_pre_tax_deductions_gbp=req.other_pre_tax_deductions_gbp,
            partner_annual_income_gbp=req.partner_annual_income_gbp,
            marriage_allowance_transfer=req.marriage_allowance_transfer,
            council_tax_band=req.council_tax_band,
            postcode=req.postcode,
            council_name=req.council_name,
            council_tax_annual_override_gbp=req.council_tax_annual_override_gbp,
            uk_nation_for_income_tax=req.uk_nation_for_income_tax,
            employment_type=req.employment_type,
            savings_interest_gbp=req.savings_interest_gbp,
            dividend_income_gbp=req.dividend_income_gbp,
            student_loan_plan=req.student_loan_plan,
            policy_overrides=req.policy_overrides,
        )
    )
    raw = build_service_contributions(
        user_total_tax_gbp=tax.total_estimated_tax_gbp,
        revenue_year=req.revenue_year,
        spending_year=req.spending_year,
        top_n=req.top_n,
    )
    return SpendingBreakdownResponse(
        total_uk_tax_revenue_m_gbp=float(raw["total_uk_tax_revenue_m_gbp"]),
        user_total_tax_gbp=float(raw["user_total_tax_gbp"]),
        user_share_of_total_revenue=float(raw["user_share_of_total_revenue"]),
        spending_year=str(raw["spending_year"]),
        revenue_year=str(raw["revenue_year"]),
        services=[ServiceContribution(**s) for s in raw["services"]],  # type: ignore[arg-type]
    )


@app.post("/services/impact", response_model=ServicesImpactResponse)
def services_impact(req: ServicesImpactRequest) -> ServicesImpactResponse:
    tax = tax_estimate(
        TaxEstimateRequest(
            annual_income_gbp=req.annual_income_gbp,
            region=req.region,
            tax_year=req.tax_year,
            vatable_spend_ratio=req.vatable_spend_ratio,
            pension_salary_sacrifice_gbp=req.pension_salary_sacrifice_gbp,
            pension_relief_at_source_gbp=req.pension_relief_at_source_gbp,
            gift_aid_gbp=req.gift_aid_gbp,
            other_pre_tax_deductions_gbp=req.other_pre_tax_deductions_gbp,
            partner_annual_income_gbp=req.partner_annual_income_gbp,
            marriage_allowance_transfer=req.marriage_allowance_transfer,
            council_tax_band=req.council_tax_band,
            postcode=req.postcode,
            council_name=req.council_name,
            council_tax_annual_override_gbp=req.council_tax_annual_override_gbp,
            uk_nation_for_income_tax=req.uk_nation_for_income_tax,
            employment_type=req.employment_type,
            savings_interest_gbp=req.savings_interest_gbp,
            dividend_income_gbp=req.dividend_income_gbp,
            student_loan_plan=req.student_loan_plan,
            policy_overrides=req.policy_overrides,
        )
    )
    raw = build_service_contributions_paginated(
        user_total_tax_gbp=tax.total_estimated_tax_gbp,
        revenue_year=req.revenue_year,
        spending_year=req.spending_year,
        page=req.page,
        page_size=req.page_size,
    )
    return ServicesImpactResponse(
        total_uk_tax_revenue_m_gbp=float(raw["total_uk_tax_revenue_m_gbp"]),
        user_total_tax_gbp=float(raw["user_total_tax_gbp"]),
        user_share_of_total_revenue=float(raw["user_share_of_total_revenue"]),
        spending_year=str(raw["spending_year"]),
        revenue_year=str(raw["revenue_year"]),
        page=int(raw["page"]),
        page_size=int(raw["page_size"]),
        total_items=int(raw["total_items"]),
        services=[ServiceContribution(**s) for s in raw["services"]],  # type: ignore[arg-type]
    )


@app.post("/regional/flows", response_model=RegionalFlowsResponse)
def regional_flows(req: RegionalFlowsRequest) -> RegionalFlowsResponse:
    balances = load_precomputed_balances(year=req.year)
    flows = load_precomputed_flows(year=req.year)
    official = load_official_uk_borrowing()
    paged_flows, total_items = paginate_items(flows, page=req.page, page_size=req.page_size)
    return RegionalFlowsResponse(
        year=req.year,
        page=req.page,
        page_size=req.page_size,
        total_items=total_items,
        official_borrowing_b_gbp=(float(official["amount_b_gbp"]) if official else None),
        official_borrowing_year_label=(str(official["reference_period"]) if official else None),
        official_borrowing_release_period=(str(official["release_period"]) if official else None),
        official_borrowing_reference_period=(str(official["reference_period"]) if official else None),
        borrowing_method=("official_psnb_ex" if official else "implied_gap_from_regional_dataset"),
        balances=[RegionalBalance(**b.__dict__) for b in balances],
        flows=[RegionalFlow(**f) for f in paged_flows],  # type: ignore[arg-type]
    )


def _rows_to_csv(rows: list[dict[str, object]], fieldnames: list[str]) -> str:
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return out.getvalue()


@app.post("/journalist/export", response_model=JournalistExportResponse)
def journalist_export(req: JournalistExportRequest) -> JournalistExportResponse:
    tax = tax_estimate(
        TaxEstimateRequest(
            annual_income_gbp=req.annual_income_gbp,
            region=req.region,
            tax_year=req.tax_year,
            vatable_spend_ratio=req.vatable_spend_ratio,
            pension_salary_sacrifice_gbp=req.pension_salary_sacrifice_gbp,
            pension_relief_at_source_gbp=req.pension_relief_at_source_gbp,
            gift_aid_gbp=req.gift_aid_gbp,
            other_pre_tax_deductions_gbp=req.other_pre_tax_deductions_gbp,
            partner_annual_income_gbp=req.partner_annual_income_gbp,
            marriage_allowance_transfer=req.marriage_allowance_transfer,
            council_tax_band=req.council_tax_band,
            postcode=req.postcode,
            council_name=req.council_name,
            council_tax_annual_override_gbp=req.council_tax_annual_override_gbp,
            uk_nation_for_income_tax=req.uk_nation_for_income_tax,
            employment_type=req.employment_type,
            savings_interest_gbp=req.savings_interest_gbp,
            dividend_income_gbp=req.dividend_income_gbp,
            student_loan_plan=req.student_loan_plan,
            policy_overrides=req.policy_overrides,
        )
    )
    breakdown = spending_breakdown(
        SpendingBreakdownRequest(
            annual_income_gbp=req.annual_income_gbp,
            region=req.region,
            tax_year=req.tax_year,
            vatable_spend_ratio=req.vatable_spend_ratio,
            pension_salary_sacrifice_gbp=req.pension_salary_sacrifice_gbp,
            pension_relief_at_source_gbp=req.pension_relief_at_source_gbp,
            gift_aid_gbp=req.gift_aid_gbp,
            other_pre_tax_deductions_gbp=req.other_pre_tax_deductions_gbp,
            partner_annual_income_gbp=req.partner_annual_income_gbp,
            marriage_allowance_transfer=req.marriage_allowance_transfer,
            council_tax_band=req.council_tax_band,
            postcode=req.postcode,
            council_name=req.council_name,
            council_tax_annual_override_gbp=req.council_tax_annual_override_gbp,
            uk_nation_for_income_tax=req.uk_nation_for_income_tax,
            employment_type=req.employment_type,
            savings_interest_gbp=req.savings_interest_gbp,
            dividend_income_gbp=req.dividend_income_gbp,
            student_loan_plan=req.student_loan_plan,
            policy_overrides=req.policy_overrides,
        )
    )
    services = services_impact(
        ServicesImpactRequest(
            annual_income_gbp=req.annual_income_gbp,
            region=req.region,
            tax_year=req.tax_year,
            vatable_spend_ratio=req.vatable_spend_ratio,
            pension_salary_sacrifice_gbp=req.pension_salary_sacrifice_gbp,
            pension_relief_at_source_gbp=req.pension_relief_at_source_gbp,
            gift_aid_gbp=req.gift_aid_gbp,
            other_pre_tax_deductions_gbp=req.other_pre_tax_deductions_gbp,
            partner_annual_income_gbp=req.partner_annual_income_gbp,
            marriage_allowance_transfer=req.marriage_allowance_transfer,
            council_tax_band=req.council_tax_band,
            postcode=req.postcode,
            council_name=req.council_name,
            council_tax_annual_override_gbp=req.council_tax_annual_override_gbp,
            uk_nation_for_income_tax=req.uk_nation_for_income_tax,
            employment_type=req.employment_type,
            savings_interest_gbp=req.savings_interest_gbp,
            dividend_income_gbp=req.dividend_income_gbp,
            student_loan_plan=req.student_loan_plan,
            policy_overrides=req.policy_overrides,
            page=1,
            page_size=100,
        )
    )
    regional = regional_flows(RegionalFlowsRequest(year="2022 to 2023", page=1, page_size=200))

    services_rows = [s.model_dump() for s in services.services]
    balances_rows = [b.model_dump() for b in regional.balances]
    return JournalistExportResponse(
        exported_at_utc=datetime.now(timezone.utc).isoformat(),
        tax=tax,
        spending_breakdown=breakdown,
        services_impact=services,
        regional_flows=regional,
        services_csv=_rows_to_csv(
            services_rows,
            [
                "function_label",
                "spending_amount_m_gbp",
                "user_contribution_gbp",
                "share_of_user_tax_percent",
            ],
        ),
        regional_balances_csv=_rows_to_csv(
            balances_rows,
            [
                "geography_code",
                "geography_name",
                "contribution_m_gbp",
                "spending_m_gbp",
                "net_balance_m_gbp",
            ],
        ),
    )
