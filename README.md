# ROOTSHADOW — The Drought Beneath the Rain

**SYZYNOVA | NASA Space Apps Challenge Doha 2026 | Muhammad Ahmed and Somaya Bakir**

ROOTSHADOW investigates whether apparent recovery in surface soil moisture can conceal continued root-zone water stress after drought, using NASA POWER gridded environmental data.

## Scientific question

After an identified drought, how long does root-zone wetness stay below the seasonal threshold after surface wetness has recovered (the *recovery delay*), and has that delay changed over 1981–2025?

## What works

- **Fixed-baseline recovery lag** (`api/rootshadow/recovery.py`): 1991–2020 seasonal percentiles; drought = root zone ≤ 20th percentile for 30+ days; each layer's first sustained recovery uses the *same* 40th-percentile threshold; censored delays are lower bounds.
- **Trend tests** (`trend.py`, `recovery.event_lag_trend`): primary Theil–Sen/Kendall trend of completed delays; secondary annual mismatch days with Hamed–Rao corrected Mann–Kendall and block-bootstrap CI.
- **Surrogate null model** (`null_model.py`): compares observed delay and slope to what a linear surface→root transfer fitted on the site's own model output produces (the model-circularity check).
- **Evidence Auditor** (`analysis.py`): 9-setting threshold sensitivity, rule-based verdict (INCONCLUSIVE / NO_SIGNIFICANT_TREND / TREND_NOT_ROBUST / TREND_SUPPORTED_EXPLORATORY). Thresholds in these rules are proposals, not scientific standards.
- **Data**: live NASA POWER (10-year chunks, SHA-256 snapshots, verified cache fallback), prefetched verified site snapshots from `scripts/gate0_fetch.py` (recommended for the demo), and a clearly labelled synthetic mode.
- Responsive UI, FastAPI local server, Azure Static Web Apps + Functions configuration, tests and CI.

**Not validated:** no real NASA data has been run through this build in the authoring environment. No statistical significance claim is scientifically established, and the surrogate calibration is exploratory. Independent corroboration (SMAP L4, GLDAS, NOAA stations, MODIS) is not implemented. The synthetic mode is not evidence.

## Recommended workflow

```bash
python scripts/gate0_fetch.py --site all --start-year 1981 --end-year 2025
python scripts/gate1_screen.py data/gate0/processed/<site>_1981_2025.csv --full --output out.json
mkdir -p api/data/gate0 && cp -r data/gate0/processed data/gate0/manifests api/data/gate0/   # for Azure deployment
```
Prefetched sites then appear in the UI under "Prefetched NASA site".

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn local_server:app --reload
```

Open `http://127.0.0.1:8000`.

The initial dashboard loads synthetic data. To retrieve NASA observations, select **Live NASA POWER data** and choose a location and date range. The first real request requires internet access and may take a while. NASA requests are limited to a single point and split into ten-year chunks. The 1991–2020 reference period must be adequately covered to support the seasonal comparison; shorter windows can produce insufficient-baseline errors.

Run tests:

```bash
pytest -q
```

## Azure deployment

1. Use the existing public repository `Ahmedasif-123/SYZYNOVA-ROOTSHADOW` on its `main` branch.
2. In Azure, create a **Static Web App**. Select the Free plan, the GitHub repository, and a custom build preset.
3. Use `web` as the app location and `api` as the API location; configure the generated action or use `.github/workflows/azure-static-web-apps.yml`.
4. Add the deployment token to the GitHub Actions secret `AZURE_STATIC_WEB_APPS_API_TOKEN` if using the supplied workflow. Never commit the token.
5. Verify a successful deployment, then test `/api/analyze?mode=demo` before testing the live API.
6. The supplied managed Functions runtime targets Python 3.10; confirm Azure's supported runtime when creating the resource. If native dependency builds exceed the managed API limit, deploy the Functions app separately and link it to the Static Web App, rather than changing scientific logic.

The built-in managed Functions service does not support every networking or identity feature offered by dedicated Azure Functions. This project does not claim to have private networking, Entra authorization, or managed identity enabled.

## Scientific method

See `method` in any API response and `docs/GATE1_SCREENING.md`. Known limits: POWER wetness is MERRA-2 model output; surface and root zone share one land model, so a lag alone is not evidence of an unusual event; reanalysis forcing changes can create spurious trends; Hamed–Rao reduces but does not eliminate false positives for short autocorrelated series.

## Reproducibility, licensing and attribution

The project is a research prototype. It is not a validated drought warning system. Annual incomplete-recovery days are attributed to the calendar year on which each mismatch day occurs; event counts are attributed to the year surface recovery begins. Null-model and autocorrelation tests are exploratory, and their nominal p-values must not be presented as calibrated evidence of a climatic trend.

The source code is published under the MIT license in `LICENSE`. NASA POWER provides the environmental input and must be cited in the project submission; dependency and AI-tool citations are in `docs/ATTRIBUTION_AND_AI.md`. No real NASA-derived case-study results are included in this source archive.

Cloud deployment is not active by default. The Azure workflow is manual (`workflow_dispatch`) until a deployment token is installed and verified.
