import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { useQuery } from "@tanstack/react-query";
import { getAtlasHistory } from "../lib/atlas";
import type { SiteId } from "../lib/sites";
import { Maximize2, RefreshCcw } from "lucide-react";
import type { Analysis, RecoveryEvent } from "../lib/api";

function Chart({ option, className = "", ariaLabel, onSelectIndex, lastIndex = 0, zoomKey = "" }: {
  option: echarts.EChartsOption;
  className?: string;
  ariaLabel: string;
  onSelectIndex?: (index: number) => void;
  lastIndex?: number;
  zoomKey?: string;
}) {
  const node = useRef<HTMLDivElement | null>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const callback = useRef(onSelectIndex);
  const last = useRef(lastIndex);
  const priorZoom = useRef<string | null>(null);
  useEffect(() => { callback.current = onSelectIndex; last.current = lastIndex; }, [onSelectIndex, lastIndex]);
  useEffect(() => {
    if (!node.current) return;
    const renderer = echarts.init(node.current, undefined, { renderer: "canvas" });
    instance.current = renderer;
    let dragging = false;
    const pick = (event: { offsetX: number; offsetY: number }) => {
      if (!renderer.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])) return;
      const result = renderer.convertFromPixel({ xAxisIndex: 0 }, [event.offsetX, event.offsetY]);
      const value = Array.isArray(result) ? result[0] : result;
      const index = typeof value === "number" ? Math.round(value) : Number(value);
      if (Number.isFinite(index) && index >= 0 && index <= last.current) callback.current?.(index);
    };
    const zr = renderer.getZr();
    zr.on("mousedown", event => {
      if (renderer.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])) {
        dragging = true;
        pick(event);
      }
    });
    zr.on("mousemove", event => { if (dragging) pick(event); });
    zr.on("mouseup", () => { dragging = false; });
    zr.on("globalout", () => { dragging = false; });
    renderer.on("click", params => {
      if (typeof params.dataIndex === "number" && params.dataIndex <= last.current) callback.current?.(params.dataIndex);
    });
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(node.current);
    return () => { observer.disconnect(); renderer.dispose(); instance.current = null; };
  }, []);
  useEffect(() => {
    const renderer = instance.current;
    if (!renderer) return;
    const old = renderer.getOption().dataZoom as Array<{ start?: number; end?: number }> | undefined;
    const existing = old?.[0];
    const retain = priorZoom.current === zoomKey && existing?.start !== undefined && existing?.end !== undefined;
    renderer.setOption(option, { notMerge: true, lazyUpdate: false });
    if (retain && existing?.start !== undefined && existing?.end !== undefined) renderer.dispatchAction({ type: "dataZoom", start: existing.start, end: existing.end });
    priorZoom.current = zoomKey;
  }, [option, zoomKey]);
  return <div className={"echart " + className} ref={node} role="img" aria-label={ariaLabel}/>;
}

function interpretMonth(surface: number | null, root: number | null): string {
  if (surface === null || root === null) return "A complete paired reading is unavailable; no conclusion can be drawn for this month.";
  if (surface >= 40 && root < 40) return "The monthly surface median is above the 40th-percentile recovery guide while the root zone remains below it. Daily sustained recovery must be checked separately.";
  if (surface < 40 && root >= 40) return "The root-zone monthly median is above the guide while the surface is below it; this alone does not establish recovery order.";
  if (surface < 20 && root < 20) return "Both layers rank among relatively dry seasonal conditions. A qualifying drought requires at least 30 days of sustained root-zone dryness.";
  if (surface >= 40 && root >= 40) return "Both monthly medians rank above the recovery guide, but this is not independent evidence of field recovery.";
  return "The modeled layers occupy different seasonal ranks. Their percentile difference is not a recovery delay measured in days.";
}

function formatPercentile(value: number | null): string {
  return value === null ? "Unavailable" : value.toFixed(1) + "th percentile";
}

const axisText = "#91a8b4";
const gridLine = "rgba(140,184,195,0.10)";
const tooltipStyle = { backgroundColor: "#091e27", borderColor: "#2b4951", textStyle: { color: "#e6f6f5", fontFamily: "DM Sans" }, extraCssText: "box-shadow:0 16px 48px rgba(0,0,0,.3);border-radius:12px;" };

export function MoistureChart({ analysis, event, highlightedMonth, siteId, onMonthSelect }: { analysis: Analysis; event: RecoveryEvent | null; highlightedMonth?: string | null; siteId?: SiteId; onMonthSelect?: (month: string) => void }) {
  const [zoom, setZoom] = useState<"full" | "event">("full");
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const archive = useQuery({ queryKey: ["rootshadow-atlas-history"], queryFn: ({ signal }) => getAtlasHistory(signal), enabled: !!siteId, staleTime: Infinity, retry: 1 });
  useEffect(() => { setPickedMonth(null); }, [analysis]);
  useEffect(() => { setZoom(event ? "event" : "full"); }, [event]);
  const months = analysis.monthly.map(row => row.month);
  const inspected = highlightedMonth ?? pickedMonth ?? months.at(-1) ?? null;
  const chosenMonth = inspected ? analysis.monthly.find(row => row.month === inspected) : undefined;
  const precipitation = siteId ? archive.data?.sites[siteId]?.map(row => row[2]) : undefined;
  const rainIndex = inspected ? months.indexOf(inspected) : -1;
  const rainTotal = rainIndex >= 0 ? precipitation?.[rainIndex] : null;
  const selectMonth = (index: number) => {
    const value = months[index];
    if (!value) return;
    setPickedMonth(value);
    onMonthSelect?.(value);
  };
  const eventIndex = event ? Math.max(0, months.findIndex(month => month >= event.drought_start.slice(0, 7))) : 0;
  const startIndex = Math.max(0, eventIndex - 5);
  const endIndex = Math.min(months.length - 1, eventIndex + 17);
  const start = zoom === "event" && event ? startIndex / Math.max(1, months.length - 1) * 100 : 0;
  const end = zoom === "event" && event ? endIndex / Math.max(1, months.length - 1) * 100 : 100;
  const option: echarts.EChartsOption = {
    animationDuration: 550,
    backgroundColor: "transparent",
    color: ["#62d8e0", "#d3b68d"],
    grid: [
      { left: 54, right: 24, top: 38, height: 217, containLabel: false },
      { left: 54, right: 24, top: 280, height: 72, containLabel: false }
    ],
    legend: { data: precipitation ? ["Surface", "Root zone", "Rainfall"] : ["Surface", "Root zone"], top: 1, right: 4, icon: "roundRect", textStyle: { color: "#b8cbd0", fontSize: 12 } },
    tooltip: { trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: "#68848c", type: "dashed" } }, ...tooltipStyle,
      valueFormatter: value => value === null || value === undefined ? "No observation" : `${value}th percentile` },
    xAxis: [
      { type: "category", gridIndex: 0, boundaryGap: false, data: months, axisLine: { lineStyle: { color: "#37515a" } }, axisLabel: { show: false }, axisTick: { show: false } },
      { type: "category", gridIndex: 1, boundaryGap: true, data: months, axisLine: { lineStyle: { color: "#37515a" } }, axisLabel: { color: axisText, hideOverlap: true, fontSize: 10 }, axisTick: { show: false } }
    ],
    yAxis: [
      { type: "value", gridIndex: 0, min: 0, max: 100, interval: 20, name: "Seasonal percentile", nameTextStyle: { color: axisText, padding: [0, 0, 8, 25] }, axisLine: { show: false }, axisLabel: { color: axisText, formatter: "{value}" }, splitLine: { lineStyle: { color: gridLine } } },
      { type: "value", gridIndex: 1, min: 0, name: "Rain (mm)", nameTextStyle: { color: axisText }, axisLabel: { color: axisText, fontSize: 10 }, splitLine: { show: false } }
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start, end, filterMode: "none", moveOnMouseMove: false },
      { type: "slider", xAxisIndex: [0, 1], bottom: 10, height: 17, start, end, filterMode: "none", brushSelect: true, borderColor: "#243a42", backgroundColor: "#0a1b23", fillerColor: "rgba(98,216,224,.13)", handleStyle: { color: "#62d8e0" }, textStyle: { color: axisText } }
    ],
    series: [
      { name: "Surface", type: "line", data: analysis.monthly.map(row => row.top_percentile), showSymbol: false, smooth: 0.16, lineStyle: { width: 2.3 }, areaStyle: { opacity: 0.045 }, connectNulls: false,
        markLine: { silent: true, symbol: ["none", "none"], label: { color: "#a4b7bf", fontSize: 10, show: false }, lineStyle: { color: "#8b9da3", opacity: .4, type: "dashed", width: 1 }, data: [{ yAxis: 20 }, { yAxis: 40 }, ...(inspected ? [{ xAxis: inspected, label: { show: true, color: "#e8c79b", formatter: inspected }, lineStyle: { color: "#e8c79b", opacity: .75, type: "solid" as const, width: 1 } }] : [])] },
        markArea: event ? { silent: true, itemStyle: { color: "rgba(215,173,113,0.075)" }, data: [[{ xAxis: event.drought_start.slice(0, 7) }, { xAxis: (event.root_recovery ?? event.window_end).slice(0, 7) }]] } : undefined },
      { name: "Root zone", type: "line", data: analysis.monthly.map(row => row.root_percentile), showSymbol: false, smooth: 0.16, lineStyle: { width: 2.3 }, areaStyle: { opacity: 0.025 }, connectNulls: false },
      ...(precipitation ? [{ name: "Rainfall", type: "bar" as const, xAxisIndex: 1, yAxisIndex: 1, data: precipitation, barMaxWidth: 9, itemStyle: { color: "#74a5c6", opacity: 0.7 } }] : [])
    ]
  };
  return (
    <div>
      <div className="chart-toolbar"><span>1991–2020 seasonal reference · Monthly medians</span>
        <div className="chart-actions"><button type="button" onClick={() => setZoom("full")} title="Reset to entire record"><RefreshCcw size={14} /> All years</button><button type="button" disabled={!event} onClick={() => setZoom("event")}><Maximize2 size={14} /> Selected event</button></div>
      </div>
      <Chart option={option} className="moisture-chart" onSelectIndex={selectMonth} lastIndex={months.length - 1} zoomKey={[siteId ?? "", zoom, event?.drought_start ?? ""].join("|")} ariaLabel="Interactive monthly surface and root-zone soil moisture lines and rainfall bars. Click or drag the upper graph to explain a month." />
      <section className="chart-point-explanation" role="region" aria-label="Explanation of selected monthly graph reading">
        <header><span>SELECTED MONTH</span><strong>{inspected ?? "Unavailable"}</strong></header>
        <div className="chart-point-values">
          <span>Surface <strong>{formatPercentile(chosenMonth?.top_percentile ?? null)}</strong></span>
          <span>Root zone <strong>{formatPercentile(chosenMonth?.root_percentile ?? null)}</strong></span>
          <span>Rainfall <strong>{rainTotal === null || rainTotal === undefined ? "Unavailable" : rainTotal.toFixed(1) + " mm"}</strong></span>
        </div>
        <p>{interpretMonth(chosenMonth?.top_percentile ?? null, chosenMonth?.root_percentile ?? null)}</p>
        {event && <p>Selected drought event: began {event.drought_start}; surface recovery {event.surface_recovery ?? "not observed"}; root recovery {event.root_recovery ?? "not observed"}. Event dates come from daily, not monthly data.</p>}
      </section>
      <div className="chart-footnote">Click to explain a month; hold and drag across the upper curve to scrub. Rainfall bars show historical NASA monthly precipitation totals when available. Percentiles are seasonal ranks, not percentages of water content; daily sustained recovery is assessed separately.</div>
    </div>
  );
}

export function AnnualChart({ analysis, comparison, comparisonName }: { analysis: Analysis; comparison?: Analysis; comparisonName?: string }) {
  const [selectedYear, setSelectedYear] = useState<number | null>(analysis.annual.at(-1)?.year ?? null);
  useEffect(() => { setSelectedYear(analysis.annual.at(-1)?.year ?? null); }, [analysis]);
  const annualRecord = analysis.annual.find(row => row.year === selectedYear);
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
  return <div className="chart-inspection">
    <Chart option={option} className="annual-chart" onSelectIndex={index => setSelectedYear(analysis.annual[index]?.year ?? null)} lastIndex={analysis.annual.length - 1} ariaLabel="Annual surface-root mismatch days. Click a bar or drag to inspect a year."/>
    <section className="chart-point-explanation" role="region" aria-label="Explanation of selected annual bar">
      <header><span>SELECTED YEAR</span><select value={selectedYear ?? ""} onChange={event => setSelectedYear(Number(event.target.value))} aria-label="Inspect annual mismatch year">{analysis.annual.map(row => <option value={row.year} key={row.year}>{row.year}</option>)}</select></header>
      {annualRecord ? <><div className="chart-point-values"><span>Mismatch days <strong>{annualRecord.mismatch_days}</strong></span><span>Assigned recovery episodes <strong>{annualRecord.events}</strong></span><span>Longest completed gap <strong>{annualRecord.max_lag_days} days</strong></span></div><p>In {annualRecord.year}, the modeled surface was recovered while the root zone was not for {annualRecord.mismatch_days} days under the study method. This is not measured crop damage or irrigation advice.</p></> : <p>No annual record available.</p>}
    </section>
  </div>;
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
