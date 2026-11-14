import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const siteIds = ["us_sgp_goodwell","us_sgp_stillwater","australia_narrabri","spain_cordoba","argentina_pampas","southern_africa"];
let totalEvents = 0;
let totalSurfaceFirst = 0;

for (const siteId of siteIds) {
  const file = new URL(`../public/site-results/${siteId}.json`, import.meta.url);
  const data = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(data.source.mode, "verified_prefetched_nasa", siteId);
  assert.equal(data.source.site, siteId, siteId);
  assert.equal(data.period.start, "1981-01-01", siteId);
  assert.equal(data.period.end, "2025-12-31", siteId);
  assert.equal(data.period.days, 16436, siteId);
  assert.equal(data.monthly.length, 540, siteId);
  assert.equal(data.quality.paired_day_coverage, 1, siteId);
  assert.equal(data.ready_for_scientific_claims, false, siteId);
  totalEvents += data.events.length;
  totalSurfaceFirst += data.events.filter(event => event.status === "COMPLETE_SURFACE_FIRST").length;
}

assert.equal(totalEvents, 158);
assert.equal(totalSurfaceFirst, 73);
console.log("Six NASA snapshots verified: 98,616 site-days, 158 episodes, 73 completed surface-first recoveries.");
