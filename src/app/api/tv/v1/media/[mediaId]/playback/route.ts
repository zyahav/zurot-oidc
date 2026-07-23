import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../../convex/_generated/dataModel";
import { convexServer } from "@/lib/convex-server";
import { createTvPlaybackUrl } from "@/lib/bunny-stream";
import {
  nativeTvJsonHeaders,
  parseNativeTvAuthorization,
} from "@/lib/tv-native-session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  const credential = parseNativeTvAuthorization(request);
  if (!credential) {
    return NextResponse.json(
      { error: "device_session_required" },
      { status: 401, headers: nativeTvJsonHeaders }
    );
  }
  const { mediaId } = await context.params;
  try {
    const authorization = await convexServer.query(api.tv.authorizeMediaPlayback, {
      deviceId: credential.id as Id<"tvDevices">,
      deviceToken: credential.token,
      mediaId: mediaId as Id<"mediaItems">,
    });
    const playback = createTvPlaybackUrl(authorization.providerVideoId);
    return NextResponse.json({
      sessionId: crypto.randomUUID(),
      mediaId: authorization.mediaId,
      title: authorization.title,
      durationSeconds: authorization.durationSeconds,
      streamFormat: "hls",
      url: playback.url,
      expiresAt: playback.expiresAt,
    }, { headers: nativeTvJsonHeaders });
  } catch (error) {
    const unavailable =
      error instanceof Error && error.message.includes("not configured");
    return NextResponse.json(
      { error: unavailable ? "playback_not_configured" : "media_not_authorized" },
      { status: unavailable ? 503 : 403, headers: nativeTvJsonHeaders }
    );
  }
}
