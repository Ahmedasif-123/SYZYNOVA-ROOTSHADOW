import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, Download, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { blankProbeInputs, evaluateProbe, type ProbeInputs } from "../lib/probeVerification";
import type { ReviewCategory } from "../lib/decision";
import ProbeMoistureChart from "./ProbeMoistureChart";

type Props = { siteId: string; siteName: string; modelCategory: ReviewCategory; modelDate: string | null; perspective: "ministry" | "engineer" | "researcher" };
type LocalProbeRecord = { savedAt: string; siteId: string; siteName: string; verdict: string; inputs: ProbeInputs; measuredOn: string; notes: string };
const SAVE_KEY = "rootshadow-probe-records-v1";
type AiReading = { status: string; model: string; authoritative_verdict: string; explanation: string; next_checks: string[]; scientific_limit: string; provenance: string; confidence: string };
const depths = [
  { depth: "30", label: "30 cm / shallower root zone" },
  { depth: "60", label: "60 cm / deeper root zone" }
] as const;
const source = "/validation/noaa-pilot.json";

export default function ProbeVerificationCard({ siteId, siteName, modelCategory, modelDate, perspective }: Props) {
  const [inputs, setInputs] = useState<ProbeInputs>({ ...blankProbeInputs });
  const [measuredOn, setMeasuredOn] = useState("");
  const [notes, setNotes] = useState("");
  const [savedRecords, setSavedRecords] = useState<LocalProbeRecord[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((v): v is LocalProbeRecord =>
        v !== null && typeof v === "object" && typeof v.savedAt === "string" && typeof v.siteId === "string").slice(0, 25) : [];
    } catch { return []; }
  });
  const [ai, setAi] = useState<AiReading | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const result = useMemo(() => evaluateProbe(inputs), [inputs]);
  const complete = result.verdict !== "incomplete";
  function update(key: keyof ProbeInputs, value: string) {
    controller.current?.abort();
    setAi(null);
    setAiError(null);
    setAiBusy(false);
    setInputs(current => ({ ...current, [key]: value }));
  }
  function clear() {
    controller.current?.abort();
    setAi(null);
    setAiError(null);
    setAiBusy(false);
    setInputs({ ...blankProbeInputs });
    setMeasuredOn("");
    setNotes("");
  }
  async function explainWithAI() {
    if (!complete || aiBusy) return;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setAiBusy(true);
    setAi(null);
    setAiError(null);
    try {
      const response = await fetch("/api/probe-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: active.signal,
        body: JSON.stringify({ siteId, modelCategory, perspective, measurements: inputs })
      });
      const data = await response.json() as AiReading & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to generate AI interpretation.");
      if (data.status !== "explained" || data.authoritative_verdict !== result.verdict || !Array.isArray(data.next_checks)) throw new Error("AI explanation did not preserve the measured result.");
      if (!active.signal.aborted) setAi(data);
    } catch (error) {
      if (!active.signal.aborted) setAiError(error instanceof Error ? error.message : "AI interpretation unavailable.");
    } finally {
      if (!active.signal.aborted) setAiBusy(false);
    }
  }
  function saveLocally() {
    if (!complete) return;
    const entry: LocalProbeRecord = {
      savedAt: new Date().toISOString(), siteId, siteName, verdict: result.verdict,
      inputs: { ...inputs }, measuredOn, notes: notes.trim().slice(0, 500)
    };
    const updated = [entry, ...savedRecords].slice(0, 25);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(updated)); setSavedRecords(updated); } catch {}
  }
  function clearLocalHistory() {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    setSavedRecords([]);
  }
  function exportReport() {
    const record = {
      product: "ROOTSHADOW Field Verification Pilot",
      exported_utc: new Date().toISOString(),
      reference_model_point: { id: siteId, name: siteName, category: modelCategory, observation_date: modelDate },
      user_supplied_field_measurements: {
        measurement_date: measuredOn || null,
        units: "volumetric soil water content, percent",
        sensor_depths_cm: [30, 60],
        readings: inputs,
        observer_notes: notes.trim() || null,
        independently_verified: false
      },
      calculation: result,
      optional_ai_commentary: ai ? { model: ai.model, explanation: ai.explanation, next_checks: ai.next_checks, scientific_limit: ai.scientific_limit, status: "unvalidated generated explanation; field verdict unchanged" } : null,
      sources: {
        model: "NASA POWER / MERRA-2 gridded estimates; not included in the field verdict",
        noaa_pilot: "ROOTSHADOW NOAA USCRN four-station validation pilot"
      },
      limitation: "Experimental user-entered field-verification worksheet. Local targets and sensor uncertainty must be established independently. Not a validated classifier, calibrated reliability score, or irrigation prescription. No recommendation to reduce or increase irrigation automatically."
    };
    const href = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = "rootshadow-field-verification-" + siteId + ".json";
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }
  return <section className="probe-card" aria-label="Field soil-probe verification tool">
    <header className="probe-card-header">
      <div><span className="desk-eyebrow">05 / REAL-WORLD VERIFICATION WORKFLOW</span>
        <h3>Did the rain reach the roots?</h3>
        <p>Convert a regional model concern into a concrete field check. Enter <strong>real before-and-after probe readings</strong> at 30 and 60 cm and locally established minimum targets. No sample measurements are filled in.</p>
      </div>
      <span className="probe-mode">FIELD INPUTS / NOT NASA MEASUREMENTS</span>
    </header>
    <div className="probe-connection">
      <strong>Selected research grid: {siteName}</strong>
      <span>Model flag: {modelCategory.replaceAll("_", " ")} · Source observation: {modelDate ?? "not available"}. This grid signal can prompt a field check, but it does not determine the probe result.</span>
    </div>
    <div className="probe-instructions">
      <div><strong>1</strong><span>Measure the same representative locations and sensor depths before and after rain, using a calibrated device.</span></div>
      <div><strong>2</strong><span>Enter the farm's own crop/soil minimum moisture targets and sensor uncertainty. Do not substitute NASA percentiles.</span></div>
      <div><strong>3</strong><span>Review the result and export an evidence record. An agronomist must approve any irrigation change.</span></div>
    </div>
    <div className="probe-table" role="group" aria-label="Actual soil moisture readings">
      <div className="probe-columns"><span>Probe depth</span><span>Before rain (%)</span><span>After rain (%)</span><span>Local minimum (%)</span></div>
      {depths.map(({ depth, label }) => <div className="probe-fields" key={depth}>
        <strong>{label}</strong>
        {(["before", "after", "threshold"] as const).map((field, i) => {
          const key = (field + depth) as keyof ProbeInputs;
          return <label key={key}><span className="probe-mobile-label">{["Before rain", "After rain", "Local minimum"][i]} (%)</span>
            <input aria-label={label + " " + ["before rain", "after rain", "locally established minimum"][i]} value={inputs[key]} onChange={event => update(key, event.target.value)} type="number" inputMode="decimal" min="0" max="100" step="0.1" placeholder="—"/>
          </label>;
        })}
      </div>)}
    </div>
    <div className="probe-meta">
      <label>Sensor uncertainty (± percentage points)
        <input type="number" min="0.1" max="10" step="0.1" inputMode="decimal" placeholder="Enter sensor tolerance" value={inputs.tolerance} onChange={event => update("tolerance", event.target.value)}/>
      </label>
      <label>Measurement date (optional)
        <input type="date" value={measuredOn} onChange={event => setMeasuredOn(event.target.value)}/>
      </label>
    </div>
    <details className="probe-guidance"><summary>How do I find a refill point or field-capacity target?</summary>
      <p><strong>Field capacity</strong> describes moisture remaining after excess gravitational water drains. The <strong>refill point</strong> is a management threshold set for crop type, rooting depth, growth stage and the soil's plant-available water, not a universal VWC number.</p>
      <p><strong>Sandy soil:</strong> drains relatively quickly and generally stores less plant-available water. <strong>Loamy soil:</strong> often retains more available water. <strong>Clay-rich soil:</strong> can hold substantial total moisture but may release less of it to plants. Measure or obtain targets for each field and depth; do not copy a percentage from a different soil.</p>
      <p>Request soil testing, probe-calibration guidance and crop-specific management allowable depletion from an agronomist. See <a href="https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/irrigation/soil-moisture-sensors-for-irrigation-scheduling" target="_blank" rel="noreferrer">University of Minnesota Extension's sensor guidance</a> and <a href="https://www.nrcs.usda.gov/sites/default/files/2022-10/nrcs142p2_051590.pdf" target="_blank" rel="noreferrer">USDA NRCS available-water-capacity reference</a>. Enter local volumetric percentages, not the NASA percentile ranks.</p>
    </details>
    <p className="probe-note">Use moisture values expressed as volumetric water content (%), not NASA seasonal percentile ranks. The minimum at each depth must be supplied from local crop/soil guidance; there is no universal safe irrigation threshold. The uncertainty input is your sensor's documented error margin, not a statistically estimated confidence interval.</p>
    <ProbeMoistureChart inputs={inputs}/>
    <div className={"probe-result probe-" + result.verdict} aria-live="polite">
      <div className="probe-result-top"><div><span>FIELD-BASED VERIFICATION OUTPUT</span><h4>{result.label}</h4></div><span className="probe-result-status">{complete ? "CONDITIONAL · USER-ENTERED" : "NO VERDICT YET"}</span></div>
      <p>{result.explanation}</p>
      {complete && <div className="probe-deltas">
        <span>30 cm moisture change <strong>{result.delta30 !== null ? (result.delta30 >= 0 ? "+" : "") + result.delta30.toFixed(1) + " percentage points" : "—"}</strong></span>
        <span>60 cm moisture change <strong>{result.delta60 !== null ? (result.delta60 >= 0 ? "+" : "") + result.delta60.toFixed(1) + " percentage points" : "—"}</strong></span>
      </div>}
      <div className="probe-next"><ClipboardCheck size={18}/><div><strong>WHAT TO DO NEXT</strong><span>{result.nextStep}</span></div></div>
    </div>
    {complete && <div className="probe-model-comparison"><strong>Model vs. measured-depth check</strong>
      <p>{modelCategory === "unavailable" ? "The NASA model screen is unavailable or outdated. Field measurements remain the only inputs to the conditional reading."
        : (result.verdict === "adequate" || result.verdict === "recovered") && ["root_dry", "persistent_mismatch", "mismatch"].includes(modelCategory)
        ? "The regional model flags a possible root-zone issue, while your entered measurements meet the local targets at the sampled depths. These are different scales, not an error in the probe. Confirm the probe and field context."
        : result.verdict === "not_recovered" && modelCategory === "no_flag"
        ? "The model has no low-root flag, but your entered field measurements indicate moisture below a local target. The absence of a model flag cannot override the field reading."
        : "The model and probe screen can be examined side by side, but their different units, spatial scales and verification status prevent a calibrated agreement score."}</p>
    </div>}
    <div className="probe-ai-panel">
      <div className="probe-ai-intro"><div><span className="desk-eyebrow"><Sparkles size={14}/> OPTIONAL / AI EXPLANATION</span><h4>Explain these readings with AI</h4><p>AI uses your entered probe values, the deterministic result and the selected model screening label. The calculated result cannot be altered by AI. AI wording may contain mistakes and cannot approve an irrigation change. Probe values are sent to the AI provider only when you click this button.</p></div><button type="button" disabled={!complete || aiBusy} onClick={() => { void explainWithAI(); }}><Sparkles size={15}/>{aiBusy ? "Interpreting measurements…" : ai ? "Refresh AI interpretation" : "Explain with AI"}</button></div>
      {aiError && <p className="probe-ai-error" role="alert">{aiError} The measured result above is unchanged.</p>}
      {ai && <div className="probe-ai-answer"><span>AI interpretation · {ai.model} · no calibrated confidence score</span><p>{ai.explanation}</p><strong>Suggested verification steps</strong><ol>{ai.next_checks.map((item, i) => <li key={i}>{item}</li>)}</ol><p className="probe-ai-limit">{ai.scientific_limit}</p></div>}
    </div>
    <div className="probe-local-log"><div><strong>Optional field record log</strong><p>Save measurements only in this browser, on this device. Nothing is uploaded to ROOTSHADOW's database. Records can be downloaded above or cleared here; locally saved readings are not independently validated research observations.</p></div>
      <div className="probe-buttons"><button type="button" disabled={!complete} onClick={saveLocally}>Save privately on this device</button><button type="button" disabled={!savedRecords.length} onClick={clearLocalHistory}>Erase local history ({savedRecords.length})</button></div>
      {savedRecords.length > 0 && <ul aria-label="Locally saved field readings">{savedRecords.slice(0, 4).map((r, i) => <li key={r.savedAt + i}>{new Date(r.savedAt).toLocaleString("en-GB")} · {r.siteName} · {r.verdict.replaceAll("_", " ")}</li>)}</ul>}
    </div>
    <div className="probe-footer"><p><ShieldAlert size={15}/> There is <strong>no validated farm-level reliability percentage</strong> for this worksheet, and no safe automatic irrigation cutback can be calculated from two depth readings alone.</p><div className="probe-buttons"><button type="button" onClick={clear}><RotateCcw size={14}/> Clear readings</button><button type="button" onClick={exportReport} disabled={!complete}><Download size={15}/> Export field assessment</button></div></div>
    <details className="probe-real-case">
      <summary>Real NOAA example: Goodwell, June 2022 — why field probes matter</summary>
      <div className="probe-case-grid">
        <div><span>NOAA USCRN / Goodwell 2 E</span><strong>30 / 30</strong><small>Days with measured surface–root mismatch in the pilot comparison</small></div>
        <div><span>NASA MERRA-2 model</span><strong>6 / 30</strong><small>Days when the corresponding model point flagged mismatch</small></div>
      </div>
      <p>These are real monthly event counts from the project's independent NOAA pilot, not simulated inputs or exact probe readings at 30 and 60 cm. The NOAA reference uses actual measurements at 5, 10, 20, 50 and 100 cm. The comparison exposes missed model flags; it does not validate this worksheet's classifications or prescribe irrigation.</p>
      <a href={source} target="_blank" rel="noreferrer">Inspect source NOAA validation dataset</a>
    </details>
  </section>;
}
