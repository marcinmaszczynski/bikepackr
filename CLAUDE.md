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

**AI integration** — uses Vercel AI SDK (`ai` + `@ai-sdk/anthropic`). AI calls live in `src/pages/api/` endpoints and stream via Cloudflare's streaming support. The `ANTHROPIC_API_KEY` secret must be declared in `astro.config.mjs` and set as a Cloudflare secret. See `src/pages/api/generate/checklist.ts` for the reference implementation.

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
npm run test         # Vitest unit/integration tests (run once)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright E2E tests
```

Unit/integration tests live in `tests/*.test.ts` (Vitest). E2E tests live in `tests/e2e/*.spec.ts` (Playwright).

## Deployment

```bash
npm run build
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as Cloudflare secrets (`npx wrangler secret put`). CI (GitHub Actions) runs lint + build on every push; auto-deploys on merge to `main`.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
