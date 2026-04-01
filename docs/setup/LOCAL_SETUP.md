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

---

## 9. QA Runner — Required Setup

The end-to-end QA runner (`make qa-run2`) has hard dependencies that are not part of the standard app install. Missing any of these causes silent, misleading failures.

### 9a. Required dev dependencies

Both must be in `package.json` as explicit dev dependencies — not globally installed:

```bash
npm install playwright @clerk/testing --save-dev
```

**Why `playwright` must be local:** The QA runner imports `playwright` directly. If it is only installed globally, module resolution fails silently depending on how Node is invoked. Always install locally.

**Why `@clerk/testing` must be used:** Clerk v6+ associates sessions with a browser client record at sign-in time. Cookie injection and server-created session tokens cannot replicate this association — middleware will always reject them with `session-token-but-no-client-uat`. `@clerk/testing/playwright` is the only supported path for automated headless auth.

### 9b. Required env vars for QA

No additional QA-specific env vars are required beyond the standard `.env.local` keys.

### 9c. How `@clerk/testing` works — do not deviate

The correct bootstrap sequence in any QA script:

```javascript
import { clerkSetup, clerk, setupClerkTestingToken } from '@clerk/testing/playwright';

// 1. clerkSetup() sets CLERK_FAPI and CLERK_TESTING_TOKEN as env var side effects.
//    Returns undefined — do not destructure it.
await clerkSetup();

// 2. Create browser context.
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// 3. Call setupClerkTestingToken BEFORE the first page.goto.
//    It installs a request interceptor — must be in place before Clerk JS loads.
await setupClerkTestingToken({ page });

// 4. Navigate then sign in via emailAddress.
//    clerk.signIn handles the sign-in token internally — do not build one manually.
await page.goto(`${BASE_URL}/profiles`, { waitUntil: 'networkidle' });
await clerk.signIn({ page, emailAddress: email });
```

**Mistakes that break auth and why:**

| Mistake | Why it fails |
|---|---|
| Seeding `__session` + `__client_uat` cookies manually | Clerk v6 middleware rejects sessions with no associated browser client record. Cookie injection cannot create this association. |
| Using `clerk.sessions.createSession()` + JWT for browser auth | Server-created sessions have no browser client UAT. Middleware returns `signed-out`. |
| Calling `setupClerkTestingToken` after `page.goto` | Interceptor not in place for first request — Clerk JS loads without testing token, `window.Clerk` never becomes available. |
| Destructuring return value of `clerkSetup()` | Returns `undefined`. Side effects set `process.env.CLERK_FAPI` and `process.env.CLERK_TESTING_TOKEN`. |
| Priming navigation to `/` | Root route was removed in Phase 4. Never assume `/` exists. |

### 9d. Dev server must be healthy before running QA

A broken dev server causes headless browser failures that look like auth failures. Before running `make qa-run2`:

```bash
npm run dev
# Open http://localhost:3000/profiles in a browser — confirm it loads without errors
```

If you see a `lightningcss` native module error:

```bash
npm install
# If still failing:
npm rebuild lightningcss
```

This is a native binary mismatch — caused by a Node version change or incomplete install after switching branches. Fix the dev server first. Do not debug the QA runner while the server is broken.

---

## 10. Clerk JWT Template — Required for Per-Session Profiles

The `activeProfiles` table scopes the active profile by `sessionId`. This `sessionId` is read from the `sessionId` claim in the Clerk JWT that is sent to Convex.

**By default, Clerk's Convex JWT template does not include `sessionId`.** Without it, every call to `setActiveProfile` and `getActiveProfile` silently fails — `setActiveProfile` throws internally and navigation to `/portal` never happens.

### One-time setup in Clerk Dashboard

1. Go to Clerk Dashboard → Configure → JWT Templates
2. Find the template named `convex`
3. Add this claim to the template body:

```json
{
  "sessionId": "{{session.id}}"
}
```

4. Save the template

Once saved, the `sessionId` claim will be present in every Convex JWT and per-session profile scoping will work correctly.

### What breaks without this

- Profile selection never navigates to `/portal` — `setActiveProfile` throws silently
- `getActiveProfile` always returns null — portal guard immediately redirects back to `/profiles`
- The entire per-device active profile feature is non-functional

### Fallback behavior in code

`convex/profiles.ts` has a defensive fallback in `getSessionId` that uses `tokenIdentifier` if `sessionId` is absent. This prevents a hard crash but means all sessions for a user share one active profile (defeating the per-device isolation the spec requires). The dashboard fix is still required for correct behavior.
