import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, ChevronDown, CircleHelp, Download, ExternalLink, Globe2, MapPinned, Microscope, RefreshCcw, ShieldCheck } from "lucide-react";
import { getAnalysis, formatLag, medianPositiveLag, verdictLabel, type Analysis, type RecoveryEvent } from "../lib/api";
import { findSite, siteCoordinates, sites, type SiteId } from "../lib/sites";
import { EventInspector } from "./EventInspector";
import EvidencePanel from "./EvidencePanel";
import ResearchConclusion from "./ResearchConclusion";

const GeoExplorer = lazy(() => import("./GeoExplorer"));
const EarthGlobe = lazy(() => import("./EarthGlobe"));
const SoilDepthExplorer = lazy(() => import("./SoilDepthExplorer"));
const MoistureChart = lazy(() => import("./ScientificCharts").then(module => ({ default: module.MoistureChart })));
const AnnualChart = lazy(() => import("./ScientificCharts").then(module => ({ default: module.AnnualChart })));
const SensitivityChart = lazy(() => import("./ScientificCharts").then(module => ({ default: module.SensitivityChart })));

type Step = "layers" | "events" | "confidence";
type MapMode = "atlas" | "globe";
type EventFilter = "all" | "surface" | "incomplete";

function dateLabel(date: string | null) {
  if (!date) return "Not observed";
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function statusLabel(event: RecoveryEvent) {
  if (event.status === "COMPLETE_SURFACE_FIRST") return "Surface first";
  if (event.status === "ROOT_FIRST") return "Root zone first";
  if (event.status === "SIMULTANEOUS") return "Same day";
  if (event.status === "NO_SURFACE_RECOVERY") return "Surface not recovered";
  return "Incomplete";
}

function EvidenceDownload({ site, analysis }: { site: string; analysis: Analysis }) {
  function download() {
    const payload = {
      project: "ROOTSHADOW",
      study_location: site,
      evidence_status: "Exploratory historical model screening; not validated farm advice",
      generated_from: "Verified NASA POWER historical model results",
      analysis
    };
    const text = JSON.stringify(payload, null, 2);
    const objectUrl = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "rootshadow-" + site.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-") + "-evidence.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }
  return <button type="button" className="guided-export" onClick={download}><Download size={16} /> Download evidence</button>;
}

function TabButton({ active, number, name, hint, onClick }: { active: boolean; number: string; name: string; hint: string; onClick: () => void }) {
  return <button type="button" className={"guided-tab" + (active ? " active" : "")} aria-pressed={active} onClick={onClick}><small>{number}</small><span><strong>{name}</strong><em>{hint}</em></span><ArrowRight size={17} /></button>;
}

export default function GuidedWorkspace({ selected, onSelect }: { selected: SiteId; onSelect: (id: SiteId) => void }) {
  const [step, setStep] = useState<Step>("layers");
  const [mapMode, setMapMode] = useState<MapMode>("atlas");
  const [filter, setFilter] = useState<EventFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const [event, setEvent] = useState<RecoveryEvent | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [comparison, setComparison] = useState<SiteId | "none">("none");
  const location = findSite(selected);
  const query = useQuery({ queryKey: ["site-analysis", selected], queryFn: ({ signal }) => getAnalysis(selected, signal) });
  const compareQuery = useQuery({ queryKey: ["site-analysis", comparison], queryFn: ({ signal }) => getAnalysis(comparison as SiteId, signal), enabled: step === "confidence" && comparison !== "none" && comparison !== selected });
  const analysis = query.data;
  const positives = useMemo(() => analysis?.events.filter(item => item.status === "COMPLETE_SURFACE_FIRST") ?? [], [analysis]);
  const median = analysis ? medianPositiveLag(analysis.events) : null;
  const filteredEvents = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.events]
      .filter(item => filter === "all" || (filter === "surface" ? item.status === "COMPLETE_SURFACE_FIRST" : item.recovery_delay_days === null))
      .sort((a, b) => b.drought_start.localeCompare(a.drought_start));
  }, [analysis, filter]);
  const displayedEvents = expanded ? filteredEvents : filteredEvents.slice(0, 12);
  useEffect(() => {
    setEvent(null);
    setMonth(null);
    setFilter("all");
    setExpanded(false);
    setComparison("none");
  }, [selected]);

  function activate(next: Step) {
    setStep(next);
    document.getElementById("guided-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="guided-workspace">
    <header className="guided-page-head">
      <div><span className="guided-overline">ROOTSHADOW / RESEARCH WORKSPACE</span><h1>See what the soil is telling us.</h1><p>Choose a research location, compare the surface and deeper soil, then investigate the evidence.</p></div>
      <label className="guided-location-picker" htmlFor="site-select"><span>STUDY LOCATION</span><div><MapPinned size={17} /><select id="site-select" value={selected} onChange={e => onSelect(e.target.value as SiteId)}>{sites.map(site => <option value={site.id} key={site.id}>{site.name} · {site.country}</option>)}</select><ChevronDown size={16} /></div></label>
    </header>

    <div className="guided-overview">
      <section className="guided-map-panel" aria-label="Choose a study location on the world map">
        <div className="guided-map-top"><div><span className="guided-overline">01 / FIND A PLACE</span><h2>Explore the study locations</h2></div><div className="guided-map-mode" role="group" aria-label="Map viewing mode"><button type="button" aria-pressed={mapMode === "atlas"} className={mapMode === "atlas" ? "active" : ""} onClick={() => setMapMode("atlas")}>World map</button><button type="button" aria-pressed={mapMode === "globe"} className={mapMode === "globe" ? "active" : ""} onClick={() => setMapMode("globe")}>3D Earth</button></div></div>
        <Suspense fallback={<div className="guided-map-loader" role="status">Loading the geographic explorer…</div>}>{mapMode === "atlas" ? <GeoExplorer selected={selected} onSelect={onSelect} variant="light" /> : <EarthGlobe selected={selected} onSelect={onSelect} />}</Suspense>
        <div className="guided-map-footer"><span><Globe2 size={15} /> Select a marked research point to see its history.</span><span>4 verified study points · Not field boundaries</span></div>
      </section>
      <aside className="guided-finding" aria-live="polite" aria-label="Selected location research finding">
        <span className="guided-overline">02 / THE RESULT</span>
        <h2>{location.name}</h2>
        <p className="guided-location-detail">{location.landscape} · {location.country}</p>
        <p className="guided-coordinates">{siteCoordinates(location)}</p>
        {query.isPending && <div className="guided-fetch-status" role="status"><div className="loading-ring" /><h3>Reading the NASA record</h3><p>Verifying historical model output for this location.</p></div>}
        {query.isError && <div className="guided-fetch-error" role="alert"><ShieldCheck size={22} /><h3>Analysis unavailable</h3><p>{query.error.message}</p><button type="button" onClick={() => query.refetch()}><RefreshCcw size={15} /> Retry analysis</button></div>}
        {analysis && <>
          <div className="guided-headline-figure"><span className="guided-large-number">{positives.length}<small> / {analysis.events.length}</small></span><p>detected drought episodes had <strong>surface recovery before deeper soil recovery</strong>.</p></div>
          <p className="guided-explanation">In the historical model, the upper soil layer recovered first in these episodes. This is a reason to investigate deeper moisture, <strong>not proof a farm is dry today.</strong></p>
          <div className="guided-quick-stats">
            <div className="metric-box"><span className="metric-label">Drought episodes</span><strong className="metric-value">{analysis.events.length}</strong><small>Detected in 1981–2025</small></div>
            <div className="metric-box"><span className="metric-label">Surface-first events</span><strong className="metric-value">{positives.length}</strong><small>Completed recoveries</small></div>
            <div className="metric-box"><span className="metric-label">Median positive delay</span><strong className="metric-value">{median === null ? "—" : median + " d"}</strong><small>Across surface-first events</small></div>
          </div>
          <div className="guided-reliability"><ShieldCheck size={16} /> Historical NASA POWER model · Exploratory research · Not a live sensor</div>
          <button type="button" className="guided-next-button" onClick={() => activate("layers")}>Explore the soil layers <ArrowRight size={17} /></button>
        </>}
      </aside>
    </div>

    <div id="guided-analysis" className="guided-investigation">
      <div className="guided-progress-head"><div><span className="guided-overline">FOLLOW THE EVIDENCE</span><h2>One investigation, three ways to explore.</h2></div><span>1981–2025 · Fixed 1991–2020 seasonal baseline</span></div>
      <nav className="guided-tabs" aria-label="Investigation steps">
        <TabButton active={step === "layers"} number="01" name="Soil over time" hint="What changed below ground?" onClick={() => setStep("layers")} />
        <TabButton active={step === "events"} number="02" name="Drought events" hint="Which episodes were different?" onClick={() => setStep("events")} />
        <TabButton active={step === "confidence"} number="03" name="Check the evidence" hint="How much can we conclude?" onClick={() => setStep("confidence")} />
      </nav>

      {query.isPending && <div className="guided-content-pending" role="status">Preparing the research tools for {location.name}…</div>}
      {query.isError && <div className="guided-content-pending">Choose another study location or retry the analysis above.</div>}
      {analysis && step === "layers" && <section aria-label="Soil layer history" className="guided-step-content">
        <div className="guided-step-intro"><span className="guided-overline">01 / UNDERSTAND THE LAYERS</span><h3>Two depths. Two recovery timelines.</h3><p>Drag the time slider to any month in the historical record. The soil illustration and the graph below follow the same selected month.</p></div>
        <div className="guided-plain-explainer"><div><span className="guided-dot surface" /><strong>Surface soil</strong><small>The upper modeled soil layer. It can respond sooner to rain.</small></div><div><span className="guided-dot deep" /><strong>Root-zone soil</strong><small>Deeper modeled water storage. Recovery may be faster, slower, or incomplete.</small></div><details><summary><CircleHelp size={15} /> What does “percentile” mean?</summary><p>These are ranks compared with the same season in a historical baseline. They are not percentages of soil water content. A 20th-percentile reading is unusually dry relative to that season.</p></details></div>
        <div className="guided-depth-tool"><Suspense fallback={<div className="guided-content-pending">Loading the soil-depth explorer…</div>}><SoilDepthExplorer key={selected} analysis={analysis} onMonthChange={setMonth} /></Suspense></div>
        <div className="guided-chart-tool"><div className="guided-section-strap"><span>HISTORICAL CHART / BOTH LAYERS</span><small>Zoom or select a drought event to examine a shorter period.</small></div><Suspense fallback={<div className="guided-content-pending">Loading the time-series chart…</div>}><MoistureChart analysis={analysis} event={event} highlightedMonth={month} /></Suspense></div>
        {event && <p className="guided-selected-episode">Selected event: {dateLabel(event.drought_start)} · {statusLabel(event)} · {formatLag(event.recovery_delay_days)} <button onClick={() => activate("events")} type="button">Inspect details</button></p>}
        <div className="guided-step-next"><span>Next: inspect individual drought episodes.</span><button type="button" onClick={() => activate("events")}>Open drought event table <ArrowRight size={17} /></button></div>
      </section>}

      {analysis && step === "events" && <section aria-label="Drought event table" className="guided-step-content">
        <div className="guided-step-intro"><span className="guided-overline">02 / EXAMINE THE EPISODES</span><h3>Which droughts recovered differently?</h3><p>Each row is an event detected in historical model data. Select one to see when drought began, when the surface recovered, and when the root zone followed.</p></div>
        <div className="guided-table-controls"><div className="guided-filters" role="group" aria-label="Filter drought events"><button type="button" className={filter === "all" ? "active" : ""} aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setExpanded(false); }}>All events ({analysis.events.length})</button><button type="button" className={filter === "surface" ? "active" : ""} aria-pressed={filter === "surface"} onClick={() => { setFilter("surface"); setExpanded(false); }}>Surface first ({positives.length})</button><button type="button" className={filter === "incomplete" ? "active" : ""} aria-pressed={filter === "incomplete"} onClick={() => { setFilter("incomplete"); setExpanded(false); }}>Incomplete ({analysis.events.filter(item => item.recovery_delay_days === null).length})</button></div><span>{filteredEvents.length} matching events</span></div>
        <div className="guided-table-scroll"><table className="guided-event-table"><thead><tr><th scope="col">Drought began</th><th scope="col">Surface recovered</th><th scope="col">Root zone recovered</th><th scope="col">Difference</th><th scope="col">Interpretation</th></tr></thead><tbody>{displayedEvents.map(item => <tr key={item.drought_start + item.drought_end} className={event?.drought_start === item.drought_start ? "active" : ""}><td><button type="button" onClick={() => setEvent(item)} aria-pressed={event?.drought_start === item.drought_start}>{dateLabel(item.drought_start)} <ArrowUpRight size={13} /></button></td><td>{dateLabel(item.surface_recovery)}</td><td>{dateLabel(item.root_recovery)}</td><td><strong>{item.recovery_delay_days === null ? "Not complete" : formatLag(item.recovery_delay_days)}</strong></td><td><span className={"guided-event-status " + (item.status === "COMPLETE_SURFACE_FIRST" ? "surface-first" : "")}>{statusLabel(item)}</span></td></tr>)}</tbody></table></div>
        {filteredEvents.length > 12 && <button type="button" className="guided-expand-events" onClick={() => setExpanded(value => !value)}>{expanded ? "Show first 12 events" : "Show all " + filteredEvents.length + " events"}</button>}
        <div className="guided-event-detail"><div><span className="guided-overline">SELECTED EPISODE</span><h4>{event ? dateLabel(event.drought_start) : "Choose a row to inspect the recovery"}</h4></div><EventInspector event={event} />{event && <button type="button" className="guided-next-button" onClick={() => activate("layers")}>View this event on the timeline <ArrowRight size={16} /></button>}</div>
        <div className="guided-step-next"><span>Next: check whether the finding holds up scientifically.</span><button type="button" onClick={() => activate("confidence")}>Check the research evidence <ArrowRight size={17} /></button></div>
      </section>}

      {analysis && step === "confidence" && <section aria-label="Scientific evidence and comparisons" className="guided-step-content">
        <div className="guided-step-intro"><span className="guided-overline">03 / INTERPRET THE RESULT</span><h3>What can we conclude?</h3><p>The model identifies historical differences between soil layers. It does not confirm a climate trend, field-scale water shortage, or an irrigation recommendation.</p></div>
        <div className="guided-trust-summary"><ShieldCheck size={22} /><div><strong>{verdictLabel(analysis.audit.verdict)}</strong><p>{analysis.audit.explanation}</p></div><span>Exploratory software audit</span></div>
        <div className="guided-evidence-panel"><EvidencePanel analysis={analysis} advanced /></div>
        <section className="guided-comparison" aria-label="Compare two research locations"><div className="guided-section-strap"><span>COMPARE STUDY LOCATIONS</span><small>Same scientific method; independent field validation not yet completed.</small></div><div className="guided-compare-control"><label htmlFor="guided-compare-select">Compare {location.name} with</label><select id="guided-compare-select" value={comparison} onChange={e => setComparison(e.target.value as SiteId | "none")}><option value="none">Choose another location</option>{sites.filter(item => item.id !== selected).map(item => <option key={item.id} value={item.id}>{item.name} · {item.country}</option>)}</select></div>{compareQuery.isPending && comparison !== "none" && <p>Loading the comparison…</p>}{compareQuery.isError && <p role="alert">Comparison unavailable: {compareQuery.error.message}</p>}{compareQuery.data && comparison !== "none" && <div className="guided-compare-stats"><div><strong>{location.name}</strong><span>{analysis.events.length} episodes</span><small>{positives.length} surface-first</small></div><span>COMPARED WITH</span><div><strong>{findSite(comparison).name}</strong><span>{compareQuery.data.events.length} episodes</span><small>{compareQuery.data.events.filter(item => item.status === "COMPLETE_SURFACE_FIRST").length} surface-first</small></div></div>}</section>
        <div className="guided-science-charts"><section><span className="guided-overline">ANNUAL MISMATCH DAYS</span><h4>Did mismatches change over time?</h4><Suspense fallback={<div className="guided-content-pending">Loading annual trend…</div>}><AnnualChart analysis={analysis} comparison={compareQuery.data} comparisonName={comparison !== "none" ? findSite(comparison).name : undefined} /></Suspense></section><section><span className="guided-overline">THRESHOLD SENSITIVITY</span><h4>Would another threshold change the result?</h4><Suspense fallback={<div className="guided-content-pending">Loading robustness checks…</div>}><SensitivityChart analysis={analysis} /></Suspense></section></div>
        <details className="guided-full-report"><summary><Microscope size={18} /> Read the complete research interpretation <ChevronDown size={17} /></summary><ResearchConclusion analysis={analysis} siteName={location.name} onResearch={() => setStep("confidence")} onEvents={() => setStep("events")} /></details>
      </section>}
    </div>

    <footer className="guided-footer"><div><span className="guided-overline">DATA & LIMITATIONS</span><p>Historical NASA POWER / MERRA-2 gridded wetness, not a field sensor. This four-location prototype cannot diagnose the moisture of an individual farm or prescribe irrigation. Findings require independent validation.</p><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER source <ExternalLink size={14} /></a></div>{analysis && <EvidenceDownload site={location.name} analysis={analysis} />}</footer>
  </div>;
}
