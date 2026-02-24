from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote
from urllib.request import Request, urlopen

import json


@dataclass(frozen=True)
class TaxParameters:
    personal_allowance: float = 12570.0
    basic_rate_limit: float = 37700.0
    higher_rate_threshold: float = 125140.0
    basic_rate: float = 0.20
    higher_rate: float = 0.40
    additional_rate: float = 0.45
    ni_primary_threshold: float = 12570.0
    ni_upper_earnings_limit: float = 50270.0
    ni_main_rate: float = 0.08
    ni_upper_rate: float = 0.02
    vat_rate: float = 0.20


TAX_PARAMETERS_BY_YEAR: dict[str, TaxParameters] = {
    # Approximate annualized parameter sets for comparison mode.
    "2023-24": TaxParameters(ni_main_rate=0.12, ni_upper_rate=0.02),
    "2024-25": TaxParameters(ni_main_rate=0.08, ni_upper_rate=0.02),
    "2025-26": TaxParameters(ni_main_rate=0.08, ni_upper_rate=0.02),
}

MARRIAGE_ALLOWANCE_CREDIT_GBP = 252.0


COUNCIL_TAX_AVERAGE_BY_REGION = {
    "north east": 2345.0,
    "north west": 2280.0,
    "yorkshire and the humber": 2240.0,
    "east midlands": 2310.0,
    "west midlands": 2290.0,
    "east of england": 2440.0,
    "london": 2170.0,
    "south east": 2435.0,
    "south west": 2445.0,
    "england": 2280.0,
    "wales": 2200.0,
    "scotland": 1590.0,
    "northern ireland": 1250.0,
}

COUNCIL_TAX_BAND_MULTIPLIER = {
    "A": 6.0 / 9.0,
    "B": 7.0 / 9.0,
    "C": 8.0 / 9.0,
    "D": 1.0,
    "E": 11.0 / 9.0,
    "F": 13.0 / 9.0,
    "G": 15.0 / 9.0,
    "H": 18.0 / 9.0,
}


def _round2(value: float) -> float:
    return round(value, 2)


def estimate_income_tax(annual_income_gbp: float, p: TaxParameters) -> float:
    taper_reduction = max(0.0, annual_income_gbp - 100000.0) / 2.0
    personal_allowance = max(0.0, p.personal_allowance - taper_reduction)
    taxable = max(0.0, annual_income_gbp - personal_allowance)

    basic_taxable = min(taxable, p.basic_rate_limit)
    higher_band_width = max(0.0, p.higher_rate_threshold - personal_allowance - p.basic_rate_limit)
    higher_taxable = min(max(0.0, taxable - p.basic_rate_limit), higher_band_width)
    additional_taxable = max(0.0, taxable - basic_taxable - higher_taxable)

    tax = (
        basic_taxable * p.basic_rate
        + higher_taxable * p.higher_rate
        + additional_taxable * p.additional_rate
    )
    return _round2(tax)


def estimate_income_tax_with_reliefs(
    annual_income_gbp: float,
    p: TaxParameters,
    basic_rate_band_extension_gbp: float = 0.0,
) -> float:
    taper_reduction = max(0.0, annual_income_gbp - 100000.0) / 2.0
    personal_allowance = max(0.0, p.personal_allowance - taper_reduction)
    taxable = max(0.0, annual_income_gbp - personal_allowance)

    effective_basic_band = max(0.0, p.basic_rate_limit + basic_rate_band_extension_gbp)
    basic_taxable = min(taxable, effective_basic_band)
    higher_band_width = max(0.0, p.higher_rate_threshold - personal_allowance - effective_basic_band)
    higher_taxable = min(max(0.0, taxable - effective_basic_band), higher_band_width)
    additional_taxable = max(0.0, taxable - basic_taxable - higher_taxable)

    tax = (
        basic_taxable * p.basic_rate
        + higher_taxable * p.higher_rate
        + additional_taxable * p.additional_rate
    )
    return _round2(tax)


def estimate_income_tax_scotland(annual_income_gbp: float, p: TaxParameters) -> float:
    # Simplified Scottish non-savings/non-dividend rates for modelling mode.
    taper_reduction = max(0.0, annual_income_gbp - 100000.0) / 2.0
    personal_allowance = max(0.0, p.personal_allowance - taper_reduction)
    taxable = max(0.0, annual_income_gbp - personal_allowance)
    bands = [
        (2306.0, 0.19),
        (13991.0 - 2306.0, 0.20),
        (31092.0 - 13991.0, 0.21),
        (62943.0 - 31092.0, 0.42),
    ]
    total = 0.0
    remaining = taxable
    for width, rate in bands:
        take = min(remaining, width)
        if take <= 0:
            break
        total += take * rate
        remaining -= take
    if remaining > 0:
        total += remaining * 0.47
    return _round2(total)


def estimate_national_insurance(annual_income_gbp: float, p: TaxParameters) -> float:
    if annual_income_gbp <= p.ni_primary_threshold:
        return 0.0
    if annual_income_gbp <= p.ni_upper_earnings_limit:
        return _round2((annual_income_gbp - p.ni_primary_threshold) * p.ni_main_rate)

    main = (p.ni_upper_earnings_limit - p.ni_primary_threshold) * p.ni_main_rate
    upper = (annual_income_gbp - p.ni_upper_earnings_limit) * p.ni_upper_rate
    return _round2(main + upper)


def estimate_self_employed_ni(annual_income_gbp: float) -> float:
    # Simplified Class 2 + Class 4 model.
    class2 = 179.4 if annual_income_gbp >= 12570.0 else 0.0
    class4_main = max(0.0, min(annual_income_gbp, 50270.0) - 12570.0) * 0.06
    class4_upper = max(0.0, annual_income_gbp - 50270.0) * 0.02
    return _round2(class2 + class4_main + class4_upper)


def estimate_vat(
    annual_income_gbp: float,
    income_tax_gbp: float,
    national_insurance_gbp: float,
    vatable_spend_ratio: float,
    p: TaxParameters,
) -> float:
    disposable = max(0.0, annual_income_gbp - income_tax_gbp - national_insurance_gbp)
    vatable_spend = disposable * vatable_spend_ratio
    vat_component = vatable_spend * (p.vat_rate / (1.0 + p.vat_rate))
    return _round2(vat_component)


def estimate_council_tax(region: str, council_tax_band: str = "auto") -> float:
    key = region.strip().lower()
    base = COUNCIL_TAX_AVERAGE_BY_REGION.get(key, COUNCIL_TAX_AVERAGE_BY_REGION["england"])
    band = council_tax_band.strip().upper()
    if band == "AUTO":
        return base
    multiplier = COUNCIL_TAX_BAND_MULTIPLIER.get(band)
    if multiplier is None:
        return base
    return _round2(base * multiplier)


def estimate_savings_tax(annual_income_gbp: float, savings_interest_gbp: float) -> float:
    if savings_interest_gbp <= 0:
        return 0.0
    if annual_income_gbp <= 50270.0:
        allowance = 1000.0
        rate = 0.20
    elif annual_income_gbp <= 125140.0:
        allowance = 500.0
        rate = 0.40
    else:
        allowance = 0.0
        rate = 0.45
    taxable = max(0.0, savings_interest_gbp - allowance)
    return _round2(taxable * rate)


def estimate_dividend_tax(annual_income_gbp: float, dividend_income_gbp: float) -> float:
    if dividend_income_gbp <= 0:
        return 0.0
    allowance = 500.0
    taxable = max(0.0, dividend_income_gbp - allowance)
    if annual_income_gbp <= 50270.0:
        rate = 0.0875
    elif annual_income_gbp <= 125140.0:
        rate = 0.3375
    else:
        rate = 0.3935
    return _round2(taxable * rate)


STUDENT_LOAN_PLAN = {
    "1": (24990.0, 0.09),
    "2": (27295.0, 0.09),
    "4": (31395.0, 0.09),
    "5": (25000.0, 0.09),
    "postgrad": (21000.0, 0.06),
}


def estimate_student_loan_repayment(annual_income_gbp: float, plan: str) -> float:
    if plan == "none":
        return 0.0
    threshold, rate = STUDENT_LOAN_PLAN.get(plan, (10**9, 0.0))
    repay = max(0.0, annual_income_gbp - threshold) * rate
    return _round2(repay)


def lookup_council_from_postcode(postcode: str) -> dict[str, str] | None:
    p = postcode.strip()
    if not p:
        return None
    url = f"https://api.postcodes.io/postcodes/{quote(p)}"
    req = Request(url, headers={"User-Agent": "where-your-taxes-go/0.1"})
    try:
        raw = urlopen(req, timeout=8).read().decode("utf-8")
        payload = json.loads(raw)
        result = payload.get("result") or {}
        return {
            "postcode": result.get("postcode", p),
            "council_name": result.get("admin_district", ""),
            "region": result.get("region", ""),
            "country": result.get("country", ""),
        }
    except Exception:
        return None


def get_tax_parameters(tax_year: str) -> TaxParameters:
    return TAX_PARAMETERS_BY_YEAR.get(tax_year, TAX_PARAMETERS_BY_YEAR["2025-26"])
