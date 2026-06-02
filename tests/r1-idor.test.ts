import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { signIn } from "./helpers/auth";
import { http } from "./helpers/http";
import { createTestUser, deleteTestUser } from "./helpers/supabase-admin";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";

function adminClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("R1 IDOR — user B cannot access user A resources", () => {
  let userAId: string;
  let userBId: string;
  let tripAId: string;
  let itemAId: string;
  let cookiesA: string;
  let cookiesB: string;

  beforeAll(async () => {
    const ts = Date.now();
    const emailA = `test-idor-a-${ts}@test.invalid`;
    const emailB = `test-idor-b-${ts}@test.invalid`;
    const password = "Password123!";

    const userA = await createTestUser(emailA, password);
    const userB = await createTestUser(emailB, password);
    userAId = userA.id;
    userBId = userB.id;

    cookiesA = await signIn(emailA, password);
    cookiesB = await signIn(emailB, password);

    // No POST /api/trips endpoint — insert directly via admin client
    const db = adminClient();
    const { data: trip, error: tripError } = await db
      .from("trips")
      .insert({
        user_id: userAId,
        title: "IDOR test trip",
        start_date: "2026-12-01",
        accommodation_type: "tent",
        riding_philosophy: "fastlight",
        region: "Alps",
        trip_duration_days: 7,
        flew_by_plane: false,
      })
      .select("id")
      .single();
    if (tripError) throw new Error(`Failed to create test trip: ${tripError.message}`);
    tripAId = trip.id;

    // Create a checklist item for user A via the API (exercises POST /api/trips/:id/items)
    const itemRes = await http.post(
      `/api/trips/${tripAId}/items`,
      { name: "IDOR test item", category: "gear" },
      { cookies: cookiesA },
    );
    if (itemRes.status !== 201) {
      throw new Error(`Failed to create test item: HTTP ${itemRes.status}`);
    }
    const item = (await itemRes.json()) as { id: string };
    itemAId = item.id;
  });

  afterAll(async () => {
    const db = adminClient();
    // Delete trip explicitly (no FK cascade from auth.users → trips)
    if (tripAId) await db.from("trips").delete().eq("id", tripAId);
    if (userAId) await deleteTestUser(userAId);
    if (userBId) await deleteTestUser(userBId);
  });

  it("T1: DELETE /api/trips/:id as user B → 404; trip still exists for user A", async () => {
    const res = await http.delete(`/api/trips/${tripAId}`, { cookies: cookiesB });
    expect(res.status).toBe(404);

    // Trip must still exist — user A can still count items
    const verify = await http.get(`/api/trips/${tripAId}/items-count`, { cookies: cookiesA });
    expect(verify.status).toBe(200);
  });

  it("T2: POST /api/trips/:id/items as user B → 404", async () => {
    const res = await http.post(
      `/api/trips/${tripAId}/items`,
      { name: "Injected item", category: "gear" },
      { cookies: cookiesB },
    );
    expect(res.status).toBe(404);
  });

  it("T3: PATCH /api/trips/:id/items/:itemId as user B → 404", async () => {
    const res = await http.patch(`/api/trips/${tripAId}/items/${itemAId}`, { is_packed: true }, { cookies: cookiesB });
    expect(res.status).toBe(404);
  });

  it("T4: DELETE /api/trips/:id/items/:itemId as user B → 404", async () => {
    const res = await http.delete(`/api/trips/${tripAId}/items/${itemAId}`, { cookies: cookiesB });
    expect(res.status).toBe(404);
  });

  it("T5: GET /api/trips/:id/items-count as user B → 404", async () => {
    const res = await http.get(`/api/trips/${tripAId}/items-count`, { cookies: cookiesB });
    expect(res.status).toBe(404);
  });

  it("T6: PATCH /api/trips/:id/rating as user B → 404", async () => {
    const res = await http.patch(`/api/trips/${tripAId}/rating`, { pre_trip_rating: 5 }, { cookies: cookiesB });
    expect(res.status).toBe(404);
  });
});
