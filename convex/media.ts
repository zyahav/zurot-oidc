import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const visibilityValidator = v.union(
  v.literal("private"),
  v.literal("family"),
  v.literal("public")
);

const forwardedActorArgs = {
  actorProfileId: v.optional(v.id("profiles")),
  forwardSecret: v.optional(v.string()),
};

type ForwardedActor = {
  actorProfileId?: Id<"profiles">;
  forwardSecret?: string;
};

const getAuthenticatedAccount = async (
  ctx: MutationCtx | QueryCtx,
  forwarded: ForwardedActor
) => {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("ZurOt account not found.");
    return { clerkUserId: identity.subject, user };
  }

  const configuredSecret = process.env.MEDIA_API_FORWARD_SECRET;
  if (
    !configuredSecret ||
    forwarded.forwardSecret !== configuredSecret ||
    !forwarded.actorProfileId
  ) {
    throw new Error("Not authenticated.");
  }
  const actorProfile = await ctx.db.get(forwarded.actorProfileId);
  if (!actorProfile) throw new Error("ZurOt profile not found.");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", q => q.eq("clerkUserId", actorProfile.userId))
    .first();
  if (!user) throw new Error("ZurOt account not found.");
  return {
    clerkUserId: actorProfile.userId,
    restrictedProfileId: actorProfile._id,
    user,
  };
};

const assertOwnedProfile = async (
  ctx: MutationCtx | QueryCtx,
  profileId: Id<"profiles">,
  actor: {
    clerkUserId: string;
    restrictedProfileId?: Id<"profiles">;
  }
) => {
  const profile = await ctx.db.get(profileId);
  if (
    !profile ||
    profile.userId !== actor.clerkUserId ||
    (actor.restrictedProfileId && profileId !== actor.restrictedProfileId)
  ) {
    throw new Error("Creator profile is unavailable.");
  }
  return profile;
};

export const createUpload = mutation({
  args: {
    ...forwardedActorArgs,
    creatorProfileId: v.id("profiles"),
    title: v.string(),
    description: v.optional(v.string()),
    nativeLanguageCode: v.optional(v.string()),
    learningLanguageCode: v.optional(v.string()),
    ageBand: v.optional(v.string()),
    visibility: visibilityValidator,
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedAccount(ctx, args);
    await assertOwnedProfile(ctx, args.creatorProfileId, actor);

    const existing = await ctx.db
      .query("mediaItems")
      .withIndex("by_owner_idempotency", q =>
        q.eq("ownerUserId", actor.user._id).eq("idempotencyKey", args.idempotencyKey)
      )
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("mediaItems", {
      ownerUserId: actor.user._id,
      creatorProfileId: args.creatorProfileId,
      provider: "bunny_stream",
      title: args.title,
      description: args.description,
      nativeLanguageCode: args.nativeLanguageCode,
      learningLanguageCode: args.learningLanguageCode,
      ageBand: args.ageBand,
      visibility: args.visibility,
      moderationStatus: args.visibility === "public" ? "pending" : "approved",
      status: "created",
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const attachBunnyVideo = mutation({
  args: {
    ...forwardedActorArgs,
    mediaId: v.id("mediaItems"),
    providerVideoId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedAccount(ctx, args);
    const media = await ctx.db.get(args.mediaId);
    if (!media) throw new Error("Media item not found.");
    await assertOwnedProfile(ctx, media.creatorProfileId, actor);
    if (media.providerVideoId && media.providerVideoId !== args.providerVideoId) {
      throw new Error("Media provider video is already assigned.");
    }
    await ctx.db.patch(media._id, {
      providerVideoId: args.providerVideoId,
      status: "uploading",
      updatedAt: Date.now(),
    });
  },
});

export const claimProviderProvisioning = mutation({
  args: { ...forwardedActorArgs, mediaId: v.id("mediaItems") },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedAccount(ctx, args);
    const media = await ctx.db.get(args.mediaId);
    if (!media) throw new Error("Media item not found.");
    await assertOwnedProfile(ctx, media.creatorProfileId, actor);
    if (media.providerVideoId) return false;
    const staleProvisioning =
      media.status === "uploading" && Date.now() - media.updatedAt > 2 * 60 * 1000;
    if (
      media.status !== "created" &&
      media.status !== "failed" &&
      !staleProvisioning
    ) {
      return false;
    }
    await ctx.db.patch(media._id, {
      status: "uploading",
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const markProviderProvisioningFailed = mutation({
  args: { ...forwardedActorArgs, mediaId: v.id("mediaItems") },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedAccount(ctx, args);
    const media = await ctx.db.get(args.mediaId);
    if (!media) return;
    await assertOwnedProfile(ctx, media.creatorProfileId, actor);
    if (!media.providerVideoId) {
      await ctx.db.patch(media._id, {
        status: "failed",
        updatedAt: Date.now(),
      });
    }
  },
});

export const markUploadComplete = mutation({
  args: { ...forwardedActorArgs, mediaId: v.id("mediaItems") },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedAccount(ctx, args);
    const media = await ctx.db.get(args.mediaId);
    if (!media) throw new Error("Media item not found.");
    await assertOwnedProfile(ctx, media.creatorProfileId, actor);
    if (!media.providerVideoId || media.status !== "uploading") {
      throw new Error("Media upload is not active.");
    }
    await ctx.db.patch(media._id, {
      status: "processing",
      updatedAt: Date.now(),
    });
  },
});

export const getOwnMedia = query({
  args: { ...forwardedActorArgs, mediaId: v.id("mediaItems") },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedAccount(ctx, args);
    const media = await ctx.db.get(args.mediaId);
    if (!media) return null;
    await assertOwnedProfile(ctx, media.creatorProfileId, actor);
    return media;
  },
});

export const applyBunnyWebhook = mutation({
  args: {
    forwardSecret: v.string(),
    providerVideoId: v.string(),
    status: v.number(),
    durationSeconds: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
    availableResolutions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BUNNY_STREAM_WEBHOOK_FORWARD_SECRET;
    if (!configuredSecret || args.forwardSecret !== configuredSecret) {
      throw new Error("Webhook forwarding is not authorized.");
    }

    const media = await ctx.db
      .query("mediaItems")
      .withIndex("by_provider_video", q =>
        q.eq("provider", "bunny_stream").eq("providerVideoId", args.providerVideoId)
      )
      .first();
    if (!media || media.status === "deleted") return null;

    const now = Date.now();
    if (args.status === 5 || args.status === 8) {
      await ctx.db.patch(media._id, { status: "failed", updatedAt: now });
      return media._id;
    }

    const providerPlayable = args.status === 3 || args.status === 4;
    if (media.status === "ready" && !providerPlayable) {
      return media._id;
    }
    const approved = media.moderationStatus === "approved";
    await ctx.db.patch(media._id, {
      status: providerPlayable && approved ? "ready" : "processing",
      durationSeconds: args.durationSeconds ?? media.durationSeconds,
      thumbnailUrl: args.thumbnailUrl ?? media.thumbnailUrl,
      availableResolutions: args.availableResolutions ?? media.availableResolutions,
      publishedAt: providerPlayable && approved
        ? media.publishedAt ?? now
        : media.publishedAt,
      updatedAt: now,
    });
    return media._id;
  },
});

export const approveForFamily = mutation({
  args: {
    operatorSecret: v.string(),
    mediaId: v.id("mediaItems"),
  },
  handler: async (ctx, args) => {
    const configuredSecret = process.env.BUNNY_STREAM_OPERATOR_SECRET;
    if (!configuredSecret || args.operatorSecret !== configuredSecret) {
      throw new Error("Media operation is not authorized.");
    }
    const media = await ctx.db.get(args.mediaId);
    if (!media) throw new Error("Media item not found.");
    const now = Date.now();
    await ctx.db.patch(media._id, {
      moderationStatus: "approved",
      status: media.durationSeconds ? "ready" : media.status,
      publishedAt: media.durationSeconds ? media.publishedAt ?? now : media.publishedAt,
      updatedAt: now,
    });
  },
});
