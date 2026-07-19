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

  tzuraDrafts: defineTable({
    ownerProfileId: v.id("profiles"),
    familyId: v.optional(v.string()),
    title: v.string(),
    gameSpec: v.any(),
    status: v.literal("draft"),
    createdAt: v.number(),
    updatedAt: v.number(),
    remixOfArtifactId: v.optional(v.id("tzuraArtifacts")),
  })
    .index("by_owner", ["ownerProfileId"])
    .index("by_owner_updated", ["ownerProfileId", "updatedAt"]),

  tzuraArtifacts: defineTable({
    ownerProfileId: v.id("profiles"),
    familyId: v.optional(v.string()),
    title: v.string(),
    gameSpecSnapshot: v.any(),
    version: v.number(),
    status: v.literal("published"),
    createdAt: v.number(),
    immutable: v.literal(true),
    sourceDraftId: v.id("tzuraDrafts"),
  })
    .index("by_owner", ["ownerProfileId"])
    .index("by_source_draft", ["sourceDraftId"]),

  tzuraFeedItems: defineTable({
    ownerProfileId: v.id("profiles"),
    familyId: v.optional(v.string()),
    artifactId: v.id("tzuraArtifacts"),
    type: v.literal("game"),
    visibility: v.union(v.literal("public"), v.literal("private")),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerProfileId"])
    .index("by_artifact", ["artifactId"]),

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
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.literal("S256")),
  }).index("by_code", ["code"]),

  oauthClients: defineTable({
    clientId: v.string(),
    clientSecret: v.optional(v.string()),
    clientSecretHash: v.optional(v.string()),
    clientSecretSalt: v.optional(v.string()),
    tokenEndpointAuthMethod: v.optional(
      v.union(v.literal("none"), v.literal("client_secret_post"))
    ),
    redirectUris: v.array(v.string()),
    backchannelLogoutUri: v.optional(v.string()),
  }).index("by_client_id", ["clientId"]),
});
