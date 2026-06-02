import { describe, it, expect } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:4321";

describe("smoke — dev server is reachable", () => {
  it("GET / returns 200", async () => {
    let response: Response;
    try {
      response = await fetch(BASE_URL);
    } catch (e) {
      throw new Error(
        `Cannot reach dev server at ${BASE_URL}. ` + "Run `npm run dev` before running tests.\n" + String(e),
      );
    }
    expect(response.status).toBe(200);
  });

  it("GET /auth/signin returns 200", async () => {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/auth/signin`);
    } catch (e) {
      throw new Error(
        `Cannot reach dev server at ${BASE_URL}. ` + "Run `npm run dev` before running tests.\n" + String(e),
      );
    }
    expect(response.status).toBe(200);
  });
});
