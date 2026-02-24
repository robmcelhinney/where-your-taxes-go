from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import TypeVar


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"

T = TypeVar("T")


@lru_cache(maxsize=16)
def _read_csv_cached(path: str) -> tuple[dict[str, str], ...]:
    p = Path(path)
    with p.open("r", encoding="utf-8", newline="") as f:
        return tuple(csv.DictReader(f))


def _read_csv(path: Path) -> list[dict[str, str]]:
    # Cached source reads to reduce repeated disk I/O across API requests.
    return [dict(r) for r in _read_csv_cached(str(path.resolve()))]


def paginate_items(items: list[T], page: int, page_size: int) -> tuple[list[T], int]:
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return items[start:end], total


def load_total_uk_revenue_m_gbp(revenue_year: str) -> float:
    rows = _read_csv(PROCESSED / "ons_regional_revenue_fye2023.csv")
    matches = [
        r
        for r in rows
        if r["year"] == revenue_year
        and r["geography_code"] == "K02000001"
        and r["metric"] == "total_current_receipts_excl_north_sea_oil_gas"
    ]
    if not matches:
        raise ValueError(f"No UK revenue row found for year '{revenue_year}'")
    return float(matches[0]["amount_m_gbp"])


def _build_all_service_contributions(
    user_total_tax_gbp: float,
    revenue_year: str,
    spending_year: str,
) -> tuple[float, float, list[dict[str, float | str]]]:
    total_uk_revenue_m_gbp = load_total_uk_revenue_m_gbp(revenue_year)
    user_share = (user_total_tax_gbp / 1_000_000.0) / total_uk_revenue_m_gbp

    func_rows = _read_csv(PROCESSED / "functional_spending_2024_25.csv")
    selected = [
        r
        for r in func_rows
        if r["year"] == spending_year and r["row_type"] == "sub_function"
    ]

    services: list[dict[str, float | str]] = []
    for r in selected:
        spending_m = float(r["amount_m_gbp"])
        contribution_gbp = spending_m * user_share * 1_000_000.0
        share_percent = (contribution_gbp / user_total_tax_gbp * 100.0) if user_total_tax_gbp else 0.0
        services.append(
            {
                "function_label": r["function_label"],
                "spending_amount_m_gbp": round(spending_m, 2),
                "user_contribution_gbp": round(contribution_gbp, 2),
                "share_of_user_tax_percent": round(share_percent, 4),
            }
        )

    services.sort(key=lambda x: float(x["user_contribution_gbp"]), reverse=True)
    return round(total_uk_revenue_m_gbp, 2), round(user_share, 10), services


def build_service_contributions_paginated(
    user_total_tax_gbp: float,
    revenue_year: str,
    spending_year: str,
    page: int,
    page_size: int,
) -> dict[str, float | str | int | list[dict[str, float | str]]]:
    total_uk_revenue_m_gbp, user_share, services = _build_all_service_contributions(
        user_total_tax_gbp=user_total_tax_gbp,
        revenue_year=revenue_year,
        spending_year=spending_year,
    )
    page_items, total_items = paginate_items(services, page=page, page_size=page_size)
    return {
        "total_uk_tax_revenue_m_gbp": total_uk_revenue_m_gbp,
        "user_total_tax_gbp": round(user_total_tax_gbp, 2),
        "user_share_of_total_revenue": user_share,
        "spending_year": spending_year,
        "revenue_year": revenue_year,
        "page": page,
        "page_size": page_size,
        "total_items": total_items,
        "services": page_items,
    }


def build_service_contributions(
    user_total_tax_gbp: float,
    revenue_year: str,
    spending_year: str,
    top_n: int = 12,
) -> dict[str, float | str | list[dict[str, float | str]]]:
    raw = build_service_contributions_paginated(
        user_total_tax_gbp=user_total_tax_gbp,
        revenue_year=revenue_year,
        spending_year=spending_year,
        page=1,
        page_size=top_n,
    )
    return {
        "total_uk_tax_revenue_m_gbp": raw["total_uk_tax_revenue_m_gbp"],
        "user_total_tax_gbp": raw["user_total_tax_gbp"],
        "user_share_of_total_revenue": raw["user_share_of_total_revenue"],
        "spending_year": raw["spending_year"],
        "revenue_year": raw["revenue_year"],
        "services": raw["services"],
    }
