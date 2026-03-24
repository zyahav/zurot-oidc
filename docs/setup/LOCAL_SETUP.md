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

## 3. STOP — Verify Before Continuing

Confirm both:

- `CONVEX_DEPLOYMENT` is set to your dev project (not prod)
- You are ready to run `npx convex dev` in a separate terminal

Do not continue if either check fails.

## 4. Deploy Convex Functions (Mandatory)

Open a terminal and run:

```bash
npx convex dev
```

What to do next:
- Keep this terminal running (it stays in sync with your code)
- Wait until you see `Convex functions ready` before continuing
- Open a second terminal for Next.js app runtime

Without this step the app may fail with errors like:
- `Could not find public function ...`

## 5. Start App

```bash
npm run dev
```

Open browser:
- Go to `http://localhost:3000/`
- Confirm app root loads (not blank/error page).

Terminal check:
- Confirm there are no Convex connection errors in terminal output.

## 6. Verify OIDC Discovery

```bash
curl -sS http://localhost:3000/.well-known/openid-configuration
```

Expected keys in JSON:

- `issuer`
- `authorization_endpoint`
- `token_endpoint`
- `userinfo_endpoint`
- `jwks_uri`

## 7. Run Local Quality Gates

```bash
npm run lint
npm run build
```

## 8. Done Criteria

Local onboarding is done when:

- App boots locally
- Discovery endpoint returns valid JSON
- Lint passes (warnings allowed per current baseline)
- Build passes
