#!/usr/bin/env python3
"""Precompute regional balances and flows for API fast-path usage."""

from __future__ import annotations

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed"
sys.path.insert(0, str(ROOT))

from api.regional import compute_flows, compute_regional_balances


def write_csv(path: Path, rows: list[dict[str, object]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    year = "2022 to 2023"
    balances = compute_regional_balances(year=year)
    flows = compute_flows(year=year)

    balance_rows = [
        {
            "year": year,
            "geography_code": b.geography_code,
            "geography_name": b.geography_name,
            "contribution_m_gbp": b.contribution_m_gbp,
            "spending_m_gbp": b.spending_m_gbp,
            "net_balance_m_gbp": b.net_balance_m_gbp,
        }
        for b in balances
    ]
    write_csv(
        OUT / "regional_balances_2022_2023.csv",
        balance_rows,
        [
            "year",
            "geography_code",
            "geography_name",
            "contribution_m_gbp",
            "spending_m_gbp",
            "net_balance_m_gbp",
        ],
    )
    write_csv(
        OUT / "flows_2022_2023.csv",
        [{"year": year, **f} for f in flows],
        ["year", "origin_region", "destination_region", "value_m_gbp"],
    )
    print(f"Wrote {OUT / 'regional_balances_2022_2023.csv'} ({len(balance_rows)} rows)")
    print(f"Wrote {OUT / 'flows_2022_2023.csv'} ({len(flows)} rows)")


if __name__ == "__main__":
    main()
