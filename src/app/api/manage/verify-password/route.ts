import { createClerkClient } from "@clerk/backend";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type VerifyPasswordBody = {
  password?: string;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = (await request.json()) as VerifyPasswordBody;
  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const clerk = createClerkClient({ secretKey });
  try {
    await clerk.users.verifyPassword({ userId, password });
    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json({ error: "Incorrect account password." }, { status: 401 });
  }
}
