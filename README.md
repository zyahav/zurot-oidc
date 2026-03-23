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

## CI/CD Status

- CI workflow lives at `.github/workflows/ci.yml`
- Current T-001 scope: lint + build on PR/push with required build-time secrets
- Deployment target decision: Cloudflare Pages (not Vercel)
