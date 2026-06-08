# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

## 10xDevs AI Toolkit - Module 2, Lesson 3

Review AI-generated code before merge with the **implementation review chain**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` is the lesson focus. Review is a quality gate, not an instruction to fix every finding.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code review (lesson focus)** | |
| `/10x-impl-review <change-id>` | You have implemented code and want a structured review before merge. The skill checks plan adherence, scope discipline, safety and quality, architecture, pattern consistency, and success criteria, then presents findings for triage. |
| **Recurring lesson outcome** | |
| `/10x-lesson` | A finding reveals a recurring project rule or agent failure pattern. Record it in `context/foundation/lessons.md` instead of treating it as a one-off note. |

### Triage discipline

- Severity says how bad the finding is. Impact says how much the decision matters now.
- Valid outcomes: fix now, fix differently, skip, accept as risk, record as recurring rule (`/10x-lesson`), disagree.
- Fix critical findings. Do not burn hours on low-impact observations just because the agent found them.
- Conscious skipping of low-impact findings is a valid review outcome, not negligence.
- If you disagree with a finding, record why. Wrong agent reasoning is also signal.

### Review boundaries

- This lesson reviews implemented code. It does not create the plan, execute new phases, or teach CI review.
- Testing strategy and quality gates are introduced in Module 3.
- Do not use `/10x-contract` as a triage outcome in this lesson.

### Paths used by this lesson

- `context/changes/<change-id>/plan.md` - expected implementation contract
- `context/changes/<change-id>/reviews/` - review output
- `context/foundation/lessons.md` - recurring lessons

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
