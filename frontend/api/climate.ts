import { sites } from "../src/lib/sites";

export const maxDuration = 60;

type ClimateMonth = { month: string; t2m: number; precip: number };
type Scenario = "ssp126" | "ssp245" | "ssp370";
const HIST = "https://power.larc.nasa.gov/api/temporal/monthly/point";
const FUTURE = "https://power.larc.nasa.gov/api/projection/monthly/point";

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, s-maxage=86400, stale-while-revalidate=604800" : "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function readSeries(raw: unknown, key: "T2M" | "PRECTOTCORR", scenario?: Scenario): Record<string, number> {
  const body = raw as { properties?: { parameter?: Record<string, unknown> } };
  const field = body?.properties?.parameter?.[key];
  if (!field || typeof field !== "object" || Array.isArray(field)) throw new Error("Missing NASA parameter " + key);
  const data = scenario ? (field as Record<string, unknown>)[scenario] : field;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Missing NASA scenario " + scenario);
  const entries: Record<string, number> = {};
  for (const [date, value] of Object.entries(data)) {
    if (!/^\d{6}$/.test(date)) continue;
    if (typeof value === "number" && Number.isFinite(value) && value > -900 && value < 10000) entries[date] = value;
  }
  return entries;
}

function paired(raw: unknown, scenario?: Scenario): ClimateMonth[] {
  const temp = readSeries(raw, "T2M", scenario);
  const rain = readSeries(raw, "PRECTOTCORR", scenario);
  return Object.keys(temp).filter(month => month in rain)
    .sort()
    .map(month => ({ month: month.slice(0, 4) + "-" + month.slice(4), t2m: temp[month], precip: rain[month] }))
    .filter(row => row.t2m > -90 && row.t2m < 75 && row.precip >= 0 && row.precip < 200);
}

async function getPower(url: URL): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(48000) });
  if (!response.ok) throw new Error("NASA POWER returned HTTP " + response.status);
  return await response.json();
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("siteId");
  const rawScenario = url.searchParams.get("scenario") ?? "ssp245";
  if (rawScenario !== "ssp126" && rawScenario !== "ssp245" && rawScenario !== "ssp370") return reply({ error: "Invalid climate scenario" }, 400);
  const scenario: Scenario = rawScenario;
  const site = sites.find(item => item.id === id);
  if (!site) return reply({ error: "Choose one of the 97 supported model locations." }, 400);

  const [lon, lat] = site.coordinates;
  const shared = {
    parameters: "T2M,PRECTOTCORR",
    community: "AG",
    longitude: String(lon),
    latitude: String(lat),
    format: "JSON"
  };
  const past = new URL(HIST);
  for (const [key, value] of Object.entries(shared)) past.searchParams.set(key, value);
  past.searchParams.set("start", "1981");
  past.searchParams.set("end", "2025");

  const future = new URL(FUTURE);
  for (const [key, value] of Object.entries(shared)) future.searchParams.set(key, value);
  future.searchParams.set("start", "201501");
  future.searchParams.set("end", "205512");
  future.searchParams.set("scenario", scenario);
  future.searchParams.set("model", "ensemble");
  future.searchParams.set("time-standard", "UTC");

  try {
    const [rawPast, rawFuture] = await Promise.all([getPower(past), getPower(future)]);
    const history = paired(rawPast).filter(row => row.month >= "1981-01" && row.month <= "2025-12");
    const projection = paired(rawFuture).filter(row => row.month >= "2015-01" && row.month <= "2055-12");
    if (history.length < 480 || projection.length < 400) {
      return reply({ error: "NASA climate dataset is incomplete at this grid point. No projection has been generated.",
        historyMonths: history.length, scenarioMonths: projection.length }, 503);
    }
    return reply({
      schema: 1,
      siteId: site.id,
      scenario,
      historicalStart: "1981-01",
      historicalEnd: "2025-12",
      climateEnsemble: "NASA NEX-GDDP-CMIP6",
      history,
      projection,
      coordinates: { lon, lat },
      variables: { t2m: "°C", precip: "mm/day, monthly mean" },
      sources: {
        historical: past.toString(),
        future: future.toString(),
        documentation: "https://power.larc.nasa.gov/docs/services/api/projection/"
      },
      caution: "CMIP6 scenarios are possible climate pathways, not observed future conditions. Model grid cells are not farm measurements."
    });
  } catch {
    return reply({ error: "NASA POWER climate inputs could not be retrieved. Future climate estimates are withheld." }, 503);
  }
}
