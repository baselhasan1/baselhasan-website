import { expect, test } from "@playwright/test";

async function enterSite(page) {
  await page.goto("/");
  await expect(page.getByRole("region", { name: /interactive map/i })).toBeVisible({
    timeout: 5000,
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/ubahn?**", async (route) => {
    const url = new URL(route.request().url());
    const refs = (url.searchParams.get("lines") || "").split(",").filter(Boolean);
    await route.fulfill({
      json: { lines: Object.fromEntries(refs.map((ref) => [ref, []])), errors: {} },
    });
  });
});

test("frames Bahrain and navigates through German map chapters", async ({ page }) => {
  await enterSite(page);
  await expect(page.getByRole("button", { name: "Bahrain", exact: true })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Germany", exact: true }).click();
  await expect(page.getByRole("button", { name: "Germany", exact: true })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Berlin", exact: true }).click();
  await expect(page.getByText(/connecting to bvg/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "U1", exact: true })).toBeVisible();
  await expect(page.getByText(/0 trains running/i)).toBeVisible();

  await page.getByRole("button", { name: "Frankfurt", exact: true }).click();
  await expect(page.getByText("Frankfurt", { exact: true }).last()).toBeVisible();
});

test("secondary panels are accessible and cover the live map", async ({ page }) => {
  await enterSite(page);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Resume" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Close Resume" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("falls back when satellite tiles repeatedly fail", async ({ page }) => {
  await page.route(/arcgisonline\.com/i, (route) => route.abort());
  await enterSite(page);
  await expect(page.getByRole("button", { name: /satellite imagery unavailable/i })).toBeVisible({
    timeout: 10000,
  });
});

test("falls back to BVG directly when the serverless proxy is unavailable", async ({ page }) => {
  await page.route("**/api/ubahn?**", (route) =>
    route.fulfill({ status: 404, contentType: "text/html", body: "Not found" })
  );
  await page.route("https://v6.bvg.transport.rest/trips?**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ trips: [] }) })
  );

  await enterSite(page);
  await page.getByRole("button", { name: "Germany", exact: true }).click();
  await page.getByRole("button", { name: "Berlin", exact: true }).click();
  await expect(page.getByText(/0 trains running/i)).toBeVisible();
});
