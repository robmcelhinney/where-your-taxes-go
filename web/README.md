# Web

Sleek single-page frontend for Phase 7 UI.

## Run

1. Start API:

```bash
uv run uvicorn api.main:app --reload
```

2. Serve web folder:

```bash
cd web
python3 -m http.server 4173
```

3. Open:

- http://127.0.0.1:4173

The page calls API endpoints:

- `POST /tax/estimate`
- `POST /spending/breakdown`
- `POST /services/impact`
- `POST /regional/flows`
- `POST /journalist/export`
- `GET /public/meta`

UI includes:
- methodology and data attribution sections
- shareable links and social sharing
- household modelling + marriage allowance toggle
- historical tax-year comparison
- policy simulation controls
- journalist export downloads (JSON + CSV)
