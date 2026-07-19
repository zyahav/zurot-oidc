import { NextResponse } from "next/server";
import { getOpenIDConfiguration, ISSUER } from "@/lib/jwt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET() {
  return NextResponse.json(getOpenIDConfiguration(ISSUER), {
    headers: corsHeaders,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
