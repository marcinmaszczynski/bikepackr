# Checklist Edit and Pack — Plan Brief

> Full plan: `context/changes/checklist-edit-and-pack/plan.md`

## What & Why

S-02 delivers edycję checklisty i zaznaczanie pozycji jako spakowane (FR-007, FR-008). Po generacji (S-01) użytkownik traci dostęp do planu — items żyją tylko w pamięci komponentu, bez strony do powrotu. Ten slice naprawia ten brak i dodaje główny use-case pakowania: zaznaczanie co już jest w sakwach.

## Starting Point

Schemat DB jest gotowy: `checklist_items.is_packed BOOLEAN` istnieje, RLS działa, typy TypeScript są wygenerowane. TripContextForm po udanym generowaniu przechodzi w "success" phase renderującą plain strings — bez ID itemu, bez możliwości powrotu.

## Desired End State

Po generacji przeglądarka nawiguje na `/trips/[id]`. Tam użytkownik widzi checklistę pogrupowaną po kategorii, może zaznaczyć pozycje jako spakowane (checkboxy ze strikethrough), usuwać i dodawać pozycje. Dashboard pokazuje listę planów z przyciskiem "Nowy plan". Każda zmiana is_packed jest trwała — przeładowanie strony zachowuje stan.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Nawigacja po generacji | Redirect na `/trips/[id]` | Czyste rozdzielenie generowania od widoku; strona planów dostępna do powrotu | Plan |
| Toggle is_packed | Optimistic update (wyjątek od round-trip) | Pakowanie = dziesiątki kliknięć; latencja 200–400ms per checkbox niszczy UX | Plan |
| Add/delete vs rename | Tylko add/delete | FR-007 mówi "dodawanie/usuwanie" — rename to nadprogram poza scope MVP | Plan |
| Packed items UX | Szary + strikethrough in-place | Najprostsza zmiana; kontekst kategorii zostaje widoczny | Plan |
| Dodawanie kategorii | Select z istniejących + "Inne" | Zero nowych pól; kategoria "Inne" zawsze dostępna jako fallback | Plan |
| Dashboard | Lista planów + "Nowy plan" | Minimalny access do historii; S-03 doda pełne zarządzanie planami | Plan |

## Scope

**In scope:**
- GET/SSR `/trips/[id]` — trip detail page z checklistą
- POST `/api/trips/[id]/items` — dodawanie pozycji
- PATCH `/api/trips/[id]/items/[itemId]` — toggle is_packed
- DELETE `/api/trips/[id]/items/[itemId]` — usuwanie pozycji
- Dashboard — lista planów + "Nowy plan"
- TripContextForm — redirect zamiast success phase

**Out of scope:**
- Rename istniejących pozycji
- Usuwanie planu (S-03)
- Biblioteka planów z filtrowaniem (S-03)
- Trip rating (S-04)
- DB migration (schema gotowy)

## Architecture / Approach

Astro SSR strona `/trips/[id]` fetchuje trip + items server-side, przekazuje jako props do React komponentu `ChecklistView` (client:load). Komponent zarządza lokalnym stanem items; toggle is_packed używa optimistic update; add/delete używa round-trip. Trzy nowe API endpointy (`items.ts`, `items/[itemId].ts`) wzorowane na `items-count.ts`. RLS Supabase zapewnia IDOR na poziomie DB; add endpoint robi jawny trip pre-check dla czytelnego 404.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Item CRUD API | POST add, PATCH is_packed, DELETE item | RLS vs explicit ownership — dobra obsługa 404 ważna dla IDOR |
| 2. Trip detail page + ChecklistView | `/trips/[id]` z pełną interaktywnością | Optimistic revert przy błędzie sieci — stan komponentu musi być spójny |
| 3. Dashboard + redirect | Lista planów na dashboardzie; redirect po generacji | TripContextForm cleanup (usunięcie success phase, GroupedCategory, parsedItems) |

**Prerequisites:** S-01 done (schemat DB, typ ChecklistItem, generowanie)
**Estimated effort:** ~1–2 sesje, 3 fazy

## Open Risks & Assumptions

- Supabase JS v2: `.update().eq('id', itemId).select().single()` zwraca `null` gdy RLS blokuje (0 wierszy) — plan zakłada `data === null → 404`; warto zweryfikować to zachowanie empirycznie w Phase 1.
- `window.location.href` w TripContextForm działa w Cloudflare Workers runtime (nie jest blocked przez CSP); alternatywą byłby `Astro.redirect` ale to SSR.

## Success Criteria (Summary)

- Po generacji przeglądarka ląduje na `/trips/{id}` z widoczną checklistą
- Zaznaczanie i odznaczanie pozycji jest trwałe po przeładowaniu strony
- Dashboard pokazuje listę planów; powrót do dowolnego planu działa
