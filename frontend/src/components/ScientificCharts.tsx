import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { Maximize2, RefreshCcw } from "lucide-react";
import type { Analysis, RecoveryEvent } from "../lib/api";

function Chart({ option, className = "", ariaLabel }: { option: echarts.EChartsOption; className?: string; ariaLabel: string }) {
  const node = useRef<HTMLDivElement | null>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!node.current) return;
    const chart = echarts.init(node.current, undefined, { renderer: "canvas" });
    instance.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(node.current);
    return () => { observer.disconnect(); chart.dispose(); instance.current = null; };
  }, []);
  useEffect(() => { instance.current?.setOption(option, { notMerge: true, lazyUpdate: false }); }, [option]);
  return <div className={`echart ${className}`} ref={node} role="img" aria-label={ariaLabel} />;
}

const axisText = "#91a8b4";
const gridLine = "rgba(140,184,195,0.10)";
const tooltipStyle = { backgroundColor: "#091e27", borderColor: "#2b4951", textStyle: { color: "#e6f6f5", fontFamily: "DM Sans" }, extraCssText: "box-shadow:0 16px 48px rgba(0,0,0,.3);border-radius:12px;" };

export function MoistureChart({ analysis, event }: { analysis: Analysis; event: RecoveryEvent | null }) {
  const [zoom, setZoom] = useState<"full" | "event">("full");
  useEffect(() => { setZoom(event ? "event" : "full"); }, [event]);
  const months = analysis.monthly.map(row => row.month);
  const eventIndex = event ? Math.max(0, months.findIndex(month => month >= event.drought_start.slice(0, 7))) : 0;
  const startIndex = Math.max(0, eventIndex - 5);
  const endIndex = Math.min(months.length - 1, eventIndex + 17);
  const start = zoom === "event" && event ? startIndex / Math.max(1, months.length - 1) * 100 : 0;
  const end = zoom === "event" && event ? endIndex / Math.max(1, months.length - 1) * 100 : 100;
  const option: echarts.EChartsOption = {
    animationDuration: 550,
    backgroundColor: "transparent",
    color: ["#62d8e0", "#d3b68d"],
    grid: { left: 51, right: 20, top: 35, bottom: 82, containLabel: false },
    legend: { data: ["Surface", "Root zone"], top: 1, right: 4, icon: "roundRect", textStyle: { color: "#b8cbd0", fontSize: 12 } },
    tooltip: { trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: "#68848c", type: "dashed" } }, ...tooltipStyle,
      valueFormatter: value => value === null || value === undefined ? "No observation" : `${value}th percentile` },
    xAxis: { type: "category", boundaryGap: false, data: months, axisLine: { lineStyle: { color: "#37515a" } }, axisLabel: { color: axisText, hideOverlap: true, fontSize: 11 }, axisTick: { show: false } },
    yAxis: { type: "value", min: 0, max: 100, interval: 20, name: "Seasonal percentile", nameTextStyle: { color: axisText, padding: [0, 0, 8, 25] }, axisLine: { show: false }, axisLabel: { color: axisText, formatter: "{value}" }, splitLine: { lineStyle: { color: gridLine } } },
    dataZoom: [
      { type: "inside", start, end, filterMode: "none" },
      { type: "slider", bottom: 21, height: 19, start, end, filterMode: "none", brushSelect: true, borderColor: "#243a42", backgroundColor: "#0a1b23", fillerColor: "rgba(98,216,224,.13)", handleStyle: { color: "#62d8e0" }, textStyle: { color: axisText } }
    ],
    series: [
      { name: "Surface", type: "line", data: analysis.monthly.map(row => row.top_percentile), showSymbol: false, smooth: 0.16, lineStyle: { width: 2.3 }, areaStyle: { opacity: 0.045 }, connectNulls: false,
        markLine: { silent: true, symbol: ["none", "none"], label: { color: "#a4b7bf", fontSize: 10, show: false }, lineStyle: { color: "#8b9da3", opacity: .4, type: "dashed", width: 1 }, data: [{ yAxis: 20 }, { yAxis: 40 }] },
        markArea: event ? { silent: true, itemStyle: { color: "rgba(215,173,113,0.075)" }, data: [[{ xAxis: event.drought_start.slice(0, 7) }, { xAxis: (event.root_recovery ?? event.window_end).slice(0, 7) }]] } : undefined },
      { name: "Root zone", type: "line", data: analysis.monthly.map(row => row.root_percentile), showSymbol: false, smooth: 0.16, lineStyle: { width: 2.3 }, areaStyle: { opacity: 0.025 }, connectNulls: false }
    ]
  };
  return (
    <div>
      <div className="chart-toolbar"><span>1991–2020 seasonal reference · Monthly medians</span>
        <div className="chart-actions"><button type="button" onClick={() => setZoom("full")} title="Reset to entire record"><RefreshCcw size={14} /> All years</button><button type="button" disabled={!event} onClick={() => setZoom("event")}><Maximize2 size={14} /> Selected event</button></div>
      </div>
      <Chart option={option} className="moisture-chart" ariaLabel="Interactive monthly surface and root-zone soil wetness percentile chart, 1981 to 2025. Scroll or drag chart controls to zoom." />
      <div className="chart-footnote">Percentiles compare modeled wetness against the same season in 1991–2020. A charted month is the median of its daily percentiles; event dates are calculated from daily observations.</div>
    </div>
  );
}

export function AnnualChart({ analysis, comparison, comparisonName }: { analysis: Analysis; comparison?: Analysis; comparisonName?: string }) {
  const years = analysis.annual.map(row => String(row.year));
  const option: echarts.EChartsOption = {
    color: ["#62d8e0", "#d3b68d"], backgroundColor: "transparent",
    grid: { left: 48, right: 13, top: 33, bottom: 57 },
    legend: comparison ? { top: 0, right: 0, textStyle: { color: axisText } } : { show: false },
    tooltip: { trigger: "axis", ...tooltipStyle },
    xAxis: { type: "category", data: years, axisLabel: { color: axisText, interval: 4 }, axisLine: { lineStyle: { color: "#37515a" } }, axisTick: { show: false } },
    yAxis: { type: "value", name: "Mismatch days", nameTextStyle: { color: axisText }, minInterval: 1, axisLabel: { color: axisText }, splitLine: { lineStyle: { color: gridLine } } },
    dataZoom: [{ type: "inside" }],
    series: [
      { name: "Selected site", type: "bar", data: analysis.annual.map(row => row.mismatch_days), barMaxWidth: comparison ? 7 : 12, itemStyle: { borderRadius: [2, 2, 0, 0] } },
      ...(comparison ? [{ name: comparisonName ?? "Comparison", type: "bar" as const, data: comparison.annual.map(row => row.mismatch_days), barMaxWidth: 7 }] : [])
    ]
  };
  return <Chart option={option} className="annual-chart" ariaLabel="Annual count of surface-recovered but root-zone-not-recovered mismatch days" />;
}

export function SensitivityChart({ analysis }: { analysis: Analysis }) {
  const values = analysis.sensitivity.cells.map(cell => [cell.drought_percentile, cell.recovery_percentile, cell.lag_slope_days_per_decade]);
  const numbers = values.map(value => value[2]).filter((n): n is number => typeof n === "number");
  const extent = Math.max(1, ...numbers.map(Math.abs));
  const option: echarts.EChartsOption = {
    backgroundColor: "transparent", grid: { left: 60, right: 58, top: 20, bottom: 55 },
    tooltip: { trigger: "item", ...tooltipStyle, formatter: (params: unknown) => {
      const value = (params as { value?: (number | null)[] }).value;
      const [d, r, slope] = value ?? [];
      return `Drought threshold ${d}th percentile<br />Recovery threshold ${r}th percentile<br />Signed slope: ${typeof slope === "number" ? `${slope} days/decade` : "Insufficient events"}`;
    } },
    xAxis: { type: "category", name: "Drought %", data: [15, 20, 25], nameLocation: "middle", nameGap: 30, nameTextStyle: { color: axisText }, axisLabel: { color: axisText }, axisLine: { lineStyle: { color: "#37515a" } }, splitArea: { show: true } },
    yAxis: { type: "category", name: "Recovery %", data: [35, 40, 50], nameTextStyle: { color: axisText }, axisLabel: { color: axisText }, axisLine: { lineStyle: { color: "#37515a" } }, splitArea: { show: true } },
    visualMap: { min: -extent, max: extent, calculable: false, orient: "vertical", right: 0, top: "center", textStyle: { color: axisText }, inRange: { color: ["#bd8d65", "#263f49", "#4dc9c2"] } },
    series: [{ type: "heatmap", data: values.map(([d, r, slope]) => [[15, 20, 25].indexOf(Number(d)), [35, 40, 50].indexOf(Number(r)), slope]), label: { show: true, color: "#e9f5f3", fontSize: 12, formatter: (params: unknown) => { const value = (params as { value?: (number | null)[] }).value; return typeof value?.[2] === "number" ? `${value[2]}` : "n/a"; } }, itemStyle: { borderColor: "#0c1b23", borderWidth: 4, borderRadius: 7 }, emphasis: { itemStyle: { borderColor: "#83dadd" } } }]
  };
  return <Chart option={option} className="sensitivity-chart" ariaLabel="Nine scenario sensitivity heatmap showing signed recovery-delay slope by drought and recovery thresholds" />;
}
