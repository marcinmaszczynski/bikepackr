# Checklist Edit and Pack — Implementation Plan

## Overview

Deliver S-02: users can edit a generated checklist (add/delete items) and mark items as packed. Builds entirely on S-01's existing schema and streaming flow; no DB migration needed.

## Current State Analysis

After generation, TripContextForm holds items in memory as plain strings — no IDs, no path back. There is no `/trips/[id]` page, no item CRUD endpoints, and the dashboard shows only email + sign-out. The schema and TypeScript types are fully ready.

### Key Discoveries:

- `src/middleware.ts:4` — `/trips` already in `PROTECTED_ROUTES`; new page is auto-protected
- `src/pages/api/trips/[id]/items-count.ts:4–16` — established API pattern: auth guard → supabase null check → explicit trip pre-check → operation
- `supabase/migrations/20260526000000_create_trips_checklist_items.sql:34` — `is_packed BOOLEAN NOT NULL DEFAULT false` already exists; RLS UPDATE policy covers it
- `src/lib/supabase.ts` — `Trip` and `ChecklistItem` types exported; ready for prop typing
- `src/components/TripContextForm.tsx:89` — success branch sets `phase = "success"`; must change to redirect

## Desired End State

After generation the browser navigates to `/trips/[id]`. That page shows grouped checklist items with:
- Optimistic checkboxes for `is_packed` (immediate visual change, PATCH in background)
- Delete button per item (round-trip)
- Inline add form (name + category select, categories derived from existing items + "Inne")
- Counter pill: "X/Y spakowane"

Dashboard shows the user's plan list with a "Nowy plan" entry point.

To verify: generate a plan, confirm redirect, check/uncheck items, add and delete items, reload page to confirm persistence, open dashboard and navigate back to the plan.

## What We're NOT Doing

- Rename/edit item names (FR-007 scope: add/delete only)
- Sort packed items to bottom (strikethrough in-place is sufficient for MVP)
- Show item source (ai/user/rule) in UI
- Optimistic updates for add or delete (only for `is_packed` toggle)
- Any DB migration (schema already supports everything)
- Trip deletion (belongs to S-03)

## Implementation Approach

Backend-first: API endpoints in Phase 1, detail page + component in Phase 2, dashboard + redirect in Phase 3. Each phase is independently testable. Supabase RLS handles IDOR on update/delete via JOIN to trips; explicit trip pre-check in add endpoint mirrors `items-count.ts` pattern.

## Critical Implementation Details

**Optimistic toggle**: On checkbox click, flip `is_packed` in local state immediately, then fire `PATCH /api/trips/{tripId}/items/{itemId}` with `{ is_packed: <desired_value> }`. The server sets the explicit value (not a server-side toggle) so the client stays authoritative. On error: revert the single item in state and show an error message.

**`source` field**: DB has a CHECK constraint `source IN ('ai', 'user', 'rule')`. User-added items must be inserted with `source = 'user'`.

**Category dropdown edge case**: When all items have been deleted, `items` state is empty and no categories can be derived. The dropdown must always include at least `"Inne"` so the add form stays functional.

---

## Phase 1: Item CRUD API Endpoints

### Overview

Two new API files providing add, toggle-packed, and delete operations for checklist items. All follow the `items-count.ts` guard pattern.

### Changes Required:

#### 1. Add item endpoint

**File**: `src/pages/api/trips/[id]/items.ts`

**Intent**: Accept POST with `{ name, category }`, insert a new item with `source='user'`, return the created row. Enables ChecklistView's add form.

**Contract**: Export `POST: APIRoute`. Validate `name` and `category` are non-empty strings; return 400 if invalid. Auth guard via `context.locals.user`; return 401 if absent. Create supabase client; return 503 if null. Verify trip ownership: `.from('trips').select('id').eq('id', id).single()` — return 404 if error. Insert into `checklist_items` with `{ trip_id: id, name, category, source: 'user' }` and `.select().single()`. Return `Response.json(item, { status: 201 })`.

#### 2. Toggle packed + delete item endpoint

**File**: `src/pages/api/trips/[id]/items/[itemId].ts`

**Intent**: PATCH updates `is_packed` on a specific item; DELETE removes it. RLS (JOIN to trips) handles ownership for both.

**Contract**: Export `PATCH: APIRoute` and `DELETE: APIRoute`. Both apply the same auth + supabase guards. PATCH reads `{ is_packed: boolean }` from request JSON body; runs `.update({ is_packed }).eq('id', itemId).select().single()` on `checklist_items`; returns 404 if `data` is null (item not found or wrong user), otherwise returns `Response.json(data)`. DELETE runs `.delete().eq('id', itemId).select().single()`; returns 404 if `data` is null, otherwise returns `new Response(null, { status: 204 })`.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- POST to `/api/trips/{validId}/items` with `{ name: "Kask", category: "Rower" }` → 201 + row in DB with `source='user'`
- POST with missing `name` → 400
- POST with another user's trip ID → 404
- PATCH `/api/trips/{tripId}/items/{itemId}` with `{ is_packed: true }` → DB row updated
- DELETE `/api/trips/{tripId}/items/{itemId}` → 204 + row gone from DB
- PATCH/DELETE with wrong `itemId` → 404

**Implementation Note**: After this phase passes manual verification, proceed to Phase 2.

---

## Phase 2: Trip Detail Page + ChecklistView Component

### Overview

SSR Astro page at `/trips/[id]` fetches trip + items, passes them to an interactive React component. ChecklistView manages local state and calls Phase 1 endpoints.

### Changes Required:

#### 1. Trip detail page

**File**: `src/pages/trips/[id].astro`

**Intent**: Server-render the trip detail page; redirect to `/dashboard` if the trip is not found or doesn't belong to the user.

**Contract**: Frontmatter uses `Astro.locals.user` (set by middleware) and `createClient(Astro.request.headers, Astro.cookies)`. Fetch trip: `.from('trips').select('*').eq('id', Astro.params.id!).single()` — if error or null, `return Astro.redirect('/dashboard')`. Fetch items: `.from('checklist_items').select('*').eq('trip_id', Astro.params.id!).order('created_at', { ascending: true })`. Render `<ChecklistView client:load trip={trip} initialItems={items ?? []} />` inside the standard `<Layout>` container matching the style of `trips/new.astro` (full-screen centered, `bg-cosmic`, `backdrop-blur-xl` card).

#### 2. ChecklistView React component

**File**: `src/components/ChecklistView.tsx`

**Intent**: Interactive checklist with optimistic pack-status toggle, round-trip delete, and inline item add. Initialized from SSR props; no initial fetch.

**Contract**: Props `{ trip: Trip; initialItems: ChecklistItem[] }`. Local state: `items: ChecklistItem[]`. Derived display: group items by `category` using `reduce` (insertion-ordered). Header row: trip `title` (or `"Plan bez nazwy"`) + pill `"X/Y spakowane"` (X = count where `is_packed`, Y = total). Per item row: checkbox input bound to `item.is_packed` — on change, flip in state immediately, PATCH endpoint in background, revert single item on non-2xx + set `errorMsg` state. Delete `×` button: DELETE endpoint, on 2xx filter item from state (no optimistic). Packed item styling: `text-white/40 line-through`. Add form at bottom of page: text `<input>` for name, `<select>` populated with `[...new Set(items.map(i => i.category)), "Inne"]` (deduped, "Inne" always present), submit button; on submit POST endpoint, on 2xx append returned item to state and clear inputs. Static footer: `"Lista wygenerowana przez AI — może być niepełna."` Link: `<a href="/trips/new">Wygeneruj nowy plan</a>`.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Visit `/trips/{id}` → grouped checklist loads; counter shows correct X/Y
- Click checkbox → immediate strikethrough; reload page → `is_packed=true` persisted
- Click checkbox again → strikethrough removed; persisted on reload
- Click `×` on item → removed from UI and DB
- Fill add form with existing category → item appears in that group; `source='user'` in DB
- Fill add form with "Inne" → item appears in "Inne" group
- Visit `/trips/00000000-0000-0000-0000-000000000000` → redirect to `/dashboard`

**Implementation Note**: After this phase passes manual verification, proceed to Phase 3.

---

## Phase 3: Dashboard Plan List + Generation Redirect

### Overview

Update dashboard to show a plan list with "Nowy plan" entry point. Update TripContextForm to navigate to `/trips/[id]` instead of showing the in-place success phase.

### Changes Required:

#### 1. Dashboard plan list

**File**: `src/pages/dashboard.astro`

**Intent**: Replace placeholder content with a useful plan list. Fetch user's trips newest-first, render each as a clickable card linking to `/trips/[id]`, and provide a "Nowy plan" call-to-action.

**Contract**: SSR frontmatter fetches `supabase.from('trips').select('id, title, start_date, accommodation_type, created_at').order('created_at', { ascending: false })`. Render each trip as a card (`<a href="/trips/{id}">`) showing: title (fallback `"Plan bez nazwy"` when null), `start_date`, Polish label for `accommodation_type` (use a mapping object). Above the list: primary-styled `<a href="/trips/new">Nowy plan</a>` button. Empty-state (no trips): render `"Nie masz jeszcze żadnych planów."`. Keep existing "Sign out" form.

#### 2. TripContextForm redirect

**File**: `src/components/TripContextForm.tsx`

**Intent**: Navigate to the new trip's detail page after successful generation instead of rendering the in-place success view.

**Contract**: In `handleSubmit`, replace `setPhase("success")` at line ~89 with `window.location.href = \`/trips/${fetchedTripId}\``. Remove: the `success` phase JSX block (lines 116–149), the `GroupedCategory` interface (lines 6–9), the `parsedItems` state (line 19), and the `setParsedItems` call (lines 81–86). Remove `parseMarkdownToItems` import if it becomes unused.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Submit trip form → after streaming + verification, browser navigates to `/trips/{id}`
- Trip detail page shows the generated checklist immediately
- Dashboard shows plan list; clicking a card navigates to its detail page
- "Nowy plan" button on dashboard navigates to `/trips/new`
- Dashboard empty state visible for a fresh user account

**Implementation Note**: After this phase passes manual verification, the change is complete.

---

## Testing Strategy

### Manual Testing Steps:

1. Generate a new plan → confirm redirect to `/trips/{id}` and checklist is visible
2. Check 5+ items → verify grey/strikethrough in UI; reload to confirm DB persistence
3. Uncheck 2 items → verify UI reverts; persisted on reload
4. Delete 1 item → gone from UI; reload confirms absence
5. Add item with existing category → appears in correct group with `source='user'` in DB
6. Add item with "Inne" → appears in "Inne" group
7. Counter updates correctly through steps 2–6
8. Generate a second plan → dashboard shows both plans
9. Click plan on dashboard → navigates to correct detail page
10. Open `/trips/random-uuid` → redirects to dashboard

## References

- Roadmap S-02: `context/foundation/roadmap.md:111`
- Items-count API pattern: `src/pages/api/trips/[id]/items-count.ts`
- TripContextForm success branch: `src/components/TripContextForm.tsx:89`
- ChecklistItem and Trip types: `src/lib/supabase.ts`
- RLS UPDATE policy for checklist_items: `supabase/migrations/20260526000000_create_trips_checklist_items.sql:65`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Item CRUD API Endpoints

#### Automated

- [x] 1.1 Build passes: `npm run build`
- [x] 1.2 Lint passes: `npm run lint`

#### Manual

- [ ] 1.3 POST valid item → 201 + correct DB row
- [ ] 1.4 POST with missing fields → 400
- [ ] 1.5 POST with wrong trip ID → 404
- [ ] 1.6 PATCH `is_packed` → DB updated
- [ ] 1.7 DELETE item → 204 + row gone
- [ ] 1.8 PATCH/DELETE wrong itemId → 404

### Phase 2: Trip Detail Page + ChecklistView Component

#### Automated

- [ ] 2.1 Build passes: `npm run build`
- [ ] 2.2 Lint passes: `npm run lint`

#### Manual

- [ ] 2.3 `/trips/{id}` loads grouped checklist with correct counter
- [ ] 2.4 Checkbox toggle → immediate visual + persisted on reload
- [ ] 2.5 Uncheck → visual reverts + persisted on reload
- [ ] 2.6 Delete item → removed from UI and DB
- [ ] 2.7 Add item with existing category → correct group, `source='user'`
- [ ] 2.8 Add item with "Inne" → "Inne" group
- [ ] 2.9 Unknown trip ID → redirect to dashboard

### Phase 3: Dashboard Plan List + Generation Redirect

#### Automated

- [ ] 3.1 Build passes: `npm run build`
- [ ] 3.2 Lint passes: `npm run lint`

#### Manual

- [ ] 3.3 Submit form → redirect to `/trips/{id}` with checklist visible
- [ ] 3.4 Dashboard shows plan list with correct cards
- [ ] 3.5 Card click → correct detail page
- [ ] 3.6 "Nowy plan" → `/trips/new`
- [ ] 3.7 Dashboard empty state for user with no plans
