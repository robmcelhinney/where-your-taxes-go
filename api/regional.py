from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
TARGET_CODES = {
    "E12000001",
    "E12000002",
    "E12000003",
    "E12000004",
    "E12000005",
    "E12000006",
    "E12000007",
    "E12000008",
    "E12000009",
    "W92000004",
    "S92000003",
    "N92000002",
}


@dataclass(frozen=True)
class RegionBalance:
    geography_code: str
    geography_name: str
    contribution_m_gbp: float
    spending_m_gbp: float
    net_balance_m_gbp: float


@lru_cache(maxsize=16)
def _read_csv(path: str) -> tuple[dict[str, str], ...]:
    with Path(path).open("r", encoding="utf-8", newline="") as f:
        return tuple(csv.DictReader(f))


def compute_regional_balances(year: str = "2022 to 2023") -> list[RegionBalance]:
    rev_rows = _read_csv(str((PROCESSED / "ons_regional_revenue_fye2023.csv").resolve()))
    exp_rows = _read_csv(str((PROCESSED / "ons_regional_expenditure_fye2023.csv").resolve()))

    rev = {
        r["geography_code"]: (r["geography_name"], float(r["amount_m_gbp"]))
        for r in rev_rows
        if r["year"] == year and r["geography_code"] in TARGET_CODES
    }
    exp = {
        r["geography_code"]: (r["geography_name"], float(r["amount_m_gbp"]))
        for r in exp_rows
        if r["year"] == year and r["geography_code"] in TARGET_CODES
    }

    balances: list[RegionBalance] = []
    for code, (name, contrib) in rev.items():
        spending = exp.get(code, (name, 0.0))[1]
        balances.append(
            RegionBalance(
                geography_code=code,
                geography_name=name,
                contribution_m_gbp=round(contrib, 2),
                spending_m_gbp=round(spending, 2),
                net_balance_m_gbp=round(contrib - spending, 2),
            )
        )
    balances.sort(key=lambda b: b.geography_name)
    return balances


def compute_flows(year: str = "2022 to 2023") -> list[dict[str, float | str]]:
    balances = compute_regional_balances(year=year)
    donors = [b for b in balances if b.net_balance_m_gbp > 0]
    recipients = [b for b in balances if b.net_balance_m_gbp < 0]

    total_surplus = sum(b.net_balance_m_gbp for b in donors)
    total_deficit = sum(-b.net_balance_m_gbp for b in recipients)
    if total_surplus <= 0 or total_deficit <= 0:
        return []

    transfer_total = min(total_surplus, total_deficit)
    flows: list[dict[str, float | str]] = []
    for d in donors:
        donor_weight = d.net_balance_m_gbp / total_surplus
        donor_transfer = transfer_total * donor_weight
        for r in recipients:
            recipient_weight = (-r.net_balance_m_gbp) / total_deficit
            value = donor_transfer * recipient_weight
            if value < 0.01:
                continue
            flows.append(
                {
                    "origin_region": d.geography_name,
                    "destination_region": r.geography_name,
                    "value_m_gbp": round(value, 4),
                }
            )
    flows.sort(key=lambda x: float(x["value_m_gbp"]), reverse=True)
    return flows


def _read_precomputed(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


@lru_cache(maxsize=8)
def load_precomputed_balances(year: str = "2022 to 2023") -> list[RegionBalance]:
    pre = PROCESSED / "regional_balances_2022_2023.csv"
    if pre.exists() and year == "2022 to 2023":
        rows = _read_precomputed(pre)
        return [
            RegionBalance(
                geography_code=r["geography_code"],
                geography_name=r["geography_name"],
                contribution_m_gbp=float(r["contribution_m_gbp"]),
                spending_m_gbp=float(r["spending_m_gbp"]),
                net_balance_m_gbp=float(r["net_balance_m_gbp"]),
            )
            for r in rows
            if r["year"] == year
        ]
    return compute_regional_balances(year=year)


@lru_cache(maxsize=8)
def load_precomputed_flows(year: str = "2022 to 2023") -> list[dict[str, float | str]]:
    pre = PROCESSED / "flows_2022_2023.csv"
    if pre.exists() and year == "2022 to 2023":
        rows = _read_precomputed(pre)
        return [
            {
                "origin_region": r["origin_region"],
                "destination_region": r["destination_region"],
                "value_m_gbp": float(r["value_m_gbp"]),
            }
            for r in rows
            if r["year"] == year
        ]
    return compute_flows(year=year)


@lru_cache(maxsize=2)
def load_official_uk_borrowing() -> dict[str, str | float] | None:
    path = PROCESSED / "official_uk_borrowing.csv"
    if not path.exists():
        return None
    rows = _read_precomputed(path)
    if not rows:
        return None
    row = rows[0]
    release_period = row.get("release_period", "").strip()
    reference_period = row.get("reference_period", "").strip()
    # Backward compatibility with older schema.
    if not reference_period:
        reference_period = row.get("year_label", "").strip()
    if not release_period:
        source_url = row.get("source_url", "")
        release_period = source_url.rstrip("/").split("/")[-1] if source_url else ""
    return {
        "amount_b_gbp": float(row["amount_b_gbp"]),
        "release_period": release_period or "Unknown release",
        "reference_period": reference_period or "Unknown reference period",
        "source_url": row["source_url"],
    }
