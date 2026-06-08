---
project: Bikepackr
version: 1
created: 2026-06-02
prd_version: 1
roadmap_version: 1
status: active
---

# Test Plan: Bikepackr

Jakościowy kontrakt projektu. §1–§5 zamrożone po pierwszym zapisie; §6 rośnie wraz z każdą fazą rollout; §7 aktualizowany przy `--refresh`.

---

## §1 Strategy

Trzy zasady obowiązują przy każdej decyzji testowej:

1. **Koszt × sygnał.** Każdy test dodany przez rollout musi odpowiedzieć na jedno pytanie: *jaki jest najtańszy test, który daje realny sygnał dla tego ryzyka?* Nie awansuj do e2e dlatego, że "czuje się bezpieczniej"; nie nakładaj modelu wizyjnego na deterministyczny diff, który już łapie regresję.

2. **Obawy użytkownika są dowodem.** Ryzyka, przez które zespół już przeszedł lub których się obawia, mają taką samą wagę jak linijki PRD czy dane hot-spot.

3. **Sygnał, nie wiedza. Ryzyka to scenariusze awarii, nie lokalizacje kodu.** §2 cytuje dowody, które *podniosły* ryzyko — linijki PRD, odpowiedzi z wywiadu, katalogi hot-spot z liczebnością zmian. §2 nigdy nie cytuje `plik:linia`, nazwy funkcji ani nazwy modułu jako anchor — to jest wyjście `/10x-research`, produkowane oddzielnie dla każdej fazy rollout. Ryzyka zdane we `Źródło` muszą tracić się do PRD, roadmap, archiwum, hot-spot *katalog*, lub pytania z wywiadu.

---

## §2 Risk Map

Ryzyka posortowane Impact × Likelihood. Chronić High × High najpierw.

| # | Ryzyko (scenariusz awarii) | Impact | Likelihood | Źródło |
|---|---|---|---|---|
| R1 | IDOR — użytkownik B odczytuje lub modyfikuje plan/elementy użytkownika A przez zgadnięcie lub spreparowanie ID zasobu | High | High | PRD §NFR ("plany widoczne wyłącznie właścicielowi; nieautoryzowany dostęp niemożliwy"), Q1 (wywiad: główna obawa) |
| R2 | Regresja hard-rules — zakazane lub wymagane elementy ekwipunku nie odpowiadają kombinacji kontekstu (np. śpiwór brakuje przy namiocie, ciężki obóz pojawia się przy fast&light) | High | High | PRD §AC US-01 ("reguły sztywne bezwzględne"), PRD §Business Logic, Q3 (wywiad: obszar najwyższej niepewności), hot-spot dir `src/lib` (9 zmian/30d) |
| R3 | Awaria generowania AI — cicha awaria, pusta checklista lub nieparsowalny wynik bez czytelnej informacji zwrotnej dla użytkownika | High | Medium | PRD §AC US-01 ("Generator zawsze zwraca wynik lub czytelną informację o błędzie; generowanie nigdy nie kończy się milczącą awarią"), FR-006, archive F-02 (streaming na Workers — weryfikowane empirycznie) |
| R4 | Bypass auth — niezalogowany użytkownik dociera do chronionego zasobu przez regresję w middleware | High | Medium | PRD §Access Control ("Niezalogowany użytkownik trafiający na chroniony zasób jest przekierowany na stronę logowania"), hot-spot dir `src/pages/api/` (32 zmiany/30d), hot-spot `src/middleware.ts` (3 zmiany/30d) |
| R5 | Zmiana hasła bez weryfikacji starego hasła — wektor przejęcia konta przy współdzielonej sesji lub skradzionym tokenie | High | Medium | PRD FR-004 (zmiana hasła jako must-have), archive `user-profile-edit` (Critical Impl. Details: re-auth wymagany przed `updateUser`) |
| R6 | Nieprawidłowy flow oceniania — ocena nie jest zapisywana lub widget pre/post-trip nie reaguje na datę startu wyjazdu | High | Low | PRD §Success Criteria (primary metric: 75% planów z oceną ≥ 4), FR-010 (dwa etapy oceniania, oba opcjonalne), S-04 roadmap (bezpośrednio obsługuje główny KPI) |
| R7 | Regresja krytycznej ścieżki E2E — użytkownik nie może przejść: logowanie → formularz kontekstu → wygenerowana checklista | High | Medium | Q1 (wywiad: AI generation top concern), Q4 (wywiad: E2E gap), CLAUDE.md (nowe reguły E2E), hot-spot dir `src/pages/api/generate/` (2 zmiany/30d) |

### Risk Response Guidance

| Ryzyko | Co dowodzi ochrony | Must challenge | Kontekst dla `/10x-research` | Najtańsza warstwa | Anti-pattern do unikania |
|---|---|---|---|---|---|
| R1 | Użytkownik B → GET/PUT/DELETE na ID tripa lub elementu należącego do A → 403 lub redirect; dane A nie wyciекają | "RLS skonfigurowano" ≠ guard aplikacyjny jest poprawny dla każdego endpointu osobno | Jakie endpointy przyjmują zewnętrzne ID zasobu; jak weryfikowana jest własność (RLS vs. aplikacyjny pre-check vs. oba) | Integration z 2 osobnymi sesjami użytkowników, realne HTTP do każdej trasy | Unit test polityki RLS bez realnego HTTP flow |
| R2 | `evaluateHardRules(ctx)` zwraca poprawne `required` i `excluded` dla minimum 6 kombinacji kontekstu (hostel, namiot, hamak, bivy, fast&light, kombinacje mieszane) | "Happy-path test przeszedł" ≠ edge case np. `accommodation='bivy'` + `philosophy='expedition'` daje poprawny wynik | Kontrakt wejście/wyjście funkcji; wszystkie gałęzie reguł i ich wzajemne wykluczenia | Unit (czyste wejście → wyjście, zero IO, zero sieci) | Testowanie tylko jednej kombinacji; oracle skopowany z implementacji zamiast z PRD |
| R3 | Gdy Anthropic API zwraca błąd lub timeout → endpoint odpowiada czytelnym błędem lub komunikatem użytkownikowi, nie cichym HTTP 200 z pustym body | "HTTP status = 200" ≠ treść odpowiedzi jest poprawna; "streaming się rozpoczął" ≠ checklista jest niepusta i parsowalna | Ścieżka błędu w endpoint generowania; punkt gdzie `onFinish` jest wywoływany vs. gdzie może nie być; minimalna walidacja wyjścia | Integration z mockiem Anthropic SDK zwracającym błąd i timeout | Testowanie tylko happy-path streaming; brak testu pustego strumienia |
| R4 | GET /dashboard, /trips/[id], /profile bez session cookie → redirect /auth/signin; żaden chroniony zasób nie jest zwrócony | "Middleware istnieje" ≠ pokrywa każdą klasę nowo dodanej chronionej ścieżki | PROTECTED_ROUTES lista i mechanizm dodawania nowych tras; czy middleware działa dla zagnieżdżonych parametryzowanych tras | Integration (HTTP bez cookie do każdej klasy chronionej trasy) | Mockowanie middleware zamiast realnego HTTP request cycle |
| R5 | POST do endpointu zmiany hasła z błędnym starym hasłem → 400/401; z poprawnym starym hasłem → 200 i hasło faktycznie zmienione w Supabase | "`updateUser` jest wywołany" ≠ `signInWithPassword` jest wywołany i zweryfikowany **przed** `updateUser` | Kolejność operacji w endpoincie change-password; jak błąd re-auth jest propagowany do klienta | Integration z realną instancją Supabase test (lub local Supabase) | Unit test mocka Supabase — mock zawsze zwraca success |
| R6 | POST /api/trips/[id]/rating → score zapisany w DB; widget pre-trip widoczny gdy current_date < start_date; widget post-trip widoczny gdy current_date ≥ start_date | "Widget wyrenderował się" ≠ logika daty jest poprawna; "score w stanie lokalnym" ≠ score persystuje po reload | Gdzie i jak przechowywany jest score (kolumny na rekordzie trips?); jak start_date przekazywany jest do logiki date-gating | Integration (API endpoint) + unit (logika date-gating jako pure function) | Snapshot test widgetu bez testu logiki; testowanie przez daty bieżące zamiast parametryzowanych |
| R7 | Zalogowany user → formularz → streaming → ≥1 element → URL `/trips/[id]` | "API zielony" ≠ "Astro island hydratuje + streaming UI w przeglądarce" | Ścieżka pełna w przeglądarce od logowania do wygenerowanej checklisty | Playwright E2E | `waitForTimeout()`, brak cleanup, over-testing UI |

---

## §3 Phased Rollout

Orchestrator czyta ten status table przy każdym wywołaniu `/10x-test-plan`. Słownictwo statusów (parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

| # | Faza | Cel | Ryzyka | Typy testów | Change folder | Status |
|---|---|---|---|---|---|---|
| 1 | Bootstrap + Authorization | Bootstrapuje test runner (Vitest lub ekwiwalent dla Workers); pierwsze integration testy pokrywające IDOR i auth bypass — najwyższe H×H ryzyka | R1, R4 | Integration (HTTP z 2 sesjami użytkowników), unit runner setup | context/changes/testing-bootstrap-authorization/ | complete |
| 2 | Hard-rules + AI error paths | Unit coverage dla logiki hard-rules na wszystkich kombinacjach kontekstu; integration testy ścieżek błędów endpointu generowania | R2, R3 | Unit (pure TS, zero IO), integration (mock AI SDK) | context/changes/testing-hard-rules-ai-errors/ | implementing |
| 3 | Security flows | Integration testy: zmiana hasła z i bez re-auth; flow oceniania (API persistence + date-gating logic) | R5, R6 | Integration | — | not started |
| 4 | E2E — krytyczne flow | `playwright.config.ts` + E2E test sign-in → generation (via `/10x-e2e` per CLAUDE.md) | R7, R3 (perspektywa przeglądarki) | Playwright E2E | — | not started |
| 5 | Quality gates wiring | Wdraża wymagane gate'y jako kroki CI; pre-commit hook dla szybkiej pętli lokalnej; aktualizuje §6 z finalnymi lokalizacjami i komendami | — | CI (GitHub Actions), local hook | — | not started |

---

## §4 Stack

| Warstwa | Wybór | Uwagi testowe |
|---|---|---|
| Język | TypeScript 5.x | Strict mode; typy są dowodem, nie zastępują testów behawioralnych |
| Frontend | Astro v6 + React v19 | Strony `.astro` bez logiki biznesowej — poza zakresem testów jednostkowych; interaktywne `.tsx` testowane przez integration HTTP, nie snapshot |
| Backend | Astro API routes na Cloudflare Workers | Workers runtime wymaga specyficznej konfiguracji test runnera (np. `@cloudflare/vitest-pool-workers`) — weryfikacja w Phase 1 |
| Database + Auth | Supabase (PostgreSQL + GoTrue) | Integration testy powinny używać local Supabase (`supabase start`) lub dedykowanej test-instancji z separacją danych |
| AI | Vercel AI SDK + Anthropic (`@ai-sdk/anthropic`) | W testach integration: mock Anthropic SDK — nie wołać prawdziwego API |
| CI | GitHub Actions | Obecny workflow: lint + build; quality gates dodane w Phase 4 |
| Test runner | Vitest (przewidywany) — **weryfikacja w Phase 1** | Brak konfiguracji w projekcie; Phase 1 bootstrapuje; checked: 2026-06-02 |

**Stack grounding tools (current session):**
- Docs: Context7 — nie dostępne w tej sesji; checked: 2026-06-02
- Search: Exa.ai — nie dostępne w tej sesji; checked: 2026-06-02
- Runtime/browser: Playwright MCP dostępny (`playwright-cli`); checked: 2026-06-08
- Provider/platform: Supabase MCP / GitHub MCP — nie dostępne; checked: 2026-06-02

Rekomendacje oparte wyłącznie na lokalnym manifeście, CLAUDE.md i archiwum zmian.

---

## §5 Quality Gates

| Gate | Typ | Wymagany / Zalecany | Kiedy | Status CI |
|---|---|---|---|---|
| Lint (ESLint + type-check) | Statyczny | Wymagany | Każdy push/PR | Już wdrożony (`npm run lint`) |
| Build | Kompilacja | Wymagany | Każdy push/PR | Już wdrożony (`npm run build`) |
| Unit + Integration tests | Dynamiczny | Wymagany — `required after §3 Phase 1` | Każdy push/PR | Nie wdrożony — Phase 1 bootstrapuje |
| E2E Playwright — krytyczne flow | Dynamiczny | Wymagany — `required after §3 Phase 4` | PR do main | Nie wdrożony — Phase 4 wdraża |
| Pre-commit hook (lint + typecheck) | Lokalny | Zalecany lokalnie (nie substytut CI) | Przed każdym commitem | Nie wdrożony — Phase 4 wdraża |
| Multimodal visual review | Selektywny | Opcjonalny — max 2 krytyczne ekrany (formularz kontekstu, widok checklisty) | Przy zmianach UI krytycznych ścieżek | Poza zakresem tego planu |

---

## §6 Cookbook

Sekcja rośnie wraz z każdą fazą rollout. Każda ukończona faza aktualizuje swój wpis z realną lokalizacją, nazwą, przykładowym testem i komendą uruchomienia.

### 6.1 Authorization / IDOR integration test

**Plik:** `tests/r1-idor.test.ts`
**Komenda:** `npm test` (prereqs: `supabase start` + `npm run dev` z lokalnym Supabase w `.dev.vars`)

Zestaw 6 scenariuszy: user B próbuje DELETE/POST/PATCH/GET na zasobach user A. Każdy endpoint zwraca 404 dzięki RLS + `.single()` pattern. Przykładowy assert:

```typescript
it("T1: DELETE /api/trips/:id as user B → 404; trip still exists for user A", async () => {
  const res = await http.delete(`/api/trips/${tripAId}`, { cookies: cookiesB });
  expect(res.status).toBe(404);

  const verify = await http.get(`/api/trips/${tripAId}/items-count`, { cookies: cookiesA });
  expect(verify.status).toBe(200);
});
```

Klucze do `.env.test.local` (nie commitowane): `TEST_SUPABASE_SERVICE_ROLE_KEY` i `TEST_SUPABASE_ANON_KEY` z `supabase status`.

### 6.2 Auth bypass / middleware integration test

**Plik:** `tests/r4-auth-bypass.test.ts`
**Komenda:** `npm test` (prereq: `npm run dev`)

Trzy testy — po jednym na każdą klasę trasy z `PROTECTED_ROUTES`. Request bez cookie, `redirect: "manual"`, sprawdzenie statusu 301–302 i nagłówka `Location`. Przykładowy assert:

```typescript
it("R4: GET /dashboard bez cookie → redirect /auth/signin", async () => {
  const res = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
  expect(res.status).toBeGreaterThanOrEqual(301);
  expect(res.status).toBeLessThanOrEqual(302);
  expect(res.headers.get("location")).toContain("/auth/signin");
});
```

### 6.3 Hard-rules unit test
TBD — see §3 Phase 2. Cel: unit test weryfikujący poprawność required/excluded dla każdej kombinacji kontekstu.

### 6.4 AI generation error path integration test
TBD — see §3 Phase 2. Cel: integration test z mockiem Anthropic SDK weryfikujący czytelny błąd zamiast cichej awarii.

### 6.5 Password re-auth integration test
TBD — see §3 Phase 3. Cel: integration test weryfikujący że zmiana hasła bez poprawnego starego hasła jest odrzucana.

### 6.6 Rating persistence + date-gating test
TBD — see §3 Phase 3. Cel: integration test API oceniania + unit test logiki daty pre/post-trip.

### 6.7 CI quality gates
TBD — see §3 Phase 5. Cel: krok CI uruchamiający testy z Phase 1–4 przy każdym PR.

### 6.8 E2E — signin → generation flow
TBD — see §3 Phase 4. Cel: Playwright E2E test sign-in → formularz kontekstu → streaming generowania → ≥1 element checklisty → URL `/trips/[id]`.

---

## §7 Negative Space

Co świadomie **nie** jest testowane i dlaczego:

| Obszar | Powód wykluczenia |
|---|---|
| UI snapshot tests komponentów Astro/.tsx | Q5 (wywiad): sypią się od refaktorów CSS/Tailwind, nic realnego nie chronią; wysoki maintenance, niski sygnał |
| Statyczne strony auth bez logiki biznesowej (signin/signup layout, landing) | Brak logiki biznesowej; blast radius niski; format zmienia się często |
| Generowane typy Supabase DB (`database.types.ts`) | Generowane automatycznie ze schematu — generator jest testem |
| Supabase RLS policies w izolacji | RLS testowane jako część integration testów HTTP — izolowany unit test policy nie odzwierciedla realnego flow |
| Zewnętrzne API Anthropic (real calls) | Koszt i niestabilność; w testach zawsze mock SDK |
| FR-003 reset hasła przez email | Parked w roadmapie jako nice-to-have; nie zaimplementowane |
| Offline access, eksport planów, udostępnianie | PRD §Non-Goals |

---

*Aktualizacja §3 statusów: `/10x-test-plan` (bez flag) rekonstruuje stan z dysku i prezentuje następny handoff.*
*Refresh: `/10x-test-plan --refresh` gdy pojawi się nowe top-3 ryzyko, `checked:` date > 3 miesiące, lub stack się zmienia.*
