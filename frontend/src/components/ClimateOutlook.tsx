import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import { climateForecast, getClimateBundle, type ClimateResult, type ClimateScenario } from "../lib/climateForecast";
import { getAtlasHistory } from "../lib/atlas";
import type { SiteId } from "../lib/sites";

type Props = { selected: SiteId; horizon: number; name: string };
const scenarios: { value: ClimateScenario; title: string; subtitle: string }[] = [
  { value: "ssp126", title: "Lower emissions", subtitle: "SSP1–2.6" },
  { value: "ssp245", title: "Intermediate", subtitle: "SSP2–4.5" },
  { value: "ssp370", title: "Higher emissions", subtitle: "SSP3–7.0" }
];

function ClimateChart({ analysis, horizon }: { analysis: ClimateResult; horizon: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const years = Array.from({ length: 45 + horizon }, (_, i) => 1981 + i);
    const historical = (layer: "surface" | "root") => years.map(y => analysis.historical.find(row => row.year === y)?.[layer] ?? null);
    const projected = (layer: "surface" | "root") => years.map(y => y === 2025
      ? analysis.historical.at(-1)?.[layer] ?? null
      : analysis.future.find(row => row.year === y)?.[layer].estimate ?? null);
    const band = (layer: "surface" | "root", bound: "lower" | "upper") =>
      years.map(y => analysis.future.find(row => row.year === y)?.[layer][bound] ?? null);
    chart.setOption({
      animation: false,
      backgroundColor: "transparent",
      grid: { left: 51, right: 20, top: 28, bottom: 46 },
      tooltip: { trigger: "axis", backgroundColor: "#0c242e", borderColor: "#5f7d82", textStyle: { color: "#e5f2f1" } },
      xAxis: { type: "category", data: years.map(String), axisLine: { lineStyle: { color: "#45616c" } }, axisLabel: { color: "#b1c8cb", interval: Math.ceil(years.length / 12) } },
      yAxis: { type: "value", name: "Annual seasonal percentile", min: 0, max: 100, nameTextStyle: { color: "#b1c8cb" }, axisLabel: { color: "#b1c8cb" }, splitLine: { lineStyle: { color: "#29424a" } } },
      series: [
        { name: "Surface history", type: "line", data: historical("surface"), showSymbol: false, lineStyle: { color: "#62d8e0", width: 2.2 }, itemStyle: { color: "#62d8e0" } },
        { name: "Root-zone history", type: "line", data: historical("root"), showSymbol: false, lineStyle: { color: "#d3b68d", width: 2.2 }, itemStyle: { color: "#d3b68d" } },
        { name: "Surface scenario", type: "line", data: projected("surface"), showSymbol: false, lineStyle: { color: "#62d8e0", type: "dashed", width: 2.7 }, itemStyle: { color: "#62d8e0" } },
        { name: "Root-zone scenario", type: "line", data: projected("root"), showSymbol: false, lineStyle: { color: "#d3b68d", type: "dashed", width: 2.7 }, itemStyle: { color: "#d3b68d" } },
        ...(["surface", "root"] as const).flatMap(layer => (["lower", "upper"] as const).map(limit => ({
          name: layer + " illustrative " + limit,
          type: "line" as const, data: band(layer, limit), showSymbol: false,
          lineStyle: { color: layer === "surface" ? "#62d8e0" : "#d3b68d", type: "dotted" as const, width: 1, opacity: 0.35 },
          itemStyle: { color: layer === "surface" ? "#62d8e0" : "#d3b68d" }
        })))
      ]
    });
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(ref.current);
    return () => { resize.disconnect(); chart.dispose(); };
  }, [analysis, horizon]);
  return <div ref={ref} className="forecast-chart" role="img" aria-label="NASA climate-driven experimental projected annual surface and root-zone percentile curves. Historical solid, future dashed, illustrative ranges dotted." />;
}

function Metric({ title, values }: { title: string; values: ClimateResult["errors"]["surface"] }) {
  const delta = values.historyOnly - values.climate;
  return <div className="climate-score">
    <strong>{title}</strong>
    <div><span>Climate-aware model</span><b>{values.climate.toFixed(1)} pp MAE</b></div>
    <div><span>Without climate inputs</span><b>{values.historyOnly.toFixed(1)} pp MAE</b></div>
    <div><span>Seasonal climatology</span><b>{values.climatology.toFixed(1)} pp MAE</b></div>
    <p className={delta > 0 ? "climate-good" : "climate-caution"}>
      {Math.abs(delta) < 0.05 ? "No meaningful holdout improvement detected." : delta > 0
        ? "Climate inputs improved this location's 2016–2025 backtest by " + delta.toFixed(1) + " percentile points."
        : "Climate inputs did not improve this location's backtest (" + Math.abs(delta).toFixed(1) + " pp worse)."}
    </p>
  </div>;
}

export default function ClimateOutlook({ selected, horizon, name }: Props) {
  const [scenario, setScenario] = useState<ClimateScenario>("ssp245");
  const archive = useQuery({ queryKey: ["climate-outlook-soil-history"], queryFn: ({ signal }) => getAtlasHistory(signal), staleTime: Infinity });
  const climate = useQuery({
    queryKey: ["climate-outlook-power", selected, scenario],
    queryFn: ({ signal }) => getClimateBundle(selected, scenario, signal),
    staleTime: 24 * 60 * 60 * 1000, retry: 1
  });
  const result = useMemo(() => {
    if (!archive.data || !climate.data) return null;
    return climateForecast(archive.data.months, archive.data.sites[selected] ?? [], climate.data, horizon);
  }, [archive.data, climate.data, horizon, selected]);
  const complete = result?.status === "ready";
  const alternative = climate.data?.climateSource === "open_meteo_highresmip";
  const last = complete ? result.future.at(-1) : null;
  const referenceTemp = useMemo(() => {
    if (!climate.data) return null;
    const values = climate.data.history.filter(row => row.month >= "2015-01").map(row => row.t2m);
    return values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
  }, [climate.data]);
  return <section className="climate-lab">
    <header className="climate-intro">
      <span>ADDITIONAL MODEL / CLIMATE DRIVERS</span>
      <h2>What if the climate changes? (Unvalidated scenario)</h2>
      <p>Instead of using soil moisture alone, this model learns from historical temperature, rainfall, and previous soil conditions. Future inputs come from NASA NEX-GDDP-CMIP6 where coverage exists, or a separately identified Open-Meteo HighResMIP climate simulation for <strong>{name}</strong> where NASA scenario cells are missing. It does not assume that the last 45 years will repeat unchanged.</p>
    </header>
    {!alternative ? <div className="climate-scenarios" role="group" aria-label="Choose a NASA future climate scenario">
      {scenarios.map(item => <button key={item.value} type="button" aria-pressed={scenario === item.value} className={scenario === item.value ? "selected" : ""} onClick={() => setScenario(item.value)}>
        <strong>{item.title}</strong><span>{item.subtitle}</span>
      </button>)}
    </div> : <div className="climate-scenario-note"><strong>Global climate fallback:</strong> NASA CMIP6 gridded climate values are missing for this location. Open-Meteo HighResMIP (EC_Earth3P_HR) provides an alternative downscaled simulation with complete years through 2049. It is not an SSP-specific scenario; the NASA emissions buttons are therefore unavailable here.</div>}
    {!alternative && <p className="climate-scenario-note"><strong>Scenario, not prediction:</strong> SSPs represent different possible global emissions pathways. They do not say which future will happen. NASA supplies location-specific gridded temperature and rainfall, not crop-yield or irrigation outcomes.</p>}
    {(archive.isPending || climate.isPending) && <p className="climate-loading" role="status">Requesting historical temperature, rainfall and CMIP6 scenario data from NASA POWER for this location…</p>}
    {(archive.isError || climate.isError) && <div className="climate-error" role="alert"><strong>Climate model unavailable</strong><p>{climate.error instanceof Error ? climate.error.message : "Historical soil-moisture dataset could not be loaded."} No substitute temperatures or rainfall values have been invented.</p><button type="button" onClick={() => { void climate.refetch(); void archive.refetch(); }}>Retry NASA sources</button></div>}
    {result && !complete && <div className="climate-error"><strong>Insufficient aligned climate observations</strong><p>{"Aligned climate observations or the calibration overlap were incomplete. Scenario withheld."}</p></div>}
    {complete && last && <><div className="climate-source-status"><strong>Climate model:</strong> {climate.data?.climateEnsemble ?? "NASA climate projection"} · {alternative ? "Global HighResMIP alternative" : "NASA SSP-specific projection"} · Future climate is modeled, not observed</div>
      <div className="climate-headline-metrics">
        <div><small>CLIMATE DATA INPUT</small><strong>{result.sampleMonths}</strong><span>paired historical months</span></div>
        <div><small>FUTURE ENSEMBLE TEMPERATURE</small><strong>{last.temp.toFixed(1)}°C</strong><span>modeled annual mean in {last.year}</span></div>
        <div><small>CHANGE FROM 2015–2025 REFERENCE</small><strong>{referenceTemp === null ? "—" : (last.temp - referenceTemp >= 0 ? "+" : "") + (last.temp - referenceTemp).toFixed(1) + "°C"}</strong><span>scenario temperature difference, approximate</span></div>
        <div><small>FUTURE ANNUAL PRECIPITATION RATE</small><strong>{last.rain.toFixed(2)}</strong><span>projected mean mm/day in {last.year}</span></div>
      </div>
      <div className="climate-chart-shell">
        <div className="climate-graph-key"><span><i className="climate-key surface" /> Surface</span><span><i className="climate-key root" /> Root zone</span><span>Solid = historical · Dashed = climate scenario · Dotted = heuristic error range</span></div>
        <ClimateChart analysis={result} horizon={horizon}/>
        <p className="climate-chart-disclaimer">Y-axis: annual mean seasonal percentile against historical reference, not % soil-water content. Values beyond 2025 are model simulations, not observed conditions or validated farm forecasts. Error bands are illustrative, not statistical confidence intervals.</p>
      </div>
      <div className="climate-score-heading"><h3>Historical backtest only — not future forecast accuracy</h3><p>Train soil model on 1981–2015, then simulate 2016–2025 without seeing that decade\'s soil-moisture outcomes, but <strong>using observed 2016–2025 temperature and precipitation as inputs</strong>. The error scores omit the uncertainty of predicting future weather and do not validate 5- or 10-year soil-moisture forecasts.</p></div>
      <div className="climate-scores"><Metric title="Surface soil" values={result.errors.surface}/><Metric title="Root-zone soil" values={result.errors.root}/></div>
      <p className="climate-maturity"><strong>Scientific status:</strong> Site-specific exploratory model, not an operational agricultural forecast. Projected temperature and precipitation are seasonally bias-adjusted using {result.overlapYears} overlapping historical years. Future soil moisture also depends on irrigation, soil properties, vegetation, groundwater and climate variability not resolved here. Neither 5- nor 10-year modeled soil-moisture scenarios have established independent long-range forecasting accuracy.</p>
      <div className="climate-sources"><strong>Source data</strong><a href={climate.data?.sources.historical} target="_blank" rel="noreferrer">NASA POWER historical weather</a><a href={climate.data?.sources.future} target="_blank" rel="noreferrer">{alternative ? "Open-Meteo HighResMIP simulation" : "NASA NEX-GDDP-CMIP6 future scenarios"}</a><a href={climate.data?.sources.documentation} target="_blank" rel="noreferrer">Climate-model documentation</a></div>
    </>}
  </section>;
}
