import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import { generateIdToken, generateAccessToken } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let grantType: string | null = null;
    let code: string | null = null;
    let clientId: string | null = null;
    let redirectUri: string | null = null;

    // Parse body based on content type
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await request.text();
      const params = new URLSearchParams(body);
      grantType = params.get("grant_type");
      code = params.get("code");
      clientId = params.get("client_id");
      redirectUri = params.get("redirect_uri");
    } else {
      const body = await request.json();
      grantType = body.grant_type;
      code = body.code;
      clientId = body.client_id;
      redirectUri = body.redirect_uri;
    }

    // Validate grant type
    if (grantType !== "authorization_code") {
      return NextResponse.json(
        { error: "unsupported_grant_type" },
        { status: 400 }
      );
    }

    if (!code || !clientId || !redirectUri) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Missing parameters" },
        { status: 400 }
      );
    }

    // Consume authorization code and get profile
    const result = await convexServer.mutation(api.oauth.consumeAuthorizationCode, {
      code,
      clientId,
      redirectUri,
    });

    // Generate tokens
    const tokenPayload = {
      profileId: result.profileId,
      displayName: result.profile.displayName,
      handle: result.profile.handle,
      role: result.profile.role,
      userId: result.userId,
      clientId,
      accountId: `account_${result.userId}`, // Per OIDC spec v1.3: account_id as metadata
    };

    const idToken = await generateIdToken(tokenPayload);
    const accessToken = await generateAccessToken(tokenPayload);

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        id_token: idToken,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Token endpoint error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
