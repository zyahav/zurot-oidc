import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const getIdentityOrThrow = async (ctx: MutationCtx | QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
};

const assertOwnedProfile = async (
  ctx: MutationCtx | QueryCtx,
  profileId: Id<"profiles">
) => {
  const identity = await getIdentityOrThrow(ctx);
  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== identity.subject) {
    throw new Error("Profile not found or not owned by current user");
  }
  return profile;
};

export const getLatestDraft = query({
  args: {
    ownerProfileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    await assertOwnedProfile(ctx, args.ownerProfileId);

    const drafts = await ctx.db
      .query("tzuraDrafts")
      .withIndex("by_owner", q => q.eq("ownerProfileId", args.ownerProfileId))
      .collect();

    return drafts.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  },
});

export const saveDraft = mutation({
  args: {
    draftId: v.optional(v.id("tzuraDrafts")),
    ownerProfileId: v.id("profiles"),
    title: v.string(),
    gameSpec: v.any(),
    remixOfArtifactId: v.optional(v.id("tzuraArtifacts")),
  },
  handler: async (ctx, args) => {
    await assertOwnedProfile(ctx, args.ownerProfileId);

    const now = Date.now();
    if (args.draftId) {
      const existing = await ctx.db.get(args.draftId);
      if (!existing || existing.ownerProfileId !== args.ownerProfileId) {
        throw new Error("Draft not found or not owned by current profile");
      }

      await ctx.db.patch(args.draftId, {
        title: args.title,
        gameSpec: args.gameSpec,
        updatedAt: now,
      });
      return args.draftId;
    }

    return await ctx.db.insert("tzuraDrafts", {
      ownerProfileId: args.ownerProfileId,
      title: args.title,
      gameSpec: args.gameSpec,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      remixOfArtifactId: args.remixOfArtifactId,
    });
  },
});

export const publishDraft = mutation({
  args: {
    draftId: v.id("tzuraDrafts"),
    ownerProfileId: v.id("profiles"),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    await assertOwnedProfile(ctx, args.ownerProfileId);

    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.ownerProfileId !== args.ownerProfileId) {
      throw new Error("Draft not found or not owned by current profile");
    }

    const now = Date.now();
    const artifactId = await ctx.db.insert("tzuraArtifacts", {
      ownerProfileId: args.ownerProfileId,
      title: draft.title,
      gameSpecSnapshot: draft.gameSpec,
      version: 1,
      status: "published",
      createdAt: now,
      immutable: true,
      sourceDraftId: args.draftId,
    });

    const feedItemId = await ctx.db.insert("tzuraFeedItems", {
      ownerProfileId: args.ownerProfileId,
      artifactId,
      type: "game",
      visibility: args.visibility,
      createdAt: now,
    });

    return {
      artifactId,
      feedItemId,
    };
  },
});

export const remixArtifact = mutation({
  args: {
    artifactId: v.id("tzuraArtifacts"),
    ownerProfileId: v.id("profiles"),
    title: v.string(),
    gameSpec: v.any(),
  },
  handler: async (ctx, args) => {
    await assertOwnedProfile(ctx, args.ownerProfileId);

    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact || artifact.ownerProfileId !== args.ownerProfileId) {
      throw new Error("Artifact not found or not owned by current profile");
    }

    const now = Date.now();
    return await ctx.db.insert("tzuraDrafts", {
      ownerProfileId: args.ownerProfileId,
      title: args.title,
      gameSpec: args.gameSpec,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      remixOfArtifactId: args.artifactId,
    });
  },
});

export const listFeedItems = query({
  args: {
    ownerProfileId: v.id("profiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOwnedProfile(ctx, args.ownerProfileId);

    const rows = await ctx.db
      .query("tzuraFeedItems")
      .withIndex("by_owner", q => q.eq("ownerProfileId", args.ownerProfileId))
      .collect();

    const bounded = rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(1, Math.min(args.limit ?? 8, 30)));

    return await Promise.all(
      bounded.map(async row => {
        const artifact = await ctx.db.get(row.artifactId);
        return {
          ...row,
          artifact,
        };
      })
    );
  },
});
