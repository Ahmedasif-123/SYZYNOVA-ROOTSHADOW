import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from rootshadow.recovery import (_first_sustained, _runs, detect_recovery, empirical_lag_review,  # noqa: E402,F401
                                 seasonal_percentiles_fixed)


def load_csv(path):
    frame = pd.read_csv(path, parse_dates=["date"]).set_index("date").sort_index()
    if frame.index.has_duplicates:
        raise ValueError("Input CSV contains duplicate dates")
    return frame.asfreq("D")


def screen_csv(path, baseline_start=1991, baseline_end=2020):
    raw = load_csv(path)
    frame = pd.DataFrame(index=raw.index)
    frame["top_pct"] = seasonal_percentiles_fixed(raw["GWETTOP"], baseline_start, baseline_end)
    frame["root_pct"] = seasonal_percentiles_fixed(raw["GWETROOT"], baseline_start, baseline_end)
    events = detect_recovery(frame)
    return {
        "status": "EXPLORATORY_SCREENING_NOT_VALIDATED",
        "input_file": str(path),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "baseline": {"start_year": baseline_start, "end_year": baseline_end, "calendar_window_days": 15},
        "criteria": {"preceding_root_drought_percentile": 20, "drought_persistence_days": 30, "surface_root_same_recovery_percentile": 40, "recovery_persistence_days": 7},
        "event_count": len(events),
        "events": events,
        "normal_lag_review": empirical_lag_review(events),
        "quality": {"paired_valid_days": int(frame.notna().all(axis=1).sum()), "total_days": int(len(frame))},
        "warnings": ["No validated historical finding or significance claim follows from this screening alone", "Model-inherent recovery lag has not been ruled out", "Surrogates, negative controls, independent datasets, trend inference and censoring-aware statistical analysis remain outstanding"],
    }


def main():
    parser = argparse.ArgumentParser(description="Exploratory recovery-delay screening on verified NASA POWER CSV")
    parser.add_argument("csv", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--full", action="store_true", help="run trend, surrogate-null and sensitivity audit")
    args = parser.parse_args()
    if args.full:
        from rootshadow.analysis import analyze
        output = analyze(load_csv(args.csv), {"mode": "csv", "input_file": str(args.csv)})
    else:
        output = screen_csv(args.csv)
    serialized = json.dumps(output, indent=2, allow_nan=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)


if __name__ == "__main__":
    main()
