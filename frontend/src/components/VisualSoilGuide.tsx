import type { Analysis } from "../lib/api";

function shortRank(value: number | null): string {
  if (value === null) return "No reading";
  if (value <= 20) return "Very dry";
  if (value < 40) return "Below guide";
  if (value < 80) return "Typical range";
  return "Very wet";
}

function takeaway(surface: number | null, roots: number | null): string {
  if (surface === null || roots === null) return "No complete comparison for this month.";
  if (surface >= 40 && roots < 40) return "Surface ranks wetter; deeper soil is still below the study guide.";
  if (surface < 40 && roots >= 40) return "The root zone ranks above the guide while surface soil does not.";
  if (surface < 40 && roots < 40) return "Both layers rank below the study's recovery guide.";
  return "Both layers rank above the guide in this month.";
}

export default function VisualSoilGuide({ analysis, month }: { analysis: Analysis; month: string | null }) {
  const row = analysis.monthly.find(item => item.month === month) ?? analysis.monthly[0];
  if (!row) return null;
  const period = new Date(row.month + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  return <section className="visual-soil-guide" aria-label="Understand the selected monthly soil reading">
    <div className="visual-guide-reading" aria-live="polite">
      <span className="visual-guide-month">{period}</span>
      <span className="visual-guide-value"><i className="visual-guide-dot surface" /> Surface <strong>{row.top_percentile === null ? "—" : row.top_percentile.toFixed(0) + "th"}</strong><small>{shortRank(row.top_percentile)}</small></span>
      <span className="visual-guide-value"><i className="visual-guide-dot root" /> Root zone <strong>{row.root_percentile === null ? "—" : row.root_percentile.toFixed(0) + "th"}</strong><small>{shortRank(row.root_percentile)}</small></span>
      <p>{takeaway(row.top_percentile, row.root_percentile)}</p>
    </div>
    <div className="visual-guide-key"><span>Drier</span><span className="visual-guide-spectrum" role="img" aria-label="Historical percentile scale from 0 (drier) to 100 (wetter), with markers at 20 (dry-screening threshold) and 40 (recovery threshold)"><i /><b /></span><span>Wetter</span><small>20 = dry screening · 40 = recovery guide</small><details><summary>What is a percentile?</summary>Historical wetness rank for the same season, not water content. A 97th-percentile reading ranks wetter than about 97% of comparable observations.</details></div>
  </section>;
}
