import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { TV_SESSION_COOKIE, parseTvCredential } from "@/lib/tv-session";

export async function GET(request: NextRequest) {
  const credential = parseTvCredential(request.cookies.get(TV_SESSION_COOKIE)?.value);
  if (!credential) return NextResponse.json({ error: "tv_session_required" }, { status: 401 });
  try {
    const home = await convexServer.query(api.tv.getDeviceHome, {
      deviceId: credential.id as Id<"tvDevices">,
      deviceToken: credential.token,
    });
    return NextResponse.json(home);
  } catch {
    return NextResponse.json({ error: "tv_session_not_active" }, { status: 401 });
  }
}
