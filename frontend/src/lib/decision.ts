import type { AtlasHistory, AtlasLatest, AtlasRecentDay, AtlasRecentSite } from "./atlas";
import type { Site, SiteId } from "./sites";

export type ReviewCategory = "persistent_mismatch" | "mismatch" | "root_dry" | "no_flag" | "unavailable";
export type ReviewItem = {
  id: SiteId;
  site: Site;
  category: ReviewCategory;
  latestDate: string | null;
  surface: number | null;
  root: number | null;
  totalRain7: number | null;
  sevenDayComplete: boolean;
  dryDays7: number | null;
  mismatchDays7: number | null;
  latestObservation: AtlasRecentSite | null;
};

function available(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function continuousWeek(history: AtlasRecentDay[], asOf: string): AtlasRecentDay[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null;
  const end = new Date(asOf + "T00:00:00Z");
  if (!Number.isFinite(end.valueOf())) return null;
  const ordered = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const week = ordered.filter(d => d.date <= asOf).slice(-7);
  if (week.length !== 7) return null;
  for (let i = 0; i < 7; i++) {
    const expected = new Date(end.valueOf() - (6 - i) * 86400000).toISOString().slice(0, 10);
    if (week[i].date !== expected || !available(week[i].root_percentile) || !available(week[i].surface_percentile)) return null;
  }
  return week;
}

function recentIsStale(siteDate: string, atlasDate: string): boolean {
  const snapshotTime = Date.parse(atlasDate + "T00:00:00Z");
  const siteTime = Date.parse(siteDate + "T00:00:00Z");
  const sinceSnapshotDays = (Date.now() - snapshotTime) / 86400000;
  const siteLagDays = (snapshotTime - siteTime) / 86400000;
  return !Number.isFinite(sinceSnapshotDays) || !Number.isFinite(siteLagDays) ||
    sinceSnapshotDays > 10 || sinceSnapshotDays < -1 ||
    siteLagDays > 7 || siteLagDays < 0;
}

export function reviewItem(site: Site, latest: AtlasLatest | null): ReviewItem {
  const raw = latest?.sites[site.id] ?? null;
  const stale = raw && latest ? recentIsStale(raw.date, latest.latest_observation_date) : true;
  const top = !stale && raw && available(raw.surface_percentile) ? raw.surface_percentile : null;
  const root = !stale && raw && available(raw.root_percentile) ? raw.root_percentile : null;
  const week = !stale && raw ? continuousWeek(raw.history_45d ?? [], raw.date) : null;
  const dryDays7 = week ? week.filter(d => (d.root_percentile ?? 100) < 40).length : null;
  const mismatchDays7 = week ? week.filter(d => (d.surface_percentile ?? -1) >= 40 && (d.root_percentile ?? 100) < 40).length : null;
  let category: ReviewCategory = "unavailable";
  if (!stale && top !== null && root !== null) {
    if (week && mismatchDays7 === 7 && dryDays7 === 7) category = "persistent_mismatch";
    else if (top >= 40 && root < 40) category = "mismatch";
    else if (root < 40) category = "root_dry";
    else category = "no_flag";
  }
  return {
    id: site.id,
    site,
    category,
    latestDate: raw?.date ?? null,
    surface: top,
    root,
    totalRain7: !stale ? raw?.precip_7d_mm ?? null : null,
    sevenDayComplete: week !== null,
    dryDays7,
    mismatchDays7,
    latestObservation: raw
  };
}

const ORDER: Record<ReviewCategory, number> = {
  persistent_mismatch: 0,
  mismatch: 1,
  root_dry: 2,
  unavailable: 3,
  no_flag: 4
};

export function buildReviewQueue(sites: Site[], latest: AtlasLatest | null): ReviewItem[] {
  return sites.map(site => reviewItem(site, latest)).sort((a, b) =>
    ORDER[a.category] - ORDER[b.category] ||
    (a.root ?? 101) - (b.root ?? 101) ||
    a.site.name.localeCompare(b.site.name)
  );
}

export function historicalContext(history: AtlasHistory | undefined, siteId: SiteId, observationDate: string | null) {
  if (!history || !observationDate) return null;
  const rows = history.sites[siteId];
  if (!rows || rows.length !== history.months.length) return null;
  const qualifying = (record: [number | null, number | null, number | null]) =>
    available(record[0]) && available(record[1]) && record[0] >= 40 && record[1] < 40;
  const valid = rows.filter(row => available(row[0]) && available(row[1]));
  const historicalMatches = valid.filter(qualifying).length;
  const thisMonth = observationDate.slice(5, 7);
  const sameMonth = rows.filter((row, i) => history.months[i]?.slice(5, 7) === thisMonth && available(row[0]) && available(row[1]));
  const sameMonthMatches = sameMonth.filter(qualifying).length;
  return {
    monthsEvaluated: valid.length,
    mismatchMonths: historicalMatches,
    seasonalMonthsEvaluated: sameMonth.length,
    seasonalMismatchMonths: sameMonthMatches,
    monthLabel: new Date(observationDate + "T00:00:00Z").toLocaleString("en-US", { month: "long", timeZone: "UTC" })
  };
}

export function categoryTitle(category: ReviewCategory) {
  if (category === "persistent_mismatch") return "7-day modeled mismatch";
  if (category === "mismatch") return "Latest-day modeled mismatch";
  if (category === "root_dry") return "Modeled root-zone dryness";
  if (category === "no_flag") return "No low-root flag";
  return "Observation unavailable";
}

export function reviewActions(role: "engineer" | "ministry" | "researcher", category: ReviewCategory): string[] {
  const active = category === "persistent_mismatch" || category === "mismatch" || category === "root_dry";
  if (role === "engineer") return active
    ? ["Confirm the soil-water state with probes at the crop's rooting depths.", "Check irrigation events, soil texture and recent weather before evaluating crop water needs.", "Do not change irrigation solely from this model-based screen."]
    : ["Check whether the model grid represents the relevant field.", "Use local soil observations before drawing agricultural conclusions."];
  if (role === "ministry") return active
    ? ["Consider this study point for independent corroboration, not a district-wide alert.", "Prioritize ground observations where monitoring coverage is inadequate.", "Do not allocate water or impose restrictions using these point flags alone."]
    : ["Maintain the observation queue and verify geographic representativeness.", "Avoid extrapolating from one point to an administrative boundary."];
  return active
    ? ["Compare the same dates and depths against independent in-situ observations.", "Benchmark against SMAP Level-4, noting shared model structure and dependence.", "Quantify false positives, recovery-timing error and failure modes before claiming skill."]
    : ["Test sensitivity to the percentile threshold and climatology reference.", "Check model-input quality and seek independent measurements."];
}

export function evidenceExport(item: ReviewItem, context: ReturnType<typeof historicalContext>, atlas: AtlasLatest | null) {
  return {
    project: "ROOTSHADOW",
    product: "Regional screening research prototype",
    scientific_status: "Unvalidated NASA POWER/MERRA-2 modeled point data, not a field observation or agricultural advisory",
    point: {
      id: item.id,
      name: item.site.name,
      country: item.site.country,
      latitude: item.site.coordinates[1],
      longitude: item.site.coordinates[0]
    },
    screening: {
      category: item.category,
      definition: "Latest-day mismatch: surface percentile >= 40 and root-zone percentile < 40. Seven-day mismatch: seven consecutive complete days satisfying this rule.",
      observation_date: item.latestDate,
      surface_percentile: item.surface,
      root_percentile: item.root,
      recent_7_days_complete: item.sevenDayComplete,
      dry_root_days_last_7: item.dryDays7,
      mismatch_days_last_7: item.mismatchDays7,
      precipitation_7d_mm: item.totalRain7
    },
    historical_reference: {
      baseline: "1991-2020 daily seasonal percentile reference; monthly charts summarize the daily percentiles",
      context,
      caveat: "Historical monthly medians cannot establish seven consecutive daily recovery days; historical comparison is descriptive only."
    },
    source: {
      atlas_observation_date: atlas?.latest_observation_date ?? null,
      last_checked_utc: atlas?.retrieval_checked_utc ?? null,
      nasa_url: item.latestObservation?.source_url ?? null,
      sha256: item.latestObservation?.source_sha256 ?? null,
      retrieved_utc: item.latestObservation?.retrieved_utc ?? null
    },
    recent_45_day_model_series: item.latestObservation?.history_45d ?? [],
    limitations: [
      "The 97 points are sampled gridded model estimates, not a continuous farm- or district-scale map.",
      "A low percentile is a relative historical rank, not percent water content or crop stress.",
      "Independent NOAA soil-probe evidence is available for two Oklahoma model locations only; broader field validation and calibrated forecasts are not available.",
      "MERRA-2 does not resolve farm irrigation practices; do not infer irrigation requirements or water savings.",
      "The seven-day mismatch describes contemporaneous modeled state, not the separate historical sustained recovery-event definition."
    ]
  };
}
