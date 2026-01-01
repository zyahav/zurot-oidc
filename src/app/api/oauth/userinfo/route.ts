import { NextRequest, NextResponse } from "next/server";
import { convexServer } from "@/lib/convex-server";
import { api } from "../../../../../convex/_generated/api";
import { verifyToken } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "invalid_token" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify and decode token
    const payload = await verifyToken(token);
    if (!payload || !payload.sub) {
      return NextResponse.json(
        { error: "invalid_token" },
        { status: 401 }
      );
    }

    const profileId = payload.sub as string;

    // Get fresh profile data from Convex
    const profile = await convexServer.query(api.oauth.getProfileForToken, {
      profileId,
    });

    if (!profile) {
      return NextResponse.json(
        { error: "profile_not_found" },
        { status: 404 }
      );
    }

    // Return userinfo response
    return NextResponse.json(
      {
        sub: profileId,
        name: profile.displayName,
        preferred_username: profile.handle,
        picture: profile.avatarUrl,
        "https://zurot.org/profile_context": {
          profileId: profile._id,
          role: profile.role,
          status: profile.status,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Userinfo endpoint error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
