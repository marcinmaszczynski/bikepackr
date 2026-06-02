---
id: testing-bootstrap-authorization
title: "Bootstrap + Authorization tests (Phase 1)"
status: implemented
created: 2026-06-02
updated: 2026-06-02

risks: [R1, R4]
phase: 1
test_plan: context/foundation/test-plan.md
---

## Goal

Bootstrapuje test runner (Vitest lub ekwiwalent dla Workers) i implementuje pierwsze integration testy pokrywające IDOR (R1) i auth bypass (R4) — najwyższe H×H ryzyka z §2 Risk Map.

## Scope

- R1: Integration testy IDOR dla wszystkich endpointów przyjmujących zewnętrzne ID zasobu (2 sesje użytkowników)
- R4: Integration testy auth bypass middleware (requesty bez session cookie do chronionych tras)
- Bootstrap środowiska testowego (Vitest + HTTP integration, plain Node environment)

## Out of scope

- Hard-rules unit tests (R2 — Phase 2)
- AI error path tests (R3 — Phase 2)
- Password re-auth tests (R5 — Phase 3)
- Rating flow tests (R6 — Phase 3)
