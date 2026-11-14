const byId = id => document.getElementById(id);
const safe = input => String(input ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const ui = {mode: byId("mode"), location: byId("location"), site: byId("site"), run: byId("run"), status: byId("status")};
function makeChart(rows) {
  const valid = rows.filter(r => r.top_percentile !== null && r.root_percentile !== null);
  if (valid.length < 2) return '<div class="chart empty">Not enough complete observations to draw a trend.</div>';
  const width = 850, height = 340, left = 35, right = 15, top = 14, bottom = 37;
  const scaleX = i => left + i * (width - left - right) / (valid.length - 1);
  const scaleY = p => top + (100 - p) * (height - top - bottom) / 100;
  const path = key => valid.map((r, i) => `${i ? "L" : "M"}${scaleX(i).toFixed(2)},${scaleY(r[key]).toFixed(2)}`).join(" ");
  const lines = [0, 20, 40, 60, 80, 100].map(y => `<line x1="${left}" y1="${scaleY(y)}" x2="${width - right}" y2="${scaleY(y)}" stroke="#274057" stroke-width="1"/><text x="1" y="${scaleY(y)+4}" fill="#9eb1c4" font-size="11">${y}%</text>`).join("");
  const ticks = [0, Math.floor((valid.length - 1) / 4), Math.floor((valid.length - 1) / 2), Math.floor(3*(valid.length - 1)/4), valid.length - 1].map(i => `<text x="${scaleX(i)}" y="${height - 5}" text-anchor="middle" fill="#9eb1c4" font-size="11">${safe(valid[i].month)}</text>`).join("");
  return `<svg role="img" aria-label="Monthly surface and root-zone seasonal percentile ranks" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${lines}<path d="${path("top_percentile")}" fill="none" stroke="#66cdf6" stroke-width="2.4" vector-effect="non-scaling-stroke"/><path d="${path("root_percentile")}" fill="none" stroke="#b8e0a0" stroke-width="2.4" vector-effect="non-scaling-stroke"/>${ticks}</svg>`;
}
function render(data) {
  const mode = data.source.mode;
  const simulated = mode === "synthetic_demonstration";
  const banner = byId("mode-banner");
  banner.className = `safety ${simulated ? "" : "live"}`;
  const messages = {
    synthetic_demonstration: "<strong>SIMULATED DEMONSTRATION — NOT SCIENTIFIC EVIDENCE</strong> All values and events are synthetic (a delay trend is built in by construction).",
    verified_cached_nasa: "<strong>VERIFIED CACHED NASA DATA — NOT LIVE</strong> Showing checksum-verified prior snapshots. Check the retrieval date.",
    mixed_live_and_cached_nasa: "<strong>PARTLY CACHED NASA DATA</strong> Some periods came from checksum-verified snapshots because NASA was unreachable.",
    verified_prefetched_nasa: "<strong>PREFETCHED NASA POWER SNAPSHOT (checksum verified)</strong> Gridded MERRA-2 model output, not in-situ measurement. Screening only.",
    live_nasa: "<strong>LIVE NASA DATA RETRIEVED</strong> Gridded MERRA-2 model output. Interpretation remains exploratory."
  };
  banner.innerHTML = messages[mode] || safe(mode);
  const done = data.events.filter(e => e.recovery_delay_days !== null);
  const lags = done.filter(e => e.recovery_delay_days > 0).map(e => e.recovery_delay_days).sort((x, y) => x - y);
  const mid = Math.floor(lags.length / 2);
  const median = lags.length ? (lags.length % 2 ? lags[mid] : (lags[mid - 1] + lags[mid]) / 2) : null;
  const lt = data.lag_trend;
  byId("count").textContent = done.length;
  byId("longest").textContent = median === null ? "N/A" : `${median} d`;
  byId("trend").textContent = lt.slope_days_per_decade === null || lt.slope_days_per_decade === undefined ? "N/A" : `${lt.slope_days_per_decade > 0 ? "+" : ""}${lt.slope_days_per_decade}`;
  byId("significance").textContent = data.audit.verdict.replaceAll("_", " ");
  byId("chart").classList.remove("empty");
  byId("chart").innerHTML = makeChart(data.monthly);
  byId("period").textContent = `${data.period.start} — ${data.period.end}`;
  byId("events").innerHTML = data.events.length ? data.events.map(e => `<tr><td>${safe(e.drought_start)}</td><td>${safe(e.surface_recovery)}</td><td>${safe(e.root_recovery)}</td><td>${e.recovery_delay_days !== null ? safe(e.recovery_delay_days) + " d" : "≥ " + safe(e.censored_delay_lower_bound_days ?? 0) + " d (censored)"}</td><td>${safe(e.status.replaceAll("_", " ").toLowerCase())}</td></tr>`).join("") : '<tr><td colspan="5">No drought–recovery cycles met the stated criteria. This does not establish that drought is absent.</td></tr>';
  byId("robustness").textContent = data.method.limitations;
  byId("verdict").textContent = data.audit.verdict.replaceAll("_", " ");
  byId("verdict-text").textContent = `${data.audit.explanation} ${data.audit.caution}`;
  byId("checks").innerHTML = data.audit.checks.map(c => `<tr><td>${safe(c.check)}</td><td>${c.passed === null ? "n/a" : c.passed ? "pass" : "fail"}</td><td>${safe(c.detail)}</td></tr>`).join("");
  const nm = data.null_model;
  byId("null-text").textContent = nm ? `Surrogate null (${nm.n_surrogates} runs, ${nm.status.replaceAll("_", " ").toLowerCase()}): observed median delay ${nm.observed.median_lag ?? "n/a"} d vs ${nm.surrogate_mean.median_lag ?? "n/a"} d expected from the model's own surface→root behaviour. ${nm.assumptions}` : "Null model not run (too few usable years).";
  const g = data.sensitivity;
  byId("grid-text").textContent = `Threshold sensitivity: ${g.sign_agreement_with_primary ?? "n/a"} of ${g.cells_tested ?? 0} testable settings agree with the primary slope sign. ${g.note || ""}`;
  byId("source").textContent = mode.replaceAll("_", " ");
  byId("hash").textContent = data.source.sha256 || "Not available";
  byId("latency").textContent = data.source.network_latency_ms === null || data.source.network_latency_ms === undefined ? "Not applicable" : `${data.source.network_latency_ms} ms`;
  byId("range").textContent = `${data.period.start} to ${data.period.end}`;
  byId("caveat").textContent = data.source.warning || `${data.source.integrity_note || ""} ${data.source.retrieved_utc ? "Retrieved: " + data.source.retrieved_utc + ". " : ""}${data.source.network_error ? "Network notes: " + data.source.network_error : ""}`;
  ui.status.textContent = simulated ? "Demo loaded" : "NASA data loaded";
}
async function loadSites() {
  try {
    const body = await (await fetch("/api/sites")).json();
    if (body.sites && body.sites.length) ui.site.innerHTML = body.sites.map(s => `<option value="${safe(s)}">${safe(s)}</option>`).join("");
  } catch (e) { /* demo still works without snapshots */ }
}
async function execute() {
  ui.run.disabled = true;
  ui.status.textContent = "Processing…";
  const coords = ui.location.value.split(",");
  const params = new URLSearchParams({mode: ui.mode.value, lat: coords[0], lon: coords[1], start: byId("start").value, end: byId("end").value});
  if (ui.mode.value === "site") params.set("site", ui.site.value);
  try {
    const response = await fetch(`/api/analyze?${params.toString()}`, {headers: {Accept: "application/json"}});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || body.detail || `Request failed: HTTP ${response.status}`);
    render(body);
  } catch (error) {
    ui.status.textContent = "Unable to load";
    const banner = byId("mode-banner");
    banner.className = "safety";
    banner.textContent = `Investigation failed: ${error.message}. No observations were substituted or invented.`;
  } finally {
    ui.run.disabled = false;
  }
}
ui.run.addEventListener("click", execute);
loadSites();
execute();
