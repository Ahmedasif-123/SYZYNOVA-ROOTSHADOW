import { z } from "zod";
import type { SiteId } from "./sites";

const nullableNumber = z.number().nullable();
const optionalNumber = z.number().nullable().optional();

const EventSchema = z.object({
  drought_start: z.string(),
  drought_end: z.string(),
  surface_recovery: z.string().nullable(),
  root_recovery: z.string().nullable(),
  recovery_delay_days: nullableNumber,
  censored_delay_lower_bound_days: nullableNumber,
  observed_mismatch_days: z.number(),
  status: z.string(),
  window_end: z.string()
});

const AuditCheckSchema = z.object({
  check: z.string(),
  passed: z.boolean().nullable(),
  detail: z.string()
});

export const AnalysisSchema = z.object({
  source: z.object({
    mode: z.string(),
    source: z.string(),
    sha256: z.string().optional(),
    retrieved_utc: z.string().optional(),
    warning: z.string().optional(),
    integrity_note: z.string().optional(),
    cache_fallback: z.boolean().optional()
  }),
  period: z.object({ start: z.string(), end: z.string(), days: z.number(), usable_years: z.number() }),
  method: z.object({
    baseline: z.string(), drought: z.string(), recovery: z.string(), censoring: z.string(),
    trend: z.string(), null_model: z.string(), limitations: z.string(), annual_metric: z.string()
  }),
  quality: z.object({ paired_day_coverage: z.number(), total_days: z.number() }),
  events: z.array(EventSchema),
  annual: z.array(z.object({ year: z.number(), events: z.number(), mismatch_days: z.number(), max_lag_days: z.number() })),
  lag_trend: z.object({
    status: z.string(), n_events: z.number(), slope_days_per_decade: nullableNumber,
    p_value: optionalNumber, tau: optionalNumber, ci95_days_per_decade: z.array(z.number()).optional()
  }),
  trend: z.object({
    status: z.string(), slope_per_decade: nullableNumber, p_value: optionalNumber,
    variance_correction: optionalNumber
  }),
  null_model: z.object({
    status: z.string(), n_surrogates: z.number(), assumptions: z.string(),
    observed: z.object({ median_lag: optionalNumber }),
    surrogate_mean: z.object({ median_lag: optionalNumber })
  }).nullable(),
  sensitivity: z.object({
    cells: z.array(z.object({
      drought_percentile: z.number(), recovery_percentile: z.number(), events: z.number(),
      complete_events: z.number(), lag_slope_days_per_decade: optionalNumber,
      kendall_p: optionalNumber
    })),
    sign_agreement_with_primary: optionalNumber, cells_tested: z.number(), cells_total: z.number(), note: z.string()
  }),
  audit: z.object({ verdict: z.string(), explanation: z.string(), checks: z.array(AuditCheckSchema), caution: z.string() }),
  monthly: z.array(z.object({ month: z.string(), top_percentile: nullableNumber, root_percentile: nullableNumber })),
  ready_for_scientific_claims: z.boolean()
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type RecoveryEvent = Analysis["events"][number];

export async function getAnalysis(site: SiteId, signal?: AbortSignal): Promise<Analysis> {
  const response = await fetch(`/api/analyze?mode=site&site=${encodeURIComponent(site)}`, {
    headers: { Accept: "application/json" }, signal
  });
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("The analysis service did not return valid JSON."); }
  if (!response.ok) {
    const detail = typeof body === "object" && body !== null && "detail" in body ? String(body.detail) : "The analysis could not be completed.";
    throw new Error(detail);
  }
  const parsed = AnalysisSchema.safeParse(body);
  if (!parsed.success) throw new Error("The NASA analysis response failed schema validation. No results were substituted.");
  if (parsed.data.source.mode !== "verified_prefetched_nasa") throw new Error("Expected a verified NASA site snapshot; received a different source mode.");
  return parsed.data;
}

export function formatLag(lag: number | null): string {
  if (lag === null) return "Not complete";
  if (lag === 0) return "Same day";
  return `${Math.abs(lag)} day${Math.abs(lag) === 1 ? "" : "s"} ${lag > 0 ? "later" : "earlier"}`;
}

export function medianPositiveLag(events: RecoveryEvent[]): number | null {
  const values = events.map(event => event.recovery_delay_days).filter((lag): lag is number => lag !== null && lag > 0).sort((a, b) => a - b);
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

export function describeEvent(event: RecoveryEvent): string {
  if (event.status === "COMPLETE_SURFACE_FIRST") return `The surface recovered ${event.recovery_delay_days} days before the root zone in this modeled historical event.`;
  if (event.status === "ROOT_FIRST") return `The root zone recovered ${Math.abs(event.recovery_delay_days ?? 0)} days before the surface.`;
  if (event.status === "SIMULTANEOUS") return "Surface and root-zone recovery occurred on the same date.";
  if (event.status === "NO_SURFACE_RECOVERY") return "No qualifying sustained surface recovery was detected in the observation window.";
  return "Recovery did not complete within the available event window; the delay is censored, not zero.";
}

export function verdictLabel(verdict: string): string {
  if (verdict === "TREND_SUPPORTED_EXPLORATORY") return "Exploratory signal";
  if (verdict === "NO_SIGNIFICANT_TREND") return "No detected trend";
  if (verdict === "INCONCLUSIVE") return "Inconclusive";
  if (verdict === "TREND_NOT_ROBUST") return "Not robust";
  return verdict.replaceAll("_", " ").toLowerCase();
}
