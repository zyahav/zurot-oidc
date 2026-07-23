import { NextResponse } from "next/server";
import { api } from "../../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../../convex/_generated/dataModel";
import { authenticateMediaApiRequest } from "@/lib/media-api-auth";

export async function POST(
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
    await convex.mutation(api.media.markUploadComplete, {
      ...actorArgs,
      mediaId: mediaId as Id<"mediaItems">,
    });
    return NextResponse.json({ ok: true, status: "processing" });
  } catch {
    return NextResponse.json({ error: "media_not_found" }, { status: 404 });
  }
}
