const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:4321";

interface RequestOpts {
  cookies?: string;
  redirect?: RequestRedirect;
}

function buildHeaders(opts?: RequestOpts): Record<string, string> {
  const headers: Record<string, string> = { Origin: BASE_URL };
  if (opts?.cookies) headers.Cookie = opts.cookies;
  return headers;
}

export const http = {
  get(path: string, opts?: RequestOpts) {
    return fetch(`${BASE_URL}${path}`, {
      headers: buildHeaders(opts),
      redirect: opts?.redirect ?? "follow",
    });
  },

  post(path: string, body: unknown, opts?: RequestOpts) {
    return fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, buildHeaders(opts)),
      body: JSON.stringify(body),
      redirect: opts?.redirect ?? "follow",
    });
  },

  patch(path: string, body: unknown, opts?: RequestOpts) {
    return fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: Object.assign({ "Content-Type": "application/json" }, buildHeaders(opts)),
      body: JSON.stringify(body),
      redirect: opts?.redirect ?? "follow",
    });
  },

  delete(path: string, opts?: RequestOpts) {
    return fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: buildHeaders(opts),
      redirect: opts?.redirect ?? "follow",
    });
  },
};
