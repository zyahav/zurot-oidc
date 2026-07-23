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
  if (credential) {
    try {
      await convexServer.mutation(api.tv.revokeSelf, {
        deviceId: credential.id as Id<"tvDevices">,
        deviceToken: credential.token,
      });
    } catch {
      // Revocation is idempotent for clients that have already been revoked.
    }
  }
  return NextResponse.json({ revoked: true }, { headers: nativeTvJsonHeaders });
}
