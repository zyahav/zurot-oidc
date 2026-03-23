# Local Ready Checklist

Complete each check before handling secrets.

## 1. Prerequisites

Run each command and verify expected output before continuing.

1. Git:
```bash
git --version
```
Expected: version line like `git version 2.x.x`.

2. Node.js:
```bash
node --version
```
Expected: `v20` or higher.

3. npm:
```bash
npm --version
```
Expected: numeric version (for example `10.x.x`).

4. OpenSSL:
```bash
openssl version
```
Expected: line containing `OpenSSL`.

5. BitWarden access:
- Sign in to BitWarden web app or desktop app.
- Confirm you can create/view items in the team vault.

6. Service access:
- Clerk dashboard access confirmed.
- Convex dashboard access confirmed.
- GitHub repository settings access confirmed.

## 2. Repository

1. Clone repository.
2. Checkout target branch.
3. Install dependencies:
```bash
npm ci
```
Expected: install finishes without fatal errors.

## 3. Baseline Validation

Run local checks once before configuring secrets:
```bash
npm run lint
npm run build
```
Expected:
- `lint`: no errors (warnings are acceptable per current baseline).
- `build`: completes successfully.

If build fails due to missing env vars, continue to `SECRETS_BOOTSTRAP.md`.

## 4. Required Secret Names (Reference)

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

Proceed to `docs/setup/SECRETS_BOOTSTRAP.md`.
