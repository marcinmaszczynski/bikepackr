---
date: 2026-06-02T00:00:00+00:00
researcher: claude-sonnet-4-6
git_commit: 2046a8bf72e4716a621e1fa87d6a6ef5684d1d6a
branch: main
repository: marcinmaszczynski/bikepackr
topic: "R1 IDOR — weryfikacja własności zasobów w endpointach API"
tags: [research, security, idor, authorization, rls, supabase, integration-tests]
status: complete
last_updated: 2026-06-02
last_updated_by: claude-sonnet-4-6
---

# Research: R1 IDOR — weryfikacja własności zasobów w endpointach API

**Date**: 2026-06-02
**Researcher**: claude-sonnet-4-6
**Git Commit**: 2046a8bf72e4716a621e1fa87d6a6ef5684d1d6a
**Branch**: main
**Repository**: marcinmaszczynski/bikepackr

## Research Question

Jakie endpointy przyjmują zewnętrzne ID zasobu i jak weryfikowana jest własność zasobu (RLS vs. aplikacyjny pre-check vs. oba)? Cel: zbudować oracle dla integration testów IDOR (R1 z test-plan.md §2).

## Summary

Projekt stosuje **dwuwarstwową ochronę**: Supabase RLS jako warstwa DB oraz jawne ownership check jako warstwa aplikacyjna. Jednak ochrona jest **nierównomierna** — trzy endpointy mają jawny pre-check ownership, dwa endpointy polegają wyłącznie na RLS. Klient używa ANON_KEY + JWT z cookies, więc RLS działa poprawnie (auth.uid() jest wypełniony). Middleware chroni trasy przed niezalogowanymi, ale nie weryfikuje własności zasobu — to odpowiedzialność każdego endpointu.

**Kluczowy wniosek dla testów:** RLS przy prawidłowo skonfigurowanym kliencie jest skuteczną ochroną IDOR. Jednak brak jawnego ownership check w DELETE /api/trips/[id] i PATCH /api/trips/[id]/rating to luka defensywna — jeśli RLS wyłączone lub klient zostanie zmieniony na SERVICE_ROLE_KEY, oba endpointy stają się podatne. Test integration musi to udowodnić przez 2 sesje HTTP, nie przez unit test polityki RLS.

---

## Detailed Findings

### 1. Architektura weryfikacji własności

Projekt stosuje wzorzec defense-in-depth z trzema warstwami:

1. **Middleware** (`src/middleware.ts`) — weryfikuje WYŁĄCZNIE obecność sesji, nie własność zasobu
2. **API endpoint** — jawny ownership check (select tripu przed operacją) — stosowany niejednorodnie
3. **Supabase RLS** — polityki DB wymuszające `user_id = auth.uid()` — jedyna konsekwentna warstwa

Klient Supabase (`src/lib/supabase.ts:10`) używa `ANON_KEY` z JWT z cookies sesji → `auth.uid()` w RLS jest wypełniony poprawnie. SERVICE_ROLE_KEY nie jest eksponowany w kodzie aplikacji.

### 2. Mapa endpointów z zewnętrznymi ID zasobów

| Endpoint | Metoda | Param URL | Tabela | Jawny ownership check | RLS | Status ochrony |
|----------|--------|-----------|--------|----------------------|-----|----------------|
| `src/pages/api/trips/[id].ts` | DELETE | `[id]` → tripId | trips | ❌ NIE | ✅ `users_delete_own_trips` | RLS-only |
| `src/pages/api/trips/[id]/items.ts` | POST | `[id]` → tripId | checklist_items | ✅ select trip przed INSERT | ✅ policy na items | Defense-in-depth |
| `src/pages/api/trips/[id]/items/[itemId].ts` | PATCH | `[id]`, `[itemId]` | checklist_items | ✅ `.eq("trip_id", tripId)` | ✅ policy na items | Defense-in-depth |
| `src/pages/api/trips/[id]/items/[itemId].ts` | DELETE | `[id]`, `[itemId]` | checklist_items | ✅ `.eq("trip_id", tripId)` | ✅ policy na items | Defense-in-depth |
| `src/pages/api/trips/[id]/items-count.ts` | GET | `[id]` → tripId | trips, checklist_items | ✅ select trip przed count | ✅ policy na items | Defense-in-depth |
| `src/pages/api/trips/[id]/rating.ts` | PATCH | `[id]` → tripId | trips | ❌ NIE | ✅ `users_update_own_trips` | RLS-only |

### 3. Szczegóły endpointów RLS-only (słabsze punkty)

#### DELETE /api/trips/[id]
`src/pages/api/trips/[id].ts`

```typescript
// Sprawdza istnienie tripu, ale NIE sprawdza czy należy do current_user
const { error: tripError } = await supabase.from("trips").select("id").eq("id", id).single();
if (tripError) return new Response("Not found", { status: 404 });

// DELETE bez jawnego WHERE user_id = context.locals.user.id
const { error } = await supabase.from("trips").delete().eq("id", id);
```

RLS policy `users_delete_own_trips` (plik `supabase/migrations/20260526000000_create_trips_checklist_items.sql:54`):
```sql
CREATE POLICY "users_delete_own_trips" ON trips FOR DELETE USING (user_id = auth.uid());
```

Zachowanie przy próbie IDOR: Supabase wykona DELETE z WHERE user_id = auth.uid() AND id = $1 — jeśli trip należy do innego usera, operacja zwróci 0 wierszy bez błędu. Endpoint **nie wykrywa tego** (nie sprawdza czy delete faktycznie coś usunął) — zwraca 200 niezależnie.

#### PATCH /api/trips/[id]/rating
`src/pages/api/trips/[id]/rating.ts`

```typescript
// UPDATE bez jawnego sprawdzenia ownership
const { error } = await supabase.from("trips").update({ ... }).eq("id", tripId);
```

RLS policy `users_update_own_trips`:
```sql
CREATE POLICY "users_update_own_trips" ON trips FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

Zachowanie przy IDOR: Supabase wykona UPDATE z WHERE user_id = auth.uid() AND id = $1 — aktualizacja nie nastąpi, ale endpoint zwróci 200 bez błędu.

### 4. Szczegóły endpointów z defense-in-depth

#### POST /api/trips/[id]/items
`src/pages/api/trips/[id]/items.ts`

```typescript
// Jawna weryfikacja ownership PRZED operacją:
const { error: tripError } = await supabase.from("trips")
  .select("id").eq("id", id).single();
if (tripError) return new Response("Trip not found", { status: 404 });
// Jeśli trip należy do innego usera, RLS nie zwróci rekordu → single() zwróci error → 404
```

Wzorzec: RLS filtruje SELECT `select("id").eq("id", id)` do zasobów bieżącego usera. Brak rekordu → 404. To poprawny ownership check przez RLS, nie przez jawne porównanie user_id.

#### PATCH/DELETE /api/trips/[id]/items/[itemId]
`src/pages/api/trips/[id]/items/[itemId].ts`

Po fiksie z S-02 impl-review (CRITICAL F1):
```typescript
// Zapytanie cross-checks both trip_id AND item_id
.eq("trip_id", tripId).eq("id", itemId)
```

Historyczny bug: przed fixem kod używał tylko `.eq("id", itemId)` — user A mógł PATCH item z trip'u B jeśli znał itemId (RLS blokowała cross-user, ale URL contract był złamany dla własnych itemów z obcych tripów).

### 5. Konfiguracja RLS (warstawa DB)

`supabase/migrations/20260526000000_create_trips_checklist_items.sql`

**Tabela trips** (linie 49-54):
```sql
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_trips" ON trips FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_trips" ON trips FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_update_own_trips" ON trips FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_delete_own_trips" ON trips FOR DELETE USING (user_id = auth.uid());
```

**Tabela checklist_items** (linie 57-70):
Brak denormalizowanego `user_id` w tabeli. Ownership weryfikowany przez JOIN do trips:
```sql
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_items" ON checklist_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid()));
-- Analogicznie dla INSERT, UPDATE, DELETE
```

### 6. Middleware — zakres ochrony

`src/middleware.ts`

```typescript
const PROTECTED_ROUTES = ["/dashboard", "/trips", "/profile"];

if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }
}
```

**Obserwacja:** `/trips` prefix łapie zarówno strony (`/trips/[id]`) jak i API routes (`/api/trips/[id]`). Technicznie `/api/trips/[id]` zaczyna się od `/api/`, nie `/trips/`, więc middleware NIE chroni bezpośrednich requestów do API routes. Każdy endpoint API sprawdza `context.locals.user` samodzielnie.

**Zakres dla testów R4 (auth bypass):** testować `/dashboard`, `/trips/new`, `/trips/[id]` (strony) — nie API routes (te mają własny auth check).

### 7. Klient Supabase — typ klucza

`src/lib/supabase.ts`

```typescript
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
// ...
createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  cookies: { /* parse from request.headers */ }
})
```

`SUPABASE_KEY` = ANON_KEY (potwierdzenie z `.env.example` i wzorca SSR Supabase). JWT z sesji jest przekazywany przez cookies → `auth.uid()` w RLS jest wypełniony tożsamością zalogowanego usera. SERVICE_ROLE_KEY nie jest używany w kodzie — RLS nie jest obchodzone na poziomie aplikacji.

---

## Code References

- `src/middleware.ts` — PROTECTED_ROUTES i auth guard
- `src/lib/supabase.ts` — klient Supabase (ANON_KEY + cookies)
- `src/pages/api/trips/[id].ts` — DELETE trip (RLS-only, bez jawnego ownership check)
- `src/pages/api/trips/[id]/items.ts` — POST item (ownership check przez select + RLS)
- `src/pages/api/trips/[id]/items/[itemId].ts` — PATCH/DELETE item (cross-check trip_id + RLS)
- `src/pages/api/trips/[id]/items-count.ts` — GET count (ownership check przez select + RLS)
- `src/pages/api/trips/[id]/rating.ts` — PATCH rating (RLS-only, bez jawnego ownership check)
- `supabase/migrations/20260526000000_create_trips_checklist_items.sql` — RLS policies (linie 49-70)

---

## Architecture Insights

### Model ochrony ownership

Projekt stosuje RLS jako warstwę DB z `auth.uid()`. Supabase filtruje każde zapytanie przez JWT z sesji. Klient ANON_KEY z JWT zapewnia, że `auth.uid()` jest poprawnie wypełniony przy każdym zapytaniu do bazy.

**Ownership check przez RLS + select:** Wzorzec `select("id").eq("id", resourceId).single()` na tabeli z RLS `user_id = auth.uid()` jest poprawnym ownership check — RLS filtruje rezultat do zasobów bieżącego usera, brak wyniku oznacza brak własności. To silniejszy wzorzec niż jawne porównanie `user_id !== context.locals.user.id`, bo operuje na rzeczywistym stanie DB.

**Endpointy RLS-only:** DELETE /api/trips/[id] i PATCH /api/trips/[id]/rating operują na tabeli trips bez ownership pre-check. RLS `users_delete_own_trips` i `users_update_own_trips` blokują operacje na cudzych zasobach. Jednak brak detekcji "0 wierszy zmodyfikowanych" — endpoint zwraca 200 nawet gdy IDOR był próbowany.

### Zachowanie przy próbie IDOR (zachowanie RLS, nie 403)

Supabase RLS **nie zwraca błędu** przy próbie dostępu do cudzego zasobu — zwraca empty result (0 wierszy). Oznacza to:
- DELETE na cudzym tripie → HTTP 200, ale trip nie zostaje usunięty
- UPDATE rating na cudzym tripie → HTTP 200, ale rating nie zostaje zmieniony
- SELECT na cudzym tripie → HTTP 404 (jeśli `.single()`) lub HTTP 200 z empty array

Test integration musi sprawdzać nie tylko HTTP status, ale też czy dana operacja faktycznie NIE zaszła po stronie DB (przez weryfikację stanu po stronie user'a A).

### Luka defensywna w DELETE i PATCH rating

Oba endpointy (DELETE /api/trips/[id], PATCH rating) zwracają 200 nawet gdy IDOR próbowano. Poprawne zachowanie wg PRD §NFR ("nieautoryzowany dostęp niemożliwy") powinno zwracać 403. Integracja testów powinna:
1. Udowodnić że dane A nie wyciekają (RLS chroni)
2. Udokumentować że status HTTP nie jest 403 — to luka do ewentualnej naprawy

---

## Historical Context

### S-01: First Gated Generation (2026-05-27)
`context/archive/2026-05-27-first-gated-generation/reviews/impl-review.md`

**F3 IDOR observation** — items-count endpoint nie miał ownership check. Fix: dodano select trip przed count. Wzorzec ownership-check-przez-select zastosowany.

### S-02: Checklist Edit and Pack (2026-06-01)
`context/archive/2026-06-01-checklist-edit-and-pack/reviews/impl-review.md`

**F1 CRITICAL** — trip_id URL param nie był cross-checked w [itemId].ts PATCH/DELETE. User A mógł modyfikować item z trip B jeśli znał itemId. Fix: dodano `.eq('trip_id', tripId)`. Zatwierdzone przed mergem.

Oba przypadki wskazują na świadomość IDOR ryzyka w zespole — fixing before approval. Jednak DELETE /api/trips/[id] i PATCH rating nie przeszły analogicznego review i pozostają RLS-only.

---

## Oracle dla testów R1

Źródła: PRD §NFR ("plany widoczne wyłącznie właścicielowi; nieautoryzowany dostęp niemożliwy"), PRD §Access Control ("każdy zalogowany user widzi i edytuje wyłącznie własne plany").

### Co test musi udowodnić

**Scenariusz bazowy:**
- User A tworzy zasób (trip / item)
- User B uwierzytelnia się osobno (inna sesja)
- User B wykonuje GET/PATCH/DELETE na ID zasobu User A

**Oczekiwany wynik (oracle z PRD):**
- Dane User A **nie wyciekają** do User B
- Operacje User B **nie modyfikują** zasobów User A
- HTTP status: 403 lub 404 (RLS zwraca 0 wierszy → `.single()` daje 404; raw operation bez pre-check daje 200 ale bez efektu)

**Wariant krytyczny do testu:**
- DELETE /api/trips/[id] przez User B → trip User A nadal istnieje (zweryfikować przez User A)
- PATCH /api/trips/[id]/rating przez User B → rating User A nie zmieniony (zweryfikować przez User A)
- POST /api/trips/[id]/items przez User B → item **nie** dodany do trip User A

### Endpointy do pokrycia (6 scenariuszy)

| # | Endpoint | Metoda | Oczekiwany wynik |
|---|----------|--------|-----------------|
| T1 | `/api/trips/[trip_A_id]` | DELETE | Trip A nadal istnieje po próbie B; HTTP nie-2xx lub 2xx bez efektu |
| T2 | `/api/trips/[trip_A_id]/items` | POST | Żaden item nie dodany do trip A; HTTP 404 (ownership check przez select) |
| T3 | `/api/trips/[trip_A_id]/items/[item_A_id]` | PATCH | Item A nie zmieniony; HTTP nie-2xx lub 2xx bez efektu |
| T4 | `/api/trips/[trip_A_id]/items/[item_A_id]` | DELETE | Item A nadal istnieje; HTTP nie-2xx lub 2xx bez efektu |
| T5 | `/api/trips/[trip_A_id]/items-count` | GET | Brak danych lub 0/null (nie rzeczywista liczba itemów A); HTTP 404 |
| T6 | `/api/trips/[trip_A_id]/rating` | PATCH | Rating A nie zmieniony; HTTP nie-2xx lub 2xx bez efektu |

### Wymagania środowiskowe dla testów

- **Local Supabase** (`supabase start`) z osobnymi kontami test users (lub seed data)
- **Dwa HTTP clients** z osobnymi session cookies (user A i user B)
- **Vitest** z `@cloudflare/vitest-pool-workers` (Workers runtime) — weryfikacja w Phase 1
- **Nie mockować** klienta Supabase — oracle wymaga realnego HTTP + realnego DB (RLS działa tylko na prawdziwym Supabase)

---

## Open Questions

1. **Czy DELETE /api/trips/[id] powinien zwracać 403 zamiast 200 przy próbie IDOR?** PRD mówi "nieautoryzowany dostęp niemożliwy" — current 200 (bez efektu) jest technicznie bezpieczne ale niezgodne z semantyką HTTP. Decyzja: naprawić w ramach Phase 1 implementacji czy zostawić i tylko udokumentować?

2. **Czy local Supabase obsługuje Workers runtime JWT parsing?** `supabase start` uruchamia lokalne Supabase, ale czy `createServerClient` z `SUPABASE_KEY` (local ANON_KEY) poprawnie parsuje JWT z test sessions? Wymaga weryfikacji przy bootstrap.

3. **Jak tworzyć test users?** Przez Supabase Admin API (`/auth/v1/admin/users`) z service_role_key, lub przez signUp endpoint. Preferowane jest Admin API dla izolacji testów.

4. **Czy `@cloudflare/vitest-pool-workers` jest jedyną opcją dla Workers runtime?** Test plan §4 wymienia jako przewidywane — weryfikacja alternatyw (np. Miniflare, testenv z fetch mock) w Phase 1 bootstrap.
