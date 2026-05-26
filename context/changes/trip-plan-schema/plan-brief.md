# Trip/Plan DB Schema — Plan Brief

> Full plan: `context/changes/trip-plan-schema/plan.md`

## What & Why

F-01 tworzy warstwę danych dla całego rdzenia produktu. Bez tabel `trips` i `checklist_items` żaden z kolejnych slices (S-01 do S-04) nie może ruszyć. Celem jest atomiczy schemat SQL z RLS, który egzekwuje prywatność danych na poziomie bazy — nie tylko w middleware.

## Starting Point

Supabase CLI jest zainstalowany, projekt zlinkowany, klient SSR działa w auth flow. Brak jednak jakichkolwiek własnych tabel — `schema_paths: []` w `config.toml`, brak katalogu `supabase/migrations/`. Klient `createClient()` nie ma parametru generycznego `Database`.

## Desired End State

Po ukończeniu planu: tabele `trips` i `checklist_items` istnieją lokalnie i w remote Supabase, RLS blokuje dostęp między użytkownikami, `src/lib/database.types.ts` zawiera wygenerowane typy, a `createClient()` zwraca `SupabaseClient<Database>` z gotowymi aliasami `Trip` i `ChecklistItem`.

## Key Decisions Made

| Decision | Choice | Why (1 zdanie) | Source |
| --- | --- | --- | --- |
| Przechowywanie kontekstu wyjazdu | Osobne kolumny | Query-ability dla S-03, czytelne typy TS, 6 pól jest stabilnych per PRD | Plan |
| Kategoryzacja itemów | `category TEXT NOT NULL` | Eliminuje ryzyko ze roadmapy (płaska lista utrudni S-02/S-03) bez overhead'u osobnej tabeli | Plan |
| Usuwanie planów | Hard delete | PRD nie wymaga recycle bin; prostsze RLS bez `deleted_at` | Plan |
| Tytuł planu | `title TEXT NULL` | Frontend generuje fallback z kontekstu; nie blokuje UX w S-03 | Plan |
| Źródło itemów | `source TEXT CHECK (ai\|user\|rule)` | Frontend może oznaczyć rule-items jako nie-usuwalne; tanie teraz, kosztowne jako backfill | Plan |
| Lot samolotem | `flew_by_plane BOOLEAN DEFAULT false` | US-01 AC wymienia lot jako przykład reguły; tanie w schemacie, F-02 decyduje o logice | Plan |
| Sort order | Brak | YAGNI — PRD nie wymaga drag-and-drop w MVP; S-02 doda gdy potrzeba | Plan |
| RLS na checklist_items | JOIN na trips.user_id | Brak denormalizacji; czysty schemat; wydajność OK dla wolumenów MVP | Plan |

## Scope

**In scope:**
- Tabela `trips` z 6 polami kontekstu + 2 polami ocen (pre/post)
- Tabela `checklist_items` z `category`, `source`, `is_packed`
- Trigger `updated_at` na obu tabelach
- RLS: 4 polityki na każdej tabeli (SELECT/INSERT/UPDATE/DELETE)
- Generowanie `src/lib/database.types.ts` z Supabase CLI
- Aktualizacja `src/lib/supabase.ts` do wersji typed + eksport `Trip`, `ChecklistItem`
- Push migracji do remote Supabase

**Out of scope:**
- Logika API (endpoints CRUD) — to należy do S-01/S-02
- Seed danych testowych
- Soft delete
- Sort order na itemach
- Zmiany w auth flow

## Architecture / Approach

Jedna migracja SQL (`supabase/migrations/20260526000000_create_trips_checklist_items.sql`) obejmuje cały schemat — obie tabele, triggery i RLS — żeby F-01 był atomiczny i odwracalny. Typy TS generowane przez CLI (nie pisane ręcznie), co zapewnia sync między DB a kodem. RLS na `checklist_items` działa przez JOIN zamiast denormalizacji `user_id`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migracja SQL | Tabele, triggery, RLS lokalnie i gotowe do push | RLS na JOIN może mieć subtelne edge case'y — weryfikuj ręcznie w Studio |
| 2. Typy TS + remote | Typed klient, gotowe aliasy, schema w remote DB | `supabase gen types` wymaga działającego local Supabase (`supabase start` musi być uruchomiony) |

**Prerequisites:** `supabase start` działa lokalnie; projekt zlinkowany z remote (`supabase link --project-ref rhfjnksirzyvpzcfnklz`)
**Estimated effort:** ~1 sesja, 2 fazy

## Open Risks & Assumptions

- `flew_by_plane` jest w schemacie, ale logika reguły (wyklucz kuchenki gazowe) to decyzja F-02 — schema jest gotowa, ale bez tej logiki pole jest martwe do S-01
- Remote Supabase może wymagać ponownego linkowania jeśli `supabase/config.toml` `project_id` nie pasuje do `rhfjnksirzyvpzcfnklz`

## Success Criteria (Summary)

- `supabase db reset` i `npm run lint` przechodzą czysto
- Supabase Studio (lokalnie i remote) pokazuje obie tabele z poprawnymi politykami RLS
- Import `Trip` i `ChecklistItem` z `@/lib/supabase` dostępny bez błędów TS
