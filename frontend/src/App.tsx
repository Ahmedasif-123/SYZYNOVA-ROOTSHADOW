import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, BookOpenText, CheckCircle2, ChevronDown,
  CircleHelp, Database, Download, ExternalLink, Fingerprint, Globe2, Layers3, Leaf,
  Menu, Microscope, MousePointer2, RefreshCcw, Search, ShieldCheck, X
} from "lucide-react";
import { getAnalysis, medianPositiveLag, verdictLabel, type RecoveryEvent } from "./lib/api";
import { findSite, siteCoordinates, sites, type SiteId } from "./lib/sites";

import { EventInspector, EventList } from "./components/EventInspector";
import EvidencePanel from "./components/EvidencePanel";
import ResearchConclusion from "./components/ResearchConclusion";

const GeoExplorer = lazy(() => import("./components/GeoExplorer"));
const GuidedWorkspace = lazy(() => import("./components/GuidedWorkspace"));
const EarthGlobe = lazy(() => import("./components/EarthGlobe"));
const SoilDepthExplorer = lazy(() => import("./components/SoilDepthExplorer"));
const MoistureChart = lazy(() => import("./components/ScientificCharts").then(module => ({ default: module.MoistureChart })));
const AnnualChart = lazy(() => import("./components/ScientificCharts").then(module => ({ default: module.AnnualChart })));
const SensitivityChart = lazy(() => import("./components/ScientificCharts").then(module => ({ default: module.SensitivityChart })));
type Page = "home" | "explore" | "method";
type Level = "simple" | "research";

function Brand({ condensed = false }: { condensed?: boolean }) {
  return <div className="brand-mark"><div className="brand-icon" aria-hidden="true"><span /><span /><span /></div><div className="brand-name">ROOT<span>SHADOW</span>{!condensed && <small>THE DROUGHT BENEATH THE RAIN</small>}</div></div>;
}

function Chip({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "active" | "caution" }) {
  return <span className={`chip chip-${variant}`}>{children}</span>;
}

function Metric({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <div className={`metric-box ${accent ? "metric-accent" : ""}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;
}

function formatDecimal(n: number | null, digits = 2) { return n === null ? "—" : n.toFixed(digits); }

function SoilVisual() {
  return (
    <div className="soil-visual" role="img" aria-label="Conceptual diagram of surface and root-zone moisture. Not an actual soil observation.">
      <div className="soil-top"><span>SURFACE LAYER</span><span>WETNESS CAN RETURN FIRST</span></div>
      <div className="rain-trace rain-one" /><div className="rain-trace rain-two" /><div className="rain-trace rain-three" />
      <div className="soil-ground" />
      <div className="soil-root"><span>ROOT ZONE</span><span>RECOVERY MAY FOLLOW LATER</span></div>
      <svg viewBox="0 0 320 220" className="root-diagram" aria-hidden="true"><path d="M155 0V105M155 36L114 78M155 50L193 102M155 88L133 142M133 142L100 175M133 142L151 191M193 102L220 165M220 165L244 192" /><path d="M114 78L89 114M193 102L167 154M167 154L161 200M100 175L82 208" /></svg>
      <div className="soil-readout"><span className="readout-led" />SAME RAINFALL · DIFFERENT RECOVERY</div>
      <div className="soil-visual-footer">Conceptual illustration, not field-scale NASA measurements</div>
    </div>
  );
}

function HomePage({ selected, onSelect, navigate }: { selected: SiteId; onSelect: (id: SiteId) => void; navigate: (p: Page) => void }) {
  const [view, setView] = useState<"globe" | "atlas">("globe");
  const current = findSite(selected);
  const findings = [
    { id: "us_sgp_goodwell" as SiteId, name: "Goodwell", region: "Oklahoma · United States", total: 31, positive: 19, median: 2 },
    { id: "us_sgp_stillwater" as SiteId, name: "Stillwater", region: "Oklahoma · United States", total: 26, positive: 6, median: 1 },
    { id: "australia_narrabri" as SiteId, name: "Narrabri", region: "New South Wales · Australia", total: 28, positive: 16, median: 1 },
    { id: "spain_cordoba" as SiteId, name: "Córdoba", region: "Andalusia · Spain", total: 25, positive: 6, median: 1 },
    { id: "argentina_pampas" as SiteId, name: "Argentine Pampas", region: "Pampas · Argentina", total: 27, positive: 11, median: 2 },
    { id: "southern_africa" as SiteId, name: "Southern Africa", region: "Interior · South Africa", total: 21, positive: 15, median: 25 }
  ];
  return <div className="rs-editorial">
    <section className="rs-hero">
      <div className="rs-hero-copy">
        <div className="rs-topline"><span>SYZYNOVA FIELD NOTES</span><span>EARTH SYSTEMS / 2026</span></div>
        <span className="rs-kicker">A RESEARCH INSTRUMENT FOR THE LAND BENEATH US</span>
        <h1>When rain returns,<br/><em>what happens</em><br/>below ground?</h1>
        <p className="rs-hero-intro">A landscape can appear recovered while deeper soil takes longer. We built ROOTSHADOW to investigate that invisible interval, not to assume every rainfall ends a drought.</p>
        <div className="rs-hero-actions">
          <button type="button" className="rs-primary-link" onClick={() => navigate("explore")}>Start investigating <ArrowUpRight size={18}/></button>
          <button type="button" className="rs-secondary-link" onClick={() => document.getElementById("rs-findings")?.scrollIntoView({ behavior: "smooth" })}>See what we found <ArrowRight size={16}/></button>
        </div>
        <div className="rs-hero-foot"><span>45 YEARS OF HISTORY</span><span>SIX VERIFIED RESEARCH POINTS</span><span>NO SYNTHETIC FINDINGS</span></div>
      </div>
      <div className="rs-earth-shell">
        <div className="rs-earth-header"><span>EXPLORE THE STUDY REGIONS</span><div><button className={view === "globe" ? "is-on" : ""} type="button" onClick={() => setView("globe")}>Earth</button><button className={view === "atlas" ? "is-on" : ""} type="button" onClick={() => setView("atlas")}>Map</button></div></div>
        <Suspense fallback={<div className="rs-map-loading">Preparing geographic model…</div>}>
          {view === "globe" ? <EarthGlobe selected={selected} onSelect={onSelect}/> : <GeoExplorer selected={selected} onSelect={onSelect}/>}
        </Suspense>
        <div className="rs-earth-footer"><span><strong>{current.name}</strong><small>{current.region}, {current.country}</small></span><button type="button" onClick={() => navigate("explore")}>Investigate this location <ArrowUpRight size={15}/></button></div>
      </div>
    </section>

    <section className="rs-narrative rs-problem">
      <aside className="rs-side-number">01 — THE QUESTION</aside>
      <div className="rs-narrative-body"><p className="rs-overline">WHAT WE CAN'T SEE FROM ABOVE</p><h2>Green above ground<br/>doesn't always mean<br/><em>recovered below.</em></h2><p>After a drought, the surface and deeper soil can recover at different times. That matters because the shallow layer is only part of the water story. To investigate the difference, we track both layers under the same recovery rule.</p><div className="rs-inline-rule"><span>Rainfall resumes</span><span>Surface responds</span><span>Root-zone response checked</span></div></div>
      <figure className="rs-soil-figure"><SoilVisual/><figcaption>Conceptual soil profile. The actual measurements in this study are gridded model estimates, not probes on a farm.</figcaption></figure>
    </section>

    <section className="rs-findings" id="rs-findings">
      <div className="rs-findings-header"><div><p className="rs-overline">02 — THE EVIDENCE</p><h2>Six places.<br/><em>Six different stories.</em></h2></div><p>We investigated 45 years of NASA POWER / MERRA-2 soil-wetness history at six selected agricultural model locations. The pattern exists in the modeled records, but it is not uniform.</p></div>
      <div className="rs-big-finding"><div className="rs-finding-ratio"><strong>73<span> / 158</span></strong><small>detected historical drought episodes had a completed surface-first recovery</small></div><div className="rs-finding-interpretation"><span>WHAT THAT NUMBER MEANS</span><p>About 46.2% of events at these six chosen model points recovered at the surface first. This is not a global drought rate.</p></div></div>
      <div className="rs-findings-table">
        <div className="rs-findings-labels"><span>LOCATION</span><span>COMPLETED SURFACE-FIRST / ALL EPISODES</span><span>MEDIAN GAP</span></div>
        {findings.map(item => <button key={item.id} className="rs-finding-row" type="button" onClick={() => { onSelect(item.id); navigate("explore"); }}>
          <span className="rs-find-place"><strong>{item.name}</strong><small>{item.region}</small></span>
          <span className="rs-find-bar"><i><b style={{ width: String(item.positive / item.total * 100) + "%" }}/></i><span>{item.positive} of {item.total} events</span></span>
          <span className="rs-find-delay">{item.median} <small>{item.median === 1 ? "day" : "days"}</small><ArrowUpRight size={16}/></span>
        </button>)}
      </div>
      <p className="rs-finding-limit"><strong>Important:</strong> No global trend has been demonstrated. Goodwell’s nominal trend fails the six-site multiple-testing threshold. The Southern Africa median is highly threshold-sensitive. Independent evidence is still needed.</p>
    </section>

    <section className="rs-solution">
      <div><p className="rs-overline">03 — WHAT WE BUILT</p><h2>Evidence first.<br/><em>Decisions second.</em></h2><p>ROOTSHADOW lets people follow an investigation instead of reading a dashboard. Pick a location. See the historical result. Test its sensitivity. Understand its limitations. Leave with evidence you can inspect.</p><button className="rs-primary-link" type="button" onClick={() => navigate("explore")}>Open the research workspace <ArrowUpRight size={18}/></button></div>
      <div className="rs-solution-notes">
        <div><span>INVESTIGATE</span><strong>Navigate from Earth to a local timeline.</strong><p>Follow actual modeled events at a research point, not an invented global animation.</p></div>
        <div><span>INTERROGATE</span><strong>Challenge the apparent result.</strong><p>Compare the soil layers, change context and inspect robustness and uncertainty.</p></div>
        <div><span>COMMUNICATE</span><strong>Take the evidence with you.</strong><p>Export the verified analysis and identify which field measurements are still missing.</p></div>
      </div>
    </section>

    <section className="rs-final-note"><span>THE NEXT SCIENTIFIC STEP</span><p>More locations and independent sources matter. SMAP L4, GLDAS and field measurements can provide additional comparisons; they have <strong>not</strong> yet been integrated into the published findings.</p><div><a href="https://nsidc.org/data/smap" target="_blank" rel="noreferrer">SMAP <ExternalLink size={13}/></a><a href="https://ldas.gsfc.nasa.gov/gldas" target="_blank" rel="noreferrer">GLDAS <ExternalLink size={13}/></a><button type="button" onClick={() => navigate("method")}>Read the limitations <ArrowRight size={15}/></button></div></section>
    <div className="rs-signature"><strong>ROOTSHADOW</strong><span>BY SYZYNOVA — MUHAMMAD AHMED & SOMAYA BAKIR</span><span>NASA SPACE APPS DOHA 2026</span></div>
  </div>;
}

function DownloadResult({ name, analysis }: { name: string; analysis: Awaited<ReturnType<typeof getAnalysis>> }) {
  function download() {
    const payload = { project: "ROOTSHADOW", site: name, exported_utc: new Date().toISOString(), provenance: analysis.source, method: analysis.method, results: { period: analysis.period, quality: analysis.quality, lag_trend: analysis.lag_trend, annual_trend: analysis.trend, audit: analysis.audit, events: analysis.events, sensitivity: analysis.sensitivity }, warning: "Exploratory NASA POWER/MERRA-2 model-derived screening, not field measurements or farm advice." };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const element = document.createElement("a");
    element.href = url;
    element.download = `rootshadow-${name.toLowerCase().replaceAll(" ", "-")}-evidence.json`;
    element.click();
    URL.revokeObjectURL(url);
  }
  return <button type="button" className="icon-label-action" onClick={download}><Download size={16} /> Export evidence JSON</button>;
}

function LegacyExplorePage({ selected, onSelect }: { selected: SiteId; onSelect: (id: SiteId) => void }) {
  const [level, setLevel] = useState<Level>("simple");
  const [event, setEvent] = useState<RecoveryEvent | null>(null);
  const [comparisonSite, setComparisonSite] = useState<SiteId | "none">("none");
  const [highlightedMonth, setHighlightedMonth] = useState<string | null>(null);
  const current = findSite(selected);
  const query = useQuery({ queryKey: ["site-analysis", selected], queryFn: ({ signal }) => getAnalysis(selected, signal) });
  const compareQuery = useQuery({ queryKey: ["site-analysis", comparisonSite], queryFn: ({ signal }) => getAnalysis(comparisonSite as SiteId, signal), enabled: level === "research" && comparisonSite !== "none" && comparisonSite !== selected });
  useEffect(() => { setEvent(null); if (comparisonSite === selected) setComparisonSite("none"); }, [selected]);
  const analysis = query.data;
  const positiveLags = useMemo(() => analysis ? analysis.events.filter(e => e.status === "COMPLETE_SURFACE_FIRST") : [], [analysis]);
  const median = analysis ? medianPositiveLag(analysis.events) : null;
  const primaryRate = analysis?.lag_trend.slope_days_per_decade ?? null;

  return <div className="explorer-page">
    <div className="explorer-header"><div><span className="eyebrow">ENVIRONMENTAL INTELLIGENCE / HISTORICAL RESEARCH</span><h1>Explore soil recovery</h1><p>Investigate how the surface and root zone respond after modeled droughts.</p></div><Chip variant="active"><span className="chip-led" />NASA POWER · HISTORICAL MODEL</Chip></div>
    <div className="explorer-toolbar"><div className="select-group"><label htmlFor="site-select">STUDY LOCATION</label><div className="field-select"><Globe2 size={17} /><select id="site-select" value={selected} onChange={e => onSelect(e.target.value as SiteId)}>{sites.map(site => <option value={site.id} key={site.id}>{site.name} · {site.country}</option>)}</select><ChevronDown size={16} /></div></div><div className="toolbar-period"><span>HISTORICAL PERIOD</span><strong>1981—2025</strong><small>Fixed 1991—2020 baseline</small></div><div className="view-switch" role="group" aria-label="Analysis detail level"><button className={level === "simple" ? "active" : ""} type="button" onClick={() => setLevel("simple")}>Simple view</button><button className={level === "research" ? "active" : ""} type="button" onClick={() => setLevel("research")}>Scientific view</button></div></div>
    <div className="selection-caption"><span className="coordinate-dot" />{current.region}, {current.country} <span className="caption-separator" />{siteCoordinates(current)}<span className="caption-separator" />Gridded model point · Not a field sensor</div>
    {query.isPending && <div className="analysis-loading" role="status"><div className="loading-ring" /><h2>Analyzing verified NASA history</h2><p>Running the historical drought-recovery model for {current.name}. No synthetic observations will be substituted.</p></div>}
    {query.isError && <div className="analysis-error" role="alert"><ShieldCheck size={30} /><h2>Analysis unavailable</h2><p>{query.error.message}</p><button className="button-primary" onClick={() => query.refetch()} type="button"><RefreshCcw size={16} /> Try again</button></div>}
    {analysis && <AnimatePresence mode="wait"><motion.div key={selected} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}>
      <ResearchConclusion analysis={analysis} siteName={current.name} onEvents={() => document.querySelector(".event-side-panel")?.scrollIntoView({ behavior: "smooth", block: "center" })} onResearch={() => { setLevel("research"); window.setTimeout(() => document.querySelector(".advanced-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); }}/>
      <div className="site-story"><div className="site-story-left"><span className="eyebrow">SITE {current.index} / {current.landscape.toUpperCase()}</span><h2>{current.name} <span>over 45 years</span></h2><p>{positiveLags.length} detected drought episodes had a completed surface-first recovery under our fixed rules. This does not imply the land is currently dry.</p></div><div className="model-label"><Layers3 size={20} /><span><strong>MODEL-DERIVED RECORD</strong><small>NASA POWER / MERRA-2</small></span></div></div>
      <div className="metric-grid"><Metric label="Drought episodes" value={String(analysis.events.length)} note="Historical events detected" /><Metric label="Surface-first events" value={String(positiveLags.length)} note="Completed positive delays" /><Metric label="Median positive delay" value={median === null ? "—" : `${median} d`} note="Across surface-first events" /><Metric label="Evidence status" value={verdictLabel(analysis.audit.verdict)} note="Exploratory software audit" accent /></div>
      <Suspense fallback={<div className="analysis-loading">Preparing monthly depth instrument…</div>}><SoilDepthExplorer key={selected} analysis={analysis} onMonthChange={setHighlightedMonth} /></Suspense>
      <div className="analysis-columns"><section className="surface-panel"><div className="panel-heading"><div><span className="eyebrow">01 / LAYER RESPONSE</span><h2>What the surface hides</h2></div><Chip>NASA POWER · SEASONAL %</Chip></div><Suspense fallback={<div className="chart-skeleton" role="status">Preparing the historical moisture graph…</div>}><MoistureChart analysis={analysis} event={event} highlightedMonth={highlightedMonth} /></Suspense></section><section className="event-side-panel"><div className="panel-heading"><div><span className="eyebrow">02 / RECOVERY EVENTS</span><h2>Investigate a drought</h2></div><MousePointer2 size={18} className="muted-icon" /></div><EventList analysis={analysis} selected={event} onSelect={setEvent} /></section></div>
      <div className="analysis-columns lower"><section className="event-detail-panel"><div className="panel-heading"><div><span className="eyebrow">03 / EVENT DETAILS</span><h2>Recovery sequence</h2></div>{event && <button className="text-action" type="button" onClick={() => setEvent(null)}>Clear selection <X size={14} /></button>}</div><EventInspector event={event} /></section><section className="evidence-card"><div className="panel-heading"><div><span className="eyebrow">04 / SCIENTIFIC CONFIDENCE</span><h2>What can we conclude?</h2></div><ShieldCheck size={19} className="muted-icon" /></div><EvidencePanel analysis={analysis} advanced={level === "research"} /></section></div>
      {level === "research" && <div className="advanced-workspace"><div className="advanced-heading"><span className="eyebrow">SCIENTIFIC WORKBENCH</span><h2>Beyond the first impression.</h2><p>Explore the tests behind the screening. Reported probabilities are exploratory and do not establish an independently confirmed climatic trend.</p></div>
        <div className="advanced-stats"><div><span>Signed event trend</span><strong>{primaryRate === null ? "Not testable" : `${primaryRate > 0 ? "+" : ""}${formatDecimal(primaryRate)} days / decade`}</strong></div><div><span>Event-level Kendall p</span><strong>{analysis.lag_trend.p_value === null || analysis.lag_trend.p_value === undefined ? "Not available" : analysis.lag_trend.p_value.toFixed(5)}</strong></div><div><span>Paired day coverage</span><strong>{(analysis.quality.paired_day_coverage * 100).toFixed(1)}%</strong></div></div>
        <div className="advanced-grid"><section className="surface-panel"><div className="panel-heading"><div><span className="eyebrow">05 / ANNUAL MISMATCH</span><h3>When the layers disagree</h3></div></div><Suspense fallback={<div className="chart-skeleton" role="status">Preparing annual comparisons…</div>}><AnnualChart analysis={analysis} comparison={compareQuery.data} comparisonName={comparisonSite !== "none" ? findSite(comparisonSite).name : undefined} /></Suspense><p className="chart-footnote">Counts days in which modeled surface recovery had occurred but the root zone remained below the recovery threshold.</p></section><section className="surface-panel"><div className="panel-heading"><div><span className="eyebrow">06 / SENSITIVITY ANALYSIS</span><h3>Do thresholds change the answer?</h3></div></div><Suspense fallback={<div className="chart-skeleton" role="status">Preparing scientific sensitivity results…</div>}><SensitivityChart analysis={analysis} /></Suspense><p className="chart-footnote">Nine exploratory threshold combinations. Numbers are signed delay slopes in days per decade. Not independently validated.</p></section></div>
        <section className="comparison-panel"><div><span className="eyebrow">07 / MULTI-SITE COMPARISON</span><h3>Compare geographic patterns</h3><p>Compare annual mismatch days at another NASA research site. Every result is computed by the same backend method.</p></div><label className="compare-select">COMPARE WITH <select value={comparisonSite} onChange={e => setComparisonSite(e.target.value as SiteId | "none")}><option value="none">Select another site</option>{sites.filter(site => site.id !== selected).map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>{compareQuery.isPending && comparisonSite !== "none" && <span className="compare-hint">Loading comparison analysis…</span>}{compareQuery.isError && <span className="compare-hint error">Comparison unavailable: {compareQuery.error.message}</span>}{compareQuery.data && comparisonSite !== "none" && <div className="compare-result"><div><span>{current.name}</span><strong>{analysis.events.length} episodes</strong><small>{verdictLabel(analysis.audit.verdict)}</small></div><div className="compare-vs">VS</div><div><span>{findSite(comparisonSite).name}</span><strong>{compareQuery.data.events.length} episodes</strong><small>{verdictLabel(compareQuery.data.audit.verdict)}</small></div></div>}</section>
        <section className="provenance-panel"><div className="panel-heading"><div><span className="eyebrow">08 / PROVENANCE & REPRODUCIBILITY</span><h3>Every finding has a source.</h3></div><Fingerprint size={22} /></div><div className="provenance-fields"><div><small>Input source</small><strong>{analysis.source.source}</strong></div><div><small>SHA-256 dataset digest</small><code>{analysis.source.sha256 ?? "Unavailable"}</code></div><div><small>Observation period</small><strong>{analysis.period.start} — {analysis.period.end}</strong></div><div><small>Scientific interpretation</small><strong>Exploratory · Not operational</strong></div></div><div className="provenance-actions"><DownloadResult name={current.name} analysis={analysis} /><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER <ExternalLink size={14} /></a><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/blob/main/docs/EXPLORATORY_4_SITE_RESULTS.md" target="_blank" rel="noreferrer">Published study report <ExternalLink size={14} /></a></div></section>
      </div>}
      <div className="explorer-endnote"><CircleHelp size={16} /><span>ROOTSHADOW uses historical, model-derived NASA POWER soil wetness. It is not field-scale sensing, real-time drought monitoring, or an irrigation recommendation system.</span></div>
    </motion.div></AnimatePresence>}
  </div>;
}

function ExplorePage({ selected, onSelect }: { selected: SiteId; onSelect: (id: SiteId) => void }) {
  const [technical, setTechnical] = useState(false);
  return <div className="guided-route">
    <div className="guided-mode-switch"><span>{technical ? "SCIENTIFIC RESEARCH VIEW" : "GUIDED RESEARCH WORKSPACE"}</span><button type="button" onClick={() => setTechnical(value => !value)}>{technical ? "Return to guided tools" : "Open complete scientific workbench"}</button></div>
    {technical ? <LegacyExplorePage selected={selected} onSelect={onSelect} /> : <Suspense fallback={<div className="analysis-loading" role="status">Opening the research workspace…</div>}><GuidedWorkspace selected={selected} onSelect={onSelect} /></Suspense>}
  </div>;
}

function MethodPage({ navigate }: { navigate: (p: Page) => void }) {
  return <div className="method-page"><div className="method-intro"><span className="eyebrow">METHODOLOGY / REPRODUCIBLE BY DESIGN</span><h1>How we see beneath<br /><em>surface recovery.</em></h1><p>Our goal isn't to produce a dramatic statistic. It's to make a testable investigation of how modeled soil moisture responds after drought.</p><button className="button-primary" onClick={() => navigate("explore")}>Explore the observations <ArrowRight size={17} /></button></div>
    <div className="method-grid">{[
      { num: "01", icon: <Database size={24} />, title: "Collect and authenticate", desc: "NASA POWER daily gridded estimates of surface and root-zone soil wetness from 1981 through 2025. Original snapshots and source hashes are retained." },
      { num: "02", icon: <BarChart3 size={24} />, title: "Make seasons comparable", desc: "Convert wetness into seasonally matched percentiles using the 1991–2020 reference and a ±15-day calendar window." },
      { num: "03", icon: <Layers3 size={24} />, title: "Detect drought", desc: "Qualifying root-zone drought requires wetness at or below the 20th percentile for at least 30 days, with short interruptions bridged." },
      { num: "04", icon: <Activity size={24} />, title: "Measure recovery order", desc: "Each layer must meet the same 40th-percentile threshold for seven consecutive days. Delay equals root recovery date minus surface recovery date." },
      { num: "05", icon: <Microscope size={24} />, title: "Challenge the hypothesis", desc: "Explore Theil–Sen/Kendall trends, nine threshold settings, annual mismatch statistics and a simplified surrogate model calibrated on the source model's behavior." },
      { num: "06", icon: <ShieldCheck size={24} />, title: "Report uncertainty", desc: "Mark incomplete recoveries as censored; report inconclusive tests and explicitly distinguish gridded model output from independent field measurements." }
    ].map(item => <div className="method-card" key={item.num}><div className="method-number">{item.num}</div><div className="method-icon">{item.icon}</div><h3>{item.title}</h3><p>{item.desc}</p></div>)}</div>
    <section className="limitations"><div><span className="eyebrow">THE LIMITS MATTER</span><h2>What ROOTSHADOW<br />does not claim.</h2></div><div><p>NASA POWER/MERRA-2 surface and root-zone wetness are derived from a shared land-modeling system, not independently measured root sensors. Some apparent lag is expected from the model itself.</p><p>Goodwell's nominal exploratory trend does not meet a conservative four-site multiple-testing threshold. Independent SMAP, GLDAS and field corroboration is not complete.</p><p>ROOTSHADOW is a historical screening prototype. It does not recommend irrigation, diagnose crop loss or forecast next season's drought.</p><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/blob/main/docs/EXPLORATORY_4_SITE_RESULTS.md" target="_blank" rel="noreferrer">Read the published four-site analysis <ArrowUpRight size={17} /></a></div></section>
  </div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [selected, setSelected] = useState<SiteId>("us_sgp_goodwell");
  const [mobileOpen, setMobileOpen] = useState(false);
  function navigate(next: Page) { setPage(next); setMobileOpen(false); window.scrollTo({ top: 0, behavior: "auto" }); }
  return <div className="app-frame">
    <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation"><div className="sidebar-top"><Brand /><button className="mobile-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button></div><div className="sidebar-overline">WORKSPACE</div><nav className="side-nav"><button type="button" className={page === "home" ? "active" : ""} onClick={() => navigate("home")}><Leaf size={19} /> Overview</button><button type="button" className={page === "explore" ? "active" : ""} onClick={() => navigate("explore")}><Globe2 size={19} /> Explore locations</button><button type="button" className={page === "method" ? "active" : ""} onClick={() => navigate("method")}><BookOpenText size={19} /> The science</button></nav><div className="sidebar-overline secondary">RESEARCH</div><div className="sidebar-research"><div className="sidebar-icon"><Search size={18} /></div><div><strong>Earth System Trend Detective</strong><small>NASA Space Apps Doha 2026</small></div></div><div className="sidebar-bottom"><div className="sidebar-verification"><CheckCircle2 size={17} /><span>Verified NASA datasets<small>6 historical site snapshots</small></span></div><div className="sidebar-credit">BUILT BY SYZYNOVA<br /><span>MUHAMMAD AHMED · SOMAYA BAKIR</span></div></div></aside>
    {mobileOpen && <button type="button" className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <div className="main-shell"><header className="top-nav"><button type="button" className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button><span className="breadcrumb"><span>ROOTSHADOW</span><span className="crumb-divider">/</span>{page === "home" ? "Overview" : page === "explore" ? "Investigation" : "Methodology"}</span><div className="top-nav-actions"><span className="top-dataset"><span className="live-pulse" />HISTORICAL DATA · 1981—2025</span><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW" target="_blank" rel="noreferrer" aria-label="Open the ROOTSHADOW source code">SOURCE CODE <ExternalLink size={14} /></a></div></header>
      <main id="main-content">{page === "home" ? <HomePage selected={selected} onSelect={setSelected} navigate={navigate} /> : page === "explore" ? <ExplorePage selected={selected} onSelect={setSelected} /> : <MethodPage navigate={navigate} />}</main>
      <footer className="site-footer"><span>ROOTSHADOW / NASA SPACE APPS DOHA 2026</span><span>Historical screening prototype · Not agricultural advice</span><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER <ExternalLink size={13} /></a></footer>
    </div>
  </div>;
}
