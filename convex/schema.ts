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

  activeProfiles: defineTable({
    userId: v.id("users"),
    profileId: v.id("profiles"),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  authCodes: defineTable({
    code: v.string(),
    profileId: v.id("profiles"),
    clientId: v.string(),
    redirectUri: v.string(),
    expiresAt: v.number(),
    consumed: v.boolean(),
    // PKCE support
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()), // "S256" or "plain"
  }).index("by_code", ["code"]),

  oauthClients: defineTable({
    clientId: v.string(),
    clientSecret: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    backchannelLogoutUri: v.optional(v.string()),
  }).index("by_client_id", ["clientId"]),
});
