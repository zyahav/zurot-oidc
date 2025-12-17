// convex/profiles.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createProfile = mutation({
  args: {
    handle: v.string(),
    displayName: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    // Get userId from authentication context (Clerk)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Find the user record for this Clerk user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found - ensure user sync completed");
    }

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

export const listProfilesForUser = query({
  args: {},
  handler: async (ctx, args) => {
    // Get userId from authentication context (Clerk)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return []; // Return empty list if not authenticated
    }

    // Find the user record for this Clerk user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) {
      return []; // Return empty list if user not found
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