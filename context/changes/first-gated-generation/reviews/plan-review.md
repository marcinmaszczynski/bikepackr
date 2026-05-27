<!-- PLAN-REVIEW-REPORT -->
# Plan Review: First Gated Generation Implementation Plan (S-01)

- **Plan**: context/changes/first-gated-generation/plan.md
- **Mode**: Deep
- **Date**: 2026-05-27
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

5/5 paths ✓ (hard-rules.ts, supabase.ts, middleware.ts, generate/test.ts, GenerateTest.tsx), 4/4 symbols ✓ (evaluateHardRules, buildHardRulesSection, toTextStreamResponse, onFinish{text}), brief↔plan ✓

## Findings

### F1 — 2 Success Criteria bullets bez odpowiadającego Progress item

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: ## Progress — Phase 2 Manual, Phase 3 Manual
- **Detail**: Phase 2 bullet "Response header X-Trip-Id obecny w odpowiedzi" był scalony z 2.5. Phase 3 bullet "Submit z pustymi polami → HTML5 validation blokuje" w ogóle nieobecny w Progress.
- **Fix**: Dodano Progress items: 2.6 (X-Trip-Id header) z renumeracją 2.6-2.8→2.7-2.9; 3.5 (HTML5 validation) z renumeracją 3.5-3.9→3.6-3.10.
- **Decision**: FIXED

### F2 — Złe ścieżki komponentów + SubmitButton niekompatybilny z fetch-based submit

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness / Plan Completeness
- **Location**: Current State Analysis + Phase 3 Changes Required
- **Detail**: Plan opisywał "src/components/" zamiast "src/components/auth/". SubmitButton używa useFormStatus() który nie działa przy fetch-based submit — pending zawsze false, spinner się nie pokazuje. FormField obsługuje tylko <input>, nie <select>.
- **Fix A ⭐ Applied**: Poprawiono ścieżki w Current State Analysis. Dodano notatkę w Phase 3 submit handler o SubmitButton+useFormStatus ograniczeniu oraz lokalnym stanie isLoading.
- **Decision**: FIXED via Fix A

### F3 — Supabase zwraca `count: number | null`, kontrakt mówi `number`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Trip items count check endpoint
- **Detail**: `select('*', { count: 'exact', head: true })` zwraca `count: number | null`. Klient sprawdza `count > 0` — null jest falsy → error view nawet przy poprawnym zapytaniu z 0 wynikami.
- **Fix**: Dodano do kontraktu endpointu: `const count = data?.count ?? 0; return Response.json({ count })`.
- **Decision**: FIXED

### F4 — Phase 3 nie opisuje transformacji ParsedItem[] → zgrupowane kategorie

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Submit handler krok 8
- **Detail**: parseMarkdownToItems zwraca { name, category }[] (płaska). parsedItems state to Array<{ category: string; items: string[] }> (grouped). Brak opisu transformacji reduce/groupBy.
- **Decision**: SKIPPED

### F5 — React.FormEvent deprecated w React v19

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — TripContextForm submit handler
- **Detail**: React v19 deprecated React.FormEvent — lint złapie tak samo jak w F-02 GenerateTest.tsx.
- **Fix**: Dodano notatkę w Phase 3 submit handler: używaj React.SyntheticEvent<HTMLFormElement>.
- **Decision**: FIXED
