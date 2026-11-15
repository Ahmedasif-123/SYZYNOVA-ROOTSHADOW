import type { ProbeInputs } from "../lib/probeVerification";

type Reading = { depth: "30" | "60"; before: number; after: number; threshold: number };
const parse = (v: string) => v.trim() === "" ? NaN : Number(v);

export default function ProbeMoistureChart({ inputs }: { inputs: ProbeInputs }) {
  const readings: Reading[] = (["30", "60"] as const).map(depth => ({
    depth,
    before: parse(inputs[("before" + depth) as keyof ProbeInputs]),
    after: parse(inputs[("after" + depth) as keyof ProbeInputs]),
    threshold: parse(inputs[("threshold" + depth) as keyof ProbeInputs])
  }));
  if (!readings.every(r => [r.before, r.after, r.threshold].every(v => Number.isFinite(v) && v >= 0 && v <= 100))) return null;
  const maximum = Math.min(100, Math.max(40, Math.ceil(Math.max(...readings.flatMap(r => [r.before, r.after, r.threshold])) / 10) * 10 + 10));
  const plotX = 138;
  const plotWidth = 520;
  const x = (v: number) => plotX + v * plotWidth / maximum;
  const ticks = Array.from({ length: 5 }, (_, i) => i * maximum / 4);
  return <div className="probe-measure-chart">
    <div className="probe-chart-head"><strong>Measured water at root depth</strong><span>Before vs. after rain · user-entered volumetric soil water content (%)</span></div>
    <div className="probe-chart-legend"><span><i className="probe-chart-before"/> Before rain</span><span><i className="probe-chart-after"/> After rain</span><span><i className="probe-chart-target"/> Local minimum target</span></div>
    <svg viewBox="0 0 720 268" role="img" aria-label={"Bar chart of before and after rain volumetric water content at 30 and 60 centimeters, with local targets. " + readings.map(r => r.depth + " centimeters: before " + r.before + "%, after " + r.after + "%, target " + r.threshold + "%").join(". ")} preserveAspectRatio="xMidYMid meet">
      {ticks.map((tick, i) => <g key={i}><line x1={x(tick)} y1="21" x2={x(tick)} y2="232" stroke="#dce5da" strokeDasharray={i ? "4 6" : "none"}/><text x={x(tick)} y="253" fontSize="12" textAnchor="middle" fill="#3a5543">{tick.toFixed(maximum % 4 === 0 ? 0 : 1)}%</text></g>)}
      {readings.map((r, i) => {
        const y = 30 + 103 * i;
        return <g key={r.depth}>
          <text x="11" y={y + 43} fontSize="15" fontWeight="700" fill="#264b36">{r.depth} cm</text>
          <rect x={plotX} y={y} width={Math.max(0,x(r.before)-plotX)} height="27" rx="2" fill="#b88a59"/>
          <rect x={plotX} y={y + 37} width={Math.max(0,x(r.after)-plotX)} height="27" rx="2" fill="#317c64"/>
          <line x1={x(r.threshold)} x2={x(r.threshold)} y1={y - 5} y2={y + 70} stroke="#293f36" strokeWidth="2" strokeDasharray="4 4"/>
          <text x={Math.min(x(r.before)+6,670)} y={y + 19} fontSize="12" fontWeight="700" fill="#263f31">{r.before.toFixed(1)}%</text>
          <text x={Math.min(x(r.after)+6,670)} y={y + 56} fontSize="12" fontWeight="700" fill="#263f31">{r.after.toFixed(1)}%</text>
          <text x={Math.max(plotX + 3,Math.min(x(r.threshold)-5,653))} y={y - 9} textAnchor="end" fontSize="10" fontWeight="700" fill="#2b493b">Target {r.threshold.toFixed(1)}%</text>
        </g>;
      })}
    </svg>
    <p>The bars show entered measurements only. The dashed markers are user-supplied local thresholds, not NASA seasonal percentiles. No future moisture is predicted.</p>
  </div>;
}
