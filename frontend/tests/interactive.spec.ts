import { test, expect, type Page } from "@playwright/test";

async function go(page: Page, name: "Decision Desk" | "Validation Lab") {
  await page.clock.setFixedTime(new Date("2026-11-15T06:00:00Z"));
  await page.route("https://raw.githubusercontent.com/**", route => route.abort());
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1400) < 600) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name }).first().click();
}

test("scientific scenario controls recompute real daily data and preserve original published count", async ({ page }) => {
  await go(page, "Decision Desk");
  const sandbox = page.getByRole("region", { name: "Interactive scientific scenario explorer" });
  await expect(sandbox).toBeVisible();
  await expect(sandbox.locator(".desk-experiment-results strong").first()).toHaveText("13");
  await sandbox.getByRole("button", { name: "Single-day screen" }).click();
  await expect(sandbox.locator(".desk-experiment-results strong").first()).toHaveText("20");
  await expect(sandbox).toContainText("Exploratory what-if scenario");
  await sandbox.getByRole("button", { name: "Restore original rule" }).click();
  await expect(sandbox.locator(".desk-experiment-results strong").first()).toHaveText("13");
  await expect(sandbox).toContainText("Original seven-day screen");
});

test("changing selected site retains the scenario and updates local result", async ({ page }) => {
  await go(page, "Decision Desk");
  const sandbox = page.getByRole("region", { name: "Interactive scientific scenario explorer" });
  await sandbox.getByRole("button", { name: "Single-day screen" }).click();
  await page.getByRole("textbox", { name: "Search study locations" }).fill("Doha");
  await page.locator(".desk-point").click();
  const local = page.getByRole("region", { name: "Selected location what-if outcome" });
  await expect(local).toContainText("DOHA");
  await expect(local).toContainText("1 of 1 day");
  await sandbox.getByRole("slider", { name: "Surface rank minimum" }).focus();
  await sandbox.getByRole("slider", { name: "Surface rank minimum" }).press("ArrowRight");
  await expect(sandbox.getByRole("slider", { name: "Surface rank minimum" })).toHaveValue("45");
  await expect(local).toContainText("1 of 1 day");
});

test("validation explorer switches NOAA detectors, recomputing displayed confusion matrix but not evidence", async ({ page }) => {
  await go(page, "Validation Lab");
  const explorer = page.getByRole("region", { name: "Interactive validated detection performance explorer" });
  await expect(explorer).toContainText("Which method actually detects");
  await expect(explorer).toContainText("Recall: 8.8%");
  await explorer.getByRole("button", { name: "Model root-zone dryness" }).click();
  await expect(explorer).toContainText("Recall: 72.1%");
  await explorer.getByRole("button", { name: "Surface-only baseline" }).click();
  await expect(explorer).toContainText("Recall: 72.0%");
  await explorer.getByRole("button", { name: "Share of paired days" }).click();
  await expect(explorer.locator(".vld-confusion-cell strong").first()).toContainText("%");
  await explorer.getByRole("button", { name: "Reset comparison" }).click();
  await expect(explorer).toContainText("Recall: 8.8%");
});

test("validation monthly timeline uses only recorded NOAA paired months", async ({ page }) => {
  await go(page, "Validation Lab");
  const timeline = page.getByRole("region", { name: "Explore a recorded NOAA month" });
  await expect(timeline).toBeVisible();
  await expect(timeline).toContainText("2025");
  const slider = timeline.getByRole("slider", { name: "Select measured comparison month" });
  await slider.focus();
  await slider.press("Home");
  await expect(timeline).toContainText("2022");
  await expect(timeline.locator(".vld-month-results strong")).toHaveCount(3);
  await expect(timeline).toContainText("monthly bar difference cannot");
});

test("interactive analysis remains usable without sideways page overflow", async ({ page }) => {
  await go(page, "Decision Desk");
  await expect(page.getByRole("region", { name: "Interactive scientific scenario explorer" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  await go(page, "Validation Lab");
  await expect(page.getByRole("region", { name: "Interactive validated detection performance explorer" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
});
