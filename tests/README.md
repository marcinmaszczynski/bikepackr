# Integration Tests

HTTP integration tests against a running local dev server + local Supabase.

## Prerequisites

Both services must be running before executing tests:

```bash
# Terminal 1 — start local Supabase (one-time until machine reboot)
supabase start

# Terminal 2 — start dev server
npm run dev
```

## Environment Variables

| Variable | Default | How to get |
|---|---|---|
| `TEST_BASE_URL` | `http://localhost:4321` | Port used by `npm run dev` |
| `TEST_SUPABASE_URL` | `http://127.0.0.1:54321` | From `supabase status` → API URL |
| `TEST_SUPABASE_ANON_KEY` | *(required)* | From `supabase status` → anon key |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | *(required)* | From `supabase status` → service_role key |

Set them before running tests (or add to your shell profile for local dev):

```bash
export TEST_SUPABASE_ANON_KEY="<anon key from supabase status>"
export TEST_SUPABASE_SERVICE_ROLE_KEY="<service_role key from supabase status>"
```

## Running Tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

## Test Suites

| File | Risk | What it tests |
|---|---|---|
| `smoke.test.ts` | — | Dev server is reachable |
| `r1-idor.test.ts` | R1 | 6 IDOR scenarios — user B cannot access user A's trips/items |
| `r4-auth-bypass.test.ts` | R4 | 3 auth bypass scenarios — unauthenticated requests are redirected |
