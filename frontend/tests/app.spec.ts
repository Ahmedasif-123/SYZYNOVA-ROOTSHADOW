import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const goodwell = JSON.parse(readFileSync(new URL("./fixtures/goodwell.json", import.meta.url), "utf8"));
const narrabri = JSON.parse(readFileSync(new URL("./fixtures/narrabri.json", import.meta.url), "utf8"));

const responses: Record<string, unknown> = {
  us_sgp_goodwell: goodwell,
  australia_narrabri: narrabri
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
  await expect(page.getByRole("heading", { name: /Rain returns/i })).toBeVisible();
  await expect(page.getByText("65,744", { exact: true })).toBeVisible();
  await expect(page.getByText(/No simulated results in this experience/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true });
});

test("verified Goodwell data drives farmer-facing metrics and recovery selection", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the evidence" }).click();
  await expect(page.locator(".metric-value").nth(0)).toHaveText("31");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("19");
  await expect(page.locator(".metric-value").nth(2)).toHaveText("2 d");
  await expect(page.getByText("NASA POWER / MERRA-2", { exact: true })).toBeVisible();
  await page.locator(".event-row").first().click();
  await expect(page.locator(".event-inspector")).toBeVisible();
  await expect(page.locator(".echart")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("investigation.png"), fullPage: true });
});

test("scientific workspace renders actual backend tests and comparisons", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the evidence" }).click();
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
  await page.getByRole("button", { name: "Explore the evidence" }).click();
  await expect(page.locator(".metric-value").first()).toHaveText("31");
  await page.locator("#site-select").selectOption("australia_narrabri");
  await expect(page.locator(".metric-value").first()).toHaveText("28");
  await expect(page.locator(".metric-value").nth(1)).toHaveText("16");
  await expect(page.locator(".site-story h2")).toContainText("Narrabri");
});

test("missing data produces an error rather than invented scientific numbers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the evidence" }).click();
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
  await expect(page.locator(".earth-location-strip button")).toHaveCount(4);
  const image = await page.request.get("/earth-day-2048.jpg");
  expect(image.ok()).toBeTruthy();
  const geojson = await page.request.get("/world.geojson");
  expect(geojson.ok()).toBeTruthy();
  expect((await geojson.json()).features.length).toBeGreaterThan(100);
  await page.getByRole("button", { name: "World map" }).click();
  await expect(page.locator(".geo-explorer")).toBeVisible();
  await expect(page.locator(".map-site-list .map-site")).toHaveCount(4);
  await page.locator(".map-site-list .map-site").filter({ hasText: "Goodwell" }).click();
  await expect(page.getByRole("button", { name: "Explore the evidence" })).toBeVisible();
  await page.getByRole("button", { name: "Explore the evidence" }).click();
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
  await expect(page.locator(".earth-location-strip button")).toHaveCount(4);
  await page.locator(".earth-location-strip button").filter({ hasText: "Narrabri" }).click();
  await page.getByRole("button", { name: "Explore the evidence" }).click();
  await expect(page.locator("#site-select")).toHaveValue("australia_narrabri");
  await expect(page.locator(".metric-value").first()).toHaveText("28");
});
