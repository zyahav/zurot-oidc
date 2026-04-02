# T-012 Spec — Production Deploy Gate (GitHub + Cloudflare)

**Status:** APPROVED — ready for implementation
**Branch:** `codex/prod-deploy-gate`
**Spec References:** `WORKFLOW.md`, `DEV_PROTOCOL.md`

---

## Goal

An agent (or anyone) can prepare code, pass CI, and queue a release —
but cannot reach production without a human clicking Approve in GitHub.

Production credentials never exist outside that protected boundary.

---

## Architecture

```
Push to main
    ↓
CI workflow (existing) — lint + build + smoke
    ↓ (on success)
Deploy workflow (new) — waits at approval gate
    ↓ (human clicks Approve in GitHub)
Cloudflare Pages production deploy
```

---

## Step 1 — Create GitHub protected environment

In GitHub → Settings → Environments → New environment:

- Name: `production`
- Required reviewers: add `zyahav` (the account owner)
- Wait timer: 0 minutes (approve immediately or reject)
- Deployment branches: restrict to `main` only

This means any job that uses `environment: production` will pause
and require manual approval before running.

---

## Step 2 — Move Cloudflare credentials to the environment

Currently these secrets live at repo level (or nowhere).
Move them to the `production` environment only — NOT at repo level:

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token scoped to Pages deploy only |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CF_PAGES_PROJECT_NAME` | The Cloudflare Pages project name |

All other secrets (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, etc.) stay at
repo level — they are needed by CI (build job) and are not sensitive
enough to require environment protection.

---

## Step 3 — Disable Cloudflare auto-deploy from git

In Cloudflare Pages dashboard → your project → Settings → Builds & deployments:
- Set production branch to `none` or disconnect the GitHub integration
- Deploy will only happen via GitHub Actions, never via Cloudflare watching git

---

## Step 4 — Create `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    name: Deploy to Cloudflare Pages
    runs-on: ubuntu-latest
    # This environment has required reviewers — job pauses until approved
    environment: production
    # Only run if CI passed
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    env:
      NEXT_PUBLIC_CONVEX_URL: ${{ secrets.NEXT_PUBLIC_CONVEX_URL }}
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      ISSUER: ${{ secrets.ISSUER }}
      RSA_PRIVATE_KEY: ${{ secrets.RSA_PRIVATE_KEY }}
      RSA_PUBLIC_KEY: ${{ secrets.RSA_PUBLIC_KEY }}
      RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
      RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build for production
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy .next --project-name=${{ secrets.CF_PAGES_PROJECT_NAME }} --branch=main
```

---

## Security guarantees this provides

| Threat | Protection |
|---|---|
| Agent pushes malicious code to main | CI runs on the push — if it fails, deploy never triggers |
| Agent tries to reach production directly | `environment: production` blocks until human approves |
| Credentials leaked via CI logs | Cloudflare credentials only injected inside the protected environment job |
| Cloudflare auto-deploys bypass the gate | Disabled — Cloudflare does not watch git |
| Someone runs the deploy workflow manually | Still requires environment approval |

---

## Files to create or change

| File | Action |
|---|---|
| `.github/workflows/deploy.yml` | Create — production deploy workflow |
| `docs/implementation/t-012-spec.md` | This file |

## Manual steps (cannot be done via code)

1. Create `production` environment in GitHub with required reviewers
2. Add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT_NAME` to that environment
3. Disable Cloudflare auto-deploy from git in Cloudflare dashboard

---

## Definition of done

- Push to main triggers CI automatically
- After CI passes, deploy workflow appears in GitHub Actions waiting for approval
- Clicking Approve deploys to Cloudflare Pages production
- Clicking Reject cancels the deploy
- No path exists to production that bypasses the approval step
