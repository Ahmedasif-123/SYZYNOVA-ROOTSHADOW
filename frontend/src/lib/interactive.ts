import type { ReviewItem } from "./decision";

export type Scenario = {
  surfaceMin: number;
  rootBelow: number;
  consecutiveDays: number;
};

export const ORIGINAL_RULE: Scenario = { surfaceMin: 40, rootBelow: 40, consecutiveDays: 7 };

export type ScenarioResult = {
  state: "matched" | "not_matched" | "unavailable";
  matchedDays: number;
  validDays: number;
  consecutiveDays: number;
};

function valid(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function evaluateScenario(item: ReviewItem, scenario: Scenario): ScenarioResult {
  const n = scenario.consecutiveDays;
  const empty: ScenarioResult = { state: "unavailable", matchedDays: 0, validDays: 0, consecutiveDays: n };
  if (item.category === "unavailable" || !item.latestDate || !item.latestObservation ||
      !Number.isInteger(n) || n < 1 || n > 7 ||
      !Number.isFinite(scenario.surfaceMin) || !Number.isFinite(scenario.rootBelow) ||
      scenario.surfaceMin < 0 || scenario.surfaceMin > 100 ||
      scenario.rootBelow < 0 || scenario.rootBelow > 100) return empty;

  const time = Date.parse(item.latestDate + "T00:00:00Z");
  if (!Number.isFinite(time)) return empty;
  const rows = [...item.latestObservation.history_45d]
    .filter(row => row.date <= item.latestDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-n);
  if (rows.length !== n) return empty;
  for (let i = 0; i < n; i++) {
    const expected = new Date(time - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    if (rows[i].date !== expected || !valid(rows[i].surface_percentile) || !valid(rows[i].root_percentile)) {
      return empty;
    }
  }
  const matchedDays = rows.filter(row => row.surface_percentile! >= scenario.surfaceMin && row.root_percentile! < scenario.rootBelow).length;
  return {
    state: matchedDays === n ? "matched" : "not_matched",
    matchedDays,
    validDays: n,
    consecutiveDays: n
  };
}

export function scenarioSummary(items: ReviewItem[], scenario: Scenario) {
  const states = items.map(item => evaluateScenario(item, scenario));
  return {
    matched: states.filter(result => result.state === "matched").length,
    checked: states.filter(result => result.state !== "unavailable").length,
    unavailable: states.filter(result => result.state === "unavailable").length
  };
}

export function originalScenario(scenario: Scenario) {
  return scenario.surfaceMin === ORIGINAL_RULE.surfaceMin &&
    scenario.rootBelow === ORIGINAL_RULE.rootBelow &&
    scenario.consecutiveDays === ORIGINAL_RULE.consecutiveDays;
}
