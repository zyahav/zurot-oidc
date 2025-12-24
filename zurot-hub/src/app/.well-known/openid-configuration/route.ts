import { NextRequest, NextResponse } from "next/server";
import { getOpenIDConfiguration } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const config = getOpenIDConfiguration(baseUrl);

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
