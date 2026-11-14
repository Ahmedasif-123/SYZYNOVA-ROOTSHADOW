from .analysis import analyze
from .data import list_sites, load_site, obtain_nasa, synthetic_demo, validate_request


def run_analysis(mode="demo", latitude=36.78, longitude=-119.42, start="1981-01-01", end="2025-12-31", site=None, cache_dir=None, n_surrogates=200):
    if mode not in ("demo", "live", "site"):
        raise ValueError("mode must be 'demo', 'live' or 'site'")
    location = None
    if mode == "demo":
        frame, meta = synthetic_demo()
    elif mode == "site":
        if not site:
            raise ValueError("site is required for mode=site")
        frame, meta = load_site(site)
        location = {"latitude": meta["latitude"], "longitude": meta["longitude"], "site": site}
    else:
        validate_request(latitude, longitude, start, end)
        frame, meta = obtain_nasa(latitude, longitude, start, end, cache_dir=cache_dir)
        location = {"latitude": latitude, "longitude": longitude}
    output = analyze(frame, meta, n_surrogates=n_surrogates)
    output["location"] = location
    output["scientific_validation_status"] = (
        "Simulated data cannot support scientific claims" if mode == "demo"
        else "Single-site POWER screening; independent corroboration (SMAP, GLDAS, stations, MODIS) is still required")
    return output


def available_sites():
    return sorted(list_sites())
