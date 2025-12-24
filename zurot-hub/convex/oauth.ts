import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Store authorization code in database
 */
export const storeAuthorizationCode = mutation({
  args: {
    code: v.string(),
    profileId: v.id("profiles"),
    clientId: v.string(),
    redirectUri: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Cleanup expired codes first
    const expiredCodes = await ctx.db
      .query("authCodes")
      .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
      .collect();

    for (const expired of expiredCodes) {
      await ctx.db.delete(expired._id);
    }

    // Store new code
    return await ctx.db.insert("authCodes", {
      code: args.code,
      profileId: args.profileId,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      expiresAt: args.expiresAt,
      consumed: false,
    });
  },
});

/**
 * Validate and consume authorization code
 */
export const consumeAuthorizationCode = mutation({
  args: {
    code: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    const authCode = await ctx.db
      .query("authCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!authCode) {
      throw new Error("Invalid authorization code");
    }

    if (authCode.consumed) {
      throw new Error("Authorization code already used");
    }

    if (authCode.expiresAt < Date.now()) {
      await ctx.db.delete(authCode._id);
      throw new Error("Authorization code expired");
    }

    if (authCode.clientId !== args.clientId) {
      throw new Error("Client ID mismatch");
    }

    if (authCode.redirectUri !== args.redirectUri) {
      throw new Error("Redirect URI mismatch");
    }

    // Get profile details
    const profile = await ctx.db.get(authCode.profileId);
    if (!profile || profile.status !== "active") {
      throw new Error("Profile not found or inactive");
    }

    // Get user details
    const user = await ctx.db.get(profile.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Mark code as consumed
    await ctx.db.patch(authCode._id, { consumed: true });

    return {
      profileId: authCode.profileId,
      profile: {
        _id: profile._id,
        handle: profile.handle,
        displayName: profile.displayName,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
      },
      userId: user._id,
    };
  },
});

/**
 * Get profile by ID for userinfo endpoint
 */
export const getProfileForToken = query({
  args: { profileId: v.string() },
  handler: async (ctx, args) => {
    try {
      const profile = await ctx.db.get(args.profileId as Id<"profiles">);
      if (!profile || profile.status !== "active") {
        return null;
      }
      return {
        _id: profile._id,
        handle: profile.handle,
        displayName: profile.displayName,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        status: profile.status,
      };
    } catch {
      return null;
    }
  },
});

/**
 * Register OAuth client
 */
export const registerClient = mutation({
  args: {
    clientId: v.string(),
    clientSecret: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    backchannelLogoutUri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        redirectUris: args.redirectUris,
        backchannelLogoutUri: args.backchannelLogoutUri,
      });
      return existing._id;
    }

    return await ctx.db.insert("oauthClients", args);
  },
});

/**
 * Validate OAuth client
 */
export const validateClient = query({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .first();

    if (!client) {
      // For development, allow test-client
      if (args.clientId === "test-client") {
        return { valid: true, clientId: "test-client" };
      }
      return { valid: false, error: "Unknown client" };
    }

    if (!client.redirectUris.includes(args.redirectUri)) {
      return { valid: false, error: "Invalid redirect URI" };
    }

    return { valid: true, clientId: client.clientId };
  },
});
