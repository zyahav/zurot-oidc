import { expect, test } from "@playwright/test";

const BASE_URL = process.env.ZUROT_BASE_URL || "http://localhost:3000";

test("Tzura creator is gated outside the QA bridge", async ({ page }) => {
  await page.goto(`${BASE_URL}/tzura/create`, { waitUntil: "networkidle" });

  await expect(page.getByLabel("Live Tzura draft preview")).toHaveCount(0);
  await expect(page.getByText("QA profile")).toHaveCount(0);
});

test("Tzura creator updates live draft, publishes frozen artifact, and remixes by copy", async ({ page }) => {
  await page.goto(`${BASE_URL}/tzura/create?qaProfile=playwright`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Voice-to-Tzura Creator" })).toBeVisible();
  await expect(page.getByText("QA profile")).toBeVisible();
  await expect(page.getByLabel("Live Tzura draft preview")).toContainText("Star Hopper");

  await page.getByLabel("Typed voice instruction").fill("Make it an ocean game where I am a fish and collect 7 pearls, but avoid sharks.");
  await page.getByRole("button", { name: "Update Live Game" }).click();

  await expect(page.getByRole("status")).toContainText("theme set to ocean");
  await expect(page.getByLabel("Live Tzura draft preview")).toContainText("fish");
  await expect(page.getByLabel("Live Tzura draft preview")).toContainText("7 pearls");
  await expect(page.getByLabel("Live Tzura draft preview")).toContainText("sharks");

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("status")).toContainText("frozen Tzura artifact");
  await expect(page.getByLabel("Published Tzura player")).toContainText("fish");

  await page.getByLabel("Typed voice instruction").fill("Make it a city game where I am a car and collect 3 coins, avoid cones.");
  await page.getByRole("button", { name: "Update Live Game" }).click();
  await expect(page.getByLabel("Live Tzura draft preview")).toContainText("car");
  await expect(page.getByLabel("Published Tzura player")).toContainText("fish");

  await page.getByRole("button", { name: "Remix Frozen" }).click();
  await expect(page.getByRole("status")).toContainText("new editable draft copy");
  await expect(page.getByLabel("Live Tzura draft preview")).toContainText("fish");
  await expect(page.getByLabel("Live Tzura draft preview")).toContainText("Remix");
});
