import { NextResponse } from "next/server";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { authenticateMediaApiRequest } from "@/lib/media-api-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ mediaId: string }> }
) {
  const mediaContext = await authenticateMediaApiRequest(request);
  if (!mediaContext) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { mediaId } = await context.params;
  const { convex, actorArgs } = mediaContext;
  try {
    const media = await convex.query(api.media.getOwnMedia, {
      ...actorArgs,
      mediaId: mediaId as Id<"mediaItems">,
    });
    if (!media) {
      return NextResponse.json({ error: "media_not_found" }, { status: 404 });
    }
    return NextResponse.json({
      mediaId: media._id,
      title: media.title,
      description: media.description,
      status: media.status,
      moderationStatus: media.moderationStatus,
      visibility: media.visibility,
      nativeLanguageCode: media.nativeLanguageCode,
      learningLanguageCode: media.learningLanguageCode,
      durationSeconds: media.durationSeconds,
      thumbnailUrl: media.thumbnailUrl,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
      publishedAt: media.publishedAt,
    });
  } catch {
    return NextResponse.json({ error: "media_not_found" }, { status: 404 });
  }
}
