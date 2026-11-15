export const blankProbeInputs = {
  before30: "", after30: "", before60: "", after60: "",
  threshold30: "", threshold60: "", tolerance: ""
};
const fields = Object.keys(blankProbeInputs);
function parse(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
export function normalizeProbeInputs(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = { ...blankProbeInputs };
  for (const key of fields) {
    const entry = value[key];
    if ((typeof entry !== "number" && typeof entry !== "string") || String(entry).trim() === "") return null;
    const number = Number(entry);
    if (!Number.isFinite(number) || number < 0 || number > 100) return null;
    result[key] = String(number);
  }
  return result;
}
export function evaluateProbe(inputs) {
  const values = Object.fromEntries(fields.map(key => [key, parse(inputs[key])]));
  const missing = fields.filter(key => values[key] === null ||
    (key.startsWith("threshold") && values[key] <= 0) ||
    (key === "tolerance" && (values[key] <= 0 || values[key] > 10)));
  const create = (verdict, label, explanation, nextStep) => ({
    verdict, label, explanation, nextStep,
    delta30: values.before30 === null || values.after30 === null ? null : values.after30 - values.before30,
    delta60: values.before60 === null || values.after60 === null ? null : values.after60 - values.before60,
    missing
  });
  if (missing.length) return create(
    "incomplete", "Insufficient measurements",
    "Enter measured pre-rain and post-rain volumetric water content at both depths, independently established local minimum targets, and your sensor's uncertainty margin. No readings or thresholds are invented.",
    "Measure both depths and obtain soil- and crop-specific thresholds from an agronomist before interpreting the results."
  );
  const { before30, after30, before60, after60, threshold30, threshold60, tolerance } = values;
  const below30 = after30 < threshold30 - tolerance;
  const below60 = after60 < threshold60 - tolerance;
  if (below30 || below60) {
    const affected = [below30 ? "30 cm" : null, below60 ? "60 cm" : null].filter(Boolean).join(" and ");
    return create(
      "not_recovered", "Not recovered at the sampled depths",
      "Post-rain moisture remains below the user-supplied minimum at " + affected + ", beyond the specified measurement margin. This is a comparison of user-entered field measurements, not NASA model validation.",
      "Do not infer that rain has replenished the whole root zone. Confirm probe calibration, measure additional representative depths and review the irrigation plan with the farm adviser."
    );
  }
  const above = after30 > threshold30 + tolerance && after60 > threshold60 + tolerance;
  const adequateBefore = before30 > threshold30 + tolerance && before60 > threshold60 + tolerance;
  if (above && adequateBefore) {
    return create(
      "adequate", "Already adequate at both measured depths",
      "Both depths were above the site-supplied minimum before and after rain, outside the entered measurement margin. Rain-triggered recovery cannot be inferred. No statement is made about the rest of the field.",
      "Continue field monitoring. Confirm crop rooting depth, moisture targets and probe placement with an agronomist before changing irrigation."
    );
  }
  const rose = after30 > before30 + tolerance && after60 > before60 + tolerance;
  const deficitBefore = before30 < threshold30 - tolerance || before60 < threshold60 - tolerance;
  if (above && rose && deficitBefore) {
    return create(
      "recovered", "Measured recovery supported at 30 and 60 cm",
      "Both measured depths rose beyond the stated sensor margin and are above the site-supplied local targets, after at least one depth had been below its target. Recovery is indicated only at these sampled depths, not across the entire field.",
      "Have an agronomist check crop rooting depth, field representativeness, forecast evapotranspiration and repeat readings before changing irrigation. This result is not permission to reduce irrigation automatically."
    );
  }
  return create(
    "unclear", "Unclear — verify before changing irrigation",
    "The readings do not establish a clear recovery or consistently adequate conditions. Values exactly at the uncertainty boundary, conflicting depth responses or insufficient pre-rain evidence require verification.",
    "Retake readings after allowing for infiltration, check sensor calibration and soil heterogeneity, and request crop-specific irrigation advice. Do not change irrigation on this result alone."
  );
}
