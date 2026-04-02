import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const getConvexUrl = () => {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL for manage recovery route");
  }
  return convexUrl;
};

export async function POST(request: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }

    const body = (await request.json()) as { otp?: string };
    if (!body.otp || !/^\d{6}$/.test(body.otp)) {
      return NextResponse.json(
        { error: "Recovery code must be exactly 6 digits." },
        { status: 400 }
      );
    }

    const convex = new ConvexHttpClient(getConvexUrl());
    convex.setAuth(token);

    const result = await convex.mutation(api.profiles.verifyRecoveryOtp, { otp: body.otp });
    if (!result.verified) {
      return NextResponse.json({ error: "Invalid recovery code." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Recovery verified. You can now set a new owner PIN.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
