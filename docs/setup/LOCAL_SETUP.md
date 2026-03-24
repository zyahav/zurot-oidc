# Local Setup

Follow these steps exactly.

## 1. Create Local Env File

```bash
cp .env.example .env.local
```

## 2. Fill `.env.local` Key by Key

From BitWarden item `zurot-oidc / dev`, copy values for:

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER`
- `NEXT_PUBLIC_APP_URL`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

Use full PEM values for RSA keys.

## 3. Start App

```bash
npm run dev
```

Open browser:
- Go to `http://localhost:3000/`
- Confirm app root loads (not blank/error page).

Terminal check:
- Confirm there are no Convex connection errors in terminal output.

## 4. Verify OIDC Discovery

```bash
curl -sS http://localhost:3000/.well-known/openid-configuration
```

Expected keys in JSON:

- `issuer`
- `authorization_endpoint`
- `token_endpoint`
- `userinfo_endpoint`
- `jwks_uri`

## 5. Run Local Quality Gates

```bash
npm run lint
npm run build
```

## 6. Done Criteria

Local onboarding is done when:

- App boots locally
- Discovery endpoint returns valid JSON
- Lint passes (warnings allowed per current baseline)
- Build passes
