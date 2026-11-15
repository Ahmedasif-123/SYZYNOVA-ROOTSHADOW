import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

async function openLab(page: import("@playwright/test").Page) {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1440) < 600) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Validation Lab" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
});

test("field-grounded ML shows honest three-model held-out results", async ({ page }) => {
  await openLab(page);
  const lab = page.getByRole("region", { name: "Independent ground-trained machine learning evaluation" });
  await expect(lab).toBeVisible();
  await expect(lab).toContainText("Complexity did not win.");
  await expect(lab).toContainText("10,033");
  await expect(lab).toContainText("2,271");
  await expect(lab).toContainText("4,779");
  await expect(lab).toContainText("0.742");
  await expect(lab.locator(".mle-table-scroll tbody tr")).toHaveCount(3);
  await expect(lab).toContainText("no future");
});

test("full ML report export preserves the validation-chosen model and real scores", async ({ page }) => {
  await openLab(page);
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download complete ML evaluation" }).click();
  const file = await promise;
  expect(file.suggestedFilename()).toBe("rootshadow-noaa-ground-truth-ai-evaluation.json");
  const report = JSON.parse(readFileSync(await file.path(), "utf8"));
  expect(report.station_count).toBe(4);
  expect(report.evaluation.selected_model).toBe("model_root_only_logistic");
  expect(report.evaluation.ground_calibration_demonstrated).toBe(false);
  expect(report.evaluation.test.model_root_only_logistic.roc_auc).toBe(0.74224);
  expect(report.evaluation.splits.test.rows).toBe(4779);
});

test("ground-calibration research section fits mobile without page overflow", async ({ page }) => {
  await openLab(page);
  await expect(page.locator(".mle-panel")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
