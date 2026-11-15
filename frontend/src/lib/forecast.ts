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
  modelSelected: "ridge_regression" | "historical_mean";
  status: "exploratory" | "baseline_only" | "insufficient_data";
  sampleYears: number;
};

const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const clip = (value: number) => Math.max(0, Math.min(100, value));

function features(history: number[], year: number): number[] {
  const last = history.at(-1) ?? 50;
  const before = history.at(-2) ?? last;
  const recent = mean(history.slice(-5));
  return [1, (year - 2000) / 20, (last - 50) / 50, (before - 50) / 50, (recent - 50) / 50];
}

function solve(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const aug = matrix.map((row, i) => [...row, rhs[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(aug[j][i]) > Math.abs(aug[pivot][i])) pivot = j;
    if (Math.abs(aug[pivot][i]) < 1e-9) return Array(n).fill(0);
    [aug[i], aug[pivot]] = [aug[pivot], aug[i]];
    const divisor = aug[i][i];
    for (let k = i; k <= n; k++) aug[i][k] /= divisor;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const factor = aug[j][i];
      for (let k = i; k <= n; k++) aug[j][k] -= factor * aug[i][k];
    }
  }
  return aug.map(row => row[n]);
}

function trainRidge(history: { year: number; value: number }[]): number[] {
  const size = 5;
  const gram = Array.from({ length: size }, () => Array(size).fill(0) as number[]);
  const rhs = Array(size).fill(0) as number[];
  for (let i = 5; i < history.length; i++) {
    const vector = features(history.slice(0, i).map(p => p.value), history[i].year);
    const target = (history[i].value - 50) / 50;
    for (let j = 0; j < size; j++) {
      rhs[j] += vector[j] * target;
      for (let k = 0; k < size; k++) gram[j][k] += vector[j] * vector[k];
    }
  }
  for (let j = 0; j < size; j++) gram[j][j] += j === 0 ? 0.05 : 2;
  return solve(gram, rhs);
}

function extrapolate(model: number[], initial: { year: number; value: number }[], years: number) {
  const values = initial.map(p => p.value);
  const lastYear = initial.at(-1)?.year ?? 2025;
  return Array.from({ length: years }, (_, index) => {
    const year = lastYear + index + 1;
    const x = features(values, year);
    const raw = 50 + 50 * x.reduce((total, feature, i) => total + feature * model[i], 0);
    const estimate = clip(raw);
    values.push(estimate);
    return { year, estimate };
  });
}

export function annualize(months: string[], rows: AtlasMonth[]): AnnualPoint[] {
  const bucket = new Map<number, { surface: number[]; root: number[] }>();
  months.forEach((month, i) => {
    const year = Number(month.slice(0, 4));
    if (!Number.isInteger(year) || year < 1981 || year > 2025) return;
    const entry = bucket.get(year) ?? { surface: [], root: [] };
    const row = rows[i];
    const surface = row?.[0];
    const root = row?.[1];
    if (typeof surface === "number" && Number.isFinite(surface) && surface >= 0 && surface <= 100) entry.surface.push(surface);
    if (typeof root === "number" && Number.isFinite(root) && root >= 0 && root <= 100) entry.root.push(root);
    bucket.set(year, entry);
  });
  return Array.from(bucket, ([year, entry]) => ({
    year,
    surface: entry.surface.length >= 10 ? mean(entry.surface) : null,
    root: entry.root.length >= 10 ? mean(entry.root) : null
  })).sort((a, b) => a.year - b.year);
}

export function buildLayerScenario(annual: AnnualPoint[], layer: "surface" | "root", years: number): LayerScenario {
  const historical = annual.flatMap(row => typeof row[layer] === "number" ? [{ year: row.year, value: row[layer] }] : []);
  const empty: LayerScenario = { historical, future: [], holdoutMae: NaN, baselineMae: NaN, skillPercent: NaN, trendPerDecade: NaN, modelSelected: "historical_mean", status: "insufficient_data", sampleYears: historical.length };
  if (historical.length !== 45 || historical[0]?.year !== 1981 || historical.at(-1)?.year !== 2025 ||
    historical.some((point, index) => point.year !== 1981 + index) || ![5, 10, 30].includes(years)) return empty;

  const training = historical.filter(point => point.year <= 2015);
  const testing = historical.filter(point => point.year > 2015);
  const ridge = trainRidge(training);
  const predictedHoldout = extrapolate(ridge, training, testing.length);
  const baseline = mean(training.map(point => point.value));
  const ridgeMae = mean(testing.map((point, index) => Math.abs(point.value - predictedHoldout[index].estimate)));
  const baselineMae = mean(testing.map(point => Math.abs(point.value - baseline)));
  const useRidge = ridgeMae < baselineMae * 0.98;
  const chosenHoldout = testing.map((point, index) => useRidge ? point.value - predictedHoldout[index].estimate : point.value - baseline);
  const rmse = Math.sqrt(mean(chosenHoldout.map(residual => residual * residual)));
  const model = trainRidge(historical);
  const futureValues = useRidge
    ? extrapolate(model, historical, years)
    : Array.from({ length: years }, (_, i) => ({ year: 2026 + i, estimate: mean(historical.map(p => p.value)) }));
  const future: ProjectionPoint[] = futureValues.map((point, index) => {
    const spread = Math.max(5, rmse * Math.sqrt(1 + (index + 1) / 5));
    return { year: point.year, estimate: point.estimate, lower: clip(point.estimate - spread), upper: clip(point.estimate + spread) };
  });
  return {
    historical, future, holdoutMae: ridgeMae, baselineMae,
    skillPercent: baselineMae === 0 ? 0 : 100 * (1 - ridgeMae / baselineMae),
    trendPerDecade: useRidge && future.length >= 5 ? (future[Math.min(9, future.length - 1)].estimate - future[0].estimate) * 10 / Math.min(9, future.length - 1) : 0,
    modelSelected: useRidge ? "ridge_regression" : "historical_mean",
    status: useRidge ? "exploratory" : "baseline_only",
    sampleYears: historical.length
  };
}
