import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { sha256 } from "./oauth";
import { APP_CATALOG, appLaunchHref } from "../src/lib/app-catalog";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 30 * 1000;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

const hashSecret = (value: string): string => bytesToHex(sha256(value));

const generateDeviceToken = (): string =>
  `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");

const generateUserCode = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, byte => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
};

const getUserDocByClerkId = async (
  ctx: MutationCtx | QueryCtx,
  clerkUserId: string
) =>
  await ctx.db
    .query("users")
    .withIndex("by_clerk_id", q => q.eq("clerkUserId", clerkUserId))
    .first();

const getAccountSettings = async (
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">
) =>
  await ctx.db
    .query("accountSettings")
    .withIndex("by_user", q => q.eq("userId", userId))
    .first();

const assertAccountOwner = async (
  ctx: MutationCtx | QueryCtx,
  clerkUserId: string,
  ownerPin: string
) => {
  const user = await getUserDocByClerkId(ctx, clerkUserId);
  if (!user) throw new Error("Account owner record not found.");

  const ownerProfile = await ctx.db
    .query("profiles")
    .withIndex("by_user", q => q.eq("userId", clerkUserId))
    .filter(q =>
      q.or(q.eq(q.field("role"), "parent"), q.eq(q.field("role"), "teacher"))
    )
    .first();
  if (!ownerProfile) throw new Error("Account owner profile required.");

  const settings = await getAccountSettings(ctx, user._id);
  if (!settings?.ownerPinHash) throw new Error("Set an owner PIN before connecting a TV.");
  if (!/^\d{4}$/.test(ownerPin) || hashSecret(ownerPin) !== settings.ownerPinHash) {
    throw new Error("Incorrect owner PIN.");
  }

  return user;
};

const getAccountOwnerForPairing = async (
  ctx: MutationCtx,
  clerkUserId: string
) => {
  const user = await getUserDocByClerkId(ctx, clerkUserId);
  if (!user) throw new Error("Account owner record not found.");

  const ownerProfile = await ctx.db
    .query("profiles")
    .withIndex("by_user", q => q.eq("userId", clerkUserId))
    .filter(q =>
      q.or(q.eq(q.field("role"), "parent"), q.eq(q.field("role"), "teacher"))
    )
    .first();
  if (!ownerProfile) throw new Error("Account owner profile required.");

  const settings = await getAccountSettings(ctx, user._id);
  if (!settings?.ownerPinHash) throw new Error("Set an owner PIN before connecting a TV.");
  return { user, ownerPinHash: settings.ownerPinHash };
};

const getActiveDevice = async (
  ctx: MutationCtx | QueryCtx,
  deviceId: Id<"tvDevices">,
  deviceToken: string
) => {
  const device = await ctx.db.get(deviceId);
  if (
    !device ||
    device.status !== "active" ||
    hashSecret(deviceToken) !== device.tokenHash
  ) {
    throw new Error("TV session is not active.");
  }
  return device;
};

const mediaMatchesProfileLanguages = (
  media: {
    nativeLanguageCode?: string;
    learningLanguageCode?: string;
  },
  profile: {
    nativeLanguageCode?: string;
    learningLanguageCode?: string;
  }
) => {
  const nativeMatches =
    !media.nativeLanguageCode ||
    !profile.nativeLanguageCode ||
    media.nativeLanguageCode === profile.nativeLanguageCode;
  const learningMatches =
    !media.learningLanguageCode ||
    !profile.learningLanguageCode ||
    media.learningLanguageCode === profile.learningLanguageCode;
  return nativeMatches && learningMatches;
};

const mediaIsVisibleToProfile = (
  media: {
    ownerUserId: Id<"users">;
    creatorProfileId: Id<"profiles">;
    visibility: "private" | "family" | "public";
    moderationStatus: "pending" | "approved" | "rejected";
    status: "created" | "uploading" | "processing" | "ready" | "failed" | "deleted";
    nativeLanguageCode?: string;
    learningLanguageCode?: string;
  },
  accountUserId: Id<"users">,
  profile: {
    _id: Id<"profiles">;
    nativeLanguageCode?: string;
    learningLanguageCode?: string;
  }
) => {
  if (media.status !== "ready" || media.moderationStatus !== "approved") return false;
  if (!mediaMatchesProfileLanguages(media, profile)) return false;
  if (media.visibility === "public") return true;
  if (media.ownerUserId !== accountUserId) return false;
  if (media.visibility === "family") return true;
  return media.creatorProfileId === profile._id;
};

export const startPairing = mutation({
  args: {
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    deviceModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("tvPairings")
      .withIndex("by_status_expiry", q => q.eq("status", "pending").lt("expiresAt", now))
      .take(25);
    await Promise.all(expired.map(row => ctx.db.patch(row._id, { status: "expired", updatedAt: now })));

    const deviceToken = generateDeviceToken();
    const userCode = generateUserCode();
    const expiresAt = now + PAIRING_TTL_MS;
    const pairingId = await ctx.db.insert("tvPairings", {
      deviceTokenHash: hashSecret(deviceToken),
      userCode,
      platform: args.platform,
      appVersion: args.appVersion,
      deviceModel: args.deviceModel,
      status: "pending",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return { pairingId, deviceToken, userCode, expiresAt };
  },
});

export const pairingStatus = query({
  args: {
    pairingId: v.id("tvPairings"),
    deviceToken: v.string(),
  },
  handler: async (ctx, args) => {
    const pairing = await ctx.db.get(args.pairingId);
    if (!pairing || hashSecret(args.deviceToken) !== pairing.deviceTokenHash) {
      return { status: "invalid" as const };
    }
    if (pairing.expiresAt <= Date.now() || pairing.status === "expired") {
      return { status: "expired" as const };
    }
    if ((pairing.status === "approved" || pairing.status === "claimed") && pairing.deviceId) {
      return { status: "approved" as const, deviceId: pairing.deviceId };
    }
    return { status: "pending" as const, expiresAt: pairing.expiresAt };
  },
});

export const claimPairing = mutation({
  args: {
    pairingId: v.id("tvPairings"),
    deviceToken: v.string(),
  },
  handler: async (ctx, args) => {
    const pairing = await ctx.db.get(args.pairingId);
    if (
      !pairing ||
      !pairing.deviceId ||
      (pairing.status !== "approved" && pairing.status !== "claimed") ||
      pairing.expiresAt <= Date.now() ||
      hashSecret(args.deviceToken) !== pairing.deviceTokenHash
    ) {
      throw new Error("TV pairing is not available.");
    }
    await ctx.db.patch(pairing._id, { status: "claimed", updatedAt: Date.now() });
    return { deviceId: pairing.deviceId };
  },
});

export const getActivationDetails = query({
  args: { pairingId: v.id("tvPairings"), userCode: v.string() },
  handler: async (ctx, args) => {
    const pairing = await ctx.db.get(args.pairingId);
    if (
      !pairing ||
      pairing.userCode !== args.userCode ||
      pairing.status !== "pending" ||
      pairing.expiresAt <= Date.now()
    ) {
      return null;
    }
    return { userCode: pairing.userCode, expiresAt: pairing.expiresAt };
  },
});

export const resolveManualPairing = mutation({
  args: { userCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Sign in as the account owner to connect this TV.");
    }

    const normalizedCode = args.userCode.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizedCode)) {
      return { found: false as const, error: "invalid_code" as const };
    }

    const ownerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .filter(q =>
        q.or(q.eq(q.field("role"), "parent"), q.eq(q.field("role"), "teacher"))
      )
      .first();
    if (!ownerProfile) {
      throw new Error("Account owner profile required.");
    }

    const pairing = await ctx.db
      .query("tvPairings")
      .withIndex("by_user_code", q => q.eq("userCode", normalizedCode))
      .first();
    if (
      !pairing ||
      pairing.status !== "pending" ||
      pairing.expiresAt <= Date.now()
    ) {
      return { found: false as const, error: "invalid_code" as const };
    }

    return {
      found: true as const,
      pairingId: pairing._id,
      userCode: pairing.userCode,
      expiresAt: pairing.expiresAt,
    };
  },
});

export const approvePairing = mutation({
  args: {
    pairingId: v.id("tvPairings"),
    userCode: v.string(),
    deviceName: v.string(),
    ownerPin: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in as the account owner to connect this TV.");

    const pairing = await ctx.db.get(args.pairingId);
    if (
      !pairing ||
      pairing.status !== "pending" ||
      pairing.expiresAt <= Date.now() ||
      pairing.userCode !== args.userCode
    ) {
      throw new Error("This TV code is invalid or expired.");
    }

    const deviceName = args.deviceName.trim();
    if (deviceName.length < 1 || deviceName.length > 40) {
      throw new Error("TV name must be between 1 and 40 characters.");
    }

    const now = Date.now();
    if (pairing.pinLockedUntil && pairing.pinLockedUntil > now) {
      return {
        connected: false as const,
        error: "pin_locked" as const,
        retryAt: pairing.pinLockedUntil,
      };
    }

    const { user, ownerPinHash } = await getAccountOwnerForPairing(ctx, identity.subject);
    const validPin = /^\d{4}$/.test(args.ownerPin) && hashSecret(args.ownerPin) === ownerPinHash;
    if (!validPin) {
      const failedPinAttempts = (pairing.failedPinAttempts ?? 0) + 1;
      const locked = failedPinAttempts >= PIN_MAX_ATTEMPTS;
      const pinLockedUntil = locked ? now + PIN_LOCKOUT_MS : undefined;
      await ctx.db.patch(pairing._id, {
        failedPinAttempts: locked ? 0 : failedPinAttempts,
        pinLockedUntil,
        updatedAt: now,
      });
      return {
        connected: false as const,
        error: locked ? ("pin_locked" as const) : ("incorrect_pin" as const),
        retryAt: pinLockedUntil,
      };
    }

    const deviceId = await ctx.db.insert("tvDevices", {
      userId: user._id,
      name: deviceName,
      tokenHash: pairing.deviceTokenHash,
      platform: pairing.platform,
      appVersion: pairing.appVersion,
      deviceModel: pairing.deviceModel,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
    await ctx.db.patch(pairing._id, {
      status: "approved",
      deviceId,
      approvedByUserId: user._id,
      failedPinAttempts: 0,
      pinLockedUntil: undefined,
      updatedAt: now,
    });

    return { connected: true, deviceName };
  },
});

export const getDeviceHome = query({
  args: {
    deviceId: v.id("tvDevices"),
    deviceToken: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await getActiveDevice(ctx, args.deviceId, args.deviceToken);
    const user = await ctx.db.get(device.userId);
    if (!user) throw new Error("TV account is unavailable.");

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", user.clerkUserId))
      .collect();
    const activeProfile = device.activeProfileId
      ? profiles.find(profile => profile._id === device.activeProfileId) ?? null
      : null;

    let apps: Array<{
      id: string;
      name: string;
      emoji: string;
      shortDescription: string;
      launchUrl: string;
      launchReady: boolean;
    }> = [];
    let feed: Array<{
      id: Id<"mediaItems">;
      kind: "video";
      title: string;
      description: string;
      creatorName: string;
      thumbnailUrl: string | null;
      durationSeconds: number | null;
      nativeLanguageCode: string | null;
      learningLanguageCode: string | null;
      publishedAt: number;
      playbackPath: string;
    }> = [];

    if (activeProfile) {
      const disabledRows = await ctx.db
        .query("appPermissions")
        .withIndex("by_profile", q => q.eq("profileId", activeProfile._id))
        .collect();
      const disabled = new Set(disabledRows.map(row => row.appId));
      const accessRequests = await ctx.db
        .query("accessRequests")
        .withIndex("by_profile", q => q.eq("profileId", activeProfile._id))
        .collect();
      const approved = new Set(
        accessRequests
          .filter(row => row.requestType === "product_access" && row.status === "approved")
          .map(row => row.productKey)
      );

      apps = APP_CATALOG.filter(app => {
        if (!app.tvCompatible || disabled.has(app.id)) return false;
        const access = app.access[activeProfile.role];
        return access === "included" || (access === "requestable" && approved.has(app.id));
      }).map(app => ({
        id: app.id,
        name: app.name,
        emoji: app.emoji,
        shortDescription: app.shortDescription,
        launchUrl: appLaunchHref(app, activeProfile._id, { tv: true }),
        launchReady: Boolean(app.tvLaunchReady),
      }));

      const readyMedia = await ctx.db
        .query("mediaItems")
        .withIndex("by_status_published", q => q.eq("status", "ready"))
        .order("desc")
        .take(50);
      const visibleMedia = readyMedia
        .filter(media => mediaIsVisibleToProfile(media, user._id, activeProfile))
        .slice(0, 30);
      feed = await Promise.all(visibleMedia.map(async media => {
        const creator = await ctx.db.get(media.creatorProfileId);
        return {
          id: media._id,
          kind: "video" as const,
          title: media.title,
          description: media.description ?? "",
          creatorName: creator?.name ?? "ZurOt Creator",
          thumbnailUrl: media.thumbnailUrl ?? null,
          durationSeconds: media.durationSeconds ?? null,
          nativeLanguageCode: media.nativeLanguageCode ?? null,
          learningLanguageCode: media.learningLanguageCode ?? null,
          publishedAt: media.publishedAt ?? media.updatedAt,
          playbackPath: `/api/tv/v1/media/${media._id}/playback`,
        };
      }));
    }

    return {
      device: {
        id: device._id,
        name: device.name,
        platform: device.platform,
        appVersion: device.appVersion,
        deviceModel: device.deviceModel,
      },
      profiles: profiles.map(profile => ({
        id: profile._id,
        name: profile.name,
        emoji: profile.emoji,
        color: profile.color,
        role: profile.role,
        nativeLanguageCode: profile.nativeLanguageCode ?? null,
        learningLanguageCode: profile.learningLanguageCode ?? null,
        hasPin: Boolean(profile.pinHash),
      })),
      activeProfile: activeProfile
        ? {
            id: activeProfile._id,
            name: activeProfile.name,
            emoji: activeProfile.emoji,
            color: activeProfile.color,
            role: activeProfile.role,
            nativeLanguageCode: activeProfile.nativeLanguageCode ?? null,
            learningLanguageCode: activeProfile.learningLanguageCode ?? null,
          }
        : null,
      feed,
      apps,
    };
  },
});

export const authorizeMediaPlayback = query({
  args: {
    deviceId: v.id("tvDevices"),
    deviceToken: v.string(),
    mediaId: v.id("mediaItems"),
  },
  handler: async (ctx, args) => {
    const device = await getActiveDevice(ctx, args.deviceId, args.deviceToken);
    if (!device.activeProfileId) throw new Error("Select a profile before playback.");
    const [user, profile, media] = await Promise.all([
      ctx.db.get(device.userId),
      ctx.db.get(device.activeProfileId),
      ctx.db.get(args.mediaId),
    ]);
    if (!user || !profile || !media) throw new Error("Media is unavailable.");
    if (!mediaIsVisibleToProfile(media, user._id, profile)) {
      throw new Error("Media is not authorized for this profile.");
    }
    if (!media.providerVideoId) throw new Error("Media is not ready for playback.");

    return {
      mediaId: media._id,
      provider: media.provider,
      providerVideoId: media.providerVideoId,
      title: media.title,
      durationSeconds: media.durationSeconds ?? null,
    };
  },
});

export const selectProfile = mutation({
  args: {
    deviceId: v.id("tvDevices"),
    deviceToken: v.string(),
    profileId: v.id("profiles"),
    pin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const device = await getActiveDevice(ctx, args.deviceId, args.deviceToken);
    const now = Date.now();
    if (device.profilePinLockedUntil && device.profilePinLockedUntil > now) {
      return {
        selected: false as const,
        error: "pin_locked" as const,
        retryAt: device.profilePinLockedUntil,
      };
    }
    const user = await ctx.db.get(device.userId);
    const profile = await ctx.db.get(args.profileId);
    if (!user || !profile || profile.userId !== user.clerkUserId) {
      throw new Error("Profile is not available on this TV.");
    }
    if (profile.pinHash && (!args.pin || hashSecret(args.pin) !== profile.pinHash)) {
      const failedProfilePinAttempts = (device.failedProfilePinAttempts ?? 0) + 1;
      const locked = failedProfilePinAttempts >= PIN_MAX_ATTEMPTS;
      const profilePinLockedUntil = locked ? now + PIN_LOCKOUT_MS : undefined;
      await ctx.db.patch(device._id, {
        failedProfilePinAttempts: locked ? 0 : failedProfilePinAttempts,
        profilePinLockedUntil,
        updatedAt: now,
        lastSeenAt: now,
      });
      return {
        selected: false as const,
        error: locked ? ("pin_locked" as const) : ("incorrect_pin" as const),
        retryAt: profilePinLockedUntil,
      };
    }
    await ctx.db.patch(device._id, {
      activeProfileId: profile._id,
      failedProfilePinAttempts: 0,
      profilePinLockedUntil: undefined,
      updatedAt: now,
      lastSeenAt: now,
    });
    return { selected: true as const };
  },
});

export const clearProfile = mutation({
  args: { deviceId: v.id("tvDevices"), deviceToken: v.string() },
  handler: async (ctx, args) => {
    const device = await getActiveDevice(ctx, args.deviceId, args.deviceToken);
    await ctx.db.patch(device._id, {
      activeProfileId: undefined,
      updatedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    return { cleared: true };
  },
});

export const revokeSelf = mutation({
  args: { deviceId: v.id("tvDevices"), deviceToken: v.string() },
  handler: async (ctx, args) => {
    const device = await getActiveDevice(ctx, args.deviceId, args.deviceToken);
    const now = Date.now();
    await ctx.db.patch(device._id, {
      status: "revoked",
      activeProfileId: undefined,
      revokedAt: now,
      updatedAt: now,
    });
    return { revoked: true };
  },
});

export const listDevices = query({
  args: { ownerPin: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await assertAccountOwner(ctx, identity.subject, args.ownerPin);
    const devices = await ctx.db
      .query("tvDevices")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();
    return devices
      .filter(device => device.status === "active")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(device => ({
        id: device._id,
        name: device.name,
        createdAt: device.createdAt,
        lastSeenAt: device.lastSeenAt,
      }));
  },
});

export const revokeDevice = mutation({
  args: { deviceId: v.id("tvDevices"), ownerPin: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated.");
    const user = await assertAccountOwner(ctx, identity.subject, args.ownerPin);
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.userId !== user._id) throw new Error("TV device not found.");
    await ctx.db.patch(device._id, {
      status: "revoked",
      activeProfileId: undefined,
      revokedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { revoked: true };
  },
});

export const createAuthorizationCode = mutation({
  args: {
    deviceId: v.id("tvDevices"),
    deviceToken: v.string(),
    profileId: v.id("profiles"),
    code: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    expiresAt: v.number(),
    codeChallenge: v.string(),
    nonce: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await getActiveDevice(ctx, args.deviceId, args.deviceToken);
    if (device.activeProfileId !== args.profileId) {
      throw new Error("The selected TV profile is not active.");
    }

    const user = await ctx.db.get(device.userId);
    const profile = await ctx.db.get(args.profileId);
    if (!user || !profile || profile.userId !== user.clerkUserId) {
      throw new Error("TV profile is not available.");
    }

    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", q => q.eq("clientId", args.clientId))
      .first();
    if (!client || !client.redirectUris.includes(args.redirectUri)) {
      throw new Error("OAuth client is not available.");
    }

    const app = APP_CATALOG.find(candidate => candidate.id === args.clientId);
    if (!app?.tvCompatible || !app.tvLaunchReady) {
      throw new Error("Application is not available on TV.");
    }
    const disabled = await ctx.db
      .query("appPermissions")
      .withIndex("by_profile", q => q.eq("profileId", profile._id))
      .filter(q => q.eq(q.field("appId"), app.id))
      .first();
    let permitted = app.access[profile.role] === "included" && !disabled;
    if (app.access[profile.role] === "requestable" && !disabled) {
      const requests = await ctx.db
        .query("accessRequests")
        .withIndex("by_profile", q => q.eq("profileId", profile._id))
        .filter(q => q.and(
          q.eq(q.field("productKey"), app.id),
          q.eq(q.field("requestType"), "product_access")
        ))
        .collect();
      permitted = requests.sort((a, b) => b.requestedAt - a.requestedAt)[0]?.status === "approved";
    }
    if (!permitted) throw new Error("TV profile is not permitted for this application.");

    const now = Date.now();
    const expiredCodes = await ctx.db
      .query("authCodes")
      .filter(q => q.lt(q.field("expiresAt"), now))
      .take(25);
    await Promise.all(expiredCodes.map(row => ctx.db.delete(row._id)));
    await ctx.db.insert("authCodes", {
      code: args.code,
      profileId: profile._id,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      expiresAt: args.expiresAt,
      consumed: false,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: "S256",
      nonce: args.nonce,
    });
    await ctx.db.patch(device._id, { updatedAt: now, lastSeenAt: now });
    return { created: true };
  },
});
