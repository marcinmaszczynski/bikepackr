// Risk: R7 — user cannot complete: sign-in → context form → AI generation → checklist
// What proves protection: authenticated user fills form, streaming completes, URL /trips/[id],
//   ≥1 checklist listitem visible
// Must challenge: "API green" ≠ "Astro island hydrates + streaming UI in browser"
// Provenance: seed tests/e2e/seed.spec.ts; risk context/foundation/test-plan.md §2 R7

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.resolve("tests/e2e/.auth/test-user.json");

test.describe("R7: Critical path — sign-in → generation → checklist", () => {
  test("R7: sign-in → context form → AI generation → checklist visible at /trips/[id]", async ({
    page,
  }) => {
    // --- Setup: read test user credentials from global.setup.ts output ---
    const { email, password } = JSON.parse(
      fs.readFileSync(AUTH_FILE, "utf-8"),
    ) as { email: string; password: string; userId: string };

    let tripId: string | null = null;

    try {
      // --- Step: sign-in via UI (covers the "logowanie" step of R7) ---
      await page.goto("/auth/signin");
      // Wait for React hydration (client:load) before filling controlled inputs
      await page.waitForLoadState("networkidle");
      await page.getByRole("textbox", { name: "Email" }).fill(email);
      await page.getByRole("textbox", { name: "Password" }).fill(password);
      await page.getByRole("button", { name: /sign in/i }).click();

      // Wait for redirect away from the sign-in page
      await page.waitForURL((url) => !url.pathname.startsWith("/auth/"), {
        timeout: 15_000,
      });

      // --- Step: navigate to trip context form ---
      await page.goto("/trips/new");
      await expect(page).toHaveURL(/\/trips\/new/);

      // --- Step: fill required form fields ---
      await page.getByLabel(/Nocleg/).selectOption("tent");
      await page.getByLabel(/Filozofia jazdy/).selectOption("fast_and_light");
      await page.getByLabel(/Region/).fill("Tatry E2E");
      // Use a future date to avoid pre-trip/post-trip widget logic affecting test
      await page.getByLabel(/Data startu/).fill("2026-08-01");
      await page.getByLabel(/Czas trwania/).fill("3");

      // --- Step: submit form and wait for AI streaming + automatic navigation ---
      await page.getByRole("button", { name: /generuj checklistę/i }).click();

      // TripContextForm sets window.location.href after stream + items-count > 0
      // Must exclude /trips/new — that's the current page. Real trip IDs are UUIDs.
      // navigationTimeout in playwright.config.ts is 60_000 — AI streaming takes 20-40s
      await page.waitForURL(
        (url) => {
          const seg = url.pathname.match(/\/trips\/([^/]+)$/)?.[1];
          return !!seg && seg !== "new";
        },
        { timeout: 60_000 },
      );

      // Extract trip ID from URL for cleanup
      const urlMatch = page.url().match(/\/trips\/([^/?#]+)$/);
      if (urlMatch) {
        tripId = urlMatch[1];
      }

      // --- Step: assert checklist contains at least one item ---
      // ChecklistView renders items as <li> elements grouped by category
      await expect(page.getByRole("listitem").first()).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      // --- Cleanup: delete the created trip (regardless of test outcome) ---
      if (tripId) {
        await page.context().request.delete(`/api/trips/${tripId}`);
      }
    }
  });
});
