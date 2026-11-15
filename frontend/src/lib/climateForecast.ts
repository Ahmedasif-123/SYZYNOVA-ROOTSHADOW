import type { AnnualPoint, ProjectionPoint } from "./forecast";

export type ClimateMonth = { month: string; t2m: number; precip: number };
export type ClimateScenario = "ssp126" | "ssp245" | "ssp370";
export type ClimateBundle = {
  schema: number;
  siteId: string;
  scenario: ClimateScenario;
  history: ClimateMonth[];
  projection: ClimateMonth[];
  sources: { historical: string; future: string; documentation: string };
  climateSource?: "nasa_nex_cmip6" | "open_meteo_highresmip";
  climateEnsemble?: string;
  maxProjectionYear?: number;
  caution?: string;
  variables: { t2m: string; precip: string };
};
type MoisturePair = { month: string; surface: number | null; root: number | null };
type Weather = { month: string; t2m: number; precip: number };
type Layer = "surface" | "root";
type Regression = { surface: number[]; root: number[] };
export type ClimateResult = {
  status: "ready" | "insufficient";
  historical: AnnualPoint[];
  future: { year: number; surface: ProjectionPoint; root: ProjectionPoint; temp: number; rain: number }[];
  errors: { surface: { climate: number; historyOnly: number; climatology: number; rmse: number }; root: { climate: number; historyOnly: number; climatology: number; rmse: number } };
  trainingPeriod: string;
  holdoutPeriod: string;
  overlapYears: number;
  biasNote: string;
  sampleMonths: number;
};

export async function getClimateBundle(siteId: string, scenario: ClimateScenario, signal?: AbortSignal): Promise<ClimateBundle> {
  const url = new URL("/api/climate", window.location.origin);
  url.searchParams.set("siteId", siteId);
  url.searchParams.set("scenario", scenario);
  const response = await fetch(url, { signal });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error((value as { error?: string })?.error ?? "NASA climate inputs unavailable.");
  const v = value as Partial<ClimateBundle>;
  if (v.schema !== 1 || v.siteId !== siteId || v.scenario !== scenario || !Array.isArray(v.history) || !Array.isArray(v.projection) || !v.sources) {
    throw new Error("NASA climate response failed integrity checks.");
  }
  return v as ClimateBundle;
}

const average = (items: number[]) => items.reduce((a, b) => a + b, 0) / items.length;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const indexMonth = (name: string) => Number(name.slice(5, 7)) - 1;

function solve(matrix: number[][], right: number[]): number[] {
  const n = right.length;
  const a = matrix.map((row, i) => [...row, right[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    if (Math.abs(a[pivot][i]) < 1e-9) return Array(n).fill(0);
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const div = a[i][i];
    for (let k = i; k <= n; k++) a[i][k] /= div;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const f = a[j][i];
      for (let k = i; k <= n; k++) a[j][k] -= f * a[i][k];
    }
  }
  return a.map(row => row[n]);
}

type Norms = { temp: number[]; rain: number[]; surface: number[]; root: number[] };
function normals(climate: Weather[], moisture: MoisturePair[]): Norms {
  return (["temp", "rain", "surface", "root"] as const).reduce((all, key) => {
    all[key] = Array.from({ length: 12 }, (_, month) => {
      const values = climate.slice(0, 420).flatMap((c, i) => {
        if (indexMonth(c.month) !== month) return [];
        const value = key === "temp" ? c.t2m : key === "rain" ? c.precip : moisture[i]?.[key];
        return typeof value === "number" && Number.isFinite(value) ? [value] : [];
      });
      return values.length ? average(values) : key === "temp" ? 20 : key === "rain" ? 1 : 50;
    });
    return all;
  }, {} as Norms);
}

function vector(prev: MoisturePair[], weather: Weather, norm: Norms, layer: Layer, includeClimate: boolean): number[] {
  const past = prev.at(-1) ?? { surface: 50, root: 50 };
  const own = past[layer] ?? 50;
  const other = past[layer === "surface" ? "root" : "surface"] ?? 50;
  const recent = prev.slice(-3).map(p => p[layer] ?? 50);
  const month = indexMonth(weather.month);
  const t = clamp((weather.t2m - norm.temp[month]) / 8, -3, 3);
  const p = clamp((weather.precip - norm.rain[month]) / Math.max(1, norm.rain[month]), -2, 4);
  return [1, (own - 50) / 50, (other - 50) / 50, (average(recent) - 50) / 50,
    includeClimate ? t : 0, includeClimate ? p : 0];
}

function train(climate: Weather[], moisture: MoisturePair[], norm: Norms, includeClimate: boolean, trainEnd = 420): Regression {
  const coefficients = (layer: Layer) => {
    const n = 6;
    const gram = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
    const rhs = Array(n).fill(0) as number[];
    for (let i = 3; i < trainEnd; i++) {
      const target = moisture[i]?.[layer];
      if (target === null || target === undefined || !Number.isFinite(target)) continue;
      const x = vector(moisture.slice(0, i), climate[i], norm, layer, includeClimate);
      for (let j = 0; j < n; j++) {
        rhs[j] += x[j] * (target - 50) / 50;
        for (let k = 0; k < n; k++) gram[j][k] += x[j] * x[k];
      }
    }
    for (let j = 0; j < n; j++) gram[j][j] += j === 0 ? 0.1 : 5;
    return solve(gram, rhs);
  };
  return { surface: coefficients("surface"), root: coefficients("root") };
}

function simulate(
  model: Regression,
  norm: Norms,
  initial: MoisturePair[],
  climate: Weather[],
  includeClimate: boolean
): MoisturePair[] {
  const history = [...initial];
  return climate.map(weather => {
    const forecast = (layer: Layer) => {
      const x = vector(history, weather, norm, layer, includeClimate);
      return clamp(50 + 50 * x.reduce((sum, xi, i) => sum + xi * model[layer][i], 0), 0, 100);
    };
    const point = { month: weather.month, surface: forecast("surface"), root: forecast("root") };
    history.push(point);
    return point;
  });
}

function climateCorrection(history: Weather[], projection: Weather[]): { future: Weather[]; overlapYears: number } {
  const known = new Map(history.filter(w => w.month >= "2015-01").map(w => [w.month, w]));
  const combined = projection.filter(p => p.month <= "2025-12").flatMap(p => {
    const h = known.get(p.month);
    return h ? [{ historic: h, projected: p }] : [];
  });
  if (combined.length < 96) return { future: [], overlapYears: 0 };
  const corrections = Array.from({ length: 12 }, (_, month) => {
    const same = combined.filter(x => indexMonth(x.historic.month) === month);
    const t = average(same.map(x => x.historic.t2m - x.projected.t2m));
    const historicalRain = average(same.map(x => x.historic.precip));
    const projectedRain = average(same.map(x => x.projected.precip));
    return { tempOffset: clamp(t, -12, 12), precipitationScale: clamp(historicalRain / Math.max(0.1, projectedRain), 0.25, 4) };
  });
  const future = projection.filter(p => p.month >= "2026-01").map(p => {
    const correction = corrections[indexMonth(p.month)];
    return { ...p, t2m: p.t2m + correction.tempOffset, precip: Math.max(0, p.precip * correction.precipitationScale) };
  });
  return { future, overlapYears: Math.floor(combined.length / 12) };
}

export function climateForecast(
  months: string[],
  rows: [number | null, number | null, number | null][],
  bundle: ClimateBundle,
  years: number
): ClimateResult {
  const empty: ClimateResult = { status: "insufficient", historical: [], future: [], errors: {
    surface: { climate: NaN, historyOnly: NaN, climatology: NaN, rmse: NaN },
    root: { climate: NaN, historyOnly: NaN, climatology: NaN, rmse: NaN }
  }, trainingPeriod: "1981–2015", holdoutPeriod: "2016–2025", overlapYears: 0, biasNote: "Not available", sampleMonths: 0 };
  if (![5, 10, 30].includes(years) || months.length !== rows.length) return empty;

  const historyByMonth = new Map(bundle.history.map(w => [w.month, w]));
  const moistureByMonth = new Map(months.map((month, i) =>
    [month, { month, surface: rows[i]?.[0] ?? null, root: rows[i]?.[1] ?? null }] as const));
  const climate: Weather[] = [];
  const moisture: MoisturePair[] = [];
  for (let year = 1981; year <= 2025; year++) {
    for (let month = 1; month <= 12; month++) {
      const date = year + "-" + String(month).padStart(2, "0");
      const weather = historyByMonth.get(date);
      const point = moistureByMonth.get(date);
      if (!weather || !point || point.surface === null || point.root === null || !Number.isFinite(point.surface) || !Number.isFinite(point.root)) return empty;
      climate.push(weather);
      moisture.push(point);
    }
  }
  const corrected = climateCorrection(climate, bundle.projection);
  const futureClimate = corrected.future.filter(item => item.month <= (2025 + years) + "-12");
  if (futureClimate.length !== years * 12 || corrected.overlapYears < 8) return empty;
  const norm = normals(climate, moisture);
  const training = moisture.slice(0, 420);
  const climateModel = train(climate, moisture, norm, true);
  const historicalModel = train(climate, moisture, norm, false);
  const holdoutClimate = climate.slice(420);
  const climatePred = simulate(climateModel, norm, training, holdoutClimate, true);
  const historyPred = simulate(historicalModel, norm, training, holdoutClimate, false);
  const errors = (layer: Layer) => {
    const truth = moisture.slice(420).map(row => row[layer] ?? 50);
    const climateDifferences = truth.map((v, i) => v - (climatePred[i][layer] ?? 50));
    const historicalDifferences = truth.map((v, i) => v - (historyPred[i][layer] ?? 50));
    const baselineDifferences = truth.map((v, i) => v - norm[layer][indexMonth(holdoutClimate[i].month)]);
    return {
      climate: average(climateDifferences.map(Math.abs)),
      historyOnly: average(historicalDifferences.map(Math.abs)),
      climatology: average(baselineDifferences.map(Math.abs)),
      rmse: Math.sqrt(average(climateDifferences.map(x => x * x)))
    };
  };
  const metrics = { surface: errors("surface"), root: errors("root") };
  const productionModel = train(climate, moisture, norm, true, 540);
  const projected = simulate(productionModel, norm, moisture, futureClimate, true);
  const historical = Array.from({ length: 45 }, (_, i) => {
    const year = 1981 + i;
    const same = moisture.filter(m => m.month.startsWith(String(year)));
    return { year, surface: average(same.map(m => m.surface ?? 50)), root: average(same.map(m => m.root ?? 50)) };
  });
  const future = Array.from({ length: years }, (_, i) => {
    const year = 2026 + i;
    const same = projected.filter(m => m.month.startsWith(String(year)));
    const yearWeather = futureClimate.filter(m => m.month.startsWith(String(year)));
    const toPoint = (layer: Layer): ProjectionPoint => {
      const estimate = average(same.map(m => m[layer] ?? 50));
      const spread = Math.max(6, metrics[layer].rmse * Math.sqrt(1 + (i + 1) / 6));
      return { year, estimate, lower: clamp(estimate - spread, 0, 100), upper: clamp(estimate + spread, 0, 100) };
    };
    return { year, surface: toPoint("surface"), root: toPoint("root"), temp: average(yearWeather.map(w => w.t2m)), rain: average(yearWeather.map(w => w.precip)) };
  });
  return {
    status: "ready", historical, future, errors: metrics, trainingPeriod: "1981–2015", holdoutPeriod: "2016–2025",
    overlapYears: corrected.overlapYears,
    biasNote: "Monthly additive temperature and multiplicative precipitation adjustment calibrated from overlapping 2015–2025 NASA POWER / CMIP6 model values. Not independently validated.",
    sampleMonths: 540
  };
}
