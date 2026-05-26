# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical conventions

**Environment variables** — import secrets from `astro:env/server`, never from `process.env` or `import.meta.env`:
```ts
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
```
Schema is declared in `astro.config.mjs`. New secrets must be added there.

**Local secrets** — use `.dev.vars` (not `.env`) for local Cloudflare workerd dev. Copy from `.env.example`.

**Supabase client** — always call `createClient(context.request.headers, context.cookies)`. It returns `null` when env vars are missing; handle that before use. Never instantiate a Supabase client without passing request context.

**API error responses** — API routes redirect with a query param, not JSON:
```ts
return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
```

**AI integration** — not yet scaffolded; Anthropic SDK or Vercel AI SDK to be added. AI calls belong in `src/pages/api/` endpoints, streamed via Cloudflare's streaming support.

## Project

Bikepackr — a bikepacking trip-planning web app. Users fill in a trip context form and receive an AI-generated gear checklist. See `@context/foundation/prd.md` for full requirements.

## Architecture

**Astro v6 + React v19, deployed to Cloudflare Workers.**

- `src/pages/` — file-based routing; `.astro` for pages, `.ts` for API endpoints
- `src/pages/api/` — server-only API routes (form handlers, future AI endpoints)
- `src/components/` — Astro components for layout/static UI, React (`.tsx`) for interactive UI
- `src/lib/supabase.ts` — Supabase SSR client factory
- `src/middleware.ts` — auth guard; add paths to `PROTECTED_ROUTES` to require login

## Commands

```bash
npm run dev          # Start dev server (Cloudflare workerd runtime)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint with type-checking
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Prettier
```

No test runner is configured yet.

## Deployment

```bash
npm run build
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as Cloudflare secrets (`npx wrangler secret put`). CI (GitHub Actions) runs lint + build on every push; auto-deploys on merge to `main`.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
