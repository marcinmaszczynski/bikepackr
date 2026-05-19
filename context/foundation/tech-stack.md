---
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
---

## Why this stack

Bikepackr is a 6-week after-hours solo web-app MVP with two technology-forcing features from the PRD: auth (FR-001–004) and AI-powered checklist generation (FR-006). The 10x Astro Starter is the recommended default for `(web-app, js)` and clears all four agent-friendly gates — TypeScript end-to-end with Zod at boundaries, Astro file-based routing (convention-based), mainstream React+Astro training corpus, and well-documented stack. Supabase bundles PostgreSQL and auth out of the box, removing the largest setup cost for a 6-week solo timeline. Cloudflare Pages/Workers is the edge runtime; it supports streaming AI API calls cleanly, which matters for FR-006's generative plan generation — an AI SDK (Anthropic or Vercel AI SDK) will be added manually after scaffolding. CI runs on GitHub Actions with auto-deploy-on-merge, the standard shape for a solo project at this scale.
