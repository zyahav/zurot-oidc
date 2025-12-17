# ZurOt – Phase 0 Hub Implementation Guide

**Scope:** Phase 0 ONLY
**Depends on:** _ZurOt – Core Identity & Federation Spec (Frozen)_

This document defines **exactly what must be built first** in ZurOt.
If something is not listed here, it does not exist yet.

---

## 1. Phase 0 Goal (Non-Negotiable)

Deliver a working **Profile Authority Service** at `zurot.org` such that:

> A real human can log in, create multiple profiles, select one, and receive an OIDC token where `sub = profileId`.

Nothing else matters until this works.

---

## 2. Phase 0 Deliverables

### Must Exist
- Clerk-based user login
- Convex-backed profile database
- Netflix-style profile selection UI
- Profile CRUD (Create / Edit / Archive)
- Active profile persistence
- OIDC provider issuing profile-scoped tokens

### Must NOT Exist (Yet)
- Federated apps (Lobby, Chat, Vibe)
- OSS integrations
- Activity feed UI
- Advanced permissions UI

---

## 3. Convex Schema (Authoritative for Phase 0)

> This schema enforces **One User → Many Profiles**.

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    createdAt: v.number(),
    lastLoginAt: v.number(),
  }).index("by_clerk_id", ["clerkUserId"]),

  profiles: defineTable({
    userId: v.id("users"),
    handle: v.string(),
    displayName: v.string(),
    role: v.string(),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("archived")
    ),
  })
    .index("by_user_id", ["userId"])
    .index("by_handle", ["handle"]),

  permissions: defineTable({
    profileId: v.id("profiles"),
    key: v.string(),
  }).index("by_profile", ["profileId"]),
});
```

Notes:
- `profiles` is the Netflix screen
- Apps will NEVER query `users`
- `permissions` is profile-scoped

---

## 4. Profile CRUD Operations

### Create Profile
- Validate handle uniqueness
- Attach profile to current user
- Default status: `active`

### Edit Profile
- displayName
- avatar

### Archive Profile
- Set status to `archived`
- Profile no longer selectable

Hard delete is **not required** in Phase 0.

---

## 5. Netflix-Style Profile Picker UI

### Screen Flow

1. User logs in via Clerk
2. Query profiles by `userId`
3. Show profile cards
4. Options:
   - Select profile
   - Create new profile
   - Edit existing profile

### Rules
- Exactly ONE active profile
- No implicit switching
- Archived profiles are hidden

---

## 6. Active Profile Persistence

- Active profile is stored server-side (session or token context)
- Client must not assume profile without confirmation

---

## 7. OIDC Provider (Minimal Phase 0)

### Required Endpoints
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/userinfo`

### Token Rules
- `sub = profileId`
- `name = profile.displayName`
- Custom claim includes `userId` for auditing

---

## 8. Test Page (Mandatory)

Build a simple internal test page that:
- Initiates OIDC login
- Forces profile selection
- Displays decoded token claims

This is the acceptance test.

---

## 9. Definition of Done (Phase 0)

Phase 0 is DONE when:

- A user logs in
- Creates two profiles
- Selects profile A → receives token with `sub = profileA`
- Selects profile B → receives token with `sub = profileB`
- Tokens differ correctly

Until this works, **do not start Phase 1**.

---

## 10. What Happens Next

Only after Phase 0 is complete:
- Build Lobby (Phase 1)
- Integrate OSS apps
- Implement feed

---

End of Phase 0 Guide.

