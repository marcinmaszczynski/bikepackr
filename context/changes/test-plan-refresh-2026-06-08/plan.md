# Test Plan Refresh 2026-06-08 — Implementation Plan

## Overview

Patch `context/foundation/test-plan.md` z 6 precyzyjnymi edycjami dokumentacyjnymi: aktualizacja statusu Phase 2, grounding MCP, nowe ryzyko R7, nowa Phase 4 E2E (z przesunięciem Quality Gates na Phase 5), wpis §6.8 i zastąpienie wiersza §5.

## Current State Analysis

`context/foundation/test-plan.md` v1 (created 2026-06-02). Stan faz:
- Phase 1: `complete`
- Phase 2: `change opened` (plan.md istnieje, R2 unit testy ukończone)
- Phase 3: `not started`
- Phase 4: `not started`

§4 Stack: Playwright MCP oznaczony jako `nie dostępne; checked: 2026-06-02` — już dostępny jako `playwright-cli`.
§2 Risk Map: brak R7 dla krytycznej ścieżki E2E (login → generation).

## Desired End State

`test-plan.md` odzwierciedla aktualny stan projektu: Phase 2 jako `implementing`, Playwright MCP jako dostępny, R7 jako udokumentowane ryzyko z guidance, nowa Phase 4 E2E jako planowany krok rollout, §5 i §6 spójne z nową fazą.

### Key Discoveries:

- `context/foundation/test-plan.md:61` — Phase 2 status: `change opened`
- `context/foundation/test-plan.md:82` — Playwright MCP wiersz z datą 2026-06-02
- `context/foundation/test-plan.md:39` — koniec tabeli Risk Map (R6)
- `context/foundation/test-plan.md:50` — koniec tabeli Risk Response Guidance (R6)
- `context/foundation/test-plan.md:63` — Phase 4 Quality Gates (wymaga renumeracji → Phase 5)
- `context/foundation/test-plan.md:96` — stary wiersz E2E w §5
- `context/foundation/test-plan.md:154` — koniec §6.7

## What We're NOT Doing

- Zmiana treści istniejących ryzyk R1–R6
- Zmiana statusów Phase 1, 3
- Modyfikacja §1 Strategy ani §7 Negative Space
- Aktualizacja §6.1–§6.7 (poza dodaniem §6.8)

## Implementation Approach

Seryjne edycje pliku `context/foundation/test-plan.md` z użyciem narzędzia Edit. Kolejność: najpierw edycje niezależne (status, MCP, R7 risk row, R7 guidance row), potem powiązane (Phase 4 E2E + renumeracja Phase 4→5, §5 zastąpienie, §6.8 append).

---

## Phase 1: Apply 6 edits to test-plan.md

### Overview

Wszystkie 6 edycji dokumentacyjnych do `context/foundation/test-plan.md` w jednej fazie.

### Changes Required:

#### 1. §3 Phase 2 status bump

**File**: `context/foundation/test-plan.md`

**Intent**: Zmień status Phase 2 z `change opened` na `implementing` — plan.md istnieje i R2 unit testy są ukończone.

**Contract**: Wiersz tabeli §3 Phase 2 (linia 61) — pole Status: `change opened` → `implementing`.

---

#### 2. §4 Stack grounding — Playwright MCP

**File**: `context/foundation/test-plan.md`

**Intent**: Nadpisz wiersz Playwright MCP w tabeli §4 Stack grounding tools — narzędzie jest teraz dostępne.

**Contract**: Wiersz `- Runtime/browser: Playwright MCP — nie dostępne; nie używane; checked: 2026-06-02` zastąpić: `- Runtime/browser: Playwright MCP dostępny (\`playwright-cli\`); checked: 2026-06-08`.

---

#### 3. §2 Risk Map — dodaj R7

**File**: `context/foundation/test-plan.md`

**Intent**: Dodaj R7 jako ostatni wiersz tabeli Risk Map (append, bez renumeracji R3–R6).

**Contract**: Po wierszu R6 dodaj nowy wiersz tabeli:

```
| R7 | Regresja krytycznej ścieżki E2E — użytkownik nie może przejść: logowanie → formularz kontekstu → wygenerowana checklista | High | Medium | Q1 (wywiad: AI generation top concern), Q4 (wywiad: E2E gap), CLAUDE.md (nowe reguły E2E), hot-spot dir `src/pages/api/generate/` (2 zmiany/30d) |
```

---

#### 4. §2 Risk Response Guidance — dodaj R7

**File**: `context/foundation/test-plan.md`

**Intent**: Dodaj wiersz R7 do tabeli Risk Response Guidance.

**Contract**: Po wierszu R6 dodaj:

```
| R7 | Zalogowany user → formularz → streaming → ≥1 element → URL `/trips/[id]` | "API zielony" ≠ "Astro island hydratuje + streaming UI w przeglądarce" | Ścieżka pełna w przeglądarce od logowania do wygenerowanej checklisty | Playwright E2E | `waitForTimeout()`, brak cleanup, over-testing UI |
```

---

#### 5. §3 Phased Rollout — nowa Phase 4 E2E + renumeracja

**File**: `context/foundation/test-plan.md`

**Intent**: Wstaw nową fazę "E2E — krytyczne flow" po Phase 3 i zmień dotychczasową Phase 4 Quality Gates na Phase 5.

**Contract**: Wiersz Phase 4 (linia 63) — zmień `| 4 |` na `| 5 |`. Wstaw nowy wiersz po Phase 3:

```
| 4 | E2E — krytyczne flow | `playwright.config.ts` + E2E test sign-in → generation (via `/10x-e2e` per CLAUDE.md) | R7, R3 (perspektywa przeglądarki) | Playwright E2E | — | not started |
```

---

#### 6. §5 Quality Gates — zastąp stary wiersz E2E

**File**: `context/foundation/test-plan.md`

**Intent**: Zastąp placeholder "E2e na krytycznych flow" nowym wierszem referującym do Phase 4 E2E.

**Contract**: Stary wiersz `| E2e na krytycznych flow (auth + generowanie) | Dynamiczny | Zalecany — \`required after §3 Phase 2\` | PR do main | Nie wdrożony — Phase 2 ocenia zasadność |` zastąpić:

```
| E2E Playwright — krytyczne flow | Dynamiczny | Wymagany — `required after §3 Phase 4` | PR do main | Nie wdrożony — Phase 4 wdraża |
```

---

#### 7. §6 Cookbook — dodaj §6.8

**File**: `context/foundation/test-plan.md`

**Intent**: Dodaj wpis §6.8 po §6.7 jako placeholder wypełniany przez Phase 4.

**Contract**: Po bloku `### 6.7 CI quality gates` dodaj:

```markdown
### 6.8 E2E — signin → generation flow
TBD — see §3 Phase 4. Cel: Playwright E2E test sign-in → formularz kontekstu → streaming generowania → ≥1 element checklisty → URL `/trips/[id]`.
```

---

### Success Criteria:

#### Automated Verification:

- Plik `context/foundation/test-plan.md` istnieje i nie jest pusty: `test -s context/foundation/test-plan.md`
- R7 obecne w Risk Map: `grep -q "R7" context/foundation/test-plan.md`
- Phase 2 status `implementing`: `grep -q "implementing" context/foundation/test-plan.md`
- Phase 4 E2E obecna: `grep -q "E2E — krytyczne flow" context/foundation/test-plan.md`
- Phase 5 Quality Gates obecna: `grep -q "| 5 |" context/foundation/test-plan.md`
- §6.8 obecna: `grep -q "6.8" context/foundation/test-plan.md`
- Playwright MCP checked 2026-06-08: `grep -q "checked: 2026-06-08" context/foundation/test-plan.md`

#### Manual Verification:

- §2 Risk Map: R7 na końcu tabeli, treść zgodna ze specyfikacją z change.md
- §2 Risk Response Guidance: R7 wypełniony (6 kolumn)
- §3 Rollout: Phase 1 complete, Phase 2 implementing, Phase 3 not started, Phase 4 E2E not started, Phase 5 not started
- §4 Stack: jeden wiersz Playwright MCP z datą 2026-06-08 (stary usunięty)
- §5 Quality Gates: jeden wiersz E2E (stary placeholder zastąpiony)
- §6.8 pod §6.7, format spójny z §6.3–§6.7

**Implementation Note**: Po zakończeniu edycji i weryfikacji automatycznej — pause dla manualnej inspekcji pliku przed przejściem do Progress.

---

## Testing Strategy

### Manual Testing Steps:

1. Otwórz `context/foundation/test-plan.md` i przejdź przez §2–§6 w kolejności
2. Sprawdź §3: Phase 1 → 5 widoczne, status Phase 2 = `implementing`, Phase 4 = E2E, Phase 5 = Quality Gates
3. Sprawdź §2: R7 na końcu Risk Map i Risk Response Guidance (6 kolumn, treść z change.md)
4. Sprawdź §4: jeden wiersz Playwright MCP, data 2026-06-08
5. Sprawdź §5: brak starego placeholder wiersza, nowy wiersz z "Phase 4"
6. Sprawdź §6.8 pod §6.7

## References

- Change notes: `context/changes/test-plan-refresh-2026-06-08/change.md`
- Target file: `context/foundation/test-plan.md`
- Phase 2 change: `context/changes/testing-hard-rules-ai-errors/`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Apply 6 edits to test-plan.md

#### Automated

- [x] 1.1 `test -s context/foundation/test-plan.md`
- [x] 1.2 `grep -q "R7" context/foundation/test-plan.md`
- [x] 1.3 `grep -q "implementing" context/foundation/test-plan.md`
- [x] 1.4 `grep -q "E2E — krytyczne flow" context/foundation/test-plan.md`
- [x] 1.5 `grep -q "| 5 |" context/foundation/test-plan.md`
- [x] 1.6 `grep -q "6.8" context/foundation/test-plan.md`
- [x] 1.7 `grep -q "checked: 2026-06-08" context/foundation/test-plan.md`

#### Manual

- [x] 1.8 §2 Risk Map i Risk Response Guidance — R7 zgodny ze specyfikacją
- [x] 1.9 §3 Rollout — poprawna numeracja Phase 1–5, statusy
- [x] 1.10 §4 Stack — jeden wiersz Playwright MCP z datą 2026-06-08
- [x] 1.11 §5 Quality Gates — stary wiersz E2E zastąpiony
- [x] 1.12 §6.8 pod §6.7, format spójny
