# Web

Sleek single-page frontend for Phase 7 UI.

## Run (Static-First)

1. Build frontend data bundle:

```bash
python3 data/scripts/build_frontend_bundle.py
```

2. Serve web folder:

```bash
cd web
python3 -m http.server 4173
```

3. Open:

- http://127.0.0.1:4173

By default the page runs in local mode (`API base URL = local`) and computes everything client-side from `web/data/frontend_bundle.json`.

Optional backend mode:
- Start API: `uv run uvicorn api.main:app --reload`
- Set API base URL in the UI to `http://127.0.0.1:8000`

UI includes:
- methodology and data attribution sections
- shareable links and social sharing
- household modelling + marriage allowance toggle
- historical tax-year comparison
- policy simulation controls
- journalist export downloads (JSON + CSV)
