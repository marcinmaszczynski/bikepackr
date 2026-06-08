---
change_id: testing-hard-rules-ai-errors
title: Hard-rules unit tests and AI error path integration tests (Phase 2)
status: archived
created: 2026-06-02
updated: 2026-06-08
archived_at: 2026-06-08T20:39:21Z
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Hard-rules + AI error paths".
Risks covered: R2 (Regresja hard-rules), R3 (Awaria generowania AI).
Test types planned: Unit (pure TS, zero IO), Integration (mock AI SDK).
Risk response intent:
- R2: prove że evaluateHardRules(ctx) zwraca poprawne required/excluded dla minimum 6 kombinacji kontekstu (hostel, namiot, hamak, bivy, fast&light, mieszane); challenge: happy-path test ≠ edge case poprawny; avoid: oracle skopowany z implementacji zamiast z PRD.
- R3: prove że endpoint generowania zwraca czytelny błąd (nie cichy HTTP 200 z pustym body) gdy Anthropic API zwraca błąd lub timeout; challenge: HTTP status 200 ≠ treść odpowiedzi jest poprawna; avoid: testowanie tylko happy-path streaming bez testu pustego/błędnego strumienia.
