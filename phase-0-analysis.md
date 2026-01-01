# Phase 0 Code Analysis - Critical Issues Found

## Date: 2025-12-16
## Analysis Type: Static Code Review
## Status: BLOCKING - Phase 0 Cannot Pass

---

## Executive Summary

The current Phase 0 implementation **CANNOT PASS** due to fundamental violations of the ZurOt Core Identity & Federation Spec. The code pack itself contradicts the frozen architecture requirements.

## Critical Violations

### ❌ Violation 1: Mutation Accepts userId as Owner

**Rule:** *"No mutation accepts userId as owner"* (Phase 0 checklist item 5)
**Architecture:** *"Must never be owned by a user, email, or session"* (Core Spec line 108)

**Code Location:** `convex/profiles.ts` lines 7, 12, 21
```ts
export const createProfile = mutation({
  args: {
    userId: v.id("users"),  // ❌ VIOLATION: Accepts userId as parameter
    handle: v.string(),
    // ...
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("profiles", {
      userId: args.userId,  // ❌ VIOLATION: Stores userId
      // ...
    });
  },
});
```

### ❌ Violation 2: Schema Violates ProfileId-Only Ownership

**Rule:** *"All data ownership uses profileId"* (Phase 0 checklist item 6)
**Architecture:** *"Every resource in every app: Is owned by exactly one profileId"* (Core Spec line 107)

**Code Location:** `convex/schema.ts` lines 14, 26
```ts
profiles: defineTable({
  userId: v.id("users"),  // ❌ VIOLATION: Should NOT exist
  handle: v.string(),
  // ...
})
  .index("by_user_id", ["userId"]),  // ❌ VIOLATION: Index on userId
```

## Root Cause Analysis

**The code pack itself violates the frozen architecture.**

The Phase 0 Convex Identity Code Pack instructs implementation that directly contradicts the Core Identity & Federation Spec:

1. **Code Pack Line 124**: `userId: v.id("users")` in createProfile args
2. **Code Pack Line 138**: `userId: args.userId` in profile insertion
3. **Code Pack Line 38**: `userId: v.id("users")` in profiles schema

**Architecture explicitly forbids this:**
- Line 108: "Must never be owned by a user, email, or session"
- Line 107: "Every resource in every app: Is owned by exactly one profileId"

## Implications

### Phase 0 Cannot Pass
- Features 5 and 6 will always fail
- Phase 1 is blocked until this is resolved
- The entire federation model is compromised

### System Impact
If shipped as-is:
1. Apps could potentially bypass profile isolation
2. User ownership leaks into the data model
3. OIDC `sub = profileId` principle is weakened
4. Federation guarantees are violated

## Resolution Required

The code pack must be revised to comply with the frozen architecture:

1. **Remove userId from profile creation flow**
2. **Profile creation must be profile-initiated or system-initiated**
3. **Remove userId field from profiles schema**
4. **Update all related indexes and queries**

## Next Steps

1. **STOP** - Do not proceed to Phase 1
2. **REVISE** - Update the code pack to comply with architecture
3. **RE-IMPLEMENT** - Execute revised code pack VERBATIM
4. **RE-VERIFY** - All Phase 0 features must pass

---

**Assessment: Phase 0 Implementation FAILS - Specification Conflict Detected**

The implementation is correct according to the code pack, but the code pack is incorrect according to the frozen architecture.