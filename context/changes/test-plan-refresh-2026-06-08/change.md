---
change_id: test-plan-refresh-2026-06-08
title: Refresh test-plan.md — Phase 2 status, MCP grounding, R7 risk, new E2E phase
status: implemented
created: 2026-06-08
updated: 2026-06-08
archived_at: null
---

## Notes

Otwórz folder zmiany dla refresh `context/foundation/test-plan.md` (refresh 2026-06-08).

Kontekst: istniejący przewodnik ma 4 fazy (Phase 1 complete, Phase 2 implementing,
Phase 3-4 not started). Roadmap kompletny (wszystkie slices done).

Co należy zaplanować (zmiany do test-plan.md):

1. §3 Phase 2 status: `change opened` → `implementing` (plan.md istnieje, R2 ukończone)

2. §4 MCP grounding: Runtime/browser "Playwright MCP dostępny (`playwright-cli`);
   checked: 2026-06-08"

3. Dodaj do §2 Risk Map nowe ryzyko R7:
   "Regresja krytycznej ścieżki E2E — użytkownik nie może przejść: logowanie →
   formularz kontekstu → wygenerowana checklista. Impact: High. Likelihood: Medium.
   Źródło: Q1 wywiad (AI generation top concern), Q4 wywiad (E2E gap), CLAUDE.md
   (nowe reguły E2E), hot-spot dir src/pages/api/generate/ (2 zmiany/30d)."
   Risk Response Guidance dla R7: co dowodzi ochrony = zalogowany user → formularz
   → streaming → ≥1 element → URL /trips/[id]; must challenge = 'API zielony' ≠
   'Astro island hydratuje + streaming UI w przeglądarce'; najtańsza warstwa =
   Playwright E2E; anti-pattern = waitForTimeout(), brak cleanup, over-testing UI.

4. Dodaj do §3 nową fazę "E2E — krytyczne flow":
   Cel: playwright.config.ts + E2E test sign-in → generation (via /10x-e2e per CLAUDE.md).
   Ryzyka: R7, R3 (perspektywa przeglądarki). Typy testów: Playwright E2E.
   Pozycja: po Phase 3 Security flows (przed Phase 4 Quality Gates) — plan zdecyduje
   o ostatecznej numeracji.

5. §6: dodaj §6.8 "E2E — signin → generation flow" (TBD, wypełni nowa faza).

6. §5 Quality Gates: dodaj wiersz "E2E Playwright — krytyczne flow | Dynamiczny |
   Wymagany after §3 nowa faza E2E | PR do main | Nie wdrożony — nowa faza wdraża".
