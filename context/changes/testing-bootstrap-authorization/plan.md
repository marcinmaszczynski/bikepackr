# Bootstrap + Authorization Tests — Implementation Plan

## Overview

Bootstrapuje Vitest jako test runner i implementuje pierwsze integration testy dla dwóch najważniejszych ryzyk H×H: R1 (IDOR — dostęp do cudzych zasobów) i R4 (auth bypass — dostęp bez sesji). Faza 1 z `test-plan.md §3`.

## Current State Analysis

- **Brak test runnera** — zero zależności testowych w `package.json`; `npm run lint` i `npm run build` to jedyne automatyczne kroki CI
- **Local Supabase gotowy** — `supabase/config.toml` istnieje; `supabase` CLI w devDependencies (`^2.101.0`)
- **Wszystkie 6 endpointów z zewnętrznymi ID zasobów poprawnie zwracają 404** dla prób IDOR — każdy endpoint używa `.single()` z klientem ANON_KEY+JWT, co powoduje błąd przy 0 wierszach po filtrowaniu przez RLS; brak poprawek kodu produkcyjnego w tym zakresie
- **Middleware** (`src/middleware.ts`) chroni `/dashboard`, `/trips/*`, `/profile` — przekierowuje niezalogowanych na `/auth/signin`

### Key Discoveries

- Endpointy DELETE `/api/trips/[id]` i PATCH `/api/trips/[id]/rating` były błędnie ocenione jako "RLS-only" w research.md — faktycznie oba używają `.select().single()` po operacji, co zamienia 0 wierszy (zblokowane przez RLS) w błąd → 404. Żaden endpoint nie wymaga poprawki
- Supabase client używa ANON_KEY — `auth.uid()` w RLS jest wypełniany z JWT przekazywanego przez cookies. Wzorzec: `createClient(context.request.headers, context.cookies)` w każdym endpoincie
- Middleware prefix `/trips` nie łapie `/api/trips/*` (zaczyna się od `/api/`); API routes mają własne `if (!context.locals.user)` guardy
- Local Supabase ma deterministyczne klucze (anon key, service_role key) dostępne przez `supabase status` — nie trzeba ich konfigurować przez Cloudflare secrets na potrzeby testów

## Desired End State

Każde `npm test` (przy uruchomionym `supabase start` i `npm run dev`) uruchamia dwa zestawy testów integration:

1. **R1 IDOR** — 6 scenariuszy: user B próbuje GET/PATCH/DELETE na zasobach user A → wszystkie zwracają 404
2. **R4 auth bypass** — 3 klasy tras: request bez session cookie → 302 redirect na `/auth/signin`

### Key Discoveries

- `context/changes/testing-bootstrap-authorization/research.md` — pełna mapa endpointów i model ochrony
- `supabase/migrations/20260526000000_create_trips_checklist_items.sql:49-70` — RLS policies
- `src/middleware.ts` — PROTECTED_ROUTES i mechanizm redirectu

## What We're NOT Doing

- Nie konfigurujemy `@cloudflare/vitest-pool-workers` — testy HTTP integration nie potrzebują Workers runtime fidelity
- Nie naprawiamy kodu produkcyjnego — endpointy są poprawne (odkrycie z analizy kodu przed planem)
- Nie autostarujemy dev servera z globalSetup — serwer uruchamiany ręcznie przed testem
- Nie piszemy unit testów hard-rules (R2) ani AI error paths (R3) — to Phase 2 test-planu
- Nie konfigurujemy CI (GitHub Actions) — to Phase 4 test-planu

## Implementation Approach

Plain Vitest z `environment: 'node'`; testy robią `fetch()` do uruchomionego lokalnie dev servera. Auth cookies uzyskiwane przez wywołanie endpointu `/api/auth/signin` aplikacji (fetch bez śledzenia redirectów → wyciągnięcie `Set-Cookie`). Test users tworzone przez Supabase Admin API z lokalnym service_role_key.

---

## Phase 1: Bootstrap test runner

### Overview

Instaluje Vitest, tworzy helpers (HTTP client, Supabase Admin wrapper, auth helper), weryfikuje konfigurację smoke testem.

### Changes Required

#### 1. Zależności testowe

**File**: `package.json`

**Intent**: Dodaj `vitest` do devDependencies i dodaj skrypty `test` oraz `test:watch`.

**Contract**: `devDependencies["vitest"]` = latest stable; `scripts["test"]` = `"vitest run"`; `scripts["test:watch"]` = `"vitest"`.

#### 2. Konfiguracja Vitest

**File**: `vitest.config.ts` (nowy plik, root projektu)

**Intent**: Skonfiguruj Vitest do uruchamiania testów z katalogu `tests/` w środowisku Node (nie Workers).

**Contract**: `test.include` = `["tests/**/*.test.ts"]`; `test.environment` = `"node"`; `test.testTimeout` = 30000 (HTTP integration tests mogą być wolne przy zimnym starcie DB).

#### 3. Środowisko testowe — dokumentacja prereqów

**File**: `tests/README.md` (nowy)

**Intent**: Udokumentuj kroki wymagane przed uruchomieniem testów oraz zmienne środowiskowe.

**Contract**: Dokument zawiera: (a) `supabase start` jako prereq, (b) `npm run dev` jako prereq, (c) tabelę env vars: `TEST_BASE_URL` (default `http://localhost:4321`), `TEST_SUPABASE_URL` (default `http://127.0.0.1:54321`), `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY` (oba z `supabase status`), (d) komendę uruchomienia `npm test`.

#### 4. Helper: HTTP client

**File**: `tests/helpers/http.ts` (nowy)

**Intent**: Cienkia opakowanie na `fetch` z obsługą BASE_URL i cookie headers, żeby testy nie powtarzały boilerplate.

**Contract**: Eksportuje `http` object z metodami `get(path, opts?)`, `post(path, body, opts?)`, `patch(path, body, opts?)`, `delete(path, opts?)` gdzie `opts` przyjmuje `{ cookies?: string; redirect?: RequestRedirect }`. BASE_URL pochodzi z `process.env.TEST_BASE_URL ?? "http://localhost:4321"`.

#### 5. Helper: Supabase Admin

**File**: `tests/helpers/supabase-admin.ts` (nowy)

**Intent**: Wrapper na Supabase Admin API do tworzenia i usuwania test users — izolowany od klienta SSR aplikacji.

**Contract**: Używa `@supabase/supabase-js` (już w dependencies) z `SUPABASE_SERVICE_ROLE_KEY` i lokalnym URL. Eksportuje: `createTestUser(email: string, password: string): Promise<{ id: string }>` (POST `/auth/v1/admin/users`), `deleteTestUser(id: string): Promise<void>` (DELETE `/auth/v1/admin/users/:id`). Klucz i URL z `process.env.TEST_SUPABASE_SERVICE_ROLE_KEY` i `process.env.TEST_SUPABASE_URL`.

#### 6. Helper: Auth

**File**: `tests/helpers/auth.ts` (nowy)

**Intent**: Zwraca cookie string gotowy do umieszczenia w nagłówku `Cookie` żądań HTTP — przez wywołanie endpointu logowania aplikacji z wyciągnięciem `Set-Cookie` z odpowiedzi redirect.

**Contract**: Eksportuje `signIn(email: string, password: string): Promise<string>`. Robi POST do `${BASE_URL}/api/auth/signin` z `redirect: "manual"`, wyciąga `set-cookie` z headers odpowiedzi, zwraca je jako string gotowy do użycia jako `Cookie:` header. Jeśli odpowiedź nie zawiera cookies, rzuca błąd z czytelnym komunikatem (nie milczy).

#### 7. Smoke test

**File**: `tests/smoke.test.ts` (nowy)

**Intent**: Weryfikuje że dev server jest uruchomiony i odpowiada przed uruchomieniem integration testów.

**Contract**: `GET /` → status 200. `GET /auth/signin` → status 200. Oba bez cookies. Jeśli fail → komunikat wskazujący że serwer może nie być uruchomiony.

### Success Criteria

#### Automated Verification

- `npm test` uruchamia się bez błędu instalacji/konfiguracji
- Smoke test przechodzi: `GET /` i `GET /auth/signin` zwracają 200

#### Manual Verification

- `npm run test:watch` działa w trybie watch
- Auth helper zwraca niepuste cookie string po podaniu prawidłowych credentials (zweryfikuj w REPL lub dodatkowym teście)
- Admin helper tworzy i usuwa test usera bez błędu

**Implementation Note**: Po ukończeniu tej fazy i pomyślnych weryfikacjach zautomatyzowanych, zatrzymaj się na potwierdzenie że manual verification przeszło.

---

## Phase 2: IDOR integration tests (R1)

### Overview

6 scenariuszy IDOR: user B (odrębna sesja) próbuje operować na zasobach user A. Wszystkie endpointy powinny zwrócić 404 (RLS+single() pattern) bez modyfikowania danych user A.

### Changes Required

#### 1. IDOR test suite

**File**: `tests/r1-idor.test.ts` (nowy)

**Intent**: Zestaw 6 integration testów weryfikujących że user B nie może odczytać ani zmodyfikować zasobów user A przez podanie ID zasobu.

**Contract**:

`beforeAll`:
1. Utwórz `userA` i `userB` przez `createTestUser` z deterministycznymi emailami (np. `test-idor-a-${Date.now()}@test.invalid`)
2. Zaloguj obu przez `signIn` → `cookiesA`, `cookiesB`
3. User A tworzy trip: POST `/api/trips` (lub przez Supabase Admin jeśli brak endpointu) → zapisz `tripAId`
4. User A tworzy item w trip: POST `/api/trips/${tripAId}/items` z `cookiesA` → zapisz `itemAId`

`afterAll`: usuń `userA` i `userB` przez Admin API (kaskada usuwa trip i items).

Scenariusze (każdy jako osobne `it`):

| Test | Endpoint | Method | Cookie | Oczekiwany status |
|------|----------|--------|--------|-------------------|
| T1 | `/api/trips/${tripAId}` | DELETE | cookiesB | 404 |
| T2 | `/api/trips/${tripAId}/items` | POST | cookiesB | 404 |
| T3 | `/api/trips/${tripAId}/items/${itemAId}` | PATCH | cookiesB | 404 |
| T4 | `/api/trips/${tripAId}/items/${itemAId}` | DELETE | cookiesB | 404 |
| T5 | `/api/trips/${tripAId}/items-count` | GET | cookiesB | 404 |
| T6 | `/api/trips/${tripAId}/rating` | PATCH | cookiesB | 404 |

Dla T1: po oczekiwanym 404 zweryfikuj że trip A nadal istnieje — `GET /api/trips/${tripAId}/items-count` z `cookiesA` → 200.

Dla T2: body `{ name: "test", category: "test" }`.

Dla T3: body `{ is_packed: true }`.

Dla T6: body `{ pre_trip_rating: 5 }`.

**Uwaga o tworzeniu trip**: jeśli nie istnieje publiczny endpoint `POST /api/trips`, utwórz trip bezpośrednio przez `@supabase/supabase-js` client z tokenem user A (sign in, get session, insert do tabeli trips z `user_id: userA.id`).

### Success Criteria

#### Automated Verification

- `npm test` — wszystkie 6 testów IDOR przechodzą
- T1 verify: trip A nadal istnieje po próbie DELETE przez user B

#### Manual Verification

- Sprawdź w Supabase Studio (local: `http://localhost:54323`) że tabela trips zawiera trip A po uruchomieniu testów — nie zostało usunięte przez user B

**Implementation Note**: Po ukończeniu tej fazy i pomyślnych weryfikacjach, zatrzymaj się na potwierdzenie.

---

## Phase 3: Auth bypass integration tests (R4)

### Overview

3 klasy tras chronionych przez middleware: request bez session cookie powinien zostać przekierowany na `/auth/signin` (HTTP 302). Jeden reprezentant z każdej klasy PROTECTED_ROUTES.

### Changes Required

#### 1. Auth bypass test suite

**File**: `tests/r4-auth-bypass.test.ts` (nowy)

**Intent**: 3 integration testy weryfikujące że middleware przekierowuje niezalogowanego użytkownika dla każdej klasy chronionych tras.

**Contract**: Każdy test robi `fetch(url, { redirect: "manual" })` — bez cookies — i sprawdza:
- status === 302 (lub 301)
- `Location` header zawiera `/auth/signin`

Trasy do testu:

| Trasa | Klasa z PROTECTED_ROUTES |
|-------|--------------------------|
| `/dashboard` | `/dashboard` |
| `/trips/new` | `/trips` (parametryzowana podtrasa) |
| `/profile` | `/profile` |

Każdy test jako osobne `it` z opisem klasy ryzyka: `"R4: GET /dashboard bez cookie → redirect /auth/signin"`.

### Success Criteria

#### Automated Verification

- `npm test` — wszystkie 3 testy auth bypass przechodzą
- Status 302 i Location header zawiera `/auth/signin` dla każdej trasy

#### Manual Verification

- W przeglądarce: otwórz URL chroniony bez logowania → sprawdź przekierowanie na stronę logowania

**Implementation Note**: Po ukończeniu tej fazy i pomyślnych weryfikacjach, zatrzymaj się na potwierdzenie.

---

## Phase 4: Cookbook update

### Overview

Aktualizuje `test-plan.md §6.1`, `§6.2` realnymi lokalizacjami, komendami i przykładami testów. Zamyka Phase 1 test-planu przez update statusu.

### Changes Required

#### 1. §6.1 Authorization / IDOR integration test

**File**: `context/foundation/test-plan.md`

**Intent**: Zastąp placeholder `TBD — see §3 Phase 1` w §6.1 realną lokalizacją, przykładowym assertem i komendą.

**Contract**: Nowa treść §6.1 zawiera: ścieżkę `tests/r1-idor.test.ts`, komendę `npm test`, jeden przykładowy test (T1 DELETE) z oczekiwanym statusem 404, notatkę o wymaganych prereqach (`supabase start` + `npm run dev`).

#### 2. §6.2 Auth bypass / middleware integration test

**File**: `context/foundation/test-plan.md`

**Intent**: Zastąp placeholder `TBD — see §3 Phase 1` w §6.2 realną lokalizacją i przykładem.

**Contract**: Nowa treść §6.2 zawiera: ścieżkę `tests/r4-auth-bypass.test.ts`, komendę `npm test`, jeden przykładowy test (`GET /dashboard` → 302).

#### 3. §3 Phase 1 status update

**File**: `context/foundation/test-plan.md`

**Intent**: Zaktualizuj status Phase 1 w tabeli §3 Phased Rollout z `change opened` na `complete`.

**Contract**: Wiersz `| 1 | Bootstrap + Authorization | ... | change opened |` → `| 1 | ... | complete |`.

### Success Criteria

#### Automated Verification

- `npm run lint` przechodzi po edycji test-plan.md (markdown nie jest lintowany, ale sprawdź brak błędów TypeScript w innych plikach dotkniętych zmianami)

#### Manual Verification

- §6.1 i §6.2 zawierają realne ścieżki plików i komendy (nie `TBD`)
- §3 Phase 1 status to `complete`

---

## Testing Strategy

### Integration Tests

Wszystkie testy w tym planie są integration tests (realne HTTP do running dev server + realna Supabase). Nie ma unit testów ani mockowania.

- **R1 IDOR** (`tests/r1-idor.test.ts`): 6 scenariuszy, 2 user sessions, beforeAll setup
- **R4 auth bypass** (`tests/r4-auth-bypass.test.ts`): 3 trasy, fetch bez cookies, manual redirect check

### Prerequisites dla testów

```bash
supabase start          # uruchom local Supabase (jednorazowo)
npm run dev             # uruchom dev server (w osobnym terminalu)
npm test                # uruchom testy
```

Env vars (podaj przed `npm test` lub w `.env.test`):
- `TEST_BASE_URL` (default: `http://localhost:4321`)
- `TEST_SUPABASE_URL` (default: `http://127.0.0.1:54321`)
- `TEST_SUPABASE_ANON_KEY` — z `supabase status`
- `TEST_SUPABASE_SERVICE_ROLE_KEY` — z `supabase status`

## References

- Research: `context/changes/testing-bootstrap-authorization/research.md`
- Test plan §3 Phase 1: `context/foundation/test-plan.md`
- RLS policies: `supabase/migrations/20260526000000_create_trips_checklist_items.sql:49-70`
- Middleware: `src/middleware.ts`
- Endpoints: `src/pages/api/trips/`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Bootstrap test runner

#### Automated

- [x] 1.1 `npm test` uruchamia się bez błędu instalacji/konfiguracji — d6084a3
- [x] 1.2 Smoke test przechodzi: `GET /` i `GET /auth/signin` zwracają 200 — d6084a3

#### Manual

- [ ] 1.3 `npm run test:watch` działa w trybie watch
- [ ] 1.4 Auth helper zwraca niepuste cookie string po podaniu prawidłowych credentials
- [ ] 1.5 Admin helper tworzy i usuwa test usera bez błędu

### Phase 2: IDOR integration tests (R1)

#### Automated

- [ ] 2.1 `npm test` — wszystkie 6 testów IDOR przechodzą
- [ ] 2.2 T1 verify: trip A nadal istnieje po próbie DELETE przez user B

#### Manual

- [ ] 2.3 Supabase Studio: tabela trips zawiera trip A po uruchomieniu testów

### Phase 3: Auth bypass integration tests (R4)

#### Automated

- [x] 3.1 `npm test` — wszystkie 3 testy auth bypass przechodzą
- [x] 3.2 Status 302 i Location header zawiera `/auth/signin` dla każdej trasy

#### Manual

- [ ] 3.3 W przeglądarce: chroniony URL bez logowania → przekierowanie na stronę logowania

### Phase 4: Cookbook update

#### Automated

- [ ] 4.1 `npm run lint` przechodzi po edycji test-plan.md

#### Manual

- [ ] 4.2 §6.1 i §6.2 zawierają realne ścieżki plików i komendy (nie TBD)
- [ ] 4.3 §3 Phase 1 status to `complete`
