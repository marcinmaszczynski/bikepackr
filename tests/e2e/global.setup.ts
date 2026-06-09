import { test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.resolve("tests/e2e/.auth/test-user.json");

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";

setup("create E2E test user", async () => {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("TEST_SUPABASE_SERVICE_ROLE_KEY is not set. Run `supabase status` to get the service_role key.");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `e2e-test-${Date.now()}@test.local`;
  const password = "E2eTestPassword123!";

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create E2E test user: ${error.message}`);
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ email, password, userId: data.user.id }));
});
