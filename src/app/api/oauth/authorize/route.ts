import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { profileId, clientId, redirectUri, state, code_challenge, code_challenge_method } = body;

    if (!profileId || !clientId || !redirectUri || !state) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Validate PKCE code_challenge_method if provided
    if (code_challenge_method && code_challenge_method !== "S256" && code_challenge_method !== "plain") {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Unsupported code_challenge_method. Use S256 or plain." },
        { status: 400 }
      );
    }

    // Validate client (for now, allow test-client and localhost)
    const validClients = ["test-client"];
    const validRedirects = [
      "http://localhost:3000/test",
      "http://localhost:3000/auth/callback",
    ];

    if (!validClients.includes(clientId)) {
      // Check database for registered clients
      const clientValidation = await convexServer.query(api.oauth.validateClient, {
        clientId,
        redirectUri,
      });
      if (!clientValidation.valid) {
        return NextResponse.json(
          { error: clientValidation.error || "Invalid client" },
          { status: 400 }
        );
      }
    } else if (!validRedirects.some((r) => redirectUri.startsWith(r))) {
      return NextResponse.json(
        { error: "Invalid redirect URI" },
        { status: 400 }
      );
    }

    // Generate secure authorization code
    const code = crypto.randomBytes(32).toString("base64url");

    // Store authorization code with PKCE params
    await convexServer.mutation(api.oauth.storeAuthorizationCode, {
      code,
      profileId: profileId as Id<"profiles">,
      clientId,
      redirectUri,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
    });

    return NextResponse.json({
      success: true,
      code,
    });
  } catch (error) {
    console.error("OAuth authorize error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
