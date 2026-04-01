// convex/activities.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const ingestActivity = mutation({
  args: {
    activityId: v.string(),
    ownerProfileId: v.id("profiles"),
    app: v.string(),
    type: v.string(),
    title: v.string(),
    thumbnailUrl: v.optional(v.string()),
    deepLink: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activities", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listRecentForProfile = query({
  args: {
    profileId: v.id("profiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.userId !== identity.subject) {
      return [];
    }

    const records = await ctx.db
      .query("activities")
      .withIndex("by_owner", q => q.eq("ownerProfileId", args.profileId))
      .collect();

    const sorted = records.sort((a, b) => b.createdAt - a.createdAt);
    const bounded = sorted.slice(0, Math.max(1, Math.min(args.limit ?? 8, 30)));

    return bounded.map(record => ({
      _id: record._id,
      app: record.app,
      type: record.type,
      title: record.title,
      thumbnailUrl: record.thumbnailUrl,
      deepLink: record.deepLink,
      createdAt: record.createdAt,
      visibility: record.visibility,
    }));
  },
});
