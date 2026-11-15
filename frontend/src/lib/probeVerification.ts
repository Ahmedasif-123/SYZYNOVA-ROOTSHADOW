export type Depth = "30" | "60";
export type ProbeInputs = {
  before30: string;
  after30: string;
  before60: string;
  after60: string;
  threshold30: string;
  threshold60: string;
  tolerance: string;
};
export type ProbeVerdict = "incomplete" | "not_recovered" | "adequate" | "recovered" | "unclear";
export type ProbeResult = {
  verdict: ProbeVerdict;
  label: string;
  explanation: string;
  nextStep: string;
  delta30: number | null;
  delta60: number | null;
  missing: string[];
};
export { blankProbeInputs, evaluateProbe, normalizeProbeInputs } from "../../shared/probeVerification.js";
