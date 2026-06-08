# E2E Critical Flow — Plan Brief

> Full plan: `context/changes/e2e-critical-flow/plan.md`

## What & Why

Scaffold Playwright i wygeneruj test E2E chroniący R7 — pełna ścieżka: logowanie → formularz kontekstu → streaming AI → wygenerowana checklista. Ryzyko R7 (High×Medium) nie może być udowodnione przez testy jednostkowe ani integration — istnieje tylko gdy Astro island hydratuje, streaming UI działa w przeglądarce i nawigacja do `/trips/[id]` się powiedzie.

## Starting Point

Projekt ma Vitest z integration testami (R1, R2, R4) i helpers (auth, http, supabase-admin), ale brak Playwright. `playwright/.auth/auth.json` i `.playwright-cli/` sugerują wcześniejsze eksperymenty — nie są reużywalne jako infrastruktura testów.

## Desired End State

`npm run test:e2e` uruchamia Playwright Chromium. Dedykowany test user tworzony przed testem i usuwany po. `critical-flow.spec.ts` przechodzi pełny flow w przeglądarce i czerwienieje gdy endpoint generowania jest zepsuty.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Auth w teście | Pełne UI flow (sign-in przez form) | R7 definiuje "logowanie" jako pierwszy krok — test musi pokrywać cały flow |
| Test user | Dedykowany (tworzony przez Supabase admin w setup) | Izolacja danych; bezpieczny w CI; wzorzec już istnieje w `tests/helpers/supabase-admin.ts` |
| WebServer | Prereq (brak w playwright.config.ts) | Spójne z podejściem Vitest; Workers runtime (workerd) jest nietrywialny do auto-startu |
| Streaming "done" signal | `waitForURL(/\/trips\//)` + `getByRole('listitem')` | URL zmiana = streaming + save done; eleganckie, bez polling |
| AI timeout | 60 s `navigationTimeout` | Lokalny Anthropic streaming może trwać 20–40 s |

## Scope

**In scope:**
- `@playwright/test` + `playwright.config.ts` (setup + chromium + teardown projects)
- `global.setup.ts` / `global.teardown.ts` (test user lifecycle)
- `seed.spec.ts` (exemplar/lever dla `/10x-e2e`)
- `critical-flow.spec.ts` — jeden test, R7 full path

**Out of scope:**
- Firefox, WebKit, Safari — tylko Chromium
- `webServer` auto-start w Playwright config
- Modyfikacja istniejących Vitest testów
- Testy per-page lub visual regression

## Architecture / Approach

Playwright z trzema projektami: `setup` → `chromium` → `teardown`. Setup tworzy test usera przez Supabase admin API i zapisuje credentials do `tests/e2e/.auth/test-user.json`. Main test czyta credentials, sign-in przez UI, wypełnia formularz, czeka na `waitForURL(/\/trips\//)` (60s timeout), asserts ≥1 `listitem`. Teardown usuwa usera. Plik `.auth/` w `.gitignore`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Playwright scaffold | `@playwright/test`, config, setup/teardown, seed.spec.ts zielony | Workers workerd może wymagać specjalnej konfiguracji baseURL |
| 2. E2E test R7 (via /10x-e2e) | `critical-flow.spec.ts` przechodzący R7, deliberate-break verified | Streaming timeout — test flaky jeśli AI generation wolna |

**Prerequisites:** `supabase start` + `npm run dev` uruchomione; `TEST_SUPABASE_SERVICE_ROLE_KEY` w `.dev.vars`
**Estimated effort:** ~2 sesje (Phase 1 ~30min, Phase 2 ~1h z /10x-e2e loop)

## Open Risks & Assumptions

- `playwright/.auth/auth.json` wygasł — nie będzie reużywany; setup tworzy nowego usera
- AI generation timeout (60s) może być za krótki w wolnym środowisku — zwiększyć do 90s jeśli test flaky
- `supabase start` musi być uruchomione przed Phase 1 i Phase 2 (prereq, nie auto-start)

## Success Criteria (Summary)

- `npm run test:e2e -- tests/e2e/seed.spec.ts` → `1 passed`
- `npm run test:e2e -- tests/e2e/critical-flow.spec.ts` → `1 passed`
- Deliberate break (generate endpoint error) → `critical-flow.spec.ts` czerwony
