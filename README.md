# Where Your Taxes Go (UK)

Interactive project to estimate a UK taxpayer's contribution and map it to public spending categories and regional redistribution.

## Scope (MVP)

- Tax estimate from user inputs (income, region, household basics)
- Spending attribution by function and department
- Regional redistribution view (contribution vs spending received)
- Public methodology and data-source transparency

## Initial Stack Decisions

- Data pipeline: Python
- API: FastAPI
- Frontend: Next.js + D3
- Database: PostgreSQL

## Monorepo Structure

- `data/`: ETL, source ingestion, normalization jobs
- `api/`: FastAPI service and domain logic
- `web/`: Next.js frontend
- `infra/`: deployment and operational config
- `docs/`: methodology, source notes, architecture records

## Next Step

Build Phase 1 data-source inventory in `docs/data-sources.md`.

## Phase 1 Commands

- Download validated Treasury source files:
  - `./scripts/fetch_phase1_sources.sh`
- Extract Phase 1 functional and departmental snapshots:
  - `uv run --with openpyxl python data/scripts/extract_hmt_phase1.py`
- Extract ONS regional snapshots and council-region mapping:
  - `uv run --with openpyxl python data/scripts/extract_ons_phase1.py`
- Build unified normalized spending parquet snapshots:
  - `uv run --with pyarrow python data/scripts/build_normalized_spending.py`

## API Commands

- Run API:
  - `uv run uvicorn api.main:app --reload`
- Example endpoints:
  - `POST /tax/estimate`
  - `POST /spending/breakdown`
  - `POST /services/impact` (paginated)
  - `POST /regional/flows` (paginated)

## Regional Model Commands

- Build precomputed regional balances and flows:
  - `uv run python data/scripts/build_regional_flows.py`
- Fetch official ONS borrowing benchmark (PSNB ex):
  - `uv run python data/scripts/fetch_official_borrowing.py`
