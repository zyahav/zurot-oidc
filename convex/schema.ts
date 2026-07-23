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
    nativeLanguageCode: v.optional(v.string()),
    learningLanguageCode: v.optional(v.string()),
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

  accessRequests: defineTable({
    profileId: v.id("profiles"),
    productKey: v.string(),
    requestType: v.union(v.literal("product_access"), v.literal("add_device")),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("declined")),
    requestedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("profiles")),
    reviewNote: v.optional(v.string()),
  })
    .index("by_profile", ["profileId"])
    .index("by_status", ["status"]),

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

  mediaItems: defineTable({
    ownerUserId: v.id("users"),
    creatorProfileId: v.id("profiles"),
    provider: v.literal("bunny_stream"),
    providerVideoId: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    nativeLanguageCode: v.optional(v.string()),
    learningLanguageCode: v.optional(v.string()),
    ageBand: v.optional(v.string()),
    visibility: v.union(
      v.literal("private"),
      v.literal("family"),
      v.literal("public")
    ),
    moderationStatus: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    status: v.union(
      v.literal("created"),
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("deleted")
    ),
    durationSeconds: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
    availableResolutions: v.optional(v.array(v.string())),
    idempotencyKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_creator", ["creatorProfileId"])
    .index("by_provider_video", ["provider", "providerVideoId"])
    .index("by_status_published", ["status", "publishedAt"])
    .index("by_owner_idempotency", ["ownerUserId", "idempotencyKey"]),

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
    nonce: v.optional(v.string()),
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

  tvPairings: defineTable({
    deviceTokenHash: v.string(),
    userCode: v.string(),
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    deviceModel: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("claimed"),
      v.literal("expired")
    ),
    expiresAt: v.number(),
    deviceId: v.optional(v.id("tvDevices")),
    approvedByUserId: v.optional(v.id("users")),
    failedPinAttempts: v.optional(v.number()),
    pinLockedUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_expiry", ["status", "expiresAt"])
    .index("by_user_code", ["userCode"]),

  tvDevices: defineTable({
    userId: v.id("users"),
    name: v.string(),
    tokenHash: v.string(),
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    deviceModel: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("revoked")),
    activeProfileId: v.optional(v.id("profiles")),
    failedProfilePinAttempts: v.optional(v.number()),
    profilePinLockedUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
});
