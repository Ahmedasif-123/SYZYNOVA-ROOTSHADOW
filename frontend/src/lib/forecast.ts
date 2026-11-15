import type { AtlasMonth } from "./atlas";

export type AnnualPoint = { year: number; surface: number | null; root: number | null };
export type ProjectionPoint = { year: number; estimate: number; lower: number; upper: number };
export type LayerScenario = {
  historical: { year: number; value: number }[];
  future: ProjectionPoint[];
  holdoutMae: number;
  baselineMae: number;
  skillPercent: number;
  trendPerDecade: number;
  modelSelected: "regularized_trend" | "historical_mean";
  status: "exploratory" | "baseline_only" | "insufficient_data";
  sampleYears: number;
};

function mean(a: number[]): number {
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function fit(points: { year: number; value: number }[], endYear: number) {
  const values = points.filter(p => p.year <= endYear);
  const xs = values.map(p => p.year - 2000);
  const ys = values.map(p => p.value);
  const avgX = mean(xs);
  const avgY = mean(ys);
  const variation = xs.reduce((s, x) => s + (x - avgX) ** 2, 0);
  const covariance = xs.reduce((s, x, i) => s + (x - avgX) * (ys[i] - avgY), 0);
  const slope = covariance / (variation + 800);
  return { slope, center: avgY, centerYear: avgX + 2000 };
}

function predict(fitResult: ReturnType<typeof fit>, year: number): number {
  const age = year - fitResult.centerYear;
  const damped = Math.sign(age) * 10 * (1 - Math.exp(-Math.abs(age) / 10));
  return Math.max(0, Math.min(100, fitResult.center + fitResult.slope * damped));
}

export function annualize(months: string[], rows: AtlasMonth[]): AnnualPoint[] {
  const bucket = new Map<number, { surface: number[]; root: number[] }>();
  months.forEach((month, i) => {
    const year = Number(month.slice(0, 4));
    if (!Number.isInteger(year) || year < 1981 || year > 2025) return;
    const b = bucket.get(year) ?? { surface: [], root: [] };
    const row = rows[i];
    const surface = row?.[0];
    const root = row?.[1];
    if (typeof surface === "number" && Number.isFinite(surface) && surface >= 0 && surface <= 100) b.surface.push(surface);
    if (typeof root === "number" && Number.isFinite(root) && root >= 0 && root <= 100) b.root.push(root);
    bucket.set(year, b);
  });
  return Array.from(bucket, ([year, b]) => ({
    year,
    surface: b.surface.length >= 10 ? mean(b.surface) : null,
    root: b.root.length >= 10 ? mean(b.root) : null
  })).sort((a, b) => a.year - b.year);
}

export function buildLayerScenario(annual: AnnualPoint[], layer: "surface" | "root", years: number): LayerScenario {
  const historical = annual.flatMap(row => typeof row[layer] === "number" ? [{ year: row.year, value: row[layer] }] : []);
  const empty: LayerScenario = { historical, future: [], holdoutMae: NaN, baselineMae: NaN, skillPercent: NaN, trendPerDecade: NaN, modelSelected: "historical_mean", status: "insufficient_data", sampleYears: historical.length };
  if (historical.length < 35 || historical.some((p, i) => i && p.year !== historical[i - 1].year + 1) || historical[0].year > 1981 || historical.at(-1)?.year !== 2025) return empty;
  const train = historical.filter(p => p.year <= 2015);
  const test = historical.filter(p => p.year >= 2016);
  if (train.length < 30 || test.length < 10) return empty;
  const prior = fit(train, 2015);
  const avg = mean(train.map(p => p.value));
  const trendError = mean(test.map(p => Math.abs(p.value - predict(prior, p.year))));
  const baseError = mean(test.map(p => Math.abs(p.value - avg)));
  const selected = trendError < baseError ? "regularized_trend" : "historical_mean";
  const all = fit(historical, 2025);
  const current = mean(historical.map(p => p.value));
  const effective = selected === "regularized_trend" ? all : { slope: 0, center: current, centerYear: 2025 };
  const observedResiduals = test.map(p => p.value - (selected === "regularized_trend" ? predict(prior, p.year) : avg));
  const rmse = Math.sqrt(mean(observedResiduals.map(value => value ** 2)));
  const future = Array.from({ length: years }, (_, i) => {
    const horizon = i + 1;
    const estimate = predict(effective, 2025 + horizon);
    const spread = Math.max(5, rmse * Math.sqrt(1 + horizon / 5));
    return {
      year: 2025 + horizon,
      estimate,
      lower: Math.max(0, estimate - spread),
      upper: Math.min(100, estimate + spread)
    };
  });
  return {
    historical, future, holdoutMae: trendError, baselineMae: baseError,
    skillPercent: 100 * (1 - trendError / (baseError || 1)),
    trendPerDecade: effective.slope * 10,
    modelSelected: selected,
    status: selected === "regularized_trend" ? "exploratory" : "baseline_only",
    sampleYears: historical.length
  };
}
