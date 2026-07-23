import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import {
  nativeTvJsonHeaders,
  serializeNativeTvCredential,
} from "@/lib/tv-native-session";
import { parseTvCredential } from "@/lib/tv-session";

export async function POST(request: NextRequest) {
  let body: { authorizationId?: string; deviceSecret?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: nativeTvJsonHeaders }
    );
  }

  const pendingCredential = parseTvCredential(
    body.authorizationId && body.deviceSecret
      ? `${body.authorizationId}.${body.deviceSecret}`
      : undefined
  );
  if (!pendingCredential) {
    return NextResponse.json(
      { error: "invalid_device_authorization" },
      { status: 400, headers: nativeTvJsonHeaders }
    );
  }

  const status = await convexServer.query(api.tv.pairingStatus, {
    pairingId: pendingCredential.id as Id<"tvPairings">,
    deviceToken: pendingCredential.token,
  });
  if (status.status !== "approved") {
    return NextResponse.json(status, { headers: nativeTvJsonHeaders });
  }

  const claimed = await convexServer.mutation(api.tv.claimPairing, {
    pairingId: pendingCredential.id as Id<"tvPairings">,
    deviceToken: pendingCredential.token,
  });
  return NextResponse.json(
    {
      status: "approved",
      credential: serializeNativeTvCredential({
        id: claimed.deviceId,
        token: pendingCredential.token,
      }),
    },
    { headers: nativeTvJsonHeaders }
  );
}
