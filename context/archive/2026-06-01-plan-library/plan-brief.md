# Plan Library — Plan Brief

> Full plan: `context/changes/plan-library/plan.md`

## What & Why

S-03 zamyka slice plan-library dodając usuwanie planów (FR-011). FR-009 (powrót do planu i przeglądanie) zostało w pełni dostarczone przez S-02 — dashboard listuje plany, `/trips/[id]` renderuje checklistę. Brakuje tylko możliwości usunięcia planu, której DB już obsługuje (RLS policy istnieje).

## Starting Point

Dashboard (`dashboard.astro`) renderuje karty planów jako statyczny Astro. Brak endpointu `DELETE /api/trips/[id]`. Tabela `trips` ma policy RLS `users_delete_own_trips` z oryginalnej migracji; `checklist_items` ma `ON DELETE CASCADE` — usunięcie tripa czyści pozycje automatycznie.

## Desired End State

Użytkownik klika ikonę usuwania na karcie planu, potwierdza inline ("Usuń / Anuluj"), karta znika z listy bez przeładowania strony. Na błędzie API pojawia się dismissible baner błędu, karta zostaje. Plany istniejące i nawigacja do szczegółów działają bez zmian.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-----------------|--------|
| Potwierdzenie usunięcia | Inline React confirm | Unika natywnych dialogów; spójne ze wzorcem ChecklistView.tsx | Plan |
| Po usunięciu | Optymistyczne usunięcie z state | Płynny UX bez przeładowania strony | Plan |
| Obsługa błędu | Inline errorMsg banner | Wzorzec z ChecklistView.tsx; nie blokuje nawigacji | Plan |
| Lokalizacja triggera | Przycisk na karcie dashboardu | Bezpośredni dostęp bez wchodzenia w szczegóły planu | Plan |
| Refaktor dashboardu | Ekstrakcja do PlanList.tsx | dashboard.astro jest statycznym Astro; interaktywne usuwanie wymaga React | Plan |

## Scope

**In scope:**
- `DELETE /api/trips/[id]` — endpoint API
- `src/components/PlanList.tsx` — React component z inline delete confirm
- Refaktor `src/pages/dashboard.astro` — zastąpienie pętli Astro komponentem PlanList

**Out of scope:**
- Usuwanie ze strony szczegółów planu
- Usuwanie zbiorcze
- Ocenianie planów (S-04)
- Wyszukiwanie / filtrowanie

## Architecture / Approach

API endpoint idzie wzorcem `items.ts` (auth → supabase → select-to-verify → delete). `PlanList.tsx` idzie wzorcem `ChecklistView.tsx` (initialTrips → local state, fetch on action, optimistic update, errorMsg). Dashboard.astro przekazuje dane SSR do `<PlanList client:load />`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|---------|
| 1. DELETE API Endpoint | `DELETE /api/trips/[id]` → 204/404 | Brak — RLS policy już istnieje |
| 2. PlanList + Dashboard | Interaktywna lista kart z inline delete confirm | Layout absolutnie pozycjonowanego przycisku nad elementem `<a>` |

**Prerequisites:** S-01 done, S-02 done (dashboard i widok szczegółów istnieją)
**Estimated effort:** ~1 sesja w 2 fazach

## Open Risks & Assumptions

- Karta dashboardu musi być przebudowana z `<a class="block">` na `<div class="relative">` + wewnętrzny `<a>`, by przycisk usunięcia siedział poza obszarem kliknięcia linku

## Success Criteria (Summary)

- Użytkownik może usunąć dowolny plan z dashboardu przez inline potwierdzenie
- Usunięty plan znika z UI bez przeładowania i z DB po odświeżeniu
- Baner błędu widoczny przy błędzie API; karta planu pozostaje w UI
