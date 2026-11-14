import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, ExternalLink } from "lucide-react";
import type { Analysis } from "../lib/api";
import { medianPositiveLag } from "../lib/api";

type Audience = "land" | "research" | "policy";

const sourceLinks = [
  { name: "NASA POWER", url: "https://power.larc.nasa.gov/" },
  { name: "SMAP L4", url: "https://nsidc.org/data/smap" },
  { name: "GLDAS", url: "https://ldas.gsfc.nasa.gov/gldas" }
];

const nextSteps: Record<Audience, { title: string; meaning: string; actions: string[] }> = {
  land: {
    title: "Do not use surface appearance as proof of root-zone recovery.",
    meaning: "This is a historical, gridded model assessment. It does not know the moisture, crop condition, field boundaries or irrigation needs of your land.",
    actions: ["Compare recent local rain and relevant crop information with measured soil conditions.", "Use field-scale sensors or observations to confirm root-zone moisture before deciding what to do.", "Ask a local agronomist to interpret the results for your soil and crop."]
  },
  research: {
    title: "Treat the delay as a testable screening result, not a proven mechanism.",
    meaning: "Surface and root-zone estimates share model dynamics. The method identifies candidate divergence episodes but does not isolate model artifacts, climate causation or field impacts.",
    actions: ["Re-run the sensitivity grid and examine left/right censoring and temporal dependence.", "Compare matched locations and periods against SMAP L4 and GLDAS, noting they are also model-based.", "Seek independent in-situ soil probes or station observations and pre-register regional hypotheses."]
  },
  policy: {
    title: "Use the result to prioritize verification, not to justify a regional intervention.",
    meaning: "Four selected point series do not define a geographic prevalence rate, real-time drought status or projected water shortage.",
    actions: ["Identify regions where delayed recovery warrants further study.", "Commission independent comparisons across more spatial points and historical windows.", "Only consider policy guidance after calibrated uncertainty, field validation and impact testing."]
  }
};

function exportConclusion(siteName: string, analysis: Analysis, count: number, median: number | null) {
  const payload = {
    project: "ROOTSHADOW",
    site: siteName,
    source: analysis.source,
    period: analysis.period,
    conclusion: {
      type: "exploratory_model_screening",
      drought_events: analysis.events.length,
      completed_surface_first: count,
      fraction_of_all_events: analysis.events.length ? count / analysis.events.length : null,
      median_completed_surface_first_days: median,
      trend: analysis.lag_trend,
      verdict: analysis.audit.verdict,
      scientific_claim_ready: analysis.ready_for_scientific_claims
    },
    method: analysis.method,
    audit: analysis.audit,
    limitations: "NASA POWER / MERRA-2 gridded estimates are not ground truth. Independent cross-product and in-situ comparisons are required."
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "ROOTSHADOW-" + siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-conclusion.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ResearchConclusion({ analysis, siteName, onResearch, onEvents }: {
  analysis: Analysis;
  siteName: string;
  onResearch: () => void;
  onEvents: () => void;
}) {
  const [audience, setAudience] = useState<Audience>("land");
  const total = analysis.events.length;
  const positive = analysis.events.filter(item => item.status === "COMPLETE_SURFACE_FIRST").length;
  const fraction = total ? Math.round(1000 * positive / total) / 10 : 0;
  const median = medianPositiveLag(analysis.events);
  const overall = nextSteps[audience];
  const nominal = analysis.lag_trend.p_value;
  const trend = analysis.lag_trend.slope_days_per_decade;
  const siteLevel = nominal !== null && nominal !== undefined && nominal < 0.05;
  const adjusted = nominal !== null && nominal !== undefined && nominal < 0.0125;

  return <section className="rs-conclusion" aria-labelledby="rs-conclusion-heading">
    <div className="rs-conclusion-head"><span>RESEARCH FINDING / {siteName.toUpperCase()}</span><span>VERIFIED NASA POWER MODEL SNAPSHOT</span></div>
    <div className="rs-conclusion-layout">
      <div className="rs-conclusion-main">
        <p className="rs-kicker">THE ANSWER, BEFORE THE CHARTS</p>
        <h2 id="rs-conclusion-heading">The surface recovered first<br/><em>in {positive} of {total} modeled drought episodes.</em></h2>
        <p className="rs-conclusion-lead">{fraction}% of the detected episodes at this study point had a completed surface-first recovery. Among those events, the median delay was <strong>{median === null ? "not estimable" : String(median) + " days"}</strong>. This is a local historical screening result, not evidence that a field is dry today.</p>
        <p className="rs-conclusion-plain">{trend === null ? "There are too few complete events to estimate a reliable signed time trend." : siteLevel && !adjusted ? "A nominal event-level time pattern appeared, but it did not survive a simple correction for testing four sites." : siteLevel ? "The exploratory event test shows a candidate time pattern, but it still lacks independent validation." : "The event-level test did not establish a changing recovery-delay trend under the current thresholds."} {trend !== null && "The estimated signed slope is " + (trend > 0 ? "+" : "") + trend.toFixed(2) + " days per decade; this includes root-first cases and is not an estimate of crop damage."}</p>
        <div className="rs-conclusion-actions"><button type="button" onClick={onEvents}>Inspect drought episodes <ArrowDownRight size={17}/></button><button type="button" onClick={onResearch}>Examine confidence <ArrowUpRight size={17}/></button></div>
      </div>
      <div className="rs-conclusion-aside">
        <span className="rs-conclusion-aside-label">OUR CONCLUSION</span>
        <strong>Detected: yes.<br/>Independently validated: no.</strong>
        <p>ROOTSHADOW identifies candidate recovery mismatches and explains why they warrant investigation. It does not yet confirm a changing climate trend or prescribe irrigation.</p>
        <div><span>PAIRED DAILY DATA</span><b>{(analysis.quality.paired_day_coverage * 100).toFixed(1)}%</b></div>
        <div><span>SCIENTIFIC RELEASE STATUS</span><b>{analysis.ready_for_scientific_claims ? "Validated" : "Exploratory"}</b></div>
      </div>
    </div>
    <div className="rs-outcome">
      <div className="rs-outcome-text"><span>WHAT SHOULD HAPPEN NEXT?</span><h3>The next step depends on who is asking.</h3><p>Choose your perspective to see how this evidence could be used responsibly. The research data remains the same.</p></div>
      <div className="rs-audience-control" role="group" aria-label="Choose perspective">
        <button className={audience === "land" ? "active" : ""} type="button" onClick={() => setAudience("land")}>Land manager</button>
        <button className={audience === "research" ? "active" : ""} type="button" onClick={() => setAudience("research")}>Researcher</button>
        <button className={audience === "policy" ? "active" : ""} type="button" onClick={() => setAudience("policy")}>Planner</button>
      </div>
      <div className="rs-outcome-details">
        <h4>{overall.title}</h4><p>{overall.meaning}</p>
        <ol>{overall.actions.map(item => <li key={item}>{item}</li>)}</ol>
      </div>
      <div className="rs-conclusion-export"><button type="button" onClick={() => exportConclusion(siteName, analysis, positive, median)}><Download size={16}/> Export this finding</button><span>Cross-check next:</span>{sourceLinks.map(item => <a key={item.name} href={item.url} target="_blank" rel="noreferrer">{item.name} <ExternalLink size={12}/></a>)}</div>
    </div>
  </section>;
}
