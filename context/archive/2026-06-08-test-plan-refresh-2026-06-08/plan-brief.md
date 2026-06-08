# Test Plan Refresh 2026-06-08 — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-06-08/plan.md`

## What & Why

Patch `context/foundation/test-plan.md` z 6 edycjami dokumentacyjnymi: aktualizacja stanu projektu (Phase 2 weszła w implementing), grounding nowego narzędzia (Playwright MCP dostępny), nowe ryzyko R7 (E2E krytyczna ścieżka), nowa Phase 4 E2E rollout, §5 i §6 spójne z nową fazą.

## Starting Point

`test-plan.md` v1 z 2026-06-02: Phase 2 oznaczona `change opened` mimo że plan.md istnieje i R2 unit testy są ukończone; Playwright MCP oznaczony jako niedostępny; brak ryzyka dla E2E krytycznej ścieżki; Quality Gates jako Phase 4 (bez poprzedzającej fazy E2E).

## Desired End State

`test-plan.md` odzwierciedla stan na 2026-06-08: Phase 2 `implementing`, Playwright MCP dostępny, R7 udokumentowane z Risk Response Guidance, Phase 4 E2E jako zaplanowany krok rollout (Quality Gates = Phase 5), §5 i §6.8 spójne.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Numeracja nowej fazy E2E | Phase 4, Quality Gates → Phase 5 | E2E naturalnie poprzedza gate wiring, zachowuje ciągłość numeracji | Plan |
| Pozycja R7 w Risk Map | Append jako #7 (koniec tabeli) | Zero ryzyka złamania referencji R3–R6 w całym dokumencie | Plan |
| §5 E2E wiersz | Zastąp stary nowym | Stary był placeholderem; nowy konkretyzuje i zmienia status na Wymagany | Plan |
| §4 Playwright MCP | Nadpisz cały wiersz | Jeden jasny wpis z aktualną datą, bez sprzecznych informacji | Plan |

## Scope

**In scope:**
- §2 Risk Map — append R7
- §2 Risk Response Guidance — append R7 row
- §3 Phase 2 status: `change opened` → `implementing`
- §3 Phased Rollout — nowa Phase 4 E2E, renumeracja Quality Gates → Phase 5
- §4 Stack grounding — Playwright MCP wiersz
- §5 Quality Gates — zastąpienie starego wiersza E2E
- §6 Cookbook — append §6.8

**Out of scope:**
- Treść ryzyk R1–R6
- Statusy Phase 1, 3
- §1 Strategy, §7 Negative Space
- Treść §6.1–§6.7

## Architecture / Approach

Czysto dokumentacyjna zmiana — 7 edycji w jednym pliku Markdown. Brak zmian kodu, brak migracji. Każda edycja jest niezależna; kolejność: najpierw status/MCP (linie 61, 82), potem Risk Map (append), potem Rollout (insert + renumber), potem §5 (replace), potem §6 (append).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Apply 6 edits | Zaktualizowany test-plan.md odzwierciedlający stan 2026-06-08 | Błąd w numeracji Phase 4→5 lub duplikat wiersza §5 |

**Prerequisites:** `context/foundation/test-plan.md` istnieje (confirmed)
**Estimated effort:** ~1 sesja, ~15 min

## Open Risks & Assumptions

- Phase 4 E2E change folder nie istnieje jeszcze (`—` w tabeli rollout) — plan.md stwierdza "TBD, wypełni nowa faza", co jest zgodne z intencją.

## Success Criteria (Summary)

- `grep -q "implementing" test-plan.md` oraz `grep -q "R7" test-plan.md` przechodzą
- Manualna inspekcja: §3 pokazuje Phase 1–5 z poprawnymi statusami
- §4 ma jeden wiersz Playwright MCP z datą 2026-06-08
