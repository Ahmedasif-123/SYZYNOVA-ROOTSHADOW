import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).resolve().parent / "api"))
from rootshadow.service import available_sites, run_analysis

app = FastAPI(title="ROOTSHADOW", version="0.1.0")
web = Path(__file__).resolve().parent / "web"
app.mount("/assets", StaticFiles(directory=str(web)), name="assets")


@app.get("/")
def home():
    return FileResponse(web / "index.html")


@app.get("/api/sites")
def sites():
    return {"sites": available_sites()}


@app.get("/api/analyze")
def analyze(mode: str = Query("demo"), lat: float = Query(36.78), lon: float = Query(-119.42), start: str = Query("1981-01-01"), end: str = Query("2025-12-31"), site: str = Query(None)):
    try:
        return run_analysis(mode=mode, latitude=lat, longitude=lon, start=start, end=end, site=site)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
