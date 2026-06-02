import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "";

function adminClient() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("TEST_SUPABASE_SERVICE_ROLE_KEY is not set. Run `supabase status` to get the service_role key.");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestUser(email: string, password: string): Promise<{ id: string }> {
  const client = adminClient();
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Failed to create test user ${email}: ${error.message}`);
  }
  return { id: data.user.id };
}

export async function deleteTestUser(id: string): Promise<void> {
  const client = adminClient();
  const { error } = await client.auth.admin.deleteUser(id);
  if (error) {
    throw new Error(`Failed to delete test user ${id}: ${error.message}`);
  }
}
