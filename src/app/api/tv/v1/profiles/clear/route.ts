import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import {
  nativeTvJsonHeaders,
  parseNativeTvAuthorization,
} from "@/lib/tv-native-session";

export async function POST(request: NextRequest) {
  const credential = parseNativeTvAuthorization(request);
  if (!credential) {
    return NextResponse.json(
      { error: "device_session_required" },
      { status: 401, headers: nativeTvJsonHeaders }
    );
  }

  await convexServer.mutation(api.tv.clearProfile, {
    deviceId: credential.id as Id<"tvDevices">,
    deviceToken: credential.token,
  });
  return NextResponse.json({ cleared: true }, { headers: nativeTvJsonHeaders });
}
