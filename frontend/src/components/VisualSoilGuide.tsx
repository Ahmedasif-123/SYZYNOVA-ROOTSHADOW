import type { Analysis } from "../lib/api";

type Reading = Analysis["monthly"][number];

function label(value: number | null): string {
  if (value === null) return "No reading";
  if (value <= 20) return "Unusually dry";
  if (value < 40) return "Below recovery guide";
  if (value < 80) return "Middle of history";
  return "Unusually wet";
}

function message(top: number | null, root: number | null): string {
  if (top === null || root === null) return "One or both layers have no usable modeled reading this month.";
  if (top >= 40 && root < 40) return "The surface ranks above the recovery guide, while deeper soil is still below it.";
  if (root >= 40 && top < 40) return "Deeper soil ranks above the guide while the surface remains below it.";
  if (top < 40 && root < 40) return "Both layers rank below the recovery guide for this month.";
  return "Both layers rank above the recovery guide this month. Sustained recovery is tested separately.";
}

function Meter({ labelText, value, kind }: { labelText: string; value: number | null; kind: "top" | "root" }) {
  return <div className="visual-meter">
    <div className="visual-meter-header"><strong>{labelText}</strong><span>{value === null ? "No reading" : value.toFixed(1) + "th percentile"}<small>{label(value)}</small></span></div>
    <div className="visual-meter-track" role="img" aria-label={labelText + (value === null ? ": no reading" : ": " + value.toFixed(1) + "th percentile compared with historical seasons")}>
      <span className="visual-meter-guide guide-dry" /><span className="visual-meter-guide guide-recovery" />
      {value !== null && <span className={"visual-meter-marker " + kind} style={{ left: value + "%" }} />}
    </div>
  </div>;
}

export default function VisualSoilGuide({ analysis, month }: { analysis: Analysis; month: string | null }) {
  const row: Reading | undefined = analysis.monthly.find(item => item.month === month) ?? analysis.monthly[0];
  if (!row) return null;
  const monthName = new Date(row.month + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const top = row.top_percentile;
  const root = row.root_percentile;
  return <div className="visual-soil-guide" aria-live="polite" aria-label="Understand the selected monthly soil reading">
    <div className="visual-soil-intro"><div><span className="guided-overline">READ THE SOIL AT A GLANCE</span><strong>{monthName}</strong></div><p>{message(top, root)}</p></div>
    <div className="visual-soil-meters"><Meter labelText="Surface" value={top} kind="top" /><Meter labelText="Root zone" value={root} kind="root" /></div>
    <div className="visual-scale-key"><span>0 · historically drier</span><div><span className="visual-key-line dry" />20 · dry-screening guide</div><div><span className="visual-key-line recovery" />40 · recovery guide</div><span>100 · historically wetter</span></div>
    <details className="visual-tiny-help"><summary>What does 97th percentile mean?</summary><span>Wetter than roughly 97% of comparable historical observations. It does not mean 97% water content. Monthly ranks do not by themselves establish a completed drought recovery.</span></details>
  </div>;
}
