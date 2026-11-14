import { Check, CircleHelp, FileCheck2, ShieldAlert, X } from "lucide-react";
import type { Analysis } from "../lib/api";
import { verdictLabel } from "../lib/api";

export default function EvidencePanel({ analysis, advanced }: { analysis: Analysis; advanced: boolean }) {
  const verdict = analysis.audit.verdict;
  return (
    <div className="evidence-panel">
      <div className="evidence-callout">
        <div className="evidence-symbol"><ShieldAlert size={25} strokeWidth={1.5} /></div>
        <div><span className="eyebrow">SCIENTIFIC EVIDENCE STATUS</span><h3>{verdictLabel(verdict)}</h3><p>{analysis.audit.explanation}</p></div>
      </div>
      <div className="evidence-plain"><FileCheck2 size={18} /><span>These results describe a historical model-based screening. They do not establish current farm conditions, crop loss, or irrigation requirements.</span></div>
      {advanced && (
        <div className="evidence-checks">
          {analysis.audit.checks.map((item, i) => (
            <div className="evidence-check" key={`${item.check}-${i}`}>
              <span className={`evidence-check-icon ${item.passed === false ? "fail" : item.passed === null ? "unknown" : "pass"}`}>{item.passed === true ? <Check size={15} /> : item.passed === false ? <X size={15} /> : <CircleHelp size={15} />}</span>
              <div><strong>{item.check}</strong><small>{item.detail}</small></div>
            </div>
          ))}
          <div className="audit-caution">{analysis.audit.caution}</div>
        </div>
      )}
    </div>
  );
}
