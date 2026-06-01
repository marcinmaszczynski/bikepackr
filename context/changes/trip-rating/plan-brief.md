# Trip Rating — Plan Brief

> Full plan: `context/changes/trip-rating/plan.md`

## What & Why

Implementacja oceniania planów (FR-010) w skali 1–6 — przed wyjazdem i po powrocie — oba opcjonalne. Bez tego slice'a główny Success Criterion produktu (75% planów z oceną ≥ 4) jest niemierzalny.

## Starting Point

Kolumny `pre_trip_rating` i `post_trip_rating` istnieją już w tabeli `trips` z odpowiednim `CHECK (value BETWEEN 1 AND 6)`. Typ `Trip` w `supabase.ts` je eksportuje. Brakuje tylko endpointu API i komponentu UI.

## Desired End State

Na stronie wyjazdu (`/trips/[id]`), poniżej checklisty, pojawia się widget 6 gwiazdek. Przed datą startu wyjazdu — ocena planu; po dacie startu — ocena realizacji. Kliknięcie gwiazdki zapisuje natychmiast i persystuje po odświeżeniu.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Trigger pre vs post | `start_date` jako granica (leksykograficzne YYYY-MM-DD) | Kolumna już istnieje, zero dodatkowej logiki | Plan |
| Widget UI | Gwiazdki (★★★★★★) z hover-preview | Rozpoznawalny wzorzec oceniania | Plan |
| API endpoint | `PATCH /api/trips/[id]/rating` (dedykowany plik) | Spójny z istniejącym wzorcem `/api/trips/[id]/items` | Plan |
| Migracja DB | Brak | Kolumny `pre_trip_rating` / `post_trip_rating` już istnieją | Plan |

## Scope

**In scope:**
- Nowy endpoint PATCH `/api/trips/[id]/rating`
- Nowy komponent `TripRating.tsx` (6 gwiazdek, optimistic update)
- Integracja `TripRating` w `ChecklistView.tsx`

**Out of scope:**
- Wyświetlanie ocen na dashboardzie
- Usuwanie oceny (tylko zmiana)
- Triggery / powiadomienia post-trip
- Migracja DB

## Architecture / Approach

Klasyczny round-trip: React → PATCH API (Astro route) → Supabase UPDATE z RLS. Wzorzec identyczny z istniejącym toggle `is_packed` w `ChecklistView`. Komponent `TripRating` jest samodzielny — zarządza własnym stanem.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. PATCH endpoint | `/api/trips/[id]/rating.ts` — walidacja + zapis do Supabase | Brak ryzyka — wzorzec znany |
| 2. TripRating + integration | Widget gwiazdkowy wpleciony w ChecklistView | Poprawność logiki pre/post date na kliencie |

**Prerequisites:** S-01 done (plan istnieje w DB), S-02 done (ChecklistView istnieje)
**Estimated effort:** ~1 sesja, 2 fazy

## Open Risks & Assumptions

- Klient oblicza datę przez `new Date().toISOString().slice(0, 10)` — różnice stref czasowych mogą sprawić, że trigger nastąpi o kilka godzin wcześniej/później. Akceptowalne dla MVP.
- Użytkownik może ocenić plan „przed wyjazdem" i „po powrocie" niezależnie — po minięciu `start_date` widzi tylko post-trip widget; jeśli chce zmienić pre-trip rating, musi to zrobić przed startem wyjazdu.

## Success Criteria (Summary)

- Widget gwiazdkowy widoczny na stronie wyjazdu z właściwą etykietą (pre/post) zależną od daty
- Kliknięcie gwiazdki → persystuje w Supabase i odzwierciedla się po odświeżeniu
- Endpoint zwraca 400 dla wartości spoza [1, 6] i 401 dla niezalogowanych
