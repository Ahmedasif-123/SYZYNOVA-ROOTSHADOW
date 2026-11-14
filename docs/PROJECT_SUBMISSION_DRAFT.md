# ROOTSHADOW — The Drought Beneath the Rain

Team: SYZYNOVA
Event: NASA Space Apps Challenge Doha 2026
Challenge: Be An Earth System Trend Detective!

## Problem

After a drought, an increase in rainfall or surface moisture does not necessarily imply that deeper root-zone moisture has recovered. Single-variable summaries can therefore mask incomplete environmental recovery.

## Proposed solution

ROOTSHADOW is a transparent analysis system that compares depth-specific seasonal soil-wetness anomalies from NASA POWER, identifies periods of disagreement following dry spells, and investigates whether these periods exhibit temporal trends. It includes data provenance, checksum verification and network-failure handling.

## Scientific methodology

See the README for baseline definitions, percentile thresholds, post-drought mismatch criteria, Theil–Sen slope estimation, Kendall tau trend testing and limitations.

## Current evidence status

The project can run on clearly identified synthetic test data. Real NASA case-study measurements must be acquired, verified and included before scientific conclusions are submitted.

## Implementation

Python, NumPy, Pandas, SciPy, FastAPI, JavaScript, SVG charts, Azure Static Web Apps, Azure Functions and GitHub Actions.

## Intended benefits

Environmental scientists and decision-support teams could investigate whether drought recovery is consistent across observed moisture layers. The prototype is not an operational forecasting or farm-level advisory system.

## Submission checklist

- [ ] Confirm all team members are Registered for Doha.
- [ ] Pull and verify real NASA POWER observations.
- [ ] Independently validate a historical candidate event.
- [ ] Record source URLs, dates, methods, uncertainty and NASA data attribution.
- [ ] Publish permitted project code and an accessible demo.
- [ ] Prepare a maximum-seven-slide deck or 30-second video.
- [ ] Submit by the local Sunday 5 PM deadline.
