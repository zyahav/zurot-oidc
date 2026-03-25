# T-006 Spec — First Federated App Integration

**Status:** APPROVED — ready for implementation  
**Branch:** `codex/first-federated-app`  
**Spec References:** `BASELINE.md`, `docs/integration/federated-app-integration-guide.md`, `docs/architecture/identity-federation-core.md`

---

## One-line scope

Register `mall-hebrew-adventures` as the first OAuth client in the system, run a complete end-to-end OIDC authorization code flow against it, and verify the token contract is correct. No changes to the app itself — this task lives entirely in `zurot-oidc`.

---

## What this task is and is not

**This task IS:**
- Registering mall-hebrew-adventures as a client in Convex (`oauthClients` table)
- Verifying the full OIDC flow works end-to-end using the existing test page
- Confirming the token contains the correct claims per BASELINE.md
- Adding a registered client seed script so the client can be re-registered in any environment

**This task IS NOT:**
- Modifying the mall-hebrew-adventures app
- Building any new OIDC endpoints
- Implementing token revocation or back-channel logout
- Changing the homepage or profile system

---

## Client registration details

Register this client in the `oauthClients` Convex table:

```
clientId:     "mall-hebrew-adventures"
redirectUris: ["https://mall-hebrew-adventures.pages.dev/auth/callback",
               "http://localhost:5173/auth/callback"]
clientSecret: null (public client — PKCE required)
```

**Why PKCE is required:** mall-hebrew-adventures is a browser-based app (public client). It cannot securely store a client secret. PKCE is already implemented in the OIDC provider from OIDC-006. No new code needed.

---

## How to register the client

Two approaches — implement both:

### Approach 1 — Convex mutation (existing)
Use the existing `registerClient` mutation in `convex/oauth.ts`. This can be called from the Convex dashboard or from a script.

### Approach 2 — Seed script (new)
Create `scripts/seed/register-clients.mjs` that calls `registerClient` for each known client. This ensures clients can be re-registered in any environment (dev, CI, production) without manual Convex dashboard steps.

**Idempotency requirement (mandatory):** the seed script must be safe to run repeatedly. If `registerClient` is called for a client that already exists, it must upsert or skip silently, never throw. The existing `registerClient` mutation in `convex/oauth.ts` already enforces this behavior by checking for an existing client and patching if found, so the seed script inherits idempotency by calling that mutation.

```js
// scripts/seed/register-clients.mjs
// Run: node scripts/seed/register-clients.mjs
```

Add `seed:clients` to `package.json` scripts and `make seed-clients` to the Makefile.

---

## End-to-end flow to verify

Using the existing test page at `/test`, manually verify this complete sequence:

1. Navigate to `/oauth/authorize?client_id=mall-hebrew-adventures&redirect_uri=http://localhost:5173/auth/callback&response_type=code&state=test123`
2. Sign in with Clerk if not signed in
3. Select a profile from the profile picker
4. Verify redirect to `http://localhost:5173/auth/callback?code=<code>&state=test123`
5. Exchange the code at `POST /api/oauth/token` with the correct parameters
6. Verify the token response contains `access_token`, `id_token`, `token_type: Bearer`, `expires_in: 900`
7. Decode the `id_token` and verify these claims:
   - `iss`: matches `ISSUER` value
   - `sub`: format is `profile_<convexId>`
   - `aud`: equals `mall-hebrew-adventures`
   - `account_id`: present (human account context)
   - `name`: profile display name
   - `preferred_username`: profile handle
8. Call `GET /api/oauth/userinfo` with the access token as Bearer
9. Verify userinfo response contains `sub`, `name`, `preferred_username`

---

## Token contract verification (critical)

Per `BASELINE.md` and `docs/architecture/identity-federation-core.md`, verify these invariants hold:

| Claim | Expected value | Why |
|---|---|---|
| `sub` | `profile_<convexId>` | Profile is the acting identity, not the user |
| `aud` | `mall-hebrew-adventures` | Token is scoped to this client |
| `iss` | Value of `ISSUER` env var | Must match discovery document |
| `account_id` | `account_<userId>` | Human account context, separate from profile |
| `iat` + `exp` | 15-minute window | Per OIDC spec v1.3 |

If any of these fail, T-006 is not done.

---

## Files to change

| File | Action |
|---|---|
| `scripts/seed/register-clients.mjs` | New — seed script for client registration |
| `package.json` | Add `seed:clients` script |
| `Makefile` | Add `seed-clients` target |

No Convex schema changes. No endpoint changes. No homepage changes.

---

## Acceptance criteria

- `mall-hebrew-adventures` client exists in Convex `oauthClients` table with correct redirect URIs
- Seed script successfully registers the client when run in a fresh environment
- Full OIDC authorization code flow completes without errors
- ID token contains all required claims with correct values
- `sub` format is `profile_<convexId>` — not userId, not email
- `aud` matches client ID exactly
- `iss` matches the discovery document issuer
- Userinfo endpoint returns correct profile data
- Lint passes, build passes, smoke tests pass

---

## Important note on redirect URI for testing

The redirect URI `http://localhost:5173/auth/callback` will not resolve to a real server during testing — that's fine. The authorization code flow just needs a valid registered URI. You can capture the redirect manually from the browser address bar after the authorize step.

Alternatively, add `http://localhost:3000/test` as a registered redirect URI so the existing test page can receive the callback directly.
