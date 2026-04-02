# Session State

**Read DEV_PROTOCOL.md first. Then read this file.**

---

## Current state of main

- Branch: `main`
- HEAD: see `git log --oneline -1`
- QA: 14/14 passing
- Build: clean
- Platform: Vercel (project: zurot-oidc, domain: auth.zurot.org)

---

## Completed tasks

| Task | What it did | Status |
|---|---|---|
| T-001 to T-008 | Federation, auth, OIDC, first app | DONE |
| T-009 | Profiles v2.2 adoption | DONE |
| T-010 | Root redirect, sign-out, gate placeholder | DONE |
| T-011 | Account PIN gate — setup, entry, 30min unlock, recovery OTP | DONE |
| T-012 | Production deploy gate — workflow file written, manual steps pending | PARTIAL |

---

## T-012 — Manual steps required (do these before next deploy)

The `deploy.yml` workflow is in the repo and correct. Before it can
run successfully, these 4 manual steps must be completed:

### 1. Create GitHub protected environment
GitHub → Settings → Environments → New → name: `production`
- Required reviewers: zyahav
- Deployment branches: main only
- Add these secrets to the environment:
  - `VERCEL_TOKEN` (from vercel.com/account/tokens)
  - `VERCEL_ORG_ID` (from .vercel/project.json after `npx vercel link`)
  - `VERCEL_PROJECT_ID` (from .vercel/project.json)
  - `RSA_PRIVATE_KEY`
  - `CLERK_SECRET_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`

### 2. Get Vercel IDs
Run locally:
```bash
cd /Users/zyahav/Documents/dev/ZurOt.org/zurot-hub-monorepo
npx vercel link
cat .vercel/project.json
```
Copy `projectId` → `VERCEL_PROJECT_ID`
Copy `orgId` → `VERCEL_ORG_ID`

### 3. Disable Vercel auto-deploy
Vercel dashboard → zurot-oidc → Settings → Git → disable Auto Deploy

### 4. Create Vercel token
vercel.com/account/tokens → Create → name: github-actions-prod
Copy into GitHub `production` environment as `VERCEL_TOKEN`

---

## Known constraints

- Owner PIN gate uses React state only — resets on every page load
- PIN keypad clicks race in headless Playwright — `ensureManageUnlocked` handles this, do not change it
- Clerk email OTP does not work for re-auth of signed-in users
- Recovery OTP uses Resend — requires RESEND_API_KEY in .env.local

---

## Next task after T-012 manual steps

Await new spec from PM.
