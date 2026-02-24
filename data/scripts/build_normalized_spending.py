#!/usr/bin/env python3
"""Build normalized spending parquet snapshots from Phase 1 processed CSVs."""

from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq


ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
NORMALIZED = ROOT / "data" / "normalized"


def slugify(text: str) -> str:
    s = text.strip().lower()
    s = re.sub(r"^[0-9]+(\.[0-9]+)?\s*", "", s)
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


def parse_year_label(label: str) -> int:
    text = label.strip()
    if "-" in text:
        return int(text.split("-")[0])
    if "to" in text:
        return int(text.split("to")[0].strip())
    return int(text)


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def normalize_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []

    for r in read_rows(PROCESSED / "functional_spending_2024_25.csv"):
        if r["row_type"] not in {"sub_function", "function_total"}:
            continue
        amount = r["amount_m_gbp"]
        if amount in ("", None):
            continue
        rows.append(
            {
                "year": parse_year_label(r["year"]),
                "geography": "United Kingdom",
                "level": "national",
                "function": slugify(r["function_label"]),
                "department": None,
                "amount_m_gbp": float(amount),
                "source_table": r["source_table"],
            }
        )

    for r in read_rows(PROCESSED / "departmental_spending_2024_25.csv"):
        if r["row_type"] != "line_item":
            continue
        amount = r["amount_m_gbp"]
        if amount in ("", None):
            continue
        rows.append(
            {
                "year": parse_year_label(r["year"]),
                "geography": "United Kingdom",
                "level": "national",
                "function": None,
                "department": slugify(r["department_label"]),
                "amount_m_gbp": float(amount),
                "source_table": r["source_table"],
            }
        )

    for r in read_rows(PROCESSED / "ons_regional_expenditure_fye2023.csv"):
        amount = r["amount_m_gbp"]
        if amount in ("", None):
            continue
        rows.append(
            {
                "year": parse_year_label(r["year"]),
                "geography": r["geography_code"],
                "level": "region_or_country",
                "function": "total_managed_expenditure",
                "department": None,
                "amount_m_gbp": float(amount),
                "source_table": r["source_table"],
            }
        )

    return rows


def write_snapshots(rows: list[dict[str, object]]) -> None:
    by_year: dict[int, list[dict[str, object]]] = defaultdict(list)
    for r in rows:
        by_year[int(r["year"])].append(r)

    NORMALIZED.mkdir(parents=True, exist_ok=True)
    for year, year_rows in sorted(by_year.items()):
        table = pa.Table.from_pylist(year_rows)
        out = NORMALIZED / f"spending_{year}.parquet"
        pq.write_table(table, out, compression="snappy")
        print(f"Wrote {out} ({len(year_rows)} rows)")


def main() -> None:
    rows = normalize_rows()
    write_snapshots(rows)


if __name__ == "__main__":
    main()
