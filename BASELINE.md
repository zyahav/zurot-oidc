# ZurOt Baseline Contract

This document locks the current implementation contract for baseline stabilization on `main`.

## Environment Source of Truth

- Issuer env var: `ISSUER`
- Fallback behavior:
  - Development: `http://localhost:3000`
  - Production (if `ISSUER` is unset): `https://zurot.org`

## Identity Contract

- `sub` format: `profile_<convexProfileId>`
- JWT scopes claim: `scopes` (string array) — not the standard OIDC `scope` string. Format: `["game:instructor", "game:viewer"]`
- `account_id` claim: required and intentional
  - Purpose: represent the human account identity separately from the selected profile identity.
  - `sub` is profile-scoped identity; `account_id` is the parent human account context.

## Canonical OIDC/OAuth Endpoints

- Authorization endpoint: `/oauth/authorize`
- Token endpoint: `/api/oauth/token`
- Userinfo endpoint: `/api/oauth/userinfo`
- JWKS endpoint: `/.well-known/jwks.json`
- Discovery endpoint: `/.well-known/openid-configuration`

## Discovery Behavior

- Discovery response is generated via `getOpenIDConfiguration(ISSUER)` in `src/lib/jwt.ts`.
- JWT issuance and JWT verification both use the same `ISSUER` constant from `src/lib/jwt.ts`.

## Baseline Quality Gates

- `npm run lint`: passes with zero errors.
- `npm run build`: passes.
- Smoke checks required:
  - Discovery endpoint responds and exposes canonical endpoints.
  - JWKS endpoint responds with key set.
  - Token/userinfo endpoint basic error-path responses are correct for invalid/unauthorized calls.
