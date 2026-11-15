import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, ClipboardCheck, Database, Download, ExternalLink, MapPin, ShieldAlert } from "lucide-react";

type Matrix = {
  n: number;
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
  precision: number | null;
  recall: number | null;
  specificity: number | null;
  f1: number | null;
  balanced_accuracy: number | null;
  false_positive_rate: number | null;
  accuracy: number | null;
};

type MonthRecord = {
  month: string;
  paired_days: number;
  ground_root_dry_days: number;
  model_root_dry_days: number;
  model_surface_dry_days: number;
  modeled_mismatch_days: number;
  ground_observed_mismatch_days: number;
  model_root_median_percentile: number;
  ground_root_median_percentile: number;
};

type GroundStation = {
  station: string;
  model_site: string;
  station_coordinates: { latitude: number; longitude: number };
  point_separation_km: number;
  ground_reference_valid_days: number;
  holdout_paired_days: number;
  holdout_field_root_dry_days: number;
  holdout_observed_mismatch_days: number;
  predictors: {
    model_root_low_percentile: Matrix;
    surface_only_low_percentile: Matrix;
    model_mismatch_vs_probe_mismatch: Matrix;
  };
  rank_agreement: {
    model_root_vs_probe_root_spearman: number | null;
    model_surface_vs_probe_surface_spearman: number | null;
  };
  potential_additional_detection: {
    ground_root_dry_days_surface_only_did_not_flag: number;
    ground_root_dry_days_model_root_caught_but_surface_did_not: number;
  };
  monthly_holdout_evidence: MonthRecord[];
  noaa_source_records: { url: string; sha256: string; rows: number }[];
  source_year_errors: { year: number; error: string }[];
};

type Report = {
  status: string;
  created_utc: string;
  reference_window: string;
  holdout_window: string;
  rank_definition: string;
  root_profile_weights: Record<string, number>;
  stations_evaluated: number;
  stations: GroundStation[];
  errors: { station: string; error: string }[];
  limitations: string[];
};

function validReport(value: unknown): value is Report {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Report>;
  return v.status === "INDEPENDENT_IN_SITU_PILOT_NOT_GENERAL_VALIDATION" &&
    v.stations_evaluated === 4 &&
    Array.isArray(v.stations) &&
    v.stations.length === 4 &&
    v.stations.every(s => typeof s.station === "string" && s.holdout_paired_days > 0 && !!s.predictors?.model_mismatch_vs_probe_mismatch && Array.isArray(s.monthly_holdout_evidence)) &&
    Array.isArray(v.limitations);
}

async function getReport(signal?: AbortSignal): Promise<Report> {
  const response = await fetch(import.meta.env.BASE_URL + "validation/noaa-pilot.json", { signal });
  if (!response.ok) throw new Error("The independent NOAA validation evidence file is missing.");
  const data: unknown = await response.json();
  if (!validReport(data)) throw new Error("The NOAA validation evidence has an unexpected schema.");
  return data;
}

function percentage(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(value) ? "Unavailable" : (value * 100).toFixed(digits) + "%";
}

function score(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "Unavailable" : value.toFixed(3);
}

function label(station: string) {
  return station.replace(/^OK_/, "").replaceAll("_", " ");
}

function EvidenceBars({ rows }: { rows: MonthRecord[] }) {
  if (!rows.length) return <p>No paired months available for comparison.</p>;
  const max = Math.max(1, ...rows.map(r => Math.max(r.modeled_mismatch_days, r.ground_observed_mismatch_days)));
  const segment = 670 / rows.length;
  return <div className="vld-plot" role="img" aria-label="Paired NOAA ground-observed mismatch days and NASA model mismatch days for each available test month">
    <svg viewBox="0 0 745 185" preserveAspectRatio="xMidYMid meet">
      {[0, 0.5, 1].map(frac => <g key={frac}><line x1="47" x2="717" y1={145 - frac * 125} y2={145 - frac * 125} stroke="#d6dfd3"/><text x="37" y={149 - frac * 125} textAnchor="end" fontSize="11" fill="#4c6351">{Math.round(max * frac)}</text></g>)}
      {rows.map((record, i) => {
        const xx = 47 + i * segment;
        const groundHeight = 125 * record.ground_observed_mismatch_days / max;
        const modelHeight = 125 * record.modeled_mismatch_days / max;
        return <g key={record.month}><rect x={xx + 1} y={145 - groundHeight} width={Math.max(2, segment * .35)} height={groundHeight} fill="#236c58"/><rect x={xx + segment * .42} y={145 - modelHeight} width={Math.max(2, segment * .35)} height={modelHeight} fill="#c18a58"/><title>{record.month}: ground {record.ground_observed_mismatch_days} days, model {record.modeled_mismatch_days} days</title></g>;
      })}
      <text x="47" y="171" fontSize="11" fill="#48604e">{rows[0]?.month}</text>
      <text x="717" y="171" fontSize="11" textAnchor="end" fill="#48604e">{rows[rows.length - 1]?.month}</text>
    </svg>
    <div className="vld-plot-key"><span><i className="vld-ground"/> NOAA probe mismatch days</span><span><i className="vld-model"/> NASA model mismatch days</span></div>
  </div>;
}

export default function ValidationLab() {
  const [stationId, setStationId] = useState("OK_Goodwell_2_E");
  const [detector, setDetector] = useState<"model_root_low_percentile" | "surface_only_low_percentile" | "model_mismatch_vs_probe_mismatch">("model_mismatch_vs_probe_mismatch");
  const [matrixDisplay, setMatrixDisplay] = useState<"counts" | "share">("counts");
  const [monthIndex, setMonthIndex] = useState(-1);
  const query = useQuery({ queryKey: ["rootshadow-noaa-probe-validation"], queryFn: ({ signal }) => getReport(signal), staleTime: Infinity, retry: 1 });
  const report = query.data;
  const active = report?.stations.find(s => s.station === stationId) ?? report?.stations[0];
  const holdoutDays = 1461;
  const matrix = active?.predictors[detector];
  const monthRows = active?.monthly_holdout_evidence ?? [];
  const chosenMonth = monthRows.length ? monthRows[monthIndex < 0 ? monthRows.length - 1 : Math.min(monthIndex, monthRows.length - 1)] : null;
  const countsLabel = (value: number) => matrixDisplay === "counts" ? value.toLocaleString("en-US") : percentage(matrix?.n ? value / matrix.n : null);
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const node = document.createElement("a");
    node.href = url;
    node.download = "rootshadow-independent-noaa-validation-pilot.json";
    document.body.append(node);
    node.click();
    node.remove();
    URL.revokeObjectURL(url);
  }
  return <section className="vld-page" aria-label="Independent soil probe validation lab">
    <header className="vld-head">
      <div><span className="vld-overline"><ClipboardCheck size={15}/> ROOTSHADOW / INDEPENDENT EVIDENCE</span><h1>Can we trust<br/><em>the model?</em></h1><p>We tested the same soil-moisture screening idea against real NOAA ground probes, not just another reanalysis. The goal is to discover where the screen works, where it fails, and when it should not guide a decision.</p></div>
      <div className="vld-status"><ShieldAlert size={25}/><div><strong>Not ready for field decisions</strong><span>This is a retrospective four-station Oklahoma research pilot. It does not validate the global atlas or any irrigated Qatari farm.</span></div></div>
    </header>
    {query.isPending && <div className="vld-loading" role="status">Loading versioned NOAA ground-observation evidence…</div>}
    {query.isError && <div className="vld-loading" role="alert">Independent validation evidence unavailable: {query.error.message}. No measurements have been substituted.</div>}
    {report && active && <>
      <div className="vld-metrics">
        <div><small>NOAA SENSOR STATIONS</small><strong>4</strong><span>Two NASA model locations</span></div>
        <div><small>HOLDOUT PERIOD</small><strong>2022–25</strong><span>Not used in the percentile reference</span></div>
        <div><small>GROUND MEASUREMENTS</small><strong>5 depths</strong><span>5, 10, 20, 50 and 100 cm</span></div>
        <div><small>RESULT STATUS</small><strong>Mixed</strong><span>Mismatch screening performs poorly</span></div>
      </div>
      <div className="vld-explainer"><AlertTriangle size={19}/><p><strong>Key research finding:</strong> Root-zone rank correlations vary across stations, but the modeled surface–root mismatch catches only a small share of the probe-observed mismatch days. A correlation between two time series is not evidence that an event detector is accurate.</p></div>
      <section className="vld-selector" aria-label="Select NOAA ground station">
        <div><span className="vld-overline">01 / GROUND TRUTH</span><h2>Four chances to disprove the model.</h2><p>The stations are near Goodwell and Stillwater, Oklahoma. We compare modeled ranks with observations taken at multiple soil depths.</p></div>
        <div className="vld-station-buttons" role="group" aria-label="NOAA station">
          {report.stations.map(s => <button key={s.station} type="button" className={active.station === s.station ? "selected" : ""} aria-pressed={active.station === s.station} onClick={() => { setStationId(s.station); setMonthIndex(-1); }}><strong>{label(s.station)}</strong><span>{s.point_separation_km.toFixed(1)} km from study point</span></button>)}
        </div>
      </section>

      <section className="vld-experiment" aria-label="Interactive validated detection performance explorer">
        <div className="vld-experiment-head"><div><span className="vld-overline">EXPERIMENT / EXPLORE THE ERRORS</span><h3>Which method actually detects the measured condition?</h3><p>Select the published detector and inspect the four outcomes for {label(active.station)}. Every number is taken from NOAA-observed holdout comparisons, not from a generative AI model.</p></div><button type="button" onClick={() => { setDetector("model_mismatch_vs_probe_mismatch"); setMatrixDisplay("counts"); }}>Reset comparison</button></div>
        <div className="vld-mode-buttons" role="group" aria-label="Choose validation detector">
          <button type="button" aria-pressed={detector === "model_mismatch_vs_probe_mismatch"} onClick={() => setDetector("model_mismatch_vs_probe_mismatch")}>Surface–root mismatch</button>
          <button type="button" aria-pressed={detector === "model_root_low_percentile"} onClick={() => setDetector("model_root_low_percentile")}>Model root-zone dryness</button>
          <button type="button" aria-pressed={detector === "surface_only_low_percentile"} onClick={() => setDetector("surface_only_low_percentile")}>Surface-only baseline</button>
        </div>
        <div className="vld-mode-buttons" role="group" aria-label="Confusion matrix display">
          <button type="button" aria-pressed={matrixDisplay === "counts"} onClick={() => setMatrixDisplay("counts")}>Number of days</button>
          <button type="button" aria-pressed={matrixDisplay === "share"} onClick={() => setMatrixDisplay("share")}>Share of paired days</button>
        </div>
        {matrix && <div className="vld-confusion-grid" aria-live="polite">
          <div className="vld-confusion-cell"><span>True positive</span><strong>{countsLabel(matrix.true_positive)}</strong><small>Observed event, correctly flagged by the model</small></div>
          <div className="vld-confusion-cell false"><span>False positive</span><strong>{countsLabel(matrix.false_positive)}</strong><small>Model flagged an event not detected by the probes</small></div>
          <div className="vld-confusion-cell false"><span>False negative</span><strong>{countsLabel(matrix.false_negative)}</strong><small>Actual probe event missed by the model</small></div>
          <div className="vld-confusion-cell"><span>True negative</span><strong>{countsLabel(matrix.true_negative)}</strong><small>Both model and probes did not flag the event</small></div>
        </div>}
        {matrix && <div className="vld-cm-metrics"><span><strong>Recall:</strong> {percentage(matrix.recall)}</span><span><strong>Precision:</strong> {percentage(matrix.precision)}</span><span><strong>False alarms:</strong> {percentage(matrix.false_positive_rate)}</span><span><strong>Balanced accuracy:</strong> {percentage(matrix.balanced_accuracy)}</span></div>}
        <p><strong>Fixed scientific boundary:</strong> All numbers are from the previously evaluated 2022–2025 holdout using the fixed 40th-percentile rule. Switching detectors does not retrain a model or change thresholds. Different detectors answer different questions; their confusion matrices are not interchangeable.</p>
      </section>
      <div className="vld-two-col">
        <section className="vld-card" aria-label="Measured station performance">
          <div className="vld-card-head"><span className="vld-overline">02 / RETROSPECTIVE PERFORMANCE</span><h2>{label(active.station)}</h2><p><MapPin size={14}/> {active.point_separation_km.toFixed(2)} km station-to-model coordinate separation</p></div>
          <div className="vld-readouts"><div><small>ROOT-ZONE RANK CORRELATION</small><strong>{score(active.rank_agreement.model_root_vs_probe_root_spearman)}</strong><span>Spearman correlation against ground profile</span></div><div className="vld-failure"><small>GROUND MISMATCH DETECTED</small><strong>{percentage(active.predictors.model_mismatch_vs_probe_mismatch.recall)}</strong><span>Recall of actual probe mismatch days</span></div><div><small>PAIRED TEST DAYS</small><strong>{active.holdout_paired_days.toLocaleString("en-US")}</strong><span>{percentage(active.holdout_paired_days / holdoutDays)} coverage of four-year holdout</span></div></div>
          <div className="vld-callout"><strong>{active.holdout_paired_days / holdoutDays < .7 ? "Limited evaluation coverage" : "Adequate daily overlap for this pilot"}</strong><p>{active.holdout_paired_days / holdoutDays < .7 ? "Less than 70% of 2022–2025 days have complete depth-profile pairs. These findings are more sensitive to missing records." : "Daily overlap is relatively high, but one probe station still cannot represent a full NASA grid cell."}</p></div>
          <div className="vld-table-wrap"><table><caption>Detecting ground-observed low root-zone moisture</caption><thead><tr><th>Method</th><th>Recall</th><th>Precision</th><th>False-positive rate</th></tr></thead><tbody><tr><th scope="row">NASA root-zone screen</th><td>{percentage(active.predictors.model_root_low_percentile.recall)}</td><td>{percentage(active.predictors.model_root_low_percentile.precision)}</td><td>{percentage(active.predictors.model_root_low_percentile.false_positive_rate)}</td></tr><tr><th scope="row">Surface-only screen</th><td>{percentage(active.predictors.surface_only_low_percentile.recall)}</td><td>{percentage(active.predictors.surface_only_low_percentile.precision)}</td><td>{percentage(active.predictors.surface_only_low_percentile.false_positive_rate)}</td></tr></tbody></table></div>
          <p className="vld-subnote">The methods use the same 40th-percentile threshold but each data source has its own seasonal reference. Better recall alone is not proof of improvement when false alarms may also rise.</p>
          <div className="vld-mismatch-counter"><div><strong>{active.holdout_observed_mismatch_days}</strong><span>Ground-observed mismatch days</span></div><div><strong>{active.predictors.model_mismatch_vs_probe_mismatch.true_positive}</strong><span>Those days also flagged by the NASA mismatch screen</span></div><div><strong>{active.predictors.model_mismatch_vs_probe_mismatch.false_negative}</strong><span>Ground-observed mismatch days missed</span></div></div>
        </section>
        <section className="vld-card" aria-label="Monthly mismatch comparison">
          <span className="vld-overline">03 / WHERE THE MODEL AND PROBES DISAGREE</span><h2>Evidence, not optimism.</h2><p className="vld-intro">The bars show monthly counts of days meeting the same surface–root rule in the model and the independent field probes. They are not water-use volumes or irrigation recommendations.</p>
          <EvidenceBars rows={active.monthly_holdout_evidence}/>

          <div className="vld-month-control" role="region" aria-label="Explore a recorded NOAA month">
            <span className="vld-overline">INTERACTIVE TIMELINE / CHOOSE AN EVIDENCE MONTH</span>
            <label htmlFor="vld-month-slider">Selected month: {chosenMonth?.month ?? "Unavailable"}</label>
            <input id="vld-month-slider" type="range" aria-label="Select measured comparison month" min={0} max={Math.max(0, monthRows.length - 1)} step={1} value={monthIndex < 0 ? Math.max(0, monthRows.length - 1) : Math.min(monthIndex, Math.max(0, monthRows.length - 1))} disabled={monthRows.length < 2} onChange={event => setMonthIndex(Number(event.target.value))}/>
            {chosenMonth && <div className="vld-month-results" aria-live="polite">
              <div><strong>{chosenMonth.ground_observed_mismatch_days}</strong><small>Probe-observed mismatch days</small></div>
              <div><strong>{chosenMonth.modeled_mismatch_days}</strong><small>Model-flagged mismatch days</small></div>
              <div><strong>{chosenMonth.paired_days}</strong><small>Days with paired complete records</small></div>
            </div>}
            <p>These are counts, not date-by-date overlap. Without the individual paired daily records, the monthly bar difference cannot be treated as the number of false alarms or missed days.</p>
          </div>
          <div className="vld-interpretation"><h3>Why might the two disagree?</h3><p>NASA model cells average much larger areas than a local probe cluster. Soil texture, vegetation, irrigation, sensor placement and daily time standards can produce different soil-water responses.</p><p>The field measurement combines five depths into a transparent 0–100 cm approximate profile, while the model supplies its own root-zone representation. Both have uncertainty.</p></div>
          <div className="vld-trace"><span className="vld-overline">SOURCE TRACE</span><div><Database size={16}/><strong>{active.noaa_source_records.length} NOAA yearly source files</strong></div><div><ClipboardCheck size={16}/><strong>{active.ground_reference_valid_days.toLocaleString("en-US")} valid reference-profile days</strong></div><p>Each downloaded NOAA station-year source has a recorded SHA-256 checksum. Failed year requests are also recorded.</p><a href={active.noaa_source_records.at(-1)?.url} target="_blank" rel="noreferrer">Inspect NOAA raw station file <ExternalLink size={15}/></a></div>
        </section>
      </div>
      <section className="vld-protocol" aria-label="Ground validation scientific protocol">
        <div><span className="vld-overline">04 / METHODS AND SCIENTIFIC STATUS</span><h2>Reproducible, falsifiable, limited.</h2><p>We computed separate seasonal percentile reference distributions for NASA modeled surface and root-zone moisture and NOAA measured 5 cm and weighted 0–100 cm soil profiles. The reference is fixed to <strong>{report.reference_window}</strong>. Only the untouched <strong>{report.holdout_window}</strong> period is scored.</p><p>For each station, we report both successes and failures using confusion counts, recall, precision, false-positive rate, and rank correlation. Missing probe depth values are not interpolated.</p></div>
        <div className="vld-protocol-right"><h3>Current release decision</h3><p>Keep the 97-location atlas as a <strong>research screen</strong>. Do not represent surface–root model mismatches as confirmed drought, validated early warning, or direct farm management guidance.</p><p>Next: independently benchmark further regions, study disagreements, and only then evaluate calibrated AI correction against held-out ground observations.</p><button type="button" onClick={download}><Download size={17}/> Download complete ground-validation record</button></div>
      </section>
      <div className="vld-links"><a href="https://www.ncei.noaa.gov/access/crn/products.html" target="_blank" rel="noreferrer">NOAA USCRN measurement archive <ExternalLink size={14}/></a><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/blob/noaa-ground-probe-validation-2026/scripts/validate_noaa_probe.py" target="_blank" rel="noreferrer">Reproduce our pilot in Python <ArrowUpRight size={15}/></a><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/blob/noaa-ground-probe-validation-2026/docs/NOAA_GROUND_VALIDATION_PROTOCOL_2026-11-15.md" target="_blank" rel="noreferrer">Read the evaluation protocol <ArrowUpRight size={15}/></a></div>
      <p className="vld-footnote"><AlertTriangle size={15}/> Independent ground evidence for four Oklahoma stations does not justify transferring skill estimates to any of the other 95 selected global locations. Model agreement at a site is not a license to prescribe irrigation.</p>
    </>}
  </section>;
}
