import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, ArrowUpRight, ClipboardCheck, Database, Download, ExternalLink, MapPin, Search, ShieldAlert } from "lucide-react";
import { getAtlasHistory, getAtlasLatest, type AtlasRecentDay } from "../lib/atlas";
import { buildReviewQueue, categoryTitle, evidenceExport, historicalContext, reviewActions, type ReviewCategory } from "../lib/decision";
import { findSite, isCoreSite, siteRegions, sites, type SiteId } from "../lib/sites";
import { ORIGINAL_RULE, evaluateScenario, originalScenario, scenarioSummary, type Scenario } from "../lib/interactive";
import ProbeVerificationCard from "./ProbeVerificationCard";

type Props = { selected: SiteId; onSelect: (id: SiteId) => void; onInvestigate: () => void };
type Role = "ministry" | "engineer" | "researcher";

const filters: { key: ReviewCategory | "all"; name: string }[] = [
  { key: "all", name: `All ${sites.length}` },
  { key: "persistent_mismatch", name: "7-day mismatch" },
  { key: "mismatch", name: "Latest mismatch" },
  { key: "root_dry", name: "Dry root zone" },
  { key: "no_flag", name: "No low-root flag" },
  { key: "unavailable", name: "Unavailable" }
];

function pilotFlagNote(category: ReviewCategory): string {
  if (category === "persistent_mismatch" || category === "mismatch") return "4 Oklahoma stations: mismatch recall 6.7–10.5%; precision 15.8–27.8%";
  if (category === "root_dry") return "4 Oklahoma stations: root-low recall 67.0–88.6%; not site-specific";
  if (category === "no_flag") return "No flag ≠ verified recovery; Oklahoma mismatch recall only 6.7–10.5%";
  return "No calibrated field reliability for this location";
}

function measurement(value: number | null, unit: string) {
  return value === null || !Number.isFinite(value) ? "Unavailable" : value.toFixed(1) + unit;
}

function RecentChart({ records }: { records: AtlasRecentDay[] }) {
  const data = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-45), [records]);
  if (data.length < 2) return <p className="desk-empty">Insufficient daily observations to draw a time series.</p>;
  const x = (i: number) => 40 + 638 * i / (data.length - 1);
  const y = (n: number) => 205 - 1.55 * n;
  function lines(key: "surface_percentile" | "root_percentile") {
    const paths: string[] = [];
    let current = "";
    data.forEach((point, i) => {
      const value = point[key];
      if (value === null || !Number.isFinite(value) || value < 0 || value > 100) {
        if (current) paths.push(current);
        current = "";
      } else current += (current ? " L" : "M") + x(i).toFixed(1) + " " + y(value).toFixed(1);
    });
    if (current) paths.push(current);
    return paths;
  }
  return <div className="desk-chart" role="img" aria-label="Model-derived daily surface and root-zone percentile series; the dotted line marks the 40th percentile">
    <svg viewBox="0 0 720 240" preserveAspectRatio="xMidYMid meet">
      {[0, 20, 40, 60, 80, 100].map(v => <g key={v}><line x1="40" x2="678" y1={y(v)} y2={y(v)} stroke={v === 40 ? "#a67b48" : "#dbe3da"} strokeDasharray={v === 40 ? "6 5" : "none"}/><text x="28" y={y(v) + 4} textAnchor="end" fontSize="11" fill="#425948">{v}</text></g>)}
      {lines("surface_percentile").map((d, i) => <path key={"s" + i} d={d} stroke="#b47a45" strokeWidth="2.6" fill="none" strokeLinejoin="round"/>)}
      {lines("root_percentile").map((d, i) => <path key={"r" + i} d={d} stroke="#236c58" strokeWidth="3" fill="none" strokeLinejoin="round"/>)}
      <text x="40" y="229" fontSize="11" fill="#425948">{data[0]?.date}</text>
      <text x="678" y="229" fontSize="11" textAnchor="end" fill="#425948">{data[data.length - 1]?.date}</text>
    </svg>
    <div className="desk-legend"><span><i className="desk-legend-surface"/> Surface percentile</span><span><i className="desk-legend-root"/> Root-zone percentile</span><span><i className="desk-legend-threshold"/> 40th percentile screen</span></div>
  </div>;
}

export default function DecisionDesk({ selected, onSelect, onInvestigate }: Props) {
  const [category, setCategory] = useState<ReviewCategory | "all">("all");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role>("ministry");
  const [scenario, setScenario] = useState<Scenario>(ORIGINAL_RULE);
  const latestQuery = useQuery({ queryKey: ["rootshadow-atlas-recent"], queryFn: ({ signal }) => getAtlasLatest(signal), staleTime: 30 * 60_000, refetchInterval: 60 * 60_000, retry: 1 });
  const historyQuery = useQuery({ queryKey: ["rootshadow-atlas-history"], queryFn: ({ signal }) => getAtlasHistory(signal), staleTime: Infinity, retry: 1 });
  const latest = latestQuery.data ?? null;
  const queue = useMemo(() => buildReviewQueue(sites, latest), [latest]);
  const visible = useMemo(() => queue.filter(item =>
    (category === "all" || item.category === category) &&
    (region === "all" || (region === "Original research sites" ? isCoreSite(item.id) : item.site.region === region)) &&
    (!search.trim() || [item.site.name, item.site.country, item.site.region].some(s => s.toLowerCase().includes(search.toLowerCase().trim())))
  ), [queue, category, region, search]);
  const selectedItem = queue.find(item => item.id === selected) ?? queue[0];
  const scenarioTotals = useMemo(() => scenarioSummary(queue, scenario), [queue, scenario]);
  const selectedScenario = selectedItem ? evaluateScenario(selectedItem, scenario) : null;
  const place = findSite(selected);
  const context = historicalContext(historyQuery.data, selected, selectedItem?.latestDate ?? null);
  const categories = {
    persistent: queue.filter(item => item.category === "persistent_mismatch").length,
    mismatch: queue.filter(item => item.category === "mismatch").length,
    dry: queue.filter(item => item.category === "root_dry").length,
    unavailable: queue.filter(item => item.category === "unavailable").length
  };
  function download() {
    if (!selectedItem || !latest) return;
    const payload = evidenceExport(selectedItem, context, latest);
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rootshadow-screening-" + selectedItem.id + ".json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
  return <section className="desk-page" aria-label="Regional evidence screening desk">
    <header className="desk-heading"><div><span className="desk-kicker"><Activity size={15}/> ROOTSHADOW / DECISION INTELLIGENCE</span><h1>Know where to<br/><em>look deeper.</em></h1><p>Compare modeled soil conditions across {sites.length} selected locations. Use the flags to decide what deserves investigation—not to label farmland safe or unsafe.</p></div><div className="desk-status"><ShieldAlert size={22}/><div><strong>Screening, not a forecast</strong><span>Model observations are not field verification, crop diagnosis, or irrigation advice.</span></div></div></header>
    <div className="desk-quick-guide" aria-label="How to use the Decision Desk"><div><strong>1. Select a location</strong><span>Search the {sites.length} NASA model points below.</span></div><div><strong>2. Read the flag</strong><span>Surface ≥40 and roots below 40 suggest a mismatch; seven consecutive days is a stronger screen.</span></div><div><strong>3. Verify locally</strong><span>Check soil probes, crops and weather before acting. No flag is proof of farm safety.</span></div></div>
    <div className="desk-metrics">
      <div><small>MODEL STUDY POINTS</small><strong>{sites.length}</strong><span>Selected NASA POWER locations</span></div>
      <div><small>7-DAY MODEL MISMATCH</small><strong>{latest ? categories.persistent : "—"}</strong><span>Full seven consecutive days</span></div>
      <div><small>LATEST-DAY MISMATCH ONLY</small><strong>{latest ? categories.mismatch : "—"}</strong><span>Does not pass the 7-day screen</span></div>
      <div><small>OTHER ROOT-DRY FLAGS</small><strong>{latest ? categories.dry : "—"}</strong><span>Below 40th percentile</span></div>
    </div>
    <p className="desk-observation">{latest ? <>Data last checked {new Date(latest.retrieval_checked_utc).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} · Most recent modeled observation: <strong>{latest.latest_observation_date}</strong> · {latest.verified_site_count} of {sites.length} source responses reported verified. <strong>{categories.unavailable}</strong> sites need observation review. {categories.unavailable === sites.length ? <strong>All readings are unavailable or too old for the current screening queue.</strong> : null}</> : latestQuery.isPending ? "Loading the source-dated NASA observation atlas…" : "The latest NASA snapshot is unavailable. The desk will not substitute historical or invented readings."}</p>

    <details className="desk-experiment desk-experiment-collapsed" aria-label="Interactive scientific scenario explorer"><summary>Advanced research controls: change the moisture-screen thresholds (optional)</summary>
      <div className="desk-experiment-head"><div><span className="desk-eyebrow">INTERACTIVE SCIENCE / SANDBOX</span><h2>Change the research screening rule.</h2><p>Explore how different screening thresholds affect the {sites.length} NASA model points. These are retrospective model-state comparisons, not AI forecasts or recommendations.</p></div><button type="button" onClick={() => setScenario(ORIGINAL_RULE)}>Restore original rule</button></div>
      <div className="desk-experiment-presets" role="group" aria-label="Scenario presets">
        <button type="button" aria-pressed={originalScenario(scenario)} onClick={() => setScenario(ORIGINAL_RULE)}>Published 7-day rule</button>
        <button type="button" aria-pressed={scenario.surfaceMin === 40 && scenario.rootBelow === 40 && scenario.consecutiveDays === 1} onClick={() => setScenario({ surfaceMin: 40, rootBelow: 40, consecutiveDays: 1 })}>Single-day screen</button>
        <button type="button" aria-pressed={scenario.surfaceMin === 50 && scenario.rootBelow === 30 && scenario.consecutiveDays === 7} onClick={() => setScenario({ surfaceMin: 50, rootBelow: 30, consecutiveDays: 7 })}>Stricter contrast</button>
      </div>
      <div className="desk-experiment-controls">
        <label><span>Minimum surface rank</span><strong>{scenario.surfaceMin}th percentile</strong><input type="range" min="20" max="70" step="5" aria-label="Surface rank minimum" value={scenario.surfaceMin} onChange={event => setScenario(previous => ({ ...previous, surfaceMin: Number(event.target.value) }))}/></label>
        <label><span>Root rank below</span><strong>{scenario.rootBelow}th percentile</strong><input type="range" min="15" max="65" step="5" aria-label="Root rank below" value={scenario.rootBelow} onChange={event => setScenario(previous => ({ ...previous, rootBelow: Number(event.target.value) }))}/></label>
        <label><span>Consecutive qualifying days</span><strong>{scenario.consecutiveDays} {scenario.consecutiveDays === 1 ? "day" : "days"}</strong><input type="range" min="1" max="7" step="1" aria-label="Consecutive days required" value={scenario.consecutiveDays} onChange={event => setScenario(previous => ({ ...previous, consecutiveDays: Number(event.target.value) }))}/></label>
      </div>
      <div className="desk-experiment-results" aria-live="polite">
        <div><strong>{scenarioTotals.matched}</strong><small>Model points meeting your selected rule</small></div>
        <div><strong>{scenarioTotals.checked}</strong><small>Locations with enough usable daily readings</small></div>
        <div><strong>{scenarioTotals.unavailable}</strong><small>Locations excluded due to missing or stale data</small></div>
      </div>
      <p className="desk-experiment-note"><strong>{originalScenario(scenario) ? "Original seven-day screen." : "Exploratory what-if scenario, not a published scientific finding."}</strong> Every day in the selected window must satisfy both thresholds; no data are interpolated. The underlying NASA records, published historical event detection, and independent NOAA validation results never change when you move these controls.</p>
    </details>
    <div className="desk-layout">
      <section className="desk-queue" aria-label="Screening investigation queue">
        <div className="desk-queue-head"><div><span className="desk-eyebrow">01 / SELECT EVIDENCE</span><h2>Choose a location</h2><p>Sites are grouped by modeled moisture clues, not real-world agricultural danger. Select a row to see the reasoning and recommended verification.</p></div><span className="desk-queue-total">{visible.length} points</span></div>
        <div className="desk-controls"><label className="desk-search"><Search size={15}/><input aria-label="Search study locations" placeholder="Find a place or country" value={search} onChange={event => setSearch(event.target.value)}/></label><label><span>REGION</span><select aria-label="Filter locations by region" value={region} onChange={event => setRegion(event.target.value)}><option value="all">All regions</option><option value="Original research sites">Original research sites</option>{siteRegions.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div>
        <div className="desk-signal-key"><strong>Flag guide:</strong> 7-day mismatch = surface relatively wet while deeper soil stays dry for a week · Latest mismatch = one recent day · Root dry = root rank below 40 · No flag = screen not triggered, NOT confirmed safe.</div>
        <p className="desk-pilot-key"><strong>Measured NOAA pilot, not a global accuracy score:</strong> In four Oklahoma field-probe comparisons, the surface–root mismatch flag detected only <strong>6.7–10.5%</strong> of measured mismatch days (recall); only <strong>15.8–27.8%</strong> of its mismatch flags were confirmed (precision). Root-low recall was higher, <strong>67.0–88.6%</strong>. These rates must not be applied to individual sites or Qatar. <a href="/validation/noaa-pilot.json" target="_blank" rel="noreferrer">Source data</a>.</p>
        <div className="desk-filters" role="group" aria-label="Filter screening category">{filters.map(filter => <button type="button" key={filter.key} className={category === filter.key ? "active" : ""} aria-pressed={category === filter.key} onClick={() => setCategory(filter.key)}>{filter.name}</button>)}</div>
        {latestQuery.isError && <p className="desk-error" role="alert">Recent data request failed. Try refreshing the page.</p>}
        <div className="desk-list">{visible.length ? visible.map(item => <button type="button" key={item.id} className={"desk-point " + (selected === item.id ? "selected" : "")} onClick={() => onSelect(item.id)} aria-pressed={selected === item.id}><span className="desk-point-main"><strong>{item.site.name}</strong><small>{item.site.country} · {item.latestDate ?? "No observation"}</small></span><span className={"desk-point-badge desk-" + item.category}>{categoryTitle(item.category)}</span><span className="desk-point-value">{measurement(item.root, " / 100")}</span><small className="desk-point-pilot">{pilotFlagNote(item.category)}</small></button>) : <p className="desk-empty">No locations match the current filters.</p>}</div>
        <p className="desk-queue-foot">Priority: persistent mismatch → latest mismatch → low root percentile → unavailable → no flag. This is a screening order, not a calibrated impact or severity score.</p>
      </section>
      <div className="desk-detail">
        <section className="desk-site-experiment" aria-label="Selected location what-if outcome">
          <span className="desk-eyebrow">SCREEN RESULT / {place.name.toUpperCase()}</span>
          <h3>{selectedScenario?.state === "matched" ? "This model point meets the selected rule" : selectedScenario?.state === "not_matched" ? "This model point does not meet the selected rule" : "Not enough recent evidence to classify this point"}</h3>
          <strong>{selectedScenario?.state === "unavailable" || !selectedScenario ? "Unavailable" : selectedScenario.matchedDays + " of " + selectedScenario.validDays + (selectedScenario.validDays === 1 ? " day" : " days") + " satisfied both conditions"}</strong>
          <p>{originalScenario(scenario) ? "Showing the original seven-day mismatch rule." : "You changed the research screening rules. This is an educational comparison, not a recalculated or independently validated drought-recovery claim."}</p>
        </section>
        <section className="desk-evidence" aria-label="Selected location evidence">
          <div className="desk-detail-head"><div><span className="desk-eyebrow">02 / EXAMINE THE REASON</span><h2>{place.name}</h2><p><MapPin size={14}/>{place.region}, {place.country}</p></div><span className={"desk-selected-badge desk-" + selectedItem?.category}>{selectedItem ? categoryTitle(selectedItem.category) : "Unavailable"}</span></div>
          <div className="desk-selected-validation" aria-label="NOAA pilot performance beside selected model flag"><strong>{selectedItem ? categoryTitle(selectedItem.category) : "Unavailable"} · four-station independent pilot</strong><p>{pilotFlagNote(selectedItem?.category ?? "unavailable")}. In the four Oklahoma stations, the mismatch detector's recall was 6.7–10.5% and precision 15.8–27.8%. These are <strong>not</strong> reliability estimates for {place.name}; external field validation is unavailable for most of the 97 model points. A "no flag" result is never proof of safe soil moisture.</p></div><div className="desk-readings"><div><small>ROOT-ZONE RANK</small><strong>{measurement(selectedItem?.root ?? null, " / 100")}</strong><span>Relative seasonal percentile</span></div><div><small>SURFACE RANK</small><strong>{measurement(selectedItem?.surface ?? null, " / 100")}</strong><span>Relative seasonal percentile</span></div><div><small>LAST 7 VALID DAYS</small><strong>{selectedItem?.sevenDayComplete ? selectedItem.mismatchDays7 + " / 7" : "Unavailable"}</strong><span>Days with modeled mismatch</span></div><div><small>7-DAY MODEL RAIN</small><strong>{measurement(selectedItem?.totalRain7 ?? null, " mm")}</strong><span>Not field-gauge precipitation</span></div></div>
          {selectedItem?.latestObservation && <><div className="desk-chart-head"><h3>Recent NASA model estimates</h3><p>Daily NASA POWER/MERRA-2 percentiles. Horizontal line = screening threshold; percentile does not mean percent of water in soil.</p></div><RecentChart records={selectedItem.latestObservation.history_45d ?? []}/></>}
          {!selectedItem?.latestObservation && <p className="desk-empty">This site has no recent model source; there is no defensible reading to display.</p>}
          <div className="desk-interpretation"><h3>What does this mean for the selected location?</h3><p>{selectedItem?.category === "persistent_mismatch" ? "For each of the last seven consecutive available days, the model's surface rank was at or above the 40th percentile while the root-zone rank stayed below it. This deserves cross-checking, but is not a verified drought impact." : selectedItem?.category === "mismatch" ? "The most recent model reading has surface at or above the 40th percentile and deeper soil below it. The seven-day screen was not met or could not be established." : selectedItem?.category === "root_dry" ? "The most recent model-derived root-zone rank falls below the screening threshold. The specific surface–root mismatch rule is not met." : selectedItem?.category === "no_flag" ? "The available model reading does not meet the project's low root-zone screening threshold. This does not demonstrate adequate soil water for any crop." : "The latest site record is missing, stale, or cannot be interpreted reliably. No screening conclusion is presented."}</p><p className="desk-interpretation-note">The seven-day state screen is <strong>not</strong> the historical study's seven-day sustained recovery-event test. Farm irrigation is not represented by these point estimates.</p></div>
        </section>
        <section className="desk-historical" aria-label="Historical mismatch context"><span className="desk-eyebrow">03 / PUT THE SIGNAL IN CONTEXT</span><h3>How often has the historical model shown a similar pattern?</h3>{context ? <div className="desk-history-grid"><div><strong>{context.mismatchMonths} / {context.monthsEvaluated}</strong><span>Historical months with median surface ≥ 40th and median roots below 40th</span></div><div><strong>{context.seasonalMismatchMonths} / {context.seasonalMonthsEvaluated}</strong><span>{context.monthLabel} months with that same monthly model-screen condition</span></div></div> : <p className="desk-empty">{historyQuery.isPending ? "Loading the 45-year historical comparison…" : "Historical comparison unavailable; no estimate substituted."}</p>}<p>These values summarize independent monthly medians across 1981–2025. They do not count consecutive drought-recovery days or establish field-scale prevalence.</p></section>
        <section className="desk-actions" aria-label="Decision-support next checks"><span className="desk-eyebrow">04 / PLAN THE NEXT VALIDATION</span><h3>Plan the field check, then verify the result.</h3><div className="desk-role-controls" role="group" aria-label="Select professional perspective">{([{ key: "ministry", label: "Ministry / policy" }, { key: "engineer", label: "Agricultural engineer" }, { key: "researcher", label: "Research scientist" }] as const).map(r => <button key={r.key} type="button" aria-pressed={role === r.key} className={role === r.key ? "selected" : ""} onClick={() => setRole(r.key)}>{r.label}</button>)}</div><ol>{reviewActions(role, selectedItem?.category ?? "unavailable").map(a => <li key={a}>{a}</li>)}</ol><div className="desk-data-quality"><div><ClipboardCheck size={17}/><strong>Source integrity</strong><span>{selectedItem?.latestObservation?.source_sha256 ? "NASA response checksum recorded" : "Source checksum unavailable"}</span></div><div><ShieldAlert size={17}/><strong>Field validation</strong><span>Not completed for this site</span></div><div><Database size={17}/><strong>AI forecasting</strong><span>Not trained or validated for field decisions</span></div></div><div className="desk-actions-bottom"><button type="button" onClick={download} disabled={!latest || !selectedItem?.latestObservation}><Download size={16}/> Download screening evidence</button><button type="button" onClick={onInvestigate}>Open scientific workbench <ArrowUpRight size={16}/></button></div></section>
        <ProbeVerificationCard key={selected} siteId={selected} siteName={place.name} modelCategory={selectedItem?.category ?? "unavailable"} modelDate={selectedItem?.latestDate ?? null} perspective={role}/>
      </div>
    </div>
    <footer className="desk-method"><h3>Research protocol and limits</h3><p>{sites.length} sampled NASA POWER/MERRA-2 land-model points. A modeled mismatch means surface seasonal percentile ≥40 and root-zone percentile below 40. The monthly reference uses 1991–2020 climatology and 1981–2025 historical summaries. No interpolation, administrative-area ranking, independent in-situ validation, crop-specific diagnosis, irrigation scheduling, or operational forecast is claimed.</p><div><a href="https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/" target="_blank" rel="noreferrer">NASA POWER provenance <ExternalLink size={14}/></a><a href="https://nsidc.org/data/spl4smgp" target="_blank" rel="noreferrer">Independent product comparison: SMAP L4 <ExternalLink size={14}/></a><a href="https://ismn.earth/" target="_blank" rel="noreferrer">Field validation network: ISMN <ExternalLink size={14}/></a></div><p><AlertCircle size={15}/> SMAP L4 is also model-assimilated and shares related modeling assumptions. Cross-product agreement alone cannot verify farm conditions.</p></footer>
  </section>;
}
