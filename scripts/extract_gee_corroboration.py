import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


SITES = {
    "stillwater": (36.118, -97.091),
    "goodwell": (36.597, -101.618),
    "narrabri": (-30.325, 149.783),
    "cordoba": (37.888, -4.779),
    "fresno_comparison": (36.737, -119.787),
    "munich_comparison": (48.135, 11.582),
}
CATALOG = {
    "smap": "NASA/SMAP/SPL4SMGP/008",
    "gldas": "NASA/GLDAS/V021/NOAH/G025/T3H",
    "modis": "MODIS/061/MOD13A2",
}


def month_windows(start, end):
    begin = pd.Timestamp(start)
    finish = pd.Timestamp(end)
    if begin >= finish:
        raise ValueError("End must be after start (exclusive)")
    while begin < finish:
        boundary = (begin + pd.offsets.MonthBegin(1)).normalize()
        stop = min(boundary, finish)
        yield begin.strftime("%Y-%m-%d"), stop.strftime("%Y-%m-%d")
        begin = stop


def _bands(image, dataset):
    if dataset == "smap":
        return image.select(["sm_surface_wetness", "sm_rootzone_wetness"], ["surface_wetness", "rootzone_wetness"])
    if dataset == "gldas":
        shallow = image.select("SoilMoi0_10cm_inst").rename("shallow_0_10_kg_m2")
        root = (image.select("SoilMoi0_10cm_inst")
                .add(image.select("SoilMoi10_40cm_inst"))
                .add(image.select("SoilMoi40_100cm_inst"))
                .rename("root_0_100_kg_m2"))
        return shallow.addBands(root)
    quality = image.select("SummaryQA").lte(1)
    return image.select(["EVI", "NDVI"], ["EVI", "NDVI"]).multiply(0.0001).updateMask(quality)


def _reduce_month(ee, dataset, start, end, geometry, scale):
    collection = ee.ImageCollection(CATALOG[dataset]).filterDate(start, end).filterBounds(geometry)
    collection = collection.map(lambda image: _bands(image, dataset))
    if dataset == "modis":
        def per_image(image):
            values = image.reduceRegion(ee.Reducer.mean(), geometry, scale, maxPixels=10000000)
            return ee.Feature(None, values.set("date", image.date().format("YYYY-MM-dd")))
        features = ee.FeatureCollection(collection.toList(collection.size()).map(lambda obj: per_image(ee.Image(obj))))
    else:
        first = ee.Date(start)
        count = ee.Date(end).difference(first, "day").toInt()
        offsets = ee.List.sequence(0, count.subtract(1))

        def per_day(offset):
            day = first.advance(offset, "day")
            subset = collection.filterDate(day, day.advance(1, "day"))
            values = ee.Dictionary(ee.Algorithms.If(
                subset.size().gt(0),
                subset.mean().reduceRegion(ee.Reducer.mean(), geometry, scale, maxPixels=10000000),
                ee.Dictionary(),
            ))
            return ee.Feature(None, values.set("date", day.format("YYYY-MM-dd")).set("n_images", subset.size()))

        features = ee.FeatureCollection(offsets.map(per_day))
    result = features.getInfo()
    return [f["properties"] for f in result.get("features", [])]


def extract(dataset, site, start, end, project, output, buffer_meters=25000):
    if site not in SITES or dataset not in CATALOG:
        raise ValueError("Unsupported site or dataset")
    if not project:
        raise ValueError("Earth Engine requires a Google Cloud project ID")
    import ee
    try:
        ee.Initialize(project=project)
    except Exception as exc:
        raise RuntimeError("Earth Engine initialization failed; authenticate with ee.Authenticate() and register the Cloud project") from exc
    latitude, longitude = SITES[site]
    geometry = ee.Geometry.Point([longitude, latitude]).buffer(buffer_meters)
    scale = {"smap": 11000, "gldas": 27830, "modis": 1000}[dataset]
    rows = []
    for first, last in month_windows(start, end):
        print(f"Extracting {dataset} {site}: {first} to {last} (exclusive)", flush=True)
        rows.extend(_reduce_month(ee, dataset, first, last, geometry, scale))
    if not rows:
        raise RuntimeError("No Earth Engine images returned; check the dates and product availability")
    frame = pd.DataFrame(rows)
    if "n_images" in frame.columns:
        frame = frame.loc[frame["n_images"].fillna(0) > 0].drop(columns=["n_images"])
    if frame.empty:
        raise RuntimeError("All daily observations were missing")
    frame = frame.drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
    folder = Path(output)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{site}_{dataset}_{start}_{end}.csv"
    frame.to_csv(path, index=False)
    record = {
        "status": "DERIVED_EARTH_ENGINE_EXPORT_NOT_ARCHIVE_RAW_FILE",
        "dataset": CATALOG[dataset],
        "site": site,
        "coordinates": {"latitude": latitude, "longitude": longitude},
        "buffer_radius_m": buffer_meters,
        "scale_requested_m": scale,
        "start_inclusive": start,
        "end_exclusive": end,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "cloud_project": project,
        "csv_path": str(path),
        "csv_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "rows": int(len(frame)),
        "note": "A circular buffer does not exactly match the native POWER grid cell. Scientific comparability requires footprint and temporal alignment checks.",
    }
    manifest = path.with_suffix(".manifest.json")
    manifest.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    p = argparse.ArgumentParser(description="Small, batched Google Earth Engine corroboration export")
    p.add_argument("--dataset", choices=CATALOG, default="smap")
    p.add_argument("--site", choices=SITES, default="stillwater")
    p.add_argument("--start", default="2022-01-01")
    p.add_argument("--end", default="2023-01-01")
    p.add_argument("--project", default=os.getenv("GOOGLE_CLOUD_PROJECT"))
    p.add_argument("--output", default="data/gee")
    p.add_argument("--buffer-meters", type=int, default=25000)
    args = p.parse_args()
    if args.buffer_meters <= 0:
        p.error("--buffer-meters must be positive")
    print(extract(args.dataset, args.site, args.start, args.end, args.project, args.output, args.buffer_meters))


if __name__ == "__main__":
    main()
