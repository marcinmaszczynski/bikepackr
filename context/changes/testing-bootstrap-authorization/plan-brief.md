# Bootstrap + Authorization Tests — Plan Brief

> Full plan: `context/changes/testing-bootstrap-authorization/plan.md`
> Research: `context/changes/testing-bootstrap-authorization/research.md`

## What & Why

Bootstrapuje Vitest jako pierwszy test runner w projekcie i implementuje integration testy dla dwóch ryzyk H×H z `test-plan.md §2`: R1 (IDOR — user B odczytuje lub modyfikuje zasoby user A przez zgadnięcie ID) i R4 (auth bypass — niezalogowany użytkownik dociera do chronionego zasobu). Bez tej fazy projekt nie ma żadnej automatycznej weryfikacji bezpieczeństwa.

## Starting Point

Projekt nie ma żadnych zależności testowych ani konfiguracji test runnera. Local Supabase jest skonfigurowane (`supabase/config.toml`), ESLint + build działają w CI, ale zero dynamicznych testów.

## Desired End State

`npm test` (przy uruchomionym `supabase start` i `npm run dev`) uruchamia 9 integration testów: 6 scenariuszy IDOR (user B → zasoby user A → wszystkie 404) i 3 testy auth bypass (/dashboard, /trips/new, /profile bez cookie → 302 na /auth/signin). `test-plan.md §6.1` i `§6.2` uzupełnione o realne lokalizacje i komendy.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-----------------|--------|
| Test runner | Plain Vitest + HTTP do running dev server | Najprostszy setup testujący pełny stack bez Workers pool; Workers fidelity nie jest potrzebna dla HTTP integration testów | Plan |
| Brak poprawek kodu produkcyjnego | Żadnych — endpointy są już poprawne | Analiza kodu wykazała, że wszystkie 6 endpointów używa `.select().single()` z ANON_KEY+JWT → 404 dla prób IDOR; research agent błędnie ocenił DELETE i PATCH rating jako "RLS-only" | Plan |
| Test users | Supabase Admin API w beforeAll | Deterministyczne, izolowane, local service_role_key jest stałą wartością | Plan |
| R4 scope | 3 klasy tras: /dashboard, /trips/[id], /profile | Jeden reprezentant z każdej klasy PROTECTED_ROUTES; nowa trasa dodana do middleware jest niemym regresem | Plan |
| Server lifecycle | Ręczny start przed testem | Wrangler dev ma 5-15 sek startup; globalSetup komplikuje CI bez proporcjonalnego zysku | Plan |

## Scope

**In scope:**
- Instalacja i konfiguracja Vitest
- Helpers: HTTP client, Supabase Admin wrapper, auth cookie helper
- R1 IDOR: 6 scenariuszy (DELETE trip, POST item, PATCH item, DELETE item, GET count, PATCH rating)
- R4 auth bypass: 3 trasy bez cookie → 302
- Cookbook update: §6.1, §6.2, §3 Phase 1 status → complete

**Out of scope:**
- Hard-rules unit tests (R2) — Phase 2
- AI error path tests (R3) — Phase 2
- Password re-auth tests (R5) — Phase 3
- Rating flow tests (R6) — Phase 3
- CI wiring (GitHub Actions) — Phase 4
- `@cloudflare/vitest-pool-workers` — nie wymagane dla HTTP integration testów

## Architecture / Approach

Plain Vitest w środowisku Node. Testy używają `fetch()` do dev servera pod `TEST_BASE_URL` (default `localhost:4321`). Auth cookies uzyskiwane przez POST do `/api/auth/signin` z `redirect: "manual"` → wyciągnięcie `Set-Cookie` z odpowiedzi. Test users tworzone przez Supabase Admin REST API z lokalnym `service_role_key` w `beforeAll`. Cleanup w `afterAll` (delete user kaskaduje do trips i items przez FK).

```
npm test
  → tests/smoke.test.ts       (serwer żyje)
  → tests/r1-idor.test.ts     (6 × IDOR → 404)
  → tests/r4-auth-bypass.test.ts (3 × no-cookie → 302)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Bootstrap test runner | Vitest config + helpers + smoke test | Cookie format @supabase/ssr może wymagać eksperymentowania |
| 2. IDOR integration tests | 6 scenariuszy R1 zielone | beforeAll setup (user creation + trip) musi być niezawodny |
| 3. Auth bypass integration tests | 3 scenariusze R4 zielone | fetch redirect: "manual" musi łapać 302 zanim Vitest go obsłuży |
| 4. Cookbook update | §6.1, §6.2 wypełnione; Phase 1 status: complete | — |

**Prerequisites:** `supabase start` uruchomiony; `npm run dev` uruchomiony; env vars `TEST_SUPABASE_ANON_KEY` i `TEST_SUPABASE_SERVICE_ROLE_KEY` ustawione (z `supabase status`).

**Estimated effort:** ~1-2 sesje; Phase 1 najdłuższa (bootstrap + cookie format discovery).

## Open Risks & Assumptions

- **Cookie format discovery**: `@supabase/ssr` v0.10 przechowuje sesję w cookies o nazwie zależnej od project ref wywiedzionego z `SUPABASE_URL`. Dla local `http://127.0.0.1:54321` format może wymagać eksperymentowania lub sprawdzenia w DevTools/node_modules
- **POST /api/trips endpoint**: plan zakłada że trip można utworzyć przez endpoint lub bezpośrednio przez Supabase JS client; jeśli nie istnieje publiczny endpoint do tworzenia tripów, Phase 2 beforeAll użyje Supabase insert z JWT user A
- **Wrangler dev port**: domyślnie 4321 dla `astro dev` z Cloudflare adapter; może się różnić — `TEST_BASE_URL` env var to nadpisuje

## Success Criteria (Summary)

- `npm test` wykonuje 9 integration testów i wszystkie są zielone
- `test-plan.md §6.1` i `§6.2` zawierają realne ścieżki i komendy (nie `TBD`)
- `test-plan.md §3 Phase 1` status = `complete`
