import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { TV_SESSION_COOKIE, isSameOriginRequest, parseTvCredential } from "@/lib/tv-session";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "request_not_accepted" }, { status: 403 });
  }
  const credential = parseTvCredential(request.cookies.get(TV_SESSION_COOKIE)?.value);
  if (!credential) return NextResponse.json({ error: "tv_session_required" }, { status: 401 });
  const body = (await request.json()) as { profileId?: string; pin?: string };
  if (!body.profileId) return NextResponse.json({ error: "profile_required" }, { status: 400 });
  try {
    const result = await convexServer.mutation(api.tv.selectProfile, {
      deviceId: credential.id as Id<"tvDevices">,
      deviceToken: credential.token,
      profileId: body.profileId as Id<"profiles">,
      pin: body.pin || undefined,
    });
    if (!result.selected) {
      return NextResponse.json(
        { error: result.error, retryAt: result.retryAt },
        { status: 403 }
      );
    }
    return NextResponse.json({ selected: true });
  } catch {
    return NextResponse.json({ error: "profile_not_available" }, { status: 400 });
  }
}
