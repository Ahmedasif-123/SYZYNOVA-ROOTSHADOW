import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const goodwell = JSON.parse(readFileSync(new URL("./fixtures/goodwell.json", import.meta.url), "utf8"));
const narrabri = JSON.parse(readFileSync(new URL("./fixtures/narrabri.json", import.meta.url), "utf8"));
const argentina = JSON.parse(readFileSync(new URL("./fixtures/argentina.json", import.meta.url), "utf8"));
const africa = JSON.parse(readFileSync(new URL("./fixtures/southern_africa.json", import.meta.url), "utf8"));

const responses: Record<string, unknown> = {
  us_sgp_goodwell: goodwell,
  australia_narrabri: narrabri,
  argentina_pampas: argentina,
  southern_africa: africa
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/analyze?**", async route => {
    const site = new URL(route.request().url()).searchParams.get("site") ?? "";
    const response = responses[site];
    await route.fulfill(response ? { status: 200, contentType: "application/json", body: JSON.stringify(response) } : { status: 503, contentType: "application/json", body: JSON.stringify({ detail: "No verified site fixture" }) });
  });
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
});

test("homepage clearly explains model-based historical evidence", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Better evidence for/i })).toBeVisible();
  await expect(page.locator(".earth-stage")).toBeVisible();
  await expect(page.locator("body")).toContainText("NASA");
  await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true });
});

test("verified Goodwell data drives farmer-facing metrics and recovery selection", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator(".metric-value").nth(0)).toHaveText("31");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("19");
  await expect(page.locator(".metric-value").nth(2)).toHaveText("2 d");
  await expect(page.locator(".guided-reliability")).toContainText("NASA POWER");
  await page.getByRole("button", { name: /Drought events/i }).click();
  await page.locator(".guided-event-table tbody button").first().click();
  await expect(page.locator(".event-inspector")).toBeVisible();
  await page.getByRole("button", { name: /Soil over time/i }).click();
  await expect(page.locator(".echart")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("investigation.png"), fullPage: true });
});

test("monthly depth explorer scrubs verified records and syncs with the chart", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator(".metric-value").first()).toHaveText("31");
  await expect(page.locator(".depth-lens")).toBeVisible();
  const slider = page.getByRole("slider", { name: "Select month in historical soil record" });
  await slider.focus();
  await slider.press("Home");
  await expect(page.locator(".depth-readout-month")).toHaveText("January 1981");
  await slider.press("End");
  await expect(page.locator(".depth-readout-month")).toHaveText("December 2025");
  await expect(page.locator(".depth-readout-caveat")).toContainText("recovery delay in days");
  await page.getByRole("button", { name: "LARGEST MONTHLY CONTRAST" }).click();
  await expect(page.locator(".depth-readout-month")).not.toHaveText("December 2025");
  await page.getByRole("button", { name: "SCAN HISTORY" }).click();
  await expect(page.getByRole("button", { name: "PAUSE SCAN" })).toBeVisible();
  await page.getByRole("button", { name: "PAUSE SCAN" }).click();
  await expect(page.locator(".echart")).toHaveCount(1);
});

test("research conclusions drive an audience-specific next step and export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await page.getByRole("button", { name: /The takeaway/i }).click();
  await page.getByText(/Read the complete research interpretation/i).click();
  await expect(page.locator(".rs-conclusion")).toBeVisible();
  await expect(page.getByRole("heading", { name: /surface recovered first/i })).toBeVisible();
  await expect(page.locator(".rs-conclusion-lead")).toContainText("61.3%");
  await page.getByRole("button", { name: "Researcher", exact: true }).click();
  await expect(page.getByText(/Treat the delay as a testable screening result/)).toBeVisible();
  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await expect(page.getByText(/prioritize verification/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export this finding" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("ROOTSHADOW-goodwell-conclusion.json");
  const exported = JSON.parse(readFileSync(await file.path(), "utf8"));
  expect(exported.project).toBe("ROOTSHADOW");
  expect(exported.conclusion.drought_events).toBe(31);
  expect(exported.conclusion.completed_surface_first).toBe(19);
  expect(exported.conclusion.scientific_claim_ready).toBe(false);
  expect(exported.source.mode).toBe("verified_prefetched_nasa");
});

test("scientific workspace renders actual backend tests and comparisons", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator(".metric-value").first()).toHaveText("31");
  await page.getByRole("button", { name: /The takeaway/i }).click();
  await page.getByText("Explore advanced graphs").click();
  await expect(page.locator(".echart")).toHaveCount(2);
  await page.getByText(/Evidence quality and statistical checks/i).click();
  await expect(page.locator(".evidence-check")).toHaveCount(goodwell.audit.checks.length);
  await expect(page.getByRole("region", { name: "Results at a glance" })).toBeVisible();
  await page.locator("#guided-compare-select").selectOption("australia_narrabri");
  await expect(page.getByText("28 episodes")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("scientific.png"), fullPage: true });
});

test("location changes update real data and never reuse the previous site's figures", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator(".metric-value").first()).toHaveText("31");
  await page.locator("#site-select").selectOption("australia_narrabri");
  await expect(page.locator(".metric-value").first()).toHaveText("28");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("16");
  await expect(page.locator(".guided-finding h2")).toContainText("Narrabri");
});

test("missing data produces an error rather than invented scientific numbers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator(".metric-value").first()).toHaveText("31");
  await page.locator("#site-select").selectOption("spain_cordoba");
  await expect(page.getByRole("heading", { name: "Analysis unavailable" })).toBeVisible();
  await expect(page.getByText(/No verified site fixture/)).toBeVisible();
  await expect(page.locator(".metric-value")).toHaveCount(0);
});

test("small screens have working navigation without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 600) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("button", { name: "The science" })).toBeVisible();
    await page.getByRole("button", { name: "The science" }).click();
    await expect(page.getByRole("heading", { name: /How we see beneath/i })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});

test("3D Earth and offline atlas both expose verified study locations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".earth-stage")).toBeVisible();
  await expect(page.getByRole("region", { name: "Interactive three dimensional Earth research explorer" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Research study locations" })).toBeVisible();
  await expect(page.locator(".earth-location-strip button")).toHaveCount(6);
  const image = await page.request.get("/earth-day-2048.jpg");
  expect(image.ok()).toBeTruthy();
  const geojson = await page.request.get("/world.geojson");
  expect(geojson.ok()).toBeTruthy();
  expect((await geojson.json()).features.length).toBeGreaterThan(100);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator(".geo-explorer")).toBeVisible();
  await expect(page.locator(".world-map-svg")).toBeVisible();
  const atlas = page.locator(".world-map-svg");
  const extentBefore = await atlas.getAttribute("viewBox");
  await page.getByRole("button", { name: "Zoom in on selected study location" }).click();
  await expect(atlas).not.toHaveAttribute("viewBox", extentBefore ?? "");
  await page.getByRole("button", { name: "Show full world map" }).click();
  await expect(atlas).toHaveAttribute("viewBox", extentBefore ?? "");
  await expect(page.locator(".map-site-list .map-site")).toHaveCount(97);
  await page.locator(".map-site-list .map-site").filter({ hasText: "Goodwell" }).click();
  await expect(page.getByRole("button", { name: "Start investigating" })).toBeVisible();
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.getByRole("heading", { name: /What happens beneath the surface?/i })).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("31");
});

test("3D Earth retains accessible location selection when WebGL is unsupported", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId, ...args) {
      if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") return null;
      return original.call(this, contextId, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(page.getByText(/3D graphics unavailable on this device/)).toBeVisible();
  await expect(page.locator(".earth-location-strip button")).toHaveCount(6);
  await page.locator(".earth-location-strip button").filter({ hasText: "Narrabri" }).click();
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator("#site-select")).toHaveValue("australia_narrabri");
  await expect(page.locator(".metric-value").first()).toHaveText("28");
});

test("reduced-motion preference disables decorative globe rotation without blocking location selection", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Toggle globe auto rotation" })).toHaveAttribute("aria-pressed", "false");
  await page.locator(".earth-location-strip button").filter({ hasText: "Narrabri" }).click();
  await expect(page.locator(".earth-rail-selected strong")).toHaveText("Narrabri");
});

test("offline atlas lets keyboard users focus and investigate a study location", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const marker = page.getByRole("button", { name: /Focus Córdoba/i });
  await marker.focus();
  await marker.press("Enter");
  await expect(page.locator(".map-site-list .map-site.selected")).toContainText("Córdoba");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator("#site-select")).toHaveValue("spain_cordoba");
});

test("guided research begins with a selectable map and navigable evidence steps", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.getByRole("region", { name: "Choose a study location on the world map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "World map", exact: true })).toBeVisible();
  await expect(page.locator(".guided-finding .guided-large-number")).toContainText("19");
  await page.getByRole("button", { name: /Drought events/i }).click();
  await expect(page.locator(".guided-event-table tbody tr")).toHaveCount(12);
  await page.getByRole("button", { name: /Surface first \(19\)/i }).click();
  await expect(page.locator(".guided-table-controls")).toContainText("19 matching events");
  await page.locator(".guided-event-table tbody button").first().click();
  await expect(page.locator(".event-inspector")).toBeVisible();
  await page.getByRole("button", { name: /View this event on the timeline/i }).click();
  await expect(page.locator(".depth-lens")).toBeVisible();
});

test("guided research shows honest error without reusing previous location's statistics", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator(".guided-large-number")).toContainText("19");
  await page.locator("#site-select").selectOption("spain_cordoba");
  await expect(page.getByRole("heading", { name: "Analysis unavailable" })).toBeVisible();
  await expect(page.locator(".guided-large-number")).toHaveCount(0);
});



test("graph guidance follows historical monthly data and explains interpretation visually", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  const guide = page.getByRole("region", { name: "Understand the selected monthly soil reading" });
  await expect(guide).toBeVisible();
  await expect(guide.locator(".visual-guide-value")).toHaveCount(2);
  const slider = page.getByRole("slider", { name: "Select month in historical soil record" });
  await slider.focus();
  await slider.press("Home");
  await expect(guide).toContainText("Jan 1981");
  await slider.press("End");
  await expect(guide).toContainText("Dec 2025");
  await expect(page.locator(".visual-chart-key")).toContainText("Dashed: 20 dry / 40 recovery");
  await page.getByRole("button", { name: /The takeaway/i }).click();
  await page.getByText("Explore advanced graphs").click();
  await expect(page.getByText(/Each bar = days in one year/)).toBeVisible();
  await expect(page.getByText(/Nine versions of the analysis/)).toBeVisible();
});

test("97-location selection, concise takeaway and event filters work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator("#site-select option")).toHaveCount(97);
  await page.getByRole("button", { name: /The takeaway/i }).click();
  await expect(page.getByRole("region", { name: "Results at a glance" })).toContainText("Surface recovery doesn't always mean deeper recovery");
  await expect(page.locator(".guided-evidence-panel")).not.toBeVisible();
  await page.getByText(/Evidence quality and statistical checks/i).click();
  await expect(page.locator(".evidence-check")).toHaveCount(goodwell.audit.checks.length);
  await page.getByRole("button", { name: /Drought events/i }).click();
  await page.getByRole("combobox", { name: "Filter drought events by decade" }).selectOption("2000");
  expect(await page.locator(".guided-event-table tbody tr").count()).toBeLessThanOrEqual(12);
  await page.locator("#site-select").selectOption("argentina_pampas");
  await expect(page.locator(".guided-large-number")).toContainText("11");
});

test("Middle East NASA locations load authentic 45-year model analysis without changing the original six", async ({ page }) => {
  const doha = JSON.parse(readFileSync(new URL("../public/site-results/qatar_doha.json", import.meta.url), "utf8"));
  const riyadh = JSON.parse(readFileSync(new URL("../public/site-results/saudi_riyadh.json", import.meta.url), "utf8"));
  await page.route("**/api/analyze?**", async route => {
    const id = new URL(route.request().url()).searchParams.get("site");
    const data = id === "qatar_doha" ? doha : id === "saudi_riyadh" ? riyadh : null;
    if (data) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    } else {
      await route.fallback();
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await page.locator("#site-select").selectOption("qatar_doha");
  await expect(page.locator(".guided-finding h2")).toContainText("Doha");
  await expect(page.locator(".metric-value").first()).toHaveText(String(doha.events.length));
  await expect(page.locator(".guided-large-number")).toContainText(String(doha.events.filter((event: { status: string }) => event.status === "COMPLETE_SURFACE_FIRST").length));
  await page.locator("#site-select").selectOption("saudi_riyadh");
  await expect(page.locator(".guided-finding h2")).toContainText("Riyadh");
  await expect(page.locator(".metric-value").first()).toHaveText(String(riyadh.events.length));
  const response = await page.request.get("/site-results/qatar_doha.json");
  expect(response.ok()).toBeTruthy();
  const published = await response.json();
  expect(published.period.days).toBe(16436);
  expect(published.ready_for_scientific_claims).toBe(false);
});


test("five map categories show verified NASA point data without manufacturing a continuous raster", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".earth-stage")).toBeVisible();
  await page.getByRole("button", { name: "Surface", exact: true }).click();
  const surface = page.getByRole("region", { name: "Surface Moisture model-point map" });
  await expect(surface).toBeVisible();
  await expect(surface.locator(".moisture-atlas-count")).toContainText("97 / 97 readings");
  await expect(surface).toContainText("97 sampled MERRA-2 grid points, not a continuous global raster");
  await expect(surface).toContainText("Latest available daily model record");
  await page.getByRole("button", { name: "Roots", exact: true }).click();
  await expect(page.getByRole("region", { name: "Root-Zone Moisture model-point map" })).toBeVisible();
  await page.getByRole("button", { name: "Mismatch", exact: true }).click();
  const mismatch = page.getByRole("region", { name: "Surface–Root Mismatch model-point map" });
  await expect(mismatch).toBeVisible();
  await expect(mismatch.locator(".moisture-atlas-count")).toContainText("screen-positive");
  await page.getByRole("button", { name: "Historical 1981–2025" }).click();
  await expect(mismatch.getByText("Historical month:")).toBeVisible();
  const scrub = mismatch.getByRole("slider");
  await scrub.fill("0");
  await expect(mismatch).toContainText("1981-01");
  await scrub.fill("539");
  await expect(mismatch).toContainText("2025-12");
  await mismatch.getByRole("combobox", { name: "Filter moisture map by region" }).selectOption("Middle East");
  await expect(mismatch.getByRole("button", { name: /Inspect Doha on Surface–Root Mismatch/i })).toBeVisible();
  await mismatch.getByRole("combobox", { name: "Choose a specific model location" }).selectOption("qatar_doha");
  await mismatch.getByRole("button", { name: /Inspect Doha on Surface–Root Mismatch/i }).focus();
  await mismatch.getByRole("button", { name: /Inspect Doha on Surface–Root Mismatch/i }).press("Enter");
  await expect(mismatch).toContainText("Doha · Qatar");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator(".geo-explorer")).toBeVisible();
  await page.getByRole("button", { name: "Earth", exact: true }).click();
  await expect(page.locator(".earth-stage")).toBeVisible();
});

test("five geographic modes remain selectable inside the guided research workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  const modes = page.getByRole("group", { name: "Map viewing mode" });
  for (const name of ["World map", "3D Earth", "Surface moisture", "Root-zone moisture", "Layer mismatch"]) {
    await expect(modes.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await modes.getByRole("button", { name: "Surface moisture" }).click();
  await expect(page.getByRole("region", { name: "Surface Moisture model-point map" })).toBeVisible();
  await modes.getByRole("button", { name: "Layer mismatch" }).click();
  await expect(page.getByRole("region", { name: "Surface–Root Mismatch model-point map" })).toBeVisible();
});


test("monthly graph selection explains paired wetness and real precipitation; annual bar selection explains the year", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  const interpretation = page.getByRole("region", { name: "Explanation of selected monthly graph reading" });
  await expect(interpretation).toBeVisible();
  await expect(interpretation).toContainText("Surface");
  await expect(interpretation).toContainText("Root zone");
  await expect(interpretation).toContainText("Rainfall");
  const slider = page.getByRole("slider", { name: "Select month in historical soil record" });
  await slider.focus();
  await slider.press("Home");
  await expect(interpretation).toContainText("1981-01");
  await slider.press("End");
  await expect(interpretation).toContainText("2025-12");
  await page.locator(".moisture-chart").click({ position: { x: 210, y: 112 } });
  await expect(interpretation).not.toContainText("2025-12");
  await page.getByRole("button", { name: /The takeaway/i }).click();
  await page.getByText("Explore advanced graphs").click();
  const annual = page.getByRole("region", { name: "Explanation of selected annual bar" });
  await expect(annual).toBeVisible();
  await annual.getByRole("combobox", { name: "Inspect annual mismatch year" }).selectOption("2000");
  await expect(annual).toContainText("In 2000");
  await expect(annual).toContainText("Mismatch days");
});

test("globe selection caption shows the actual location name and country", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".earth-rail-selected small")).toContainText("GOODWELL · UNITED STATES");
  await page.locator(".earth-location-strip button").filter({ hasText: "Narrabri" }).click();
  await expect(page.locator(".earth-rail-selected small")).toContainText("NARRABRI · AUSTRALIA");
  await expect(page.locator(".earth-rail-selected strong")).toHaveText("Narrabri");
});

test("Get Summary produces audited location-specific figures, interactive graphs and evidence download", async ({ page }) => {
  const doha = JSON.parse(readFileSync(new URL("../public/site-results/qatar_doha.json", import.meta.url), "utf8"));
  await page.route("**/api/analyze?**", async route => {
    const id = new URL(route.request().url()).searchParams.get("site");
    if (id === "qatar_doha") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(doha) });
      return;
    }
    await route.fallback();
  });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Get Summary" }).click();
  await expect(page.getByRole("heading", { name: "Get Summary." })).toBeVisible();
  const report = page.getByRole("region", { name: "Generated research summary for selected location" });
  await expect(report.locator(".summary-location-title h2")).toHaveText("Goodwell");
  await expect(report.locator(".summary-facts>div").first()).toContainText("31");
  await expect(report.locator(".summary-facts>div").nth(1)).toContainText("19");
  await expect(report.getByRole("region", { name: "Explanation of selected monthly graph reading" })).toBeVisible();
  await expect(report.getByRole("region", { name: "Explanation of selected annual bar" })).toBeVisible();
  await report.getByRole("combobox", { name: "Summary study location" }).selectOption("qatar_doha");
  await expect(report.locator(".summary-location-title h2")).toHaveText("Doha");
  await expect(report.locator(".summary-facts>div").first()).toContainText(String(doha.events.length));
  await expect(report.locator(".summary-facts>div").nth(1)).toContainText(String(doha.events.filter((item: { status: string }) => item.status === "COMPLETE_SURFACE_FIRST").length));
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    report.getByRole("button", { name: "Download summary + data" }).click()
  ]);
  expect(file.suggestedFilename()).toBe("rootshadow-qatar_doha-summary.json");
});

test("science methodology is legible, transparent and shows verified research protocol", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "The science" }).click();
  await expect(page.getByRole("heading", { name: /How we see beneath/i })).toBeVisible();
  await expect(page.locator(".method-card")).toHaveCount(6);
  const protocol = page.getByRole("region", { name: "Reproducible screening protocol" });
  await expect(protocol).toBeVisible();
  await expect(protocol).toContainText("97");
  await expect(protocol).toContainText("1991–2020");
  await expect(protocol).toContainText("≤ 20th percentile");
  await expect(protocol).toContainText("≥ 40th percentile");
  await expect(protocol).toContainText("Seven consecutive days");
  await expect(protocol).toContainText("independent SMAP, GLDAS and field cross-validation");
  await expect(protocol.getByRole("link", { name: /Review recovery-detection source/i })).toHaveAttribute("href", /api\/rootshadow\/recovery\.py/);
  const contrast = await page.locator(".method-card").first().evaluate(card => {
    const heading = card.querySelector("h3");
    if (!heading) return 0;
    const rgb = (value: string) => (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const luminance = (value: string) => {
      const [r,g,b] = rgb(value).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return r * 0.2126 + g * 0.7152 + b * 0.0722;
    };
    const foreground = luminance(getComputedStyle(heading).color);
    const background = luminance(getComputedStyle(card).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThan(7);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
