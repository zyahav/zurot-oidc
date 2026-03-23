# Secrets Bootstrap (BitWarden First)

⚠️ ENVIRONMENT SAFETY — MANDATORY
- Never use production credentials, keys, or Convex project during onboarding
- All onboarding uses zurot-oidc-dev only
- Never copy values between environments (dev ↔ prod)
- If there is any doubt about which environment you are in — STOP and verify before continuing
- Production environment setup is handled in a separate document

## 1. BitWarden Source of Truth

Create or update these BitWarden items.

BitWarden creation steps:
1. Click `New item`.
2. Item type: `Login`.
3. Name it exactly as required below.
4. Add custom fields for secrets.
5. Save item.

Field type guidance:
1. Use `Text` for:
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `ISSUER`
2. Use `Hidden` for:
- `CLERK_SECRET_KEY`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

- `zurot-oidc / dev`
- `zurot-oidc / github-actions`

Both items must include the same field names:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

## 2. Create/Get Secret Values

### 2.1 NEXT_PUBLIC_CONVEX_URL

Source:
- Convex dashboard -> project settings -> deployment URL

Important:
- Copy the Convex Cloud URL (`https://...convex.cloud`), not the HTTP Actions URL.

Store value in BitWarden fields for both items.

### 2.2 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

Source:
- Clerk dashboard -> API Keys -> Publishable key

Important:
- Use the environment dropdown in Clerk and switch to the Development instance before copying keys.

Store value in BitWarden fields for both items.

### 2.3 CLERK_SECRET_KEY

Source:
- Clerk dashboard -> API Keys -> Secret key

Important:
- Use the Development instance in Clerk (same environment as publishable key).

Store value in BitWarden fields for both items.

### 2.4 ISSUER

Set value based on environment:

- Dev/local: `http://localhost:3000`
- CI/prod target: chosen canonical issuer (for example `https://zurot.org`)

Store value in BitWarden fields for both items.

### 2.5 RSA_PRIVATE_KEY and RSA_PUBLIC_KEY

If keys already exist in team custody, reuse them.

If keys must be generated for dev:
```bash
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private.pem -out public.pem
```

Copy full PEM content (including BEGIN/END lines) into BitWarden.

Before deleting any generated files:
1. Open both BitWarden items.
2. Confirm `RSA_PRIVATE_KEY` and `RSA_PUBLIC_KEY` fields are present and saved.
3. Re-open item to verify persistence.

After successful verification, delete temporary key files:
```bash
rm -f private.pem public.pem
```

## 3. STOP Checkpoint (Before Local Use)

Confirm all six fields exist in `zurot-oidc / dev`.

If any field is missing, STOP and complete BitWarden entries first.

## 4. STOP Checkpoint (Before CI Use)

Confirm all six fields exist in `zurot-oidc / github-actions`.

If any field is missing, STOP and complete BitWarden entries first.

## 5. Sync to GitHub Actions Secrets

GitHub path:
- Repository -> Settings -> Secrets and variables -> Actions

Create repository secrets with exact names:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

After creation, re-run CI for the working PR branch.
