# Trip/Plan DB Schema Implementation Plan

## Overview

Utworzenie schematu bazy danych Supabase dla planów podróży i pozycji checklisty (F-01). Celem jest przygotowanie trwałej warstwy danych, którą wykorzystają kolejne slices: S-01 (generowanie checklisty), S-02 (edycja i pakowanie), S-03 (biblioteka planów) i S-04 (ocenianie planu). Plan zawiera SQL migrację, polityki RLS oraz wygenerowane typy TypeScript.

## Current State Analysis

W kodzie nie ma żadnych własnych tabel ani migracji:
- `supabase/config.toml` — `schema_paths: []`, brak katalogu `supabase/migrations/`
- `src/lib/supabase.ts` — klient `@supabase/ssr` bez parametru generycznego `Database`
- Jedyne tabele w DB to Supabase Auth (`auth.users`, `auth.sessions`, itp.)
- Supabase CLI zainstalowane jako devDependency (`supabase ^2.23.4`)
- Klucz obcy dla user-owned data: `auth.users.id` (UUID)

## Desired End State

Po ukończeniu planu:
- `supabase/migrations/20260526000000_create_trips_checklist_items.sql` — plik migracji z tabelami, RLS i triggerami
- Tabele `trips` i `checklist_items` istnieją w lokalnym i remote Supabase
- RLS włączony: każdy user widzi i modyfikuje tylko swoje dane
- `src/lib/database.types.ts` — wygenerowane typy TS z schematu
- `src/lib/supabase.ts` — `createClient` zwraca `SupabaseClient<Database>`
- Eksportowane aliasy `Trip` i `ChecklistItem` gotowe do użycia w API routes

### Key Discoveries:

- `src/lib/supabase.ts:6` — klient może zwrócić `null` gdy env vars są niedostępne; wzorzec `if (!supabase) return redirect(...)` jest wymagany we wszystkich handlerach
- `supabase/config.toml:65` — `seed_paths: ["./seed.sql"]` odwołuje się do nieistniejącego pliku; migracje są niezależne od seed
- Projekt Supabase remote: `rhfjnksirzyvpzcfnklz` (z `SUPABASE_URL` w `.env`)
- RLS na `checklist_items` wymaga JOIN na `trips` (brak denormalizowanego `user_id` na tabeli itemów — świadoma decyzja)

## What We're NOT Doing

- Nie dodajemy `sort_order` na `checklist_items` — S-02 zdecyduje o kolejności
- Nie tworzymy osobnej tabeli kategorii — `category TEXT NOT NULL` wystarczy dla MVP
- Nie dodajemy soft delete — `deleted_at` nie jest wymagany przez PRD
- Nie tworzymy seed danych ani fixture'ów testowych
- Nie modyfikujemy logiki auth — middleware i klient Supabase pozostają bez zmian poza dodaniem typu generycznego

## Implementation Approach

Dwufazowe podejście: najpierw SQL (migracja + RLS), potem typy TS. Migracja jest atomiczna — jeden plik SQL obejmuje obie tabele, triggery i wszystkie polityki RLS. Po lokalnej weryfikacji (`supabase db reset`) generujemy typy i aktualizujemy klient. Na końcu push do remote i smoke test.

## Critical Implementation Details

**RLS na checklist_items przez JOIN**: Polityki na `checklist_items` używają `EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid())`. Nie ma kolumny `user_id` na tej tabeli — każde zapytanie do `checklist_items` bez `trip_id` w kontekście przejdzie przez ten JOIN. To świadoma decyzja; nie dodawaj `user_id` jako obejścia.

**Generowanie typów wymaga działającego local Supabase**: `supabase gen types typescript --local` łączy się z lokalnym DB na porcie 54322. Przed Phase 2 Supabase musi być uruchomiony (`supabase start`) i migracja musi być zastosowana.

---

## Phase 1: Migracja SQL — tabele, RLS, triggery

### Overview

Tworzymy jeden plik SQL migracji zawierający: funkcję `update_updated_at_column`, tabele `trips` i `checklist_items` z pełnymi constraintami, włączenie RLS i wszystkie polityki dostępu.

### Changes Required:

#### 1. Plik migracji

**File**: `supabase/migrations/20260526000000_create_trips_checklist_items.sql`

**Intent**: Jedyna migracja F-01 — definiuje cały schemat danych potrzebny dla slices S-01 do S-04 oraz wymusza bezpieczeństwo danych na poziomie bazy przez RLS.

**Contract**:

```sql
-- Trigger function reused by both tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- trips table
CREATE TABLE trips (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT,
  start_date          DATE        NOT NULL,
  accommodation_type  TEXT        NOT NULL CHECK (accommodation_type IN ('hotel', 'tent', 'hammock', 'bivy', 'hostel')),
  riding_philosophy   TEXT        NOT NULL CHECK (riding_philosophy IN ('fast_and_light', 'expedition')),
  region              TEXT        NOT NULL,
  trip_duration_days  INTEGER     NOT NULL CHECK (trip_duration_days > 0),
  flew_by_plane       BOOLEAN     NOT NULL DEFAULT false,
  pre_trip_rating     INTEGER     CHECK (pre_trip_rating BETWEEN 1 AND 6),
  post_trip_rating    INTEGER     CHECK (post_trip_rating BETWEEN 1 AND 6),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- checklist_items table
CREATE TABLE checklist_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  category   TEXT        NOT NULL,
  source     TEXT        NOT NULL CHECK (source IN ('ai', 'user', 'rule')),
  is_packed  BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at triggers
CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS on trips
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_trips"   ON trips FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_trips"   ON trips FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_update_own_trips"   ON trips FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_delete_own_trips"   ON trips FOR DELETE USING (user_id = auth.uid());

-- RLS on checklist_items (via JOIN — no denormalized user_id)
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_items" ON checklist_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "users_insert_own_items" ON checklist_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "users_update_own_items" ON checklist_items FOR UPDATE
  USING  (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "users_delete_own_items" ON checklist_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));
```

### Success Criteria:

#### Automated Verification:

- Migracja lokalnie wykonuje się bez błędów: `supabase db reset`
- Tabele istnieją w lokalnym DB: `supabase db diff` nie zgłasza dryftu po resecie

#### Manual Verification:

- Supabase Studio (`http://localhost:54323`) pokazuje tabele `trips` i `checklist_items` ze wszystkimi kolumnami
- W Studio > Authentication > Policies obie tabele mają po 4 polityki RLS
- Wstawienie rekordu do `trips` z `user_id ≠ auth.uid()` przez Supabase JS zwraca błąd RLS
- Wstawienie `checklist_item` do cudzego `trip_id` zwraca błąd RLS

**Implementation Note**: Po ukończeniu Phase 1 i weryfikacji lokalnej poczekaj na ręczne potwierdzenie, że RLS działa poprawnie, zanim przejdziesz do Phase 2.

---

## Phase 2: Typy TypeScript + wdrożenie remote

### Overview

Generujemy typy TypeScript z lokalnego schematu, aktualizujemy klienta Supabase do wersji typed, eksportujemy aliasy typów dla API routes. Następnie pushujemy migrację do remote Supabase i weryfikujemy.

### Changes Required:

#### 1. Wygeneruj typy z lokalnego DB

**File**: `src/lib/database.types.ts` (nowy plik, generowany)

**Intent**: Źródło prawdy o typach tabel dla całego projektu — generowany automatycznie, nie edytowany ręcznie.

**Contract**: Uruchom `supabase gen types typescript --local --schema public > src/lib/database.types.ts`. Plik zawiera interfejs `Database` z sekcją `public.Tables.trips.Row` i `public.Tables.checklist_items.Row`.

#### 2. Zaktualizuj klienta Supabase

**File**: `src/lib/supabase.ts`

**Intent**: Przekaż wygenerowany typ `Database` do `createServerClient` i wyeksportuj aliasy typów, które API routes będą importować bezpośrednio.

**Contract**: Zmień sygnaturę `createServerClient` na `createServerClient<Database>(...)`. Dodaj na końcu pliku:

```ts
import type { Database } from "@/lib/database.types";
// ...
return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, { ... });
// ...
export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type ChecklistItem = Database["public"]["Tables"]["checklist_items"]["Row"];
```

#### 3. Wdróż migrację na remote Supabase

**File**: brak zmian w kodzie

**Intent**: Upewnić się, że remote Supabase (projekt `rhfjnksirzyvpzcfnklz`) ma identyczny schemat co lokalne środowisko.

**Contract**: CLI musi być uwierzytelniony (weryfikacja: `supabase projects list`). Jeśli zwraca "Access token not provided", uruchom najpierw `supabase login`. Następnie zlinkuj projekt: `supabase link --project-ref rhfjnksirzyvpzcfnklz`. Na końcu: `supabase db push`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi bez błędów TypeScript (typy tabel są widoczne)
- `src/lib/database.types.ts` istnieje i zawiera `Tables: { trips: ..., checklist_items: ... }`

#### Manual Verification:

- Remote Supabase Dashboard (`https://supabase.com/dashboard/project/rhfjnksirzyvpzcfnklz/editor`) pokazuje obie tabele
- Remote Supabase > Authentication > Policies: 4 polityki na `trips`, 4 na `checklist_items`
- Import `import type { Trip } from "@/lib/supabase"` w dowolnym API route nie powoduje błędu TS

**Implementation Note**: Po Phase 2 zaktualizuj `change.md` ustawiając `status: implemented`. F-01 jest ukończone.

---

## Testing Strategy

### Manual Testing Steps:

1. Uruchom Supabase lokalnie: `supabase start`
2. Zastosuj migrację: `supabase db reset`
3. Otwórz Studio: `http://localhost:54323`
4. Sprawdź tabele i polityki RLS w Studio
5. Przez Studio SQL Editor: spróbuj wstawić `trips` record z niepoprawnym `user_id` (powinno fail z RLS error)
6. Wygeneruj typy i zweryfikuj build: `supabase gen types typescript --local --schema public > src/lib/database.types.ts && npm run lint`

## Migration Notes

Migracja jest nie-destrukcyjna (tworzy nowe tabele, nie modyfikuje istniejących). Rollback: `DROP TABLE checklist_items; DROP TABLE trips; DROP FUNCTION update_updated_at_column;` — bezpieczne dopóki nie ma danych produkcyjnych.

## References

- PRD: `context/foundation/prd.md` — FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
- Roadmap: `context/foundation/roadmap.md` — F-01, ryzyko płaskiej listy bez kategorii
- Klient Supabase: `src/lib/supabase.ts`
- Middleware auth: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migracja SQL — tabele, RLS, triggery

#### Automated

- [x] 1.1 Migracja lokalnie wykonuje się bez błędów: `supabase db reset` — 642aa1a
- [x] 1.2 `supabase db diff` nie zgłasza dryftu po resecie — 642aa1a

#### Manual

- [x] 1.3 Studio pokazuje tabele `trips` i `checklist_items` ze wszystkimi kolumnami — 642aa1a
- [x] 1.4 Obie tabele mają po 4 polityki RLS w Studio — 642aa1a
- [x] 1.5 Wstawienie rekordu z cudzym `user_id` zwraca błąd RLS — 642aa1a

### Phase 2: Typy TypeScript + wdrożenie remote

#### Automated

- [x] 2.1 `npm run lint` przechodzi bez błędów TypeScript — a38da38
- [x] 2.2 `src/lib/database.types.ts` istnieje i zawiera `trips` oraz `checklist_items` — a38da38

#### Manual

- [x] 2.3 Remote Dashboard pokazuje obie tabele z poprawnymi kolumnami — a38da38
- [x] 2.4 Remote Policies: 4 polityki na `trips`, 4 na `checklist_items` — a38da38
- [x] 2.5 Import `Trip` i `ChecklistItem` z `@/lib/supabase` nie powoduje błędu TS — a38da38
