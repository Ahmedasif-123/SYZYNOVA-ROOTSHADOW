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
import { MoistureChart, AnnualChart, SensitivityChart } from "./components/ScientificCharts";
import { EventInspector, EventList } from "./components/EventInspector";
import EvidencePanel from "./components/EvidencePanel";

const GeoExplorer = lazy(() => import("./components/GeoExplorer"));
const EarthGlobe = lazy(() => import("./components/EarthGlobe"));
const SoilDepthExplorer = lazy(() => import("./components/SoilDepthExplorer"));
const ResearchConclusions = lazy(() => import("./components/ResearchConclusions"));
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
  return <>
    <section className="landing-hero">
      <div className="hero-content">
        <div className="hero-kicker"><span className="live-pulse" />EARTH SYSTEM RESEARCH / NASA POWER</div>
        <h1>Rain returns.<br /><em>But does the soil?</em></h1>
        <p className="hero-intro">A landscape can look recovered while deeper soil takes longer to respond. ROOTSHADOW explores the difference—using 45 years of NASA environmental history.</p>
        <div className="hero-cta"><button className="button-primary" type="button" onClick={() => navigate("explore")}>Explore the evidence <ArrowRight size={18} /></button><button className="button-quiet" type="button" onClick={() => navigate("method")}>How it works <ArrowUpRight size={16} /></button></div>
        <div className="hero-auth"><ShieldCheck size={18} /><span>Authentic NASA POWER records. Model-derived soil wetness. No simulated results in this experience.</span></div>
        <div className="hero-counts"><div><strong>45<span> years</span></strong><small>1981—2025</small></div><div><strong>04<span> sites</span></strong><small>Three countries</small></div><div><strong>65,744</strong><small>Historical site-days</small></div></div>
      </div>
      <div className="hero-map-stage">
        <div className="hero-map-topline"><span>SYZYNOVA / GLOBAL OBSERVATION SYSTEM</span><span>01 — EARTH</span></div>
        <div className="earth-view-switch" aria-label="Geographic exploration mode">
          <button type="button" className={view === "globe" ? "active" : ""} aria-pressed={view === "globe"} onClick={() => setView("globe")}>3D Earth</button>
          <button type="button" className={view === "atlas" ? "active" : ""} aria-pressed={view === "atlas"} onClick={() => setView("atlas")}>World map</button>
        </div>
        <Suspense fallback={<div className="map-skeleton">Loading geographic model…</div>}>
          {view === "globe" ? <EarthGlobe selected={selected} onSelect={onSelect} /> : <GeoExplorer selected={selected} onSelect={onSelect} />}
        </Suspense>
        <div className="hero-map-readout"><span className="readout-ping" /> HISTORICAL MODEL STUDY <span> / GEOGRAPHIC LOCATION IS NOT A FIELD MEASUREMENT</span></div>
        <button type="button" className="hero-investigate-selected" onClick={() => navigate("explore")}>Investigate {findSite(selected).name} <ArrowUpRight size={16} /></button>
      </div>
    </section>
    <section className="editorial-lead" aria-labelledby="question-heading">
      <div className="editorial-margin"><span>01 / THE QUESTION</span><small>AN ENVIRONMENTAL OBSERVATION</small></div>
      <div className="editorial-lead-copy"><span className="eyebrow">WHEN APPEARANCES MISLEAD</span><h2 id="question-heading">The rain stops.<br />The landscape turns green.<br /><em>But what happened underground?</em></h2><p>Rainfall and surface appearance are easy to notice. Root-zone recovery is harder to see. In drought-prone regions, that gap is worth investigating—but it must be measured rather than assumed.</p><p>ROOTSHADOW examines historical surface and root-zone soil-wetness model estimates, detects recovery episodes and exposes how confident we should be in each result.</p></div>
    </section>
    <section className="editorial-findings" aria-labelledby="finding-heading">
      <div className="editorial-findings-copy"><span className="eyebrow">02 / WHAT OUR RESEARCH FOUND</span><h2 id="finding-heading">Not every recovery happens together.</h2><p>We screened four research locations over 1981–2025. The evidence includes <strong>110 modeled drought episodes</strong>; in <strong>47</strong>, the surface completed recovery before the root zone under the same threshold rules.</p><p>Goodwell had 19 completed surface-first episodes. Other sites behaved differently. That geographical variation is a useful research finding, but four model points cannot establish a worldwide drought trend.</p><button className="editorial-text-link" type="button" onClick={() => {onSelect("us_sgp_goodwell");navigate("explore");}}>Examine the Goodwell case <ArrowUpRight size={18}/></button></div>
      <figure className="editorial-figure"><SoilVisual /><figcaption><strong>Figure 01.</strong> The surface and root zone can recover on different dates. This diagram explains the concept; it is not an observed soil cross-section.</figcaption></figure>
    </section>
    <section className="editorial-fieldnotes" aria-labelledby="fieldnotes-heading">
      <div className="fieldnotes-heading"><span className="eyebrow">03 / FOUR PLACES. DIFFERENT STORIES.</span><h2 id="fieldnotes-heading">Follow the evidence somewhere real.</h2><p>Choose a verified NASA POWER research point. Each location opens a historical investigation, interactive depth timeline, events and methodological checks.</p></div>
      <div className="fieldnotes-list">
        {([
          {id:"us_sgp_goodwell" as SiteId,count:"19 / 31",finding:"Strongest surface-first count in this sample",detail:"Oklahoma, United States"},
          {id:"us_sgp_stillwater" as SiteId,count:"6 / 26",finding:"Fewer completed surface-first recoveries",detail:"Oklahoma, United States"},
          {id:"australia_narrabri" as SiteId,count:"16 / 28",finding:"No detected directional trend",detail:"New South Wales, Australia"},
          {id:"spain_cordoba" as SiteId,count:"6 / 25",finding:"Inconclusive long-term direction",detail:"Andalusia, Spain"}
        ]).map((entry,index) => <button key={entry.id} type="button" className="fieldnotes-row" onClick={()=>{onSelect(entry.id);navigate("explore");}}><span className="fieldnote-index">0{index+1}</span><span className="fieldnote-place"><strong>{findSite(entry.id).name}</strong><small>{entry.detail}</small></span><span className="fieldnote-finding">{entry.finding}</span><span className="fieldnote-count"><strong>{entry.count}</strong><small>surface-first / total</small></span><ArrowUpRight size={20}/></button>)}
      </div><p className="fieldnotes-caption">Counts are computed from historical gridded model estimates and depend on the published drought/recovery thresholds. They do not indicate current drought severity.</p>
    </section>
    <section className="editorial-solution" aria-labelledby="solution-heading">
      <div className="solution-heading"><span className="eyebrow">04 / THE PRODUCT</span><h2 id="solution-heading">From a hidden question<br />to an inspectable answer.</h2></div>
      <div className="solution-narrative"><p><strong>See a possible mismatch.</strong> Locate historical periods when surface wetness recovered before root-zone wetness.</p><p><strong>Investigate why.</strong> Scrub the 45-year record, compare the layers and inspect individual drought events.</p><p><strong>Challenge the answer.</strong> Review sensitivity, provenance and uncertainty before treating a pattern as evidence.</p><button type="button" className="button-primary" onClick={()=>navigate("explore")}>Begin an investigation <ArrowRight size={18}/></button></div>
    </section>
    <section className="editorial-note"><span>RESEARCH INTEGRITY</span><p>ROOTSHADOW is a historical screening and evidence-auditing prototype. NASA POWER surface and root-zone values are modeled, not field sensors. We have not independently validated the patterns or built a live irrigation advisory.</p><button type="button" onClick={()=>navigate("method")}>Read our methodology <ArrowUpRight size={16}/></button></section>
  </>;
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

function ExplorePage({ selected, onSelect }: { selected: SiteId; onSelect: (id: SiteId) => void }) {
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
      <div className="site-story"><div className="site-story-left"><span className="eyebrow">SITE {current.index} / {current.landscape.toUpperCase()}</span><h2>{current.name} <span>over 45 years</span></h2><p>{positiveLags.length} detected drought episodes had a completed surface-first recovery under our fixed rules. This does not imply the land is currently dry.</p></div><div className="model-label"><Layers3 size={20} /><span><strong>MODEL-DERIVED RECORD</strong><small>NASA POWER / MERRA-2</small></span></div></div>
      <div className="metric-grid"><Metric label="Drought episodes" value={String(analysis.events.length)} note="Historical events detected" /><Metric label="Surface-first events" value={String(positiveLags.length)} note="Completed positive delays" /><Metric label="Median positive delay" value={median === null ? "—" : `${median} d`} note="Across surface-first events" /><Metric label="Evidence status" value={verdictLabel(analysis.audit.verdict)} note="Exploratory software audit" accent /></div>
      <Suspense fallback={<div className="analysis-loading">Preparing research interpretation…</div>}><ResearchConclusions site={selected} analysis={analysis} onResearch={() => setLevel("research")} /></Suspense>
      <Suspense fallback={<div className="analysis-loading">Preparing monthly depth instrument…</div>}><SoilDepthExplorer key={selected} analysis={analysis} onMonthChange={setHighlightedMonth} /></Suspense>
      <div className="analysis-columns"><section className="surface-panel"><div className="panel-heading"><div><span className="eyebrow">01 / LAYER RESPONSE</span><h2>What the surface hides</h2></div><Chip>NASA POWER · SEASONAL %</Chip></div><MoistureChart analysis={analysis} event={event} highlightedMonth={highlightedMonth} /></section><section className="event-side-panel"><div className="panel-heading"><div><span className="eyebrow">02 / RECOVERY EVENTS</span><h2>Investigate a drought</h2></div><MousePointer2 size={18} className="muted-icon" /></div><EventList analysis={analysis} selected={event} onSelect={setEvent} /></section></div>
      <div className="analysis-columns lower"><section className="event-detail-panel"><div className="panel-heading"><div><span className="eyebrow">03 / EVENT DETAILS</span><h2>Recovery sequence</h2></div>{event && <button className="text-action" type="button" onClick={() => setEvent(null)}>Clear selection <X size={14} /></button>}</div><EventInspector event={event} /></section><section className="evidence-card"><div className="panel-heading"><div><span className="eyebrow">04 / SCIENTIFIC CONFIDENCE</span><h2>What can we conclude?</h2></div><ShieldCheck size={19} className="muted-icon" /></div><EvidencePanel analysis={analysis} advanced={level === "research"} /></section></div>
      {level === "research" && <div className="advanced-workspace"><div className="advanced-heading"><span className="eyebrow">SCIENTIFIC WORKBENCH</span><h2>Beyond the first impression.</h2><p>Explore the tests behind the screening. Reported probabilities are exploratory and do not establish an independently confirmed climatic trend.</p></div>
        <div className="advanced-stats"><div><span>Signed event trend</span><strong>{primaryRate === null ? "Not testable" : `${primaryRate > 0 ? "+" : ""}${formatDecimal(primaryRate)} days / decade`}</strong></div><div><span>Event-level Kendall p</span><strong>{analysis.lag_trend.p_value === null || analysis.lag_trend.p_value === undefined ? "Not available" : analysis.lag_trend.p_value.toFixed(5)}</strong></div><div><span>Paired day coverage</span><strong>{(analysis.quality.paired_day_coverage * 100).toFixed(1)}%</strong></div></div>
        <div className="advanced-grid"><section className="surface-panel"><div className="panel-heading"><div><span className="eyebrow">05 / ANNUAL MISMATCH</span><h3>When the layers disagree</h3></div></div><AnnualChart analysis={analysis} comparison={compareQuery.data} comparisonName={comparisonSite !== "none" ? findSite(comparisonSite).name : undefined} /><p className="chart-footnote">Counts days in which modeled surface recovery had occurred but the root zone remained below the recovery threshold.</p></section><section className="surface-panel"><div className="panel-heading"><div><span className="eyebrow">06 / SENSITIVITY ANALYSIS</span><h3>Do thresholds change the answer?</h3></div></div><SensitivityChart analysis={analysis} /><p className="chart-footnote">Nine exploratory threshold combinations. Numbers are signed delay slopes in days per decade. Not independently validated.</p></section></div>
        <section className="comparison-panel"><div><span className="eyebrow">07 / MULTI-SITE COMPARISON</span><h3>Compare geographic patterns</h3><p>Compare annual mismatch days at another NASA research site. Every result is computed by the same backend method.</p></div><label className="compare-select">COMPARE WITH <select value={comparisonSite} onChange={e => setComparisonSite(e.target.value as SiteId | "none")}><option value="none">Select another site</option>{sites.filter(site => site.id !== selected).map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>{compareQuery.isPending && comparisonSite !== "none" && <span className="compare-hint">Loading comparison analysis…</span>}{compareQuery.isError && <span className="compare-hint error">Comparison unavailable: {compareQuery.error.message}</span>}{compareQuery.data && comparisonSite !== "none" && <div className="compare-result"><div><span>{current.name}</span><strong>{analysis.events.length} episodes</strong><small>{verdictLabel(analysis.audit.verdict)}</small></div><div className="compare-vs">VS</div><div><span>{findSite(comparisonSite).name}</span><strong>{compareQuery.data.events.length} episodes</strong><small>{verdictLabel(compareQuery.data.audit.verdict)}</small></div></div>}</section>
        <section className="provenance-panel"><div className="panel-heading"><div><span className="eyebrow">08 / PROVENANCE & REPRODUCIBILITY</span><h3>Every finding has a source.</h3></div><Fingerprint size={22} /></div><div className="provenance-fields"><div><small>Input source</small><strong>{analysis.source.source}</strong></div><div><small>SHA-256 dataset digest</small><code>{analysis.source.sha256 ?? "Unavailable"}</code></div><div><small>Observation period</small><strong>{analysis.period.start} — {analysis.period.end}</strong></div><div><small>Scientific interpretation</small><strong>Exploratory · Not operational</strong></div></div><div className="provenance-actions"><DownloadResult name={current.name} analysis={analysis} /><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER <ExternalLink size={14} /></a><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/blob/main/docs/EXPLORATORY_4_SITE_RESULTS.md" target="_blank" rel="noreferrer">Published study report <ExternalLink size={14} /></a></div></section>
      </div>}
      <div className="explorer-endnote"><CircleHelp size={16} /><span>ROOTSHADOW uses historical, model-derived NASA POWER soil wetness. It is not field-scale sensing, real-time drought monitoring, or an irrigation recommendation system.</span></div>
    </motion.div></AnimatePresence>}
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
  const [theme, setTheme] = useState<"orbit" | "field" | "canopy">("field");
  function navigate(next: Page) { setPage(next); setMobileOpen(false); window.scrollTo({ top: 0, behavior: "auto" }); }
  return <div className="app-frame" data-theme={theme}>
    <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation"><div className="sidebar-top"><Brand /><button className="mobile-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button></div><div className="sidebar-overline">WORKSPACE</div><nav className="side-nav"><button type="button" className={page === "home" ? "active" : ""} onClick={() => navigate("home")}><Leaf size={19} /> Overview</button><button type="button" className={page === "explore" ? "active" : ""} onClick={() => navigate("explore")}><Globe2 size={19} /> Explore locations</button><button type="button" className={page === "method" ? "active" : ""} onClick={() => navigate("method")}><BookOpenText size={19} /> The science</button></nav><div className="sidebar-overline secondary">RESEARCH</div><div className="sidebar-research"><div className="sidebar-icon"><Search size={18} /></div><div><strong>Earth System Trend Detective</strong><small>NASA Space Apps Doha 2026</small></div></div><div className="sidebar-bottom"><div className="sidebar-verification"><CheckCircle2 size={17} /><span>NASA POWER archives<small>4 historical site snapshots</small></span></div><div className="sidebar-credit">BUILT BY SYZYNOVA<br /><span>MUHAMMAD AHMED · SOMAYA BAKIR</span></div></div></aside>
    {mobileOpen && <button type="button" className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <div className="main-shell"><header className="top-nav"><button type="button" className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button><span className="breadcrumb"><span>ROOTSHADOW</span><span className="crumb-divider">/</span>{page === "home" ? "Overview" : page === "explore" ? "Investigation" : "Methodology"}</span><div className="top-nav-actions"><label className="theme-chooser">COLOR THEME <select aria-label="Choose color theme" value={theme} onChange={e => setTheme(e.target.value as "orbit" | "field" | "canopy")}><option value="orbit">Orbit</option><option value="field">Field Notes</option><option value="canopy">Canopy</option></select></label><span className="top-dataset"><span className="live-pulse" />HISTORICAL DATA · 1981—2025</span><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW" target="_blank" rel="noreferrer" aria-label="Open the ROOTSHADOW source code">SOURCE CODE <ExternalLink size={14} /></a></div></header>
      <main id="main-content">{page === "home" ? <HomePage selected={selected} onSelect={setSelected} navigate={navigate} /> : page === "explore" ? <ExplorePage selected={selected} onSelect={setSelected} /> : <MethodPage navigate={navigate} />}</main>
      <footer className="site-footer"><span>ROOTSHADOW / NASA SPACE APPS DOHA 2026</span><span>Historical screening prototype · Not agricultural advice</span><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER <ExternalLink size={13} /></a></footer>
    </div>
  </div>;
}
