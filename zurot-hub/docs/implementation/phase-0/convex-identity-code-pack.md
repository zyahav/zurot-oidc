# ZurOt – Phase 0 Convex Identity Code Pack

**Purpose:** Executable identity substrate for Phase 0
**Depends on:**
- _ZurOt – Core Identity & Federation Spec (Frozen)_
- _ZurOt – Phase 0 Hub Implementation Guide_

This document provides the **exact Convex code artifacts** required to complete Phase 0.
It is designed for **harness-driven execution** (BMAD / Anthropic-style).

---

## 1. Canonical Rules (Re-stated for Code)

- `profileId` is the only acting identity
- `userId` (Clerk) is never used for ownership
- All queries return profile-scoped data
- All mutations enforce profile ownership

---

## 2. Schema (Authoritative)

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
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_handle", ["handle"]),

  permissions: defineTable({
    profileId: v.id("profiles"),
    key: v.string(),
  }).index("by_profile", ["profileId"]),

  activities: defineTable({
    activityId: v.string(),
    ownerProfileId: v.id("profiles"),
    app: v.string(),
    type: v.string(),
    title: v.string(),
    thumbnailUrl: v.optional(v.string()),
    deepLink: v.string(),
    createdAt: v.number(),
    visibility: v.union(v.literal("public"), v.literal("private")),
  })
    .index("by_owner", ["ownerProfileId"])
    .index("by_recency", ["createdAt"]),
});
```

---

## 3. User Bootstrap (Clerk Sync)

```ts
// convex/users.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertUserFromClerk = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });
  },
});
```

---

## 4. Profile Mutations

### Create Profile

```ts
// convex/profiles.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createProfile = mutation({
  args: {
    userId: v.id("users"),
    handle: v.string(),
    displayName: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_handle", q => q.eq("handle", args.handle))
      .first();

    if (existing) throw new Error("Handle already taken");

    return await ctx.db.insert("profiles", {
      userId: args.userId,
      handle: args.handle,
      displayName: args.displayName,
      role: args.role,
      status: "active",
      createdAt: Date.now(),
    });
  },
});
```

### Archive Profile

```ts
export const archiveProfile = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, { status: "archived" });
  },
});
```

---

## 5. Profile Queries

```ts
export const listProfilesForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("profiles")
      .withIndex("by_user_id", q => q.eq("userId", args.userId))
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();
  },
});

export const resolveHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("profiles")
      .withIndex("by_handle", q => q.eq("handle", args.handle))
      .first();
  },
});
```

---

## 6. Activity Ingestion (Fan-Out)

```ts
// convex/activities.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const ingestActivity = mutation({
  args: {
    activityId: v.string(),
    ownerProfileId: v.id("profiles"),
    app: v.string(),
    type: v.string(),
    title: v.string(),
    thumbnailUrl: v.optional(v.string()),
    deepLink: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activities", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
```

---

## 7. Phase 0 Harness Checklist (Pass / Fail)

- [ ] Clerk login creates or updates `users`
- [ ] Profiles can be created and archived
- [ ] Duplicate handles are rejected
- [ ] Profiles list correctly by `userId` (human → profiles link)
- [ ] `userId` is used **only** to link a profile to a human
- [ ] All acting identity, authorization, and data ownership use **only `profileId`**

---

## 8. Definition of Done

Phase 0 identity substrate is DONE when:

- Schema compiles
- All mutations run
- Profiles persist correctly
- Handle resolution works
- No acting identity or ownership uses `userId`
- No app code exists yet

---

End of Phase 0 Convex Identity Code Pack.

