import { test, expect, type Page } from "@playwright/test";

async function openAI(page: Page) {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1440) < 600) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Evidence AI" }).click();
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/ask", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        enabled: true, model: "gpt-6-astra", access: "public", requires_access_code: false
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      status: "answered", model: "gpt-6-astra",
      answer: "NOAA probes found missed mismatches. NASA model screening is not field-level irrigation advice.",
      conclusion: "pilot_ground_evidence", evidence_refs: ["NASA_HISTORY", "NOAA_PILOT"],
      uncertainties: ["Field-scale suitability is unverified."],
      sources: [
        { id: "NASA_HISTORY", label: "NASA historical model analysis", url: "https://rootshadow-frontend-preview.vercel.app/site-results/us_sgp_goodwell.json" },
        { id: "NOAA_PILOT", label: "NOAA probe pilot", url: "https://rootshadow-frontend-preview.vercel.app/validation/noaa-pilot.json" }
      ],
      usage: { input_tokens: 2000, output_tokens: 500, estimated_max_standard_cost_usd: 0.045 }
    }) });
  });
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("https://fonts.gstatic.com/**", route => route.abort());
});

test("Evidence AI sends source-bounded public request without access code", async ({ page }) => {
  await openAI(page);
  await expect(page.getByRole("heading", { name: /Ask ROOTSHADOW/i })).toBeVisible();
  await expect(page.getByText("Public access · Ask a research question")).toBeVisible();
  const wait = page.waitForRequest(req => req.url().endsWith("/api/ask") && req.method() === "POST");
  await page.getByRole("button", { name: "Analyze evidence" }).click();
  const posted = (await wait).postDataJSON();
  expect(posted.siteId).toBe("us_sgp_goodwell");
  expect(posted.perspective).toBe("scientist");
  expect(posted.accessCode).toBeUndefined();
  await expect(page.locator(".eai-answer")).toContainText("NOAA probes");
  await expect(page.locator(".eai-sources a")).toHaveCount(2);
  await expect(page.locator(".eai-usage")).toContainText("USD 0.0450");
});
test("changing location and perspective updates the evidence request", async ({ page }) => {
  await openAI(page);
  await page.getByRole("combobox", { name: "AI research location" }).selectOption("qatar_doha");
  await page.getByRole("button", { name: "Ministry" }).click();
  const wait = page.waitForRequest(req => req.url().endsWith("/api/ask") && req.method() === "POST");
  await page.getByRole("button", { name: "Analyze evidence" }).click();
  const posted = (await wait).postDataJSON();
  expect(posted.siteId).toBe("qatar_doha");
  expect(posted.perspective).toBe("ministry");
});
test("AI is disabled when the server does not have credentials", async ({ page }) => {
  await page.unroute("**/api/ask");
  await page.route("**/api/ask", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ enabled: false, model: "gpt-6-astra" })
  }));
  await openAI(page);
  await expect(page.getByRole("button", { name: "Analyze evidence" })).toBeDisabled();
  await expect(page.getByText(/check OPENAI_API_KEY in Vercel/i)).toBeVisible();
});
test("Evidence AI remains usable on mobile", async ({ page }) => {
  await openAI(page);
  await expect(page.getByRole("combobox", { name: "AI research location" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
});
