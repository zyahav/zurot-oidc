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

export const archiveProfile = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, { status: "archived" });
  },
});

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