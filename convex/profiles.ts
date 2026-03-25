// convex/profiles.ts
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

const getUserForIdentity = async (ctx: MutationCtx | QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.subject))
    .first();

  if (!user) {
    throw new Error("User not found - ensure user sync completed");
  }

  return { user, identity };
};

export const createProfile = mutation({
  args: {
    handle: v.string(),
    displayName: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getUserForIdentity(ctx);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_handle", q => q.eq("handle", args.handle))
      .first();

    if (existing) throw new Error("Handle already taken");

    return await ctx.db.insert("profiles", {
      userId: user._id,
      handle: args.handle,
      displayName: args.displayName,
      role: args.role,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const archiveProfile = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, { status: "archived" });
  },
});

export const editProfile = mutation({
  args: {
    profileId: v.id("profiles"),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getUserForIdentity(ctx);

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.userId !== user._id) {
      throw new Error("Profile not found or not owned by current user");
    }
    if (profile.status === "archived") {
      throw new Error("Cannot edit an archived profile");
    }

    const updates: { displayName?: string; avatarUrl?: string | undefined } = {};

    if (args.displayName !== undefined) {
      const nextDisplayName = args.displayName.trim();
      if (nextDisplayName.length === 0) {
        throw new Error("Display name cannot be empty");
      }
      if (nextDisplayName.length > 64) {
        throw new Error("Display name must be 64 characters or fewer");
      }
      updates.displayName = nextDisplayName;
    }

    if (args.avatarUrl !== undefined) {
      const nextAvatarUrl = args.avatarUrl.trim();
      if (nextAvatarUrl !== "" && !/^https?:\/\//.test(nextAvatarUrl)) {
        throw new Error("Avatar URL must start with http:// or https://");
      }
      updates.avatarUrl = nextAvatarUrl === "" ? undefined : nextAvatarUrl;
    }

    await ctx.db.patch(args.profileId, updates);
  },
});

export const listProfilesForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return [];
    }

    return ctx.db
      .query("profiles")
      .withIndex("by_user_id", q => q.eq("userId", user._id))
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

export const setActiveProfile = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const { user } = await getUserForIdentity(ctx);

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.status !== "active" || profile.userId !== user._id) {
      throw new Error("Profile not found or not active for this user");
    }

    const existing = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        profileId: args.profileId,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("activeProfiles", {
      userId: user._id,
      profileId: args.profileId,
      updatedAt: Date.now(),
    });
  },
});

export const getActiveProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    const active = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .first();

    if (!active) {
      return null;
    }

    const profile = await ctx.db.get(active.profileId);
    if (!profile || profile.status !== "active" || profile.userId !== user._id) {
      return null;
    }

    return profile;
  },
});

export const clearActiveProfile = mutation({
  args: {},
  handler: async ctx => {
    const { user } = await getUserForIdentity(ctx);
    const existing = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getAppsForActiveProfile = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return [];

    const active = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .first();
    if (!active) return [];

    const profile = await ctx.db.get(active.profileId);
    if (!profile || profile.status !== "active") return [];

    return [
      {
        id: "mall-hebrew-adventures",
        name: "Mall Hebrew Adventures",
        url: "https://mall-hebrew-adventures.pages.dev",
        description: "Play",
      },
    ];
  },
});
