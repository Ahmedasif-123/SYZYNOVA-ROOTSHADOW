import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import type { Analysis } from "../lib/api";

type Props = { analysis: Analysis; synchronizedMonth?: string | null; onMonthChange?: (month: string) => void };

export default function SoilDepthExplorer({ analysis, synchronizedMonth, onMonthChange }: Props) {
  const samples = analysis.monthly;
  const startingIndex = useMemo(() => {
    let index = 0;
    let best = -Infinity;
    samples.forEach((entry, i) => {
      if (entry.top_percentile === null || entry.root_percentile === null) return;
      const difference = entry.top_percentile - entry.root_percentile;
      if (difference > best) { best = difference; index = i; }
    });
    return index;
  }, [samples]);

  const [index, setIndex] = useState(startingIndex);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setIndex(startingIndex);
    setPlaying(false);
  }, [startingIndex, samples]);

  useEffect(() => {
    if (!synchronizedMonth) return;
    const found = samples.findIndex(sample => sample.month === synchronizedMonth);
    if (found >= 0) setIndex(current => current === found ? current : found);
  }, [synchronizedMonth, samples]);

  useEffect(() => {
    if (!playing || samples.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex(previous => {
        const next = previous + 3;
        if (next >= samples.length - 1) {
          setPlaying(false);
          return samples.length - 1;
        }
        return next;
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [playing, samples.length]);

  const point = samples[Math.min(index, samples.length - 1)];
  const top = point?.top_percentile ?? null;
  const root = point?.root_percentile ?? null;
  const difference = top !== null && root !== null ? top - root : null;
  const year = point?.month.slice(0, 4) ?? "—";
  const selectedMonth = point ? new Date(`${point.month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "Unavailable";
  useEffect(() => { if (point?.month) onMonthChange?.(point.month); }, [point?.month, onMonthChange]);
  const firstYear = samples[0]?.month.slice(0, 4) ?? "1981";
  const finalYear = samples[samples.length - 1]?.month.slice(0, 4) ?? "2025";

  function jumpToYear(target: number) {
    const found = samples.findIndex(entry => Number(entry.month.slice(0, 4)) >= target);
    if (found < 0) return;
    setPlaying(false);
    setIndex(found);
  }

  function move(delta: number) {
    setPlaying(false);
    setIndex(previous => Math.max(0, Math.min(samples.length - 1, previous + delta)));
  }

  return (
    <section className="depth-lens" aria-label="Interactive monthly soil moisture explorer">
      <div className="depth-lens-heading">
        <div>
          <span className="eyebrow">INSTRUMENT 01 / DEPTH ANALYSIS</span>
          <h2>Look beneath the surface.</h2>
          <p>Scrub 45 years of modeled monthly soil-wetness percentiles. The two layers can respond differently even within the same month.</p>
        </div>
        <div className="depth-lens-source"><span className="depth-source-led" /> VERIFIED HISTORICAL SNAPSHOT <small>Historical model data, not a current sensor</small></div>
      </div>
      <div className="depth-lens-instrument">
        <div className="depth-lens-profile">
          <div className="depth-lens-profile-topline"><span>RELATIVE SOIL WETNESS</span><span>MONTHLY PERCENTILE</span></div>
          <div className="depth-lens-band depth-lens-surface">
            <div className="depth-band-meta"><span>01 / SURFACE</span><strong>{top === null ? "N/A" : top.toFixed(1)}<small>{top === null ? "" : " percentile"}</small></strong></div>
            <div className="depth-band-track"><div className="depth-band-fill top" style={{ width: `${Math.max(0, Math.min(100, top ?? 0))}%` }} /><span className="depth-threshold" /></div>
            <span className="depth-band-context">Upper soil layer · MERRA-2 model estimate</span>
          </div>
          <div className="depth-lens-divider"><span>SOIL PROFILE / SCHEMATIC</span><span>↓</span></div>
          <div className="depth-lens-band depth-lens-root">
            <div className="depth-band-meta"><span>02 / ROOT ZONE</span><strong>{root === null ? "N/A" : root.toFixed(1)}<small>{root === null ? "" : " percentile"}</small></strong></div>
            <div className="depth-band-track"><div className="depth-band-fill root" style={{ width: `${Math.max(0, Math.min(100, root ?? 0))}%` }} /><span className="depth-threshold" /></div>
            <span className="depth-band-context">Deeper modeled soil reservoir · Not a field probe</span>
          </div>
          <div className="depth-lens-profile-bottom"><span>0 / DRIEST HISTORICAL PERCENTILE</span><span>100 / WETTEST</span></div>
        </div>
        <div className="depth-lens-readout">
          <span className="depth-readout-label">TEMPORAL CROSS SECTION</span>
          <strong className="depth-readout-year">{year}</strong>
          <span className="depth-readout-month">{selectedMonth}</span>
          <div className="depth-readout-rule" />
          <span className="depth-readout-label">SURFACE − ROOT-ZONE</span>
          <strong className="depth-readout-delta">{difference === null ? "—" : `${difference >= 0 ? "+" : "−"}${Math.abs(difference).toFixed(1)}`}<small> percentage-point rank difference</small></strong>
          <p>{difference === null ? "No paired monthly reading for this selection." : difference > 0 ? "The shallow modeled layer ranked wetter than the root zone in this month." : difference < 0 ? "The modeled root zone ranked wetter than the shallow layer in this month." : "Both modeled layers had equal seasonal ranks this month."}</p>
          <span className="depth-readout-caveat">A rank gap does not measure actual water-volume difference or recovery delay in days.</span>
        </div>
      </div>
      <div className="depth-lens-timeline">
        <div className="depth-timeline-header"><span>ARCHIVE TRANSECT <strong>{firstYear} — {finalYear}</strong></span><span>FRAME {String(index + 1).padStart(3, "0")} / {String(samples.length).padStart(3, "0")}</span></div>
        <input aria-label="Select month in historical soil record" className="depth-timeline-slider" type="range" min={0} max={Math.max(0, samples.length - 1)} value={Math.min(index, Math.max(0, samples.length - 1))} onChange={event => { setPlaying(false); setIndex(Number(event.target.value)); }} disabled={!samples.length} />
        <div className="depth-timeline-years">
          {[1981, 1990, 2000, 2010, 2020, 2025].map(yr => <button type="button" key={yr} onClick={() => jumpToYear(yr)} className={Number(year) === yr ? "current" : ""}>{yr}</button>)}
        </div>
        <div className="depth-timeline-controls">
          <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="Previous month"><ChevronLeft size={17} /></button>
          <button type="button" className="depth-play-button" onClick={() => { if (index >= samples.length - 1) setIndex(0); setPlaying(value => !value); }} disabled={samples.length < 2}>
            {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? "PAUSE SCAN" : "SCAN HISTORY"}
          </button>
          <button type="button" onClick={() => move(1)} disabled={index >= samples.length - 1} aria-label="Next month"><ChevronRight size={17} /></button>
          <button type="button" className="depth-reset" onClick={() => { setPlaying(false); setIndex(startingIndex); }}><RotateCcw size={14} /> LARGEST MONTHLY CONTRAST</button>
        </div>
      </div>
      <p className="depth-lens-note">Each value is the median of model-derived daily seasonal wetness percentiles within the selected month. The 40th-percentile guide is a visual reference; qualifying drought recovery is determined separately from sustained daily values, not these monthly medians. This is not physical soil depth or an irrigation instruction.</p>
    </section>
  );
}
