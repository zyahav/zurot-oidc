# T-012 Spec — Production Deploy Gate (GitHub + Vercel)

**Status:** APPROVED — ready for implementation
**Branch:** `codex/prod-deploy-gate`
**Platform:** Vercel (project: zurot-oidc, domain: auth.zurot.org)

---

## Goal

An agent (or anyone) can prepare code, pass CI, and queue a release —
but cannot reach production without a human clicking Approve in GitHub.
Production credentials never exist outside that protected boundary.
Vercel never auto-deploys from git — GitHub Actions is the only deploy path.

---

## Architecture

```
Push to main
    ↓
CI workflow (existing, unchanged) — lint + build + smoke
    ↓ on success
Deploy workflow (new) — pauses at GitHub environment approval gate
    ↓ human clicks Approve
Vercel CLI deploys to production (auth.zurot.org)
```

---

## What is NOT changing

The existing `ci.yml` is not touched. It continues to run lint,
build, and smoke checks on every PR and push to main automatically.

---

## Step 1 — Create GitHub protected environment

GitHub → Settings → Environments → New environment:

- Name: `production`
- Required reviewers: `zyahav`
- Deployment branches: restrict to `main` only
- Prevent self-review: enabled

Secrets to add to this environment (NOT at repo level):

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel personal access token (create at vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Found in Vercel project settings |
| `VERCEL_PROJECT_ID` | Found in Vercel project settings |
| `RSA_PRIVATE_KEY` | JWT signing key — production value only |
| `CLERK_SECRET_KEY` | Clerk secret — production value only |
| `CONVEX_DEPLOY_KEY` | Convex production deploy key |
| `RESEND_API_KEY` | Resend API key — production value only |

Secrets that stay at repo level (needed by CI on PRs):

| Secret | Why repo level is OK |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Public, client-side, not sensitive |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public, client-side, not sensitive |
| `ISSUER` | OIDC issuer URL, not a credential |
| `RSA_PUBLIC_KEY` | Public key, not sensitive |

---

## Step 2 — Disable Vercel automatic deploys

Vercel dashboard → zurot-oidc project → Settings → Git:
- Disable "Auto Deploy" for the production branch
- This ensures Vercel never deploys on its own — only GitHub Actions can trigger it

Without this step, every push to main would bypass the approval gate
entirely because Vercel would deploy it directly.

---

## Step 3 — Create `.github/workflows/deploy.yml`

Replace the existing `deploy.yml` with the Vercel version below.

---

## Step 4 — Get Vercel IDs

Run this once locally to get the project and org IDs:

```bash
npx vercel link
cat .vercel/project.json
```

Copy `projectId` and `orgId` into the GitHub `production` environment secrets.

---

## Files to create or change

| File | Action |
|---|---|
| `.github/workflows/deploy.yml` | Replace with Vercel version |
| `docs/implementation/t-012-spec.md` | This file |

## Manual steps (cannot be done in code)

1. Create `production` environment in GitHub with required reviewers
2. Add all production secrets to that environment
3. Disable Vercel auto-deploy from git
4. Run `npx vercel link` locally and save the IDs

---

## Definition of done

- Push to main triggers CI automatically (unchanged)
- After CI passes, deploy workflow appears in GitHub Actions waiting for approval
- Clicking Approve deploys to auth.zurot.org via Vercel CLI
- Clicking Reject cancels the deploy
- No push to any branch auto-deploys to production via Vercel
- Production secrets are inaccessible to CI jobs and PR builds
