#!/usr/bin/env python3
"""Fetch official UK borrowing (PSNB ex) from ONS bulletin text."""

from __future__ import annotations

import csv
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "official_uk_borrowing.csv"

# ONS Public sector finances bulletin (January 2026 release).
SOURCE_URL = "https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/january2026"
PATTERN = re.compile(
    r"borrowed £([0-9]+(?:\.[0-9]+)?) billion in the financial year ending \(FYE\) March ([0-9]{4})",
    re.IGNORECASE,
)
RELEASE_SLUG_PATTERN = re.compile(
    r"^(january|february|march|april|may|june|july|august|september|october|november|december)([0-9]{4})$",
    re.IGNORECASE,
)


def extract_release_period_from_url(source_url: str) -> str:
    slug = urlparse(source_url).path.rstrip("/").split("/")[-1]
    match = RELEASE_SLUG_PATTERN.match(slug)
    if not match:
        return slug
    month = match.group(1).capitalize()
    year = match.group(2)
    return f"{month} {year}"


def main() -> None:
    req = Request(
        SOURCE_URL,
        headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"},
    )
    html = urlopen(req, timeout=30).read().decode("utf-8", errors="ignore")
    match = PATTERN.search(html)
    if not match:
        raise RuntimeError("Could not parse official borrowing figure from ONS bulletin")

    amount_b = float(match.group(1))
    year = int(match.group(2))
    release_period = extract_release_period_from_url(SOURCE_URL)
    reference_period = f"FYE March {year}"
    retrieved_at = datetime.now(timezone.utc).isoformat()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "metric",
                "release_period",
                "reference_period",
                "amount_b_gbp",
                "source_url",
                "retrieved_at_utc",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "metric": "psnb_ex_fye",
                "release_period": release_period,
                "reference_period": reference_period,
                "amount_b_gbp": f"{amount_b:.1f}",
                "source_url": SOURCE_URL,
                "retrieved_at_utc": retrieved_at,
            }
        )
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
