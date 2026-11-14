import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Database, RefreshCcw } from "lucide-react";
import { atlasValue, getAtlasHistory, getAtlasLatest, relativeClass, type AtlasHistory, type AtlasLatest } from "../lib/atlas";
import { findSite, siteRegions, sites, type SiteId } from "../lib/sites";

export type MoistureLayer = "surface" | "root" | "mismatch";
type Props = { selected: SiteId; onSelect: (id: SiteId) => void; layer: MoistureLayer };

function scale(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return "#66777b";
  if (percent < 20) return "#ab6444";
  if (percent < 40) return "#e5ba60";
  if (percent < 60) return "#9fbc9f";
  if (percent < 80) return "#5baca9";
  return "#2388ac";
}
function label(layer: MoistureLayer) {
  return layer === "surface" ? "Surface Moisture" : layer === "root" ? "Root-Zone Moisture" : "Surface–Root Mismatch";
}
function fmt(value: number | null | undefined) {
  return value === null || value === undefined ? "Unavailable" : value.toFixed(1) + "th percentile";
}
function coordinates(site: { coordinates: [number,number] }) {
  const [lon,lat] = site.coordinates;
  return { x: (lon + 180) * 4, y: (90 - lat) * 4 };
}

export default function MoistureAtlas({ selected, onSelect, layer }: Props) {
  const [period, setPeriod] = useState<"latest" | "historical">("latest");
  const [index, setIndex] = useState(539);
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const historyQuery = useQuery({ queryKey: ["rootshadow-atlas-history"], queryFn: ({ signal }) => getAtlasHistory(signal), staleTime: Infinity, retry: 1 });
  const latestQuery = useQuery({ queryKey: ["rootshadow-atlas-recent"], queryFn: ({ signal }) => getAtlasLatest(signal), staleTime: 30 * 60_000, refetchInterval: 60 * 60_000, retry: 1, refetchOnWindowFocus: true });
  const history: AtlasHistory | undefined = historyQuery.data;
  const latest: AtlasLatest | null | undefined = latestQuery.data;
  const availableNow = !!latest && latest.verified_site_count > 0;
  const showingHistorical = period === "historical" || !availableNow;
  const month = history?.months[index] ?? "2025-12";
  const selectedSite = findSite(selected);
  const listed = useMemo(() => sites.filter(site =>
    (region === "all" || site.region === region) &&
    (!search.trim() || [site.name,site.country,site.region].some(v => v.toLowerCase().includes(search.trim().toLowerCase())))
  ), [region, search]);
  const reading = (id: SiteId) => {
    if (showingHistorical) {
      const value = history ? atlasValue(history,id,index) : null;
      return value ? { date: month, top: value[0], root: value[1], rain: value[2], mode: "monthly" } : null;
    }
    const value = latest?.sites[id];
    return value ? { date: value.date, top: value.surface_percentile, root: value.root_percentile, rain: value.precip_7d_mm, mode: "daily" } : null;
  };
  const current = reading(selected);
  const result = (id: SiteId) => {
    const point = reading(id);
    if (!point) return { color: "#61717b", text: "No verified point reading" };
    const mismatch = point.top !== null && point.root !== null && point.top >= 40 && point.root < 40;
    return layer === "mismatch"
      ? { color: mismatch ? "#eaa94d" : "#416977", text: mismatch ? "Surface >= 40, root zone < 40" : "No mismatch under this screening rule" }
      : { color: scale(layer === "surface" ? point.top : point.root), text: relativeClass(layer === "surface" ? point.top : point.root) };
  };
  const active = result(selected);
  const seen = sites.reduce((count,site) => count + (reading(site.id) ? 1 : 0),0);
  const mismatches = sites.reduce((count,site) => {
    const x = reading(site.id);
    return count + (x && x.top !== null && x.root !== null && x.top >= 40 && x.root < 40 ? 1 : 0);
  },0);
  const dateText = current ? (showingHistorical ? month : current.date) : (showingHistorical ? month : "Unavailable");
  return <section className="moisture-atlas" aria-label={label(layer) + " model-point map"}>
    <div className="moisture-atlas-heading">
      <div><span className="moisture-atlas-eyebrow">NASA POWER / MERRA-2 · SELECTED GRID POINTS</span><h3>{label(layer)}</h3></div>
      <span className="moisture-atlas-count">{seen} / 97 readings{layer === "mismatch" ? ` · ${mismatches} screen-positive` : ""}</span>
    </div>
    <div className="moisture-atlas-controls">
      <button type="button" className={!showingHistorical ? "active" : ""} onClick={() => setPeriod("latest")} aria-pressed={!showingHistorical}><RefreshCcw size={13}/> Latest verified</button>
      <button type="button" className={showingHistorical ? "active" : ""} onClick={() => setPeriod("historical")} aria-pressed={showingHistorical}><CalendarDays size={13}/> Historical 1981–2025</button>
      <select aria-label="Filter moisture map by region" value={region} onChange={e => setRegion(e.target.value)}><option value="all">All regions</option>{siteRegions.map(name => <option value={name} key={name}>{name}</option>)}</select>
      <input type="search" aria-label="Search moisture map locations" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a location" />
    </div>
    {showingHistorical && <div className="moisture-atlas-timeline">
      <label htmlFor={"atlas-month-"+layer}>Historical month: <strong>{month}</strong></label>
      <input id={"atlas-month-"+layer} type="range" min={0} max={Math.max(0,(history?.months.length ?? 540)-1)} value={index} onChange={e => setIndex(Number(e.target.value))} />
      <div><span>Jan 1981</span><span>Dec 2025</span></div>
    </div>}
    {!availableNow && period === "latest" && <p className="moisture-atlas-warning" role="status">Recent NASA readings are not currently verified. Displaying the labeled historical monthly archive instead; no live values have been invented.</p>}
    {historyQuery.isError && <p className="moisture-atlas-warning" role="alert">Historical atlas unavailable: {historyQuery.error.message}</p>}
    <div className="moisture-atlas-stage">
      <svg className="moisture-atlas-map" viewBox="0 0 1440 720" role="img" aria-label={"NASA model-point "+label(layer)+" world map"}>
        <image href={import.meta.env.BASE_URL+"world-map.svg"} x={0} y={0} width={1440} height={720} preserveAspectRatio="none"/>
        {listed.map(site => {
          const p = coordinates(site), state = result(site.id), chosen = site.id === selected;
          return <g key={site.id} role="button" tabIndex={0} aria-label={"Inspect "+site.name+" on "+label(layer)+" map"} onClick={() => onSelect(site.id)} onKeyDown={event => { if(event.key==="Enter" || event.key===" ") {event.preventDefault();onSelect(site.id);} }}>
            <title>{site.name}: {state.text}</title>
            {chosen && <circle cx={p.x} cy={p.y} r="15" fill={state.color} opacity=".33" />}
            <circle cx={p.x} cy={p.y} r={chosen?7:5.4} fill={state.color} stroke={chosen?"#ffffff":"#0b2630"} strokeWidth={chosen?2.3:1.3}/>
            <circle cx={p.x} cy={p.y} r="15" fill="transparent" />
            {chosen && <text x={p.x>1060?p.x-15:p.x+15} y={p.y-14} textAnchor={p.x>1060?"end":"start"} className="moisture-atlas-selected-label">{site.name}</text>}
          </g>;
        })}
      </svg>
    </div>
    <div className="moisture-atlas-key">{layer === "mismatch"
      ? <><span className="moisture-atlas-dot" style={{background:"#eaa94d"}}/> Surface above guide / roots below <span className="moisture-atlas-dot" style={{background:"#416977"}}/> Not flagged</>
      : <><span>Unusually dry</span><div className="moisture-atlas-spectrum" /><span>Unusually wet</span></>}
    </div>
    <div className="moisture-atlas-reading" aria-live="polite">
      <div><small>SELECTED MODEL POINT</small><strong>{selectedSite.name} · {selectedSite.country}</strong><span>{dateText} · {showingHistorical?"Monthly medians":"Latest available daily model record"}</span></div>
      <div><small>SURFACE RANK</small><strong>{fmt(current?.top)}</strong></div>
      <div><small>ROOT-ZONE RANK</small><strong>{fmt(current?.root)}</strong></div>
      <div><small>{layer === "mismatch" ? "SCREENING STATUS" : "CONTEXT"}</small><strong>{active.text}</strong></div>
      <p>{current?.rain === null || current?.rain === undefined ? "Rainfall unavailable for this selection." : showingHistorical ? "Modeled rainfall this month: "+current.rain.toFixed(1)+" mm." : "Modeled rainfall over the selected recent 7-day window: "+current.rain.toFixed(1)+" mm."} {layer === "mismatch" ? "This threshold contrast is not a confirmed drought-recovery event and does not measure crop loss." : "Percentiles are seasonal ranks, not percentage water content."}</p>
    </div>
    <div className="moisture-atlas-foot"><Database size={13}/><span>97 sampled MERRA-2 grid points, not a continuous global raster or in-situ sensors.</span><span>{showingHistorical ? "1981–2025 historical model archive" : "Last source check "+(latest?.retrieval_checked_utc.slice(0,16).replace("T"," ") ?? "unknown")+" UTC"}</span></div>
  </section>;
}
