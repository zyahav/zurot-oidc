# ZurOt OIDC Onboarding

This runbook takes a developer from clone to a verified local setup and CI-ready secret configuration.

## 1. Security Model (Mandatory)

- BitWarden is the source of truth for secrets.
- GitHub Actions and local `.env.local` are derived copies.
- Never commit real secrets to git.
- Do not create a `SECRETS.md` file anywhere in this repo.

Required BitWarden items:
- `zurot-oidc / dev`
- `zurot-oidc / github-actions`

## 2. Required Secret Inventory

These six secrets are required for CI build and runtime configuration:

1. `NEXT_PUBLIC_CONVEX_URL`
2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
3. `CLERK_SECRET_KEY`
4. `ISSUER`
5. `RSA_PRIVATE_KEY`
6. `RSA_PUBLIC_KEY`

## 3. How to Obtain Each Secret

### 3.1 Convex URL

Secret:
- `NEXT_PUBLIC_CONVEX_URL`

Where to get it:
- Convex dashboard -> your project -> deployment URL (usually `https://<name>.convex.cloud`)

### 3.2 Clerk Keys

Secrets:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Where to get them:
- Clerk dashboard -> API Keys

### 3.3 Issuer

Secret:
- `ISSUER`

Set it to:
- Local development: `http://localhost:3000`
- Production/staging: your canonical issuer host (for example `https://zurot.org`)

The issuer must match token verification expectations in `src/lib/jwt.ts`.

### 3.4 RSA Signing Keys

Secrets:
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

If keys already exist in team custody:
- Reuse those keys and store exactly as provided.

If keys need to be generated:
```bash
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private.pem -out public.pem
```

Then copy full PEM content (including BEGIN/END lines) into BitWarden.

## 4. BitWarden Storage Procedure

Create or update these items:

### Item: `zurot-oidc / dev`

Store fields:
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER` (usually `http://localhost:3000` for local)
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

### Item: `zurot-oidc / github-actions`

Store the same six fields, with values intended for CI.

Recommended notes section:
- Source service (Clerk/Convex/generated)
- Last rotated date
- Owner/maintainer

## 5. Local Developer Setup

1. Clone and install:
```bash
npm ci
```

2. Create local env file:
```bash
cp .env.example .env.local
```

3. Fill `.env.local` using values from BitWarden item `zurot-oidc / dev`.

4. Start app:
```bash
npm run dev
```

5. Verify discovery endpoint:
```bash
curl -sS http://localhost:3000/.well-known/openid-configuration
```

Expected:
- JSON response with `issuer`, `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `jwks_uri`.

## 6. GitHub Actions Secret Setup

Repository path:
- `Settings` -> `Secrets and variables` -> `Actions`

Create repository secrets from BitWarden item `zurot-oidc / github-actions`:
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

After adding/updating secrets:
- Re-run CI for the active PR branch.
- CI build step validates presence of all required secrets and fails fast if any are missing.

## 7. Deployment Target Policy

- Official deployment target: Cloudflare Pages.
- Vercel should be disconnected for this repo to avoid non-authoritative failing checks/noise.

## 8. Verification Checklist for New Joiners

- `npm run lint` passes locally (warnings allowed where currently accepted).
- `npm run build` passes locally.
- Discovery endpoint returns valid JSON.
- PR CI `lint` and `build` jobs are green.

## 9. Related Docs

- `README.md` (project overview)
- `BASELINE.md` (locked OIDC contract)
- `WORKFLOW.md` (delivery lifecycle)
- `TASKS.md` (task sequence and status)
