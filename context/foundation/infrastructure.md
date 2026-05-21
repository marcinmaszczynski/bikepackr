---
project: bikepackr
researched_at: 2026-05-21
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro v6 + React v19
  runtime: Cloudflare Workers (workerd)
  database: Supabase (external, PostgreSQL + auth)
  adapter: "@astrojs/cloudflare ^13.5.0"
  wrangler: "^4.90.0"
---

## Recommendation

**Deploy on Cloudflare Workers.**

The tech stack was designed for this runtime from the start: `@astrojs/cloudflare` v13.5.0 targets Workers natively, `wrangler` v4.90 covers every operational task without a GUI, and `npm run dev` already runs against the workerd isolate locally via the Cloudflare Vite plugin. Every other candidate platform requires a hard adapter migration that would touch env-binding patterns, the Supabase client factory, and potentially Cloudflare-specific APIs throughout the codebase. Cloudflare's free tier (100k requests/day) covers Bikepackr's entire expected MVP traffic with no cost, and the GA MCP integration with Claude Code (April 2026) means an agent can inspect deployments, query logs, and manage bindings without leaving the session. The user's preference for DX and implicit co-location benefit of Hyperdrive (accelerating the external Supabase Postgres connection) further reinforces the choice.

---

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Notes |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | **Pass** | **Pass** | **Pass** | **Pass** | **Pass** (GA April 2026) | Native Astro v6 + workerd support; zero adapter migration |
| Vercel | Pass | Pass | Pass | Pass | Partial (beta, Feb 2026) | Requires adapter swap; MCP beta |
| Render | Partial | Pass | Pass | Partial | Pass (GA Aug 2025) | Requires adapter swap; REST-only rollback |
| Netlify | Partial | Pass | Partial | Partial | Pass | Requires adapter swap; credit-based free tier can pause on deploy churn |
| Railway | Partial | Pass | Partial | Pass | Partial (WIP, not GA) | Requires adapter swap; single-region default |
| Fly.io | Partial | Partial | Partial | Pass | Partial (experimental) | Requires adapter swap AND `astro:env` rewrite; no free tier |

**Scoring notes per criterion:**

**CLI-first**: Cloudflare's `wrangler` covers deploy, rollback (`wrangler rollback`), log tail (`wrangler tail`), and secret management (`wrangler secret put`) with no interactive prompts. Vercel CLI is equally capable. Netlify, Railway, and Render all lack a native CLI rollback — rollback is dashboard-only or REST API. Fly.io's rollback requires passing a specific image tag to `fly deploy`.

**Managed/Serverless**: Cloudflare Workers, Vercel, Netlify, Railway, and Render all abstract OS/network/hardware. Fly.io runs on Firecracker micro-VMs, which is managed but exposes more infrastructure surface (Dockerfiles, binding to `0.0.0.0`).

**Agent-readable docs**: Cloudflare publishes `developers.cloudflare.com/llms.txt`, `llms-full.txt`, per-product txt files, and every page as markdown with `Accept: text/markdown` — the most complete agent-doc setup of any platform researched. Vercel and Render also publish `llms-full.txt`. Netlify has `llms.txt` but docs are not GitHub-backed raw markdown. Railway and Fly.io have no `llms.txt`; docs are on GitHub as markdown (agent-readable but less discoverable). Fly.io's `llms.txt` returned 404 as of 2026-05-21.

**Stable deploy API**: Cloudflare's `wrangler deploy` exits deterministically with structured codes; `wrangler rollback` is a first-class command. Vercel's `vercel deploy --prod` and `vercel rollback` are equally stable. Render and Railway lack CLI-native rollback (REST API required). Netlify's credit-based free plan introduces silent pausing risk when budget is exhausted.

**MCP / Integration**: Cloudflare's MCP integration with Claude Code reached GA in April 2026 — 15+ product-specific servers, a "Code Mode" server exposing 2,500+ API endpoints in ~1,000 tokens of context. Render's MCP server is GA since August 2025. Netlify's MCP server is production-ready but not formally labeled GA. Vercel's MCP is explicitly beta (Feb 2026). Railway's is a work in progress (not GA). Fly.io's is experimental.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Zero migration cost — the codebase is already targeting `workerd` via `@astrojs/cloudflare` v13.5.0. Every other platform requires replacing the adapter and rewriting env-binding patterns project-wide. Full CLI coverage via `wrangler` (deploy, rollback, tail, secrets). Free tier covers 100k requests/day with 10ms CPU/invocation — sufficient for MVP traffic and well above Bikepackr's expected scale. Docs are the most agent-accessible of any platform (multi-granularity `llms.txt`, per-page markdown). GA MCP integration with Claude Code means an agent can query deployments, bindings, and logs without shell-parsing output. Hyperdrive accelerates the Supabase Postgres connection specifically. The platform the stack was designed for, confirmed by five agent-friendly criteria passing unanimously.

#### 2. Vercel

Strong second with a capable CLI (`vercel deploy`, `vercel rollback`, `vercel logs --follow`), `llms-full.txt` agent docs, and a free Hobby tier (1M requests/month, non-commercial). The MCP server is in beta (Feb 2026) — functional but schema may change. Deploying requires replacing `@astrojs/cloudflare` with `@astrojs/vercel`, updating `astro.config.mjs`, migrating `.dev.vars` secrets to `.env.local`, and removing all Cloudflare-specific runtime bindings. A 15–30 minute migration for a fresh scaffold; a more significant effort if Cloudflare-specific APIs accumulate during implementation.

#### 3. Render

GA MCP server since August 2025 (20+ tools covering deploys, logs, metrics, env vars) and `llms-full.txt` documentation. Solid `render logs --tail` CLI. Requires adapter swap (`@astrojs/cloudflare` → `@astrojs/node`) plus binding `HOST=0.0.0.0`. Rollback is REST API only — scriptable but not CLI-native, which is a gap for agent-driven recovery. Free tier spins down after 15 minutes of inactivity (30–60s cold start); Starter plan at $7/month is the minimum viable production tier. Single-region.

---

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Vendor lock-in is deeper than it looks.** `@astrojs/cloudflare` v13 removed `Astro.locals.runtime` and dropped Pages support. Any future platform migration rewrites env bindings, the Supabase client factory, and every Cloudflare-specific primitive — not a config swap.

2. **10ms CPU limit on the free tier blocks complex AI post-processing.** The Anthropic API call itself is network time (excluded from CPU accounting), but processing the streaming response with JSON parsing, hard-rule application, and SSR rendering runs inside the Worker. On the free tier's 10ms CPU cap, checklist generation involving non-trivial rule evaluation may fail silently — the Worker returns a 200 with an empty body rather than a 5xx.

3. **`wrangler tail` enters sampling mode under load.** At elevated traffic, log events are dropped without warning. Debugging intermittent production failures with a sampled log stream is unreliable without a paid observability layer.

4. **Cloudflare's secrets model is operationally unique.** Secrets are set via `wrangler secret put` (not `.env`, not a dashboard form), and are accessed as runtime bindings — not `process.env`. Every new team member or CI pipeline must learn this model; it does not transfer from any other platform.

5. **`<Code>` MDX component is broken in Astro v6 + `@astrojs/cloudflare` v13.** If any page or component uses the built-in `<Code>` component inside MDX, the build fails with a known unresolved issue. Workaround: avoid `<Code>` in MDX or use a custom component.

### Pre-Mortem — How This Could Fail

The team shipped Bikepackr to Cloudflare Workers at week three and immediately saw intermittent failures on the AI checklist generation endpoint. The Anthropic API was returning successfully, but the Worker was failing silently — CPU limit exceeded on the free tier, no 5xx emitted, just empty responses. No one noticed for four days because `wrangler tail` had entered sampling mode under the moderate traffic from their small beta group, and the dropped log frames included exactly the error events they needed.

Moving to the Paid plan ($5/month) resolved the CPU issue, but two weeks later the streaming requirement resurfaced. The PRD requires continuous visual progress during AI generation (< 30 seconds). The team implemented Server-Sent Events, which Workers supports — but the `@astrojs/cloudflare` adapter's SSR response flushing behavior didn't match their expectations, and a week was spent debugging what turned out to be a framework-level interaction, not application code.

The final blow came at month five, when a nightly cleanup job was needed to purge abandoned plans. Cron Triggers felt like the natural fit — but the job required iterating over Supabase rows with enough volume that it occasionally exceeded the 10ms CPU limit again. Without Durable Objects (separate pricing) or an external queue, there was no clean in-platform solution. The platform that looked like a zero-friction fit at MVP scale started showing its edges exactly when the product started working.

### Unknown Unknowns

1. **Response streaming fidelity gap in the adapter.** Workers supports streaming, but `@astrojs/cloudflare`'s SSR response flushing behavior for AI-generated content streaming through the framework middleware stack is not well-documented. Expect to discover actual behavior empirically at implementation time.

2. **`wrangler deploy` vs. `wrangler versions upload` — two distinct deployment paths.** Cloudflare now has a split model for gradual rollouts. These commands are not interchangeable. CI pipelines that use the wrong command deploy correctly but lose version-level rollback features. Choose one model at the start and document it.

3. **Pages vs. Workers naming conflict in `wrangler.jsonc`.** The current `wrangler.jsonc` has `name: "10x-astro-starter"` and the tech-stack frontmatter lists `deployment_target: cloudflare-pages`. The `@astrojs/cloudflare` v13 adapter targets Workers only — Pages is dropped. Before the first deploy, rename the Worker to `bikepackr` and confirm the Cloudflare dashboard project type is Workers, not Pages.

4. **Hyperdrive requires explicit configuration and is not automatic.** Without Hyperdrive, the first request from a cold Worker isolate to Supabase Postgres takes 200–500ms for TCP establishment. Hyperdrive mitigates this with a persistent connection pool — but it must be explicitly declared as a binding in `wrangler.jsonc` and may not be available on the free plan without upgrading.

5. **`astro:env/server` secrets can bake into the client bundle on misconfiguration.** If env vars are declared with the wrong `context` or `access` values in `astro.config.mjs`, they silently inline into the build artifact instead of resolving from Cloudflare runtime bindings. Validate the schema against the actual `wrangler secret put` values before the first deploy.

---

## Operational Story

- **Preview deploys**: Every `wrangler deploy` to a named Worker is production. For preview/staging, create a second Worker (`bikepackr-staging`) bound to the same code, or use `wrangler dev` locally. Cloudflare Workers does not offer automatic branch-preview URLs like Vercel/Netlify — branch previews must be wired manually in CI if needed.
- **Secrets**: `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_KEY` write encrypted values to the Cloudflare dashboard, accessible only by the named Worker at runtime. To rotate: run `wrangler secret put KEY` again with the new value; the old value is overwritten immediately on next deploy. For CI, set `CLOUDFLARE_API_TOKEN` as a GitHub Actions secret — `wrangler deploy` picks it up automatically.
- **Rollback**: `wrangler rollback` (no args) reverts to the previous uploaded version; `wrangler rollback <VERSION_ID>` targets a specific version. Time-to-revert is typically under 30 seconds. Database migrations run via Supabase do not roll back automatically — migrations must be managed separately before rolling back the Worker.
- **Approval**: Destructive actions (deleting a Worker, rotating Supabase primary keys, dropping Supabase tables) are manual-only. An agent may run `wrangler deploy`, `wrangler rollback`, `wrangler secret put`, and `wrangler tail` unattended. Anything touching Cloudflare billing tiers, DNS, or the Supabase dashboard requires a human.
- **Logs**: `wrangler tail` streams live request/error logs to stdout; `wrangler tail --format json` for structured output; `wrangler tail --status error` to filter to failures only. Via the MCP server: `cloudflare_workers_logs` tool in the Cloudflare Claude Code plugin. Note: under high traffic, `wrangler tail` samples and may drop events.

---

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| AI generation endpoint hits 10ms CPU limit on free tier, fails silently with empty 200 | Devil's advocate | M | H | Upgrade to Cloudflare Paid ($5/mo) before shipping AI endpoint; add explicit error boundary that returns 5xx on Worker exception |
| `wrangler tail` sampling drops error events under load, masking production failures | Devil's advocate | M | M | Enable Cloudflare Workers Observability (already in `wrangler.jsonc`) for persistent log storage; set up error alerting via Cloudflare notifications |
| SSR response streaming in `@astrojs/cloudflare` v13 doesn't flush correctly for AI token streaming | Unknown unknowns | M | M | Build and test streaming endpoint early (week 1–2); validate with real Anthropic API calls before integrating with UI |
| `wrangler.jsonc` `name` is "10x-astro-starter" and deployment target may conflict with existing Cloudflare Pages project | Unknown unknowns | H | M | Rename `name` to "bikepackr" in `wrangler.jsonc` before first deploy; confirm Cloudflare dashboard project type is Workers |
| Supabase TCP cold-start latency (200–500ms) on each new Worker isolate without Hyperdrive | Unknown unknowns | M | M | Add Hyperdrive binding to `wrangler.jsonc`; configure Hyperdrive for the Supabase connection string; verify availability on current plan |
| `astro:env/server` secrets inadvertently inlined into client bundle via misconfigured schema | Unknown unknowns | L | H | Audit `astro.config.mjs` env schema before deploy; run `wrangler dev` and inspect bundle for secret leakage |
| Vendor lock-in: future platform migration requires full adapter rewrite | Devil's advocate | L (MVP) | M | Acceptable for MVP; document as known constraint in architecture decisions; minimize direct Cloudflare primitive usage beyond what's required |
| Nightly cleanup jobs or background tasks exceed CPU limits without Durable Objects | Pre-mortem | L (MVP scope) | L | Background jobs are out of PRD scope for MVP; revisit with Queues or Cron Triggers + Durable Objects if added in v2 |
| Cloudflare Workers Paid plan required sooner than expected; unexpected $5/month cost | Pre-mortem | M | L | Budget for $5/month from the start; free tier is sufficient only for static/simple SSR, not AI generation |

---

## Getting Started

The project is already scaffolded for Cloudflare Workers. Steps to deploy:

1. **Rename the Worker** — update `name` in `wrangler.jsonc` from `"10x-astro-starter"` to `"bikepackr"` before the first deploy to avoid name collision.

2. **Authenticate wrangler** — run `npx wrangler login` to open the Cloudflare OAuth flow. Wrangler v4.90.0 is already installed as a dev dependency.

3. **Set production secrets** — do not commit secrets to `wrangler.jsonc`. Set them directly:
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```
   For local dev, keep values in `.dev.vars` (already in `.gitignore`).

4. **Build and deploy**:
   ```bash
   npm run build
   npx wrangler deploy
   ```
   `npm run dev` already runs against the workerd runtime via the Cloudflare Vite plugin — no separate `wrangler dev` command is needed for local development.

5. **Verify the deploy**:
   ```bash
   npx wrangler tail --format json
   ```
   Make a test request to the deployed Worker URL; confirm the tail shows the request and no CPU errors.

6. **Wire CI** — add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets. The existing GitHub Actions workflow can run `npx wrangler deploy` on merge to `main` without further configuration.

---

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup beyond deploy command
- Production-scale architecture (multi-region, HA, DR)
- Durable Objects configuration
- Hyperdrive setup (noted as a Getting Started step; detailed configuration is an implementation task)
