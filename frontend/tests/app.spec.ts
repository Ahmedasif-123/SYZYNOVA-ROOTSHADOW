import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const goodwell = JSON.parse(readFileSync(new URL("./fixtures/goodwell.json", import.meta.url), "utf8"));
const narrabri = JSON.parse(readFileSync(new URL("./fixtures/narrabri.json", import.meta.url), "utf8"));
const argentina = JSON.parse(readFileSync(new URL("./fixtures/argentina.json", import.meta.url), "utf8"));
const southernAfrica = JSON.parse(readFileSync(new URL("./fixtures/southern_africa.json", import.meta.url), "utf8"));

const responses: Record<string, unknown> = {
  us_sgp_goodwell: goodwell,
  australia_narrabri: narrabri,
  argentina_pampas: argentina,
  southern_africa: southernAfrica
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
  await expect(page.getByRole("heading", { name: /When rain returns/i })).toBeVisible();
  await expect(page.getByText(/SIX VERIFIED RESEARCH POINTS/i)).toBeVisible();
  await expect(page.getByText(/NO SYNTHETIC FINDINGS/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true });
});

test("verified Goodwell data drives farmer-facing metrics and recovery selection", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.locator(".metric-value").nth(0)).toHaveText("31");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("19");
  await expect(page.locator(".metric-value").nth(2)).toHaveText("2 d");
  await expect(page.getByText("NASA POWER · HISTORICAL MODEL", { exact: true })).toBeVisible();
  await page.locator(".event-row").first().click();
  await expect(page.locator(".event-inspector")).toBeVisible();
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
  await page.getByRole("button", { name: "Scientific view" }).click();
  await expect(page.locator(".echart")).toHaveCount(3);
  await expect(page.locator(".evidence-check")).toHaveCount(goodwell.audit.checks.length);
  await expect(page.getByText(/not establish an independently confirmed climatic trend/i)).toBeVisible();
  await page.locator(".compare-select select").selectOption("australia_narrabri");
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
  await expect(page.locator(".site-story h2")).toContainText("Narrabri");
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
  await expect(page.locator(".map-site-list .map-site")).toHaveCount(6);
  await page.locator(".map-site-list .map-site").filter({ hasText: "Goodwell" }).click();
  await expect(page.getByRole("button", { name: "Start investigating" })).toBeVisible();
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.getByRole("heading", { name: "Explore soil recovery" })).toBeVisible();
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


test("additional NASA locations expose distinct audited results and threshold limitations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start investigating" }).click();
  await page.locator("#site-select").selectOption("argentina_pampas");
  await expect(page.locator(".metric-value").first()).toHaveText("27");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("11");
  await expect(page.locator(".rs-conclusion-lead")).toContainText("2 days");
  await page.locator("#site-select").selectOption("southern_africa");
  await expect(page.locator(".metric-value").first()).toHaveText("21");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("15");
  await expect(page.locator(".rs-conclusion-lead")).toContainText("25 days");
  await expect(page.getByText(/the median positive delay is 25 days under the default/)).toBeVisible();
  await expect(page.getByText(/3.5 days under a 50th-percentile definition/)).toBeVisible();
});
