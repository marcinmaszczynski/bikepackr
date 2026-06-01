---
project: Bikepackr
version: 1
status: draft
created: 2026-05-25
updated: 2026-06-01
prd_version: 1
main_goal: speed
top_blocker: decisions
---

# Roadmap: Bikepackr

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Bikepackr rozwiązuje konkretny problem bikepackerów: każdy wyjazd wymaga dopasowanego zestawu ekwipunku, a ogólne listy z internetu nie uwzględniają kontekstu (teren, styl noclegu, filozofia jazdy). Aplikacja enkoduje wiedzę doświadczonych bikepackerów jako zestaw reguł i generuje spersonalizowaną checklistę na podstawie parametrów kontekstowych podróży. Rdzeń produktu to połączenie reguł sztywnych (absolutnych zakazów i nakazów zależnych od kontekstu) z generatywnym AI, które wypełnia przestrzeń poza nimi.

## North star

**S-01: Pierwsze generowanie** — gwiazda przewodnia, czyli najmniejszy end-to-end przepływ, który udowadnia, że rdzeń produktu działa: użytkownik wpisuje kontekst wyjazdu i widzi wygenerowaną przez AI checklistę ze stosowanymi regułami sztywnymi. Jeśli ta część działa, reszta funkcji (edycja, zapis, ocenianie) ma sens; dlatego trafia tak wcześnie w roadmapie, jak tylko pozwala na to lista Prerequisites.

## At a glance

| ID    | Change ID               | Outcome (user can …)                                              | Prerequisites | PRD refs                  | Status |
| ----- | ----------------------- | ----------------------------------------------------------------- | ------------- | ------------------------- |--------|
| F-01  | trip-plan-schema        | (foundation) tabele DB dla planów i pozycji checklisty gotowe     | —             | FR-005, FR-006, FR-009    | done   |
| F-02  | ai-generation-scaffold  | (foundation) SDK AI wybrany, streaming na Workers przetestowany   | —             | FR-006                    | done   |
| S-01  | first-gated-generation  | wypełnić kontekst wyjazdu i zobaczyć checklistę z AI              | F-01, F-02    | US-01, FR-005, FR-006     | done   |
| S-02  | checklist-edit-and-pack | edytować checklistę i zaznaczać pozycje jako spakowane            | S-01          | FR-007, FR-008            | done   |
| S-03  | plan-library            | wrócić do dowolnego planu, przeglądać i usuwać plany              | S-01          | FR-009, FR-011            | done   |
| S-04  | trip-rating             | ocenić plan przed wyjazdem i po powrocie (skala 1–6)              | S-01          | FR-010                    | done   |
| S-05  | user-profile-edit       | zarejestrować konto, zalogować się i edytować profil              | —             | FR-001, FR-002, FR-004    | ready  |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme          | Chain                                                 | Note                                                                                            |
| ------ | -------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A      | Generowanie AI | `F-01` / `F-02` → `S-01` → `S-02` / `S-03` / `S-04` | F-01 i F-02 są równoległe; razem odblokowują gwiazdę przewodnią S-01; biased by `speed` goal.  |
| B      | Profil konta   | `S-05`                                                | Samodzielny slice bez prereqs — może startować równolegle z F-01/F-02 od razu.                 |

## Baseline

What's already in place in the codebase as of 2026-05-25 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6.3.1 + React 19.2.6 + TailwindCSS; komponenty w `src/components/`, strony w `src/pages/`
- **Backend / API:** present — Astro API routes; 3 endpointy auth w `src/pages/api/auth/`; middleware auth w `src/middleware.ts`
- **Data:** partial — klient Supabase w `src/lib/supabase.ts`; brak schema/migracji dla tabel własnych (`supabase/config.toml`: `schema_paths: []`)
- **Auth:** present — Supabase Auth wired; JWT session (refresh token rotation enabled); middleware chroni `/dashboard`; strony logowania/rejestracji i ich API handlers gotowe
- **Deploy / infra:** present — CI/CD via `.github/workflows/ci.yml` (lint + build + wrangler deploy); `wrangler.jsonc` dla Cloudflare Workers
- **Observability:** absent — brak biblioteki logowania i error trackingu; Cloudflare Workers Observability skonfigurowane w `wrangler.jsonc` jako podstawowy fallback

## Foundations

### F-01: Trip/plan data schema

- **Outcome:** (foundation) tabele Supabase dla planów podróży i pozycji checklisty gotowe; migracje wgrane; RLS policy zabezpiecza dostęp per-user (zgodnie z NFR: plany widoczne wyłącznie dla właściciela).
- **Change ID:** trip-plan-schema
- **PRD refs:** FR-005, FR-006, FR-009
- **Unlocks:** S-01 (plan context and checklist storage), S-02 (checklist items CRUD), S-03 (plan library query and delete), S-04 (rating fields on plan record)
- **Prerequisites:** —
- **Parallel with:** F-02, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zbyt wąski schemat (np. płaska lista itemów bez kategorii) utrudni S-02 i S-03; `/10x-plan` powinien zdecydować o strukturze tabel przed pierwszą migracją — nie skaluj zbytnio w górę, ale nie zapomnij o RLS.
- **Status:** done

---

### F-02: AI generation scaffold

- **Outcome:** (foundation) SDK AI zainstalowany i skonfigurowany; endpoint generowania strumieniuje tokeny przez Cloudflare Workers zgodnie z NFR (wynik < 30 s, ciągły progress wizualny); architektura reguł sztywnych zdecydowana i zweryfikowana empirycznie.
- **Change ID:** ai-generation-scaffold
- **PRD refs:** FR-006
- **Unlocks:** S-01 (generowanie checklisty — rdzeń produktu)
- **Prerequisites:** —
- **Parallel with:** F-01, S-05
- **Blockers:** —
- **Unknowns:**
  - Który SDK wybrać: Anthropic SDK bezpośrednio czy Vercel AI SDK? — Owner: Marcin. Block: yes.
  - Jak zakodować reguły sztywne: hardcoded w prompcie, osobny plik TS/JSON reguł, czy tabela DB? — Owner: Marcin. Block: yes.
  - Czy SSR streaming w `@astrojs/cloudflare` v13 poprawnie flushuje tokeny AI bez dodatkowego obejścia? — Owner: Marcin (wymaga testu empirycznego na Workers). Block: yes.
- **Risk:** `infrastructure.md` identyfikuje ryzyko M-likelihood: streaming flush w adapterze Cloudflare może nie działać jak oczekiwano — buduj i testuj endpoint strumieniujący jako pierwsze zadanie w tej foundationowie; nie integruj z UI checklisty zanim streaming nie przejdzie weryfikacji.
- **Status:** done

---

## Slices

### S-01: Pierwsze generowanie ★

- **Outcome:** user can wypełnić formularz kontekstu wyjazdu (parametry kontekstowe per PRD §Business Logic) i zobaczyć wygenerowaną przez AI checklistę z zastosowanymi regułami sztywnymi; wynik pojawia się w < 30 s z ciągłym progressem wizualnym.
- **Change ID:** first-gated-generation
- **PRD refs:** US-01, FR-005, FR-006
- **Prerequisites:** F-01, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Jaki jest minimalny akceptowalny wynik generowania dla wersji beta (minimalna liczba pozycji, wymagane kategorie)? — Owner: Marcin. Block: no.
- **Risk:** NFR wymaga wyniku < 30 s i ciągłego progressu — jeśli F-02 nie rozwiąże streamingu przed tym slicem, NFR nie zostanie spełniony; kolejność F-02 → S-01 jest celowa i nie należy jej skracać.
- **Status:** done

---

### S-02: Edycja i pakowanie

- **Outcome:** user can edytować wygenerowaną checklistę (dodawać i usuwać pozycje) oraz zaznaczać pozycje jako „spakowane".
- **Change ID:** checklist-edit-and-pack
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Optymistyczne aktualizacje stanu mogą wydłużyć implementację; preferuj round-trip do Supabase w MVP zamiast lokalnego stanu z synchronizacją.
- **Status:** done

---

### S-03: Biblioteka planów

- **Outcome:** user can wrócić do dowolnego wcześniej stworzonego planu, przeglądać jego zawartość i usunąć plan.
- **Change ID:** plan-library
- **PRD refs:** FR-009, FR-011
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Widok listy planów jest prosty (lista kart + widok szczegółów); ryzyko polega na niepotrzebnym rozbudowywaniu UI zanim S-02 nie dostarczy edycji — trzymaj widok minimalistyczny.
- **Status:** done

---

### S-04: Ocenianie planu

- **Outcome:** user can ocenić plan w skali 1–6 przed wyjazdem (jakość planu) i po powrocie (ocena realizacji) — obie oceny opcjonalne.
- **Change ID:** trip-rating
- **PRD refs:** FR-010
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:**
  - Kiedy i jak wyświetlać prompt do post-trip oceny? Czy wystarczy data startu wyjazdu z kontekstu jako trigger? — Owner: Marcin. Block: no.
- **Risk:** Ten slice bezpośrednio obsługuje główny Success Criterion (75% planów z oceną ≥ 4) — bez oceniania nie ma pomiaru głównego wskaźnika produktu; nie parkuj tego za S-03.
- **Status:** done

---

### S-05: Profil użytkownika

- **Outcome:** user can zarejestrować konto (email + hasło, weryfikacja e-mail nie blokuje dostępu), zalogować się oraz edytować nazwę wyświetlaną i zmienić hasło.
- **Change ID:** user-profile-edit
- **PRD refs:** FR-001, FR-002, FR-004
- **Prerequisites:** —
- **Parallel with:** F-01, F-02
- **Blockers:** —
- **Unknowns:**
  - Scaffold auth (rejestracja, logowanie, baner weryfikacyjny) jest obecny w kodzie — czy interfejs spełnia wymogi FR-001/FR-002 end-to-end (weryfikacja nie blokuje, baner widoczny)? — Owner: Marcin. Block: no.
- **Risk:** Auth istnieje w scaffoldzie, ale nie był end-to-end testowany; S-05 jest okazją do zamknięcia i weryfikacji całego flow przed S-01 — odkrywanie problemów auth w trakcie S-01 kosztuje drożej.
- **Status:** ready

---

## Backlog Handoff

| Roadmap ID | Change ID               | Suggested issue title                                       | Ready for `/10x-plan` | Notes                                                       |
| ---------- | ----------------------- | ----------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| F-01       | trip-plan-schema        | [Foundation] Trip/plan DB schema + Supabase migrations      | done                  | Archived 2026-05-27                                         |
| F-02       | ai-generation-scaffold  | [Foundation] AI SDK selection + streaming validation        | done                  | Archived 2026-05-27                                         |
| S-01       | first-gated-generation  | [Slice ★] Trip context form → AI checklist generation       | done                  | Archived 2026-05-27                                         |
| S-02       | checklist-edit-and-pack | [Slice] Checklist editing and pack-status toggle            | done                  | Archived 2026-06-01                                         |
| S-03       | plan-library            | [Slice] Plan library — view and delete saved plans          | yes                   | Run `/10x-plan plan-library`                                |
| S-04       | trip-rating             | [Slice] Pre-trip and post-trip plan rating (1–6 scale)      | yes                   | Run `/10x-plan trip-rating`; gates primary Success Criterion |
| S-05       | user-profile-edit       | [Slice] User registration, login, and profile edit          | yes                   | Run `/10x-plan user-profile-edit`                           |

## Open Roadmap Questions

1. ~~**Który SDK AI wybrać: Anthropic SDK (bezpośredni) czy Vercel AI SDK?**~~ — Rozstrzygnięte w F-02: Anthropic SDK bezpośrednio.
2. ~~**Jak zakodować reguły sztywne: hardcoded w prompcie, osobny plik TS/JSON reguł, czy tabela w DB?**~~ — Rozstrzygnięte w F-02/S-01: plik TS z regułami.
3. ~~**Niespójność w PRD — lot samolotem:**~~ — Rozstrzygnięte w S-01: prosty bool `lot samolotem = wyklucz kuchenki gazowe` włączony do reguł sztywnych v1.
4. **Avatar profilu** (z PRD `## Open Questions`): shape-notes i FR-004 zgodnie wykluczają avatar ze scope MVP. Uznano za rozstrzygnięte — poza scope v1. Block: brak.

## Parked

- **FR-003: Reset hasła przez e-mail** — Why parked: `Priority: nice-to-have` per PRD §Autentykacja; v1 dopuszcza manualny reset.
- **Natywna aplikacja mobilna** — Why parked: PRD §Non-Goals; responsywny web jest w scope.
- **Udostępnianie planów** — Why parked: PRD §Non-Goals; plany prywatne w v1.
- **Przeliczanie łącznej wagi ekwipunku** — Why parked: PRD §Non-Goals.
- **Reguły lotu samolotem (pełne regulacje przewozowe)** — Why parked: PRD §Non-Goals; trafia do v2 jako dedykowana logika.
- **Zewnętrzne API pogody real-time** — Why parked: PRD §Non-Goals; proxy pora roku/teren zamiast real-time.
- **Eksport planów (PDF/XLS/DOC)** — Why parked: PRD §Non-Goals.
- **Pamiętnik podróży / mini blog** — Why parked: PRD §Non-Goals.
- **Offline access** — Why parked: PRD §Non-Goals; aplikacja wymaga sieci.
- **Avatar użytkownika** — Why parked: PRD §Non-Goals; wycięty per decyzja shaping.
- **Observability foundation** — Why parked: brak NFR blokującego launch; Workers Observability w `wrangler.jsonc` wystarczy dla MVP; `speed` goal = infra lekko.

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived.)

- **F-02: (foundation) SDK AI wybrany, streaming na Workers przetestowany** — Archived 2026-05-27 → `context/archive/2026-05-26-ai-generation-scaffold/`. Lesson: —.
- **F-01: (foundation) tabele DB dla planów i pozycji checklisty gotowe** — Archived 2026-05-27 → `context/archive/2026-05-26-trip-plan-schema/`. Lesson: —.
- **S-01: wypełnić kontekst wyjazdu i zobaczyć checklistę z AI** — Archived 2026-05-27 → `context/archive/2026-05-27-first-gated-generation/`. Lesson: —.
- **S-02: edytować checklistę i zaznaczać pozycje jako spakowane** — Archived 2026-06-01 → `context/archive/2026-06-01-checklist-edit-and-pack/`. Lesson: —.
- **S-03: wrócić do dowolnego wcześniej stworzonego planu, przeglądać jego zawartość i usunąć plan** — Archived 2026-06-01 → `context/archive/2026-06-01-plan-library/`. Lesson: —.
- **S-04: ocenić plan przed wyjazdem i po powrocie (skala 1–6)** — Archived 2026-06-01 → `context/archive/2026-06-01-trip-rating/`. Lesson: —.
