/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.{ts,js}");
const OWNER_SUBJECT = "clerk_media_owner";

afterEach(() => {
  delete process.env.MEDIA_API_FORWARD_SECRET;
});

async function seedCreator(t: ReturnType<typeof convexTest>) {
  return await t.run(async ctx => {
    const now = Date.now();
    await ctx.db.insert("users", {
      clerkUserId: OWNER_SUBJECT,
      email: "media-owner@example.invalid",
      createdAt: now,
      lastLoginAt: now,
    });
    return await ctx.db.insert("profiles", {
      userId: OWNER_SUBJECT,
      name: "Creator",
      emoji: "🎬",
      color: "#7c3aed",
      role: "parent",
      createdAt: now,
    });
  });
}

describe("media upload lifecycle", () => {
  it("auto-approves account-scoped uploads but moderates public uploads", async () => {
    const t = convexTest(schema, modules);
    const creatorProfileId = await seedCreator(t);
    const owner = t.withIdentity({ subject: OWNER_SUBJECT });

    const familyId = await owner.mutation(api.media.createUpload, {
      creatorProfileId,
      title: "Family lesson",
      visibility: "family",
      idempotencyKey: "family-upload-1",
    });
    const duplicateId = await owner.mutation(api.media.createUpload, {
      creatorProfileId,
      title: "Family lesson",
      visibility: "family",
      idempotencyKey: "family-upload-1",
    });
    const publicId = await owner.mutation(api.media.createUpload, {
      creatorProfileId,
      title: "Public lesson",
      visibility: "public",
      idempotencyKey: "public-upload-1",
    });

    expect(duplicateId).toBe(familyId);
    expect(await owner.query(api.media.getOwnMedia, { mediaId: familyId }))
      .toMatchObject({ moderationStatus: "approved", status: "created" });
    expect(await owner.query(api.media.getOwnMedia, { mediaId: publicId }))
      .toMatchObject({ moderationStatus: "pending", status: "created" });
  });

  it("retries stale provider provisioning and requires an attached upload", async () => {
    const t = convexTest(schema, modules);
    const creatorProfileId = await seedCreator(t);
    const owner = t.withIdentity({ subject: OWNER_SUBJECT });
    const mediaId = await owner.mutation(api.media.createUpload, {
      creatorProfileId,
      title: "Retry lesson",
      visibility: "private",
      idempotencyKey: "retry-upload-1",
    });

    expect(await owner.mutation(api.media.claimProviderProvisioning, { mediaId }))
      .toBe(true);
    expect(await owner.mutation(api.media.claimProviderProvisioning, { mediaId }))
      .toBe(false);
    await expect(owner.mutation(api.media.markUploadComplete, { mediaId }))
      .rejects.toThrow("not active");

    await t.run(async ctx => {
      await ctx.db.patch(mediaId, { updatedAt: Date.now() - 3 * 60 * 1000 });
    });
    expect(await owner.mutation(api.media.claimProviderProvisioning, { mediaId }))
      .toBe(true);

    await owner.mutation(api.media.attachBunnyVideo, {
      mediaId,
      providerVideoId: "bunny-video-guid",
    });
    await expect(owner.mutation(api.media.markUploadComplete, { mediaId }))
      .resolves.toBeNull();
    expect(await owner.query(api.media.getOwnMedia, { mediaId }))
      .toMatchObject({ providerVideoId: "bunny-video-guid", status: "processing" });
  });

  it("accepts a verified server-forwarded OIDC profile and rejects a bad secret", async () => {
    process.env.MEDIA_API_FORWARD_SECRET = "media-forward-secret";
    const t = convexTest(schema, modules);
    const creatorProfileId = await seedCreator(t);

    const mediaId = await t.mutation(api.media.createUpload, {
      actorProfileId: creatorProfileId,
      forwardSecret: "media-forward-secret",
      creatorProfileId,
      title: "Android upload",
      visibility: "family",
      idempotencyKey: "android-upload-1",
    });
    expect(await t.query(api.media.getOwnMedia, {
      actorProfileId: creatorProfileId,
      forwardSecret: "media-forward-secret",
      mediaId,
    })).toMatchObject({ title: "Android upload" });

    await expect(t.query(api.media.getOwnMedia, {
      actorProfileId: creatorProfileId,
      forwardSecret: "wrong-secret",
      mediaId,
    })).rejects.toThrow("Not authenticated");
  });
});
