# Normalized Spending Schema

This schema is used for cross-source spending attribution inputs.

## Canonical table

`spending`

Columns:
- `year` (int): snapshot year key (for example `2024` for `2024-25`)
- `geography` (string): geography code or name (`K02000001`, `E12000001`, etc.)
- `level` (string): `national` or `region_or_country`
- `function` (string, nullable): standardized spending function slug
- `department` (string, nullable): standardized department slug
- `amount_m_gbp` (float): amount in nominal GBP millions
- `source_table` (string): source lineage identifier

## Standardization rules

- Function/department labels are normalized to lowercase slugs.
- Numeric prefixes and footnote markers are removed from category labels.
- Missing amounts are dropped during normalization.
- Financial year labels are converted to a numeric year key (`2024-25` -> `2024`, `2022 to 2023` -> `2022`).

## Snapshot outputs

- `data/normalized/spending_2022.parquet`
- `data/normalized/spending_2024.parquet`

Built by:
- `data/scripts/build_normalized_spending.py`
