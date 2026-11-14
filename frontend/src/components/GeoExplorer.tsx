import { useRef, useState, type PointerEvent } from "react";
import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import { sites, type SiteId, type Site } from "../lib/sites";

type Props = { selected: SiteId; onSelect: (id: SiteId) => void };
type WindowBox = { x: number; y: number; width: number; height: number };

const worldWidth = 1440;
const worldHeight = 720;
const fullWorld: WindowBox = { x: 0, y: 0, width: worldWidth, height: worldHeight };

function bounded(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function sitePoint(site: Site) {
  return { x: (site.coordinates[0] + 180) * 4, y: (90 - site.coordinates[1]) * 4 };
}

function focusWindow(site: Site, zoom: number): WindowBox {
  const point = sitePoint(site);
  const width = worldWidth / zoom;
  const height = worldHeight / zoom;
  return {
    x: bounded(point.x - width / 2, 0, worldWidth - width),
    y: bounded(point.y - height / 2, 0, worldHeight - height),
    width,
    height
  };
}

export default function GeoExplorer({ selected, onSelect }: Props) {
  const [view, setView] = useState<WindowBox>(fullWorld);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; initial: WindowBox } | null>(null);
  const selectedSite = sites.find(site => site.id === selected) ?? sites[0];
  const viewBox = [view.x, view.y, view.width, view.height].join(" ");

  function focus(id: SiteId) {
    const site = sites.find(item => item.id === id) ?? sites[0];
    setZoom(2.6);
    setView(focusWindow(site, 2.6));
    onSelect(id);
  }

  function magnify(change: number) {
    const nextZoom = bounded(zoom + change, 1, 5);
    setZoom(nextZoom);
    setView(nextZoom === 1 ? fullWorld : focusWindow(selectedSite, nextZoom));
  }

  function reset() {
    setZoom(1);
    setView(fullWorld);
  }

  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, initial: view };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current || zoom <= 1) return;
    const area = event.currentTarget.getBoundingClientRect();
    const fittedWidth = Math.min(area.width, area.height * 2);
    const fittedHeight = fittedWidth / 2;
    if (!fittedWidth || !fittedHeight) return;
    const horizontal = (event.clientX - drag.current.x) * drag.current.initial.width / fittedWidth;
    const vertical = (event.clientY - drag.current.y) * drag.current.initial.height / fittedHeight;
    setView({
      ...drag.current.initial,
      x: bounded(drag.current.initial.x - horizontal, 0, worldWidth - drag.current.initial.width),
      y: bounded(drag.current.initial.y - vertical, 0, worldHeight - drag.current.initial.height)
    });
  }

  function pointerUp() {
    drag.current = null;
  }

  return <div className="geo-explorer" role="region" aria-label="World geography and NASA study locations">
    <div className="map-inner" role="region" aria-label="Interactive equirectangular world map">
      <svg
        className="world-map-svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Pan and zoom geographic study-point map"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <title>World map with four historical NASA POWER research locations</title>
        <image href="/world-map.svg" x="0" y="0" width={worldWidth} height={worldHeight} preserveAspectRatio="none" />
        {sites.map(site => {
          const point = sitePoint(site);
          const active = selected === site.id;
          return <g
            key={site.id}
            className={["world-map-marker", active ? "selected" : ""].join(" ")}
            role="button"
            tabIndex={0}
            aria-label={"Focus " + site.name + ", " + site.country}
            onPointerDown={event => event.stopPropagation()}
            onClick={() => focus(site.id)}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                focus(site.id);
              }
            }}
          >
            <circle cx={point.x} cy={point.y} r={active ? 15 : 12} className="world-map-halo" />
            <circle cx={point.x} cy={point.y} r="5" className="world-map-center" />
            <text x={point.x > 1000 ? point.x - 19 : point.x + 19} y={point.y - 13} textAnchor={point.x > 1000 ? "end" : "start"} className="world-map-label">{site.name}</text>
            <circle cx={point.x} cy={point.y} r="26" fill="transparent" />
          </g>;
        })}
      </svg>
    </div>
    <div className="geo-overlay-top">
      <span className="micro-label">WORLD ATLAS / MODEL STUDY POINTS</span>
      <span className="map-counter">EQUIRECTANGULAR VIEW · {zoom.toFixed(1)}×</span>
    </div>
    <div className="geo-tools" role="group" aria-label="Map navigation controls">
      <button type="button" onClick={() => magnify(0.6)} aria-label="Zoom in on selected study location" disabled={zoom >= 5}><ZoomIn size={17} /></button>
      <button type="button" onClick={() => magnify(-0.6)} aria-label="Zoom out" disabled={zoom <= 1}><ZoomOut size={17} /></button>
      <button type="button" onClick={reset} aria-label="Show full world map"><LocateFixed size={17} /></button>
    </div>
    <div className="map-site-list">
      <div className="map-list-heading">CHOOSE RESEARCH LOCATION <span>04 SITES</span></div>
      {sites.map(site => <button
        key={site.id}
        type="button"
        className={["map-site", selected === site.id ? "selected" : ""].join(" ")}
        onClick={() => focus(site.id)}
        aria-pressed={selected === site.id}
      >
        <span className="site-index">{site.index}</span>
        <span className="site-text"><strong>{site.name}</strong><small>{site.country}</small></span>
        <span className="site-dot" aria-hidden="true" />
      </button>)}
    </div>
    <div className="map-footer-note">Bundled world outlines · NASA POWER study coordinates · Historical model points, not farm boundaries</div>
  </div>;
}
