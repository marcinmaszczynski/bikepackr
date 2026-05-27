# First Gated Generation Implementation Plan (S-01)

## Overview

S-01 to rdzeń produktu: zalogowany użytkownik wypełnia formularz kontekstu wyjazdu i widzi wygenerowaną przez AI checklistę ekwipunku z zastosowanymi regułami sztywnymi. Wynik pojawia się strumieniowo w < 30 s z ciągłym progress wizualnym. Implementacja łączy cztery warstwy: rozszerzone reguły sztywne (TS) → endpoint generowania (API + DB + AI stream) → formularz i UI streamingu (React).

## Current State Analysis

- **DB gotowe** — tabele `trips` i `checklist_items` z pełnym RLS w Supabase; `src/lib/supabase.ts` eksportuje `createClient`, `Trip`, `ChecklistItem`
- **Hard-rules** — `src/lib/hard-rules.ts` istnieje z `evaluateHardRules()` + `buildHardRulesSection()`; zaimplementowana tylko reguła hostelowa (`accommodation_type === 'hostel'`)
- **AI streaming** — wzorzec zweryfikowany w F-02: `streamText().toTextStreamResponse()` działa na Cloudflare Workers; `ai@^6.0.191` + `@ai-sdk/anthropic@^3.0.79` w `package.json`
- **Komponenty formularza** — `FormField`, `SubmitButton`, `ServerError` gotowe w `src/components/auth/`; `FormField` obsługuje tylko `<input>`, nie `<select>` — `TripContextForm` buduje własne pola
- **Auth** — middleware (`src/middleware.ts`) chroni trasy z `PROTECTED_ROUTES`; `context.locals.user` dostępny w API routes
- **Tymczasowe pliki do usunięcia** — `src/pages/generate/test.astro`, `src/pages/api/generate/test.ts`, `src/components/GenerateTest.tsx` (oznaczone w F-02 jako tymczasowe)

### Key Discoveries:

- `src/lib/supabase.ts:6` — `createClient(requestHeaders, cookies)` zwraca `null` gdy brak env vars; wzorzec w `onFinish` closurze: client tworzony w handler i przechwytywany przez closure — request headers są dostępne przez cały czas życia Workers request
- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard"]`; dodanie `/trips` chroni całą poddrzewę
- `supabase/migrations/…:13-14` — CHECK constraints: `accommodation_type IN ('hotel', 'tent', 'hammock', 'bivy', 'hostel')`, `riding_philosophy IN ('fast_and_light', 'expedition')`
- `checklist_items.source` CHECK: `IN ('ai', 'user', 'rule')` — items z AI generowania mają `source: 'ai'`
- Vercel AI SDK `streamText` ma callback `onFinish({ text })` — jedyne miejsce gdzie można zapisać parsowane items do DB bez drugiego round-tripu od klienta
- `toTextStreamResponse()` zwraca `Response` — można owinąć w `new Response(body, { headers: {..., 'X-Trip-Id': tripId} })` żeby przekazać trip_id do klienta

## Desired End State

Po ukończeniu planu: zalogowany użytkownik na stronie `/trips/new` wypełnia 5 pól kontekstu (accommodation_type, riding_philosophy, region, start_date, trip_duration_days) + opcjonalny tytuł, klika "Generuj checklistę", widzi strumieniujący markdown w czasie rzeczywistym, a po zakończeniu — zgrupowaną listę pozycji per kategoria z informacją o zapisie. Rekord `trips` i pozycje `checklist_items` (source='ai') zapisane w Supabase. Reguły sztywne (hostel, namiot/hamak/bivy, fast_and_light) bezwzględnie odwzorowane w prompcie.

### Weryfikacja końcowa:
1. Wypełnij formularz (np. namiot + fast_and_light + Tatry + 3 dni)
2. Kliknij "Generuj" — obserwuj strumieniujący tekst
3. Weryfikuj: brak ciężkiego obozu (wykluczone przez fast_and_light), śpiwór i mata obecne (wymagane przez namiot)
4. Po zakończeniu: structured view z podziałem na kategorie
5. W Supabase Table Editor: rekord w `trips` + pozycje w `checklist_items` z `source='ai'`

## What We're NOT Doing

- Nie budujemy `GET /trips/:id` (widoku planu) — to S-03
- Nie dodajemy edycji checklisty (dodawanie/usuwanie) — to S-02
- Nie implementujemy toggle `is_packed` — to S-02
- Nie dodajemy oceniania (pre/post trip rating) — to S-04
- Nie budujemy biblioteki planów (`/trips`) — to S-03
- Nie dodajemy reguły `flew_by_plane` — parkowana do v2; checkbox nie pojawia się w formularzu
- Nie walidujemy poprawności wygenerowanej checklisty semantycznie — min 10 pozycji to jedyny guard
- Strona `/generate/test` i komponent `GenerateTest` są usuwane w tej zmianie

## Implementation Approach

Trzy fazy w ścisłej zależności: faza 1 (pure TS, zero runtime) → faza 2 (backend: endpoint + parsowanie + usunięcie testowych plików F-02) → faza 3 (frontend: formularz + streaming UI). Każda faza buduje na poprzedniej. Kluczowy wybór architektoniczny: jeden endpoint `POST /api/generate/checklist` — tworzy trip, strumieniuje AI, zapisuje items w `onFinish`. Klient weryfikuje zapis przez `GET /api/trips/:id/items-count` po zakończeniu strumienia.

## Critical Implementation Details

**`onFinish` closure i Supabase client**: `createClient(context.request.headers, context.cookies)` tworzony przed streamingiem jest przechwytywany przez closure w `onFinish`. Na Cloudflare Workers request context żyje dopóki response stream jest otwarty — po zamknięciu strumienia `onFinish` uruchamia się wciąż w scope tego samego fetch handlera. Cookies.set może być no-op (response już wysłany), ale `getAll()` (czytanie JWT z Cookie headera) działa.

**X-Trip-Id header pattern**: `result.toTextStreamResponse()` zwraca `Response`. Nie można mutować jej headers po stworzeniu. Wzorzec: `new Response(streamResponse.body, { headers: { ...Object.fromEntries(streamResponse.headers.entries()), 'X-Trip-Id': tripId } })`.

**Trip INSERT przed streamingiem**: trip_id musi istnieć przed `streamText()` (jest potrzebny w `onFinish` do INSERT checklist_items i w headerze). Jeśli streaming zawiedzie po INSERT trips — trip pozostaje bez items (osierocony rekord). Akceptowalne dla S-01 MVP.

---

## Phase 1: Extended hard-rules module

### Overview

Rozszerza `src/lib/hard-rules.ts` o reguły dla noclegów kempingowych (namiot/hamak/bivy → wymagane: śpiwór i mata) oraz filozofii jazdy (fast_and_light → wykluczone: ciężki obóz). Te reguły są wstrzykiwane do promptu AI w fazie 2.

### Changes Required:

#### 1. Hard-rules module

**File**: `src/lib/hard-rules.ts`

**Intent**: Dodaj dwie nowe gałęzie reguł do `evaluateHardRules()`: nocleg kempingowy (wymagane podstawowe posłanie) i filozofia fast_and_light (wykluczone ciężkie elementy obozowe).

**Contract**:
```ts
// Nowe gałęzie w evaluateHardRules(), po istniejącej hostel-branch:

if (['tent', 'hammock', 'bivy'].includes(context.accommodation_type)) {
  required.push('śpiwór', 'karimat / mata do spania');
}

if (context.riding_philosophy === 'fast_and_light') {
  excluded.push('krzesło campingowe', 'stolik campingowy');
}
```

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi bez błędów TypeScript

#### Manual Verification:

- `evaluateHardRules({ accommodation_type: 'tent', riding_philosophy: 'fast_and_light' })` zwraca `required: ['śpiwór', 'karimat / mata do spania']` i `excluded: ['krzesło campingowe', 'stolik campingowy']`
- `evaluateHardRules({ accommodation_type: 'hostel', riding_philosophy: 'expedition' })` zwraca `excluded: ['sleeping bag', 'camping mattress', 'tent'], required: ['sleep sack / liner']` (istniejąca reguła bez zmian)
- `evaluateHardRules({ accommodation_type: 'hotel', riding_philosophy: 'expedition' })` zwraca puste arrays

---

## Phase 2: AI generation endpoint

### Overview

Tworzy `POST /api/generate/checklist` — serce S-01. Endpoint waliduje sesję, tworzy rekord `trips`, buduje polski prompt z regułami sztywnymi, strumieniuje AI i zapisuje `checklist_items` w `onFinish`. Dodaje też `GET /api/trips/:id/items-count` do weryfikacji zapisu po stronie klienta. Usuwa tymczasowe pliki z F-02.

### Changes Required:

#### 1. Markdown-to-items parser

**File**: `src/lib/checklist-parser.ts` (nowy plik)

**Intent**: Czysty parser bez side-effectów, który konwertuje markdown wygenerowany przez AI na tablicę obiektów gotowych do INSERT do `checklist_items`.

**Contract**:
```ts
export interface ParsedItem {
  name: string;
  category: string;
}

export function parseMarkdownToItems(text: string): ParsedItem[]
```

Parser iteruje po liniach: `## Kategoria` → ustawia bieżącą kategorię (default: "Inne"), `- nazwa` → dodaje item. Puste linie i inne linie są ignorowane.

#### 2. Streaming generation endpoint

**File**: `src/pages/api/generate/checklist.ts` (nowy plik)

**Intent**: Obsługuje cały przepływ generowania: walidacja → INSERT trip → hard rules → prompt → stream z onFinish (INSERT items) → zwraca stream z X-Trip-Id.

**Contract**:
```
POST /api/generate/checklist
Content-Type: application/json

Body:
{
  accommodation_type: string,  // 'hotel'|'tent'|'hammock'|'bivy'|'hostel'
  riding_philosophy: string,   // 'fast_and_light'|'expedition'
  region: string,
  start_date: string,          // YYYY-MM-DD
  trip_duration_days: number,  // >= 1
  title?: string
}

Responses:
401 — użytkownik niezalogowany
400 — brakujące / nieprawidłowe pola
503 — brak ANTHROPIC_API_KEY lub brak Supabase client
500 — błąd INSERT trips
200 — text/plain streaming (markdown) + header X-Trip-Id: <uuid>
```

Kolejność kroków w handlerze:
1. `context.locals.user` — jeśli null → 401
2. Waliduj wymagane pola body (obecność + typy)
3. `createClient(context.request.headers, context.cookies)` — jeśli null → 503
4. Sprawdź `ANTHROPIC_API_KEY` — jeśli undefined → 503
5. `supabase.from('trips').insert({user_id, accommodation_type, riding_philosophy, region, start_date, trip_duration_days, title: title ?? null, flew_by_plane: false}).select('id').single()` → trip_id; jeśli błąd → 500
6. `buildHardRulesSection({accommodation_type, riding_philosophy})` → wstrzyknij do promptu
7. Derywuj porę roku z `start_date` (miesiące 12/1/2 → "zima", 3-5 → "wiosna", 6-8 → "lato", 9-11 → "jesień")
8. `streamText({ model, system: systemPrompt, prompt: userContext, onFinish })` — onFinish: `parseMarkdownToItems(text)` → `supabase.from('checklist_items').insert(items.map(i => ({trip_id, name: i.name, category: i.category, source: 'ai'})))` (bez rzucania — log błąd)
9. `const streamResponse = result.toTextStreamResponse()` → `new Response(streamResponse.body, { headers: { ...headers, 'X-Trip-Id': tripId } })`

**System prompt (Polish)**:
```
Jesteś ekspertem od bikepacking. Generujesz checklisty ekwipunku po polsku.

FORMAT:
Grupuj pozycje według kategorii używając "## Nazwa kategorii".
Każda pozycja zaczyna się od "- ".
Tylko lista — bez wstępu, podsumowania ani wyjaśnień.
Minimum 10 pozycji łącznie.

{hard_rules_section}
```

**User prompt (dynamiczny)**:
```
Kontekst wyjazdu:
- Nocleg: {accommodation_type_pl}
- Filozofia jazdy: {riding_philosophy_pl}
- Region: {region}
- Pora roku: {season}
- Czas trwania: {trip_duration_days} dni
```

#### 3. Trip items count check endpoint

**File**: `src/pages/api/trips/[id]/items-count.ts` (nowy plik)

**Intent**: Lekki endpoint używany przez klienta po zakończeniu strumienia do weryfikacji czy `onFinish` zapisał items do DB.

**Contract**:
```
GET /api/trips/:id/items-count

Responses:
401 — niezalogowany
503 — brak Supabase client
200 — { count: number }
```

Używa `supabase.from('checklist_items').select('*', { count: 'exact', head: true }).eq('trip_id', id)` — RLS gwarantuje że user widzi tylko własne items. Supabase zwraca `count: number | null`; obsługuj null: `const count = data?.count ?? 0; return Response.json({ count })`.

#### 4. Usunięcie tymczasowych plików F-02

**Files**: `src/pages/api/generate/test.ts`, `src/pages/generate/test.astro`, `src/components/GenerateTest.tsx`

**Intent**: Pliki oznaczone jako tymczasowe w F-02 (komentarz "Zostanie usunięta w S-01"); ich usunięcie jest częścią dostarczenia S-01.

**Contract**: Pliki nie istnieją po tej fazie. Upewnij się że żaden istniejący plik nie importuje tych komponentów.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi bez błędów TypeScript
- `npm run build` kończy się sukcesem
- Tymczasowe pliki F-02 nie istnieją w repozytorium

#### Manual Verification:

- `curl -X POST http://localhost:4321/api/generate/checklist` bez auth zwraca 401
- `curl -X POST http://localhost:4321/api/generate/checklist` z auth i prawidłowymi polami strumieniuje markdown w języku polskim
- Response header `X-Trip-Id` obecny w odpowiedzi
- Po zakończeniu strumienia: rekord w `trips` widoczny w Supabase Table Editor
- Po zakończeniu strumienia: `GET /api/trips/:id/items-count` zwraca `count > 0`
- Dla accommodation_type='tent' + riding_philosophy='fast_and_light': śpiwór i mata obecne, krzesło campingowe nieobecne w wygenerowanej liście

---

## Phase 3: Trip context form + streaming UI

### Overview

Tworzy stronę `/trips/new` z wielofazowym komponentem React: form → streaming (markdown) → success (zgrupowana lista) / error (baner + zachowany markdown). Chroni trasę `/trips` przez middleware.

### Changes Required:

#### 1. Protected route expansion

**File**: `src/middleware.ts`

**Intent**: Rozszerz ochronę na całe poddrzewo `/trips` — wszystkie przyszłe strony w tej sekcji (lista planów, widok planu) będą chronione bez kolejnych zmian middleware.

**Contract**: `PROTECTED_ROUTES = ["/dashboard", "/trips"]`

#### 2. Trip context form + streaming display component

**File**: `src/components/TripContextForm.tsx` (nowy plik)

**Intent**: Komponent React zarządzający maszyną stanów: formularz z 5 wymaganymi polami → streaming z raw markdown → structured view po zakończeniu / error view przy błędzie.

**Contract**:
```ts
export function TripContextForm(): JSX.Element
```

**Stan komponentu**:
```ts
type Phase = 'form' | 'streaming' | 'verifying' | 'success' | 'error';
```

- `phase: Phase` — aktualna faza
- `streamedText: string` — akumulowany markdown podczas streamingu
- `tripId: string | null` — z headera `X-Trip-Id`
- `parsedItems: Array<{ category: string; items: string[] }>` — zgrupowane po categorii dla success view
- `errorMessage: string | null`

**Pola formularza** (wszystkie wymagane z wyjątkiem title):
- `accommodation_type` — `<select>`: Hotel/Pensjonat, Namiot, Hamak, Bivy bag, Hostel/Schronisko → wartości: hotel, tent, hammock, bivy, hostel
- `riding_philosophy` — `<select>`: Fast & Light (lekko i szybko), Ekspedycyjny → wartości: fast_and_light, expedition
- `region` — `<input type="text">` placeholder: "np. Tatry, Szkocja, Alpy"
- `start_date` — `<input type="date">`
- `trip_duration_days` — `<input type="number" min="1">`
- `title` — `<input type="text">` opcjonalne, placeholder: "Nazwa planu (opcjonalnie)"

**Submit handler** (fetch-based, nie HTML form action; `SubmitButton` z `src/components/auth/` nie nadaje się — `useFormStatus()` wymaga natywnego form submit, przy fetch `pending` zawsze `false`; używaj lokalnego stanu `isLoading: boolean`; typ handlera: `React.SyntheticEvent<HTMLFormElement>` — `React.FormEvent` deprecated w React v19):
1. Walidacja client-side: wszystkie wymagane pola wypełnione
2. `setPhase('streaming')`, `setStreamedText('')`
3. `const res = await fetch('/api/generate/checklist', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(formData) })`
4. Jeśli `!res.ok`: `setPhase('error')`, `setErrorMessage(await res.text())`; return
5. `tripId = res.headers.get('X-Trip-Id')` → `setTripId(tripId)`
6. Stream: `ReadableStream reader` + `TextDecoder` + `for (;;)` loop — akumuluj tekst w `streamedText`
7. Po zakończeniu strumienia: `setPhase('verifying')`
8. `GET /api/trips/${tripId}/items-count` → jeśli `count > 0`: parse markdown → `setParsedItems(grouped)`, `setPhase('success')`; jeśli `count === 0`: `setPhase('error')`, zachowaj `streamedText`

**Success view**: Dla każdej kategorii — nagłówek sekcji + `<ul>` z pozycjami. Disclaimer: "Lista wygenerowana przez AI — może być niepełna." Badge z liczbą pozycji.

**Error view**: Czerwony baner z komunikatem. Jeśli `streamedText` niepuste — zachowany `<pre>` z wygenerowanym tekstem poniżej banera.

**Streaming view**: `<pre>` z `streamedText` + kursor animowany (▋ jeśli `phase === 'streaming'`). Brak formularza w tym widoku.

#### 3. Trip context form page

**File**: `src/pages/trips/new.astro` (nowy plik)

**Intent**: Minimalna strona Astro ładująca `TripContextForm` po stronie klienta — analogicznie do wzorca ze stron auth.

**Contract**:
```astro
---
import { TripContextForm } from "@/components/TripContextForm";
---
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <title>Nowa checklista — Bikepackr</title>
  </head>
  <body>
    <TripContextForm client:load />
  </body>
</html>
```

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi bez błędów TypeScript
- `npm run build` kończy się sukcesem

#### Manual Verification:

- `/trips/new` bez sesji → redirect do `/auth/signin`
- `/trips/new` z sesją → formularz renderuje się z wszystkimi polami
- Submit z pustymi polami → pola wymagane zablokowane przez HTML5 validation
- Pełny flow: wypełnij wszystkie pola → kliknij "Generuj" → widzisz strumieniujący markdown → po zakończeniu: zgrupowana structured view z podziałem na kategorie
- NFR: ciągły progress wizualny widoczny podczas generowania (tokeny pojawiają się stopniowo)
- NFR: pełny wynik pojawia się w < 30 s od kliknięcia submit
- Disclaimer "Lista wygenerowana przez AI — może być niepełna" widoczny w success view
- Dla reguł: namiot + fast_and_light → śpiwór i mata MUSZĄ być na liście; krzesło campingowe NIE MOŻE być

---

## Testing Strategy

### Manual Testing Steps:

1. Zaloguj się (`npm run dev` + `/auth/signin`)
2. Przejdź do `/trips/new`
3. Wypełnij: Namiot / Fast & Light / Tatry / [data] / 3 dni
4. Kliknij "Generuj checklistę" i obserwuj streaming
5. Sprawdź structured view po zakończeniu
6. W Supabase Table Editor zweryfikuj `trips` + `checklist_items`
7. Powtórz z Hostel / Expedition → zweryfikuj reguły hostelowe

### Edge Cases:

- Brak `ANTHROPIC_API_KEY` → endpoint zwraca 503 z czytelnym komunikatem
- Brak połączenia Supabase → endpoint zwraca 503
- AI generuje < 10 pozycji → items-count = mała liczba (warn: aktualnie tylko log, nie blokuje)

## References

- PRD: `context/foundation/prd.md` — US-01, FR-005, FR-006, §Business Logic
- Roadmap: `context/foundation/roadmap.md` — S-01
- F-01 (archived): `context/archive/2026-05-26-trip-plan-schema/plan.md`
- F-02 (archived): `context/archive/2026-05-26-ai-generation-scaffold/plan.md`
- Hard rules module: `src/lib/hard-rules.ts`
- Supabase client: `src/lib/supabase.ts`
- Streaming wzorzec: `src/pages/api/generate/test.ts` (usuwane w tej zmianie)
- Auth middleware: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extended hard-rules module

#### Automated

- [x] 1.1 `npm run lint` przechodzi bez błędów TypeScript — 401281e

#### Manual

- [x] 1.2 `evaluateHardRules({ accommodation_type: 'tent', riding_philosophy: 'fast_and_light' })` zwraca wymagane: śpiwór + mata, wykluczone: krzesło + stolik — 401281e
- [x] 1.3 `evaluateHardRules({ accommodation_type: 'hostel', riding_philosophy: 'expedition' })` zwraca niezmienioną regułę hostelową — 401281e
- [x] 1.4 `evaluateHardRules({ accommodation_type: 'hotel', riding_philosophy: 'expedition' })` zwraca puste arrays — 401281e

### Phase 2: AI generation endpoint

#### Automated

- [x] 2.1 `npm run lint` przechodzi bez błędów TypeScript
- [x] 2.2 `npm run build` kończy się sukcesem
- [x] 2.3 Tymczasowe pliki F-02 (`generate/test.astro`, `api/generate/test.ts`, `GenerateTest.tsx`) nie istnieją

#### Manual

- [x] 2.4 `POST /api/generate/checklist` bez auth zwraca 401
- [x] 2.5 Endpoint strumieniuje polski markdown
- [x] 2.6 Response header `X-Trip-Id` obecny w odpowiedzi
- [x] 2.7 Po zakończeniu strumienia: rekord w `trips` w Supabase
- [x] 2.8 `GET /api/trips/:id/items-count` zwraca `count > 0` po zakończeniu strumienia
- [x] 2.9 Reguły sztywne odzwierciedlone w wygenerowanej liście (namiot → śpiwór+mata, fast_and_light → brak krzesła)

### Phase 3: Trip context form + streaming UI

#### Automated

- [ ] 3.1 `npm run lint` przechodzi bez błędów TypeScript
- [ ] 3.2 `npm run build` kończy się sukcesem

#### Manual

- [ ] 3.3 `/trips/new` bez sesji → redirect do `/auth/signin`
- [ ] 3.4 Formularz renderuje się poprawnie z wszystkimi wymaganymi polami
- [ ] 3.5 Submit z pustymi polami → pola wymagane zablokowane przez HTML5 validation
- [ ] 3.6 Pełny flow end-to-end: submit → streaming → structured view z kategoriami
- [ ] 3.7 NFR: ciągły progress wizualny podczas generowania (tokeny pojawiają się stopniowo)
- [ ] 3.8 NFR: wynik pojawia się w < 30 s
- [ ] 3.9 Disclaimer "Lista wygenerowana przez AI — może być niepełna" widoczny
- [ ] 3.10 Reguły sztywne poprawnie odwzorowane w UI (weryfikacja end-to-end)
