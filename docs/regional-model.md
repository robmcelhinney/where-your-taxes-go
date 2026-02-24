# Regional Redistribution Model

## Inputs

- `data/processed/ons_regional_revenue_fye2023.csv`
- `data/processed/ons_regional_expenditure_fye2023.csv`

## Coverage

- English regions (`E12000001` to `E12000009`)
- Wales (`W92000004`)
- Scotland (`S92000003`)
- Northern Ireland (`N92000002`)

## Computations

- `regional tax contribution`: from ONS total current receipts (excl. North Sea Oil & Gas)
- `regional spending received`: from ONS total managed expenditure
- `net balance`: contribution minus spending
- `flow dataset`: surplus regions (donors) to deficit regions (recipients), allocated proportionally by surplus and deficit share

## Precomputed outputs

- `data/processed/regional_balances_2022_2023.csv`
- `data/processed/flows_2022_2023.csv`

Build command:

```bash
uv run python data/scripts/build_regional_flows.py
```
