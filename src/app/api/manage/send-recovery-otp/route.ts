import { NextResponse } from "next/server";
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

const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return email;
  }
  if (local.length <= 2) {
    return `**@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
};

export async function POST() {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(getConvexUrl());
    convex.setAuth(token);

    const recovery = await convex.mutation(api.profiles.generateRecoveryOtp, {});
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY in environment." },
        { status: 500 }
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recovery.email],
        subject: "Your ZurOt Manage Profiles recovery code",
        text: `Your recovery code is ${recovery.otp}. It expires in 10 minutes.`,
      }),
    });

    if (!emailResponse.ok) {
      const resendError = await emailResponse.text();
      return NextResponse.json(
        { error: `Failed to send recovery email: ${resendError}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Recovery code sent to ${maskEmail(recovery.email)}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
