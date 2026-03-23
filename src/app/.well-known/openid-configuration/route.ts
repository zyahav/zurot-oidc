import { NextResponse } from "next/server";
import { getOpenIDConfiguration, ISSUER } from "@/lib/jwt";

export async function GET() {
  return NextResponse.json(getOpenIDConfiguration(ISSUER));
}
