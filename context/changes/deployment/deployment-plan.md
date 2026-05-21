# Deployment Plan — Bikepackr → Cloudflare Workers

**Date:** 2026-05-21  
**Platform:** Cloudflare Workers  
**Decision source:** `context/foundation/infrastructure.md`

---

## Automated changes (committed)

| File | Change |
|------|--------|
| `wrangler.jsonc` | `name` → `"bikepackr"` |
| `.github/workflows/ci.yml` | Branch targets `master` → `main`; added `deploy` job |

## Manual setup gates (one-time, human-only)

Run these in order before the first deploy:

```bash
# 1. Authenticate wrangler with your Cloudflare account
npx wrangler login

# 2. Set Supabase secrets on the Worker
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

Then add these to GitHub → Settings → Secrets → Actions:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `CLOUDFLARE_API_TOKEN` — create at Cloudflare dash → My Profile → API Tokens, scope: Edit Workers for the `bikepackr` worker only

## First deploy

```bash
npm run build
npx wrangler deploy
```

Expected: `https://bikepackr.<account-subdomain>.workers.dev`

## Verification checklist

- [ ] Home page loads at the workers.dev URL
- [ ] `/auth/signin` renders the sign-in form
- [ ] Sign-up flow reaches confirm-email page
- [ ] Cloudflare dashboard → Workers & Pages → `bikepackr` → Deployments shows one entry
- [ ] `npx wrangler tail bikepackr` shows live requests

## Ongoing deploys

After the manual gates are done once, every push to `main` triggers the `ci` → `deploy` pipeline automatically via GitHub Actions.

## Known risks (from infrastructure.md)

| Risk | Mitigation |
|------|-----------|
| 10ms CPU limit on free tier may be exceeded by AI generation calls | Monitor with `wrangler tail`; upgrade to paid ($5/mo) if p99 CPU > 8ms |
| `wrangler tail` sampling under load | Acceptable for MVP; use Cloudflare Logpush for production-grade logging later |
| SSR streaming uncertainty with `@astrojs/cloudflare` | Test streaming endpoints manually after first deploy |
