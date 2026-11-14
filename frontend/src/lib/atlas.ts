import type { SiteId } from "./sites";

export type AtlasMonth = [number | null, number | null, number | null];
export type AtlasHistory = {
  schema: number;
  source: string;
  baseline: string;
  months: string[];
  sites: Record<string, AtlasMonth[]>;
};
export type AtlasRecentDay = { date: string; surface_percentile: number | null; root_percentile: number | null; precip_mm: number | null };
export type AtlasRecentSite = {
  date: string;
  surface_percentile: number | null;
  root_percentile: number | null;
  mismatch_screen: boolean;
  surface_above_40_for_7_days: boolean;
  precip_7d_mm: number | null;
  source_url: string;
  source_sha256: string;
  retrieved_utc: string;
  history_45d: AtlasRecentDay[];
};
export type AtlasLatest = {
  schema: number;
  source: string;
  retrieval_checked_utc: string;
  latest_observation_date: string;
  verified_site_count: number;
  missing_site_count: number;
  mismatch_definition: string;
  sites: Record<string, AtlasRecentSite>;
};

function validHistory(value: unknown): value is AtlasHistory {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AtlasHistory>;
  return v.schema === 1 && Array.isArray(v.months) && v.months.length === 540 && !!v.sites && typeof v.sites === "object" && Object.keys(v.sites).length === 97 && Object.values(v.sites).every(rows => Array.isArray(rows) && rows.length === 540);
}

function validLatest(value: unknown): value is AtlasLatest {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AtlasLatest>;
  return v.schema === 1 && !!v.sites && typeof v.sites === "object" && typeof v.retrieval_checked_utc === "string" && typeof v.latest_observation_date === "string" && typeof v.verified_site_count === "number";
}

export async function getAtlasHistory(signal?: AbortSignal): Promise<AtlasHistory> {
  const response = await fetch(import.meta.env.BASE_URL + "atlas/history.json", { signal });
  if (!response.ok) throw new Error("The 1981–2025 NASA atlas archive is not available.");
  const data: unknown = await response.json();
  if (!validHistory(data)) throw new Error("The monthly NASA atlas failed integrity and coverage checks.");
  return data;
}

export async function getAtlasLatest(signal?: AbortSignal): Promise<AtlasLatest | null> {
  const remote = "https://raw.githubusercontent.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/moisture-atlas-daily-2026/frontend/public/atlas/latest.json";
  const candidates = [remote + "?refresh=" + Math.floor(Date.now() / 3600000), import.meta.env.BASE_URL + "atlas/latest.json"];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { signal, cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) continue;
      const data: unknown = await response.json();
      if (validLatest(data)) return data;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  return null;
}

export function atlasValue(history: AtlasHistory, siteId: SiteId, monthIndex: number): AtlasMonth | null {
  return history.sites[siteId]?.[monthIndex] ?? null;
}

export function relativeClass(percentile: number | null): string {
  if (percentile === null || !Number.isFinite(percentile)) return "No verified reading";
  if (percentile < 20) return "Very dry compared with the seasonal baseline";
  if (percentile < 40) return "Relatively dry for this season";
  if (percentile < 80) return "Within the mid-range of historical conditions";
  return "Relatively wet for this season";
}
