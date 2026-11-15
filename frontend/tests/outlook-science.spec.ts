import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-15T06:00:00Z"));
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
  await page.route("**/api/climate?**", route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Climate projection deliberately unavailable during the UI disclosure test" })
  }));
});

test("ML Outlook warns that holdout used observed weather and omits 20/30-year horizons", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1400) < 600) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "ML Outlook Lab" }).click();
  await expect(page.getByRole("heading", { name: "Exploratory soil-moisture scenarios." })).toBeVisible();
  await expect(page.locator(".forecast-validation-alert")).toContainText("BACKTEST USED OBSERVED WEATHER");
  await expect(page.locator(".forecast-validation-alert")).toContainText("2016–2025");
  await expect(page.locator(".forecast-validation-alert")).toContainText("20- and 30-year displays are withheld");
  const select = page.getByLabel("ILLUSTRATIVE WINDOW (NOT FORECAST SKILL)");
  await expect(select.locator("option")).toHaveCount(2);
  await expect(select.locator("option")).toHaveText(["5 years · 2026–2030","10 years · 2026–2035"]);
});
