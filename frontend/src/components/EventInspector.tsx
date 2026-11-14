import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronRight, CircleSlash, Layers3 } from "lucide-react";
import { describeEvent, formatLag, type Analysis, type RecoveryEvent } from "../lib/api";

function fmt(date: string | null) {
  if (!date) return "Not observed";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function Marker({ title, date, className }: { title: string; date: string | null; className: string }) {
  return <div className={`recovery-node ${className}`}><span className="recovery-dot" /><small>{title}</small><strong>{fmt(date)}</strong></div>;
}

export function EventInspector({ event }: { event: RecoveryEvent | null }) {
  if (!event) return <div className="event-empty"><Layers3 size={26} strokeWidth={1.2} /><p>Select a drought event from the list to inspect its recovery sequence.</p></div>;
  const status = event.status;
  const complete = event.recovery_delay_days !== null;
  const positive = complete && event.recovery_delay_days! > 0;
  return (
    <div className="event-inspector">
      <div className="event-inspector-top"><span className="eyebrow">DETECTED HISTORICAL EVENT</span><span className={`event-badge ${positive ? "lag" : ""}`}>{status.replaceAll("_", " ")}</span></div>
      <div className="event-headline">{complete ? <><strong>{formatLag(event.recovery_delay_days)}</strong><span>Root-zone recovery relative to surface</span></> : <><strong>Recovery incomplete</strong><span>Do not interpret as zero delay</span></>}</div>
      <div className="recovery-sequence" aria-label="Chronological drought and recovery milestones">
        <div className="recovery-track" />
        {[
          { title: "Drought begins", date: event.drought_start, className: "drought" },
          { title: "Surface recovery", date: event.surface_recovery, className: "surface" },
          { title: "Root-zone recovery", date: event.root_recovery, className: "root" }
        ].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")).map(item => <Marker key={item.title} {...item} />)}
      </div>
      <p className="event-explanation">{describeEvent(event)}</p>
      <div className="event-mini-meta"><span><CalendarDays size={13} /> Drought identified: {fmt(event.drought_start)}</span><span>{complete ? <ArrowUpRight size={14} /> : <CircleSlash size={14} />} {complete ? "Completed recovery comparison" : "Censored or incomplete event"}</span></div>
      <p className="event-science-note">The diagram shows milestone dates, not physical soil depth or a daily moisture trace.</p>
    </div>
  );
}

export function EventList({ analysis, selected, onSelect }: { analysis: Analysis; selected: RecoveryEvent | null; onSelect: (event: RecoveryEvent) => void }) {
  const [expanded, setExpanded] = useState(false);
  const ordered = [...analysis.events].sort((a, b) => b.drought_start.localeCompare(a.drought_start));
  const shown = expanded ? ordered : ordered.slice(0, 8);
  return (
    <div className="event-list">
      <div className="event-list-head"><span>DETECTED EVENTS</span><span>{analysis.events.length} total</span></div>
      <div className="event-rows">
        {shown.map(event => (
          <button type="button" key={`${event.drought_start}-${event.drought_end}`} className={`event-row ${selected?.drought_start === event.drought_start ? "selected" : ""}`} onClick={() => onSelect(event)} aria-pressed={selected?.drought_start === event.drought_start}>
            <span className="event-row-icon">{event.recovery_delay_days !== null && event.recovery_delay_days > 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}</span>
            <span className="event-row-text"><strong>{fmt(event.drought_start)}</strong><small>{event.status.replaceAll("_", " ").toLowerCase()}</small></span>
            <span className="event-row-lag">{event.recovery_delay_days === null ? "—" : `${event.recovery_delay_days > 0 ? "+" : ""}${event.recovery_delay_days}d`}</span>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
      {ordered.length > 8 && <button type="button" className="text-action" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer events" : `Show all ${ordered.length} events`} <ChevronRight size={14} /></button>}
    </div>
  );
}

