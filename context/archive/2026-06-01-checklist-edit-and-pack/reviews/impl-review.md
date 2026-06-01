<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Checklist Edit and Pack

- **Plan**: context/changes/checklist-edit-and-pack/plan.md
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-06-01
- **Verdict**: REJECTED
- **Findings**: 1 critical  2 warnings  4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — trip_id URL param not cross-checked in [itemId].ts

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/trips/[id]/items/[itemId].ts
- **Detail**: PATCH and DELETE both query checklist_items by itemId alone (.eq("id", itemId)) without filtering by trip_id. A user can successfully operate on their own item using a mismatched trip URL param — e.g. PATCH /api/trips/trip-B/items/item-from-trip-A. RLS prevents cross-user access so data integrity holds, but the URL contract is broken: the [id] param becomes decorative and the endpoint silently ignores it.
- **Fix**: Add `.eq("trip_id", context.params.id ?? "")` to both the `.update()` chain (PATCH) and the `.delete()` chain (DELETE), before `.eq("id", itemId)`.
  - Strength: Enforces the URL-param contract and brings PATCH/DELETE to the same level as POST (items.ts already does the explicit trip pre-check). Two targeted query-chain edits, no new logic.
  - Tradeoff: Returns 404 when trip_id mismatches itemId's actual trip — a semantic change, but ChecklistView always passes trip.id so no client regression.
  - Confidence: HIGH — POST endpoint sets the precedent; identical pattern used in items-count.ts too.
  - Blind spot: RLS ownership was verified in migration SQL. This fix adds URL-param consistency on top, not a fundamental RLS gap.
- **Decision**: FIXED (Fix now — added .eq("trip_id", tripId) to both PATCH and DELETE chains)

### F2 — No delete in-flight guard in ChecklistView

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ChecklistView.tsx:116–122
- **Detail**: The × button has no disabled state during the DELETE fetch. Rapid double-click fires two DELETE requests; the second gets a 404 (item already gone) and triggers the error banner unnecessarily.
- **Fix**: Add `isDeletingId: string | null` state; set to `item.id` before fetch, clear in `finally`; disable the × button when `isDeletingId === item.id`.
- **Decision**: FIXED (Fix now — added isDeletingId state, finally clear, disabled × button)

### F3 — dashboard.astro silent-empty when supabase is null

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dashboard.astro:13–22
- **Detail**: When createClient returns null (missing env vars), dashboard.astro falls back to an empty trips array and renders the "no plans yet" empty state — misleading in misconfigured environments. The sibling page trips/[id].astro redirects to /dashboard on the same condition; the two pages behave inconsistently.
- **Fix**: Add `if (!supabase) return Astro.redirect("/")` before the trips query to surface misconfiguration instead of silently showing an empty list.
- **Decision**: FIXED (Fix now — added redirect to "/" when supabase is null)

### F4 — Unplanned eslint.config.js change (benign)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js
- **Detail**: `no-misused-promises` disabled for `*.astro` files. Not in plan but required to fix a known astro-eslint-parser crash on `return Astro.redirect()` in frontmatter. Zero functional impact; build and lint both pass.
- **Decision**: SKIPPED (benign, no action needed)

### F5 — PATCH returns full DB row (unused by client)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/trips/[id]/items/[itemId].ts
- **Detail**: Plan spec'd returning the updated row; ChecklistView uses local optimistic state and ignores the body. Harmless over-fetch; could drop `.select().single()` for a lighter response but not worth the churn.
- **Decision**: SKIPPED (harmless, not worth churn)

### F6 — [id].astro omits explicit Astro.locals.user guard

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/trips/[id].astro
- **Detail**: Plan contract listed Astro.locals.user as context to use; the page skips an explicit check. Middleware already enforces auth on /trips — no functional gap. Minor DRIFT, benign.
- **Decision**: SKIPPED (middleware guarantees auth; no functional gap)

### F7 — TripContextForm "verifying" phase is pre-existing (not drift)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/TripContextForm.tsx:60–76
- **Detail**: The verifying phase + items-count round-trip is S-01 code. This change only removed the success phase and added the redirect. MATCH, not drift.
- **Decision**: SKIPPED (informational, pre-existing S-01 code, no action needed)
