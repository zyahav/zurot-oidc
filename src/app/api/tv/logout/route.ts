import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import {
  TV_SESSION_COOKIE,
  isSameOriginRequest,
  parseTvCredential,
  tvCookieOptions,
} from "@/lib/tv-session";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "request_not_accepted" }, { status: 403 });
  }
  const credential = parseTvCredential(request.cookies.get(TV_SESSION_COOKIE)?.value);
  if (credential) {
    try {
      await convexServer.mutation(api.tv.revokeSelf, {
        deviceId: credential.id as Id<"tvDevices">,
        deviceToken: credential.token,
      });
    } catch {
      // The cookie is cleared even if the device was already revoked remotely.
    }
  }
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(TV_SESSION_COOKIE, "", tvCookieOptions(0));
  return response;
}
