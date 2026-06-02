---
change_id: testing-hard-rules-ai-errors
title: Hard-rules unit tests and AI error path integration tests (Phase 2)
status: planned
created: 2026-06-02
updated: 2026-06-02
---

# Plan: testing-hard-rules-ai-errors

## Overview

Rollout Phase 2: unit testy R2 (hard-rules) i R3 (AI error path). Pokrywa ryzyka R2 i R3 z `context/foundation/test-plan.md §2`.

**Decyzje z planowania:**
- R2: 6 kombinacji (T1–T6) pokrywających wszystkie 3 gałęzie reguł; hotel bez fast_and_light / hotel bez expedition pominięte
- R3: unit `parseMarkdownToItems` + hermetic endpoint test z `MockLanguageModelV3` + `onError` fix w endpoincie
- Produkcyjny fix: dodajemy `onError` callback do `streamText()` w `src/pages/api/generate/checklist.ts`

**Istniejąca infrastruktura (Phase 1):**
- Vitest skonfigurowany: `tests/**/*.test.ts`, `environment: "node"`, `hookTimeout: 60000`, alias `@` → `src/`
- `ai@^6.0.191` eksportuje `MockLanguageModelV3` z `ai/test`

---

## Phase 1: R2 — Hard-rules unit tests

### Overview

Tworzy `tests/r2-hard-rules.test.ts` z 6 kombinacjami kontekstu w `it.each`. Zero mocking, zero IO — bezpośredni import `evaluateHardRules` z `src/lib/hard-rules.ts`. Oracle pochodzi z PRD §Business Logic i §AC US-01, nie z implementacji.

**6 kombinacji (z research.md tabeli T1–T6):**

| # | accommodation | philosophy | expected required | expected excluded |
|---|---|---|---|---|
| T1 | hostel | expedition | ["wkład do śpiwora / prześcieradło turystyczne"] | ["śpiwór", "karimat / mata do spania", "namiot"] |
| T2 | hostel | fast_and_light | ["wkład do śpiwora / prześcieradło turystyczne"] | ["śpiwór", "karimat / mata do spania", "namiot", "krzesło campingowe", "stolik campingowy"] |
| T3 | tent | expedition | ["śpiwór", "karimat / mata do spania"] | [] |
| T4 | tent | fast_and_light | ["śpiwór", "karimat / mata do spania"] | ["krzesło campingowe", "stolik campingowy"] |
| T5 | hammock | fast_and_light | ["śpiwór", "karimat / mata do spania"] | ["krzesło campingowe", "stolik campingowy"] |
| T6 | bivy | expedition | ["śpiwór", "karimat / mata do spania"] | [] |

**Uwaga:** T2 jest kluczowy — łączy hostel + fast_and_light (nakładające się gałęzie). T5 odróżnia hammock od hostel (oba mają śpiwór w required, ale z różnych gałęzi reguł).

### Changes Required

- Utwórz `tests/r2-hard-rules.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { evaluateHardRules } from "@/lib/hard-rules";

  const cases = [
    { accommodation_type: "hostel", riding_philosophy: "expedition", required: [...], excluded: [...] },
    // ... T1–T6
  ] as const;

  describe("evaluateHardRules — R2 hard-rules regression", () => {
    it.each(cases)("$accommodation_type + $riding_philosophy", ({ accommodation_type, riding_philosophy, required, excluded }) => {
      const result = evaluateHardRules({ accommodation_type, riding_philosophy });
      expect(result.required).toEqual(required);
      expect(result.excluded).toEqual(excluded);
    });
  });
  ```

### Success Criteria

#### Automated
- `npm test` — wszystkie 6 kombinacji (`it.each`) zielone
- `npm run lint` — brak błędów TS

#### Manual
- [ ] 1.2 Sprawdź że asercje są dosłownie z tabeli research.md (T1–T6), nie skopiowane z `src/lib/hard-rules.ts` — oracle musi być niezależny od implementacji

---

## Phase 2: R3a — parseMarkdownToItems unit tests

### Overview

Tworzy `tests/r3-checklist-parser.test.ts` z 4 przypadkami brzegowymi `parseMarkdownToItems`. Zero mocking. Oracle: funkcja zawsze zwraca tablicę (nigdy nie rzuca); `""` → `[]`; prawidłowy markdown → właściwe `ParsedItem[]`; tekst bez nagłówków `##` → kategoria `"Inne"`; brak bullet `-` → `[]`.

### Changes Required

- Utwórz `tests/r3-checklist-parser.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { parseMarkdownToItems } from "@/lib/checklist-parser";

  describe("parseMarkdownToItems — R3a parser edge cases", () => {
    it("pusty string zwraca []", () => { ... });
    it("prawidłowy markdown zwraca ParsedItem[] z kategoriami", () => { ... });
    it("tekst bez nagłówków ## zwraca elementy w kategorii Inne", () => { ... });
    it("tekst bez bullet - zwraca []", () => { ... });
  });
  ```

### Success Criteria

#### Automated
- `npm test` — wszystkie 4 przypadki zielone
- `npm run lint` — brak błędów TS

---

## Phase 3: R3b — onError callback w endpoincie generowania

### Overview

Dodaje `onError` callback do `streamText()` w `src/pages/api/generate/checklist.ts` (linia 111–128). Callback: `console.error` z detalem błędu streamu. Eliminuje cichą awarię na poziomie serwera; umożliwia obserwację błędu w Phase 4.

Callback jest informacyjny — SDK obsługuje błąd wewnętrznie (stream kończy się bez danych); `waitUntil` i zapis do DB nie są wywoływane gdy `onError` odpala zamiast `onFinish`.

### Changes Required

- Edytuj `src/pages/api/generate/checklist.ts` — dodaj `onError` do wywołania `streamText()` (po `onFinish`):
  ```typescript
  onError: ({ error }) => {
    console.error("AI stream error", error);
  },
  ```

### Success Criteria

#### Automated
- `npm run lint` — brak błędów TS
- `npm run build` — build przechodzi bez błędów

#### Manual
- [ ] 3.2 Sprawdź że `onError` nie zmienia zachowania happy-path: uruchom `npm run dev` i wygeneruj checklistę — stream działa jak przed zmianą

---

## Phase 4: R3c — Hermetic endpoint test

### Overview

Tworzy `tests/r3-ai-endpoint.test.ts`. Importuje handler `POST` bezpośrednio (nie przez HTTP). Mockuje:
- `astro:env/server` — virtual moduł Astro; potrzebny alias w `vitest.config.ts`
- `@ai-sdk/anthropic` — `vi.mock` zwracający model z `MockLanguageModelV3`
- `@/lib/supabase` — `vi.mock` zwracający stub klienta

**Dwa scenariusze:**

1. **Błąd AI** (`doStream` rzuca) → `onError` jest wołany → `waitUntil` NIE jest wołany (brak zapisu do DB)
2. **Pusta odpowiedź AI** (`doStream` zwraca pusty stream) → `onFinish({ text: "" })` → `parseMarkdownToItems("")` = `[]` → `waitUntil` wołany z pustą tablicą (insert `[]`)

**Strategia weryfikacji:** `vi.spyOn(console, "error")` dla scenariusza 1; `vi.fn()` na `waitUntil` dla obu.

**Konsumpcja streamu:** Vercel AI SDK wywołuje `onError`/`onFinish` asynchronicznie podczas odczytu streamu. Test musi skonsumować `response.body` do końca przed asercją.

### Changes Required

- Utwórz `tests/mocks/astro-env-server.ts`:
  ```typescript
  export const ANTHROPIC_API_KEY = "test-api-key";
  export const SUPABASE_URL = "http://127.0.0.1:54321";
  export const SUPABASE_KEY = "test-anon-key";
  ```

- Edytuj `vitest.config.ts` — dodaj alias `"astro:env/server"`:
  ```typescript
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "astro:env/server": resolve(__dirname, "./tests/mocks/astro-env-server.ts"),
    },
  },
  ```

- Utwórz `tests/r3-ai-endpoint.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { MockLanguageModelV3 } from "ai/test";
  import { POST } from "@/pages/api/generate/checklist";

  vi.mock("@ai-sdk/anthropic");
  vi.mock("@/lib/supabase");

  // buildMockContext(model) → APIContext z locals.user, cookies, cfContext.waitUntil
  // consumeStream(response) → odczyta body do końca; zwraca accumulated text

  describe("POST /api/generate/checklist — R3c hermetic", () => {
    it("błąd AI → onError wołany, waitUntil nie wołany", async () => { ... });
    it("pusta odpowiedź AI → waitUntil wołany z [] elementami", async () => { ... });
  });
  ```

### Success Criteria

#### Automated
- `npm test` — oba scenariusze zielone
- `npm run lint` — brak błędów TS

#### Manual
- [ ] 4.4 Sprawdź że test faktycznie wołał `onError` w scenariuszu błędu (nie przeszedł bo mock jest too permissive) — dodaj chwilowy `console.log` w onError i uruchom test, jeśli pojawi się output to callback działa

---

## Phase 5: Cookbook update

### Overview

Aktualizuje `context/foundation/test-plan.md`: §6.3 (R2), §6.4 (R3) i §3 Phase 2 status → `complete`.

### Changes Required

- Edytuj `context/foundation/test-plan.md`:
  - §6.3: lokalizacja `tests/r2-hard-rules.test.ts`, komenda `npm test`, przykładowy assert z `it.each`
  - §6.4: lokalizacja `tests/r3-checklist-parser.test.ts` + `tests/r3-ai-endpoint.test.ts`, komenda `npm test`, przykładowy assert
  - §3 Phase 2: `status: change opened` → `status: complete`

### Success Criteria

#### Manual
- [ ] 5.1 Przeczytaj §6.3 i §6.4 — wpisy są konkretne (ścieżki, komendy, przykłady), nie TBD

---

## Progress

### Phase 1: R2 unit tests

#### Automated
- [x] 1.1 Utwórz tests/r2-hard-rules.test.ts z it.each T1–T6

#### Manual
- [x] 1.2 Sprawdź oracle — asercje z tabeli research.md, nie z implementacji

### Phase 2: R3a parser unit tests

#### Automated
- [ ] 2.1 Utwórz tests/r3-checklist-parser.test.ts z 4 przypadkami brzegowymi

### Phase 3: R3b onError fix

#### Automated
- [ ] 3.1 Dodaj onError callback do streamText() w src/pages/api/generate/checklist.ts
- [ ] 3.2 npm run lint + npm run build — zielone

#### Manual
- [ ] 3.3 Sprawdź że happy-path streamu nadal działa po dodaniu onError

### Phase 4: R3c hermetic endpoint test

#### Automated
- [ ] 4.1 Utwórz tests/mocks/astro-env-server.ts
- [ ] 4.2 Dodaj alias astro:env/server w vitest.config.ts
- [ ] 4.3 Utwórz tests/r3-ai-endpoint.test.ts z 2 scenariuszami
- [ ] 4.4 npm test — oba scenariusze zielone

#### Manual
- [ ] 4.5 Zweryfikuj że onError jest faktycznie wołany (nie false positive)

### Phase 5: Cookbook update

#### Manual
- [ ] 5.1 Zaktualizuj §6.3, §6.4, §3 Phase 2 w test-plan.md
