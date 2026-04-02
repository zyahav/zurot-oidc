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
    userId: v.string(),
    name: v.string(),
    emoji: v.string(),
    color: v.string(),
    role: v.union(
      v.literal("student"),
      v.literal("parent"),
      v.literal("teacher")
    ),
    pinHash: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  accountSettings: defineTable({
    userId: v.id("users"),
    ownerPinHash: v.optional(v.string()),
    recoveryOtpHash: v.optional(v.string()),
    recoveryOtpExpiresAt: v.optional(v.number()),
    recoveryOtpVerifiedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  appPermissions: defineTable({
    profileId: v.id("profiles"),
    appId: v.string(),
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
    userId: v.string(),
    sessionId: v.string(),
    profileId: v.id("profiles"),
    updatedAt: v.number(),
  }).index("by_user_session", ["userId", "sessionId"]),

  authCodes: defineTable({
    code: v.string(),
    profileId: v.id("profiles"),
    clientId: v.string(),
    redirectUri: v.string(),
    expiresAt: v.number(),
    consumed: v.boolean(),
    // PKCE support
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
  }).index("by_code", ["code"]),

  oauthClients: defineTable({
    clientId: v.string(),
    clientSecret: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    backchannelLogoutUri: v.optional(v.string()),
  }).index("by_client_id", ["clientId"]),
});
