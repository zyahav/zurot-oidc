# ZurOt – Federated App Integration Guide

**Status:** REQUIRED FOR ALL APPS
**Depends on:**
- _ZurOt – Core Identity & Federation Spec (Frozen)_
- _ZurOt – Phase 0 Hub Implementation Guide_

This document defines **how any app integrates with ZurOt**.
If an app violates these rules, it is not a ZurOt app.

---

## 1. Purpose

ZurOt is a **federated platform**.

Apps are consumers of identity — never authorities.

This guide prevents:
- Identity shortcuts
- Profile leakage
- OSS misconfiguration
- Permission drift

---

## Token Contract Reference

Before implementing auth in any federated app, read `docs/architecture/token-contract.md`.
The JWT claim for permissions is `scopes` (array), not `scope` (string).

---

## 2. What an App Is (and Is Not)

### An App IS
- A standalone service
- Deployed on its own subdomain
- Authenticated via OIDC

### An App IS NOT
- An identity provider
- A profile manager
- A Clerk client

---

## 3. Authentication Flow (Mandatory)

Every app must:

1. Redirect unauthenticated users to ZurOt IdP
2. Complete standard OIDC Authorization Code flow
3. Receive an ID token + access token

Apps must never:
- Accept direct login
- Authenticate via Clerk

---

## 4. Identity Rules (Critical)

### Subject Rule

- The OIDC `sub` claim **IS the profileId**
- Treat `sub` as the unique user key

Apps must not:
- Attempt to derive userId
- Assume multiple profiles per `sub`

---

## 5. Data Ownership Rules

All app data:
- Must be owned by `profileId`
- Must be keyed by `sub`

Forbidden ownership keys:
- Clerk userId
- Email
- Session ID

---

## 6. Permissions Handling

- Permissions arrive via token claims
- Apps enforce permissions locally

### Sensitive Actions
For sensitive actions (minors, moderation, admin):
- Apps SHOULD re-validate permissions via Hub API

---

## 7. Profile Switching

- Profile switching = re-authentication
- App must discard token and restart OIDC

Apps must not:
- Allow in-app profile switching
- Cache profile assumptions

---

## 8. URL & Handle Resolution

Handles (`@name`) are presentation only.

Apps must resolve handles via:

```
GET https://zurot.org/profiles/resolve?handle=@name
```

Apps must never:
- Resolve handles locally

---

## 9. Activity Feed Emission (Mandatory)

Apps must emit activity metadata on write.

### Required Schema
```json
{
  "activityId": "uuid",
  "ownerProfileId": "profileId",
  "app": "app-name",
  "type": "event.type",
  "title": "string",
  "thumbnailUrl": "optional",
  "deepLink": "url",
  "createdAt": "timestamp"
}
```

Feed writes go to the Hub.
Apps never read from other apps.

---

## 10. OSS-Specific Guidance

When integrating OSS (e.g. LobeChat):

- Use standard OIDC configuration
- Map `sub` to the app’s user table
- Map roles/permissions to expected claims

Do NOT:
- Fork auth logic
- Rewrite user models

---

## 11. Security & Logout

- Apps must validate JWT signatures via JWKS
- Apps must honor token expiry

### Back-Channel Logout

When notified by Hub:
- Immediately invalidate sessions

---

## 12. Failure Modes (What Not To Do)

If an app:
- Stores data by userId
- Allows implicit profile switching
- Bypasses OIDC

Then the app is non-compliant.

---

## 13. Definition of Compliance

An app is compliant when:

- All data is keyed by `sub`
- All auth is via OIDC
- No profile logic exists in the app

---

End of Federated App Integration Guide.
