const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:4321";

export async function signIn(email: string, password: string): Promise<string> {
  const form = new FormData();
  form.append("email", email);
  form.append("password", password);

  const response = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    body: form,
    redirect: "manual",
  });

  // On success the endpoint redirects to "/"; on error to "/auth/signin?error=..."
  const location = response.headers.get("location") ?? "";
  if (location.includes("error=")) {
    const url = new URL(location, BASE_URL);
    const msg = url.searchParams.get("error") ?? "unknown sign-in error";
    throw new Error(`signIn failed for ${email}: ${msg}`);
  }

  // Collect Set-Cookie headers and extract name=value pairs
  const rawCookies: string[] = [];
  // Node 18+ Headers.getSetCookie() returns an array
  if (typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function") {
    rawCookies.push(...(response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie());
  } else {
    // Fallback for older runtimes: the header may be a single comma-joined string
    const raw = response.headers.get("set-cookie");
    if (raw) rawCookies.push(raw);
  }

  const cookiePairs = rawCookies.map((c) => c.split(";")[0].trim());

  if (cookiePairs.length === 0) {
    throw new Error(
      `signIn for ${email} returned no cookies. ` +
        "The sign-in endpoint may have failed silently or the dev server is not running.",
    );
  }

  return cookiePairs.join("; ");
}
