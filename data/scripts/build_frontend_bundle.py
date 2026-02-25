#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
OUT = ROOT / "web" / "data" / "frontend_bundle.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)

    services_rows = read_csv(PROCESSED / "functional_spending_2024_25.csv")
    services = [
        {
            "function_label": r["function_label"],
            "spending_amount_m_gbp": float(r["amount_m_gbp"]),
        }
        for r in services_rows
        if r["year"] == "2024-25" and r["row_type"] == "sub_function"
    ]
    services.sort(key=lambda x: x["spending_amount_m_gbp"], reverse=True)

    revenue_rows = read_csv(PROCESSED / "ons_regional_revenue_fye2023.csv")
    revenue_match = next(
        r
        for r in revenue_rows
        if r["year"] == "2022 to 2023"
        and r["geography_code"] == "K02000001"
        and r["metric"] == "total_current_receipts_excl_north_sea_oil_gas"
    )
    total_uk_revenue_m_gbp = float(revenue_match["amount_m_gbp"])

    balance_rows = read_csv(PROCESSED / "regional_balances_2022_2023.csv")
    balances = [
        {
            "geography_code": r["geography_code"],
            "geography_name": r["geography_name"],
            "contribution_m_gbp": float(r["contribution_m_gbp"]),
            "spending_m_gbp": float(r["spending_m_gbp"]),
            "net_balance_m_gbp": float(r["net_balance_m_gbp"]),
        }
        for r in balance_rows
        if r["year"] == "2022 to 2023"
    ]

    flow_rows = read_csv(PROCESSED / "flows_2022_2023.csv")
    flows = [
        {
            "origin_region": r["origin_region"],
            "destination_region": r["destination_region"],
            "value_m_gbp": float(r["value_m_gbp"]),
        }
        for r in flow_rows
        if r["year"] == "2022 to 2023"
    ]

    official_rows = read_csv(PROCESSED / "official_uk_borrowing.csv")
    official = official_rows[0] if official_rows else None

    population_rows = read_csv(PROCESSED / "ons_itl1_population_mid2022.csv")
    population_by_region = {
        r["geography_name"]: int(float(r["population"]))
        for r in population_rows
        if r.get("population")
    }
    population_year = (
        population_rows[0].get("year") if population_rows else None
    )
    population_source_url = (
        population_rows[0].get("source_url") if population_rows else None
    )

    payload = {
        "meta": {
            "generated_from": "data/processed snapshots",
            "revenue_year": "2022 to 2023",
            "spending_year": "2024-25",
        },
        "total_uk_revenue_m_gbp": total_uk_revenue_m_gbp,
        "services": services,
        "regional": {
            "year": "2022 to 2023",
            "population_year": population_year,
            "population_source_url": population_source_url,
            "population_by_region": population_by_region,
            "balances": balances,
            "flows": flows,
            "official_borrowing": {
                "amount_b_gbp": (float(official["amount_b_gbp"]) if official else None),
                "release_period": (official.get("release_period") if official else None),
                "reference_period": (official.get("reference_period") if official else None),
                "source_url": (official.get("source_url") if official else None),
            },
        },
    }

    with OUT.open("w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=True)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
