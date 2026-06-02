import { describe, expect, it } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:4321";

describe("R4 auth bypass — unauthenticated requests are redirected", () => {
  it("R4: GET /dashboard bez cookie → redirect /auth/signin", async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
    expect(res.status).toBeGreaterThanOrEqual(301);
    expect(res.status).toBeLessThanOrEqual(302);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("R4: GET /trips/new bez cookie → redirect /auth/signin", async () => {
    const res = await fetch(`${BASE_URL}/trips/new`, { redirect: "manual" });
    expect(res.status).toBeGreaterThanOrEqual(301);
    expect(res.status).toBeLessThanOrEqual(302);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("R4: GET /profile bez cookie → redirect /auth/signin", async () => {
    const res = await fetch(`${BASE_URL}/profile`, { redirect: "manual" });
    expect(res.status).toBeGreaterThanOrEqual(301);
    expect(res.status).toBeLessThanOrEqual(302);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });
});
