import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Globe2, Map as MapIcon, LocateFixed } from "lucide-react";
import { sites, type SiteId } from "../lib/sites";

type Props = { selected: SiteId; onSelect: (id: SiteId) => void };
type Projection = "globe" | "mercator";

export default function GeoExplorer({ selected, onSelect }: Props) {
  const target = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<SiteId, maplibregl.Marker>>(new Map());
  const selectionRef = useRef(onSelect);
  const [projection, setProjection] = useState<Projection>("globe");
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => { selectionRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!target.current || mapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: target.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        center: [12, 14],
        zoom: 1.3,
        cooperativeGestures: true,
        canvasContextAttributes: { antialias: true }
      });
    } catch {
      setState("unavailable");
      return;
    }
    mapRef.current = map;
    let loaded = false;
    const fallbackTimer = window.setTimeout(() => { if (!loaded) setState("unavailable"); }, 5000);
    map.on("style.load", () => {
      try { map.setProjection({ type: "globe" }); } catch { }
    });
    map.on("load", () => { loaded = true; window.clearTimeout(fallbackTimer); setState("ready"); });
    map.on("error", () => { if (!loaded) setState("unavailable"); });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    sites.forEach(site => {
      const pin = document.createElement("button");
      pin.className = `geo-pin ${site.id === selected ? "is-selected" : ""}`;
      pin.type = "button";
      pin.setAttribute("aria-label", `Select ${site.name}, ${site.country}`);
      pin.innerHTML = `<span aria-hidden="true"></span>`;
      pin.addEventListener("click", () => selectionRef.current(site.id));
      const marker = new maplibregl.Marker({ element: pin, anchor: "center" }).setLngLat(site.coordinates).addTo(map);
      markers.current.set(site.id, marker);
    });
    return () => {
      window.clearTimeout(fallbackTimer);
      map.remove();
      markers.current.clear();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    markers.current.forEach((marker, id) => marker.getElement().classList.toggle("is-selected", id === selected));
  }, [selected]);

  function chooseProjection(next: Projection) {
    setProjection(next);
    try { mapRef.current?.setProjection({ type: next }); } catch { setState("unavailable"); }
  }

  function focusSelected() {
    const site = sites.find(item => item.id === selected)!;
    mapRef.current?.flyTo({ center: site.coordinates, zoom: projection === "globe" ? 3.5 : 5, speed: 0.85, essential: true });
  }

  return (
    <div className="geo-explorer">
      <div className="map-inner" ref={target} aria-label="Interactive map of four verified NASA POWER study sites" />
      {state !== "ready" && (
        <div className="map-standby" role="status">
          <Globe2 size={32} strokeWidth={1.1} />
          <span>{state === "loading" ? "Loading geographic context…" : "Map tiles unavailable. Use the study-site selector."}</span>
        </div>
      )}
      <div className="map-graticule" aria-hidden="true" />
      <div className="geo-overlay-top">
        <span className="micro-label">GEOGRAPHIC INDEX</span>
        <span className="map-counter">04 VERIFIED LOCATIONS</span>
      </div>
      <div className="geo-tools" aria-label="Map projection controls">
        <button type="button" className={projection === "globe" ? "active" : ""} onClick={() => chooseProjection("globe")} aria-pressed={projection === "globe"} title="Globe view"><Globe2 size={17} /></button>
        <button type="button" className={projection === "mercator" ? "active" : ""} onClick={() => chooseProjection("mercator")} aria-pressed={projection === "mercator"} title="Flat map view"><MapIcon size={17} /></button>
        <button type="button" onClick={focusSelected} title="Focus selected site"><LocateFixed size={17} /></button>
      </div>
      <div className="map-site-list">
        {sites.map(site => (
          <button type="button" key={site.id} className={`map-site ${site.id === selected ? "selected" : ""}`} onClick={() => onSelect(site.id)} aria-pressed={site.id === selected}>
            <span className="site-index">{site.index}</span>
            <span className="site-text"><strong>{site.name}</strong><small>{site.country}</small></span>
            <span className="site-dot" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="map-footer-note">Map © OpenStreetMap contributors · OpenFreeMap · Site coordinates, not field boundaries</div>
    </div>
  );
}
