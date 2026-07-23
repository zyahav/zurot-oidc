import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import {
  TV_PAIRING_COOKIE,
  isSameOriginRequest,
  serializeTvCredential,
  tvCookieOptions,
} from "@/lib/tv-session";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "request_not_accepted" }, { status: 403 });
  }

  const pairing = await convexServer.mutation(api.tv.startPairing, {
    platform: "web",
  });
  const origin = new URL(request.url).origin;
  const activationUrl = new URL("/tv/activate", origin);
  activationUrl.searchParams.set("pairing", pairing.pairingId);
  activationUrl.searchParams.set("code", pairing.userCode);

  const response = NextResponse.json({
    userCode: pairing.userCode,
    expiresAt: pairing.expiresAt,
    activationUrl: activationUrl.toString(),
  });
  response.cookies.set(
    TV_PAIRING_COOKIE,
    serializeTvCredential({ id: pairing.pairingId, token: pairing.deviceToken }),
    tvCookieOptions(10 * 60)
  );
  return response;
}
