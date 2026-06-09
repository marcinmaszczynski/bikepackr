// seed: exemplar for E2E test patterns in Bikepackr
// Risk covered: sanity — protected routes redirect unauthenticated users
// Provenance: seed pattern; models getByRole, waitForURL, test isolation

import { test, expect } from "@playwright/test";

test.describe("Auth redirect (sanity seed)", () => {
  // Step: unauthenticated access to a protected route should redirect to sign-in
  test("protected /trips/new redirects unauthenticated user to /auth/signin", async ({ page }) => {
    await page.goto("/trips/new");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  // Step: sign-in page is reachable without auth
  test("sign-in page is accessible without authentication", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
