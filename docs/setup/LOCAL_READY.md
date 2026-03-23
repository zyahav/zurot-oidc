# Local Ready Checklist

Complete each check before handling secrets.

## 1. Prerequisites

- Git installed
- Node.js 20.x installed
- npm installed
- OpenSSL installed
- Access to BitWarden vault containing ZurOt items
- Access to Clerk dashboard
- Access to Convex dashboard
- Access to GitHub repository settings

## 2. Repository

1. Clone repository.
2. Checkout target branch.
3. Install dependencies:
```bash
npm ci
```

## 3. Baseline Validation

Run local checks once before configuring secrets:
```bash
npm run lint
npm run build
```

If build fails due to missing env vars, continue to `SECRETS_BOOTSTRAP.md`.

## 4. Required Secret Names (Reference)

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

Proceed to `docs/setup/SECRETS_BOOTSTRAP.md`.
