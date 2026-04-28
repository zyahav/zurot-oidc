# ZurOt OIDC

ZurOt OIDC is a Next.js + Convex identity provider focused on profile-scoped authentication.

Core behavior:
- One human account can own multiple profiles.
- User explicitly selects a profile during auth.
- Tokens are issued per selected profile (`sub = profile_<id>`).
- RS256 signing with JWKS and OIDC discovery endpoints.

## Project Docs

- Baseline contract: `BASELINE.md`
- Team workflow: `WORKFLOW.md`
- Task tracker: `TASKS.md`
- Onboarding: `ONBOARDING.md`
- Session handoff state: `SESSION_STATE.md`

## Quick Start

1. Install dependencies:
```bash
npm ci
```

2. Configure environment:
```bash
cp .env.example .env.local
```
Then fill `.env.local` from BitWarden using `ONBOARDING.md`.

3. Run app:
```bash
npm run dev
```

4. Verify quality gates:
```bash
npm run lint
npm run build
```

## OIDC Surface

- `GET /oauth/authorize`
- `POST /api/oauth/authorize`
- `POST /api/oauth/token`
- `GET /api/oauth/userinfo`
- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`

## Internal Route

- `GET /internal` is the developer harness page for profile creation/management and phase checks.

## Routing Model

- `zurot.org` serves the public, email-first landing page.
- `NEXT_PUBLIC_APP_URL` is the canonical app entrypoint for profile selection (for example, `http://localhost:3000` in dev or `https://app.zurot.org` in prod).
- Profile flow continues at `/profiles` and `/portal` on the app entrypoint.

## CI/CD Status

- CI workflow lives at `.github/workflows/ci.yml`
- Current T-001 scope: lint + build on PR/push with required build-time secrets
- Production deploy gate workflow lives at `.github/workflows/deploy.yml` (Vercel + GitHub protected environment approval)
