/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { sha256 } from "./oauth";

const modules = import.meta.glob("./**/*.{ts,js}");
const OWNER_SUBJECT = "clerk_test_owner";
const OWNER_PIN = "2468";
const PROFILE_PIN = "1357";
const META_REDIRECT = "https://meta.zurot.org/auth/callback";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

async function seedAccount(t: ReturnType<typeof convexTest>) {
  return await t.run(async ctx => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      clerkUserId: OWNER_SUBJECT,
      email: "owner@example.invalid",
      createdAt: now,
      lastLoginAt: now,
    });
    await ctx.db.insert("accountSettings", {
      userId,
      ownerPinHash: hex(sha256(OWNER_PIN)),
    });
    const ownerProfileId = await ctx.db.insert("profiles", {
      userId: OWNER_SUBJECT,
      name: "Owner",
      emoji: "🌈",
      color: "#334155",
      role: "parent",
      createdAt: now,
    });
    const childProfileId = await ctx.db.insert("profiles", {
      userId: OWNER_SUBJECT,
      name: "Child",
      emoji: "🦁",
      color: "#312e81",
      role: "student",
      pinHash: hex(sha256(PROFILE_PIN)),
      createdAt: now,
    });
    await ctx.db.insert("oauthClients", {
      clientId: "meta-control-room",
      redirectUris: [META_REDIRECT],
      tokenEndpointAuthMethod: "client_secret_post",
    });
    return { ownerProfileId, childProfileId };
  });
}

describe("TV device lifecycle", () => {
  it("pairs, claims, selects profiles, filters apps, creates OIDC code, and revokes", async () => {
    const t = convexTest(schema, modules);
    const { ownerProfileId, childProfileId } = await seedAccount(t);
    const owner = t.withIdentity({ subject: OWNER_SUBJECT });

    const pairing = await t.mutation(api.tv.startPairing, {});
    expect(await t.query(api.tv.getActivationDetails, {
      pairingId: pairing.pairingId,
      userCode: pairing.userCode,
    })).toMatchObject({ userCode: pairing.userCode });

    const approval = await owner.mutation(api.tv.approvePairing, {
      pairingId: pairing.pairingId,
      userCode: pairing.userCode,
      deviceName: "Lobby TV",
      ownerPin: OWNER_PIN,
    });
    expect(approval).toMatchObject({ connected: true, deviceName: "Lobby TV" });

    const claimed = await t.mutation(api.tv.claimPairing, {
      pairingId: pairing.pairingId,
      deviceToken: pairing.deviceToken,
    });
    let home = await t.query(api.tv.getDeviceHome, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
    });
    expect(home.profiles).toHaveLength(2);
    expect(home.activeProfile).toBeNull();

    expect(await t.mutation(api.tv.selectProfile, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
      profileId: childProfileId,
      pin: PROFILE_PIN,
    })).toMatchObject({ selected: true });
    home = await t.query(api.tv.getDeviceHome, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
    });
    expect(home.activeProfile?.id).toBe(childProfileId);
    expect(home.apps.map(app => app.id)).toEqual([
      "tzura-creator",
      "mall-hebrew-adventures",
      "letters-lab",
      "story-castle",
      "math-market",
    ]);
    expect(home.apps.every(app => app.launchReady === false)).toBe(true);

    await t.mutation(api.tv.clearProfile, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
    });
    await t.mutation(api.tv.selectProfile, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
      profileId: ownerProfileId,
    });
    home = await t.query(api.tv.getDeviceHome, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
    });
    expect(home.apps.map(app => app.id)).toContain("meta-control-room");
    expect(home.apps.map(app => app.id)).not.toContain("devices");
    expect(home.apps.find(app => app.id === "meta-control-room")?.launchReady).toBe(true);

    await t.mutation(api.tv.createAuthorizationCode, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
      profileId: ownerProfileId,
      code: "synthetic-authorization-code",
      clientId: "meta-control-room",
      redirectUri: META_REDIRECT,
      expiresAt: Date.now() + 60_000,
      codeChallenge: "A".repeat(43),
      nonce: "B".repeat(43),
    });
    const storedCode = await t.run(async ctx =>
      await ctx.db.query("authCodes").withIndex("by_code", q =>
        q.eq("code", "synthetic-authorization-code")
      ).first()
    );
    expect(storedCode).toMatchObject({
      profileId: ownerProfileId,
      clientId: "meta-control-room",
      redirectUri: META_REDIRECT,
      consumed: false,
      codeChallengeMethod: "S256",
    });

    expect(await owner.query(api.tv.listDevices, { ownerPin: OWNER_PIN })).toHaveLength(1);
    await t.mutation(api.tv.revokeSelf, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
    });
    await expect(t.query(api.tv.getDeviceHome, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
    })).rejects.toThrow();
  });

  it("locks repeated owner and profile PIN failures", async () => {
    const t = convexTest(schema, modules);
    const { childProfileId } = await seedAccount(t);
    const owner = t.withIdentity({ subject: OWNER_SUBJECT });

    const lockedPairing = await t.mutation(api.tv.startPairing, {});
    let ownerFailure: { connected: boolean; error?: string } | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      ownerFailure = await owner.mutation(api.tv.approvePairing, {
        pairingId: lockedPairing.pairingId,
        userCode: lockedPairing.userCode,
        deviceName: "Locked TV",
        ownerPin: "0000",
      });
    }
    expect(ownerFailure).toMatchObject({ connected: false, error: "pin_locked" });
    expect(await owner.mutation(api.tv.approvePairing, {
      pairingId: lockedPairing.pairingId,
      userCode: lockedPairing.userCode,
      deviceName: "Locked TV",
      ownerPin: OWNER_PIN,
    })).toMatchObject({ connected: false, error: "pin_locked" });

    const pairing = await t.mutation(api.tv.startPairing, {});
    await owner.mutation(api.tv.approvePairing, {
      pairingId: pairing.pairingId,
      userCode: pairing.userCode,
      deviceName: "Profile Lock TV",
      ownerPin: OWNER_PIN,
    });
    const claimed = await t.mutation(api.tv.claimPairing, {
      pairingId: pairing.pairingId,
      deviceToken: pairing.deviceToken,
    });
    let profileFailure: { selected: boolean; error?: string } | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      profileFailure = await t.mutation(api.tv.selectProfile, {
        deviceId: claimed.deviceId,
        deviceToken: pairing.deviceToken,
        profileId: childProfileId,
        pin: "0000",
      });
    }
    expect(profileFailure).toMatchObject({ selected: false, error: "pin_locked" });
    expect(await t.mutation(api.tv.selectProfile, {
      deviceId: claimed.deviceId,
      deviceToken: pairing.deviceToken,
      profileId: childProfileId,
      pin: PROFILE_PIN,
    })).toMatchObject({ selected: false, error: "pin_locked" });
  });
});
