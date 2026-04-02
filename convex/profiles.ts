import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { sha256 } from "./oauth";

const PROFILE_ROLE = v.union(
  v.literal("student"),
  v.literal("parent"),
  v.literal("teacher")
);

const MAX_PROFILES_PER_USER = 10;
const RECOVERY_OTP_TTL_MS = 10 * 60 * 1000;
const RECOVERY_VERIFIED_TTL_MS = 10 * 60 * 1000;
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const AVAILABLE_APPS = [
  {
    id: "mall-hebrew-adventures",
    name: "Mall Hebrew Adventures",
    url: "https://preview-zurot-auth.mall-hebrew-adventures.pages.dev",
    description: "Play",
  },
];

const getSessionId = (identity: { [key: string]: unknown }): string => {
  // sessionId is added via the Convex JWT template in Clerk dashboard ({{session.id}}).
  // Without it in the template, identity.sessionId and identity.sid are both undefined.
  const sessionIdClaim = identity.sessionId ?? identity.sid;
  if (typeof sessionIdClaim === "string" && sessionIdClaim.length > 0) {
    return sessionIdClaim;
  }
  // Fallback: derive a stable per-user-per-device key from tokenIdentifier.
  // This is less ideal than a real session ID but prevents silent failures
  // when the JWT template has not yet been updated in the Clerk dashboard.
  const tokenIdentifier = identity.tokenIdentifier;
  if (typeof tokenIdentifier === "string" && tokenIdentifier.length > 0) {
    return tokenIdentifier;
  }
  throw new Error(
    "Missing Clerk session ID claim. Add sessionId={{session.id}} to the Convex JWT template in Clerk dashboard."
  );
};

const getIdentityOrThrow = async (ctx: MutationCtx | QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
};

const getUserId = async (ctx: MutationCtx | QueryCtx) => {
  const identity = await getIdentityOrThrow(ctx);
  return identity.subject;
};

const getUserAndSession = async (ctx: MutationCtx | QueryCtx) => {
  const identity = await getIdentityOrThrow(ctx);
  return {
    userId: identity.subject,
    sessionId: getSessionId(identity as { [key: string]: unknown }),
  };
};

const getUserDocByClerkId = async (
  ctx: MutationCtx | QueryCtx,
  clerkUserId: string
) => {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", q => q.eq("clerkUserId", clerkUserId))
    .first();
};

const getOrCreateUserDoc = async (ctx: MutationCtx) => {
  const identity = await getIdentityOrThrow(ctx);
  const existing = await getUserDocByClerkId(ctx, identity.subject);
  if (existing) {
    return existing;
  }

  const fallbackEmail =
    typeof identity.email === "string" && identity.email.length > 0
      ? identity.email
      : `${identity.subject}@local.invalid`;

  const userId = await ctx.db.insert("users", {
    clerkUserId: identity.subject,
    email: fallbackEmail,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  });

  const created = await ctx.db.get(userId);
  if (!created) {
    throw new Error("Failed to initialize user record");
  }

  return created;
};

const getAccountSettingsByUserId = async (
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">
) => {
  return await ctx.db
    .query("accountSettings")
    .withIndex("by_user", q => q.eq("userId", userId))
    .first();
};

const formatMonth = (timestamp: number): string => {
  return MONTH_FORMATTER.format(new Date(timestamp));
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
};

const hashSecret = (value: string): string => {
  return bytesToHex(sha256(value));
};

const hashPin = (pin: string): string => {
  return hashSecret(pin);
};

const validatePin = (pin: string) => {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
};

const generateSixDigitOtp = (): string => {
  let digits = "";
  while (digits.length < 6) {
    digits += crypto.randomUUID().replace(/\D/g, "");
  }
  return digits.slice(0, 6);
};

const assertOwnedProfile = async (
  ctx: MutationCtx | QueryCtx,
  profileId: Id<"profiles">,
  userId: string
) => {
  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) {
    throw new Error("Profile not found or not owned by current user");
  }
  return profile;
};

const toClientProfile = (profile: {
  _id: Id<"profiles">;
  name: string;
  emoji: string;
  color: string;
  role: "student" | "parent" | "teacher";
  pinHash?: string;
  createdAt: number;
}) => {
  return {
    id: profile._id,
    _id: profile._id,
    name: profile.name,
    emoji: profile.emoji,
    color: profile.color,
    role: profile.role,
    createdAt: profile.createdAt,
    handle: `profile_${profile._id}`,
    since: formatMonth(profile.createdAt),
    hasPin: profile.pinHash !== undefined,
  };
};

export const getProfiles = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    return profiles.map(toClientProfile);
  },
});

export const createProfile = mutation({
  args: {
    name: v.string(),
    emoji: v.string(),
    color: v.string(),
    role: PROFILE_ROLE,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const existingProfiles = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    if (existingProfiles.length >= MAX_PROFILES_PER_USER) {
      throw new Error("Maximum of 10 profiles reached");
    }

    const now = Date.now();
    const profileId = await ctx.db.insert("profiles", {
      userId,
      name: args.name,
      emoji: args.emoji,
      color: args.color,
      role: args.role,
      pinHash: undefined,
      createdAt: now,
    });

    const created = await ctx.db.get(profileId);
    if (!created || created.userId !== userId) {
      throw new Error("Failed to create profile");
    }

    return toClientProfile(created);
  },
});

export const setActiveProfile = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const { userId, sessionId } = await getUserAndSession(ctx);

    await assertOwnedProfile(ctx, args.profileId, userId);

    const existing = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user_session", q =>
        q.eq("userId", userId).eq("sessionId", sessionId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        profileId: args.profileId,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("activeProfiles", {
      userId,
      sessionId,
      profileId: args.profileId,
      updatedAt: Date.now(),
    });
  },
});

export const getActiveProfile = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;
    const sessionId = getSessionId(identity as { [key: string]: unknown });

    const active = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user_session", q =>
        q.eq("userId", userId).eq("sessionId", sessionId)
      )
      .first();

    if (!active) {
      return null;
    }

    const profile = await ctx.db.get(active.profileId);
    if (!profile || profile.userId !== userId) {
      return null;
    }

    return toClientProfile(profile);
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id("profiles"),
    name: v.optional(v.string()),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
    role: v.optional(PROFILE_ROLE),
    pinHash: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertOwnedProfile(ctx, args.id, userId);

    const updates: {
      name?: string;
      emoji?: string;
      color?: string;
      role?: "student" | "parent" | "teacher";
      pinHash?: string | undefined;
    } = {};

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.emoji !== undefined) {
      updates.emoji = args.emoji;
    }

    if (args.color !== undefined) {
      updates.color = args.color;
    }

    if (args.role !== undefined) {
      updates.role = args.role;
    }

    if (args.pinHash !== undefined) {
      if (args.pinHash === null || args.pinHash === "") {
        updates.pinHash = undefined;
      } else {
        validatePin(args.pinHash);
        updates.pinHash = hashPin(args.pinHash);
      }
    }

    await ctx.db.patch(args.id, updates);

    const updated = await ctx.db.get(args.id);
    if (!updated || updated.userId !== userId) {
      throw new Error("Profile update failed");
    }

    return toClientProfile(updated);
  },
});

export const verifyProfilePin = query({
  args: {
    profileId: v.id("profiles"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const profile = await assertOwnedProfile(ctx, args.profileId, identity.subject);
    if (!profile.pinHash) {
      return false;
    }

    if (!/^\d{4}$/.test(args.pin)) {
      return false;
    }

    return hashPin(args.pin) === profile.pinHash;
  },
});

export const getOwnerPin = query({
  args: {
    pin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { hasPin: false, isValid: false };
    }

    const user = await getUserDocByClerkId(ctx, identity.subject);
    if (!user) {
      return { hasPin: false, isValid: false };
    }

    const settings = await getAccountSettingsByUserId(ctx, user._id);
    if (!settings?.ownerPinHash) {
      return { hasPin: false, isValid: false };
    }

    if (args.pin === undefined || !/^\d{4}$/.test(args.pin)) {
      return { hasPin: true, isValid: false };
    }

    return {
      hasPin: true,
      isValid: hashPin(args.pin) === settings.ownerPinHash,
    };
  },
});

export const setOwnerPin = mutation({
  args: {
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    validatePin(args.pin);

    const user = await getOrCreateUserDoc(ctx);
    const settings = await getAccountSettingsByUserId(ctx, user._id);
    const now = Date.now();
    const recoveryVerified =
      settings?.recoveryOtpVerifiedAt !== undefined &&
      now - settings.recoveryOtpVerifiedAt <= RECOVERY_VERIFIED_TTL_MS;

    if (settings?.ownerPinHash && !recoveryVerified) {
      throw new Error("PIN already set. Use Forgot PIN to reset.");
    }

    const updates = {
      ownerPinHash: hashPin(args.pin),
      recoveryOtpHash: undefined,
      recoveryOtpExpiresAt: undefined,
      recoveryOtpVerifiedAt: undefined,
    };

    if (settings) {
      await ctx.db.patch(settings._id, updates);
      return settings._id;
    }

    return await ctx.db.insert("accountSettings", {
      userId: user._id,
      ...updates,
    });
  },
});

export const generateRecoveryOtp = mutation({
  args: {},
  handler: async ctx => {
    const user = await getOrCreateUserDoc(ctx);
    const settings = await getAccountSettingsByUserId(ctx, user._id);
    if (!settings?.ownerPinHash) {
      throw new Error("No owner PIN set for this account.");
    }

    const otp = generateSixDigitOtp();
    const now = Date.now();
    const updates = {
      recoveryOtpHash: hashSecret(otp),
      recoveryOtpExpiresAt: now + RECOVERY_OTP_TTL_MS,
      recoveryOtpVerifiedAt: undefined,
    };

    await ctx.db.patch(settings._id, updates);

    return {
      otp,
      email: user.email,
      expiresAt: now + RECOVERY_OTP_TTL_MS,
    };
  },
});

export const verifyRecoveryOtp = mutation({
  args: {
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const user = await getUserDocByClerkId(ctx, identity.subject);
    if (!user) {
      throw new Error("User record not found.");
    }

    const settings = await getAccountSettingsByUserId(ctx, user._id);
    if (!settings?.ownerPinHash || !settings.recoveryOtpHash || !settings.recoveryOtpExpiresAt) {
      throw new Error("No recovery code found. Request a new code.");
    }

    const now = Date.now();
    if (settings.recoveryOtpExpiresAt <= now) {
      await ctx.db.patch(settings._id, {
        recoveryOtpHash: undefined,
        recoveryOtpExpiresAt: undefined,
        recoveryOtpVerifiedAt: undefined,
      });
      throw new Error("Recovery code expired. Request a new code.");
    }

    if (!/^\d{6}$/.test(args.otp) || hashSecret(args.otp) !== settings.recoveryOtpHash) {
      return { verified: false };
    }

    await ctx.db.patch(settings._id, {
      recoveryOtpHash: undefined,
      recoveryOtpExpiresAt: undefined,
      recoveryOtpVerifiedAt: now,
    });

    return { verified: true };
  },
});

export const deleteProfile = mutation({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    await assertOwnedProfile(ctx, args.id, userId);

    const profilesForUser = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    if (profilesForUser.length <= 1) {
      throw new Error("Cannot delete the last profile");
    }

    const permissionRows = await ctx.db
      .query("appPermissions")
      .withIndex("by_profile", q => q.eq("profileId", args.id))
      .collect();

    for (const row of permissionRows) {
      await ctx.db.delete(row._id);
    }

    const activeRows = await ctx.db
      .query("activeProfiles")
      .filter(q => q.eq(q.field("profileId"), args.id))
      .collect();

    for (const activeRow of activeRows) {
      await ctx.db.delete(activeRow._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const getDisabledApps = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    await assertOwnedProfile(ctx, args.profileId, identity.subject);

    const rows = await ctx.db
      .query("appPermissions")
      .withIndex("by_profile", q => q.eq("profileId", args.profileId))
      .collect();

    return rows.map(row => row.appId);
  },
});

export const disableApp = mutation({
  args: {
    profileId: v.id("profiles"),
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertOwnedProfile(ctx, args.profileId, userId);

    const existingRows = await ctx.db
      .query("appPermissions")
      .withIndex("by_profile", q => q.eq("profileId", args.profileId))
      .collect();

    const existing = existingRows.find(row => row.appId === args.appId);
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("appPermissions", {
      profileId: args.profileId,
      appId: args.appId,
    });
  },
});

export const enableApp = mutation({
  args: {
    profileId: v.id("profiles"),
    appId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertOwnedProfile(ctx, args.profileId, userId);

    const rows = await ctx.db
      .query("appPermissions")
      .withIndex("by_profile", q => q.eq("profileId", args.profileId))
      .collect();

    for (const row of rows) {
      if (row.appId === args.appId) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

export const clearActiveProfile = mutation({
  args: {},
  handler: async ctx => {
    const { userId, sessionId } = await getUserAndSession(ctx);

    const existing = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user_session", q =>
        q.eq("userId", userId).eq("sessionId", sessionId)
      )
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
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const sessionId = getSessionId(identity as { [key: string]: unknown });

    const active = await ctx.db
      .query("activeProfiles")
      .withIndex("by_user_session", q =>
        q.eq("userId", userId).eq("sessionId", sessionId)
      )
      .first();

    if (!active) {
      return [];
    }

    const profile = await ctx.db.get(active.profileId);
    if (!profile || profile.userId !== userId) {
      return [];
    }

    const disabledRows = await ctx.db
      .query("appPermissions")
      .withIndex("by_profile", q => q.eq("profileId", active.profileId))
      .collect();
    const disabledAppIds = new Set(disabledRows.map(row => row.appId));

    return AVAILABLE_APPS.filter(app => !disabledAppIds.has(app.id));
  },
});

export const listProfilesForUser = getProfiles;
