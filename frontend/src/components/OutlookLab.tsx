import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { useQuery } from "@tanstack/react-query";
import { getAtlasHistory } from "../lib/atlas";
import { annualize, buildLayerScenario, type LayerScenario } from "../lib/forecast";
import { findSite, researchSites, siteRegions, sites, type SiteId } from "../lib/sites";
import ClimateOutlook from "./ClimateOutlook";

type Props = { selected: SiteId; onSelect: (id: SiteId) => void };

function ForecastChart({ surface, root, horizon }: { surface: LayerScenario; root: LayerScenario; horizon: number }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current);
    const years = Array.from({ length: 45 + horizon }, (_, i) => 1981 + i);
    const historic = (values: { year: number; value: number }[]) => years.map(year => values.find(p => p.year === year)?.value ?? null);
    const projected = (values: { year: number; estimate: number }[], endpoint?: number) => years.map(year => year === 2025 ? endpoint ?? null : values.find(p => p.year === year)?.estimate ?? null);
    const bound = (values: { year: number; lower: number; upper: number }[], key: "lower" | "upper") => years.map(year => values.find(p => p.year === year)?.[key] ?? null);
    chart.setOption({
      animation: false, backgroundColor: "transparent",
      tooltip: { trigger: "axis", backgroundColor: "#0d2932", borderColor: "#52727b", textStyle: { color: "#e7f3ef" } },
      grid: { left: 54, right: 18, top: 22, bottom: 47 },
      xAxis: { type: "category", data: years.map(String), axisLabel: { color: "#b0c6c8", interval: Math.max(3, Math.floor(years.length / 10)) }, axisLine: { lineStyle: { color: "#52666c" } } },
      yAxis: { type: "value", min: 0, max: 100, interval: 20, name: "Annual mean rank", nameTextStyle: { color: "#b0c6c8" }, axisLabel: { color: "#b0c6c8" }, splitLine: { lineStyle: { color: "#29434b" } } },
      series: [
        { name: "Historical surface", type: "line", showSymbol: false, data: historic(surface.historical), lineStyle: { color: "#62d8e0", width: 2.3 }, itemStyle: { color: "#62d8e0" } },
        { name: "Historical root zone", type: "line", showSymbol: false, data: historic(root.historical), lineStyle: { color: "#d3b68d", width: 2.3 }, itemStyle: { color: "#d3b68d" } },
        { name: "Surface scenario (unvalidated)", type: "line", showSymbol: false, data: projected(surface.future, surface.historical.at(-1)?.value), lineStyle: { color: "#62d8e0", width: 2.4, type: "dashed" }, itemStyle: { color: "#62d8e0" } },
        { name: "Root scenario (unvalidated)", type: "line", showSymbol: false, data: projected(root.future, root.historical.at(-1)?.value), lineStyle: { color: "#d3b68d", width: 2.4, type: "dashed" }, itemStyle: { color: "#d3b68d" } },
        ...(["lower", "upper"] as const).flatMap(key => [
          { name: "Surface illustrative range " + key, type: "line", showSymbol: false, data: bound(surface.future, key), lineStyle: { color: "#62d8e0", width: 1, type: "dotted", opacity: .35 }, itemStyle: { color: "#62d8e0" } },
          { name: "Root illustrative range " + key, type: "line", showSymbol: false, data: bound(root.future, key), lineStyle: { color: "#d3b68d", width: 1, type: "dotted", opacity: .35 }, itemStyle: { color: "#d3b68d" } }
        ])
      ]
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [surface, root, horizon]);
  return <div className="forecast-chart" ref={element} role="img" aria-label="Historical surface and root-zone seasonal percentile means until 2025, with dashed extrapolated future scenarios and dotted illustrative ranges." />;
}

function Score({ name, value }: { name: string; value: LayerScenario }) {
  return <div className="forecast-score">
    <strong>{name}</strong>
    <span>ML model holdout MAE: {Number.isFinite(value.holdoutMae) ? value.holdoutMae.toFixed(1) : "N/A"} percentile points</span>
    <span>Simple baseline MAE: {Number.isFinite(value.baselineMae) ? value.baselineMae.toFixed(1) : "N/A"} percentile points</span>
    <span>Selected approach: {value.modelSelected === "ridge_regression" ? "Ridge regression" : "Historical-mean baseline"}</span>
    <small>Historical validation: train 1981–2015; predict 2016–2025 without seeing holdout observations. Lower MAE is better.</small>
  </div>;
}

export default function OutlookLab({ selected, onSelect }: Props) {
  const [horizon, setHorizon] = useState<5 | 10>(5);
  const [mode, setMode] = useState<"historical" | "climate">("climate");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["outlook-history"], queryFn: ({ signal }) => getAtlasHistory(signal), staleTime: Infinity });
  const site = findSite(selected);
  const annual = useMemo(() => query.data ? annualize(query.data.months, query.data.sites[selected] ?? []) : [], [query.data, selected]);
  const surface = useMemo(() => buildLayerScenario(annual, "surface", horizon), [annual, horizon]);
  const root = useMemo(() => buildLayerScenario(annual, "root", horizon), [annual, horizon]);
  const valid = surface.future.length === horizon && root.future.length === horizon;
  const filtered = sites.filter(item => (region === "all" || (region === "featured" ? researchSites.some(s => s.id === item.id) : item.region === region)) && (item.name + " " + item.country).toLowerCase().includes(search.toLowerCase()));
  return <div className="forecast-lab">
    <header className="forecast-heading"><span>ROOTSHADOW / EXPERIMENTAL MACHINE LEARNING</span><h1>Exploratory soil-moisture scenarios.</h1><p>Compare a historical-only benchmark with an experimental climate-informed model at {sites.length} selected model points. NASA climate projections are used where available; other locations use an explicitly labeled independent HighResMIP simulation. These are not validated farm or drought forecasts.</p></header>
    <div className="forecast-warning forecast-validation-alert" role="note"><strong>IMPORTANT: BACKTEST USED OBSERVED WEATHER, NOT A FORECAST.</strong><p>The climate-aware model's 2016–2025 holdout uses temperature and precipitation recorded during those years. Its MAE does <strong>not</strong> measure the uncertainty of predicting future weather. Even the 5- and 10-year curves are exploratory scenarios, not independently verified predictions or safe irrigation recommendations. Longer 20- and 30-year displays are withheld.</p></div>
    <div className="forecast-mode-tabs" role="tablist" aria-label="Choose forecasting method"><button role="tab" aria-selected={mode === "climate"} type="button" className={mode === "climate" ? "active" : ""} onClick={() => setMode("climate")}>Climate-aware ML <small>NASA warming and rainfall scenarios</small></button><button role="tab" aria-selected={mode === "historical"} type="button" className={mode === "historical" ? "active" : ""} onClick={() => setMode("historical")}>Historical-only ML <small>Original autoregressive benchmark</small></button></div>
    {mode === "historical" && <div className="forecast-warning"><strong>EXPERIMENTAL HISTORICAL BENCHMARK — NOT AN OPERATIONAL FORECAST</strong><p>This original method uses past soil-moisture trends only; it does not incorporate temperature or future rainfall. Dashed curves are extrapolations. Dotted ranges are illustrative, not calibrated uncertainty intervals.</p></div>}
    <div className="forecast-controls">
      <label>REGION<select value={region} onChange={event => setRegion(event.target.value)}><option value="all">All {sites.length} locations</option><option value="featured">Six featured research points</option>{siteRegions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>SEARCH<input placeholder="Search locations" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>LOCATION<select value={selected} onChange={event => onSelect(event.target.value as SiteId)}>{!filtered.some(item => item.id === selected) && <option value={selected}>{site.name} · currently selected</option>}{filtered.map(item => <option value={item.id} key={item.id}>{item.name} · {item.country}</option>)}</select></label>
      <label>ILLUSTRATIVE WINDOW (NOT FORECAST SKILL)<select value={horizon} onChange={event => setHorizon(Number(event.target.value) as 5 | 10)}><option value={5}>5 years · 2026–2030</option><option value={10}>10 years · 2026–2035</option></select></label>
    </div>
    {mode === "climate" && <ClimateOutlook selected={selected} name={site.name} horizon={horizon}/>}
    {mode === "historical" && <div className="forecast-body">
      <div className="forecast-subtitle"><strong>{site.name}, {site.country}</strong><span>Solid: historical 1981–2025 · Dashed: experimental model · Dotted: approximate error range</span></div>
      {query.isPending && <p>Loading verified historical model archive…</p>}
      {query.isError && <p role="alert">Historical data unavailable. No prediction is shown.</p>}
      {query.data && !valid && <p role="alert">Insufficient complete historical years to train and evaluate this location. Prediction withheld.</p>}
      {valid && <><ForecastChart surface={surface} root={root} horizon={horizon}/><div className="forecast-scores"><Score name="Surface model" value={surface}/><Score name="Root-zone model" value={root}/></div>
        <p className="forecast-meaning"><strong>How to interpret:</strong> A lower projected percentile suggests relatively drier modeled conditions against the 1991–2020 seasonal reference, not soil-water volume or crop failure. The trend depends on historical patterns continuing. This model does not predict drought events, yields, farm suitability or irrigation requirements.</p></>}
    </div>}
    {mode === "historical" && <footer className="forecast-disclaimer">METHOD: Ridge-regression autoregression uses recent annual moisture ranks and calendar trend features, with a 2016–2025 chronological holdout. When its holdout error does not beat the historical-mean baseline by at least 2%, the simple baseline is displayed instead. This single holdout does not establish validated 5- or 10-year skill, and no result should guide government resource allocation without climate inputs, independent testing and domain review.</footer>}
  </div>;
}
