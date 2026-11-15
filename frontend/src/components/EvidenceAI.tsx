import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, BookOpenText, BrainCircuit, ExternalLink, LockKeyhole, RefreshCcw, ShieldAlert } from "lucide-react";
import { findSite, productSites, researchSites, siteRegions, type SiteId } from "../lib/sites";

type Role = "scientist" | "engineer" | "ministry";
type Source = { id: string; label: string; url: string };
type Answer = {
  status: string;
  model: string;
  answer: string;
  conclusion: string;
  evidence_refs: string[];
  uncertainties: string[];
  sources: Source[];
  usage: { input_tokens: number | null; output_tokens: number | null; estimated_max_standard_cost_usd: number | null } | null;
};
type Availability = { enabled: boolean; model: string };
type Props = { selected: SiteId; onSelect: (id: SiteId) => void; onExplore: () => void; onValidation: () => void };

const prompts = [
  "Does this location's modeled moisture show a surface–root mismatch, and what can we actually conclude?",
  "What independent observations would an agricultural engineer need before taking action?",
  "How reliable was the mismatch screen against independent NOAA soil probes?",
  "What do the historical scientific audit and sensitivity analysis really support?"
];

export default function EvidenceAI({ selected, onSelect, onExplore, onValidation }: Props) {
  const [service, setService] = useState<Availability | null>(null);
  const [role, setRole] = useState<Role>("scientist");
  const [code, setCode] = useState("");
  const [question, setQuestion] = useState(prompts[0]);
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const place = findSite(selected);

  useEffect(() => {
    let subscribed = true;
    fetch("/api/ask", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Missing AI endpoint");
      return await response.json() as Availability;
    }).then(data => { if (subscribed) setService(data); })
      .catch(() => { if (subscribed) setService({ enabled: false, model: "gpt-6-astra" }); });
    return () => { subscribed = false; };
  }, []);

  async function ask() {
    if (busy || !service?.enabled || question.trim().length < 8 || !code.trim()) return;
    setBusy(true);
    setResult(null);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 57000);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ siteId: selected, perspective: role, question: question.trim(), accessCode: code }),
        signal: controller.signal
      });
      const body = await response.json() as Answer & { error?: string };
      if (!response.ok) throw new Error(body.error || "The evidence AI service failed.");
      if (typeof body.answer !== "string" || !Array.isArray(body.sources)) throw new Error("Unexpected response structure. No scientific interpretation was shown.");
      setResult(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The AI service could not be reached.");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  return <section className="eai-page" aria-label="Evidence grounded scientific AI">
    <header className="eai-header">
      <div><span className="eai-eyebrow"><BrainCircuit size={16}/> ROOTSHADOW / EVIDENCE AI</span><h1>Ask harder questions.<br/><em>Demand evidence.</em></h1><p>A high-capability language-model interpreter connected to historical NASA analyses and limited independent NOAA soil-probe measurements. It explains the findings and their limits, not imaginary predictions.</p></div>
      <aside className="eai-service"><BrainCircuit size={25}/><div><small>REASONING MODEL</small><strong>GPT-6 Astra</strong><p>{service === null ? "Checking secure API…" : service.enabled ? "Private service configured" : "Awaiting private API credentials"}</p></div></aside>
    </header>
    <div className="eai-caution"><ShieldAlert size={20}/><p><strong>Not an AI drought forecast.</strong> The available NASA model data do not establish field-level water stress, safe irrigation amounts, future rainfall, water savings, or validated forecasting skill.</p></div>
    <div className="eai-layout">
      <section className="eai-box" aria-label="Ask evidence AI">
        <span className="eai-eyebrow">01 / SOURCE-BOUND QUESTION</span><h2>Investigate a research location.</h2>
        <label className="eai-field"><span>STUDY LOCATION</span><select aria-label="AI research location" value={selected} onChange={event => { onSelect(event.target.value as SiteId); setResult(null); setError(""); }}><optgroup label="Original six">{researchSites.map(site => <option key={site.id} value={site.id}>{site.name} · {site.country}</option>)}</optgroup>{siteRegions.map(region => <optgroup label={region} key={region}>{productSites.filter(site => site.region === region).map(site => <option key={site.id} value={site.id}>{site.name} · {site.country}</option>)}</optgroup>)}</select></label>
        <div className="eai-field"><span>PROFESSIONAL PERSPECTIVE</span><div className="eai-roles" role="group" aria-label="Scientific AI perspective">{([{ key: "scientist", label: "Scientist" }, { key: "engineer", label: "Agri-engineer" }, { key: "ministry", label: "Ministry" }] as const).map(item => <button type="button" key={item.key} className={role === item.key ? "active" : ""} aria-pressed={role === item.key} onClick={() => { setRole(item.key); setResult(null); }}>{item.label}</button>)}</div></div>
        <div className="eai-presets"><span>RESEARCH QUESTIONS</span>{prompts.map(prompt => <button type="button" key={prompt} onClick={() => { setQuestion(prompt); setError(""); }}>{prompt}<ArrowUpRight size={14}/></button>)}</div>
        <label className="eai-field"><span>YOUR QUESTION</span><textarea aria-label="Ask a question about verified ROOTSHADOW evidence" rows={4} maxLength={700} value={question} onChange={event => setQuestion(event.target.value)} /></label>
        <label className="eai-field"><span><LockKeyhole size={14}/> PRIVATE PRESENTER ACCESS CODE</span><input aria-label="Private presenter access code" type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} placeholder="Configured privately on Vercel"/><small>The code is verified by our server. It is not submitted to the AI model or stored in your browser.</small></label>
        <button className="eai-ask" type="button" disabled={busy || !service?.enabled || !code.trim() || question.trim().length < 8} onClick={ask}>{busy ? <RefreshCcw size={16} className="eai-spinner"/> : <BrainCircuit size={17}/>} {busy ? "Interpreting verified evidence…" : "Analyze with GPT-6 Astra"} <ArrowUpRight size={15}/></button>
        {!service?.enabled && service !== null && <p className="eai-warning" role="status">The private OpenAI API key and presenter code must be configured on Vercel before this service can accept questions. All existing NASA research and NOAA evidence remain available.</p>}
        {error && <p className="eai-error" role="alert">{error}</p>}
      </section>
      <div className="eai-outcomes">
        <section className="eai-box" aria-label="Evidence AI response">
          <span className="eai-eyebrow">02 / SCIENTIFIC INTERPRETATION</span>
          {result ? <>
            <h2>{result.conclusion === "insufficient_evidence" ? "Evidence insufficient." : "What the evidence supports."}</h2>
            <p className="eai-answer">{result.answer}</p>
            <div className="eai-limit"><strong>Important uncertainty</strong>{result.uncertainties.length ? <ul>{result.uncertainties.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>Results remain exploratory unless corroborated by independent measurements.</p>}</div>
            <div className="eai-sources"><h3>Underlying sources</h3>{result.sources.length ? result.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={14}/></a>) : <p>No source supports the requested forecast or farm prescription.</p>}</div>
            {result.usage && <p className="eai-usage">{result.model} · {result.usage.input_tokens ?? "—"} input tokens · {result.usage.output_tokens ?? "—"} output tokens · Estimated standard cost USD {result.usage.estimated_max_standard_cost_usd?.toFixed(4) ?? "—"}</p>}
          </> : <div className="eai-empty"><BookOpenText size={27}/><h2>Start with a falsifiable question.</h2><p>For {place.name}, the assistant can examine verified historical model events, recent source-labelled conditions, and NOAA field-probe comparisons only where those comparisons exist.</p><p>It does not invent a forecast or replace real agricultural engineering.</p></div>}
        </section>
        <section className="eai-box eai-explainer"><span className="eai-eyebrow">03 / RESEARCH BOUNDARIES</span><h3>Explanation is not prediction.</h3><p><strong>NASA:</strong> Model-derived point histories, not readings from individual farms.</p><p><strong>NOAA:</strong> Independent soil probes at four Oklahoma pilot stations, including important disagreements.</p><p><strong>AI:</strong> A reasoning interface for supplied evidence. Predictive ML requires separate chronological testing and independent validation.</p><div className="eai-actions"><button type="button" onClick={onExplore}>Explore NASA records <ArrowUpRight size={14}/></button><button type="button" onClick={onValidation}>Open Validation Lab <ArrowUpRight size={14}/></button></div></section>
      </div>
    </div>
    <footer className="eai-footnote"><Activity size={15}/> All 97 study locations are gridded model points, not spatially continuous farm measurements. We never infer irrigation volumes or future crop conditions without the required independent inputs.</footer>
  </section>;
}
