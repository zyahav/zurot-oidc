import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../../../convex/_generated/api";
import { nativeTvJsonHeaders } from "@/lib/tv-native-session";

const PLATFORMS = new Set([
  "roku",
  "android-tv",
  "google-tv",
  "fire-tv",
  "tvos",
  "lg-webos",
  "samsung-tizen",
]);

const optionalShortString = (value: unknown, maxLength: number): string | undefined =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim()
    : undefined;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: nativeTvJsonHeaders }
    );
  }

  const platform = optionalShortString(body.platform, 32);
  if (!platform || !PLATFORMS.has(platform)) {
    return NextResponse.json(
      { error: "unsupported_platform" },
      { status: 400, headers: nativeTvJsonHeaders }
    );
  }

  const pairing = await convexServer.mutation(api.tv.startPairing, {
    platform,
    appVersion: optionalShortString(body.appVersion, 32),
    deviceModel: optionalShortString(body.deviceModel, 80),
  });
  const origin = new URL(request.url).origin;
  const verificationUri = new URL("/tv/activate", origin);
  const verificationUriComplete = new URL(verificationUri);
  verificationUriComplete.searchParams.set("pairing", pairing.pairingId);
  verificationUriComplete.searchParams.set("code", pairing.userCode);

  return NextResponse.json(
    {
      authorizationId: pairing.pairingId,
      deviceSecret: pairing.deviceToken,
      userCode: pairing.userCode,
      verificationUri: verificationUri.toString(),
      verificationUriComplete: verificationUriComplete.toString(),
      expiresAt: pairing.expiresAt,
      intervalSeconds: 3,
    },
    { headers: nativeTvJsonHeaders }
  );
}
