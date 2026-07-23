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

  let body: { profileId?: string; pin?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: nativeTvJsonHeaders }
    );
  }
  if (!body.profileId) {
    return NextResponse.json(
      { error: "profile_required" },
      { status: 400, headers: nativeTvJsonHeaders }
    );
  }

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
        { status: 403, headers: nativeTvJsonHeaders }
      );
    }
    return NextResponse.json({ selected: true }, { headers: nativeTvJsonHeaders });
  } catch {
    return NextResponse.json(
      { error: "profile_not_available" },
      { status: 400, headers: nativeTvJsonHeaders }
    );
  }
}
