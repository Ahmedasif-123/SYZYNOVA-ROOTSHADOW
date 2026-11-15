import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProbe, normalizeProbeInputs } from "../shared/probeVerification.js";

const base = {
  before30: "10", before60: "10", after30: "24", after60: "25",
  threshold30: "20", threshold60: "20", tolerance: "1"
};
const verdict = patch => evaluateProbe({ ...base, ...patch }).verdict;
test("empty and incomplete inputs abstain", () => {
  assert.equal(verdict({ after30: "" }), "incomplete");
  assert.equal(verdict({ threshold30: "0" }), "incomplete");
  assert.equal(verdict({ tolerance: "0" }), "incomplete");
  assert.equal(verdict({ tolerance: "11" }), "incomplete");
  assert.equal(verdict({ after60: "NaN" }), "incomplete");
  assert.equal(verdict({ before30: "-1" }), "incomplete");
});
test("a measured deficit strictly beyond the margin is not recovered", () => {
  assert.equal(verdict({ after30: "18.9" }), "not_recovered");
  assert.equal(verdict({ after60: "18.9" }), "not_recovered");
});
test("exact lower boundary abstains, never rounds to a deficit", () => {
  assert.equal(verdict({ after30: "19" }), "unclear");
  assert.equal(verdict({ after60: "19" }), "unclear");
});
test("exact upper boundary abstains, above it supports sampled-depth recovery", () => {
  assert.equal(verdict({ after30: "21" }), "unclear");
  assert.equal(verdict({ after60: "21" }), "unclear");
  assert.equal(verdict({ after30: "21.0001" }), "recovered");
});
test("already adequate before and after is distinct from new recovery", () => {
  assert.equal(verdict({ before30: "30", before60: "29", after30: "31", after60: "30" }), "adequate");
  assert.equal(verdict({ before30: "21", before60: "29", after30: "31", after60: "30" }), "unclear");
});
test("no model field enters the verdict", () => {
  const inputs = { ...base, siteId: "qatar_doha", modelCategory: "persistent_mismatch" };
  assert.equal(evaluateProbe(inputs).verdict, "recovered");
  inputs.modelCategory = "no_flag";
  assert.equal(evaluateProbe(inputs).verdict, "recovered");
});
test("a pre-rain deficit and sufficient increase at both depths supports sampled-depth recovery only", () => {
  const result = evaluateProbe(base);
  assert.equal(result.verdict, "recovered");
  assert.match(result.explanation, /not across the entire field/i);
});
test("mixed-depth conditions remain unresolved when not clearly below or recovered", () => {
  assert.equal(verdict({ before30: "26", before60: "10", after30: "27", after60: "21" }), "unclear");
});
test("server inputs normalize through the same source implementation", () => {
  const normalized = normalizeProbeInputs({
    before30: 10, before60: 10, after30: 24, after60: 25,
    threshold30: 20, threshold60: 20, tolerance: 1
  });
  assert.ok(normalized);
  assert.equal(evaluateProbe(normalized).verdict, "recovered");
  assert.equal(normalizeProbeInputs({ ...base, after60: "Infinity" }), null);
  assert.equal(normalizeProbeInputs({ ...base, before30: " " }), null);
});
