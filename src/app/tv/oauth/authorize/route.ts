import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { TV_SESSION_COOKIE, parseTvCredential } from "@/lib/tv-session";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43,128}$/;
const OAUTH_VALUE = /^[A-Za-z0-9._~-]{16,256}$/;

export async function GET(request: NextRequest) {
  const credential = parseTvCredential(request.cookies.get(TV_SESSION_COOKIE)?.value);
  if (!credential) {
    return NextResponse.json({ error: "tv_session_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const responseType = url.searchParams.get("response_type") ?? "";
  const scope = url.searchParams.get("scope") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const nonce = url.searchParams.get("nonce") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "";
  const profileHint = url.searchParams.get("profile_hint") ?? "";

  if (
    responseType !== "code"
    || !scope.split(/\s+/).includes("openid")
    || !clientId
    || !redirectUri
    || !OAUTH_VALUE.test(state)
    || !OAUTH_VALUE.test(nonce)
    || !PKCE_CHALLENGE.test(codeChallenge)
    || codeChallengeMethod !== "S256"
    || !profileHint
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const code = crypto.randomBytes(32).toString("base64url");
  try {
    await convexServer.mutation(api.tv.createAuthorizationCode, {
      deviceId: credential.id as Id<"tvDevices">,
      deviceToken: credential.token,
      profileId: profileHint as Id<"profiles">,
      code,
      clientId,
      redirectUri,
      expiresAt: Date.now() + 10 * 60 * 1000,
      codeChallenge,
      nonce,
    });
  } catch {
    return NextResponse.json({ error: "request_not_accepted" }, { status: 400 });
  }

  const destination = new URL(redirectUri);
  destination.searchParams.set("code", code);
  destination.searchParams.set("state", state);
  return NextResponse.redirect(destination, 303);
}
