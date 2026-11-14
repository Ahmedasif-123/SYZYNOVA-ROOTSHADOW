import { useState } from "react";
import { ArrowRight, CheckCircle2, CircleHelp, FlaskConical, MapPinned, ShieldAlert } from "lucide-react";
import type { Analysis } from "../lib/api";
import { medianPositiveLag } from "../lib/api";
import { findSite, type SiteId } from "../lib/sites";

type Props = { site: SiteId; analysis: Analysis; onResearch: () => void };

const interpretation: Record<SiteId, { headline: string; finding: string; qualification: string; nextStep: string }> = {
  us_sgp_goodwell: {
    headline: "A repeatable surface-first pattern deserves a closer look.",
    finding: "Goodwell has the largest count of completed surface-first recoveries in this four-site sample. Its exploratory signed-delay test suggests a downward, not upward, tendency.",
    qualification: "The nominal trend result does not clear a simple four-location multiple-test threshold. The confidence interval and dependence assumptions also limit interpretation.",
    nextStep: "Prioritize independent SMAP, GLDAS or station comparison before making any agricultural or climatic claim."
  },
  us_sgp_stillwater: {
    headline: "A drought event does not guarantee a surface-first recovery.",
    finding: "Only a minority of detected Stillwater drought episodes completed a surface-first recovery under the study thresholds.",
    qualification: "The small number of complete positive delays does not support a trend conclusion.",
    nextStep: "Examine censored and root-first cases, then compare model output with independent measurements."
  },
  australia_narrabri: {
    headline: "Surface-first recovery occurs, but a long-term direction is not detected.",
    finding: "Narrabri contains multiple complete surface-first recoveries without a detectable signed-gap time trend under the tested method.",
    qualification: "A non-significant trend test is not proof that the underlying process never changes.",
    nextStep: "Repeat with alternative root-zone products and soil-depth definitions."
  },
  spain_cordoba: {
    headline: "The signal varies by place, and some evidence remains inconclusive.",
    finding: "A limited subset of detected Córdoba drought episodes completed a surface-first recovery.",
    qualification: "The available event sample does not establish a directional trend.",
    nextStep: "Compare seasons and independent reanalysis products before translating results into risk guidance."
  }
};

export default function ResearchConclusions({ site, analysis, onResearch }: Props) {
  const [perspective, setPerspective] = useState<"farmer" | "researcher" | "planner">("farmer");
  const complete = analysis.events.filter(event => event.status === "COMPLETE_SURFACE_FIRST").length;
  const median = medianPositiveLag(analysis.events);
  const note = interpretation[site];
  const place = findSite(site);
  const perspectives = {
    farmer: {
      label: "For growers",
      message: "A green-looking surface is not enough to tell whether deeper soil has recovered. This historical screening tells you what to investigate, not when to irrigate.",
      action: "Use local probes, field conditions and agronomic advice before making decisions."
    },
    researcher: {
      label: "For researchers",
      message: "Quantify differences in modeled recovery timing, inspect event selection and sensitivity, then test whether another soil-moisture product reproduces the result.",
      action: "Replicate with GLDAS, SMAP or ERA5-Land and assess depth alignment and autocorrelation."
    },
    planner: {
      label: "For water planners",
      message: "Use the geographic variation as a screening hypothesis to identify locations that deserve further monitoring, not to classify land as drought-stricken.",
      action: "Prioritize independent validation and document uncertainty before policy use."
    }
  };
  return (
    <section className="research-conclusions" aria-label="Research findings and practical interpretation">
      <div className="research-conclusions-head">
        <div><span className="eyebrow">RESEARCH OUTCOME / TESTABLE CONCLUSIONS</span><h2>What did we actually find?</h2><p>Real model-derived results, translated into a defensible finding and a next research action.</p></div>
        <span className="conclusion-evidence"><FlaskConical size={16} /> EXPLORATORY EVIDENCE</span>
      </div>
      <div className="conclusion-evidence-strip">
        <div><small>STUDY LOCATION</small><strong>{place.name}</strong></div>
        <div><small>DETECTED EPISODES</small><strong>{analysis.events.length}</strong></div>
        <div><small>SURFACE FIRST</small><strong>{complete}</strong></div>
        <div><small>MEDIAN POSITIVE LAG</small><strong>{median === null ? "Not established" : `${median} days`}</strong></div>
      </div>
      <div className="conclusion-layout">
        <div className="conclusion-main">
          <span className="conclusion-overline"><MapPinned size={15} /> {place.name.toUpperCase()} / LOCATION-SPECIFIC INTERPRETATION</span>
          <h3>{note.headline}</h3>
          <p>{note.finding}</p>
          <div className="conclusion-limit"><ShieldAlert size={20} /><div><strong>What this does not establish</strong><p>{note.qualification} The study cannot infer real-time root stress, crop loss or an irrigation requirement.</p></div></div>
          <div className="conclusion-next"><CheckCircle2 size={19} /><div><strong>The next action</strong><p>{note.nextStep}</p></div></div>
        </div>
        <div className="conclusion-audience">
          <span className="eyebrow">WHO IS USING THE EVIDENCE?</span>
          <div className="audience-tabs" role="group" aria-label="Choose interpretation audience">
            {(["farmer", "researcher", "planner"] as const).map(key => <button key={key} type="button" aria-pressed={perspective === key} className={perspective === key ? "active" : ""} onClick={() => setPerspective(key)}>{perspectives[key].label}</button>)}
          </div>
          <div className="audience-description" aria-live="polite"><h4>{perspectives[perspective].label}</h4><p>{perspectives[perspective].message}</p><div><CircleHelp size={16} /><span>{perspectives[perspective].action}</span></div></div>
          <button className="conclusion-workbench-link" type="button" onClick={onResearch}>Open the scientific workbench <ArrowRight size={16} /></button>
        </div>
      </div>
      <p className="conclusion-footer">Research conclusion derived from verified NASA POWER historical model snapshots (1981–2025). Four study points are an illustrative sample, not a global spatial survey. Method-specific audit outcomes are not independent scientific validation.</p>
    </section>
  );
}
