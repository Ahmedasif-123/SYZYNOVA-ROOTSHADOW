import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function openDesk(page: Page) {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1400) < 600) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Decision Desk" }).first().click();
}

test.beforeEach(async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/**", route => route.abort());
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
});

test("decision desk uses the 97 source-dated NASA model locations and avoids forecast claims", async ({ page }) => {
  await openDesk(page);
  await expect(page.getByRole("heading", { name: /Know where to/i })).toBeVisible();
  await expect(page.locator(".desk-point")).toHaveCount(97);
  await expect(page.getByText("Screening, not a forecast")).toBeVisible();
  await expect(page.locator(".desk-observation")).toContainText("2026-11-12");
  await expect(page.locator(".desk-method")).toContainText("No interpolation");
});

test("selected sites switch both source readings and historical context without invented figures", async ({ page }) => {
  await openDesk(page);
  await expect(page.locator(".desk-point")).toHaveCount(97);
  await page.getByRole("textbox", { name: "Search study locations" }).fill("Doha");
  await expect(page.locator(".desk-point")).toHaveCount(1);
  await page.locator(".desk-point").click();
  await expect(page.locator(".desk-detail-head h2")).toHaveText("Doha");
  await expect(page.locator(".desk-readings")).toContainText("76.1th");
  await expect(page.locator(".desk-readings")).toContainText("0.0th");
  await expect(page.locator(".desk-history-grid")).toBeVisible();
  await expect(page.locator(".desk-interpretation")).toContainText("model");
  await page.getByRole("button", { name: "Agricultural engineer" }).click();
  await expect(page.locator(".desk-actions ol")).toContainText("irrigation");
});

test("screening evidence export includes real observations, provenance and limitations", async ({ page }) => {
  await openDesk(page);
  await page.getByRole("textbox", { name: "Search study locations" }).fill("Doha");
  await page.locator(".desk-point").click();
  const action = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download screening evidence" }).click();
  const file = await action;
  expect(file.suggestedFilename()).toBe("rootshadow-screening-qatar_doha.json");
  const record = JSON.parse(readFileSync(await file.path(), "utf8"));
  expect(record.point.id).toBe("qatar_doha");
  expect(record.screening.surface_percentile).toBe(76.1);
  expect(record.screening.root_percentile).toBe(0);
  expect(record.recent_45_day_model_series.length).toBeGreaterThan(30);
  expect(record.source.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(record.scientific_status).toContain("Unvalidated");
});

test("decision desk stays navigable and avoids horizontal overflow on mobile", async ({ page }) => {
  await page.goto("/");
  const mobile = page.viewportSize()?.width && page.viewportSize()!.width < 600;
  if (mobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Decision Desk" }).first().click();
  await expect(page.getByRole("heading", { name: /Know where to/i })).toBeVisible();
  await expect(page.locator(".desk-point")).toHaveCount(97);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
