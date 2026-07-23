import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import {
  bunnyThumbnailUrl,
  getBunnyVideo,
  verifyBunnyWebhook,
} from "@/lib/bunny-stream";

type BunnyWebhook = {
  VideoLibraryId?: number;
  VideoGuid?: string;
  Status?: number;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const valid = verifyBunnyWebhook(
    rawBody,
    request.headers.get("x-bunnystream-signature"),
    request.headers.get("x-bunnystream-signature-version"),
    request.headers.get("x-bunnystream-signature-algorithm")
  );
  if (!valid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: BunnyWebhook;
  try {
    payload = JSON.parse(rawBody) as BunnyWebhook;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!payload.VideoGuid || typeof payload.Status !== "number") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  let metadata:
    | {
        durationSeconds?: number;
        thumbnailUrl?: string;
        availableResolutions?: string[];
      }
    | undefined;
  if (payload.Status === 3 || payload.Status === 4) {
    const video = await getBunnyVideo(payload.VideoGuid);
    metadata = {
      durationSeconds: video.length || undefined,
      thumbnailUrl: bunnyThumbnailUrl(video.guid, video.thumbnailFileName),
      availableResolutions: video.availableResolutions
        ?.split(",")
        .map(value => value.trim())
        .filter(Boolean),
    };
  }

  await convexServer.mutation(api.media.applyBunnyWebhook, {
    forwardSecret: process.env.BUNNY_STREAM_WEBHOOK_FORWARD_SECRET ?? "",
    providerVideoId: payload.VideoGuid,
    status: payload.Status,
    ...metadata,
  });
  return NextResponse.json({ ok: true });
}
