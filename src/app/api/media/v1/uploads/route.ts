import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  createBunnyVideo,
  createTusUploadAuthorization,
} from "@/lib/bunny-stream";
import { authenticateMediaApiRequest } from "@/lib/media-api-auth";

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export async function POST(request: NextRequest) {
  const mediaContext = await authenticateMediaApiRequest(request);
  if (!mediaContext) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const title = text(body.title, 160);
  const idempotencyKey =
    text(request.headers.get("idempotency-key"), 128) ||
    text(body.idempotencyKey, 128);
  const creatorProfileId = text(body.creatorProfileId, 128);
  const visibility = body.visibility;
  const mimeType = text(body.mimeType, 120).toLowerCase();
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
  const allowedMimeTypes = new Set([
    "video/mp4",
    "video/quicktime",
    "video/x-matroska",
    "video/webm",
  ]);
  if (
    !title ||
    !idempotencyKey ||
    !creatorProfileId ||
    !allowedMimeTypes.has(mimeType) ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > 5 * 1024 * 1024 * 1024 ||
    !["private", "family", "public"].includes(String(visibility))
  ) {
    return NextResponse.json({ error: "invalid_upload_request" }, { status: 400 });
  }

  const { convex, actorArgs } = mediaContext;
  const mediaId = await convex.mutation(api.media.createUpload, {
    ...actorArgs,
    creatorProfileId: creatorProfileId as Id<"profiles">,
    title,
    description: text(body.description, 1000) || undefined,
    nativeLanguageCode: text(body.nativeLanguageCode, 35) || undefined,
    learningLanguageCode: text(body.learningLanguageCode, 35) || undefined,
    ageBand: text(body.ageBand, 20) || undefined,
    visibility: visibility as "private" | "family" | "public",
    idempotencyKey,
  });
  const existing = await convex.query(api.media.getOwnMedia, {
    ...actorArgs,
    mediaId,
  });
  if (existing?.providerVideoId) {
    const expiration = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    return NextResponse.json({
      mediaId,
      upload: {
        protocol: "tus",
        ...createTusUploadAuthorization(existing.providerVideoId, expiration),
      },
    });
  }
  const claimed = await convex.mutation(api.media.claimProviderProvisioning, {
    ...actorArgs,
    mediaId,
  });
  if (!claimed) {
    return NextResponse.json(
      { mediaId, error: "upload_preparing" },
      { status: 409 }
    );
  }

  try {
    const bunnyVideo = await createBunnyVideo(title);
    await convex.mutation(api.media.attachBunnyVideo, {
      ...actorArgs,
      mediaId,
      providerVideoId: bunnyVideo.guid,
    });
    const expiration = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    return NextResponse.json({
      mediaId,
      upload: {
        protocol: "tus",
        ...createTusUploadAuthorization(bunnyVideo.guid, expiration),
      },
    }, { status: 201 });
  } catch {
    await convex.mutation(api.media.markProviderProvisioningFailed, {
      ...actorArgs,
      mediaId,
    });
    return NextResponse.json({ error: "media_provider_unavailable" }, { status: 502 });
  }
}
