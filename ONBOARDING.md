# ZurOt OIDC Onboarding

This guide gets a new developer from clone to running app with the team security model.

## 1. Source of Truth for Secrets

BitWarden is the authoritative source.

Required vault items:
- `zurot-oidc / dev`
- `zurot-oidc / github-actions`

Do not create any `SECRETS.md` file in this repository.

## 2. Required Secrets and Where to Get Them

1. `NEXT_PUBLIC_CONVEX_URL`
- Source: Convex dashboard
- Path: Project settings -> Deployment URL

2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Source: Clerk dashboard
- Path: API Keys -> Publishable key

3. `CLERK_SECRET_KEY`
- Source: Clerk dashboard
- Path: API Keys -> Secret key

4. `ISSUER`
- Source: project configuration decision
- Value examples:
- Local: `http://localhost:3000`
- Production: `https://zurot.org` (or your chosen auth host)

5. `RSA_PRIVATE_KEY`
- Source: generated RSA key pair (team-managed)
- Store full PEM in BitWarden secure field

6. `RSA_PUBLIC_KEY`
- Source: generated RSA key pair (team-managed)
- Store full PEM in BitWarden secure field

## 3. Local Setup

1. Install dependencies:
```bash
npm ci
```

2. Create local env file:
```bash
cp .env.example .env.local
```

3. Populate `.env.local` from BitWarden item `zurot-oidc / dev`.

4. Verify app boots:
```bash
npm run dev
```

5. Verify discovery endpoint:
```bash
curl -sS http://localhost:3000/.well-known/openid-configuration
```

## 4. GitHub Actions Secrets Setup

Populate repository secrets from BitWarden item `zurot-oidc / github-actions`:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

GitHub path:
- Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

## 5. Deployment Target Decision

Deployment target for this project is Cloudflare Pages, not Vercel.

- If Vercel integration is still connected, disconnect it to avoid false-fail noise on PRs.
- Cloudflare deploy workflows are handled separately from T-001 CI bootstrap.

## 6. Quality Gates

Before opening or updating a PR:
```bash
npm run lint
npm run build
```

See also:
- `BASELINE.md` for the locked OIDC contract
- `WORKFLOW.md` for execution lifecycle
- `TASKS.md` for current task sequencing
