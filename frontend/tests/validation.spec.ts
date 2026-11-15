import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function navigateToValidation(page: Page) {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1440) < 600) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Validation Lab" }).first().click();
}

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
});

test("NOAA validation opens with four source-grounded station selectors", async ({ page }) => {
  await navigateToValidation(page);
  await expect(page.getByRole("heading", { name: /What has actually/i })).toBeVisible();
  await expect(page.getByText("Not ready for field decisions")).toBeVisible();
  const stations = page.getByRole("group", { name: "NOAA station" });
  await expect(stations.getByRole("button")).toHaveCount(4);
  await expect(page.locator(".vld-readouts")).toContainText("0.743");
  await expect(page.locator(".vld-readouts")).toContainText("8.8%");
  await expect(page.locator(".vld-readouts")).toContainText("1,307");
  await expect(page.locator(".vld-protocol")).toContainText("2013-2021");
  await expect(page.locator(".vld-protocol")).toContainText("2022-2025");
});

test("each NOAA station updates complete performance evidence and coverage warning", async ({ page }) => {
  await navigateToValidation(page);
  const stations = page.getByRole("group", { name: "NOAA station" });
  await stations.getByRole("button", { name: /Stillwater 5 WNW/i }).click();
  await expect(page.locator(".vld-readouts")).toContainText("0.426");
  await expect(page.locator(".vld-readouts")).toContainText("6.7%");
  await expect(page.locator(".vld-readouts")).toContainText("1,451");
  await stations.getByRole("button", { name: /Stillwater 2 W/i }).click();
  await expect(page.locator(".vld-readouts")).toContainText("588");
  await expect(page.locator(".vld-callout")).toContainText("Limited evaluation coverage");
});

test("complete NOAA provenance downloads without altering published measurements", async ({ page }) => {
  await navigateToValidation(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download complete ground-validation record" }).click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toBe("rootshadow-independent-noaa-validation-pilot.json");
  const report = JSON.parse(readFileSync(await file.path(), "utf8"));
  expect(report.status).toBe("INDEPENDENT_IN_SITU_PILOT_NOT_GENERAL_VALIDATION");
  expect(report.stations_evaluated).toBe(4);
  expect(report.stations[0].station).toBe("OK_Goodwell_2_E");
  expect(report.stations[0].holdout_paired_days).toBe(1307);
  expect(report.stations[0].predictors.model_mismatch_vs_probe_mismatch.recall).toBe(0.0882);
  expect(report.stations[0].noaa_source_records.length).toBeGreaterThan(8);
});

test("validation lab fits desktop and mobile without horizontal page overflow", async ({ page }) => {
  await navigateToValidation(page);
  await expect(page.locator(".vld-card")).toHaveCount(2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
