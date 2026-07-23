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
  await convexServer.mutation(api.tv.clearProfile, {
    deviceId: credential.id as Id<"tvDevices">,
    deviceToken: credential.token,
  });
  return NextResponse.json({ cleared: true });
}
