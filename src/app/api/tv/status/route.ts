import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import {
  TV_PAIRING_COOKIE,
  TV_SESSION_COOKIE,
  isSameOriginRequest,
  parseTvCredential,
  serializeTvCredential,
  tvCookieOptions,
} from "@/lib/tv-session";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "request_not_accepted" }, { status: 403 });
  }
  const pairing = parseTvCredential(request.cookies.get(TV_PAIRING_COOKIE)?.value);
  if (!pairing) return NextResponse.json({ status: "missing" }, { status: 401 });

  const pairingId = pairing.id as Id<"tvPairings">;
  const status = await convexServer.query(api.tv.pairingStatus, {
    pairingId,
    deviceToken: pairing.token,
  });
  if (status.status !== "approved") return NextResponse.json(status);

  const claimed = await convexServer.mutation(api.tv.claimPairing, {
    pairingId,
    deviceToken: pairing.token,
  });
  const response = NextResponse.json({ status: "approved" });
  response.cookies.set(
    TV_SESSION_COOKIE,
    serializeTvCredential({ id: claimed.deviceId, token: pairing.token }),
    tvCookieOptions(365 * 24 * 60 * 60)
  );
  response.cookies.set(TV_PAIRING_COOKIE, "", tvCookieOptions(0));
  return response;
}
