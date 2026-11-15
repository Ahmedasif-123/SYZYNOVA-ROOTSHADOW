import { test, expect, type Page } from "@playwright/test";

async function openProbe(page: Page) {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1400) < 600) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Decision Desk" }).first().click();
  await expect(page.locator(".probe-card")).toBeVisible();
}
async function fillProbe(page: Page, v: {
  before30: number; before60: number; after30: number; after60: number;
  threshold30?: number; threshold60?: number; tolerance?: number
}) {
  const values = {
    before30: v.before30, before60: v.before60, after30: v.after30, after60: v.after60,
    threshold30: v.threshold30 ?? 20, threshold60: v.threshold60 ?? 20,
    tolerance: v.tolerance ?? 1
  };
  for (const [name, value] of Object.entries(values)) {
    const field = name.startsWith("before") ? "before rain" : name.startsWith("after") ? "after rain" : name.startsWith("threshold") ? "locally established minimum" : "uncertainty";
    if (name === "tolerance") await page.getByPlaceholder("Enter sensor tolerance").fill(String(value));
    else await page.getByRole("spinbutton", { name: (name.endsWith("30") ? "30 cm / shallower root zone" : "60 cm / deeper root zone") + " " + field }).fill(String(value));
  }
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-15T06:00:00Z"));
  await page.route("https://raw.githubusercontent.com/**", route => route.abort());
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
});
test("no probe values means no field verdict and AI cannot be invoked", async ({ page }) => {
  await openProbe(page);
  await expect(page.locator(".probe-result h4")).toHaveText("Insufficient measurements");
  await expect(page.getByRole("button", { name: "Explain with AI" })).toBeDisabled();
  await expect(page.locator(".probe-measure-chart")).toHaveCount(0);
});
test("not recovered below lower margin; exact lower margin abstains", async ({ page }) => {
  await openProbe(page);
  await fillProbe(page, { before30: 10, before60: 10, after30: 18.9, after60: 28 });
  await expect(page.locator(".probe-result h4")).toContainText("Not recovered");
  await expect(page.locator(".probe-measure-chart")).toBeVisible();
  await page.getByRole("spinbutton", { name: "30 cm / shallower root zone after rain" }).fill("19");
  await expect(page.locator(".probe-result h4")).toContainText("Unclear");
});
test("exact upper measurement boundary abstains; above both supports sampled-depth recovery", async ({ page }) => {
  await openProbe(page);
  await fillProbe(page, { before30: 10, before60: 10, after30: 21, after60: 24 });
  await expect(page.locator(".probe-result h4")).toContainText("Unclear");
  await page.getByRole("spinbutton", { name: "30 cm / shallower root zone after rain" }).fill("22");
  await expect(page.locator(".probe-result h4")).toContainText("Measured recovery");
  await expect(page.locator(".probe-result")).toContainText("not across the entire field");
});
test("well-watered before and after is not confused with uncertain recovery", async ({ page }) => {
  await openProbe(page);
  await fillProbe(page, { before30: 29, before60: 30, after30: 29.5, after60: 31 });
  await expect(page.locator(".probe-result h4")).toHaveText("Already adequate at both measured depths");
  await expect(page.locator(".probe-model-comparison")).toContainText("spatial scales");
});
test("missing or invalid thresholds do not produce a verdict", async ({ page }) => {
  await openProbe(page);
  await fillProbe(page, { before30: 5, before60: 5, after30: 35, after60: 35, tolerance: 0 });
  await expect(page.locator(".probe-result h4")).toHaveText("Insufficient measurements");
  await page.getByPlaceholder("Enter sensor tolerance").fill("1");
  await page.getByRole("spinbutton", { name: "30 cm / shallower root zone locally established minimum" }).fill("0");
  await expect(page.locator(".probe-result h4")).toHaveText("Insufficient measurements");
});
test("AI is optional and cannot change the deterministic status", async ({ page }) => {
  await page.route("**/api/probe-explain", async route => {
    const request = route.request().postDataJSON();
    expect(request.measurements.after30).toBe("30");
    expect(request.measurements.after60).toBe("31");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      status: "explained", model: "gpt-6-luna", authoritative_verdict: "recovered",
      explanation: "Both entered depths increased.", next_checks: ["Verify the calibrated instrument.", "Consult the farm adviser."],
      scientific_limit: "No irrigation quantities are supported.", provenance: "User-entered inputs only", confidence: "not_calibrated"
    }) });
  });
  await openProbe(page);
  await fillProbe(page, { before30: 12, before60: 11, after30: 30, after60: 31 });
  await page.getByRole("button", { name: "Explain with AI" }).click();
  await expect(page.locator(".probe-ai-answer")).toContainText("Both entered depths increased.");
  await expect(page.locator(".probe-result h4")).toContainText("Measured recovery");
  await page.getByRole("spinbutton", { name: "30 cm / shallower root zone after rain" }).fill("10");
  await expect(page.locator(".probe-ai-answer")).toHaveCount(0);
  await expect(page.locator(".probe-result h4")).toContainText("Not recovered");
});
test("field records save only after explicit opt-in and can be erased", async ({ page }) => {
  await openProbe(page);
  await fillProbe(page, { before30: 27, before60: 29, after30: 28, after60: 30 });
  await page.getByRole("button", { name: "Save privately on this device" }).click();
  await expect(page.getByRole("list", { name: "Locally saved field readings" })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("rootshadow-probe-records-v1"));
  expect(stored).toContain("us_sgp_goodwell");
  await page.getByRole("button", { name: /Erase local history/ }).click();
  expect(await page.evaluate(() => localStorage.getItem("rootshadow-probe-records-v1"))).toBeNull();
});
test("mobile probe chart remains readable with no page overflow", async ({ page }) => {
  await openProbe(page);
  await fillProbe(page, { before30: 10, before60: 10, after30: 25, after60: 27 });
  await expect(page.locator(".probe-measure-chart")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
});
