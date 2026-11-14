import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, ChevronDown, Download, ExternalLink, Globe2, MapPinned, Microscope, RefreshCcw, ShieldCheck } from "lucide-react";
import { getAnalysis, formatLag, medianPositiveLag, verdictLabel, type Analysis, type RecoveryEvent } from "../lib/api";
import { findSite, productSites, researchSites, siteCoordinates, siteRegions, sites, type SiteId } from "../lib/sites";
import { EventInspector } from "./EventInspector";
import EvidencePanel from "./EvidencePanel";
import ResearchConclusion from "./ResearchConclusion";
import VisualSoilGuide from "./VisualSoilGuide";

const GeoExplorer = lazy(() => import("./GeoExplorer"));
const EarthGlobe = lazy(() => import("./EarthGlobe"));
const MoistureAtlas = lazy(() => import("./MoistureAtlas"));
const SoilDepthExplorer = lazy(() => import("./SoilDepthExplorer"));
const MoistureChart = lazy(() => import("./ScientificCharts").then(module => ({ default: module.MoistureChart })));
const AnnualChart = lazy(() => import("./ScientificCharts").then(module => ({ default: module.AnnualChart })));
const SensitivityChart = lazy(() => import("./ScientificCharts").then(module => ({ default: module.SensitivityChart })));

type Step = "layers" | "events" | "confidence";
type MapMode = "atlas" | "globe" | "surface" | "root" | "mismatch";
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
  const [decade, setDecade] = useState("all");
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
      .filter(item => (filter === "all" || (filter === "surface" ? item.status === "COMPLETE_SURFACE_FIRST" : item.recovery_delay_days === null)) && (decade === "all" || Math.floor(Number(item.drought_start.slice(0,4)) / 10) * 10 === Number(decade)))
      .sort((a, b) => b.drought_start.localeCompare(a.drought_start));
  }, [analysis, filter, decade]);
  const displayedEvents = expanded ? filteredEvents : filteredEvents.slice(0, 12);
  useEffect(() => {
    setEvent(null);
    setMonth(null);
    setFilter("all");
    setDecade("all");
    setExpanded(false);
    setComparison("none");
  }, [selected]);

  function activate(next: Step) {
    setStep(next);
    document.getElementById("guided-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="guided-workspace">
    <header className="guided-page-head">
      <div><span className="guided-overline">EXPLORE THE LAND</span><h1>What happens beneath the surface?</h1><p>Choose a place. See the result. Explore its soil history.</p></div>
      <label className="guided-location-picker" htmlFor="site-select"><span>STUDY LOCATION</span><div><MapPinned size={17} /><select id="site-select" value={selected} onChange={e => onSelect(e.target.value as SiteId)}><optgroup label="Original six research sites">{researchSites.map(site => <option value={site.id} key={site.id}>{site.name} · {site.country}</option>)}</optgroup>{siteRegions.map(region => <optgroup key={region} label={region}>{productSites.filter(site => site.region === region).map(site => <option value={site.id} key={site.id}>{site.name} · {site.country}</option>)}</optgroup>)}</select><ChevronDown size={16} /></div></label>
    </header>

    <div className="guided-overview">
      <section className="guided-map-panel" aria-label="Choose a study location on the world map">
        <div className="guided-map-top"><div><span className="guided-overline">01 / FIND A PLACE</span><h2>Explore the study locations</h2></div><div className="guided-map-mode" role="group" aria-label="Map viewing mode"><button type="button" aria-pressed={mapMode === "atlas"} className={mapMode === "atlas" ? "active" : ""} onClick={() => setMapMode("atlas")}>World map</button><button type="button" aria-pressed={mapMode === "globe"} className={mapMode === "globe" ? "active" : ""} onClick={() => setMapMode("globe")}>3D Earth</button><button type="button" aria-pressed={mapMode === "surface"} className={mapMode === "surface" ? "active" : ""} onClick={() => setMapMode("surface")}>Surface moisture</button><button type="button" aria-pressed={mapMode === "root"} className={mapMode === "root" ? "active" : ""} onClick={() => setMapMode("root")}>Root-zone moisture</button><button type="button" aria-pressed={mapMode === "mismatch"} className={mapMode === "mismatch" ? "active" : ""} onClick={() => setMapMode("mismatch")}>Layer mismatch</button></div></div>
        <Suspense fallback={<div className="guided-map-loader" role="status">Loading the geographic explorer…</div>}>{mapMode === "atlas" ? <GeoExplorer selected={selected} onSelect={onSelect} variant="light" /> : mapMode === "globe" ? <EarthGlobe selected={selected} onSelect={onSelect} /> : <MoistureAtlas selected={selected} onSelect={onSelect} layer={mapMode} />}</Suspense>
        <div className="guided-map-footer"><span><Globe2 size={15} /> Select a model point, switch between five geographic views, or scrub a historical month.</span><span>{sites.length} verified model points · 6 original research sites · Not field boundaries</span></div>
      </section>
      <aside className="guided-finding" aria-live="polite" aria-label="Selected location research finding">
        <span className="guided-overline">02 / THE FINDING</span>
        <h2>{location.name}</h2>
        <p className="guided-location-detail">{location.landscape} · {location.country}</p>
        <p className="guided-coordinates">{siteCoordinates(location)}</p>
        {query.isPending && <div className="guided-fetch-status" role="status"><div className="loading-ring" /><h3>Reading the NASA record</h3><p>Verifying historical model output for this location.</p></div>}
        {query.isError && <div className="guided-fetch-error" role="alert"><ShieldCheck size={22} /><h3>Analysis unavailable</h3><p>{query.error.message}</p><button type="button" onClick={() => query.refetch()}><RefreshCcw size={15} /> Retry analysis</button></div>}
        {analysis && <>
          <div className="guided-headline-figure"><span className="guided-large-number">{positives.length}<small> / {analysis.events.length}</small></span><p>detected drought episodes had <strong>surface recovery before deeper soil recovery</strong>.</p></div>
          <p className="guided-explanation">The surface can look recovered while deeper soil is still recovering. <strong>Historical model only—not a live farm measurement.</strong></p>
          {selected === "southern_africa" && <p className="guided-unique-caution">Sensitivity alert: the 25-day median at the default recovery threshold falls to 3.5 days under another threshold. Treat it as uncertain.</p>}
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
      <div className="guided-progress-head"><div><span className="guided-overline">EXPLORE THE RESULTS</span><h2>See the layers. Check the history.</h2></div><span>1981–2025 · Fixed 1991–2020 seasonal baseline</span></div>
      <nav className="guided-tabs" aria-label="Investigation steps">
        <TabButton active={step === "layers"} number="01" name="Soil over time" hint="What changed below ground?" onClick={() => setStep("layers")} />
        <TabButton active={step === "events"} number="02" name="Drought events" hint="Which episodes were different?" onClick={() => setStep("events")} />
        <TabButton active={step === "confidence"} number="03" name="The takeaway" hint="What did we learn?" onClick={() => setStep("confidence")} />
      </nav>

      {query.isPending && <div className="guided-content-pending" role="status">Preparing the research tools for {location.name}…</div>}
      {query.isError && <div className="guided-content-pending">Choose another study location or retry the analysis above.</div>}
      {analysis && step === "layers" && <section aria-label="Soil layer history" className="guided-step-content">
        <div className="guided-step-intro"><span className="guided-overline">01 / FOLLOW THE WATER</span><h3>When does deeper soil catch up?</h3><p>Move the month slider. Watch both soil layers change together.</p></div>
        <div className="guided-plain-explainer"><div><span className="guided-dot surface" /><strong>Surface soil</strong><small>Usually responds to rain sooner</small></div><div><span className="guided-dot deep" /><strong>Root-zone soil</strong><small>Deeper storage that roots may access</small></div></div>
        <div className="guided-depth-tool"><Suspense fallback={<div className="guided-content-pending">Loading the soil-depth explorer…</div>}><SoilDepthExplorer key={selected} analysis={analysis} synchronizedMonth={month} onMonthChange={setMonth} /></Suspense></div>
        <VisualSoilGuide analysis={analysis} month={month} />
        <div className="guided-chart-tool"><div className="guided-section-strap"><span>WATCH THE LAYERS OVER TIME</span><small>Zoom to explore a particular month or event.</small></div><div className="visual-chart-key"><span><i className="visual-line threshold" />Dashed: 20 dry / 40 recovery</span><span><i className="visual-line selected" />Vertical: selected month</span></div><p className="visual-chart-message">Higher = wetter compared with that season’s history; not percent water.</p><Suspense fallback={<div className="guided-content-pending">Loading the time-series chart…</div>}><MoistureChart analysis={analysis} event={event} highlightedMonth={month} siteId={selected} onMonthSelect={setMonth} /></Suspense></div>
        {event && <p className="guided-selected-episode">Selected event: {dateLabel(event.drought_start)} · {statusLabel(event)} · {formatLag(event.recovery_delay_days)} <button onClick={() => activate("events")} type="button">Inspect details</button></p>}
        <div className="guided-step-next"><span>Next: inspect individual drought episodes.</span><button type="button" onClick={() => activate("events")}>Open drought event table <ArrowRight size={17} /></button></div>
      </section>}

      {analysis && step === "events" && <section aria-label="Drought event table" className="guided-step-content">
        <div className="guided-step-intro"><span className="guided-overline">02 / EXAMINE THE EPISODES</span><h3>Which droughts recovered differently?</h3><p>Select an event to see the recovery sequence. Positive delay means the root zone recovered later; missing dates mean recovery was not observed.</p></div>
        <div className="guided-table-controls"><div className="guided-filters" role="group" aria-label="Filter drought events"><button type="button" className={filter === "all" ? "active" : ""} aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setExpanded(false); }}>All events ({analysis.events.length})</button><button type="button" className={filter === "surface" ? "active" : ""} aria-pressed={filter === "surface"} onClick={() => { setFilter("surface"); setExpanded(false); }}>Surface first ({positives.length})</button><button type="button" className={filter === "incomplete" ? "active" : ""} aria-pressed={filter === "incomplete"} onClick={() => { setFilter("incomplete"); setExpanded(false); }}>Incomplete ({analysis.events.filter(item => item.recovery_delay_days === null).length})</button></div><label className="guided-decade-filter">Period <select aria-label="Filter drought events by decade" value={decade} onChange={e => { setDecade(e.target.value); setExpanded(false); }}><option value="all">All years</option><option value="1980">1981–89</option><option value="1990">1990s</option><option value="2000">2000s</option><option value="2010">2010s</option><option value="2020">2020–25</option></select></label><span>{filteredEvents.length} matching events</span></div>
        <div className="guided-table-scroll"><table className="guided-event-table"><thead><tr><th scope="col">Drought began</th><th scope="col">Surface recovered</th><th scope="col">Root zone recovered</th><th scope="col">Difference</th><th scope="col">Interpretation</th></tr></thead><tbody>{displayedEvents.map(item => <tr key={item.drought_start + item.drought_end} className={event?.drought_start === item.drought_start ? "active" : ""}><td><button type="button" onClick={() => setEvent(item)} aria-pressed={event?.drought_start === item.drought_start}>{dateLabel(item.drought_start)} <ArrowUpRight size={13} /></button></td><td>{dateLabel(item.surface_recovery)}</td><td>{dateLabel(item.root_recovery)}</td><td><strong>{item.recovery_delay_days === null ? "Not complete" : formatLag(item.recovery_delay_days)}</strong></td><td><span className={"guided-event-status " + (item.status === "COMPLETE_SURFACE_FIRST" ? "surface-first" : "")}>{statusLabel(item)}</span></td></tr>)}</tbody></table></div>
        {filteredEvents.length > 12 && <button type="button" className="guided-expand-events" onClick={() => setExpanded(value => !value)}>{expanded ? "Show first 12 events" : "Show all " + filteredEvents.length + " events"}</button>}
        <div className="guided-event-detail"><div><span className="guided-overline">SELECTED EPISODE</span><h4>{event ? dateLabel(event.drought_start) : "Choose a row to inspect the recovery"}</h4></div><EventInspector event={event} />{event && <button type="button" className="guided-next-button" onClick={() => activate("layers")}>View this event on the timeline <ArrowRight size={16} /></button>}</div>
        <div className="guided-step-next"><span>Next: check whether the finding holds up scientifically.</span><button type="button" onClick={() => activate("confidence")}>See the conclusion <ArrowRight size={17} /></button></div>
      </section>}

      {analysis && step === "confidence" && <section aria-label="Scientific evidence and comparisons" className="guided-step-content">
        <div className="guided-step-intro"><span className="guided-overline">03 / THE TAKEAWAY</span><h3>What do these results mean?</h3><p>One clear answer for this location. Explore the science only if you want more detail.</p></div>
        <div className="guided-simple-conclusion" role="region" aria-label="Results at a glance">
          <div className="guided-simple-number"><span className="guided-overline">SURFACE FIRST</span><strong>{positives.length}<small> / {analysis.events.length}</small></strong><div className="guided-proportion" role="img" aria-label={positives.length + " of " + analysis.events.length + " historical episodes recovered at the surface first"}><i style={{ width: (analysis.events.length ? 100 * positives.length / analysis.events.length : 0) + "%" }} /></div><small>historical drought episodes at this model point</small></div>
          <div className="guided-simple-meaning"><span className="guided-overline">WHAT WE FOUND</span><h4>Surface recovery doesn't always mean deeper recovery.</h4><p>Some past droughts recovered at the surface first. This is a historical screening result, <strong>not a forecast or a field measurement.</strong></p><div className="guided-next-step"><strong>What should someone check?</strong> Current local soil-depth readings, rainfall and crop conditions before deciding what to do.</div></div>
        </div>
        <details className="guided-audit-details"><summary><ShieldCheck size={16} /> Evidence quality and statistical checks <span>{verdictLabel(analysis.audit.verdict)}</span><ChevronDown size={16} /></summary><div className="guided-evidence-panel"><EvidencePanel analysis={analysis} advanced /></div></details>
        <section className="guided-comparison" aria-label="Compare two research locations"><div className="guided-section-strap"><span>COMPARE STUDY LOCATIONS</span><small>Same NASA model-based method, not field observations.</small></div><div className="guided-compare-control"><label htmlFor="guided-compare-select">Compare {location.name} with</label><select id="guided-compare-select" value={comparison} onChange={e => setComparison(e.target.value as SiteId | "none")}><option value="none">Choose another location</option>{sites.filter(item => item.id !== selected).map(item => <option key={item.id} value={item.id}>{item.name} · {item.country}</option>)}</select></div>{compareQuery.isPending && comparison !== "none" && <p>Loading the comparison…</p>}{compareQuery.isError && <p role="alert">Comparison unavailable: {compareQuery.error.message}</p>}{compareQuery.data && comparison !== "none" && <div className="guided-compare-stats"><div><strong>{location.name}</strong><span>{analysis.events.length} episodes</span><small>{positives.length} surface-first</small></div><span>COMPARED WITH</span><div><strong>{findSite(comparison).name}</strong><span>{compareQuery.data.events.length} episodes</span><small>{compareQuery.data.events.filter(item => item.status === "COMPLETE_SURFACE_FIRST").length} surface-first</small></div></div>}</section>
        <details className="guided-science-detail"><summary>Explore advanced graphs <ChevronDown size={17} /></summary><div className="guided-science-charts"><section><span className="guided-overline">ANNUAL MISMATCH DAYS</span><h4>Did mismatches change over time?</h4><p className="visual-chart-message">Each bar = days in one year when the model shows the surface had recovered but the roots had not. Taller bars do not prove crop losses.</p><Suspense fallback={<div className="guided-content-pending">Loading annual trend…</div>}><AnnualChart analysis={analysis} comparison={compareQuery.data} comparisonName={comparison !== "none" ? findSite(comparison).name : undefined} /></Suspense></section><section><span className="guided-overline">THRESHOLD SENSITIVITY</span><h4>Would another threshold change the result?</h4><p className="visual-chart-message">Nine versions of the analysis. Different colors or signs mean the conclusion changes when we adjust the rules.</p><Suspense fallback={<div className="guided-content-pending">Loading robustness checks…</div>}><SensitivityChart analysis={analysis} /></Suspense></section></div></details>
        <details className="guided-full-report"><summary><Microscope size={18} /> Read the complete research interpretation <ChevronDown size={17} /></summary><ResearchConclusion analysis={analysis} siteName={location.name} onResearch={() => setStep("confidence")} onEvents={() => setStep("events")} /></details>
      </section>}
    </div>

    <footer className="guided-footer"><div><span className="guided-overline">DATA & LIMITATIONS</span><p>Historical NASA POWER / MERRA-2 gridded wetness, not a field sensor. These 97 selected historical model points cannot diagnose the moisture of an individual farm or prescribe irrigation. Findings require independent validation.</p><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER source <ExternalLink size={14} /></a></div>{analysis && <EvidenceDownload site={location.name} analysis={analysis} />}</footer>
  </div>;
}
