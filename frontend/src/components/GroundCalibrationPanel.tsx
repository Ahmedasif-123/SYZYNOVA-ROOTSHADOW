import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, Download, ExternalLink, Microscope } from "lucide-react";

type ModelMetrics = {
  brier: number;
  roc_auc: number | null;
  average_precision: number | null;
  expected_calibration_error: number;
  count: number;
  at_probability_0_5: { recall: number | null; precision: number | null; balanced_accuracy: number | null };
};
type CalibrationReport = {
  status: string;
  ground_truth: string;
  station_count: number;
  fixed_training_only_baseline: string;
  evaluation: {
    splits: Record<"train" | "validation" | "test", { date_range: string; rows: number }>;
    selected_model: string;
    ground_calibration_demonstrated: boolean;
    test_relative_brier_improvement_over_root_only_logistic: number;
    validation: Record<string, ModelMetrics>;
    test: Record<string, ModelMetrics>;
  };
  cross_region_transfer: Record<string, { metrics?: ModelMetrics; status?: string }>;
  limitations: string[];
};
const names: Record<string, string> = {
  model_root_only_logistic: "NASA root rank · logistic baseline",
  multi_input_logistic: "NASA climate features · logistic",
  multi_input_gradient_boosting: "NASA climate features · boosted trees"
};

function validate(value: unknown): value is CalibrationReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<CalibrationReport>;
  return report.status === "INDEPENDENT_GROUND_TRUTH_ML_EVALUATION_NOT_OPERATIONAL" &&
    report.station_count === 4 &&
    !!report.evaluation?.test?.model_root_only_logistic &&
    !!report.evaluation?.validation?.multi_input_gradient_boosting &&
    Array.isArray(report.limitations);
}

async function getReport(signal?: AbortSignal): Promise<CalibrationReport> {
  const response = await fetch(import.meta.env.BASE_URL + "validation/noaa-ai-calibration.json", { signal });
  if (!response.ok) throw new Error("The actual NOAA-trained AI evaluation record is unavailable.");
  const data: unknown = await response.json();
  if (!validate(data)) throw new Error("The field-calibrated AI evaluation failed schema validation.");
  return data;
}

function formatted(value: number | null | undefined, places = 3) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(places);
}

export default function GroundCalibrationPanel() {
  const query = useQuery({ queryKey: ["noaa-ground-ai-evaluation"], queryFn: ({ signal }) => getReport(signal), staleTime: Infinity, retry: 1 });
  const report = query.data;
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "rootshadow-noaa-ground-truth-ai-evaluation.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  return <section className="mle-panel" aria-label="Independent ground-trained machine learning evaluation">
    <header className="mle-heading"><div><span className="vld-overline"><Microscope size={16}/> 04 / MACHINE LEARNING AGAINST GROUND TRUTH</span><h2>We trained the model.<br/><em>Then challenged it.</em></h2><p>Three real machine-learning models were trained to estimate same-day NOAA-measured deep-soil dryness from NASA model features. The test period was never used for fitting or choosing the winner.</p></div><div className="mle-verdict"><AlertTriangle size={20}/><strong>Not an operational AI forecast</strong><span>These are retrospective Oklahoma ground-truth comparisons, not predictions for farms or the other 95 study points.</span></div></header>
    {query.isPending && <p role="status" className="mle-message">Reading the independently evaluated training results…</p>}
    {query.isError && <p role="alert" className="mle-message">{query.error.message}. No artificial metrics are displayed.</p>}
    {report && <>
      <div className="mle-splits">
        <div><small>TRAINING · 2013–2019</small><strong>{report.evaluation.splits.train.rows.toLocaleString("en-US")}</strong><span>Observed NOAA-labelled days</span></div>
        <div><small>VALIDATION · 2020–2021</small><strong>{report.evaluation.splits.validation.rows.toLocaleString("en-US")}</strong><span>Model choice determined here</span></div>
        <div><small>TEST · 2022–2025</small><strong>{report.evaluation.splits.test.rows.toLocaleString("en-US")}</strong><span>Unseen ground-truth records</span></div>
      </div>
      <div className="mle-results">
        <div className="mle-criterion"><div><span className="vld-overline">RESULT / MODEL SELECTION</span><h3>{report.evaluation.ground_calibration_demonstrated ? "Evidence of improvement in this pilot." : "Complexity did not win."}</h3><p>{report.evaluation.ground_calibration_demonstrated ? "The validation-selected model improved on the single-input baseline on the independent temporal holdout, within this geographically limited pilot." : "The validation set chose the simple root-percentile logistic model. The experiment did not establish that adding more inputs or more complex machine learning improves the final selected model over this simple baseline."}</p></div><div><strong>{formatted(report.evaluation.test[report.evaluation.selected_model]?.roc_auc)}</strong><span>Selected model's test ROC-AUC</span></div></div>
        <div className="mle-table-scroll"><table><caption>Pre-registered model comparison against NOAA ground measurements</caption><thead><tr><th>Model</th><th>Validation Brier ↓</th><th>Test Brier ↓</th><th>Test ROC-AUC ↑</th><th>Model selected?</th></tr></thead><tbody>{Object.entries(names).map(([id, name]) => <tr key={id} className={report.evaluation.selected_model === id ? "mle-winner" : ""}><th scope="row">{name}</th><td>{formatted(report.evaluation.validation[id]?.brier, 4)}</td><td>{formatted(report.evaluation.test[id]?.brier, 4)}</td><td>{formatted(report.evaluation.test[id]?.roc_auc, 3)}</td><td>{report.evaluation.selected_model === id ? <><CheckCircle2 size={14}/> Yes, from validation</> : "No"}</td></tr>)}</tbody></table></div>
        <p className="mle-table-note">Lower Brier score means better probabilistic accuracy; higher ROC-AUC means better discrimination. Selecting the best model after seeing final test results would invalidate the holdout. A lower test score for an unselected model must not be cherry-picked as the verified winner.</p>
      </div>
      <div className="mle-transfer"><div><span className="vld-overline">GEOGRAPHIC GENERALIZATION / CHALLENGE</span><h3>Does the model work somewhere else?</h3><p>A model trained on only one Oklahoma area was evaluated on independent probe records in the other area, without training at the target location. Poor transfer limits expansion to other climates.</p></div><div className="mle-transfer-cards">{Object.entries(report.cross_region_transfer).map(([id, entry]) => <div key={id}><small>{id.replaceAll("_", " ").replace("us sgp ", "").replace(" to ", " → ")}</small><strong>{formatted(entry.metrics?.brier, 4)}</strong><span>Held-out Brier score</span></div>)}</div></div>
      <div className="mle-method"><span><BarChart3 size={16}/> Scientific conclusion</span><p>ROOTSHADOW now has a reproducibly trained, independently labelled ML research model. <strong>It has not demonstrated enough generalization or improvement to justify operational farm forecasts.</strong> The model is kept as a research artifact; no future moisture or irrigation predictions are served to users.</p><div className="mle-actions"><button type="button" onClick={download}><Download size={15}/> Download complete ML evaluation</button><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/blob/noaa-ai-ground-calibration-2026/scripts/train_noaa_calibration.py" target="_blank" rel="noreferrer">Inspect training source <ExternalLink size={15}/></a><a href="https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/actions/workflows/noaa-ai-training.yml" target="_blank" rel="noreferrer">Reproduce the evaluation <ArrowUpRight size={15}/></a></div></div>
    </>}
  </section>;
}
