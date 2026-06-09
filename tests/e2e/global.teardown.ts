import { test as teardown } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.resolve("tests/e2e/.auth/test-user.json");

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";

teardown("delete E2E test user", async () => {
  if (!fs.existsSync(AUTH_FILE)) {
    return;
  }

  const { userId } = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8")) as {
    userId: string;
  };

  if (SERVICE_ROLE_KEY && userId) {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await supabase.auth.admin.deleteUser(userId);
  }

  fs.rmSync(AUTH_FILE, { force: true });
});
