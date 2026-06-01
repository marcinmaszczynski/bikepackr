# Plan Library Implementation Plan

## Overview

Dodanie usuwania planów (FR-011) zamykające slice S-03. FR-009 (przeglądanie zapisanych planów) zostało w pełni dostarczone przez S-02 — dashboard wyświetla listę planów, a `/trips/[id]` renderuje pełną checklistę. Jedyną brakującą funkcją jest usuwanie planu.

## Current State Analysis

S-02 dostarczyło:
- `src/pages/dashboard.astro` — lista kart planów (Astro SSR, statyczne renderowanie)
- `src/pages/trips/[id].astro` + `src/components/ChecklistView.tsx` — widok szczegółów
- Endpointy CRUD pozycji checklisty pod `/api/trips/[id]/items/`
- Tabela `trips` z RLS DELETE policy (`users_delete_own_trips`) w migracji

Brakuje:
- Endpointu `DELETE /api/trips/[id]` — brak pliku `src/pages/api/trips/[id].ts`
- Triggera usuwania w UI dashboardu

## Desired End State

Użytkownik klika ikonę usuwania na karcie planu w dashboardzie, potwierdza inline (Usuń / Anuluj), a karta znika z listy bez przeładowania strony. Baner błędu pojawia się, jeśli usunięcie po stronie serwera nie powiedzie się. Nawigacja do `/trips/[id]` dla pozostałych planów działa bez zmian.

### Key Discoveries:

- RLS policy `users_delete_own_trips` już istnieje (`supabase/migrations/20260526000000_create_trips_checklist_items.sql:54`)
- Brak pliku `src/pages/api/trips/[id].ts` — bezpieczne do stworzenia obok istniejącego katalogu `[id]/`
- `checklist_items` ma `ON DELETE CASCADE` od trips — usunięcie tripa automatycznie czyści pozycje
- Wzorzec API: auth check → supabase client → select-to-verify ownership → operacja (`src/pages/api/trips/[id]/items.ts:4-19`)
- Dashboard renderuje karty inline w Astro — wymaga ekstrakcji do React dla interaktywnego usuwania
- Wzorzec błędu: `errorMsg` state + dismissible banner (`src/components/ChecklistView.tsx:90-102`)

## What We're NOT Doing

- Usuwanie z poziomu strony szczegółów planu (`/trips/[id]`)
- Usuwanie zbiorcze (bulk delete)
- Wyszukiwanie, filtrowanie ani sortowanie planów
- Ocenianie planów (S-04)

## Implementation Approach

Dwie fazy: najpierw endpoint DELETE (brak ryzyka UI), potem ekstrakcja listy kart do `PlanList.tsx` z inline potwierdzeniem i optymistycznym usunięciem stanu. Komponent podąża wzorcem `ChecklistView.tsx` — `initialTrips` → lokalny state, usunięcie po sukcesie API, `errorMsg` przy błędzie.

## Phase 1: DELETE API Endpoint

### Overview

Dodać `DELETE /api/trips/{id}` zgodnie z ustalonym wzorcem auth → supabase → verify-ownership → operacja.

### Changes Required:

#### 1. Endpoint usuwania tripa

**File**: `src/pages/api/trips/[id].ts`

**Intent**: Obsługa `DELETE /api/trips/{id}` — uwierzytelnij wywołującego, zweryfikuj własność tripa przez select (spójne z `items.ts:16-19`), a następnie usuń wiersz. `checklist_items` usunie się kaskadowo.

**Contract**: Eksport `DELETE: APIRoute`. Zwraca 204 przy sukcesie; 401 (brak usera), 503 (brak klienta Supabase), 404 (trip nie istnieje lub nie należy do wywołującego per RLS), 500 (błąd delete). Nie zwraca body przy 204.

### Success Criteria:

#### Automated Verification:

- Build przechodzi: `npm run build`
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- `DELETE /api/trips/<valid-id>` z ważną sesją → 204; trip i jego pozycje znikają z DB
- `DELETE /api/trips/<id-innego-usera>` → 404 (RLS blokuje, select zwraca nothing)
- `DELETE /api/trips/<nieprawidłowy-uuid>` → 404

**Implementation Note**: Po ukończeniu tej fazy i pozytywnej weryfikacji manualnej, zatrzymaj się na potwierdzenie człowieka przed przejściem do fazy 2. Phase blocks używają plain bullets — odpowiadające `- [ ]` checkboxy dla tych pozycji żyją w sekcji `## Progress` na dole planu.

---

## Phase 2: PlanList Component + Dashboard Refactor

### Overview

Wydzielić karty planów z `dashboard.astro` do nowego komponentu `PlanList.tsx` (React), który obsługuje inline potwierdzenie usunięcia i optymistyczne usunięcie karty ze stanu.

### Changes Required:

#### 1. PlanList React component

**File**: `src/components/PlanList.tsx`

**Intent**: Renderuj listę kart planów (lub empty state) z interaktywnym usuwaniem. Każda karta to klikalny `<a>` do nawigacji plus przycisk usuwania pozycjonowany poza linkiem. Po kliknięciu delete — inline "Usuń / Anuluj" zastępuje ikonę. Po potwierdzeniu wywołaj `DELETE /api/trips/{id}`, usuń kartę ze stanu lokalnego. Przy błędzie API pokaż dismissible `errorMsg` banner (wzorzec z `ChecklistView.tsx:90-102`).

**Contract**: Przyjmuje `initialTrips: TripSummary[]` gdzie `TripSummary = { id: string; title: string | null; start_date: string; accommodation_type: string; created_at: string }`. Wewnętrzny state: `trips`, `pendingDeleteId: string | null`, `deletingId: string | null`, `errorMsg: string | null`. Layout karty: `<div className="relative">` owijający `<a>` do nawigacji (z `pr-12` by tekst nie wchodził pod przycisk) plus absolutnie pozycjonowana para trigger/confirm w prawym górnym rogu. `accommodationLabels` słownik przeniesiony do PlanList.tsx z dashboard.astro.

#### 2. Refaktor dashboardu

**File**: `src/pages/dashboard.astro`

**Intent**: Zastąp blok `trips.map()` Astro komponentem `<PlanList>` React, przekazując pobrane SSR-owo tripy jako `initialTrips`. Nagłówek, przycisk "Nowy plan" i formularz wylogowania pozostają w Astro.

**Contract**: `<PlanList initialTrips={trips} client:load />`. Usuń istniejący blok `{trips.length === 0 ? ... : <ul>...</ul>}` w całości — PlanList obsługuje oba stany (pusty i niepusty). Usuń `accommodationLabels` z dashboard.astro (przeniesione do PlanList.tsx). Zapytanie Supabase w frontmatter pozostaje bez zmian.

### Success Criteria:

#### Automated Verification:

- Build przechodzi: `npm run build`
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- Ikona usuwania widoczna na każdej karcie planu; kliknięcie nie wyzwala nawigacji
- Kliknięcie delete pokazuje inline "Usuń / Anuluj" — kliknięcie Anuluj przywraca ikonę
- Kliknięcie Usuń wywołuje DELETE; karta znika z listy bez przeładowania strony
- Przeładowanie strony po usunięciu — plan nie wraca (DB usunięty)
- Błąd API (np. DevTools offline) → baner errorMsg, karta pozostaje
- Empty state renderuje się po usunięciu wszystkich planów
- Nawigacja do `/trips/[id]` dla pozostałych planów działa

**Implementation Note**: Po fazie 2, manualne testy obejmują pełny happy path i error path przed oznaczeniem jako done.

---

## Testing Strategy

### Manual Testing Steps:

1. Zaloguj się; utwórz 2 testowe plany przez flow generowania
2. Na dashboardzie kliknij delete na planie 1 → potwierdź inline → karta znika
3. Odśwież dashboard → plan 1 nadal nie widoczny (DB usunięty)
4. Kliknij delete na planie 2 → kliknij Anuluj → plan 2 pozostaje
5. Zasymuluj błąd sieci (DevTools → offline) → kliknij delete → baner błędu widoczny, karta pozostaje
6. Usuń ostatni plan → zweryfikuj empty state

## References

- S-03 roadmap entry: `context/foundation/roadmap.md:125-135`
- Wzorzec API: `src/pages/api/trips/[id]/items.ts`
- Wzorzec komponentu interaktywnego: `src/components/ChecklistView.tsx`
- RLS delete policy: `supabase/migrations/20260526000000_create_trips_checklist_items.sql:54`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: DELETE API Endpoint

#### Automated

- [x] 1.1 Build przechodzi: `npm run build` — 90311f7
- [x] 1.2 Lint przechodzi: `npm run lint` — 90311f7

#### Manual

- [ ] 1.3 DELETE z ważną sesją → 204; trip i pozycje znikają z DB
- [ ] 1.4 DELETE cudzego tripa → 404
- [ ] 1.5 DELETE nieprawidłowego UUID → 404

### Phase 2: PlanList Component + Dashboard Refactor

#### Automated

- [x] 2.1 Build przechodzi: `npm run build`
- [x] 2.2 Lint przechodzi: `npm run lint`

#### Manual

- [ ] 2.3 Ikona delete widoczna, nie wyzwala nawigacji
- [ ] 2.4 Inline confirm: Anuluj przywraca ikonę; Usuń usuwa kartę ze stanu
- [ ] 2.5 Błąd API → errorMsg banner, karta zostaje
- [ ] 2.6 Empty state po usunięciu wszystkich planów
- [ ] 2.7 Nawigacja do szczegółów pozostałych planów działa
