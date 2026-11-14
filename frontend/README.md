# ROOTSHADOW — Hybrid Intelligence Frontend

This is a separate React 19 + TypeScript frontend for the existing, tested ROOTSHADOW FastAPI scientific service. It does not modify the Python analytics. The design blends Dark Earth Intelligence (charcoal/teal) and Aerospace Precision (navy/cyan) while prioritizing understandable historical evidence for farmers.

## Prerequisites

Node.js 20.19+ or 22.12+, Python and the existing ROOTSHADOW root dependencies.

## Local development

From the repository root:

```bash
pip install -r requirements.txt
uvicorn local_server:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run typecheck
npm run dev
```

Open http://localhost:5173. Vite proxies `/api/*` to the unchanged local FastAPI service on port 8000.

## Build

```bash
cd frontend
npm install
npm run build
npm run preview
```

The production build is emitted to `frontend/dist`. The latest six-site source is on `farm-decision-clarity-six-sites`. Its tested, self-contained static build is published to `gh-pages`; public GitHub Pages activation must be checked separately. Vercel preview deployments exist, but the most recent successful frontend preview may lag behind this branch; do not present a preview as the current build without checking its commit.

## Important design and data constraints

- Startup loads only `mode=site` verified NASA POWER/MERRA-2 snapshots through `/api/analyze`. No fake figures or demo-mode substitution.
- A research site is a gridded model point, not a farm boundary or ground sensor.
- The interactive monthly plot uses the API's monthly median percentile series; event dates derive from the API's daily event detector. Do not infer daily values from the monthly graph.
- The Evidence Auditor has custom exploratory decision rules; its labels are not scientific certifications.
- A location and event selector, a research mode, an event inspector, trend visualization, sensitivity heatmap, site comparison, and JSON evidence export are implemented.
- The flat map, geographic geometry, Earth texture, and six static research snapshots are bundled locally in the fallback build. External font downloads are optional; they are not scientific data dependencies.
- No forecast or irrigation recommendation is made.

## Stack

React, TypeScript, Vite, Apache ECharts, MapLibre GL JS, Motion, TanStack Query, Zod and Lucide. CSS uses a custom design-token system with reduced-motion and responsive breakpoints.
