// convex/activities.ts
import { mutation } from "./_generated/server";
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