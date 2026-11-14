import json

import azure.functions as func

from rootshadow.service import available_sites, run_analysis

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="analyze", methods=["GET"])
def analyze_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    try:
        query = req.params
        result = run_analysis(
            mode=query.get("mode", "demo"),
            latitude=float(query.get("lat", "36.78")),
            longitude=float(query.get("lon", "-119.42")),
            start=query.get("start", "1981-01-01"),
            end=query.get("end", "2025-12-31"),
            site=query.get("site"),
        )
        return func.HttpResponse(json.dumps(result, allow_nan=False), status_code=200, mimetype="application/json")
    except (ValueError, TypeError) as exc:
        return func.HttpResponse(json.dumps({"error": str(exc)}), status_code=400, mimetype="application/json")
    except Exception as exc:
        return func.HttpResponse(json.dumps({"error": str(exc)}), status_code=503, mimetype="application/json")


@app.route(route="sites", methods=["GET"])
def sites_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(json.dumps({"sites": available_sites()}), status_code=200, mimetype="application/json")
