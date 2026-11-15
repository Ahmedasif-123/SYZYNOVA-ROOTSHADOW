# ROOTSHADOW — The Drought Beneath the Rain

**Team:** SYZYNOVA — Muhammad Ahmed and Somaya Bakir
**Event:** NASA Space Apps Challenge Doha 2026
**Official challenge:** Be An Earth System Trend Detective!
**Production application:** https://rootshadow-frontend-preview.vercel.app/
**Source:** https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/tree/interactive-evidence-labs-2026

## Question and problem

Rain and visible surface recovery do not necessarily imply that deeper soil moisture has recovered. ROOTSHADOW investigates this difference in historical NASA model output and helps users identify when independent farm-scale measurements would be informative.

## Developed solution

A working research decision-support prototype covering 97 selected NASA POWER/MERRA-2 model points, with 1981–2025 historical depth-aware analysis, geographic comparison, statistical sensitivity checks, evidence-grounded AI, experimental short-horizon ML scenarios, and a Decision Desk.

Decision Desk leads users from a **modeled screening flag** to a **field verification worksheet**: enter before/after volumetric-water-content probe readings at 30 cm and 60 cm, independently established soil/crop thresholds and sensor uncertainty. It calculates conditional results (not recovered, recovered at the two sampled depths, already adequate, or unclear), produces verification steps, compares model and probe evidence, and supports opt-in local export. It does **not** prescribe irrigation amounts or certify when reducing irrigation is safe.

## Findings and uncertainty

The original six selected research model points contained **158 candidate drought episodes**, including **73 completed surface-first recoveries (46.2%)**. This fraction is not global, is not calculated across all 97 points, and does not establish causal climate change or effects on farms.

A 200-surrogate Goodwell null-model comparison found a modeled median recovery lag of 2.00 days against a simple linear-lag surrogate mean median of 1.35 days (descriptive one-sided p = 0.264). This single-site example demonstrates why ordinary model smoothing must be considered; it does not test the pooled 73/158 fraction against a null.

Independent NOAA USCRN probe validation covers **four Oklahoma stations near two model locations**, not every site. The model's mismatch flag detected only **6.7–10.5%** of measured mismatch days, with **15.8–27.8% precision**, across the four stations. Root-low recall was higher (67–89%). These results are not field-level accuracy guarantees. No Qatar irrigated-field pilot has been performed.

## Experimental machine learning

The ML Outlook displays 5- and 10-year *illustrative scenarios*. A historical-only autoregressive approach is compared with a climate-driven ridge regression using temperature and precipitation. The climate-aware 2016–2025 retrospective evaluation uses **actual observed historical weather**, not a prediction of that weather, so holdout error does not validate future weather or soil-moisture forecasting skill. NASA NEX-GDDP-CMIP6 is used where available, with separately labeled Open-Meteo HighResMIP alternatives where NASA projection records are missing.

## Technology and provenance

React, TypeScript, Vite, ECharts, Python scientific analysis, Vercel Node serverless endpoints, OpenAI Responses API, source-dated NASA POWER/MERRA-2 data and NOAA USCRN probe comparisons. Source references, raw-research results, limitations and reproducibility tests are in the repository.

## Users and next validation

Researchers, agronomists and public agricultural planners can investigate modeled soil-layer mismatches and design field checks. Future evaluation requires more independent probe data, field representativeness studies, calibrated crop/soil thresholds, irrigated-field pilots and prospective testing. **No water savings, yields, operational drought alert reliability or farm-management outcomes have been demonstrated.**

## Pre-submission checks

- [ ] Confirm team registration and current organizer submission requirements.
- [x] Include sourced historical NASA model case studies and methods.
- [x] Disclose four-station NOAA precision/recall and the null-model limitations.
- [x] Keep AI secondary to the deterministic field verification result.
- [ ] Verify both production AI endpoints return complete real responses.
- [ ] Confirm current Vercel production is READY and frontend Playwright checks pass.
- [ ] Confirm submitted GitHub source points to the active branch.
- [ ] Upload the required submission assets and include NASA POWER attribution.
- [ ] Submit before Sunday, 15 November 2026, 17:00 Doha time.
