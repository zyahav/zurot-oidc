import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  nativeTvJsonHeaders,
  parseNativeTvAuthorization,
} from "@/lib/tv-native-session";

export async function GET(request: NextRequest) {
  const credential = parseNativeTvAuthorization(request);
  if (!credential) {
    return NextResponse.json(
      { error: "device_session_required" },
      { status: 401, headers: nativeTvJsonHeaders }
    );
  }

  try {
    const home = await convexServer.query(api.tv.getDeviceHome, {
      deviceId: credential.id as Id<"tvDevices">,
      deviceToken: credential.token,
    });
    return NextResponse.json(home, { headers: nativeTvJsonHeaders });
  } catch {
    return NextResponse.json(
      { error: "device_session_not_active" },
      { status: 401, headers: nativeTvJsonHeaders }
    );
  }
}
