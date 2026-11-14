# Changes in the fixed build

1. NASA request: `PRECTOT` → `PRECTOT`, precipitation optional, automatic retry without it if POWER rejects the name (unverified against the live API in the authoring sandbox — run one real fetch first).
2. 30-year request cap removed; live requests are split into 10-year cached chunks (also fixed a bug where a short final chunk failed the 5-year minimum).
3. Old pooled-baseline 40/20 detector deleted. API and UI now use the fixed 1991–2020, same-threshold recovery-lag engine.
4. Trend: primary Theil–Sen/Kendall of recovery delays; secondary Hamed–Rao modified Mann–Kendall + block bootstrap on annual mismatch days (Theil–Sen is degenerate on zero-inflated annual counts, so OLS is the headline there).
5. Surrogate null model and 9-setting sensitivity grid feeding a rule-based Evidence Auditor with an explicit INCONCLUSIVE outcome.
6. Drought-gap bridging now only joins established dry spells (a first draft chained random dry days — caught by test).
7. `conftest.py` + `pytest.ini` fix test imports; `test_api.py` skips cleanly without FastAPI.
8. Prefetched-site mode (`mode=site`) with SHA-256 re-verification; `/api/sites`; `gate1_screen.py --full`.
9. Synthetic demo extended to 1981–2025 with AR(1) noise (still clearly labelled synthetic).
