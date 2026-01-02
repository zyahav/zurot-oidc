import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * PKCE verification helper
 * Verifies code_verifier against stored code_challenge
 */
function verifyPkceChallenge(
  verifier: string,
  challenge: string,
  method: string
): boolean {
  if (method === "plain") {
    return verifier === challenge;
  }
  // S256: BASE64URL(SHA256(code_verifier))
  // Note: In Convex, we need to use a pure JS implementation
  // since crypto module isn't available
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  
  // Simple SHA256 implementation for Convex runtime
  // We'll use SubtleCrypto which is available in Convex
  // But since this is sync, we need to compare differently
  // For now, use a base64url comparison approach
  
  // Actually, Convex supports crypto.subtle, but it's async
  // We'll need to handle this in the mutation
  // For simplicity, let's do a sync SHA256
  const hash = sha256(verifier);
  const computed = base64UrlEncode(hash);
  return computed === challenge;
}

// Base64URL encode a Uint8Array
function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Simple SHA256 implementation
function sha256(message: string): Uint8Array {
  // SHA256 constants
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  let H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);

  const encoder = new TextEncoder();
  const msgBytes = encoder.encode(message);
  const msgLen = msgBytes.length;
  const bitLen = msgLen * 8;

  // Padding
  const padLen = ((msgLen + 9) % 64 === 0) ? 0 : (64 - ((msgLen + 9) % 64));
  const padded = new Uint8Array(msgLen + 1 + padLen + 8);
  padded.set(msgBytes);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen, false);

  // Process blocks
  for (let i = 0; i < padded.length; i += 64) {
    const W = new Uint32Array(64);
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t-15], 7) ^ rotr(W[t-15], 18) ^ (W[t-15] >>> 3);
      const s1 = rotr(W[t-2], 17) ^ rotr(W[t-2], 19) ^ (W[t-2] >>> 10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) {
    resultView.setUint32(i * 4, H[i], false);
  }
  return result;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

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
    // PKCE support
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
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
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
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
    // PKCE support
    codeVerifier: v.optional(v.string()),
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

    // PKCE verification
    if (authCode.codeChallenge) {
      if (!args.codeVerifier) {
        throw new Error("code_verifier required");
      }
      
      const isValid = verifyPkceChallenge(
        args.codeVerifier,
        authCode.codeChallenge,
        authCode.codeChallengeMethod || "S256"
      );
      
      if (!isValid) {
        throw new Error("invalid code_verifier");
      }
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
