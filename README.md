# Where Your Taxes Go (UK)

Interactive project to estimate a UK taxpayer's contribution and map it to public spending categories and regional redistribution.

## What It Does

- Estimates UK tax footprint from salary and assumptions
- Allocates estimated contribution across public spending functions
- Shows regional redistribution and borrowing context
- Supports household modelling, year comparisons, policy simulation, and export flows

## Stack

- Data pipeline: Python scripts
- API: FastAPI
- Frontend: static HTML/CSS/JS (`web/`)

## Monorepo Structure

- `data/`: ETL, source ingestion, normalization jobs
- `api/`: FastAPI service and domain logic
- `web/`: frontend app
- `infra/`: deployment and operational config
- `docs/`: methodology, source notes, architecture records

## Data Commands

- Download validated Treasury source files:
    - `./scripts/fetch_phase1_sources.sh`
- Extract Phase 1 functional and departmental snapshots:
    - `uv run --with openpyxl python data/scripts/extract_hmt_phase1.py`
- Extract ONS regional snapshots and council-region mapping:
    - `uv run --with openpyxl python data/scripts/extract_ons_phase1.py`
- Build unified normalized spending parquet snapshots:
    - `uv run --with pyarrow python data/scripts/build_normalized_spending.py`
- Build precomputed regional balances and flows:
    - `uv run python data/scripts/build_regional_flows.py`
- Fetch official ONS borrowing benchmark (PSNB ex):
    - `uv run python data/scripts/fetch_official_borrowing.py`

## Run API

`uv run uvicorn api.main:app --reload`

## Run Web

```bash
cd web
python3 -m http.server 4173
```

Open: `http://127.0.0.1:4173`

## Main API Endpoints

- `POST /tax/estimate`
- `POST /spending/breakdown`
- `POST /services/impact`
- `POST /regional/flows`
- `POST /journalist/export`
- `GET /public/meta`
- `GET /health`
