# E2E Critical Flow — Implementation Plan

## Overview

Scaffold Playwright E2E infrastructure i wygeneruj test pokrywający R7: pełna ścieżka sign-in → formularz kontekstu → streaming AI → wygenerowana checklista. Cel: udowodnić, że użytkownik faktycznie przechodzi ten flow w przeglądarce, nie tylko że API zwraca 200.

## Current State Analysis

- `@playwright/test` **nie** jest zainstalowany (`package.json` ma tylko Vitest)
- Brak `playwright.config.ts`
- `playwright/.auth/auth.json` istnieje (sesja z Playwright CLI, wygasa ~19:01 2026-06-08 — nie do reużycia)
- `.playwright-cli/` ma snapshoty accessibility tree (app działa, testy możliwe)
- `tests/helpers/` z modułami `auth.ts`, `http.ts`, `supabase-admin.ts` — wzorce do naśladowania
- Dev server: `npm run dev` port 4321; prereq `supabase start` (identycznie jak Vitest)
- CLAUDE.md `§ E2E Rules`: `getByRole`/`getByLabel`/`getByText`, zakaz `waitForTimeout()`, izolacja testu, cleanup

## Desired End State

`npm run test:e2e` uruchamia Playwright z dwoma projektami (setup + chromium). Przed testami: dedykowany test user tworzony przez Supabase admin. Po testach: user i jego dane usuwane. `tests/e2e/critical-flow.spec.ts` weryfikuje R7 w przeglądarce i czerwienieje, gdy flow jest zepsute.

### Key Discoveries:

- `src/pages/auth/signin.astro` → `SignInForm.tsx:47,59` — inputy: `id="email"`, `id="password"`, submit button text "Sign in"
- `src/components/TripContextForm.tsx:131-248` — pola: `accommodation_type` (select), `riding_philosophy` (select), `region` (text), `start_date` (date), `trip_duration_days` (number), `title` (text, optional); submit "Generuj checklistę"
- `TripContextForm.tsx:72` — po sukcesie: `window.location.href = /trips/${tripId}`
- `src/pages/api/generate/checklist.ts:134` — `X-Trip-Id` header w streaming response
- `src/middleware.ts:4` — `/trips` jest w `PROTECTED_ROUTES`
- `tests/helpers/supabase-admin.ts` — `createTestUser()` / `deleteTestUser()` — wzorzec do naśladowania w E2E setup

## What We're NOT Doing

- Nie instalujemy Playwright dla Workers z `@cloudflare/vitest-pool-workers` — Playwright testuje przez przeglądarkę, nie przez Workers runtime
- Nie konfigurujemy `webServer` w Playwright config — prereq (spójne z podejściem Vitest)
- Nie dodajemy testów per-page, per-button — tylko R7 + seed
- Nie modyfikujemy istniejących Vitest testów
- Nie instalujemy pełnej matrycy przeglądarek — tylko Chromium

## Implementation Approach

Dwie fazy z wyraźną granicą: Phase 1 to scaffold (`/10x-implement`) — wszystko czego `/10x-e2e` potrzebuje do uruchomienia. Phase 2 to generowanie testu R7 (`/10x-e2e`) — pętla PLAN→GENERATE→REVIEW→VERIFY z running app.

## Critical Implementation Details

**AI generation timeout.** `waitForURL(/\/trips\//)` musi mieć timeout ≥ 60 s — streaming AI może trwać 20–40 s w lokalnym dev. Ustaw `navigationTimeout: 60_000` w `playwright.config.ts`; NIE używaj `waitForTimeout()` jako obejścia.

**Test user credentials sharing.** `global.setup.ts` tworzy usera i zapisuje `{ email, password, userId }` do `tests/e2e/.auth/test-user.json`. `critical-flow.spec.ts` czyta z tego pliku credentials do logowania przez UI. `global.teardown.ts` usuwa usera po testach. Plik `.auth/` jest w `.gitignore`.

**Supabase admin in setup.** Setup używa bezpośrednio `@supabase/supabase-js` z `SERVICE_ROLE_KEY` — nie przez Astro SSR client. Wzorzec identyczny jak `tests/helpers/supabase-admin.ts`.

---

## Phase 1: Playwright Scaffold

### Overview

Instalacja `@playwright/test`, konfiguracja (`playwright.config.ts`), projekty setup/teardown do zarządzania test userem, oraz `seed.spec.ts` jako wzorzec (lever) dla `/10x-e2e`.

### Changes Required:

#### 1. Install @playwright/test

**File**: `package.json`

**Intent**: Dodaj `@playwright/test` jako devDependency i dodaj skrypt `test:e2e` uruchamiający Playwright.

**Contract**: W `devDependencies` dodaj `"@playwright/test": "^1.52.0"`. W `scripts` dodaj `"test:e2e": "playwright test"`. Po instalacji: `npx playwright install chromium --with-deps`.

---

#### 2. playwright.config.ts

**File**: `playwright.config.ts` (nowy, root projektu)

**Intent**: Główna konfiguracja Playwright — baseURL, timeout uwzględniający AI streaming, trzy projekty: setup (tworzy usera) → chromium (testy) → teardown (usuwa usera).

**Contract**: `baseURL: 'http://localhost:4321'`, `navigationTimeout: 60_000`, `actionTimeout: 15_000`. Trzy projects:
```ts
projects: [
  { name: 'setup', testMatch: /global\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
    dependencies: ['setup'],
    teardown: 'teardown',
  },
  { name: 'teardown', testMatch: /global\.teardown\.ts/ },
]
```
Brak `webServer` (prereq). `fullyParallel: false` (setup/teardown sekwencja). Opcjonalnie: `reporter: 'html'`.

---

#### 3. tests/e2e/global.setup.ts

**File**: `tests/e2e/global.setup.ts` (nowy)

**Intent**: Tworzy dedykowanego test usera przez Supabase admin API i zapisuje credentials do `tests/e2e/.auth/test-user.json` dla main test project.

**Contract**: Importuje `@supabase/supabase-js` bezpośrednio (nie przez Astro). Używa `TEST_SUPABASE_URL` i `TEST_SUPABASE_SERVICE_ROLE_KEY`. Email: `e2e-test-${Date.now()}@test.local`. Po `createUser` zapisuje `{ email, password, userId }` do JSON. Plik `.auth/` musi być w `.gitignore`.

---

#### 4. tests/e2e/global.teardown.ts

**File**: `tests/e2e/global.teardown.ts` (nowy)

**Intent**: Usuwa test usera (i jego dane dzięki RLS/cascade) po zakończeniu wszystkich testów.

**Contract**: Czyta `userId` z `tests/e2e/.auth/test-user.json`. Wywołuje `supabase.auth.admin.deleteUser(userId)`. Usuwa plik `.auth/test-user.json`. Wzorzec: `tests/helpers/supabase-admin.ts:deleteTestUser`.

---

#### 5. tests/e2e/seed.spec.ts

**File**: `tests/e2e/seed.spec.ts` (nowy)

**Intent**: Seed exemplar — wzorzec lokatorów i struktury testu dla `/10x-e2e`. Prosty test (brak AI) weryfikujący auth redirect. Musi przejść zielono przed uruchomieniem Phase 2.

**Contract**: Jeden test w `describe('Auth redirect')`: `page.goto('/trips/new')` → `expect(page).toHaveURL(/\/auth\/signin/)`. Provenance header w komentarzu: `// seed: exemplar for E2E pattern`. Używa `getByRole`/`expect(page).toHaveURL()` — bez CSS selectors, bez `waitForTimeout`.

---

#### 6. .gitignore update

**File**: `.gitignore`

**Intent**: Wyklucz `tests/e2e/.auth/` (credentials test usera) i `playwright-report/` (HTML report) z repo.

**Contract**: Dodaj dwie linie: `tests/e2e/.auth/` i `playwright-report/`.

---

### Success Criteria:

#### Automated Verification:

- `@playwright/test` zainstalowany: `ls node_modules/@playwright/test`
- `playwright.config.ts` istnieje: `test -f playwright.config.ts`
- Chromium zainstalowany: `npx playwright install chromium --with-deps` kończy się bez błędu
- `seed.spec.ts` zielony (prereq: `supabase start` + `npm run dev`): `npm run test:e2e -- tests/e2e/seed.spec.ts`

#### Manual Verification:

- `npm run test:e2e -- tests/e2e/seed.spec.ts` kończy się `1 passed`
- `tests/e2e/.auth/test-user.json` powstaje podczas testu i jest usuwany po
- `.gitignore` wyklucza `.auth/` (test: `git status` nie pokazuje pliku credentials)

---

## Phase 2: E2E test R7 (via /10x-e2e)

### Overview

Generowanie testu E2E dla R7 przez skill `/10x-e2e`. Pętla PLAN→GENERATE→REVIEW→VERIFY. Test drives full flow w przeglądarce: UI sign-in → formularz /trips/new → streaming AI → waitForURL(/trips/) → assert ≥1 element checklisty.

### Changes Required:

#### 1. tests/e2e/critical-flow.spec.ts

**File**: `tests/e2e/critical-flow.spec.ts` (generowany przez `/10x-e2e`)

**Intent**: Dowód ochrony R7 w przeglądarce. Jeden test przechodzący pełną ścieżkę: logowanie przez UI → wypełnienie formularza kontekstu → oczekiwanie na zakończenie streamingu (nawigacja do `/trips/[id]`) → potwierdzenie że ≥1 element checklisty jest widoczny.

**Contract**:
- Test name: `'R7: sign-in → context form → AI generation → checklist visible at /trips/[id]'`
- Credentials: czyta z `tests/e2e/.auth/test-user.json`
- Locators: `getByLabel('Email')`, `getByLabel('Password')`, `getByRole('button', { name: 'Sign in' })`, `getByLabel('Nocleg')`, `getByRole('button', { name: 'Generuj checklistę' })`
- Assertion streaming done: `await page.waitForURL(/\/trips\//, { timeout: 60_000 })`
- Assertion checklist: `await expect(page.getByRole('listitem')).toHaveCount(/* >=1 */, { timeout: 10_000 })`
- Cleanup: DELETE `/api/trips/[tripId]` via `request` fixture z cookie session po zakończeniu testu

---

### Success Criteria:

#### Automated Verification:

- `tests/e2e/critical-flow.spec.ts` istnieje: `test -f tests/e2e/critical-flow.spec.ts`
- Test zielony: `npm run test:e2e -- tests/e2e/critical-flow.spec.ts` → `1 passed`
- Deliberate break: zablokowanie endpointu generate (mock zwracający error) → test czerwony

#### Manual Verification:

- Playwright HTML report (po `npm run test:e2e -- --reporter=html`) pokazuje zrzut ekranu z checklistą na `/trips/[id]`
- Test user jest usuwany po teście (`tests/e2e/.auth/test-user.json` nie istnieje)
- Brak osieroconych danych w lokalnej bazie po teście

---

## Testing Strategy

### Manual Testing Steps:

1. `supabase start` + `npm run dev` (prereqs)
2. `npm run test:e2e -- tests/e2e/seed.spec.ts` → `1 passed`
3. `npm run test:e2e -- tests/e2e/critical-flow.spec.ts` → `1 passed`
4. Deliberate break: zmodyfikuj `src/pages/api/generate/checklist.ts` żeby zwracał 500 → test czerwony → przywróć
5. `git status` → `tests/e2e/.auth/` nie widoczne (gitignore)

## References

- Risk R7: `context/foundation/test-plan.md §2`
- Phase 4 E2E: `context/foundation/test-plan.md §3`
- E2E rules: `CLAUDE.md §10xDevs E2E Tests`
- Wzorzec helpers: `tests/helpers/supabase-admin.ts`, `tests/helpers/auth.ts`
- TripContextForm: `src/components/TripContextForm.tsx:131-248`
- SignInForm: `src/components/auth/SignInForm.tsx:47-82`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Playwright Scaffold

#### Automated

- [x] 1.1 `@playwright/test` zainstalowany: `ls node_modules/@playwright/test` — 7c6faff
- [x] 1.2 `playwright.config.ts` istnieje: `test -f playwright.config.ts` — 7c6faff
- [x] 1.3 Chromium zainstalowany: `npx playwright install chromium --with-deps` — 7c6faff
- [x] 1.4 `seed.spec.ts` zielony: `npm run test:e2e -- tests/e2e/seed.spec.ts` — 7c6faff

#### Manual

- [x] 1.5 `npm run test:e2e -- tests/e2e/seed.spec.ts` kończy się `1 passed` — 7c6faff
- [x] 1.6 `tests/e2e/.auth/test-user.json` powstaje i jest usuwany — 7c6faff
- [x] 1.7 `.gitignore` wyklucza `.auth/` — 7c6faff

### Phase 2: E2E test R7

#### Automated

- [x] 2.1 `test -f tests/e2e/critical-flow.spec.ts` — 9aee094
- [x] 2.2 `npm run test:e2e -- tests/e2e/critical-flow.spec.ts` → `1 passed` — 9aee094
- [x] 2.3 Deliberate break: generate endpoint error → test czerwony — 9aee094

#### Manual

- [x] 2.4 HTML report pokazuje zrzut ekranu checklisty na `/trips/[id]` — 9aee094
- [x] 2.5 Test user usunięty po teście — 9aee094
- [x] 2.6 Brak osieroconych danych w lokalnej bazie — 9aee094
