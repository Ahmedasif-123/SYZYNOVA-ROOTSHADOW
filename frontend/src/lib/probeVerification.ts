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
export type ProbeVerdict = "incomplete" | "not_recovered" | "recovered" | "unclear";
export type ProbeResult = {
  verdict: ProbeVerdict;
  label: string;
  explanation: string;
  nextStep: string;
  delta30: number | null;
  delta60: number | null;
  missing: string[];
};
export const blankProbeInputs: ProbeInputs = {
  before30: "",
  after30: "",
  before60: "",
  after60: "",
  threshold30: "",
  threshold60: "",
  tolerance: ""
};
function parse(raw: string): number | null {
  if (raw.trim() === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
}
export function evaluateProbe(inputs: ProbeInputs): ProbeResult {
  const values = {
    before30: parse(inputs.before30),
    after30: parse(inputs.after30),
    before60: parse(inputs.before60),
    after60: parse(inputs.after60),
    threshold30: parse(inputs.threshold30),
    threshold60: parse(inputs.threshold60),
    tolerance: parse(inputs.tolerance)
  };
  const missing = Object.entries(values).filter(([key, value]) =>
    value === null || (key.startsWith("threshold") && value <= 0) ||
    (key === "tolerance" && (value <= 0 || value > 10))
  ).map(([key]) => key);
  const result = (verdict: ProbeVerdict, label: string, explanation: string, nextStep: string): ProbeResult => ({
    verdict, label, explanation, nextStep,
    delta30: values.before30 === null || values.after30 === null ? null : values.after30 - values.before30,
    delta60: values.before60 === null || values.after60 === null ? null : values.after60 - values.before60,
    missing
  });
  if (missing.length) {
    return result("incomplete", "Insufficient measurements", "Enter measured pre-rain and post-rain volumetric water content at both depths, independently established local minimum targets, and your sensor's uncertainty margin. No readings or thresholds are invented.", "Measure both depths and obtain soil- and crop-specific thresholds from an agronomist before interpreting the results.");
  }
  const { before30, before60, after30, after60, threshold30, threshold60, tolerance } =
    values as Record<keyof ProbeInputs, number>;
  if (after30 < threshold30 - tolerance || after60 < threshold60 - tolerance) {
    const affected = [
      after30 < threshold30 - tolerance ? "30 cm" : null,
      after60 < threshold60 - tolerance ? "60 cm" : null
    ].filter(Boolean).join(" and ");
    return result("not_recovered", "Not recovered at the sampled depths", "Post-rain moisture remains below the user-supplied minimum at " + affected + ", beyond the specified measurement margin. This is a comparison of user-entered field measurements, not NASA model validation.", "Do not infer that rain has replenished the whole root zone. Confirm the probe calibration, measure additional representative depths, and review the irrigation plan with the farm adviser.");
  }
  const above = after30 > threshold30 + tolerance && after60 > threshold60 + tolerance;
  const rose = after30 > before30 + tolerance && after60 > before60 + tolerance;
  const deficitBefore = before30 < threshold30 - tolerance || before60 < threshold60 - tolerance;
  if (above && rose && deficitBefore) {
    return result("recovered", "Measured recovery supported at 30 and 60 cm", "Both measured depths rose beyond the stated sensor margin and are above the site-supplied local targets, after at least one depth had been below its target. Recovery is indicated only at these sampled depths, not across the entire field.", "Have an agronomist check crop rooting depth, field representativeness, forecast evapotranspiration and repeat readings before changing irrigation. This result is not permission to reduce irrigation automatically.");
  }
  return result("unclear", "Unclear — verify before changing irrigation", "The two-depth readings do not establish a pre-rain deficit followed by a sufficiently large, consistent increase above both local targets. Values near the threshold, different responses by depth, or previously adequate soil conditions require more context.", "Retake readings after allowing for infiltration, check sensor calibration and soil heterogeneity, and request crop-specific irrigation advice. Do not change irrigation on this result alone.");
}
