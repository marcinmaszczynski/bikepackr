---
date: 2026-06-02T17:30:00+02:00
researcher: Claude Sonnet 4.6
git_commit: f1b94cef6ae241e101ce36aecc005cdae449b6b7
branch: main
repository: bikepackr
topic: "Hard-rules unit tests and AI generation error paths (R2, R3)"
tags: [research, hard-rules, ai-generation, unit-tests, error-handling, R2, R3]
status: complete
last_updated: 2026-06-02
last_updated_by: Claude Sonnet 4.6
---

# Research: Hard-rules unit tests and AI generation error paths (R2, R3)

**Date**: 2026-06-02T17:30:00+02:00
**Researcher**: Claude Sonnet 4.6
**Git Commit**: f1b94ce
**Branch**: main
**Repository**: bikepackr

## Research Question

Zbadaj R2 (regresja hard-rules) i R3 (awaria generowania AI): znajdź kontrakt funkcji hard-rules, wszystkie gałęzie reguł, ścieżkę błędu endpointu generowania, oraz określ najtańszą warstwę testów z oraclem wywiedzionym ze źródeł (PRD), nie z implementacji.

## Summary

**R2:** `evaluateHardRules()` to czysta funkcja 28 linii (`src/lib/hard-rules.ts:10-28`) — zero IO, zero sieci, deterministyczna. Wszystkie 3 gałęzie reguł są w pełni pokrywalne unit testami. Oracle można wywieść wyłącznie z PRD §Business Logic bez czytania implementacji. Najtańsza warstwa: unit test (Vitest, brak mocków).

**R3:** Endpoint `/api/generate/checklist` (`src/pages/api/generate/checklist.ts`) odsyła HTTP 200 natychmiast przed startem streamu — błędy Anthropic API pojawiają się w strumieniu, nie jako kod błędu HTTP. `onFinish` (linia 115) jest jedynym miejscem zapisu do DB i nie jest wywoływany przy błędach streamu. Brak `onError` callbacka i brak walidacji wyjścia. Dwie testowalne warstwy: (a) unit test `parseMarkdownToItems()` (czysta funkcja), (b) hermetic test endpointu z `MockLanguageModelV1` z Vercel AI SDK.

## Detailed Findings

### R2: Logika hard-rules

#### Funkcja i kontrakt

**Plik:** `src/lib/hard-rules.ts:10-28`

```typescript
type HardRuleContext = Pick<Trip, "accommodation_type" | "riding_philosophy">;

export interface HardRuleResult {
  excluded: string[];
  required: string[];
}

export function evaluateHardRules(context: HardRuleContext): HardRuleResult
```

Funkcja przyjmuje dwa pola z modelu `Trip`: `accommodation_type` (string, enum: `hotel | tent | hammock | bivy | hostel`) i `riding_philosophy` (string, enum: `fast_and_light | expedition`). Zwraca `{ excluded: string[], required: string[] }`.

#### Trzy gałęzie reguł (pełna mapa, linie 14–25)

| Warunek | EXCLUDED | REQUIRED |
|---|---|---|
| `accommodation_type === "hostel"` | "śpiwór", "karimat / mata do spania", "namiot" | "wkład do śpiwora / prześcieradło turystyczne" |
| `accommodation_type` in `["tent", "hammock", "bivy"]` | — | "śpiwór", "karimat / mata do spania" |
| `riding_philosophy === "fast_and_light"` | "krzesło campingowe", "stolik campingowy" | — |

**Przypadek bazowy:** `hotel` + `expedition` → `{ excluded: [], required: [] }` — żadna reguła nie odpala.

Gałęzie są **niezależne** — mogą nakładać się (np. hostel + fast_and_light). Kolejność aplikowania: najpierw hostel, potem outdoor, potem filozofia.

#### Brak reguł poza zakresem (świadome ograniczenia)

- Lot samolotem (`flew_by_plane`) — zebrany w DB, nie użyty w hard-rules; PRD §Non-Goals: "zakazy przewozowe poza scope v1"
- Region / sezon — zebrane dla AI prompt (`buildHardRulesSection`), nie wpływają na `evaluateHardRules()`
- Hotel — nie triggeruje ani outdoor gear, ani hostel rules; `{ excluded: [], required: [] }`

#### Oracle (źródło: PRD, nie implementacja)

PRD §AC US-01 (linia 62–65):
> "Reguły sztywne są bezwzględne: np. jeśli użytkownik zaznaczył lot samolotem — kuchenka gazowa nie pojawia się na liście. Filozofia jazdy (fast&light vs oblężnicza) wpływa na proponowany zestaw — wyniki są różne dla różnych deklaracji."

PRD §Business Logic (linia 112–113):
> "Reguły sztywne są nadrzędne wobec sugestii kontekstowych: określone kombinacje kontekstu wykluczają lub wymuszają konkretne elementy bezwzględnie (np. nocleg w schronisku → liner do śpiwora zamiast śpiwora)."

PRD §Business Logic (linia 113): Przykład wprost: **schronisko → liner zamiast śpiwora** — to jest oracle dla gałęzi hostel, niezależny od implementacji.

**Macierz testów (8 kombinacji, pełne pokrycie gałęzi):**

| # | accommodation | philosophy | expected REQUIRED | expected EXCLUDED |
|---|---|---|---|---|
| T1 | hostel | expedition | ["wkład do śpiwora / prześcieradło turystyczne"] | ["śpiwór", "karimat / mata do spania", "namiot"] |
| T2 | hostel | fast_and_light | ["wkład do śpiwora / prześcieradło turystyczne"] | ["śpiwór", "karimat / mata do spania", "namiot", "krzesło campingowe", "stolik campingowy"] |
| T3 | tent | expedition | ["śpiwór", "karimat / mata do spania"] | [] |
| T4 | tent | fast_and_light | ["śpiwór", "karimat / mata do spania"] | ["krzesło campingowe", "stolik campingowy"] |
| T5 | hammock | fast_and_light | ["śpiwór", "karimat / mata do spania"] | ["krzesło campingowe", "stolik campingowy"] |
| T6 | bivy | expedition | ["śpiwór", "karimat / mata do spania"] | [] |
| T7 | hotel | fast_and_light | [] | ["krzesło campingowe", "stolik campingowy"] |
| T8 | hotel | expedition | [] | [] |

T2 i T5 to kluczowe kombinacje — T2 łączy obie reguły hostel+fast_and_light, T5 odróżnia hammock od hostel.

#### Istniejące testy

Brak — `grep -r "evaluateHardRules\|hard-rules" tests/` zwraca pustą odpowiedź. Funkcja eksportowana, importowalna bezpośrednio.

---

### R3: Ścieżka błędu endpointu generowania AI

#### Endpoint

**Plik:** `src/pages/api/generate/checklist.ts`
**Route:** POST `/api/generate/checklist`
**Response type:** `text/event-stream` (SSE) przez `result.toTextStreamResponse()`
**AI SDK:** Vercel AI SDK `streamText()` z `@ai-sdk/anthropic` (`claude-haiku-4-5-20251001`)

#### Ścieżki błędów pre-stream (poprawnie obsłużone)

| Scenariusz | HTTP | Linia |
|---|---|---|
| Brak sesji | 401 | 34–36 |
| Nieprawidłowy JSON | 400 | 39–43 |
| Brakujące/nieprawidłowe pola | 400 | 47–60 |
| Supabase niekonfigurowany | 503 | 63–65 |
| Brak ANTHROPIC_API_KEY | 503 | 67–69 |
| Błąd tworzenia tripu | 500 | 86–88 |

Wszystkie zwracają właściwe kody błędów przed startem streamu.

#### Ścieżki błędów post-stream — luki (linie 111–136)

**Kluczowa właściwość Vercel AI SDK:** `streamText()` nie rzuca wyjątku synchronicznie. Odpowiedź HTTP 200 jest wysyłana natychmiast, przed odbiorem czegokolwiek od Anthropic. Błędy Anthropic API trafiają do streamu jako zdarzenia błędu, nie jako wyjątki HTTP.

```
streamText() → result.toTextStreamResponse() → new Response(body, {status: 200})
                                                       ↑
                                               wysłane PRZED odpowiedzią Anthropic
```

| Scenariusz | Co się dzieje | Czy PRD "jasny błąd" jest spełniony? |
|---|---|---|
| Anthropic 401/429/500 | HTTP 200, błąd w strumieniu, `onFinish` nie wywoływany, items_count = 0 | Pośrednio — klient sprawdza items_count i pokazuje komunikat |
| Timeout streamu | HTTP 200, stream się urywa, `onFinish` nie wywoływany | Pośrednio — klient widzi pusty rezultat |
| Pusta odpowiedź AI (`text = ""`) | HTTP 200, `onFinish({ text: "" })` wywoływany, `parseMarkdownToItems("")` → [], insert [] | Pośrednio — items_count = 0, klient pokazuje błąd |
| Nieparsowalne markdown | HTTP 200, `onFinish` wywoływany z tekstem, parser zwraca [], insert [] | Pośrednio — items_count = 0, klient pokazuje błąd |

**Brak `onError` callbacka** (linia 111–128): `streamText()` jest wywołany z `onFinish` only. Błędy stream-level nie są przechwytywane na poziomie endpointu.

#### `parseMarkdownToItems` — czysta funkcja (`src/lib/checklist-parser.ts:6-23`)

```typescript
export function parseMarkdownToItems(text: string): ParsedItem[]
```

Parsuje markdown z formatem `## Kategoria` + `- element`. Zawsze zwraca tablicę (nigdy nie rzuca). Przypadki brzegowe:
- `""` → `[]`
- Tekst bez nagłówków `##` → wszystkie elementy w kategorii "Inne"
- Tekst bez bulletów `-` → `[]`
- Mix poprawnych i niepoprawnych linii → tylko poprawne elementy

#### `onFinish` — gwarancja wywołania

Linia 115–127: callback wywołany **wyłącznie gdy stream zakończy się normalnie**. W ramach `context.locals.cfContext.waitUntil()` — zapis do DB odbywa się w tle po wysłaniu odpowiedzi HTTP. Błąd insertu (linia 123–125) logowany do `console.error`, nie propagowany do klienta.

#### Konkluzja dla testu

PRD §AC US-01 mówi: "generowanie nigdy nie kończy się milczącą awarią". Obecna implementacja spełnia to **pośrednio** przez client-side items-count check (klient widzi błąd "Nie udało się zapisać checklisty"). Nie jest to "cicha awaria" z punktu widzenia użytkownika, ale ochrona jest fragile — zależy od logiki klienta, nie serwera.

**Dwie testowalne warstwy dla R3:**

1. **Unit test `parseMarkdownToItems`** — czysta funkcja, zero mocking. Oracle z PRD: funkcja musi zwracać `[]` dla pustego stringa, właściwe elementy dla poprawnego markdown.

2. **Hermetic unit test endpointu** z `MockLanguageModelV1` (Vercel AI SDK test utils). Wymaga mockowania: Astro context (`locals.user`, `cookies`), Supabase client, AI SDK. Trudniejsze, ale wykonalne. Alternatywnie: test walidacji wejściowej (linie 47–60) przez HTTP integration (nie wymaga AI SDK mock).

**Co NIE jest sensowne do testowania:**
- HTTP integration test błędu Anthropic API przez działający dev server — wymaga przekierowania wywołań AI SDK do mocka w runtime, co nie jest wspierane przez Vitest w środowisku HTTP.

## Code References

- `src/lib/hard-rules.ts:1-43` — `evaluateHardRules()` i `buildHardRulesSection()`
- `src/lib/hard-rules.ts:10-28` — główna logika, 3 gałęzie reguł
- `src/lib/checklist-parser.ts:6-23` — `parseMarkdownToItems()`, czysta funkcja
- `src/pages/api/generate/checklist.ts:33-137` — endpoint POST, pełna ścieżka
- `src/pages/api/generate/checklist.ts:111-128` — `streamText()` + `onFinish` callback
- `src/pages/api/generate/checklist.ts:130-136` — `toTextStreamResponse()` → HTTP 200 przed streamem
- `supabase/migrations/20260526000000_create_trips_checklist_items.sql:16-17` — enum check constraints
- `package.json` — `"ai": "^6.0.191"`, `"@ai-sdk/anthropic": "^3.0.79"`

## Architecture Insights

**R2 — Hard-rules są izolowane od AI:**
Hard-rules (`evaluateHardRules`) i system prompt (`buildHardRulesSection`) są rozdzielone. Funkcja jest używana dwukrotnie: raz w endpoincie do budowania prompt (linia 91), a wynik jest przekazywany AI jako constraint. Hard-rules NIE są weryfikowane na wyjściu — AI może je zignorować bez żadnego wykrycia przez aplikację.

**R3 — Streaming-first architecture:**
Vercel AI SDK `streamText()` wysyła HTTP 200 natychmiast i strumieniuje odpowiedź. To design choice (dobre UX - użytkownik widzi generowanie na żywo), ale implikuje że błędy warstwy AI nie mogą być mapowane na kody HTTP błędów bez zmiany architektury na non-streaming.

**`cfContext.waitUntil()` — background task:**
Zapis checklisty do DB (`onFinish`) odbywa się po wysłaniu odpowiedzi HTTP. To poprawny pattern dla Cloudflare Workers, ale testowanie go wymaga uwzględnienia asynchroniczności.

## Open Questions

1. **Czy `MockLanguageModelV1` z `ai/test` jest dostępny w wersji `ai@^6.0.191`?** Należy zweryfikować przed planowaniem hermetic tests dla R3. Jeśli nie — alternatywa to `vi.mock("ai")`.

2. **Jak testować `onFinish` w kontekście `cfContext.waitUntil()`?** Hermetic test musiałby mockować `context.locals.cfContext`, co oznacza mockowanie całego Astro context.

3. **Czy R3 hermetic test jest warty kosztu setupu?** `parseMarkdownToItems` unit test daje real signal (oracle z PRD) przy zerowym koszcie. Hermetic endpoint test jest droższy i testuje warstwę SDK, nie logikę biznesową. Plan powinien decydować świadomie.
