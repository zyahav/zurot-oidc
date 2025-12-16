# ZurOt – OIDC Provider Implementation Pack (Profile‑Scoped Tokens)

**Status:** Phase‑0 Extension · Harness‑Executable

**Depends on:**
- ZurOt – Core Identity & Federation Spec (Frozen)
- ZurOt – Phase 0 Hub Implementation Guide
- ZurOt – Phase 0 Convex Identity Code Pack

This document defines the **exact OIDC provider behavior** for ZurOt.
It is written so a harnessed agent (Anthropic / BMAD) can implement, test, and validate the full auth loop **end‑to‑end**.

---

## 1. Purpose

The ZurOt Hub acts as a **standards‑compliant OpenID Connect Identity Provider (IdP)**.

Its job is to:
- Authenticate a human (via Clerk)
- Force explicit **profile selection**
- Issue tokens where the **Profile is the Subject**

Nothing else.

---

## 2. Non‑Negotiable Identity Rules (Reasserted)

- `sub` **MUST equal** `profileId`
- A token represents **exactly one profile**
- Switching profiles == re‑authentication
- Apps never see Clerk user IDs

If any implementation violates these, it is invalid.

---

## 3. Supported OIDC Flow

ZurOt supports **Authorization Code Flow** only.

Implicit flow is forbidden.

---

## 4. Required Endpoints

The Hub MUST expose the following endpoints:

```
GET  /oauth/authorize
POST /oauth/token
GET  /oauth/userinfo
GET  /.well-known/openid-configuration
GET  /.well-known/jwks.json
```

These endpoints MUST be reachable at:

```
https://zurot.org
```

---

## 5. /oauth/authorize – Profile‑Aware Authorization

### Step‑by‑Step Flow

1. App redirects user to `/oauth/authorize`
2. Hub verifies Clerk session
3. Hub loads all active profiles for the user
4. Hub presents **Netflix‑style profile picker**
5. User selects a profile
6. Hub issues authorization code bound to `profileId`

### Required Parameters

```
response_type=code
client_id
redirect_uri
scope=openid profile
state
```

### Optional Parameters

```
profile_hint=<profileId>
login_hint=<handle>
```

If `profile_hint` is valid and owned by the user, the picker MAY be skipped.

---

## 6. /oauth/token – Token Issuance

The token endpoint exchanges the authorization code for tokens.

### Issued Tokens

- `id_token` (JWT)
- `access_token` (JWT)

Refresh tokens are optional in Phase 0.

---

## 7. Token Claims (CRITICAL)

### ID Token Payload Example

```json
{
  "iss": "https://zurot.org",
  "aud": "<client_id>",
  "sub": "profile_uuid_123",
  "exp": 1710000000,
  "iat": 1709996400,
  "name": "Mr. Zuriel",
  "preferred_username": "@zuriel",
  "https://zurot.org/profile_context": {
    "profileId": "profile_uuid_123",
    "userId": "user_clerk_abc",
    "role": "teacher"
  }
}
```

### Mandatory Rules

- `sub` **MUST be profileId**
- `name` maps to profile.displayName
- `preferred_username` maps to handle
- `userId` exists ONLY inside the custom claim

---

## 8. /oauth/userinfo – Mutable Profile Data

Apps SHOULD call `/oauth/userinfo` to retrieve:
- Updated displayName
- Updated avatar
- Updated status

Apps must not rely solely on token claims for mutable fields.

---

## 9. Token Lifetime & Revocation

### Recommendations

- Token lifetime: **15–60 minutes**
- Short‑lived tokens are preferred

### Back‑Channel Logout

When a profile is:
- Suspended
- Archived
- Deleted

The Hub MUST notify all registered apps to invalidate sessions.

---

## 10. Client Registration

Apps MUST be registered with:

- `client_id`
- `redirect_uris`
- `backchannel_logout_uri`

Dynamic registration is optional.

---

## 11. Harness Test Checklist (Pass / Fail)

- [ ] App receives token with `sub = profileId`
- [ ] Switching profile changes `sub`
- [ ] Same human, two profiles → two identities
- [ ] OSS app treats profiles as separate users
- [ ] Token validates via JWKS

---

## 12. Definition of Done

OIDC Phase is DONE when:

- A federated app can authenticate
- Profile picker is enforced
- Tokens are profile‑scoped
- No app can infer `userId`

---

End of OIDC Provider Implementation Pack.

