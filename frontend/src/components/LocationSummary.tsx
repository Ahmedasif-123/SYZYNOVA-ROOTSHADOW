import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown, Download, MapPinned, RefreshCcw, ShieldCheck } from "lucide-react";
import { getAnalysis, medianPositiveLag, verdictLabel, type Analysis } from "../lib/api";
import { findSite, productSites, researchSites, siteCoordinates, siteRegions, type SiteId } from "../lib/sites";
import { AnnualChart, MoistureChart } from "./ScientificCharts";

type Props = { selected: SiteId; onSelect: (site: SiteId) => void };

function summarize(analysis: Analysis, name: string) {
  const episodes = analysis.events.length;
  const completedSurfaceFirst = analysis.events.filter(item => item.status === "COMPLETE_SURFACE_FIRST").length;
  const completedRootFirst = analysis.events.filter(item => item.status === "ROOT_FIRST").length;
  const incomplete = analysis.events.filter(item => item.recovery_delay_days === null).length;
  const medianDelay = medianPositiveLag(analysis.events);
  const mismatchPeak = analysis.annual.reduce((largest, row) => row.mismatch_days > largest.mismatch_days ? row : largest, analysis.annual[0]);
  const finalMonth = analysis.monthly.at(-1);
  const rate = episodes ? 100 * completedSurfaceFirst / episodes : null;
  const opening = episodes === 0
    ? "No qualifying root-zone drought episodes were detected at " + name + " under the primary thresholds during the 1981–2025 historical model period."
    : completedSurfaceFirst === 0
    ? "Of " + episodes + " qualifying modeled drought episodes at " + name + ", none had a completed surface-first recovery under the primary thresholds."
    : "At " + name + ", the model identified " + episodes + " qualifying drought episodes; " + completedSurfaceFirst + " had completed surface recovery before deeper-root recovery.";
  const interpretation = medianDelay === null
    ? "There are too few completed surface-first recoveries to calculate a positive recovery-delay median."
    : "For the completed surface-first episodes, deeper-soil recovery lagged surface recovery by a median of " + medianDelay + " days. This is a model result, not measured crop impact.";
  const caution = analysis.audit.verdict === "INCONCLUSIVE"
    ? "The statistical audit is inconclusive under the current screening rules."
    : analysis.audit.verdict === "TREND_NOT_ROBUST"
    ? "An exploratory trend did not remain robust under the selected sensitivity checks."
    : analysis.audit.verdict === "NO_SIGNIFICANT_TREND"
    ? "No statistically significant recovery-delay trend was detected under this method."
    : "The analysis flagged an exploratory candidate signal. It requires independent evidence before any real-world interpretation.";
  return { episodes, completedSurfaceFirst, completedRootFirst, incomplete, medianDelay, mismatchPeak, finalMonth, rate, opening, interpretation, caution };
}

function percentile(value: number | null | undefined) {
  return value === null || value === undefined ? "unavailable" : value.toFixed(1) + "th percentile";
}

export default function LocationSummary({ selected, onSelect }: Props) {
  const place = findSite(selected);
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["summary-analysis", selected], queryFn: ({ signal }) => getAnalysis(selected, signal), staleTime: 60_000 });
  const analysis = query.data;
  const details = analysis ? summarize(analysis, place.name) : null;

  function downloadSummary() {
    if (!analysis || !details) return;
    const record = {
      project: "ROOTSHADOW",
      record_type: "deterministic_location_summary",
      location: { id: selected, name: place.name, country: place.country, coordinates: place.coordinates },
      source: analysis.source,
      period: analysis.period,
      method: analysis.method,
      scientific_status: "Exploratory NASA POWER/MERRA-2 gridded model screening, not independent field validation",
      metrics: {
        qualifying_drought_episodes: details.episodes,
        completed_surface_first: details.completedSurfaceFirst,
        completed_root_first: details.completedRootFirst,
        incomplete_events: details.incomplete,
        median_positive_recovery_delay_days: details.medianDelay,
        selected_surface_first_share_percent: details.rate
      },
      explanation: [details.opening, details.interpretation, details.caution],
      audit: analysis.audit,
      monthly_series: analysis.monthly,
      annual_series: analysis.annual
    };
    const file = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rootshadow-" + selected + "-summary.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("Summary and supporting data prepared for download.");
  }

  return <section className="summary-page" aria-label="Generated research summary for selected location">
    <header className="summary-heading">
      <div><span className="eyebrow">ROOTSHADOW / EVIDENCE SUMMARY</span><h1>Get Summary.</h1><p>Choose a study point for an evidence-based explanation of its historical drought and recovery behavior.</p></div>
      <span className="summary-verified"><ShieldCheck size={16}/> NASA model-source verified</span>
    </header>
    <div className="summary-selector">
      <label htmlFor="summary-site"><MapPinned size={17}/> STUDY LOCATION</label>
      <div className="summary-selector-field">
        <select id="summary-site" aria-label="Summary study location" value={selected} onChange={event => { onSelect(event.target.value as SiteId); setNotice(""); }}>
          <optgroup label="Original six research locations">{researchSites.map(site => <option key={site.id} value={site.id}>{site.name} · {site.country}</option>)}</optgroup>
          {siteRegions.map(region => <optgroup key={region} label={region}>{productSites.filter(site => site.region === region).map(site => <option key={site.id} value={site.id}>{site.name} · {site.country}</option>)}</optgroup>)}
        </select><ChevronDown size={17}/>
      </div>
      <button type="button" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCcw size={15}/> Regenerate report</button>
    </div>
    <div className="summary-location-title"><div><span className="eyebrow">CURRENT REPORT</span><h2>{place.name}</h2><p>{place.country} · {place.region} · {siteCoordinates(place)}</p></div><span>1981—2025 · 45 years · NASA POWER/MERRA-2</span></div>
    {query.isPending && <p role="status" className="summary-loading">Preparing the historical model summary for {place.name}…</p>}
    {query.isError && <p role="alert" className="summary-loading">The analysis is unavailable: {query.error.message}. No figures have been substituted.</p>}
    {analysis && details && <div key={selected}>
      <div className="summary-facts">
        <div><small>QUALIFYING DROUGHT EPISODES</small><strong>{details.episodes}</strong><span>Historical model screen</span></div>
        <div><small>COMPLETED SURFACE-FIRST EVENTS</small><strong>{details.completedSurfaceFirst}</strong><span>{details.rate === null ? "No qualifying events" : details.rate.toFixed(1) + "% of qualifying episodes"}</span></div>
        <div><small>MEDIAN SURFACE-FIRST DELAY</small><strong>{details.medianDelay === null ? "—" : details.medianDelay + " d"}</strong><span>Completed positive lags only</span></div>
        <div><small>STATISTICAL AUDIT</small><strong className="summary-audit-label">{verdictLabel(analysis.audit.verdict)}</strong><span>Exploratory evidence</span></div>
      </div>
      <article className="summary-interpretation">
        <span className="eyebrow">THE FINDING, EXPLAINED</span>
        <h3>What the historical model says about {place.name}.</h3>
        <p>{details.opening}</p>
        <p>{details.interpretation}</p>
        <p>{details.caution}</p>
        <p className="summary-seasonal-reading">In the final historical month, December 2025, the surface ranked at <strong>{percentile(details.finalMonth?.top_percentile)}</strong> and the root zone at <strong>{percentile(details.finalMonth?.root_percentile)}</strong> against their seasonal reference. These ranks are not percentages of soil water and are not current conditions.</p>
      </article>
      <div className="summary-charts">
        <section><div className="summary-chart-heading"><span className="eyebrow">01 / MONTHLY RECORD</span><h3>Surface and deeper moisture across 45 years</h3><p>Click the curves to select a month; drag to scrub. The lower bars are historical NASA rainfall totals. The panel explains each selection.</p></div><MoistureChart analysis={analysis} event={null} siteId={selected}/></section>
        <section><div className="summary-chart-heading"><span className="eyebrow">02 / ANNUAL MISMATCH</span><h3>Which years had more mismatch days?</h3><p>Click any bar or choose a year in the explanation panel. These counts are model-defined events, not independently observed crop impacts.</p></div><AnnualChart analysis={analysis}/></section>
      </div>
      <div className="summary-evidence"><div><span className="eyebrow">WHAT THE DATA CANNOT ESTABLISH</span><h3>Interpreting the evidence responsibly</h3><p>{analysis.audit.explanation}</p><p>{analysis.audit.caution}</p><p>This is an exploratory screening of NASA POWER/MERRA-2 gridded model output. It does not confirm farm-level moisture, predict irrigation requirements, or independently establish agricultural impacts.</p></div><button type="button" onClick={downloadSummary}><Download size={17}/> Download summary + data</button></div>
      {notice && <p className="summary-status" role="status">{notice}</p>}
    </div>}
  </section>;
}
