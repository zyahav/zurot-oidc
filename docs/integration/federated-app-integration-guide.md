# ZurOt Federated App Integration Guide

**Status:** Required for all ZurOt apps  
**Audience:** App developers integrating `meta.zurot.org`, `phone.zurot.org`, or any future ZurOt subdomain app.

ZurOt apps are consumers of identity. They do not own login, profiles, profile switching, or account management. Those responsibilities stay in ZurOt OIDC / Hub.

## Production Domains

Use this domain model for production:

| Domain | Purpose |
| --- | --- |
| `https://zurot.org` | Public landing page |
| `https://app.zurot.org` | Hub UI: profiles, portal, app launcher, manage profiles |
| `https://auth.zurot.org` | OIDC issuer and auth endpoints |
| `https://meta.zurot.org` | Federated client app |
| `https://phone.zurot.org` | Federated client app |

The OIDC issuer is:

```text
https://auth.zurot.org
```

Apps should discover endpoints from:

```text
https://auth.zurot.org/.well-known/openid-configuration
```

Current provider endpoints:

```text
GET  https://auth.zurot.org/oauth/authorize
POST https://auth.zurot.org/api/oauth/token
GET  https://auth.zurot.org/api/oauth/userinfo
GET  https://auth.zurot.org/.well-known/jwks.json
```

## App Registration

Before an app can authenticate through ZurOt, it must be registered as an OAuth client in the ZurOt Convex `oauthClients` table.

For `meta.zurot.org`:

```text
client_id: meta
redirect_uri: https://meta.zurot.org/auth/callback
token_endpoint_auth_method: none
```

For `phone.zurot.org`:

```text
client_id: phone
redirect_uri: https://phone.zurot.org/auth/callback
token_endpoint_auth_method: none
```

Browser apps are public clients. They must not store a client secret. Use Authorization Code with PKCE when the client framework supports it.

Exact redirect URI matching is enforced. If an app uses a staging or local callback URL, that exact URL must also be registered.

Examples:

```text
https://staging-meta.zurot.org/auth/callback
http://localhost:5173/auth/callback
http://localhost:3000/auth/callback
```

## Required App Configuration

Each app should have environment variables like:

```bash
ZUROT_OIDC_ISSUER=https://auth.zurot.org
ZUROT_CLIENT_ID=meta
ZUROT_REDIRECT_URI=https://meta.zurot.org/auth/callback
ZUROT_POST_LOGOUT_REDIRECT_URI=https://meta.zurot.org
```

Use `phone` and `https://phone.zurot.org/auth/callback` for the phone app.

If a framework expects standard OIDC names, use:

```bash
OIDC_ISSUER=https://auth.zurot.org
OIDC_CLIENT_ID=meta
OIDC_REDIRECT_URI=https://meta.zurot.org/auth/callback
```

## Authentication Flow

Unauthenticated users must be sent to ZurOt:

```text
https://auth.zurot.org/oauth/authorize
  ?response_type=code
  &client_id=meta
  &redirect_uri=https%3A%2F%2Fmeta.zurot.org%2Fauth%2Fcallback
  &scope=openid%20profile
  &state=<random-state>
  &code_challenge=<pkce-code-challenge>
  &code_challenge_method=S256
```

ZurOt will handle account login and profile selection. After success, ZurOt redirects back:

```text
https://meta.zurot.org/auth/callback?code=<authorization-code>&state=<same-state>
```

The app then exchanges the code:

```http
POST https://auth.zurot.org/api/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<authorization-code>
&client_id=meta
&redirect_uri=https%3A%2F%2Fmeta.zurot.org%2Fauth%2Fcallback
&code_verifier=<pkce-code-verifier>
```

The response includes:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 900,
  "id_token": "..."
}
```

Tokens expire after 15 minutes.

## Token Contract

Read the canonical contract in `docs/architecture/token-contract.md`.

Important rules:

| Claim | Meaning |
| --- | --- |
| `iss` | `https://auth.zurot.org` in production |
| `aud` | The app `client_id`, for example `meta` |
| `sub` | The selected profile identity, formatted as `profile_<profileId>` |
| `name` | Profile display name |
| `preferred_username` | Profile username/handle |
| `account_id` | Human account metadata, not the app user key |
| `scopes` | ZurOt permissions array |
| `https://zurot.org/profile_context` | Profile metadata |

Apps must key user data by `sub`.

Do not key app data by:

- Clerk user ID
- Email
- Browser session ID
- `account_id`

`account_id` identifies the human account layer. It is useful metadata, but app-owned records belong to the selected profile `sub`.

## Permission Handling

ZurOt sends permissions in `scopes` as an array.

Example:

```json
{
  "scopes": ["hub:profile:read", "hub:profile:update"]
}
```

Apps must read `scopes`, not the standard OIDC `scope` string.

Current implementation note: product-specific scope mapping exists for known products such as `mall-hebrew-adventures`. New clients like `meta` and `phone` may initially receive default hub scopes until the translation engine maps those client IDs to their products.

## Validating Tokens

Apps must validate JWTs using the ZurOt JWKS:

```text
https://auth.zurot.org/.well-known/jwks.json
```

Validation requirements:

- Algorithm: `RS256`
- Issuer: `https://auth.zurot.org`
- Audience: the app `client_id`
- Expiration: must be honored
- Subject: must start with `profile_`

Apps may call userinfo with the access token:

```http
GET https://auth.zurot.org/api/oauth/userinfo
Authorization: Bearer <access_token>
```

## Profile Switching

Profile switching is re-authentication.

If a user wants to switch profile, the app should discard local tokens/session state and restart the OIDC authorize flow. Apps must not implement their own profile switcher.

## Logout

For now, apps should treat logout as local token/session cleanup.

Previously issued ZurOt tokens remain valid until their natural 15-minute expiration. Back-channel logout is an architecture goal, but app developers should not depend on it until this provider exposes and documents that production hook.

## What Apps Must Not Do

Apps must not:

- Use Clerk directly
- Ask users to log in directly inside the app
- Create or edit ZurOt profiles
- Store app data by email or account ID
- Let users switch profiles locally
- Trust unvalidated JWTs
- Invent permissions outside the `scopes` array

## Current Gaps To Coordinate With ZurOt

Before `meta` or `phone` goes live, coordinate these with the ZurOt provider:

- Register the app's `client_id` and exact redirect URI.
- Add product-specific scope mapping if the app needs non-hub permissions.
- Confirm local/staging callback URLs.
- Confirm whether the app is SPA-only or has a backend callback handler.
- Confirm production `ISSUER=https://auth.zurot.org`.

Handle resolution and activity-feed APIs are planned platform capabilities, but they are not currently documented as implemented provider endpoints. Do not build against those APIs until a concrete endpoint contract is published.

## Minimal Handoff For Meta Dev

```text
Use ZurOt OIDC.
Issuer: https://auth.zurot.org
Client ID: meta
Redirect URI: https://meta.zurot.org/auth/callback
Flow: Authorization Code with PKCE
Discovery: https://auth.zurot.org/.well-known/openid-configuration
JWKS: https://auth.zurot.org/.well-known/jwks.json
User key: JWT sub
Permissions: JWT scopes array
Do not use Clerk directly.
```

## Minimal Handoff For Phone Dev

```text
Use ZurOt OIDC.
Issuer: https://auth.zurot.org
Client ID: phone
Redirect URI: https://phone.zurot.org/auth/callback
Flow: Authorization Code with PKCE
Discovery: https://auth.zurot.org/.well-known/openid-configuration
JWKS: https://auth.zurot.org/.well-known/jwks.json
User key: JWT sub
Permissions: JWT scopes array
Do not use Clerk directly.
```
