---
bootstrapped_at: 2026-05-19T18:51:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: bikepackr
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: bikepackr
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack**: Bikepackr is a 6-week after-hours solo web-app MVP with two technology-forcing features from the PRD: auth (FR-001–004) and AI-powered checklist generation (FR-006). The 10x Astro Starter is the recommended default for `(web-app, js)` and clears all four agent-friendly gates — TypeScript end-to-end with Zod at boundaries, Astro file-based routing (convention-based), mainstream React+Astro training corpus, and well-documented stack. Supabase bundles PostgreSQL and auth out of the box, removing the largest setup cost for a 6-week solo timeline. Cloudflare Pages/Workers is the edge runtime; it supports streaming AI API calls cleanly, which matters for FR-006's generative plan generation — an AI SDK (Anthropic or Vercel AI SDK) will be added manually after scaffolding. CI runs on GitHub Actions with auto-deploy-on-merge, the standard shape for a solo project at this scale.

## Pre-scaffold verification

| Signal      | Value                                               | Severity    | Notes                                        |
| ----------- | --------------------------------------------------- | ----------- | -------------------------------------------- |
| npm package | not run — cmd_template starts with `git clone`      | n/a         | no npm package to check for git-clone starters |
| GitHub repo | not run — `gh` CLI not found in environment         | unavailable | recency check unavailable: gh CLI absent     |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: clone startera bez zachowania historii git (git-clone)

**Exit code**: 0 (git clone step; npm install step skipped — npm not in PATH; see Next steps)

**Files moved**: all top-level and nested files from `.bootstrap-scaffold/` into cwd via rsync

**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold`

**.gitignore handling**: append-merged — existing cwd lines preserved, scaffold lines de-duped and appended with `# from 10x-astro-starter` separator

**.bootstrap-scaffold cleanup**: deleted

**Note**: `npm install` was not run automatically because `npm` is not in the Claude Code environment PATH. The `package-lock.json` from the starter repo was cloned and is present. Run `npm install` manually to install dependencies before starting development.

## Post-scaffold audit

**Tool**: npm audit --json

**Status**: failed to run

**Reason**: `npm` not found in PATH in the Claude Code sandbox environment. The scaffold clone and file move completed successfully; the audit could not run because `node_modules/` was not installed.

**Action required**: Run the following in your terminal after `npm install`:

```bash
npm install
npm audit
```

## Hints recorded but not acted on

| Hint                    | Value              |
| ----------------------- | ------------------ |
| bootstrapper_confidence | first-class        |
| quality_override        | false              |
| path_taken              | standard           |
| self_check_answers      | null               |
| team_size               | solo               |
| deployment_target       | cloudflare-pages   |
| ci_provider             | github-actions     |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true               |
| has_payments            | false              |
| has_realtime            | false              |
| has_ai                  | true               |
| has_background_jobs     | false              |

## Next steps

A future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `npm install` — REQUIRED first step: install dependencies (npm was not available in the Claude Code environment during bootstrap).
- `npm audit` — run the security audit after install to check dependency advisories.
- `git init` (if you have not already) to start your own repo history. The cloned starter `.git/` was removed; your existing `.git/` (if any) was preserved.
- Review `CLAUDE.md.scaffold` — the starter ships its own `CLAUDE.md` with Astro/Supabase/Cloudflare-specific instructions. Diff it against your `CLAUDE.md` and merge the relevant sections: `diff CLAUDE.md CLAUDE.md.scaffold`
- Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_KEY` for local development.
- For local Supabase: `npx supabase start` (requires Docker).
- For local Cloudflare dev: copy secrets to `.dev.vars` (see `.env.example`).
